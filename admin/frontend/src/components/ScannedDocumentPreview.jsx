import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { X } from 'lucide-react';
import API_BASE_URL from '@/api';

export default function ScannedDocumentPreview({ candidate, request, documentKey }) {
  const { id } = useParams();
  const [preview, setPreview] = useState(null);
  const [retry, setRetry] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [previewDragging, setPreviewDragging] = useState(false);
  const dragStateRef = useRef({ pointerId: null, startX: 0, startY: 0, panX: 0, panY: 0 });

  // A newer request must supersede an older candidate, including failed scans.
  const scan = request?.request_id ? request : candidate;
  const requestId = scan?.request_id;
  const identity = `${id}/${documentKey}/${requestId}/${retry}`;
  const supported = ['student_grade_forms', 'certificate_of_indigency'].includes(documentKey)
    && scan?.document_key === documentKey && scan?.ocr_version === 'v2'
    && ['review_required', 'completed', 'failed'].includes(scan?.status) && requestId;

  const resetPreviewTransform = () => {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
    setPreviewDragging(false);
    dragStateRef.current = { pointerId: null, startX: 0, startY: 0, panX: 0, panY: 0 };
  };

  const closePreview = () => {
    setPreviewOpen(false);
    resetPreviewTransform();
  };

  useEffect(() => {
    if (!previewOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closePreview();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewOpen]);

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
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'The captured image is unavailable. Request a rescan.');
      }
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

  return <>
    <div className="relative h-full min-h-[520px] min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_10px_30px_-24px_rgba(28,25,23,0.55)]">
      {scan.status === 'failed' && <div role="alert" className="absolute inset-x-3 top-3 z-10 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-800 shadow-sm">
        {scan.error_message || 'Enhanced OCR failed. Review the captured image and retry the scan.'}
      </div>}
      {current?.error ? <div role="alert" className="flex h-full min-h-[520px] items-center justify-center p-5 text-center text-sm text-stone-600">
        <div>
          <p>{current.error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 rounded-lg border border-stone-300 bg-white px-3 py-2 font-medium hover:bg-stone-50">Reload image</button>
        </div>
      </div> : current?.url ? <button
        type="button"
        onClick={() => { resetPreviewTransform(); setPreviewOpen(true); }}
        className="group relative block h-full min-h-[520px] w-full cursor-zoom-in overflow-hidden rounded-2xl bg-[var(--portal-surface)] p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-base)] focus-visible:ring-offset-2"
        style={{ minHeight: '520px', height: '100%' }}
        aria-label={`Open captured ${label} preview`}
      >
        <img
          src={current.url}
          alt={`Scanned ${label} for OCR review`}
          className="absolute inset-0 block transition-transform duration-200 group-hover:scale-[1.015]"
          style={{ width: '100%', height: '100%', minWidth: '100%', minHeight: '100%', maxWidth: 'none', objectFit: 'cover', objectPosition: 'center center' }}
          onError={() => setPreview({ identity, error: 'The captured image could not be displayed.' })}
        />
      </button> : <div className="flex h-full min-h-[520px] items-center justify-center text-sm text-stone-500" role="status">Loading captured image…</div>}
    </div>

    {previewOpen && current?.url ? <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 backdrop-blur-[2px] sm:p-6"
      style={{ background: 'color-mix(in srgb, var(--portal-base) 28%, rgba(15, 23, 42, 0.72))' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Captured ${label} preview`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}
    >
      <div
        className="relative h-full max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-2xl border bg-white/95 shadow-2xl"
        style={{ borderColor: 'color-mix(in srgb, var(--portal-base) 34%, white)', boxShadow: '0 30px 80px -30px color-mix(in srgb, var(--portal-base) 45%, transparent)' }}
        onWheel={(event) => {
          event.preventDefault();
          const direction = event.deltaY < 0 ? 1 : -1;
          setPreviewZoom((currentZoom) => {
            const next = Math.min(4, Math.max(1, Number((currentZoom + direction * 0.2).toFixed(2))));
            if (next === 1) setPreviewPan({ x: 0, y: 0 });
            return next;
          });
        }}
      >
        <div
          className={`flex h-full w-full touch-none items-center justify-center overflow-hidden ${previewZoom > 1 ? (previewDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'}`}
          onPointerDown={(event) => {
            if (previewZoom <= 1) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragStateRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: previewPan.x, panY: previewPan.y };
            setPreviewDragging(true);
          }}
          onPointerMove={(event) => {
            const drag = dragStateRef.current;
            if (!previewDragging || drag.pointerId !== event.pointerId) return;
            setPreviewPan({ x: drag.panX + (event.clientX - drag.startX), y: drag.panY + (event.clientY - drag.startY) });
          }}
          onPointerUp={(event) => {
            if (dragStateRef.current.pointerId === event.pointerId) {
              try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
              dragStateRef.current.pointerId = null;
            }
            setPreviewDragging(false);
          }}
          onPointerCancel={() => { dragStateRef.current.pointerId = null; setPreviewDragging(false); }}
          onDoubleClick={() => { if (previewZoom > 1) resetPreviewTransform(); else setPreviewZoom(2); }}
        >
          <img
            src={current.url}
            alt={`Full preview of captured ${label}`}
            className="max-h-[88vh] max-w-[94%] select-none object-contain will-change-transform"
            style={{ transform: `translate3d(${previewPan.x}px, ${previewPan.y}px, 0) scale(${previewZoom})`, transformOrigin: 'center center', transition: previewDragging ? 'none' : 'transform 120ms ease-out' }}
            draggable={false}
          />
        </div>
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border bg-white/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur" style={{ borderColor: 'color-mix(in srgb, var(--portal-base) 20%, #e7e5e4)', color: 'var(--portal-base)' }} aria-hidden="true">
          {Math.round(previewZoom * 100)}% · Scroll to zoom{previewZoom > 1 ? ' · Drag to move' : ''}
        </div>
        <button type="button" onClick={closePreview} className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white/95 shadow-lg transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-base)]" style={{ borderColor: 'color-mix(in srgb, var(--portal-base) 24%, #e7e5e4)', color: 'var(--portal-base)' }} aria-label="Close captured document preview">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div> : null}
  </>;
}
