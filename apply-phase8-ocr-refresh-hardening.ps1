$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$file = Join-Path $repoRoot "admin\frontend\src\pages\DocumentVerification.jsx"
if (-not (Test-Path $file)) { throw "Required file not found: $file" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-$stamp"
Copy-Item $file $backup

try {
    $src = Get-Content $file -Raw

    Write-Host "[1/4] Increase OCR fallback interval"
    $src = $src.Replace(
        "const IOT_OCR_STATUS_POLL_INTERVAL_MS = 500;",
        "const IOT_OCR_STATUS_POLL_INTERVAL_MS = 2000;"
    )

    Write-Host "[2/4] Replace full application refresh polling"

    $old = @'
    if (!pollingRef.current) {
      const pollPersistedRequest = async () => {
        try {
          await fetchApplicationDocuments({ soft: true });
        } finally {
          if (activeIotRequestRef.current?.requestId === requestId) {
            pollingRef.current = window.setTimeout(
              pollPersistedRequest,
              IOT_OCR_STATUS_POLL_INTERVAL_MS
            );
          }
        }
      };

      pollingRef.current = window.setTimeout(
        pollPersistedRequest,
        IOT_OCR_STATUS_POLL_INTERVAL_MS
      );
    }
'@

    $new = @'
    if (!pollingRef.current) {
      const pollPersistedRequest = async () => {
        let keepPolling = true;

        try {
          const response = await fetch(
            `${API_BASE}/api/applications/${id}/documents/${activeDocId}/iot-ocr?request_id=${encodeURIComponent(requestId)}`,
            {
              headers: {
                Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
              },
              cache: 'no-store',
            }
          );

          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(payload.error || 'Failed to refresh OCR request status.');
          }

          const latestRequest = payload?.data?.request || null;
          const candidate = payload?.data?.candidate || null;

          if (latestRequest?.request_id === requestId) {
            setIotOcrResults((current) => ({
              ...current,
              [activeDocId]: {
                ...(current[activeDocId] || {}),
                iot_ocr_request: latestRequest,
                ocr_job: latestRequest,
              },
            }));

            const requestStatus = String(latestRequest.status || '')
              .trim()
              .toLowerCase();

            if (candidate) {
              setReviewCandidate(candidate);
              setCorrectedFields(normalizeReviewFields(candidate));
              setRawOcrSnapshot(candidate.raw_text || '');
            }

            if (
              requestStatus === 'review_required' ||
              requestStatus === 'completed' ||
              requestStatus === 'cancelled' ||
              requestStatus === 'failed' ||
              requestStatus === 'expired'
            ) {
              keepPolling = false;
              setRunningIotOcr(false);

              if (activeIotRequestRef.current?.requestId === requestId) {
                activeIotRequestRef.current = null;
              }

              await fetchApplicationDocuments({ soft: true });
            }
          }
        } catch (pollError) {
          console.error('POLL IOT OCR STATUS ERROR:', pollError);
        } finally {
          if (
            keepPolling &&
            activeIotRequestRef.current?.requestId === requestId
          ) {
            pollingRef.current = window.setTimeout(
              pollPersistedRequest,
              IOT_OCR_STATUS_POLL_INTERVAL_MS
            );
          } else {
            pollingRef.current = null;
          }
        }
      };

      pollingRef.current = window.setTimeout(
        pollPersistedRequest,
        IOT_OCR_STATUS_POLL_INTERVAL_MS
      );
    }
'@

    if (-not $src.Contains($old)) {
        throw "Could not locate the OCR full-application polling block."
    }

    $src = $src.Replace($old, $new)
    Set-Content $file $src -Encoding UTF8 -NoNewline

    Write-Host "[3/4] Verify"
    $verify = Get-Content $file -Raw
    if ($verify.Contains("const IOT_OCR_STATUS_POLL_INTERVAL_MS = 500;")) {
        throw "Old 500 ms OCR interval remains."
    }

    Write-Host "[4/4] Frontend build"
    Push-Location (Join-Path $repoRoot "admin\frontend")
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "Admin frontend build failed." }
    }
    finally { Pop-Location }

    Write-Host ""
    Write-Host "[PASS] OCR refresh hardening applied."
}
catch {
    Copy-Item $backup $file -Force
    Write-Host ""
    Write-Host "[FAILED] $($_.Exception.Message)"
    Write-Host "[RESTORED] Original DocumentVerification.jsx restored."
    throw
}
