import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, XCircle, Clock, ArrowLeft,
  FileText, Flag, ChevronRight, Loader2,
} from 'lucide-react';

const C = {
  blue: '#1E3A8A',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  orange: '#d97706',
  orangeSoft: '#FFF7ED',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  text: '#1c1917',
  bg: '#faf7f2',
  muted: '#78716c',
  brownMid: '#7c4a2e',
};

const DOC_STATUS = {
  verified: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: C.green, bg: C.greenSoft, label: 'Uploaded' },
  pending: { icon: <Clock className="w-3.5 h-3.5" />, color: C.orange, bg: C.orangeSoft, label: 'Missing' },
  rejected: { icon: <XCircle className="w-3.5 h-3.5" />, color: C.red, bg: C.redSoft, label: 'Rejected' },
};

function InfoRow({ label, value, mono }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono text-stone-600' : 'font-medium text-stone-800'}`}>
        {value || 'N/A'}
      </p>
    </div>
  );
}

export default function DocumentVerification() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [doc, setDoc] = useState('loi');
  const [comment, setComment] = useState('');

  useEffect(() => {
    const fetchApplicationDocuments = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`http://localhost:5000/api/applications/${id}/documents`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to load application documents');
        }

        const data = await res.json();
        setApplication(data);

        if (data?.documents?.length) {
          const firstAvailable = data.documents.find((d) => d.url)?.id || data.documents[0].id;
          setDoc(firstAvailable);
        }
      } catch (err) {
        console.error('Document fetch error:', err);
        setError(err.message || 'Failed to load document data');
      } finally {
        setLoading(false);
      }
    };

    fetchApplicationDocuments();
  }, [id]);

  const docs = useMemo(() => application?.documents || [], [application]);
  const uploaded = docs.filter((d) => !!d.url).length;
  const progress = docs.length ? Math.round((uploaded / docs.length) * 100) : 0;
  const activeDoc = docs.find((d) => d.id === doc) || docs[0] || null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <XCircle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-800">Failed to load document verification</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          size="sm"
          className="mt-4 border-red-200 text-red-600 text-xs"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2 animate-in fade-in duration-300" style={{ background: C.bg }}>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/applications')}
          className="h-8 w-8 p-0 rounded-lg border-stone-200 bg-white"
        >
          <ArrowLeft size={15} className="text-stone-500" />
        </Button>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <span
              className="hover:text-stone-600 cursor-pointer transition-colors"
              onClick={() => navigate('/admin/applications')}
            >
              Registry
            </span>
            <ChevronRight size={11} />
            <span className="text-stone-600">{id}</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mt-0.5">Document Verification</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-stone-200 shadow-none bg-white">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <Avatar className="w-12 h-12 border border-stone-100">
                  <AvatarFallback className="bg-blue-900 text-white text-sm font-semibold">
                    {application?.student?.initials || 'NA'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-base font-semibold text-stone-900">{application?.student?.name}</h2>
                  <p className="text-xs font-mono text-stone-400">{application?.student?.pdm_id}</p>
                  <Badge className="mt-1.5 bg-blue-50 text-blue-700 border-blue-100 font-medium text-[10px] uppercase tracking-wide">
                    {application?.student?.program}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3.5 pt-4 border-t border-stone-100">
                <InfoRow label="Email Address" value={application?.student?.email} />
                <InfoRow label="Phone Number" value={application?.student?.phone} />
                <div className="grid grid-cols-2 gap-3.5">
                  <InfoRow label="Academic Year" value={application?.student?.year} />
                  <InfoRow label="GWA Score" value={application?.student?.gwa} mono />
                </div>
                <InfoRow label="Course / Program" value={application?.student?.course} />
                <InfoRow label="Document Status" value={application?.document_status} />
              </div>
            </div>
          </Card>

          <Card className="border-stone-200 shadow-none bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50/50">
              <h3 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">Checklist</h3>
              <span className="text-xs text-stone-400">{uploaded}/{docs.length} done</span>
            </div>

            <CardContent className="p-3 space-y-1.5">
              {docs.map((d) => {
                const s = DOC_STATUS[d.status] || DOC_STATUS.pending;
                const isActive = doc === d.id;

                return (
                  <button
                    key={d.id}
                    onClick={() => setDoc(d.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${isActive
                        ? 'border-blue-800 bg-blue-50 shadow-sm'
                        : 'border-stone-100 bg-white hover:border-stone-200'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span style={{ color: s.color }}>{s.icon}</span>
                      <div className="min-w-0">
                        <p className={`text-xs truncate ${isActive ? 'font-semibold text-blue-900' : 'font-medium text-stone-700'}`}>
                          {d.name}
                        </p>
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {d.url ? 'File uploaded' : 'No file uploaded'}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}

              <div className="mt-3 pt-3 border-t border-stone-100">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">
                    Verification Progress
                  </span>
                  <span className="text-[10px] font-semibold text-stone-700">{progress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-500 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <Card className="border-stone-200 shadow-none bg-white overflow-hidden">
            <div className="flex border-b border-stone-100 bg-stone-50/50 overflow-x-auto">
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDoc(d.id)}
                  className={`px-4 py-3 text-xs font-medium border-b-2 transition-all shrink-0 ${doc === d.id
                      ? 'border-blue-800 text-blue-900 bg-white'
                      : 'border-transparent text-stone-400 hover:text-stone-600 hover:bg-white/60'
                    }`}
                >
                  {d.name}
                </button>
              ))}
            </div>

            <div className="p-6 min-h-[420px] bg-stone-50/30 flex items-center justify-center">
              {!activeDoc ? (
                <p className="text-sm text-stone-400">No document selected.</p>
              ) : activeDoc.url ? (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-stone-800">{activeDoc.name}</h4>
                      <p className="text-xs text-stone-400">Application Document Preview</p>
                    </div>
                    <a
                      href={activeDoc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      Open file
                    </a>
                  </div>

                  <iframe
                    src={activeDoc.url}
                    title={activeDoc.name}
                    className="w-full h-[480px] rounded-lg border border-stone-200 bg-white"
                  />
                </div>
              ) : (
                <div className="w-full max-w-sm bg-white rounded-xl p-8 text-center border border-stone-100 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-6 h-6 text-blue-500" />
                  </div>
                  <h4 className="text-sm font-semibold text-stone-800">{activeDoc.name}</h4>
                  <p className="text-xs text-stone-400 mt-1">No file uploaded yet.</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="border-stone-200 shadow-none bg-white">
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-medium text-stone-400 uppercase tracking-wider block mb-1.5">
                  Administrative Feedback
                </label>
                <Textarea
                  placeholder="Enter specific instructions or reasons for document rejection..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="rounded-lg bg-stone-50/50 border-stone-200 resize-none h-20 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg text-xs border-stone-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors"
                >
                  <CheckCircle size={13} className="mr-1.5" /> Verify
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg text-xs border-stone-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 transition-colors"
                >
                  <XCircle size={13} className="mr-1.5" /> Re-upload
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg text-xs border-stone-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                >
                  <Flag size={13} className="mr-1.5" /> Flag
                </Button>
              </div>

              <Button
                className="w-full h-10 rounded-lg font-medium text-sm text-white border-none"
                style={{ background: C.blue }}
              >
                Complete Verification & Next
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · Document Verification Layer
        </p>
      </footer>
    </div>
  );
}