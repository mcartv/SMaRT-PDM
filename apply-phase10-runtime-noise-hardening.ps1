$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$server = Join-Path $repoRoot "admin\backend\server\server.js"
$appService = Join-Path $repoRoot "admin\backend\services\applicationService.js"
$docVerify = Join-Path $repoRoot "admin\frontend\src\pages\DocumentVerification.jsx"

foreach ($file in @($server, $appService, $docVerify)) {
    if (-not (Test-Path $file)) { throw "Required file not found: $file" }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backups = @{}
foreach ($file in @($server, $appService, $docVerify)) {
    $backup = "$file.backup-$stamp"
    Copy-Item $file $backup -Force
    $backups[$file] = $backup
}

try {
    # 1) Distributed scheduler leader
    $src = Get-Content $server -Raw
    $supabaseImport = "const supabase = require('../config/supabase');"
    if (-not $src.Contains($supabaseImport)) { throw "Could not locate Supabase import." }
    if (-not $src.Contains("const pool = require('../config/db');")) {
        $src = $src.Replace($supabaseImport, "$supabaseImport`r`nconst pool = require('../config/db');")
    }

    $schedAnchor = "const SCHEDULER_INTERVAL_MS = 60 * 1000;"
    if (-not $src.Contains("SCHEDULER_LEADER_LOCK_KEY")) {
        $helper = @'
const SCHEDULER_INTERVAL_MS = 60 * 1000;
const SCHEDULER_LEADER_LOCK_KEY = 'smart-pdm:admin:scheduler-leader';

let schedulerLeaderClient = null;
let schedulerLeadershipPromise = null;

async function ensureSchedulerLeadership() {
  if (schedulerLeaderClient) return true;
  if (schedulerLeadershipPromise) return schedulerLeadershipPromise;

  schedulerLeadershipPromise = (async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS acquired',
        [SCHEDULER_LEADER_LOCK_KEY]
      );
      const acquired = result.rows?.[0]?.acquired === true;
      if (!acquired) {
        client.release();
        return false;
      }
      schedulerLeaderClient = client;
      client.on('error', (error) => {
        console.error('Scheduler leader database connection lost:', error.message);
        schedulerLeaderClient = null;
      });
      console.log('[Scheduler] This admin backend is the scheduler leader.');
      return true;
    } catch (error) {
      client.release();
      throw error;
    }
  })();

  try {
    return await schedulerLeadershipPromise;
  } finally {
    schedulerLeadershipPromise = null;
  }
}
'@
        if (-not $src.Contains($schedAnchor)) { throw "Could not locate scheduler interval." }
        $src = $src.Replace($schedAnchor, $helper)
    }

    foreach ($pair in @(
        @("const runAnnouncementScheduler = async () => {", "announcementSchedulerBusy = true;"),
        @("const runReminderScheduler = async () => {", "reminderSchedulerBusy = true;"),
        @("const runDigestScheduler = async () => {", "digestSchedulerBusy = true;")
    )) {
        $fn = $pair[0]; $busy = $pair[1]
        $start = $src.IndexOf($fn)
        if ($start -lt 0) { throw "Could not locate scheduler function: $fn" }
        $tryPos = $src.IndexOf("    try {", $start)
        if ($tryPos -lt 0) { throw "Could not locate scheduler try block: $fn" }
        $insertPos = $tryPos + "    try {".Length
        $guard = "`r`n      if (!(await ensureSchedulerLeadership())) return;"
        if ($src.Substring($start, [Math]::Min(500, $src.Length-$start)) -notmatch "ensureSchedulerLeadership") {
            $src = $src.Insert($insertPos, $guard)
        }
    }
    Set-Content $server $src -Encoding UTF8 -NoNewline

    # 2) Cache compact application_documents metadata lookup
    $src = Get-Content $appService -Raw
    $cacheAnchor = "const signedUrlInFlight = new Map();"
    if (-not $src.Contains("DOCUMENT_VIEW_METADATA_CACHE_TTL_MS")) {
        $cacheCode = @'
const signedUrlInFlight = new Map();

const DOCUMENT_VIEW_METADATA_CACHE_TTL_MS = Math.max(
    5000,
    Number(process.env.DOCUMENT_VIEW_METADATA_CACHE_TTL_MS || 30000)
);
const DOCUMENT_VIEW_METADATA_CACHE_MAX_ENTRIES = Math.max(
    100,
    Number(process.env.DOCUMENT_VIEW_METADATA_CACHE_MAX_ENTRIES || 1000)
);
const documentViewMetadataCache = new Map();
const documentViewMetadataInFlight = new Map();

function pruneDocumentViewMetadataCache(now = Date.now()) {
    for (const [key, entry] of documentViewMetadataCache.entries()) {
        if (!entry || entry.expiresAt <= now) documentViewMetadataCache.delete(key);
    }
    while (documentViewMetadataCache.size > DOCUMENT_VIEW_METADATA_CACHE_MAX_ENTRIES) {
        const oldestKey = documentViewMetadataCache.keys().next().value;
        if (oldestKey === undefined) break;
        documentViewMetadataCache.delete(oldestKey);
    }
}
'@
        if (-not $src.Contains($cacheAnchor)) { throw "Could not locate signed URL cache." }
        $src = $src.Replace($cacheAnchor, $cacheCode)
    }

    $viewAnchor = "exports.fetchApplicationDocumentViewUrl = async ({ applicationId, documentKey, source = 'preview' } = {}) => {"
    if (-not $src.Contains("getCachedApplicationDocumentForView")) {
        $helper = @'
async function getCachedApplicationDocumentForView(applicationId, documentKey) {
    const key = normalizeDocumentType(documentKey);
    const cacheKey = `${applicationId}:${key}`;
    const now = Date.now();
    const cached = documentViewMetadataCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        documentViewMetadataCache.delete(cacheKey);
        documentViewMetadataCache.set(cacheKey, cached);
        return cached.document;
    }
    if (documentViewMetadataInFlight.has(cacheKey)) {
        return documentViewMetadataInFlight.get(cacheKey);
    }

    const request = (async () => {
        const { data: rows, error } = await supabase
            .from('application_documents')
            .select('document_id, application_id, document_type, file_name, file_path, preview_path, is_submitted')
            .eq('application_id', applicationId);
        if (error) throw buildHttpError(500, error.message);
        const document = (rows || []).find((row) => getDocumentKey(row) === key) || null;
        documentViewMetadataCache.set(cacheKey, {
            document,
            expiresAt: Date.now() + DOCUMENT_VIEW_METADATA_CACHE_TTL_MS,
        });
        pruneDocumentViewMetadataCache();
        return document;
    })();

    documentViewMetadataInFlight.set(cacheKey, request);
    try {
        return await request;
    } finally {
        documentViewMetadataInFlight.delete(cacheKey);
    }
}

exports.fetchApplicationDocumentViewUrl = async ({ applicationId, documentKey, source = 'preview' } = {}) => {
'@
        if (-not $src.Contains($viewAnchor)) { throw "Could not locate view-url function." }
        $src = $src.Replace($viewAnchor, $helper)
    }

    $oldQuery = @'
    const { data: rows, error } = await supabase
        .from('application_documents')
        .select('document_id, application_id, document_type, file_name, file_path, preview_path, is_submitted')
        .eq('application_id', applicationId);
    if (error) throw buildHttpError(500, error.message);

    const document = (rows || []).find((row) => getDocumentKey(row) === key);
'@
    $newQuery = @'
    const document = await getCachedApplicationDocumentForView(
        applicationId,
        key
    );
'@
    if ($src.Contains($oldQuery)) {
        $src = $src.Replace($oldQuery, $newQuery)
    } elseif (-not $src.Contains("const document = await getCachedApplicationDocumentForView(")) {
        throw "Could not replace compact application_documents lookup."
    }
    Set-Content $appService $src -Encoding UTF8 -NoNewline

    # 3) OCR terminal refresh guard + generic realtime suppression
    $src = Get-Content $docVerify -Raw
    $terminalOld = @'
              await fetchApplicationDocuments({ soft: true });
            }
          }
        } catch (pollError) {
'@
    $terminalNew = @'
              ocrRefreshSuppressedUntilRef.current = Date.now() + 5000;
              await fetchApplicationDocuments({ soft: true });
            }
          }
        } catch (pollError) {
'@
    if ($src.Contains($terminalOld)) {
        $src = $src.Replace($terminalOld, $terminalNew)
    }

    if (-not $src.Contains("Date.now() < ocrRefreshSuppressedUntilRef.current")) {
        $plain = "      scheduleDocumentVerificationRefresh();"
        $idx = $src.IndexOf($plain)
        if ($idx -lt 0) { throw "Could not locate generic realtime refresh." }
        $guard = @'
      if (
        activeIotRequestRef.current?.requestId ||
        Date.now() < ocrRefreshSuppressedUntilRef.current
      ) {
        return;
      }

      scheduleDocumentVerificationRefresh();
'@
        $src = $src.Substring(0, $idx) + $guard + $src.Substring($idx + $plain.Length)
    }
    Set-Content $docVerify $src -Encoding UTF8 -NoNewline

    Write-Host "[1/4] Checking server syntax"
    & node --check $server
    if ($LASTEXITCODE -ne 0) { throw "server.js syntax check failed." }

    Write-Host "[2/4] Checking application service syntax"
    & node --check $appService
    if ($LASTEXITCODE -ne 0) { throw "applicationService.js syntax check failed." }

    Write-Host "[3/4] Building admin frontend"
    Push-Location (Join-Path $repoRoot "admin\frontend")
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "Admin frontend build failed." }
    } finally { Pop-Location }

    Write-Host "[4/4] Complete"
    Write-Host ""
    Write-Host "[PASS] Phase 10 runtime-noise hardening applied."
    Write-Host "Restart/redeploy the admin backend and admin frontend."
}
catch {
    foreach ($file in $backups.Keys) { Copy-Item $backups[$file] $file -Force }
    Write-Host ""
    Write-Host "[FAILED] $($_.Exception.Message)"
    Write-Host "[RESTORED] Original files restored."
    throw
}
