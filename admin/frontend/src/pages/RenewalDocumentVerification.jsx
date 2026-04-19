import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ScanSearch,
  XCircle,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const DOC_STATUS = {
  verified: {
    label: 'Verified',
    color: '#16a34a',
    bg: '#F0FDF4',
  },
  uploaded: {
    label: 'Pending Review',
    color: '#d97706',
    bg: '#FFF7ED',
  },
  rejected: {
    label: 'Re-upload',
    color: '#dc2626',
    bg: '#FEF2F2',
  },
  pending: {
    label: 'Missing',
    color: '#7c4a2e',
    bg: '#EFF6FF',
  },
};

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-stone-800">{value || 'N/A'}</p>
    </div>
  );
}

function DocumentPanel({ activeDoc }) {
  if (!activeDoc) return null;

  return (
    <Card className="border-stone-200 shadow-none bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-stone-500" />
          <div>
            <h4 className="text-sm font-semibold text-stone-800">{activeDoc.name}</h4>
            <p className="text-[11px] text-stone-400">Uploaded renewal document</p>
          </div>
        </div>

        {activeDoc.url && (
          <a
            href={activeDoc.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
          >
            Open file
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="p-4 min-h-[520px] flex items-center justify-center bg-stone-50/30">
        {activeDoc.url ? (
          <iframe
            src={activeDoc.url}
            title={activeDoc.name}
            className="w-full h-[520px] rounded-lg border border-stone-200 bg-white"
          />
        ) : (
          <div className="text-center">
            <ScanSearch className="w-7 h-7 text-stone-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-stone-700">No uploaded document</p>
            <p className="text-xs text-stone-400 mt-1">This requirement has not been uploaded yet.</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function RenewalDocumentVerification() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [renewal, setRenewal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docKey, setDocKey] = useState('');
  const [docStatuses, setDocStatuses] = useState({});
  const [docComments, setDocComments] = useState({});
  const [comment, setComment] = useState('');
  const [finalComment, setFinalComment] = useState('');
  const [submittingAction, setSubmittingAction] = useState('');

  const loadRenewal = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_BASE}/renewals/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load renewal details');
      }

      setRenewal(payload);

      const initialDocuments = payload?.documents || [];
      const firstAvailable = initialDocuments.find((doc) => doc.url)?.id || initialDocuments[0]?.id || '';
      setDocKey(firstAvailable);

      const nextStatuses = {};
      const nextComments = {};
      initialDocuments.forEach((doc) => {
        nextStatuses[doc.id] = doc.status || 'pending';
        nextComments[doc.id] = doc.admin_comment || '';
      });
      setDocStatuses(nextStatuses);
      setDocComments(nextComments);
      setFinalComment(payload?.renewal?.admin_comment || '');
    } catch (err) {
      setError(err.message || 'Failed to load renewal details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRenewal();
  }, [id]);

  const documents = useMemo(() => {
    const rawDocs = renewal?.documents || [];
    return rawDocs.map((doc) => ({
      ...doc,
      status: docStatuses[doc.id] || doc.status || 'pending',
      admin_comment: docComments[doc.id] || '',
    }));
  }, [renewal, docStatuses, docComments]);

  const activeDoc = documents.find((doc) => doc.id === docKey) || documents[0] || null;
  const uploadedCount = documents.filter((doc) => !!doc.url).length;
  const verifiedCount = documents.filter((doc) => doc.status === 'verified').length;
  const allUploaded = documents.every((doc) => !!doc.url);

  useEffect(() => {
    if (activeDoc) {
      setComment(docComments[activeDoc.id] || '');
    }
  }, [activeDoc, docComments]);

  const setActiveStatus = (nextStatus) => {
    if (!activeDoc || !activeDoc.url) return;

    setDocStatuses((prev) => ({ ...prev, [activeDoc.id]: nextStatus }));
    setDocComments((prev) => ({ ...prev, [activeDoc.id]: comment }));
  };

  const handleSubmitReview = async (finalAction) => {
    try {
      setSubmittingAction(finalAction);
      const payload = {
        final_action: finalAction,
        final_comment: finalComment,
        document_reviews: documents.map((doc) => ({
          document_type: doc.document_type,
          name: doc.name,
          status: docStatuses[doc.id] || doc.status,
          comment: docComments[doc.id] || '',
          url: doc.url || null,
        })),
      };

      const response = await fetch(`${API_BASE}/renewals/${id}/review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save renewal review');
      }

      alert('Renewal review saved successfully.');
      navigate('/admin/renewals');
    } catch (err) {
      alert(err.message || 'Failed to save renewal review');
    } finally {
      setSubmittingAction('');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">Loading renewal review...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <p className="text-sm font-semibold text-red-800">Failed to load renewal review</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <Button onClick={loadRenewal} variant="outline" size="sm" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/renewals')}
          className="h-8 w-8 p-0 rounded-lg border-stone-200 bg-white"
        >
          <ArrowLeft size={15} className="text-stone-500" />
        </Button>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <span className="hover:text-stone-600 cursor-pointer" onClick={() => navigate('/admin/renewals')}>
              Scholar Renewals
            </span>
            <ChevronRight size={11} />
            <span className="text-stone-600">{id}</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mt-0.5">Renewal Verification</h1>
        </div>
        <Button variant="outline" size="sm" className="ml-auto border-stone-200 bg-white" onClick={loadRenewal}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-stone-200 shadow-none bg-white">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <Avatar className="w-12 h-12 border border-stone-100">
                  <AvatarImage
                    src={renewal?.student?.avatar_url || undefined}
                    alt={renewal?.student?.name || 'Scholar'}
                  />
                  <AvatarFallback className="bg-blue-900 text-white text-sm font-semibold">
                    {renewal?.student?.initials || 'NA'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-base font-semibold text-stone-900">{renewal?.student?.name}</h2>
                  <p className="text-xs font-mono text-stone-400">{renewal?.student?.pdm_id}</p>
                  <Badge className="mt-1.5 bg-blue-50 text-blue-700 border-blue-100 font-medium text-[10px] uppercase tracking-wide">
                    {renewal?.student?.program}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3.5 pt-4 border-t border-stone-100">
                <InfoRow label="Email Address" value={renewal?.student?.email} />
                <InfoRow label="Phone Number" value={renewal?.student?.phone} />
                <InfoRow
                  label="Renewal Cycle"
                  value={`${renewal?.renewal?.semester_label} Sem AY ${renewal?.renewal?.school_year_label}`}
                />
                <InfoRow label="Renewal Status" value={renewal?.renewal_status} />
                <InfoRow label="Document Status" value={renewal?.document_status} />
                <InfoRow label="Batch Year" value={renewal?.scholar?.batch_year} />
              </div>
            </div>
          </Card>

          <Card className="border-stone-200 shadow-none bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50/50">
              <h3 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">Checklist</h3>
              <span className="text-xs text-stone-400">{uploadedCount}/{documents.length} uploaded</span>
            </div>

            <div className="p-3 space-y-1.5">
              {documents.map((doc) => {
                const meta = DOC_STATUS[doc.status] || DOC_STATUS.pending;
                const isActive = activeDoc?.id === doc.id;

                return (
                  <button
                    key={doc.id}
                    onClick={() => setDocKey(doc.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left ${isActive
                        ? 'border-blue-800 bg-blue-50 shadow-sm'
                        : 'border-stone-100 bg-white hover:border-stone-200'
                      }`}
                  >
                    <div>
                      <p className={`text-xs ${isActive ? 'font-semibold text-blue-900' : 'font-medium text-stone-700'}`}>
                        {doc.name}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {doc.url ? 'File uploaded' : 'No file uploaded'}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <DocumentPanel activeDoc={activeDoc} />

          <Card className="border-stone-200 shadow-none bg-white">
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-medium text-stone-400 uppercase tracking-wider block mb-1.5">
                  Document Feedback
                </label>
                <Textarea
                  placeholder={activeDoc?.url ? 'Enter feedback for this document...' : 'No uploaded document selected yet.'}
                  value={comment}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setComment(nextValue);
                    if (activeDoc) {
                      setDocComments((prev) => ({ ...prev, [activeDoc.id]: nextValue }));
                    }
                  }}
                  disabled={!activeDoc?.url}
                  className="rounded-lg bg-stone-50/50 border-stone-200 resize-none h-20 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activeDoc?.url}
                  onClick={() => setActiveStatus('verified')}
                  className="h-9 rounded-lg text-xs border-stone-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                >
                  <CheckCircle size={13} className="mr-1.5" /> Verify
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activeDoc?.url}
                  onClick={() => setActiveStatus('rejected')}
                  className="h-9 rounded-lg text-xs border-stone-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"
                >
                  <XCircle size={13} className="mr-1.5" /> Request Re-upload
                </Button>
              </div>

              <div>
                <label className="text-[10px] font-medium text-stone-400 uppercase tracking-wider block mb-1.5">
                  Final Admin Remarks
                </label>
                <Textarea
                  value={finalComment}
                  onChange={(e) => setFinalComment(e.target.value)}
                  placeholder="Add summary remarks for the scholar renewal review..."
                  className="rounded-lg bg-stone-50/50 border-stone-200 resize-none h-24 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button
                  disabled={submittingAction === 'approve' || !allUploaded || verifiedCount !== documents.length}
                  onClick={() => handleSubmitReview('approve')}
                  className="bg-green-700 hover:bg-green-800"
                >
                  {submittingAction === 'approve' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Approve Renewal
                </Button>
                <Button
                  disabled={submittingAction === 'reupload'}
                  variant="outline"
                  className="border-orange-200 text-orange-700 hover:bg-orange-50"
                  onClick={() => handleSubmitReview('reupload')}
                >
                  {submittingAction === 'reupload' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Mark for Re-upload
                </Button>
                <Button
                  disabled={submittingAction === 'reject'}
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => handleSubmitReview('reject')}
                >
                  {submittingAction === 'reject' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Reject Renewal
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
