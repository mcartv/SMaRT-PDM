import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../components/ui/button';
// Ensure you have these components converted to .jsx in your ui folder
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
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
};

const CARD = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

// ─── Data ────────────────────────────────────────────────────
const DOCS = [
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
const DOC_STATUS = {
  verified: { icon: <CheckCircle className="w-4 h-4" />, color: C.green, bg: C.greenSoft, label: 'Verified' },
  pending: { icon: <Clock className="w-4 h-4" />, color: C.orange, bg: C.orangeSft, label: 'Pending' },
  rejected: { icon: <XCircle className="w-4 h-4" />, color: C.red, bg: C.redSoft, label: 'Rejected' },
};

// ─── Helpers ─────────────────────────────────────────────────
function InfoRow({ label, value, mono }) {
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
  const activeDoc = DOCS.find(d => d.id === doc);

  return (
    <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/applications')}
          className="w-8 h-8 flex items-center justify-center rounded-xl border transition-colors shrink-0"
          style={{ borderColor: C.border, background: C.white }}
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left Panel */}
        <div className="lg:col-span-2 space-y-4">
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

            <div className="space-y-3 pt-4 border-t border-gray-200">
              <InfoRow label="Email" value={STUDENT.email} />
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Year Level" value={STUDENT.year} />
                <InfoRow label="GWA" value={STUDENT.gwa} mono />
              </div>
              <InfoRow label="Course" value={STUDENT.course} />
            </div>
          </div>

          <div style={CARD} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Checklist</h2>
              <span className="text-xs font-semibold text-gray-500">{verified}/{DOCS.length} verified</span>
            </div>
            <div className="space-y-2">
              {DOCS.map((d) => {
                const s = DOC_STATUS[d.status];
                const isActive = doc === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDoc(d.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${isActive ? 'bg-blue-50 border-blue-900' : 'bg-white border-gray-200'}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span style={{ color: s.color }}>{s.icon}</span>
                      <p className={`text-xs truncate ${isActive ? 'font-semibold text-blue-900' : 'text-gray-800'}`}>{d.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-3 space-y-4">
          <div style={CARD} className="overflow-hidden min-h-100">
            <div className="bg-gray-50 p-6 h-full flex flex-col items-center justify-center">
              <FileText className="w-12 h-12 text-blue-200 mb-2" />
              <p className="text-sm font-semibold text-gray-900">{activeDoc.name}</p>
              <div className="mt-4 w-full max-w-sm h-64 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400">
                Preview renders here
              </div>
            </div>
          </div>

          <div style={CARD} className="p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Verification Actions</h2>
            <Textarea
              placeholder="Add comments for the student..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mb-4 bg-gray-50 border-gray-200 rounded-xl"
            />
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button className="py-2 rounded-lg bg-green-50 text-green-600 text-xs font-bold border border-green-200">Verify</button>
              <button className="py-2 rounded-lg bg-orange-50 text-orange-600 text-xs font-bold border border-orange-200">Re-upload</button>
              <button className="py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold border border-red-200">Flag</button>
            </div>
            <Button className="w-full bg-blue-900 text-white font-bold h-11 rounded-xl">Save & Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}