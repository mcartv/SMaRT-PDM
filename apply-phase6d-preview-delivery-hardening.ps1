$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$svc = Join-Path $root "admin\backend\services\applicationService.js"
$ctl = Join-Path $root "admin\backend\controllers\applicationController.js"
$rts = Join-Path $root "admin\backend\routes\applicationRoutes.js"
$ui  = Join-Path $root "admin\frontend\src\pages\DocumentVerification.jsx"
$files = @($svc,$ctl,$rts,$ui)
foreach($f in $files){ if(!(Test-Path $f)){ throw "Missing: $f" } }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
foreach($f in $files){ Copy-Item $f "$f.backup-$stamp" }
function Restore-All { foreach($f in $files){ Copy-Item "$f.backup-$stamp" $f -Force } }

try {
  Write-Host "[1/5] Backend service"
  $s = Get-Content $svc -Raw

  if($s -notmatch 'fetchApplicationDocumentViewUrl'){
    $anchor = "async function buildApplicationDetails(applicationId) {"
    if(!$s.Contains($anchor)){ throw "buildApplicationDetails anchor missing" }
    $fn = @'
exports.fetchApplicationDocumentViewUrl = async ({ applicationId, documentKey, source = 'preview' } = {}) => {
    if (!applicationId) throw buildHttpError(400, 'Application ID is required.');
    const key = normalizeDocumentType(documentKey);
    if (!key || key === 'application_form') {
        throw buildHttpError(400, 'A stored application document is required.');
    }

    const { data: rows, error } = await supabase
        .from('application_documents')
        .select('document_id, application_id, document_type, file_name, file_path, preview_path, is_submitted')
        .eq('application_id', applicationId);
    if (error) throw buildHttpError(500, error.message);

    const document = (rows || []).find((row) => getDocumentKey(row) === key);
    if (!document || document.is_submitted !== true || !document.file_path) {
        throw buildHttpError(404, 'Uploaded document not found.');
    }

    const wantsOriginal = String(source || '').trim().toLowerCase() === 'original';
    const previewPath = document.preview_path || null;
    const path = wantsOriginal ? document.file_path : (previewPath || document.file_path);
    const selectedSource = wantsOriginal || !previewPath ? 'original' : 'preview';
    const url = await getSignedFileUrl(path);
    if (!url) throw buildHttpError(502, `Failed to create ${selectedSource} document URL.`);

    return {
        document_id: document.document_id,
        document_key: key,
        file_name: document.file_name || null,
        source: selectedSource,
        url,
        fallback_available: selectedSource === 'preview' && Boolean(document.file_path),
    };
};

async function buildApplicationDetails(applicationId) {
'@
    $s = $s.Replace($anchor,$fn)
  }

  $old = @'
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
'@
  $new = @'
                    // Phase 6D: sign only when this document is actually opened.
                    const originalSignedUrl = null;
                    const previewSignedUrl = null;
                    const signedUrl = null;
'@
  if($s.Contains($old)){ $s = $s.Replace($old,$new) }
  elseif($s -notmatch 'Phase 6D: sign only'){ throw "Bulk signing block missing" }

  $urlOld = @'
                        url:
                            signedUrl ||
                            document.file_url ||
                            null,

                        file_url:
                            signedUrl ||
                            document.file_url ||
                            null,
'@
  $urlNew = @'
                        url:
                            null,

                        file_url:
                            null,
'@
  if($s.Contains($urlOld)){ $s = $s.Replace($urlOld,$urlNew) }

  $exp = "    fetchApplicationDocumentsById: exports.fetchApplicationDocumentsById,"
  if($s.Contains($exp) -and $s -notmatch 'fetchApplicationDocumentViewUrl: exports.fetchApplicationDocumentViewUrl'){
    $s = $s.Replace($exp,"$exp`r`n    fetchApplicationDocumentViewUrl: exports.fetchApplicationDocumentViewUrl,")
  }
  Set-Content $svc $s -Encoding UTF8 -NoNewline

  Write-Host "[2/5] Controller + route"
  $c = Get-Content $ctl -Raw
  if($c -notmatch 'getApplicationDocumentViewUrl'){
    $a = "exports.getApplicationDetails = async (req, res) => {"
    if(!$c.Contains($a)){ throw "Controller anchor missing" }
    $x = @'
exports.getApplicationDocumentViewUrl = async (req, res) => {
    try {
        const data = await applicationService.fetchApplicationDocumentViewUrl({
            applicationId: req.params.id,
            documentKey: req.params.documentKey,
            source: req.query?.source || 'preview',
        });
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        return res.status(200).json({ data });
    } catch (err) {
        console.error('APPLICATION DOCUMENT VIEW URL CONTROLLER ERROR:', err.message);
        return res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to create document view URL.',
        });
    }
};

exports.getApplicationDetails = async (req, res) => {
'@
    $c = $c.Replace($a,$x)
  }
  Set-Content $ctl $c -Encoding UTF8 -NoNewline

  $r = Get-Content $rts -Raw
  $ra = "router.get('/:id/documents', ...adminOnly, applicationController.getApplicationDocuments);"
  $rn = "router.get('/:id/documents/:documentKey/view-url', ...adminOnly, applicationController.getApplicationDocumentViewUrl);"
  if($r.Contains($ra) -and !$r.Contains($rn)){ $r = $r.Replace($ra,"$ra`r`n$rn") }
  Set-Content $rts $r -Encoding UTF8 -NoNewline

  Write-Host "[3/5] Frontend document loader"
  $u = Get-Content $ui -Raw
  $cand = "      file_path: rawDoc.file_path || '',`r`n      is_submitted: rawDoc.is_submitted === true || hasUploadedFile,"
  $cand2 = "      file_path: rawDoc.file_path || '',`r`n      preview_path: rawDoc.preview_path || '',`r`n      is_submitted: rawDoc.is_submitted === true || hasUploadedFile,"
  if($u.Contains($cand) -and $u -notmatch 'preview_path: rawDoc.preview_path'){ $u = $u.Replace($cand,$cand2) }

  $start = $u.IndexOf('function DocumentPreviewPanel({ activeDoc, application }) {')
  $endMarker = "const GRADE_REVIEW_FIELDS ="
  $end = $u.IndexOf($endMarker,$start)
  if($start -lt 0 -or $end -lt 0){ throw "DocumentPreviewPanel block missing" }

  $panel = @'
function DocumentPreviewPanel({ activeDoc, application }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewMimeType, setPreviewMimeType] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [usingOriginalFallback, setUsingOriginalFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    const controller = new AbortController();

    const getSignedUrl = async (source) => {
      const applicationId = application?.application_id || application?.id;
      const response = await fetch(
        `${API_BASE}/api/applications/${applicationId}/documents/${encodeURIComponent(activeDoc.id)}/view-url?source=${source}&_=${Date.now()}`,
        {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
          cache: 'no-store',
          signal: controller.signal,
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not prepare document preview.');
      if (!payload?.data?.url) throw new Error('Document preview URL was not returned.');
      return payload.data;
    };

    const getBytes = async (url) => {
      const response = await fetch(url, {
        method: 'GET', cache: 'force-cache', redirect: 'follow', signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Preview failed with status ${response.status}.`);
      }
      return response;
    };

    const loadPreview = async () => {
      setPreviewError('');
      setPreviewUrl('');
      setPreviewMimeType('');
      setUsingOriginalFallback(false);
      if (activeDoc?.id === 'application_form') return;
      if (!activeDoc?.file_path && !activeDoc?.is_submitted) return;

      try {
        setPreviewLoading(true);
        let signed = await getSignedUrl('preview');
        let response;
        try {
          response = await getBytes(signed.url);
        } catch (previewError) {
          if (signed.source !== 'preview' || !signed.fallback_available) throw previewError;
          signed = await getSignedUrl('original');
          response = await getBytes(signed.url);
          if (!cancelled) setUsingOriginalFallback(true);
        }

        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength) throw new Error('The uploaded document is empty.');
        const mimeType = inferPreviewMimeType(activeDoc, response.headers.get('content-type') || '');
        if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
          throw new Error('This file type cannot be previewed.');
        }
        const blob = new Blob([bytes], { type: mimeType });
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setPreviewMimeType(mimeType);
          setPreviewUrl(objectUrl);
        }
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          setPreviewError(error?.message || 'The document preview could not be loaded.');
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeDoc?.id, activeDoc?.file_path, activeDoc?.preview_path, activeDoc?.is_submitted, application?.application_id, application?.id]);

  const isImage = previewMimeType.startsWith('image/');
  const isPdf = previewMimeType === 'application/pdf';

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FileText className="h-4 w-4" /></div>
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold text-stone-900">{activeDoc?.name || 'Document'}</h4>
            <p className="truncate text-[15px] text-stone-500">{activeDoc?.id === 'application_form' ? 'Submitted application data' : activeDoc?.file_name || 'Secure preview'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {usingOriginalFallback ? <Badge className="border-amber-200 bg-amber-50 text-amber-700">Original fallback</Badge> : null}
          <Badge className={activeDoc?.file_path || activeDoc?.id === 'application_form' ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-100 text-stone-500'}>
            {activeDoc?.file_path || activeDoc?.id === 'application_form' ? 'Available' : 'Missing'}
          </Badge>
        </div>
      </header>
      <div className="flex min-h-[560px] items-center justify-center bg-[#f8fafc] p-3 sm:p-4">
        {activeDoc?.id === 'application_form' ? <ApplicationFormPreview application={application} />
          : previewLoading ? <div className="flex flex-col items-center gap-3 text-stone-500"><Loader2 className="h-7 w-7 animate-spin text-blue-700" /><p className="text-[15px]">Loading secure preview</p></div>
          : previewError ? <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"><AlertTriangle className="mx-auto h-7 w-7 text-amber-600" /><p className="mt-3 text-[15px] font-semibold text-amber-900">Preview unavailable</p><p className="mt-1 break-words text-[15px] leading-relaxed text-amber-700">{previewError}</p></div>
          : previewUrl && isImage ? <div className="flex h-[560px] w-full items-center justify-center overflow-auto rounded-xl border border-stone-200 bg-white p-3"><img src={previewUrl} alt={activeDoc?.name || 'Uploaded document'} className="max-h-full max-w-full select-none object-contain" draggable={false} onError={() => setPreviewError('The image could not be decoded.')} /></div>
          : previewUrl && isPdf ? <iframe src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1`} title={activeDoc?.name || 'PDF preview'} className="h-[560px] w-full rounded-xl border border-stone-200 bg-white" />
          : <div className="w-full max-w-sm rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center"><FileText className="mx-auto h-6 w-6 text-stone-500" /><h4 className="mt-4 text-base font-semibold text-stone-800">No document uploaded</h4></div>}
      </div>
    </section>
  );
}

'@
  $u = $u.Substring(0,$start) + $panel + $u.Substring($end)
  Set-Content $ui $u -Encoding UTF8 -NoNewline

  Write-Host "[4/5] Syntax/build checks"
  node --check $svc; if($LASTEXITCODE -ne 0){ throw "service syntax failed" }
  node --check $ctl; if($LASTEXITCODE -ne 0){ throw "controller syntax failed" }
  node --check $rts; if($LASTEXITCODE -ne 0){ throw "routes syntax failed" }
  Push-Location (Join-Path $root "admin\frontend")
  try { npm run build; if($LASTEXITCODE -ne 0){ throw "frontend build failed" } } finally { Pop-Location }

  Write-Host "[5/5] Done"
  Write-Host "[PASS] Phase 6D preview delivery hardening applied."
  Write-Host "Redeploy/restart the admin backend (5001) and admin frontend."
}
catch {
  Write-Host "[FAILED] $($_.Exception.Message)"
  Restore-All
  Write-Host "[RESTORED] Original files restored."
  throw
}
