$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path

$presencePath = Join-Path $repoRoot "admin\backend\services\iotOcrPresenceService.js"
$socketEventsPath = Join-Path $repoRoot "admin\backend\utils\socketEvents.js"
$serverPath = Join-Path $repoRoot "admin\backend\server\server.js"
$docPath = Join-Path $repoRoot "admin\frontend\src\pages\DocumentVerification.jsx"

$paths = @($presencePath, $socketEventsPath, $serverPath, $docPath)
foreach ($path in $paths) {
    if (-not (Test-Path $path)) {
        throw "File not found: $path`nRun this script from the SMaRT-PDM repository root."
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
foreach ($path in $paths) {
    Copy-Item $path "$path.backup-$stamp"
}

function Restore-All {
    foreach ($path in $paths) {
        $backup = "$path.backup-$stamp"
        if (Test-Path $backup) {
            Copy-Item $backup $path -Force
        }
    }
}

try {
    Write-Host "[1/5] Replacing IoT OCR presence service with realtime transition tracking..."

    $presence = @'
const ONLINE_TTL_MS = Math.max(
    5000,
    Number(process.env.IOT_OCR_PI_ONLINE_TTL_MS || 12000)
);

const devices = new Map();

let availabilityListener = null;
let expiryTimer = null;
let lastPublishedSignature = null;

function pruneExpiredDevices(now = Date.now()) {
    for (const [deviceId, seenAt] of devices.entries()) {
        if (now - seenAt > ONLINE_TTL_MS) {
            devices.delete(deviceId);
        }
    }
}

function buildAvailability(now = Date.now()) {
    pruneExpiredDevices(now);

    const online = devices.size > 0;
    const lastSeenAt = online ? Math.max(...devices.values()) : null;

    return {
        online,
        device_count: devices.size,
        last_seen_at: lastSeenAt
            ? new Date(lastSeenAt).toISOString()
            : null,
        ttl_ms: ONLINE_TTL_MS,
    };
}

function availabilitySignature(availability) {
    return JSON.stringify({
        online: availability.online === true,
        device_count: Number(availability.device_count || 0),
    });
}

function publishIfChanged() {
    const availability = buildAvailability();
    const signature = availabilitySignature(availability);

    if (signature === lastPublishedSignature) {
        return availability;
    }

    lastPublishedSignature = signature;

    if (typeof availabilityListener === 'function') {
        try {
            availabilityListener(availability);
        } catch (error) {
            console.error(
                '[IoT OCR Presence] availability listener failed:',
                error?.message || error
            );
        }
    }

    return availability;
}

function scheduleExpiryCheck() {
    if (expiryTimer) {
        clearTimeout(expiryTimer);
        expiryTimer = null;
    }

    if (!devices.size) return;

    const now = Date.now();
    const earliestSeenAt = Math.min(...devices.values());
    const delay = Math.max(
        100,
        earliestSeenAt + ONLINE_TTL_MS - now + 50
    );

    expiryTimer = setTimeout(() => {
        expiryTimer = null;
        publishIfChanged();
        scheduleExpiryCheck();
    }, delay);

    expiryTimer.unref?.();
}

function checkIn(deviceId) {
    if (!deviceId) return getAvailability();

    devices.set(String(deviceId), Date.now());

    const availability = publishIfChanged();
    scheduleExpiryCheck();

    return availability;
}

function getAvailability() {
    return publishIfChanged();
}

function setAvailabilityListener(listener) {
    availabilityListener =
        typeof listener === 'function' ? listener : null;

    // Establish the baseline state immediately. If no browser is connected yet,
    // Socket.IO simply has no recipient; later changes still emit normally.
    publishIfChanged();
    scheduleExpiryCheck();

    return () => {
        if (availabilityListener === listener) {
            availabilityListener = null;
        }
    };
}

module.exports = {
    checkIn,
    getAvailability,
    setAvailabilityListener,
};
'@

    Set-Content -Path $presencePath -Value $presence -Encoding UTF8 -NoNewline

    Write-Host "[2/5] Adding pi:availability Socket.IO event..."

    $socketEvents = Get-Content $socketEventsPath -Raw

    if ($socketEvents -notmatch "piAvailability:\s*\(io,\s*data\)") {
        $needle = "    applicationOcrSnapshotSaved: (io, data) => emitEvent(io, 'application-ocr:snapshot-saved', data),"
        if (-not $socketEvents.Contains($needle)) {
            throw "Could not find application OCR socket event block."
        }

        $replacement = @"
$needle
    piAvailability: (io, data) => emitEvent(io, 'pi:availability', data),
"@
        $socketEvents = $socketEvents.Replace($needle, $replacement)
        Set-Content -Path $socketEventsPath -Value $socketEvents -Encoding UTF8 -NoNewline
        Write-Host "[CHANGED] Added pi:availability emitter."
    } else {
        Write-Host "[OK] pi:availability emitter already present."
    }

    Write-Host "[3/5] Wiring Pi presence transitions into admin Socket.IO..."

    $server = Get-Content $serverPath -Raw

    if ($server -notmatch "iotOcrPresenceService\s*=\s*require") {
        $needle = "const personalToolService = require('../services/personalToolService');"
        if (-not $server.Contains($needle)) {
            throw "Could not find personalToolService import in server.js."
        }

        $replacement = @"
$needle
const iotOcrPresenceService = require('../services/iotOcrPresenceService');
"@
        $server = $server.Replace($needle, $replacement)
    }

    if ($server -notmatch "setAvailabilityListener") {
        $needle = "app.set('io', io);"
        if (-not $server.Contains($needle)) {
            throw "Could not find app.set('io', io) in server.js."
        }

        $replacement = @"
app.set('io', io);

iotOcrPresenceService.setAvailabilityListener((availability) => {
  socketEvents.piAvailability(io, {
    ...availability,
    source: 'iot_ocr_presence',
  });
});
"@
        $server = $server.Replace($needle, $replacement)
    }

    Set-Content -Path $serverPath -Value $server -Encoding UTF8 -NoNewline

    Write-Host "[4/5] Optimizing Document Verification refreshes and Pi availability..."

    $doc = Get-Content $docPath -Raw

    # Replace immediate realtime refresh with a 200ms coalescer.
    if ($doc -notmatch "REALTIME_REFRESH_COALESCE_MS") {
        $oldBlock = @'
  const refreshCurrentDocumentVerification = useCallback(
    (data = {}) => {
      const eventApplicationId =
        data?.application_id?.toString?.() ||
        data?.applicationId?.toString?.() ||
        '';

      if (eventApplicationId && id && eventApplicationId !== id) {
        return;
      }

      fetchApplicationDocuments({ soft: true });
    },
    [id, fetchApplicationDocuments]
  );
'@

        if (-not $doc.Contains($oldBlock)) {
            throw "Could not find refreshCurrentDocumentVerification block."
        }

        $newBlock = @'
  const realtimeRefreshTimerRef = useRef(null);
  const REALTIME_REFRESH_COALESCE_MS = 200;

  const scheduleDocumentVerificationRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current) return;

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      fetchApplicationDocuments({ soft: true });
    }, REALTIME_REFRESH_COALESCE_MS);
  }, [fetchApplicationDocuments]);

  const refreshCurrentDocumentVerification = useCallback(
    (data = {}) => {
      const eventApplicationId =
        data?.application_id?.toString?.() ||
        data?.applicationId?.toString?.() ||
        '';

      if (eventApplicationId && id && eventApplicationId !== id) {
        return;
      }

      scheduleDocumentVerificationRefresh();
    },
    [id, scheduleDocumentVerificationRefresh]
  );

  useEffect(
    () => () => {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
    },
    []
  );
'@

        $doc = $doc.Replace($oldBlock, $newBlock)
        Write-Host "[CHANGED] Realtime refresh bursts now coalesce into one soft fetch."
    } else {
        Write-Host "[OK] Realtime refresh coalescing already present."
    }

    # Add pi:availability socket listener before the Pi availability HTTP fallback effect.
    if ($doc -notmatch "'pi:availability'") {
        $needle = @'
  useEffect(() => {
    let cancelled = false;
    const checkPiAvailability = async () => {
'@

        if (-not $doc.Contains($needle)) {
            throw "Could not find Pi availability useEffect."
        }

        $listener = @'
  const applyPiAvailability = useCallback((payload = {}) => {
    const data = payload?.data || payload || {};

    setPiOnline(data?.online === true);
    setPiAvailabilityChecked(true);

    if (data?.capabilities && typeof data.capabilities === 'object') {
      setIotOcrCapabilities(data.capabilities);
    }
  }, []);

  useSocketEvent(
    'pi:availability',
    applyPiAvailability,
    [applyPiAvailability]
  );

  useEffect(() => {
    let cancelled = false;
    const checkPiAvailability = async () => {
'@
        $doc = $doc.Replace($needle, $listener)
        Write-Host "[CHANGED] Document Verification now listens for pi:availability."
    } else {
        Write-Host "[OK] pi:availability listener already present."
    }

    # Replace fixed 5s Pi poll with initial fetch + visible-tab 60s safety fallback.
    $oldPiTail = @'
    checkPiAvailability();
    const timer = window.setInterval(checkPiAvailability, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
'@

    if ($doc.Contains($oldPiTail)) {
        $newPiTail = @'
    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      checkPiAvailability();
    };

    checkPiAvailability();

    const timer = window.setInterval(
      refreshIfVisible,
      60 * 1000
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkPiAvailability();
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, []);
'@
        $doc = $doc.Replace($oldPiTail, $newPiTail)
        Write-Host "[CHANGED] Pi availability fallback reduced from 5s to 60s visible-tab only."
    } elseif ($doc -match "60 \* 1000") {
        Write-Host "[OK] Pi availability fallback already optimized."
    } else {
        throw "Could not find the 5-second Pi availability interval."
    }

    Set-Content -Path $docPath -Value $doc -Encoding UTF8 -NoNewline

    Write-Host "[5/5] Validating..."

    & node --check $presencePath
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: iotOcrPresenceService.js" }

    & node --check $socketEventsPath
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: socketEvents.js" }

    & node --check $serverPath
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: server.js" }

    Push-Location (Join-Path $repoRoot "admin\frontend")
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Admin frontend build failed."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "[PASS] Phase 3 realtime-first traffic optimization applied."
    Write-Host ""
    Write-Host "No new npm package is required."
    Write-Host ""
    Write-Host "Backups:"
    foreach ($path in $paths) {
        Write-Host "  $path.backup-$stamp"
    }
    Write-Host ""
    Write-Host "Expected behavior:"
    Write-Host "  - Pi online/offline changes arrive through pi:availability immediately."
    Write-Host "  - HTTP Pi availability is only initial + 60s visible-tab fallback."
    Write-Host "  - Multiple realtime workflow events within 200ms produce one document refresh."
    Write-Host "  - Existing 2-minute document fallback remains unchanged."
}
catch {
    Write-Host ""
    Write-Host "[FAILED] $($_.Exception.Message)"
    Write-Host "Restoring all four files from backups..."
    Restore-All
    Write-Host "[RESTORED] No partial Phase 3 changes left behind."
    throw
}
