$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$readinessPath = Join-Path $repoRoot "admin\backend\services\readinessQueueService.js"
$realtimePath = Join-Path $repoRoot "admin\backend\services\realtimeBridgeService.js"

foreach ($path in @($readinessPath, $realtimePath)) {
    if (-not (Test-Path $path)) {
        throw "File not found: $path"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $readinessPath "$readinessPath.backup-$timestamp"
Copy-Item $realtimePath "$realtimePath.backup-$timestamp"

# ---------------------------------------------------------
# 1) FCFS sync: make all writes idempotent.
# No UPDATE => no Postgres Realtime UPDATE event.
# ---------------------------------------------------------
$readiness = Get-Content $readinessPath -Raw

$oldQueueUpdate = @'
          WHERE application_id = $1::uuid
        `,
        [row.application_id, row.ready_at, queuePosition]
'@

$newQueueUpdate = @'
          WHERE application_id = $1::uuid
            AND (
              queue_position IS DISTINCT FROM $3::integer
              OR fcfs_completed_at IS NULL
              OR requirements_verified_at IS NULL
            )
        `,
        [row.application_id, row.ready_at, queuePosition]
'@

if ($readiness.Contains($newQueueUpdate)) {
    Write-Host "[OK] FCFS queue-position update is already idempotent."
} elseif ($readiness.Contains($oldQueueUpdate)) {
    $readiness = $readiness.Replace($oldQueueUpdate, $newQueueUpdate)
    Write-Host "[CHANGED] FCFS queue-position UPDATE now runs only when values change."
} else {
    throw "Could not find the FCFS queue-position UPDATE block. Backups were created; no optimized files were written."
}

$oldReservedWhere = @'
            WHERE application_id = $1::uuid
        `,
          [
            row.application_id,
            nextStatus,
          ]
'@

$newReservedWhere = @'
            WHERE application_id = $1::uuid
              AND (
                selection_status IS DISTINCT FROM $2::varchar(30)
                OR waitlist_position IS NOT NULL
                OR selected_at IS NULL
                OR (
                  CASE
                    WHEN LOWER(COALESCE(activation_status, '')) = 'activated'
                      THEN activation_status
                    ELSE 'Not Activated'
                  END
                ) IS DISTINCT FROM activation_status
              )
        `,
          [
            row.application_id,
            nextStatus,
          ]
'@

if ($readiness.Contains($newReservedWhere)) {
    Write-Host "[OK] Reserved/Promoted update is already idempotent."
} elseif ($readiness.Contains($oldReservedWhere)) {
    $readiness = $readiness.Replace($oldReservedWhere, $newReservedWhere)
    Write-Host "[CHANGED] Reserved/Promoted UPDATE now runs only when state changes."
} else {
    throw "Could not find the Reserved/Promoted UPDATE block."
}

$oldWaitlistedWhere = @'
        WHERE application_id = $1::uuid
    `,
          [
            row.application_id,
            waitingPosition,
          ]
'@

$newWaitlistedWhere = @'
        WHERE application_id = $1::uuid
          AND (
            selection_status IS DISTINCT FROM 'Waitlisted'
            OR waitlist_position IS DISTINCT FROM $2::integer
            OR waitlisted_at IS NULL
            OR (
              CASE
                WHEN LOWER(COALESCE(activation_status, '')) = 'activated'
                  THEN activation_status
                ELSE 'Not Activated'
              END
            ) IS DISTINCT FROM activation_status
          )
    `,
          [
            row.application_id,
            waitingPosition,
          ]
'@

if ($readiness.Contains($newWaitlistedWhere)) {
    Write-Host "[OK] Waitlisted update is already idempotent."
} elseif ($readiness.Contains($oldWaitlistedWhere)) {
    $readiness = $readiness.Replace($oldWaitlistedWhere, $newWaitlistedWhere)
    Write-Host "[CHANGED] Waitlisted UPDATE now runs only when state changes."
} else {
    throw "Could not find the Waitlisted UPDATE block."
}

Set-Content -Path $readinessPath -Value $readiness -Encoding UTF8 -NoNewline

# ---------------------------------------------------------
# 2) Realtime bridge:
# - keep realtime
# - suppress exact duplicate public events
# - stop converting document/endorsement changes into an extra
#   generic application:updated event
# ---------------------------------------------------------
$realtime = Get-Content $realtimePath -Raw

$dedupeMarker = "const PUBLIC_EVENT_DEDUPE_TTL_MS = 1500;"

if (-not $realtime.Contains($dedupeMarker)) {
    $anchor = @'
let bridgeStarted = false;
let bridgeChannel = null;
'@
    $replacement = @'
let bridgeStarted = false;
let bridgeChannel = null;

// Prevent the exact same Realtime payload from causing repeated Socket.IO
// refreshes while preserving immediate delivery of genuine changes.
const PUBLIC_EVENT_DEDUPE_TTL_MS = 1500;
const PUBLIC_EVENT_DEDUPE_MAX_ENTRIES = 1000;
const recentPublicEvents = new Map();

function buildPublicEventDedupeKey(eventName, payload = {}) {
  const entityId =
    payload.application_id ||
    payload.document_id ||
    payload.review_id ||
    payload.slip_id ||
    payload.renewal_id ||
    payload.message_id ||
    '';

  const version =
    payload.updated_at ||
    payload.reviewed_at ||
    payload.created_at ||
    payload.event_type ||
    '';

  if (!entityId || !version) return '';
  return `${eventName}:${entityId}:${version}`;
}

function shouldSuppressDuplicatePublicEvent(eventName, payload = {}) {
  const key = buildPublicEventDedupeKey(eventName, payload);
  if (!key) return false;

  const now = Date.now();
  const previous = recentPublicEvents.get(key);

  if (previous && now - previous < PUBLIC_EVENT_DEDUPE_TTL_MS) {
    return true;
  }

  recentPublicEvents.set(key, now);

  if (recentPublicEvents.size > PUBLIC_EVENT_DEDUPE_MAX_ENTRIES) {
    for (const [storedKey, storedAt] of recentPublicEvents.entries()) {
      if (now - storedAt >= PUBLIC_EVENT_DEDUPE_TTL_MS) {
        recentPublicEvents.delete(storedKey);
      }
      if (recentPublicEvents.size <= PUBLIC_EVENT_DEDUPE_MAX_ENTRIES) break;
    }
  }

  return false;
}
'@
    if (-not $realtime.Contains($anchor)) {
        throw "Could not find realtime bridge header."
    }
    $realtime = $realtime.Replace($anchor, $replacement)
    Write-Host "[CHANGED] Added exact-event duplicate suppression."
} else {
    Write-Host "[OK] Realtime duplicate suppression already present."
}

$oldEmitPublic = @'
function emitPublic(io, eventName, payload) {
  if (!io) return;

  const finalPayload = {
'@

$newEmitPublic = @'
function emitPublic(io, eventName, payload) {
  if (!io) return;
  if (shouldSuppressDuplicatePublicEvent(eventName, payload)) return;

  const finalPayload = {
'@

if ($realtime.Contains($newEmitPublic)) {
    Write-Host "[OK] emitPublic already uses duplicate suppression."
} elseif ($realtime.Contains($oldEmitPublic)) {
    $realtime = $realtime.Replace($oldEmitPublic, $newEmitPublic)
    Write-Host "[CHANGED] emitPublic now drops only exact duplicate events."
} else {
    throw "Could not find emitPublic()."
}

$documentGeneric = @'

  emitPublic(io, 'application:updated', {
    application_id: document.application_id,
    updated_at: document.updated_at,
    source: 'application_document',
    document_type: document.document_type,
    review_status: document.review_status,
    is_submitted: document.is_submitted,
    event_type: eventType,
  });
'@

if ($realtime.Contains($documentGeneric)) {
    $realtime = $realtime.Replace($documentGeneric, "")
    Write-Host "[CHANGED] Removed duplicate generic application:updated from document changes."
} else {
    Write-Host "[OK] Document changes already emit only their purpose-built event."
}

$endorsementGeneric = @'

  emitPublic(io, 'application:updated', {
    application_id: endorsement.application_id,
    updated_at: endorsement.updated_at,
    source: 'endorsement',
    current_stage: endorsement.current_stage,
    overall_status: endorsement.overall_status,
    event_type: eventType,
  });
'@

if ($realtime.Contains($endorsementGeneric)) {
    $realtime = $realtime.Replace($endorsementGeneric, "")
    Write-Host "[CHANGED] Removed duplicate generic application:updated from endorsement changes."
} else {
    Write-Host "[OK] Endorsement changes already emit only their purpose-built event."
}

Set-Content -Path $realtimePath -Value $realtime -Encoding UTF8 -NoNewline

# Syntax check before reporting success.
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    & node --check $readinessPath
    if ($LASTEXITCODE -ne 0) { throw "Node syntax check failed: $readinessPath" }

    & node --check $realtimePath
    if ($LASTEXITCODE -ne 0) { throw "Node syntax check failed: $realtimePath" }

    Write-Host "[PASS] Node syntax checks passed."
} else {
    Write-Warning "Node was not found in PATH, so syntax checks were skipped."
}

Write-Host ""
Write-Host "Optimization applied."
Write-Host "Backups:"
Write-Host "  $readinessPath.backup-$timestamp"
Write-Host "  $realtimePath.backup-$timestamp"
Write-Host ""
Write-Host "No npm package or new dependency is required."
Write-Host ""
Write-Host "Next commands:"
Write-Host "  git diff -- admin/backend/services/readinessQueueService.js admin/backend/services/realtimeBridgeService.js"
Write-Host "  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force"
Write-Host "  cd admin\backend"
Write-Host "  node server\server.js"
