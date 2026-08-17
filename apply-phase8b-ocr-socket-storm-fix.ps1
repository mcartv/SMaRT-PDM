$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$file = Join-Path $repoRoot "admin\frontend\src\pages\DocumentVerification.jsx"

if (-not (Test-Path $file)) {
    throw "Required file not found: $file"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$file.backup-$stamp"
Copy-Item $file $backup -Force

try {
    $src = Get-Content $file -Raw

    $old = @'
  useSocketEvent(
    'application-ocr:status',
    (data = {}) => {
      if (String(data.application_id || '') !== String(id || '')) return;
      const documentId = data.document_key;
      if (!documentId || !data.request_id) return;
      setIotOcrResults((current) => {
        const existing = current[documentId] || {};
        const existingRequest = existing.iot_ocr_request || existing.ocr_job || {};
        if (existingRequest.request_id && existingRequest.request_id !== data.request_id) {
          const activeRequestId = activeIotRequestRef.current?.requestId;
          const existingTime = new Date(existingRequest.updated_at || existingRequest.created_at || 0).getTime();
          const incomingTime = new Date(data.updated_at || data.emitted_at || 0).getTime();
          if (activeRequestId !== data.request_id && incomingTime <= existingTime) {
            return current;
          }
        }
        const request = { ...existingRequest, ...data };
        return {
          ...current,
          [documentId]: {
            ...existing,
            iot_ocr_request: request,
            ocr_job: request,
          },
        };
      });
      fetchApplicationDocuments({ soft: true });
    },
    [id, fetchApplicationDocuments]
  );
'@

    $new = @'
  useSocketEvent(
    'application-ocr:status',
    (data = {}) => {
      if (String(data.application_id || '') !== String(id || '')) return;

      const documentId = data.document_key;
      if (!documentId || !data.request_id) return;

      // OCR status events can arrive several times per second while the Pi moves
      // through pending/claimed/previewing/focusing/capturing/processing.
      // Keep these updates local. Re-fetching the entire application bundle here
      // caused the PostgREST storm seen in Supabase logs.
      setIotOcrResults((current) => {
        const existing = current[documentId] || {};
        const existingRequest = existing.iot_ocr_request || existing.ocr_job || {};

        if (
          existingRequest.request_id &&
          existingRequest.request_id !== data.request_id
        ) {
          const activeRequestId = activeIotRequestRef.current?.requestId;
          const existingTime = new Date(
            existingRequest.updated_at || existingRequest.created_at || 0
          ).getTime();
          const incomingTime = new Date(
            data.updated_at || data.emitted_at || 0
          ).getTime();

          if (
            activeRequestId !== data.request_id &&
            incomingTime <= existingTime
          ) {
            return current;
          }
        }

        const request = { ...existingRequest, ...data };

        return {
          ...current,
          [documentId]: {
            ...existing,
            iot_ocr_request: request,
            ocr_job: request,
          },
        };
      });

      // No fetchApplicationDocuments() here.
      // - active OCR state is already carried by the socket payload above
      // - the small /iot-ocr and /ocr-snapshot fallbacks hydrate candidate data
      // - snapshot-saved / terminal paths perform the one allowed full refresh
    },
    [id]
  );
'@

    if (-not $src.Contains($old)) {
        throw "Could not locate the current application-ocr:status handler. No files changed."
    }

    $src = $src.Replace($old, $new)
    Set-Content $file $src -Encoding UTF8 -NoNewline

    Write-Host "[1/3] OCR status handler patched"

    $verify = Get-Content $file -Raw

    if ($verify.Contains("fetchApplicationDocuments({ soft: true });`r`n    },`r`n    [id, fetchApplicationDocuments]")) {
        throw "Old OCR socket full-refresh call still appears to be present."
    }

    Write-Host "[2/3] Frontend build"

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

    Write-Host "[3/3] Complete"
    Write-Host ""
    Write-Host "[PASS] OCR socket refresh storm fix applied."
    Write-Host ""
    Write-Host "Redeploy the admin frontend, then run one OCR scan."
}
catch {
    Copy-Item $backup $file -Force
    Write-Host ""
    Write-Host "[FAILED] $($_.Exception.Message)"
    Write-Host "[RESTORED] Original DocumentVerification.jsx restored."
    throw
}
