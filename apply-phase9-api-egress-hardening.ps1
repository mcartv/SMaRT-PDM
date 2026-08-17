$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$dashboard = Join-Path $repoRoot "admin\backend\services\dashboardService.js"
$docVerify = Join-Path $repoRoot "admin\frontend\src\pages\DocumentVerification.jsx"

foreach ($file in @($dashboard, $docVerify)) {
    if (-not (Test-Path $file)) { throw "Required file not found: $file" }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dashboardBackup = "$dashboard.backup-$stamp"
$docBackup = "$docVerify.backup-$stamp"
Copy-Item $dashboard $dashboardBackup -Force
Copy-Item $docVerify $docBackup -Force

try {
    $src = Get-Content $dashboard -Raw

    if (-not $src.Contains("DASHBOARD_CACHE_TTL_MS")) {
        $src = $src.Replace(
            "const supabase = require('../config/supabase');",
@'
const supabase = require('../config/supabase');

const DASHBOARD_CACHE_TTL_MS = Math.max(
    5000,
    Number(process.env.ADMIN_DASHBOARD_CACHE_TTL_MS || 30000)
);

let dashboardCache = null;
let dashboardCacheExpiresAt = 0;
let dashboardInFlight = null;
'@
        )
    }

    $src = $src.Replace(
@'
        const limit = Math.min(
            10000,
            Math.max(1, Number(options.limit || 10000))
        );
'@,
@'
        const limit = Math.min(
            5000,
            Math.max(1, Number(options.limit || 5000))
        );
'@
    )

    $src = $src.Replace(
        "'endorsement_slip_id, application_id, overall_status, completed_at, updated_at'",
        "'slip_id, application_id, overall_status, completed_at, updated_at'"
    )
    $src = $src.Replace(
        "fetchRows('renewals', '*'),",
        "fetchRows('renewals', 'renewal_id, status, created_at, updated_at'),"
    )
    $src = $src.Replace(
        "fetchRows('return_of_obligations', '*'),",
        "fetchRows('return_of_obligations', 'ro_id, ro_status, created_at, updated_at'),"
    )

    if ($src.Contains("exports.getAdminDashboard = async () => {")) {
        $src = $src.Replace(
            "exports.getAdminDashboard = async () => {",
            "async function buildAdminDashboard() {"
        )
        $trimmed = $src.TrimEnd()
        if (-not $trimmed.EndsWith("};")) {
            throw "Could not locate dashboard export terminator."
        }
        $last = $trimmed.LastIndexOf("};")
        $src = $trimmed.Substring(0, $last) + @'
}

exports.getAdminDashboard = async () => {
    const now = Date.now();

    if (dashboardCache && now < dashboardCacheExpiresAt) {
        return dashboardCache;
    }

    if (dashboardInFlight) {
        return dashboardInFlight;
    }

    dashboardInFlight = buildAdminDashboard();

    try {
        const result = await dashboardInFlight;
        dashboardCache = result;
        dashboardCacheExpiresAt = Date.now() + DASHBOARD_CACHE_TTL_MS;
        return result;
    } finally {
        dashboardInFlight = null;
    }
};
'@
    }

    Set-Content $dashboard $src -Encoding UTF8 -NoNewline

    $src = Get-Content $docVerify -Raw

    $refAnchor = @'
  const pollingRef = useRef(null);
  const activeIotRequestRef = useRef(null);
'@
    $refReplacement = @'
  const pollingRef = useRef(null);
  const activeIotRequestRef = useRef(null);
  const ocrRefreshSuppressedUntilRef = useRef(0);
'@

    if (-not $src.Contains("ocrRefreshSuppressedUntilRef")) {
        if (-not $src.Contains($refAnchor)) {
            throw "Could not locate OCR refs."
        }
        $src = $src.Replace($refAnchor, $refReplacement)
    }

    $oldRefreshGuard = @'
      if (eventApplicationId && id && eventApplicationId !== id) {
        return;
      }

      scheduleDocumentVerificationRefresh();
'@
    $newRefreshGuard = @'
      if (eventApplicationId && id && eventApplicationId !== id) {
        return;
      }

      if (
        activeIotRequestRef.current?.requestId ||
        Date.now() < ocrRefreshSuppressedUntilRef.current
      ) {
        return;
      }

      scheduleDocumentVerificationRefresh();
'@

    if (-not $src.Contains($oldRefreshGuard)) {
        throw "Could not locate generic realtime refresh guard."
    }
    $src = $src.Replace($oldRefreshGuard, $newRefreshGuard)

    $src = $src.Replace(
@'
              await fetchApplicationDocuments({ soft: true });
              stopPolling();
'@,
@'
              ocrRefreshSuppressedUntilRef.current = Date.now() + 5000;
              await fetchApplicationDocuments({ soft: true });
              stopPolling();
'@
    )

    $src = $src.Replace(
@'
              await fetchApplicationDocuments({ soft: true });
              setBlankIotOverride(
'@,
@'
              ocrRefreshSuppressedUntilRef.current = Date.now() + 5000;
              await fetchApplicationDocuments({ soft: true });
              setBlankIotOverride(
'@
    )

    Set-Content $docVerify $src -Encoding UTF8 -NoNewline

    Write-Host "[1/3] Syntax-check admin backend"
    & node --check $dashboard
    if ($LASTEXITCODE -ne 0) { throw "dashboardService.js syntax check failed." }

    Write-Host "[2/3] Build admin frontend"
    Push-Location (Join-Path $repoRoot "admin\frontend")
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "Admin frontend build failed." }
    }
    finally { Pop-Location }

    Write-Host "[3/3] Complete"
    Write-Host ""
    Write-Host "[PASS] Phase 9 API egress hardening applied."
    Write-Host "Restart/redeploy the admin backend and admin frontend."
}
catch {
    Copy-Item $dashboardBackup $dashboard -Force
    Copy-Item $docBackup $docVerify -Force
    Write-Host ""
    Write-Host "[FAILED] $($_.Exception.Message)"
    Write-Host "[RESTORED] Original files restored."
    throw
}
