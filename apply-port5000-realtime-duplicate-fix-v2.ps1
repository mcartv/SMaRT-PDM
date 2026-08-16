$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$path = Join-Path $repoRoot "backend\src\services\realtimeBridgeService.js"

if (-not (Test-Path $path)) {
    throw "File not found: $path`nRun this script from the SMaRT-PDM repository root."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $path "$path.backup-$stamp"

$src = Get-Content $path -Raw

Write-Host "[1/4] Adding exact-event dedupe guard..."

if ($src -notmatch 'REALTIME_EVENT_DEDUPE_TTL_MS') {
    $guard = @'

// Exact-event suppression only. Genuine realtime changes are still delivered
// immediately; only the same event/entity/version emitted twice is dropped.
const REALTIME_EVENT_DEDUPE_TTL_MS = 1500;
const REALTIME_EVENT_DEDUPE_MAX = 1000;
const recentRealtimeEvents = new Map();

function buildRealtimeEventKey(eventName, payload = {}) {
  const entityId =
    payload.application_id ||
    payload.document_id ||
    payload.slip_id ||
    payload.notification_id ||
    payload.announcement_id ||
    payload.opening_id ||
    payload.message_id ||
    '';

  const version =
    payload.updated_at ||
    payload.created_at ||
    payload.event_type ||
    '';

  if (!entityId || !version) return '';
  return `${eventName}:${entityId}:${version}`;
}

function shouldSuppressRealtimeDuplicate(eventName, payload = {}) {
  const key = buildRealtimeEventKey(eventName, payload);
  if (!key) return false;

  const now = Date.now();
  const seenAt = recentRealtimeEvents.get(key);

  if (seenAt && now - seenAt < REALTIME_EVENT_DEDUPE_TTL_MS) {
    return true;
  }

  recentRealtimeEvents.set(key, now);

  if (recentRealtimeEvents.size > REALTIME_EVENT_DEDUPE_MAX) {
    for (const [storedKey, storedAt] of recentRealtimeEvents.entries()) {
      if (now - storedAt >= REALTIME_EVENT_DEDUPE_TTL_MS) {
        recentRealtimeEvents.delete(storedKey);
      }
      if (recentRealtimeEvents.size <= REALTIME_EVENT_DEDUPE_MAX) break;
    }
  }

  return false;
}
'@

    # Insert immediately after the first realtimeChannel declaration.
    $pattern = '(?m)^(?:\uFEFF)?let realtimeChannel = null;\s*$'
    if (-not [regex]::IsMatch($src, $pattern)) {
        throw "Could not find 'let realtimeChannel = null;' in $path"
    }

    $src = [regex]::Replace(
        $src,
        $pattern,
        { param($m) $m.Value + $guard },
        1
    )
    Write-Host "[CHANGED] Added dedupe guard."
} else {
    Write-Host "[OK] Dedupe guard already present."
}

Write-Host "[2/4] Protecting emitGlobal..."

if ($src -notmatch 'function emitGlobal\(io, eventName, payload\)\s*\{\s*if \(!io \|\| !eventName\) return;\s*if \(shouldSuppressRealtimeDuplicate') {
    $pattern = '(?s)function emitGlobal\(io, eventName, payload\)\s*\{\s*if \(!io \|\| !eventName\) return;\s*'
    if (-not [regex]::IsMatch($src, $pattern)) {
        throw "Could not locate emitGlobal()."
    }

    $replacement = @'
function emitGlobal(io, eventName, payload) {
  if (!io || !eventName) return;
  if (shouldSuppressRealtimeDuplicate(eventName, payload)) return;

'@

    $src = [regex]::Replace(
        $src,
        $pattern,
        { param($m) $replacement },
        1
    )
    Write-Host "[CHANGED] emitGlobal now suppresses exact duplicates."
} else {
    Write-Host "[OK] emitGlobal already protected."
}

Write-Host "[3/4] Removing synthetic duplicate application:updated events..."

$docPattern = "(?s)(emitGlobal\(io,\s*'application-document:uploaded',\s*eventPayload\);\s*)emitGlobal\(io,\s*'application:updated',\s*eventPayload\);"
if ([regex]::IsMatch($src, $docPattern)) {
    $src = [regex]::Replace(
        $src,
        $docPattern,
        '$1',
        1
    )
    Write-Host "[CHANGED] application_documents now emits only application-document:uploaded."
} else {
    Write-Host "[OK] No duplicate document -> application:updated emission found."
}

$endorsementPattern = "(?s)(emitGlobal\(io,\s*'endorsement:updated',\s*eventPayload\);\s*)emitGlobal\(io,\s*'application:updated',\s*\{\s*\.\.\.eventPayload,\s*source:\s*'endorsement',\s*\}\s*\);"
if ([regex]::IsMatch($src, $endorsementPattern)) {
    $src = [regex]::Replace(
        $src,
        $endorsementPattern,
        '$1',
        1
    )
    Write-Host "[CHANGED] endorsement_slips now emits only endorsement:updated."
} else {
    Write-Host "[OK] No duplicate endorsement -> application:updated emission found."
}

Set-Content -Path $path -Value $src -Encoding UTF8 -NoNewline

Write-Host "[4/4] Validating JavaScript syntax..."
& node --check $path
if ($LASTEXITCODE -ne 0) {
    Copy-Item "$path.backup-$stamp" $path -Force
    throw "Syntax check failed. Original file restored automatically."
}

Write-Host ""
Write-Host "[PASS] Port 5000 realtime bridge optimized successfully."
Write-Host "Backup: $path.backup-$stamp"
Write-Host "No npm package is required."
Write-Host ""
Write-Host "Verify changes with:"
Write-Host '  Select-String backend\src\services\realtimeBridgeService.js -Pattern "REALTIME_EVENT_DEDUPE|application-document:uploaded|endorsement:updated|application:updated"'
