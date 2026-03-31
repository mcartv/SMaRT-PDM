import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
// --- SHADCN UI COMPONENTS ---
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// --- ICONS ---
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
  text: '#3b1f0a',
  bg: '#faf7f2',
  white: '#FFFFFF',
  brownMid: '#7c4a2e',
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

const DOC_STATUS = {
  verified: { icon: <CheckCircle className="w-4 h-4" />, color: C.green, bg: C.greenSoft, label: 'Verified' },
  pending: { icon: <Clock className="w-4 h-4" />, color: C.orange, bg: C.orangeSft, label: 'Pending' },
  rejected: { icon: <XCircle className="w-4 h-4" />, color: C.red, bg: C.redSoft, label: 'Rejected' },
};

// ─── Sub-Components ───────────────────────────────────────────

function InfoRow({ label, value, mono }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono font-bold text-stone-600' : 'font-semibold text-stone-800'}`}>{value}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function DocumentVerification() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [doc, setDoc] = useState('cor');
  const [comment, setComment] = useState('');

  const verified = DOCS.filter(d => d.status === 'verified').length;
  const progress = Math.round((verified / DOCS.length) * 100);
  const activeDoc = DOCS.find(d => d.id === doc) || DOCS[0];

  return (
    <div className="space-y-6 py-2 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/applications')} className="h-10 w-10 p-0 rounded-xl border-stone-200 bg-white">
          <ArrowLeft size={18} className="text-stone-600" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">
            <span className="hover:text-stone-600 cursor-pointer transition-colors" onClick={() => navigate('/admin/applications')}>Registry</span>
            <ChevronRight size={12} />
            <span className="text-stone-600">{id}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Document Verification</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left Column: Student Context */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-stone-200 shadow-sm overflow-hidden bg-white">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="w-14 h-14 border-2 border-stone-100 shadow-sm">
                  <AvatarFallback className="bg-blue-900 text-white font-bold">{STUDENT.initials}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-bold text-stone-900">{STUDENT.name}</h2>
                  <p className="text-xs font-mono font-bold text-stone-400">{STUDENT.id}</p>
                  <Badge className="mt-2 bg-blue-50 text-blue-700 border-blue-100 font-bold uppercase text-[9px]">{STUDENT.program}</Badge>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-stone-100">
                <InfoRow label="Email Address" value={STUDENT.email} />
                <InfoRow label="Phone Number" value={STUDENT.phone} />
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Academic Year" value={STUDENT.year} />
                  <InfoRow label="GWA Score" value={STUDENT.gwa} mono />
                </div>
                <InfoRow label="Course / Program" value={STUDENT.course} />
              </div>
            </div>
          </Card>

          <Card className="border-stone-200 shadow-sm overflow-hidden bg-white">
            <div className="p-5 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-800">Checklist</h3>
              <span className="text-[10px] font-bold text-stone-400">{verified}/{DOCS.length} Done</span>
            </div>
            <CardContent className="p-4 space-y-2">
              {DOCS.map((d) => {
                const s = DOC_STATUS[d.status];
                const isActive = doc === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDoc(d.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${isActive ? 'border-blue-900 bg-blue-50 shadow-sm' : 'border-stone-100 bg-white hover:border-stone-300'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span style={{ color: s.color }}>{s.icon}</span>
                      <div className="min-w-0">
                        <p className={`text-xs truncate ${isActive ? 'font-bold text-blue-900' : 'font-semibold text-stone-700'}`}>{d.name}</p>
                        <p className="text-[10px] text-stone-400 font-medium uppercase mt-0.5">Uploaded {d.uploaded}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-none text-[8px] font-bold uppercase py-0.5" style={{ background: s.bg, color: s.color }}>{s.label}</Badge>
                  </button>
                );
              })}

              <div className="mt-4 pt-4 border-t border-stone-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Verification Status</span>
                  <span className="text-[10px] font-bold text-stone-900">{progress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full bg-green-600 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Viewer & Actions */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-stone-200 shadow-sm overflow-hidden bg-white">
            <div className="flex border-b border-stone-100 bg-stone-50/50 overflow-x-auto">
              {DOCS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDoc(d.id)}
                  className={`px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${doc === d.id ? 'border-blue-900 text-blue-900 bg-white' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                >
                  {d.name}
                </button>
              ))}
            </div>

            <div className="p-8 min-h-[450px] bg-stone-50/30 flex items-center justify-center">
              <div className="w-full max-w-md bg-white rounded-2xl p-12 text-center border border-stone-200 shadow-lg">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <h4 className="text-sm font-bold text-stone-900">{activeDoc.name}</h4>
                <p className="text-xs text-stone-400 font-medium mt-1">Version ID: {activeDoc.id.toUpperCase()}-2025-SEC</p>
                <div className="mt-8 aspect-video rounded-xl bg-stone-50 border-2 border-dashed border-stone-200 flex items-center justify-center">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest italic">Document Rendering...</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-stone-200 shadow-sm overflow-hidden bg-white">
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Administrative Feedback</label>
                <Textarea
                  placeholder="Enter specific instructions or reasons for document rejection..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="rounded-xl bg-stone-50/50 border-stone-200 resize-none h-24 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button variant="outline" className="rounded-xl font-bold text-[10px] uppercase h-11 border-stone-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200">
                  <CheckCircle size={16} className="mr-2" /> Verify
                </Button>
                <Button variant="outline" className="rounded-xl font-bold text-[10px] uppercase h-11 border-stone-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200">
                  <XCircle size={16} className="mr-2" /> Re-upload
                </Button>
                <Button variant="outline" className="rounded-xl font-bold text-[10px] uppercase h-11 border-stone-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200">
                  <Flag size={16} className="mr-2" /> Flag
                </Button>
              </div>

              <Button className="w-full h-12 rounded-xl font-bold text-sm text-white border-none shadow-xl" style={{ background: C.blue }}>
                Complete Verification & Next
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <footer className="pt-8 pb-4 text-center border-t border-stone-100">
        <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest italic">SMaRT PDM Secure Audit · Document Verification Layer</p>
      </footer>
    </div>
  );
}