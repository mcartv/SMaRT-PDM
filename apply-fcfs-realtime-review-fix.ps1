$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$readinessPath = Join-Path $repoRoot "admin\backend\services\readinessQueueService.js"
$realtimePath = Join-Path $repoRoot "admin\backend\services\realtimeBridgeService.js"
$reviewPagePath = Join-Path $repoRoot "admin\frontend\src\pages\ApplicationReview.jsx"

foreach ($path in @($readinessPath, $realtimePath, $reviewPagePath)) {
    if (-not (Test-Path $path)) {
        throw "File not found: $path"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $readinessPath "$readinessPath.backup-$timestamp"
Copy-Item $realtimePath "$realtimePath.backup-$timestamp"
Copy-Item $reviewPagePath "$reviewPagePath.backup-$timestamp"

# -------------------------------------------------------------------
# 1) FCFS: queue_position is the CURRENT active operational position.
#    Archived, approved/activated, rejected, and disqualified records
#    are excluded by the existing eligibility query, so the remaining
#    active queue is compacted to 1..N every sync.
# -------------------------------------------------------------------
$readiness = Get-Content $readinessPath -Raw

$oldRules = @'
 * 3. queue_position is permanent once assigned. We never renumber historical FCFS numbers.
 * 4. Reserved vs Waiting List is recalculated from the opening capacity and currently
 *    activated scholars. Activating a scholar consumes a slot; it does NOT free one.
 * 5. waitlist_position is dynamic and may change when a genuine slot is released.
'@

$newRules = @'
 * 3. queue_position is the current operational FCFS position among active eligible
 *    applicants only. It is compacted to 1..N whenever the opening queue is synchronized.
 *    Archived/tombstoned, approved/activated, rejected, and disqualified applications
 *    do not occupy an operational queue number.
 * 4. Reserved vs Waiting List is recalculated from the opening capacity and currently
 *    activated scholars. Activating a scholar consumes a slot; it does NOT free one.
 * 5. waitlist_position is dynamic and may change when the active queue changes.
'@

if (-not $readiness.Contains($oldRules)) {
    throw "Expected FCFS rules block was not found in $readinessPath. No files were changed beyond timestamped backups."
}
$readiness = $readiness.Replace($oldRules, $newRules)

$oldAssign = @'
    // Preserve all existing FCFS numbers. New applicants receive numbers after the
    // highest number ever assigned in this opening.
    const maxPositionResult = await client.query(
      `
        SELECT COALESCE(MAX(queue_position), 0)::int AS max_position
        FROM applications
        WHERE opening_id = $1::uuid
      `,
      [normalizedOpeningId]
    );

    let nextPosition = Number(maxPositionResult.rows[0]?.max_position || 0) + 1;

    for (const row of eligible) {
      const existingPosition = Number(row.queue_position);
      const queuePosition = Number.isFinite(existingPosition) && existingPosition > 0
        ? existingPosition
        : nextPosition++;

      await client.query(
        `
          UPDATE applications
          SET
            fcfs_completed_at = COALESCE(fcfs_completed_at, $2::timestamptz),
            queue_position = COALESCE(queue_position, $3::integer),
            requirements_verified_at = COALESCE(requirements_verified_at, $2::timestamptz),
            updated_at = now()
          WHERE application_id = $1::uuid
        `,
        [row.application_id, row.ready_at, queuePosition]
      );
    }
'@

$newAssign = @'
    // queue_position represents the CURRENT active operational queue.
    // The eligible query above already removes archived/tombstoned,
    // activated/approved, rejected, and disqualified applications.
    // Re-number the remaining queue contiguously while preserving FCFS order
    // through the immutable fcfs_completed_at/ready_at ordering.
    for (let index = 0; index < eligible.length; index += 1) {
      const row = eligible[index];
      const queuePosition = index + 1;

      await client.query(
        `
          UPDATE applications
          SET
            fcfs_completed_at = COALESCE(fcfs_completed_at, $2::timestamptz),
            queue_position = $3::integer,
            requirements_verified_at = COALESCE(requirements_verified_at, $2::timestamptz),
            updated_at = now()
          WHERE application_id = $1::uuid
        `,
        [row.application_id, row.ready_at, queuePosition]
      );
    }
'@

if (-not $readiness.Contains($oldAssign)) {
    throw "Expected immutable queue assignment block was not found in $readinessPath."
}
$readiness = $readiness.Replace($oldAssign, $newAssign)
Set-Content -Path $readinessPath -Value $readiness -Encoding UTF8 -NoNewline

# -------------------------------------------------------------------
# 2) Realtime bridge: application_document_reviews -> reviewed event.
# -------------------------------------------------------------------
$realtime = Get-Content $realtimePath -Raw

$documentHandlerMarker = @'
function handleEndorsementSlipChange(io, payload = {}) {
'@

if (-not $realtime.Contains($documentHandlerMarker)) {
    throw "Could not find endorsement handler marker in $realtimePath."
}

$reviewHandler = @'
function buildApplicationDocumentReviewPayload(row = {}) {
  return {
    review_id: row.review_id?.toString() || '',
    application_id: row.application_id?.toString() || '',
    document_key: row.document_key?.toString() || '',
    document_name: row.document_name?.toString() || '',
    review_status: row.review_status?.toString() || '',
    issue_severity: row.issue_severity?.toString() || null,
    reason_code: row.reason_code?.toString() || null,
    admin_comment: row.admin_comment?.toString() || null,
    reviewed_at:
      row.reviewed_at?.toString() ||
      row.updated_at?.toString() ||
      row.created_at?.toString() ||
      new Date().toISOString(),
  };
}

function handleApplicationDocumentReviewChange(io, payload = {}) {
  const eventType = safeText(payload.eventType).toUpperCase();
  const nextRow = payload.new || {};
  const previousRow = payload.old || {};
  const review = buildApplicationDocumentReviewPayload(
    nextRow.review_id ? nextRow : previousRow
  );

  if (!review.application_id) return;

  emitPublic(io, 'application-document:reviewed', {
    ...review,
    event_type: eventType,
    source: 'application_document_review',
  });

  // Keep aggregate application/readiness screens in sync as well.
  emitPublic(io, 'application:updated', {
    application_id: review.application_id,
    updated_at: review.reviewed_at,
    source: 'application_document_review',
    document_key: review.document_key,
    review_status: review.review_status,
    event_type: eventType,
  });
}

'@

if ($realtime.Contains("function handleApplicationDocumentReviewChange(io, payload = {})")) {
    Write-Host "Realtime review handler already present; skipping handler insertion."
} else {
    $realtime = $realtime.Replace($documentHandlerMarker, $reviewHandler + $documentHandlerMarker)
}

$applicationDocumentsSubscription = @'
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'application_documents' },
      (payload) => {
        handleApplicationDocumentChange(io, payload);
      }
    )
'@

$reviewSubscription = @'
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'application_documents' },
      (payload) => {
        handleApplicationDocumentChange(io, payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'application_document_reviews' },
      (payload) => {
        handleApplicationDocumentReviewChange(io, payload);
      }
    )
'@

if ($realtime.Contains("table: 'application_document_reviews'")) {
    Write-Host "Realtime review subscription already present; skipping subscription insertion."
} elseif ($realtime.Contains($applicationDocumentsSubscription)) {
    $realtime = $realtime.Replace($applicationDocumentsSubscription, $reviewSubscription)
} else {
    throw "Could not find application_documents realtime subscription in $realtimePath."
}

Set-Content -Path $realtimePath -Value $realtime -Encoding UTF8 -NoNewline

# -------------------------------------------------------------------
# 3) Application Review: use realtime review events; keep slow fallback,
#    remove egress-heavy 8-second general refresh.
# -------------------------------------------------------------------
$page = Get-Content $reviewPagePath -Raw

$oldTimer = @'
  useEffect(() => {
    const timer = window.setInterval(() => {
      loadData({ soft: true });
    }, 8000);

    return () => window.clearInterval(timer);
  }, []);
'@

$newTimer = @'
  useEffect(() => {
    // Realtime events are the primary refresh path. Keep only a slow,
    // visible-tab fallback in case a socket event is temporarily missed.
    const FALLBACK_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      loadData({ soft: true });
    };

    const timer = window.setInterval(
      refreshIfVisible,
      FALLBACK_REFRESH_INTERVAL_MS
    );

    return () => window.clearInterval(timer);
  }, []);
'@

if ($page.Contains($oldTimer)) {
    $page = $page.Replace($oldTimer, $newTimer)
} elseif (-not $page.Contains("FALLBACK_REFRESH_INTERVAL_MS = 2 * 60 * 1000")) {
    throw "Could not find the 8-second ApplicationReview refresh timer in $reviewPagePath."
}

$socketMarker = @'
  useSocketEvent('application-document:uploaded', () => loadData({ soft: true }), []);
  useSocketEvent('endorsement:updated', () => loadData({ soft: true }), []);
'@

$socketReplacement = @'
  useSocketEvent('application-document:uploaded', () => loadData({ soft: true }), []);
  useSocketEvent('application-document:reviewed', () => loadData({ soft: true }), []);
  useSocketEvent('endorsement:updated', () => loadData({ soft: true }), []);
'@

if ($page.Contains("useSocketEvent('application-document:reviewed'")) {
    Write-Host "ApplicationReview reviewed listener already present; skipping."
} elseif ($page.Contains($socketMarker)) {
    $page = $page.Replace($socketMarker, $socketReplacement)
} else {
    throw "Could not find ApplicationReview socket listener block in $reviewPagePath."
}

Set-Content -Path $reviewPagePath -Value $page -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "Applied FCFS + document review realtime code changes."
Write-Host ""
Write-Host "Changed:"
Write-Host "  $readinessPath"
Write-Host "  $realtimePath"
Write-Host "  $reviewPagePath"
Write-Host ""
Write-Host "Backups:"
Write-Host "  $readinessPath.backup-$timestamp"
Write-Host "  $realtimePath.backup-$timestamp"
Write-Host "  $reviewPagePath.backup-$timestamp"
Write-Host ""
Write-Host "Next:"
Write-Host "  git diff -- admin/backend/services/readinessQueueService.js admin/backend/services/realtimeBridgeService.js admin/frontend/src/pages/ApplicationReview.jsx"
