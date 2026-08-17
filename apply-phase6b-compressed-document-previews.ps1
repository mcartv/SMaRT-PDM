$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$mobileService = Join-Path $repoRoot "backend\src\services\applicationService.js"
$adminService = Join-Path $repoRoot "admin\backend\services\applicationService.js"
$backendPackage = Join-Path $repoRoot "backend\package.json"
$backendLock = Join-Path $repoRoot "backend\package-lock.json"
$newPreviewService = Join-Path $repoRoot "backend\src\services\documentPreviewService.js"
$newBackfillScript = Join-Path $repoRoot "backend\scripts\backfillDocumentPreviews.js"

foreach ($path in @($mobileService, $adminService, $backendPackage)) {
    if (-not (Test-Path $path)) {
        throw "Required file not found: $path"
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPaths = @($mobileService, $adminService, $backendPackage)
if (Test-Path $backendLock) { $backupPaths += $backendLock }

foreach ($path in $backupPaths) {
    Copy-Item $path "$path.backup-$stamp"
}

function Restore-All {
    foreach ($path in $backupPaths) {
        $backup = "$path.backup-$stamp"
        if (Test-Path $backup) {
            Copy-Item $backup $path -Force
        }
    }
}

try {
    Write-Host "[1/7] Installing sharp in backend..."
    Push-Location (Join-Path $repoRoot "backend")
    try {
        & npm install sharp --save
        if ($LASTEXITCODE -ne 0) { throw "npm install sharp failed." }
    }
    finally {
        Pop-Location
    }

    Write-Host "[2/7] Patching mobile/student applicationService.js..."
    $src = Get-Content $mobileService -Raw

    if ($src -notmatch "documentPreviewService") {
        $importAnchor = "const notificationService = require('./notificationService');"
        if (-not $src.Contains($importAnchor)) {
            throw "Could not locate notificationService import."
        }

        $importBlock = @"
$importAnchor
const {
    createDocumentPreview,
    removeDocumentPreview,
} = require('./documentPreviewService');
"@
        $src = $src.Replace($importAnchor, $importBlock.TrimEnd())
    }

    # Prefer compressed preview for normal UI display while retaining original_url.
    $oldAttachPattern = "(?s)async function attachSignedUrlsToDocuments\(documents = \[\]\) \{.*?\r?\n\}"
    if ($src -notmatch "previewSignedUrl") {
        if (-not [regex]::IsMatch($src, $oldAttachPattern)) {
            throw "Could not locate attachSignedUrlsToDocuments()."
        }

        $newAttach = @'
async function attachSignedUrlsToDocuments(documents = []) {
    return Promise.all(
        (documents || []).map(async (document) => {
            const originalSignedUrl = document.is_submitted === true
                ? await createApplicationDocumentSignedUrl(document.file_path)
                : null;

            const previewSignedUrl =
                document.is_submitted === true && safeText(document.preview_path)
                    ? await createApplicationDocumentSignedUrl(document.preview_path)
                    : null;

            const displayUrl = previewSignedUrl || originalSignedUrl;

            return {
                ...document,
                file_url: displayUrl,
                signed_url: displayUrl,
                view_url: displayUrl,
                preview_url: previewSignedUrl,
                original_url: originalSignedUrl,
            };
        })
    );
}
'@
        $src = [regex]::Replace(
            $src,
            $oldAttachPattern,
            [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $newAttach },
            1
        )
    }

    $selectOld = ".select('document_id, application_id, document_type, file_path')"
    $selectNew = ".select('document_id, application_id, document_type, file_path, preview_path')"
    if ($src.Contains($selectOld)) {
        $src = $src.Replace($selectOld, $selectNew)
    } elseif (-not $src.Contains($selectNew)) {
        throw "Could not locate target document select."
    }

    # Generate preview immediately after original upload.
    $uploadAnchor = @'
    if (uploadError) throw uploadError;

    const fileUrl = null;
'@
    if ($src.Contains($uploadAnchor) -and $src -notmatch "const generatedPreview =") {
        $uploadReplacement = @'
    if (uploadError) throw uploadError;

    const generatedPreview = await createDocumentPreview({
        bucket: APPLICATION_DOCUMENT_BUCKET,
        filePath,
        inputBuffer: file.buffer,
        mimeType: file.mimetype,
    });

    const fileUrl = null;
'@
        $src = $src.Replace($uploadAnchor, $uploadReplacement)
    }

    # Cleanup preview if the finalize RPC fails.
    $cleanupAnchor = @'
        if (cleanupError) {
            console.error('FAILED UPLOAD CLEANUP ERROR:', cleanupError);
        }

        throw finalizeError;
'@
    if ($src.Contains($cleanupAnchor) -and $src -notmatch "FAILED PREVIEW CLEANUP") {
        $cleanupReplacement = @'
        if (cleanupError) {
            console.error('FAILED UPLOAD CLEANUP ERROR:', cleanupError);
        }

        if (generatedPreview?.path) {
            await removeDocumentPreview({
                bucket: APPLICATION_DOCUMENT_BUCKET,
                previewPath: generatedPreview.path,
            });
        }

        throw finalizeError;
'@
        $src = $src.Replace($cleanupAnchor, $cleanupReplacement)
    }

    # Persist preview metadata after successful finalize. Preview failure must
    # never make the original document upload fail.
    $finalizedAnchor = @'
    if (!finalizedUpload) {
        await supabase.storage.from(APPLICATION_DOCUMENT_BUCKET).remove([filePath]);
        throw createHttpError(500, 'The uploaded document could not be finalized.');
    }

    if (targetDocument.file_path && targetDocument.file_path !== filePath) {
'@
    if ($src.Contains($finalizedAnchor) -and $src -notmatch "previewMetadataError") {
        $finalizedReplacement = @'
    if (!finalizedUpload) {
        await supabase.storage.from(APPLICATION_DOCUMENT_BUCKET).remove([filePath]);

        if (generatedPreview?.path) {
            await removeDocumentPreview({
                bucket: APPLICATION_DOCUMENT_BUCKET,
                previewPath: generatedPreview.path,
            });
        }

        throw createHttpError(500, 'The uploaded document could not be finalized.');
    }

    if (generatedPreview?.path) {
        const { error: previewMetadataError } = await supabase
            .from('application_documents')
            .update({
                preview_path: generatedPreview.path,
                preview_size_bytes: generatedPreview.sizeBytes,
                preview_created_at: generatedPreview.createdAt,
            })
            .eq('document_id', documentId);

        if (previewMetadataError) {
            console.warn('DOCUMENT PREVIEW METADATA WARNING:', previewMetadataError);
        }
    } else {
        const { error: previewMetadataClearError } = await supabase
            .from('application_documents')
            .update({
                preview_path: null,
                preview_size_bytes: null,
                preview_created_at: null,
            })
            .eq('document_id', documentId);

        if (previewMetadataClearError) {
            console.warn('DOCUMENT PREVIEW METADATA CLEAR WARNING:', previewMetadataClearError);
        }
    }

    if (targetDocument.file_path && targetDocument.file_path !== filePath) {
'@
        $src = $src.Replace($finalizedAnchor, $finalizedReplacement)
    }

    # Remove old preview when a document is replaced.
    $oldDeleteAnchor = @'
        if (oldFileDeleteError) {
            console.warn('OLD DOCUMENT FILE CLEANUP ERROR:', oldFileDeleteError);
        }
    }

    const { data: submittedDocuments, error: submittedDocumentsError } = await supabase
'@
    if ($src.Contains($oldDeleteAnchor) -and $src -notmatch "OLD DOCUMENT PREVIEW CLEANUP") {
        $oldDeleteReplacement = @'
        if (oldFileDeleteError) {
            console.warn('OLD DOCUMENT FILE CLEANUP ERROR:', oldFileDeleteError);
        }

        if (targetDocument.preview_path) {
            await removeDocumentPreview({
                bucket: APPLICATION_DOCUMENT_BUCKET,
                previewPath: targetDocument.preview_path,
            });
        }
    }

    const { data: submittedDocuments, error: submittedDocumentsError } = await supabase
'@
        $src = $src.Replace($oldDeleteAnchor, $oldDeleteReplacement)
    }

    Set-Content $mobileService $src -Encoding UTF8 -NoNewline

    Write-Host "[3/7] Patching admin applicationService.js..."
    $admin = Get-Content $adminService -Raw

    $adminOld = @'
                    const signedUrl =
                        filePath
                            ? await getSignedFileUrl(
                                filePath
                            )
                            : null;

                    return {
'@
    if ($admin.Contains($adminOld) -and $admin -notmatch "previewSignedUrl =") {
        $adminNew = @'
                    const originalSignedUrl =
                        filePath
                            ? await getSignedFileUrl(
                                filePath
                            )
                            : null;

                    const previewSignedUrl =
                        document.preview_path
                            ? await getSignedFileUrl(
                                document.preview_path
                            )
                            : null;

                    const signedUrl =
                        previewSignedUrl ||
                        originalSignedUrl;

                    return {
'@
        $admin = $admin.Replace($adminOld, $adminNew)

        $adminUrlAnchor = @'
                        signed_url:
                            signedUrl ||
                            null,

                        status:
'@
        $adminUrlReplacement = @'
                        signed_url:
                            signedUrl ||
                            null,

                        preview_path:
                            document.preview_path ||
                            null,

                        preview_url:
                            previewSignedUrl ||
                            null,

                        original_url:
                            originalSignedUrl ||
                            null,

                        status:
'@
        if (-not $admin.Contains($adminUrlAnchor)) {
            throw "Could not locate admin signed_url response block."
        }
        $admin = $admin.Replace($adminUrlAnchor, $adminUrlReplacement)
    }

    Set-Content $adminService $admin -Encoding UTF8 -NoNewline

    Write-Host "[4/7] Syntax checks..."
    & node --check $mobileService
    if ($LASTEXITCODE -ne 0) { throw "mobile applicationService syntax check failed." }

    & node --check $adminService
    if ($LASTEXITCODE -ne 0) { throw "admin applicationService syntax check failed." }

    & node --check $newPreviewService
    if ($LASTEXITCODE -ne 0) { throw "documentPreviewService syntax check failed." }

    & node --check $newBackfillScript
    if ($LASTEXITCODE -ne 0) { throw "backfillDocumentPreviews syntax check failed." }

    Write-Host "[5/7] Verifying sharp can load..."
    Push-Location (Join-Path $repoRoot "backend")
    try {
        & node -e "require('sharp'); console.log('sharp ok')"
        if ($LASTEXITCODE -ne 0) { throw "sharp runtime load failed." }
    }
    finally {
        Pop-Location
    }

    Write-Host "[6/7] Verifying patch markers..."
    $verifyMobile = Get-Content $mobileService -Raw
    $verifyAdmin = Get-Content $adminService -Raw

    foreach ($marker in @(
        "createDocumentPreview",
        "previewMetadataError",
        "preview_url",
        "original_url"
    )) {
        if (-not $verifyMobile.Contains($marker)) {
            throw "Missing mobile preview marker: $marker"
        }
    }

    foreach ($marker in @(
        "previewSignedUrl",
        "preview_path",
        "original_url"
    )) {
        if (-not $verifyAdmin.Contains($marker)) {
            throw "Missing admin preview marker: $marker"
        }
    }

    Write-Host "[7/7] Complete."
    Write-Host ""
    Write-Host "[PASS] Compressed document preview pipeline applied."
    Write-Host ""
    Write-Host "Next:"
    Write-Host "1. Restart/redeploy port 5000 backend."
    Write-Host "2. Restart/redeploy port 5001 admin backend."
    Write-Host "3. Upload a PNG/JPG and confirm preview_path is populated."
    Write-Host "4. Run the one-time backfill only after the new upload test passes:"
    Write-Host "   cd backend"
    Write-Host "   node scripts\backfillDocumentPreviews.js"
}
catch {
    Write-Host ""
    Write-Host "[FAILED] $($_.Exception.Message)"
    Write-Host "Restoring modified existing files..."
    Restore-All
    Write-Host "[RESTORED] Existing files restored."
    throw
}
