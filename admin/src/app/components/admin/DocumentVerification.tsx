import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  CheckCircle, XCircle, Clock, ArrowLeft,
  FileText, Flag, ChevronRight,
} from 'lucide-react';

// ─── Palette ─────────────────────────────────────────────────
const C = {
  blue: '#1E3A8A',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  orange: '#d97706',
  orangeSft: '#FFF7ED',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  border: '#E5E7EB',
  muted: '#6B7280',
  text: '#111827',
  bg: '#F9FAFB',
  white: '#FFFFFF',
} as const;

const CARD = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
} as const;

// ─── Data ────────────────────────────────────────────────────
type DocStatus = 'verified' | 'pending' | 'rejected';

const DOCS: { id: string; name: string; status: DocStatus; uploaded: string }[] = [
  { id: 'cor', name: 'Certificate of Registration', status: 'verified', uploaded: 'Oct 20, 2025' },
  { id: 'grades', name: 'Grade Form', status: 'pending', uploaded: 'Oct 20, 2025' },
  { id: 'indigency', name: 'Certificate of Indigency', status: 'verified', uploaded: 'Oct 19, 2025' },
  { id: 'id', name: 'Valid ID', status: 'verified', uploaded: 'Oct 20, 2025' },
];

const STUDENT = {
  id: '2025-001', name: 'Juan Dela Cruz', initials: 'JD',
  program: 'TES', email: 'juan.delacruz@student.edu.ph',
  phone: '+63 912 345 6789', year: '2nd Year',
  course: 'BS Computer Science', dept: 'Engineering', gwa: '1.75',
};

// ─── Status config ────────────────────────────────────────────
const DOC_STATUS: Record<DocStatus, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  verified: { icon: <CheckCircle className="w-4 h-4" />, color: C.green, bg: C.greenSoft, label: 'Verified' },
  pending: { icon: <Clock className="w-4 h-4" />, color: C.orange, bg: C.orangeSft, label: 'Pending' },
  rejected: { icon: <XCircle className="w-4 h-4" />, color: C.red, bg: C.redSoft, label: 'Rejected' },
};

// ─── Helpers ─────────────────────────────────────────────────
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>{label}</p>
      <p className={`text-sm text-gray-800 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────
export default function DocumentVerification() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [doc, setDoc] = useState('cor');
  const [comment, setComment] = useState('');

  const verified = DOCS.filter(d => d.status === 'verified').length;
  const progress = Math.round((verified / DOCS.length) * 100);
  const activeDoc = DOCS.find(d => d.id === doc)!;

  return (
    <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/applications')}
          className="w-8 h-8 flex items-center justify-center rounded-xl border transition-colors shrink-0"
          style={{ borderColor: C.border, background: C.white }}
          onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
          onMouseLeave={e => (e.currentTarget.style.background = C.white)}
        >
          <ArrowLeft className="w-4 h-4" style={{ color: C.muted }} />
        </button>
        <div>
          <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
            <span
              className="cursor-pointer hover:underline"
              onClick={() => navigate('/admin/applications')}
            >
              Applications
            </span>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: C.text }}>{id}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Document Verification</h1>
        </div>
      </div>

      {/* ── Split layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── Left: Student info + checklist ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Student card */}
          <div style={CARD} className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <Avatar className="w-12 h-12 shrink-0">
                <AvatarFallback
                  className="text-sm font-bold text-white"
                  style={{ background: C.blue }}
                >
                  {STUDENT.initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{STUDENT.name}</p>
                <p className="text-xs font-mono text-gray-400">{STUDENT.id}</p>
                <span
                  className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md mt-1"
                  style={{ background: C.blueSoft, color: C.blue }}
                >
                  {STUDENT.program}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <InfoRow label="Email" value={STUDENT.email} />
              <InfoRow label="Phone" value={STUDENT.phone} />
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Year Level" value={STUDENT.year} />
                <InfoRow label="GWA" value={STUDENT.gwa} mono />
              </div>
              <InfoRow label="Course" value={STUDENT.course} />
              <InfoRow label="Department" value={STUDENT.dept} />
            </div>
          </div>

          {/* Document checklist */}
          <div style={CARD} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Required Documents</h2>
              <span className="text-xs font-semibold" style={{ color: C.muted }}>
                {verified}/{DOCS.length} verified
              </span>
            </div>

            <div className="space-y-2">
              {DOCS.map((d) => {
                const s = DOC_STATUS[d.status];
                const isActive = doc === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDoc(d.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left"
                    style={{
                      borderColor: isActive ? C.blue : C.border,
                      background: isActive ? C.blueSoft : C.white,
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = C.bg; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = C.white; }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span style={{ color: s.color, flexShrink: 0 }}>{s.icon}</span>
                      <div className="min-w-0">
                        <p className={`text-xs truncate ${isActive ? 'font-semibold text-blue-900' : 'font-medium text-gray-800'}`}>
                          {d.name}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Uploaded {d.uploaded}</p>
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ml-2"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500">Verification progress</span>
                <span className="text-xs font-bold text-gray-900">{progress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: C.border }}>
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%`, background: C.green }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Document viewer + actions ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Document viewer */}
          <div style={CARD} className="overflow-hidden">
            {/* Tab strip */}
            <div className="flex items-center gap-1 px-4 pt-4 pb-0 overflow-x-auto">
              {DOCS.map((d) => {
                const s = DOC_STATUS[d.status];
                const isActive = doc === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDoc(d.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg border-b-2 transition-all"
                    style={{
                      borderBottomColor: isActive ? C.blue : 'transparent',
                      color: isActive ? C.blue : C.muted,
                      background: isActive ? C.blueSoft : 'transparent',
                    }}
                  >
                    <span style={{ color: s.color }}>{s.icon}</span>
                    {d.name}
                  </button>
                );
              })}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}` }} />

            {/* Preview area */}
            <div className="p-6 min-h-[420px] flex items-center justify-center" style={{ background: C.bg }}>
              <div className="w-full max-w-lg bg-white rounded-xl p-10 text-center"
                style={{ border: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: C.blueSoft }}>
                  <FileText className="w-7 h-7" style={{ color: C.blue }} />
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">{activeDoc.name}</p>
                <p className="text-xs text-gray-400 mb-5">Uploaded {activeDoc.uploaded}</p>
                <div className="h-48 rounded-xl flex items-center justify-center"
                  style={{ background: C.bg, border: `2px dashed ${C.border}` }}>
                  <p className="text-xs text-gray-400">Document preview renders here</p>
                </div>
              </div>
            </div>
          </div>

          {/* Verification actions */}
          <div style={CARD} className="p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Verification Actions</h2>

            {/* Comment box */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Note to student <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <Textarea
                placeholder="Add comments or instructions for the student…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="resize-none text-sm rounded-xl border-gray-200 bg-gray-50 focus:bg-white"
              />
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all"
                style={{ background: C.greenSoft, borderColor: '#bbf7d0', color: C.green }}
                onMouseEnter={e => (e.currentTarget.style.background = '#dcfce7')}
                onMouseLeave={e => (e.currentTarget.style.background = C.greenSoft)}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Mark Verified
              </button>
              <button
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all"
                style={{ background: C.orangeSft, borderColor: '#fed7aa', color: C.orange }}
                onMouseEnter={e => (e.currentTarget.style.background = '#ffedd5')}
                onMouseLeave={e => (e.currentTarget.style.background = C.orangeSft)}
              >
                <XCircle className="w-3.5 h-3.5" />
                Request Re-upload
              </button>
              <button
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all"
                style={{ background: C.redSoft, borderColor: '#fecaca', color: C.red }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                onMouseLeave={e => (e.currentTarget.style.background = C.redSoft)}
              >
                <Flag className="w-3.5 h-3.5" />
                Flag for Review
              </button>
            </div>

            {/* Save & Next */}
            <button
              className="w-full h-11 rounded-xl text-sm font-bold text-white transition-opacity"
              style={{ background: C.blue }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Save & Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}