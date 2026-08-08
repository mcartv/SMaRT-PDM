import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import EndorsementProgressTracker from '@/components/endorsement/EndorsementProgressTracker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const QUEUE_META = {
  sdo: {
    title: 'For Endorsement',
    eyebrow: 'Student Discipline Office',
    subtitle: 'Review applicants awaiting disciplinary standing assessment.',
    endpoint: '/api/endorsement-slips/sdo',
    actionEndpoint: (slipId) => `/api/endorsement-slips/${slipId}/sdo-action`,
    allowedRoles: ['sdo'],
  },
  guidance: {
    title: 'For Endorsement',
    eyebrow: 'Guidance Office',
    subtitle: 'Review applicants awaiting moral standing assessment.',
    endpoint: '/api/endorsement-slips/guidance',
    actionEndpoint: (slipId) => `/api/endorsement-slips/${slipId}/guidance-action`,
    allowedRoles: ['guidance'],
  },
  pd: {
    title: 'For Endorsement',
    eyebrow: 'Program Director',
    subtitle: 'Review applicants awaiting scholastic standing assessment.',
    endpoint: '/api/endorsement-slips/pd',
    actionEndpoint: (slipId) => `/api/endorsement-slips/${slipId}/pd-action`,
    allowedRoles: ['pd'],
  },
};

const RESULT_FILTERS = {
  sdo: [
    ['all', 'All Results'],
    ['no_offense', 'No Disciplinary Offense'],
    ['minor_offense', 'With Minor Offense/s'],
    ['major_offense', 'With Major Offense/s'],
  ],
  guidance: [
    ['all', 'All Results'],
    ['good_moral_standing', 'Good Moral Standing'],
  ],
  pd: [
    ['all', 'All Results'],
    ['good_scholastic_standing', 'Good Scholastic Standing'],
    ['average_scholastic_standing', 'Average Scholastic Standing'],
  ],
};

const SORT_OPTIONS = [
  ['oldest', 'Oldest First'],
  ['newest', 'Newest First'],
  ['name_asc', 'Name A–Z'],
  ['name_desc', 'Name Z–A'],
];

function authHeaders(tokenStorageKey) {
  return {
    Authorization: `Bearer ${sessionStorage.getItem(tokenStorageKey)}`,
    'Content-Type': 'application/json',
  };
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function normalizeDecision(queueKey, value) {
  const raw = String(value || '').toLowerCase();
  if (!raw) return 'pending';
  if (queueKey === 'sdo') {
    if (['no_offense', 'cleared'].includes(raw)) return 'no_offense';
    if (['minor_offense', 'disqualified_minor'].includes(raw)) return 'minor_offense';
    if (['major_offense', 'disqualified_major'].includes(raw)) return 'major_offense';
  }
  if (queueKey === 'guidance' && ['good_moral_standing', 'cleared'].includes(raw)) return 'good_moral_standing';
  if (queueKey === 'pd' && ['good_scholastic_standing', 'average_scholastic_standing'].includes(raw)) return raw;
  return raw;
}

function getDecision(queueKey, row) {
  if (queueKey === 'sdo') return normalizeDecision(queueKey, row.sdo_decision);
  if (queueKey === 'guidance') return normalizeDecision(queueKey, row.guidance_decision);
  return normalizeDecision(queueKey, row.pd_decision);
}

function decisionLabel(queueKey, row) {
  if (queueKey === 'sdo') return row.office_results?.sdo || 'Awaiting Review';
  if (queueKey === 'guidance') return row.office_results?.guidance || 'Awaiting Review';
  return row.office_results?.pd || 'Awaiting Review';
}

function decisionTone(value) {
  if (['no_offense', 'good_moral_standing', 'good_scholastic_standing'].includes(value)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['minor_offense', 'average_scholastic_standing', 'pending'].includes(value)) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (value === 'major_offense') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-stone-200 bg-stone-50 text-stone-700';
}

function hasUploadedGrade(row) {
  return row?.grade_document?.is_uploaded === true;
}

function ProfileAvatar({ row, size = 'md', onPreview }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : row?.avatar_url;
  const sizeClass = size === 'lg' ? 'h-14 w-14' : 'h-11 w-11';
  const iconClass = size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';

  if (!src) {
    return (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-stone-400`}
        aria-label="No profile photo"
        title="No profile photo"
      >
        <UserRound className={iconClass} aria-hidden="true" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPreview?.(src, row?.student_name)}
      className={`${sizeClass} shrink-0 overflow-hidden rounded-full border border-stone-200 bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2`}
      aria-label={`Preview ${row?.student_name || 'student'} profile photo`}
      title="Preview profile photo"
    >
      <img
        src={src}
        alt={`${row?.student_name || 'Student'} profile`}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </button>
  );
}

function ProfilePreview({ preview, onClose }) {
  return (
    <Dialog open={Boolean(preview?.url)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b border-stone-200 px-5 py-4">
          <DialogTitle>{preview?.name || 'Student'} profile photo</DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged preview of the student profile photo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-72 items-center justify-center bg-stone-950 p-4">
          {preview?.url ? (
            <img
              src={preview.url}
              alt={`${preview.name || 'Student'} profile preview`}
              className="max-h-[70vh] max-w-full rounded-xl object-contain"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}


const clampPreviewZoom = (value) => Math.min(4, Math.max(0.5, value));

function ZoomableGradeImage({ url }) {
  const [zoom, setZoom] = useState(1);
  const pinchRef = useRef(null);

  const changeZoom = (amount) => {
    setZoom((current) => clampPreviewZoom(Number((current + amount).toFixed(2))));
  };

  const getTouchDistance = (touches) => {
    const [first, second] = touches;
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  };

  const handleTouchStart = (event) => {
    if (event.touches.length !== 2) return;
    pinchRef.current = { distance: getTouchDistance(event.touches), zoom };
  };

  const handleTouchMove = (event) => {
    if (event.touches.length !== 2 || !pinchRef.current) return;
    event.preventDefault();
    const scale = getTouchDistance(event.touches) / pinchRef.current.distance;
    setZoom(clampPreviewZoom(pinchRef.current.zoom * scale));
  };

  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-stone-200 bg-white/95 p-1 shadow-sm backdrop-blur">
        <Button type="button" variant="ghost" size="icon" onClick={() => changeZoom(-0.25)} disabled={zoom <= 0.5} aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="min-w-14 text-center text-xs font-medium text-stone-700">{Math.round(zoom * 100)}%</span>
        <Button type="button" variant="ghost" size="icon" onClick={() => changeZoom(0.25)} disabled={zoom >= 4} aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setZoom(1)} aria-label="Reset zoom">
          <RotateCcw className="mr-1 h-4 w-4" /> Reset
        </Button>
      </div>
      <div
        className="flex h-full items-center justify-center overflow-auto p-6 pt-16"
        onWheel={(event) => {
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          changeZoom(event.deltaY < 0 ? 0.15 : -0.15);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => { pinchRef.current = null; }}
      >
        <img
          src={url}
          alt="Grade Report preview"
          draggable="false"
          className="max-h-full max-w-full rounded-lg object-contain shadow-sm transition-transform duration-150"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>
    </div>
  );
}

function GradeReportPreview({ preview, onClose }) {
  const url = String(preview?.url || '').trim();
  const fileName = String(preview?.fileName || '').toLowerCase();
  const isImage = /\.(png|jpe?g|webp|gif)(?:$|\?)/i.test(fileName || url);

  return (
    <Dialog open={Boolean(url)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[96vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[96vw]">
        <DialogHeader className="shrink-0 border-b border-stone-200 px-5 py-4">
          <DialogTitle>Grade Report Preview</DialogTitle>
          <DialogDescription className="sr-only">
            Preview the applicant Grade Report. Images support zoom controls and PDF files use the browser viewer.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-stone-100">
          {url ? (
            isImage ? (
              <ZoomableGradeImage key={url} url={url} />
            ) : (
              <iframe
                src={url}
                title="Grade Report preview"
                className="h-full w-full border-0 bg-white"
              />
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompactStageProgress({ tracker }) {
  if (!tracker?.steps?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Endorsement progress">
      {tracker.steps.map((step) => {
        const complete = step.state === 'completed';
        const active = step.state === 'active';
        const stopped = step.state === 'stopped';
        return (
          <span
            key={step.key}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${
              stopped
                ? 'border-red-200 bg-red-50 text-red-700'
                : complete
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : active
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-stone-200 bg-white text-stone-500'
            }`}
          >
            {stopped ? <XCircle className="h-3 w-3" /> : complete ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
            {step.label}
          </span>
        );
      })}
    </div>
  );
}

function SummaryStrip({ queueKey, rows }) {
  const pending = rows.filter((row) => getDecision(queueKey, row) === 'pending').length;
  const today = new Date().toDateString();
  const actedToday = rows.filter((row) => {
    const value = queueKey === 'sdo'
      ? row.sdo_at
      : queueKey === 'guidance'
        ? row.guidance_at
        : row.pd_at;
    return getDecision(queueKey, row) !== 'pending'
      && value
      && new Date(value).toDateString() === today;
  }).length;

  const cards = queueKey === 'sdo'
    ? [
        { label: 'For Endorsement', value: pending },
        { label: 'Minor Offenses', value: rows.filter((row) => getDecision('sdo', row) === 'minor_offense').length },
        { label: 'Major Offenses', value: rows.filter((row) => getDecision('sdo', row) === 'major_offense').length },
      ]
    : queueKey === 'guidance'
      ? [
          { label: 'For Endorsement', value: pending },
          { label: 'Endorsed Today', value: actedToday },
          { label: 'Completed Endorsements', value: rows.filter((row) => getDecision('guidance', row) !== 'pending').length },
        ]
      : [
          { label: 'For Endorsement', value: pending },
          { label: 'Good Scholastic Standing', value: rows.filter((row) => getDecision('pd', row) === 'good_scholastic_standing').length },
          { label: 'Average Scholastic Standing', value: rows.filter((row) => getDecision('pd', row) === 'average_scholastic_standing').length },
        ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((item) => (
        <div key={item.label} className="rounded-xl border border-stone-200 bg-white px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">{item.label}</p>
          <p className="mt-1 text-xl font-semibold text-stone-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}


function endorsementButtonClass(queueKey, value) {
  if (queueKey === 'sdo') {
    if (value === 'major_offense') {
      return 'w-full bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 disabled:text-white';
    }
    if (value === 'minor_offense') {
      return 'w-full bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-300 disabled:text-white';
    }
  }

  if (queueKey === 'pd' && value === 'average_scholastic_standing') {
    return 'w-full bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-300 disabled:text-white';
  }

  return 'w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300 disabled:text-white';
}

function confirmationButtonClass() {
  return 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600';
}

function legacySdoPayload(action, remarks) {
  const legacyAction = {
    no_offense: 'clear',
    minor_offense: 'disqualify_minor',
    major_offense: 'disqualify_major',
  }[action];

  if (!legacyAction) return null;

  return {
    action: legacyAction,
    remarks:
      remarks ||
      (action === 'minor_offense'
        ? 'With Minor Offense/s'
        : action === 'major_offense'
          ? 'With Major Offense/s'
          : ''),
    offense_type:
      action === 'minor_offense'
        ? 'Minor offense'
        : action === 'major_offense'
          ? 'Major offense'
          : '',
  };
}


function legacyGuidancePayload(action, remarks) {
  if (action !== 'good_moral_standing') return null;
  return {
    action: 'clear',
    remarks: remarks || 'Good Moral Standing',
  };
}


function legacyPdPayload(action, remarks) {
  if (!['good_scholastic_standing', 'average_scholastic_standing'].includes(action)) {
    return null;
  }

  const standingLabel =
    action === 'average_scholastic_standing'
      ? 'Average Scholastic Standing'
      : 'Good Scholastic Standing';

  return {
    action: 'approve',
    scholastic_standing: action,
    remarks: remarks || standingLabel,
  };
}

function ActionPanel({ queueKey, row, state, onChange, onSubmit, saving }) {
  if (queueKey === 'sdo') {
    const selected = state.sdoResult || '';
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Disciplinary Standing</p>
          <p className="mt-1 text-sm text-stone-600">Minor offense continues to Guidance. Major offense stops the endorsement.</p>
        </div>
        <Select value={selected} onValueChange={(value) => onChange({ sdoResult: value })}>
          <SelectTrigger className="bg-white"><SelectValue placeholder="Select disciplinary standing" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="no_offense">No Disciplinary Offense</SelectItem>
            <SelectItem value="minor_offense">With Minor Offense/s</SelectItem>
            <SelectItem value="major_offense">With Major Offense/s</SelectItem>
          </SelectContent>
        </Select>
        <Textarea value={state.remarks || ''} onChange={(event) => onChange({ remarks: event.target.value })} rows={3} placeholder="Optional remarks" />
        <Button disabled={saving || !selected} className={endorsementButtonClass(queueKey, selected)} onClick={() => onSubmit(selected)}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirm Endorsement
        </Button>
      </div>
    );
  }

  if (queueKey === 'guidance') {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Guidance Endorsement</p>
          <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Good Moral Standing</div>
        </div>
        <Textarea value={state.remarks || ''} onChange={(event) => onChange({ remarks: event.target.value })} rows={3} placeholder="Optional remarks" />
        <Button disabled={saving} className={endorsementButtonClass(queueKey, 'good_moral_standing')} onClick={() => onSubmit('good_moral_standing')}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirm Endorsement
        </Button>
      </div>
    );
  }

  const standing = state.pdResult || '';
  const gradeReady = hasUploadedGrade(row);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Scholastic Standing</p>
        <p className="mt-1 text-sm text-stone-600">Record the standing shown on the official endorsement slip.</p>
      </div>
      <Select value={standing} onValueChange={(value) => onChange({ pdResult: value })}>
        <SelectTrigger className="bg-white"><SelectValue placeholder="Select scholastic standing" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="good_scholastic_standing">Good Scholastic Standing</SelectItem>
          <SelectItem value="average_scholastic_standing">Average Scholastic Standing</SelectItem>
        </SelectContent>
      </Select>
      <Textarea value={state.remarks || ''} onChange={(event) => onChange({ remarks: event.target.value })} rows={3} placeholder="Optional remarks" />
      {!gradeReady ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">A Grade Report is required before PD endorsement.</p> : null}
      <Button disabled={saving || !gradeReady || !standing} className={endorsementButtonClass(queueKey, standing)} onClick={() => onSubmit(standing)}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirm Endorsement
      </Button>
    </div>
  );
}

function confirmationMeta(queueKey, action, studentName) {
  if (queueKey === 'sdo') {
    if (action === 'major_offense') return { tone: 'red', title: 'Confirm Major Offense', description: `Record With Major Offense/s for ${studentName}? This will stop the endorsement at SDO.` };
    if (action === 'minor_offense') return { tone: 'amber', title: 'Confirm Minor Offense', description: `Record With Minor Offense/s for ${studentName} and continue to Guidance?` };
    return { tone: 'green', title: 'Confirm SDO Endorsement', description: `Record No Disciplinary Offense for ${studentName} and continue to Guidance?` };
  }
  if (queueKey === 'guidance') return { tone: 'green', title: 'Confirm Good Moral Standing', description: `Confirm Good Moral Standing for ${studentName} and continue to the Program Director?` };
  return { tone: action === 'average_scholastic_standing' ? 'amber' : 'green', title: 'Confirm Scholastic Standing', description: `Record ${action === 'average_scholastic_standing' ? 'Average' : 'Good'} Scholastic Standing for ${studentName} and complete the endorsement?` };
}

function ReviewDrawer({ queueKey, row, state, onChange, onSubmit, saving, onClose, onViewFull, detailBasePath, onPreviewProfile, onPreviewGrade }) {
  if (!row) return null;
  const decision = getDecision(queueKey, row);
  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-stone-200 px-5 py-5 pr-12">
          <SheetTitle className="text-lg">Review Endorsement</SheetTitle>
          <SheetDescription>Review only the information required for your endorsement stage.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-5 pb-6">
          <section className="rounded-xl border border-stone-200 p-4">
            <div className="flex items-center gap-3">
              <ProfileAvatar key={row?.avatar_url || 'no-avatar'} row={row} size="lg" onPreview={onPreviewProfile} />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">Applicant</p>
                <h2 className="mt-1 truncate text-base font-semibold text-stone-900">{row.student_name}</h2>
                <p className="mt-0.5 text-sm text-stone-600">{row.pdm_id || 'No PDM ID'}</p>
                <p className="mt-0.5 text-sm font-medium text-stone-800">{row.course_code || 'Course N/A'}{row.year_level ? ` • Year ${row.year_level}` : ''}</p>
                <p className="mt-0.5 text-xs text-stone-500">{row.program_name || 'Scholarship N/A'}{row.opening_title ? ` • ${row.opening_title}` : ''}</p>
              </div>
            </div>
          </section>

          {queueKey !== 'sdo' ? (
            <section className="rounded-xl border border-stone-200 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">Previous Endorsements</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" /><div><p className="text-sm font-medium text-stone-900">Student Discipline Office</p><p className="text-xs text-stone-500">{row.office_results?.sdo || 'Pending'}</p></div></div>
                {queueKey === 'pd' ? <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" /><div><p className="text-sm font-medium text-stone-900">Guidance Office</p><p className="text-xs text-stone-500">{row.office_results?.guidance || 'Pending'}</p></div></div> : null}
              </div>
            </section>
          ) : null}

          {queueKey === 'pd' ? (
            <section className="rounded-xl border border-stone-200 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">Academic Information</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-stone-500">GWA</p><p className="font-semibold text-stone-900">{row.grade_summary?.gwa ?? 'N/A'}</p></div>
                <div><p className="text-xs text-stone-500">Academic Period</p><p className="font-semibold text-stone-900">{row.semester || 'N/A'} / {row.school_year || 'N/A'}</p></div>
              </div>
              {row.grade_document?.url ? (
                <div className="mt-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onPreviewGrade?.({
                        url: row.grade_document.url,
                        fileName: row.grade_document.file_name || 'grade-report',
                      })
                    }
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Grade Report
                  </Button>
                </div>
              ) : <p className="mt-3 text-xs text-amber-700">Grade Report not uploaded.</p>}
            </section>
          ) : null}

          <section className="rounded-xl border border-stone-200 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">Endorsement Progress</p>
            <div className="mt-3"><EndorsementProgressTracker tracker={row.tracker} compact /></div>
          </section>

          {decision === 'pending' ? (
            <section className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <ActionPanel queueKey={queueKey} row={row} state={state} onChange={onChange} onSubmit={onSubmit} saving={saving} />
            </section>
          ) : (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="h-4 w-4" /><p className="font-semibold">Endorsement recorded</p></div>
              <p className="mt-2 text-sm font-medium text-emerald-900">{decisionLabel(queueKey, row)}</p>
              <p className="mt-1 text-xs text-emerald-700">Recorded decisions are read-only after submission.</p>
            </section>
          )}

          <Button variant="outline" className="w-full" onClick={() => onViewFull(`${detailBasePath}/${row.slip_id}`)}>
            <FileText className="mr-2 h-4 w-4" />View Full Endorsement Slip
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function EndorsementQueue({
  queueKey,
  tokenStorageKey = 'adminToken',
  detailBasePath = '/admin/endorsements',
  profileStorageKey = 'adminProfile',
}) {
  const navigate = useNavigate();
  const meta = QUEUE_META[queueKey];
  const profile = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem(profileStorageKey) || '{}'); } catch { return {}; }
  }, [profileStorageKey]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSlipId, setSavingSlipId] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [programFilter, setProgramFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('oldest');
  const [actionState, setActionState] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [gradePreview, setGradePreview] = useState(null);

  const hasAccess = meta?.allowedRoles.includes(profile.role);

  const loadQueue = useCallback(async ({ soft = false } = {}) => {
    if (!hasAccess) return;
    try {
      soft ? setRefreshing(true) : setLoading(true);
      setError('');
      const response = await fetch(buildApiUrl(meta.endpoint), { headers: authHeaders(tokenStorageKey) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to load endorsement queue');
      const nextRows = Array.isArray(data) ? data : [];
      setRows(nextRows);
      setSelectedRow((current) => current ? nextRows.find((row) => row.slip_id === current.slip_id) || null : null);
    } catch (err) {
      setError(err.message || 'Failed to load endorsement queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hasAccess, meta, tokenStorageKey]);

  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => {
    if (!hasAccess) return undefined;
    const id = window.setInterval(() => loadQueue({ soft: true }), 8000);
    return () => window.clearInterval(id);
  }, [hasAccess, loadQueue]);
  useSocketEvent('endorsement:updated', () => loadQueue({ soft: true }), [loadQueue]);
  useSocketEvent('application-document:uploaded', () => loadQueue({ soft: true }), [loadQueue]);

  const programs = useMemo(() => ['all', ...new Set(rows.map((row) => row.program_name).filter(Boolean))], [rows]);
  const courses = useMemo(() => ['all', ...new Set(rows.map((row) => row.course_code).filter(Boolean))], [rows]);
  const years = useMemo(() => ['all', ...new Set(rows.map((row) => String(row.year_level || '')).filter(Boolean))], [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = rows.filter((row) => {
      const decision = getDecision(queueKey, row);
      const status = decision === 'pending' ? 'pending' : 'completed';
      const searchable = [row.student_name, row.pdm_id, row.course_code, row.year_level, row.program_name, row.opening_title].filter(Boolean).join(' ').toLowerCase();
      return (!query || searchable.includes(query))
        && (statusFilter === 'all' || status === statusFilter)
        && (programFilter === 'all' || row.program_name === programFilter)
        && (courseFilter === 'all' || row.course_code === courseFilter)
        && (yearFilter === 'all' || String(row.year_level || '') === yearFilter)
        && (resultFilter === 'all' || decision === resultFilter);
    });

    return result.sort((a, b) => {
      if (sortOrder === 'name_asc') return String(a.student_name || '').localeCompare(String(b.student_name || ''));
      if (sortOrder === 'name_desc') return String(b.student_name || '').localeCompare(String(a.student_name || ''));
      const aTime = new Date(a.submitted_at || 0).getTime();
      const bTime = new Date(b.submitted_at || 0).getTime();
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });
  }, [courseFilter, programFilter, queueKey, resultFilter, rows, search, sortOrder, statusFilter, yearFilter]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('pending');
    setProgramFilter('all');
    setCourseFilter('all');
    setYearFilter('all');
    setResultFilter('all');
    setSortOrder('oldest');
  };

  const updateActionState = (slipId, patch) => setActionState((current) => ({ ...current, [slipId]: { ...(current[slipId] || {}), ...patch } }));

  const executeAction = async () => {
    if (!confirmAction) return;
    const { row, action } = confirmAction;
    const state = actionState[row.slip_id] || {};
    try {
      setSavingSlipId(row.slip_id);
      setError('');
      const endpoint = buildApiUrl(meta.actionEndpoint(row.slip_id));

      let requestPayload = { action, remarks: state.remarks || '' };

      // Use the transition-safe payload accepted by the currently deployed
      // backend and by the updated backend. This avoids deliberately causing
      // a 400 before retrying.
      if (queueKey === 'sdo') {
        requestPayload = legacySdoPayload(action, state.remarks || '') || requestPayload;
      } else if (queueKey === 'guidance') {
        requestPayload = legacyGuidancePayload(action, state.remarks || '') || requestPayload;
      } else if (queueKey === 'pd') {
        requestPayload = legacyPdPayload(action, state.remarks || '') || requestPayload;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders(tokenStorageKey),
        body: JSON.stringify(requestPayload),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Failed to save endorsement');
      setConfirmAction(null);
      setActionState((current) => { const next = { ...current }; delete next[row.slip_id]; return next; });
      toast.success('Endorsement saved', { description: `${row.student_name} was updated successfully.` });
      await loadQueue({ soft: true });
    } catch (err) {
      setError(err.message || 'Failed to save endorsement.');
    } finally {
      setSavingSlipId('');
    }
  };

  if (!hasAccess) return <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-sm text-red-700">This account is not authorized to access this endorsement queue.</div>;
  if (loading) return <PageLoadingSkeleton label="Loading endorsement queue" showStats />;

  const confirm = confirmAction ? confirmationMeta(queueKey, confirmAction.action, confirmAction.row.student_name) : null;
  const selectedState = selectedRow ? actionState[selectedRow.slip_id] || {} : {};

  return (
    <div className="space-y-5 py-2">
      <ProfilePreview preview={profilePreview} onClose={() => setProfilePreview(null)} />
      <GradeReportPreview preview={gradePreview} onClose={() => setGradePreview(null)} />

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => { if (!open && !savingSlipId) setConfirmAction(null); }}>
        {confirm ? (
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogMedia
                className={
                  confirm.tone === 'red'
                    ? 'bg-red-50 text-red-700'
                    : confirm.tone === 'amber'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                }
              >
                {confirm.tone === 'red' ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </AlertDialogMedia>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(savingSlipId)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={`${confirmationButtonClass()} min-w-24 border-emerald-600 font-semibold shadow-sm`}
                style={{ backgroundColor: '#059669', color: '#ffffff', borderColor: '#059669' }}
                disabled={Boolean(savingSlipId)}
                onClick={(event) => {
                  event.preventDefault();
                  executeAction();
                }}
              >
                {savingSlipId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>

      <ReviewDrawer
        queueKey={queueKey}
        row={selectedRow}
        state={selectedState}
        onChange={(patch) => selectedRow && updateActionState(selectedRow.slip_id, patch)}
        onSubmit={(action) => selectedRow && setConfirmAction({ row: selectedRow, action })}
        saving={selectedRow ? savingSlipId === selectedRow.slip_id : false}
        onClose={() => setSelectedRow(null)}
        onViewFull={navigate}
        detailBasePath={detailBasePath}
        onPreviewProfile={(url, name) => setProfilePreview({ url, name })}
        onPreviewGrade={(preview) => setGradePreview(preview)}
      />

      <section className="rounded-2xl border border-stone-200 bg-white px-5 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">{meta.eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold text-stone-900">{meta.title}</h1>
            <p className="mt-1 text-sm text-stone-500">{meta.subtitle}</p>
          </div>
          <Button variant="outline" onClick={() => loadQueue({ soft: true })} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh
          </Button>
        </div>
      </section>

      <SummaryStrip queueKey={queueKey} rows={rows} />

      <Card className="border-stone-200 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search applicant or PDM ID"
                className="h-10 w-full pl-9"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full border border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
              onClick={resetFilters}
              title="Reset filters"
              aria-label="Reset filters"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program} value={program}>
                    {program === 'all' ? 'All Scholarships' : program}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course} value={course}>
                    {course === 'all' ? 'All Courses' : course}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year === 'all' ? 'All Years' : `Year ${year}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESULT_FILTERS[queueKey].map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="mt-3 text-xs text-stone-500">
            Showing {filteredRows.length} of {rows.length} applicants
          </p>
        </CardContent>
      </Card>

      {error ? <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-stone-300" />
          <p className="mt-3 text-sm font-medium text-stone-700">No applicants match the current filters.</p>
          <p className="mt-1 text-xs text-stone-500">Adjust the filters or reset them to view other endorsements.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredRows.map((row) => {
            const decision = getDecision(queueKey, row);
            return (
              <article key={row.slip_id} className="rounded-2xl border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300">
                <div className="flex gap-3">
                  <ProfileAvatar
                    key={row?.avatar_url || 'no-avatar'}
                    row={row}
                    onPreview={(url, name) => setProfilePreview({ url, name })}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-stone-900">{row.student_name}</h2>
                        <p className="mt-0.5 text-xs text-stone-500">{row.pdm_id || 'No PDM ID'}</p>
                      </div>
                      <Badge variant="outline" className={`${decisionTone(decision)} shrink-0`}>{decision === 'pending' ? 'Awaiting Review' : decisionLabel(queueKey, row)}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium text-stone-800">{row.course_code || 'Course N/A'}{row.year_level ? ` • Year ${row.year_level}` : ''}</p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">{row.program_name || 'Scholarship N/A'}{row.opening_title ? ` • ${row.opening_title}` : ''}</p>
                  </div>
                </div>

                <div className="mt-3 border-t border-stone-100 pt-3">
                  <CompactStageProgress tracker={row.tracker} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
                  <span className="min-w-0 truncate text-[11px] text-stone-400">Received {formatDate(row.submitted_at)}</span>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setSelectedRow(row)}>
                    {decision === 'pending' ? <ShieldCheck className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                    {decision === 'pending' ? 'Review' : 'View'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
