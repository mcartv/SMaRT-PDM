import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import API_BASE_URL from '@/api';

export default function ScannedDocumentPreview({ candidate, documentKey }) {
  const { id } = useParams();
  const [preview, setPreview] = useState(null);
  const [retry, setRetry] = useState(0);
  const requestId = candidate?.request_id;
  const identity = `${id}/${documentKey}/${requestId}/${retry}`;
  const supported = ['student_grade_forms', 'certificate_of_indigency'].includes(documentKey)
    && candidate?.document_key === documentKey && candidate?.ocr_version === 'v2'
    && ['review_required', 'completed'].includes(candidate?.status) && requestId;

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    let objectUrl;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setPreview(null);
    fetch(`${API_BASE_URL}/api/applications/${id}/documents/${documentKey}/iot-ocr/${requestId}/captured-image`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
      cache: 'no-store', signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('The captured image is unavailable. It may have expired; request a rescan.');
      if (!/^image\/(jpeg|png)(;|$)/i.test(response.headers.get('content-type') || '')) {
        throw new Error('The captured image has an unsupported file type.');
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error('The captured image is empty.');
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setPreview({ identity, url: objectUrl });
    }).catch((error) => {
      if (!cancelled) setPreview({ identity, error: error.name === 'AbortError' ? 'Loading the captured image timed out.' : error.message });
    }).finally(() => window.clearTimeout(timeout));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, documentKey, requestId, identity, supported]);

  if (!supported) return null;
  const current = preview?.identity === identity ? preview : null;
  const label = documentKey === 'student_grade_forms' ? 'grade report' : 'certificate of indigency';
  return <section className="space-y-2" aria-label={`Captured ${label} preview`}>
    <p className="text-sm font-semibold text-stone-700">Captured document</p>
    <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-100 p-2">
      {current?.error ? <div role="alert" className="p-4 text-center text-sm text-stone-600">
        <p>{current.error}</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 rounded border border-stone-300 bg-white px-3 py-2 font-medium">Reload image</button>
      </div> : current?.url ? <img src={current.url} alt={`Scanned ${label} for OCR review`} className="max-h-[560px] w-full object-contain" onError={() => setPreview({ identity, error: 'The captured image could not be displayed.' })} />
        : <p role="status" className="text-sm text-stone-500">Loading captured image…</p>}
    </div>
  </section>;
}
