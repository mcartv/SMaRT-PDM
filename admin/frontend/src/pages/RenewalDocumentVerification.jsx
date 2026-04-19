import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
    <div className="space-y-4 py-2 animate-in fade-in duration-300">

      {/* HEADER */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/renewals')}
          className="h-8 w-8 p-0 rounded-lg border-stone-200 bg-white"
        >
          <ArrowLeft size={15} />
        </Button>

        <div>
          <p className="text-[11px] text-stone-400">
            Scholar Renewals / {id}
          </p>
          <h1 className="text-lg font-semibold text-stone-900">
            Renewal Verification
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="ml-auto border-stone-200"
          onClick={loadRenewal}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">

        {/* LEFT SIDEBAR */}
        <div className="space-y-4">

          {/* STUDENT */}
          <div className="p-4 rounded-xl bg-white border border-stone-200">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-blue-900 text-white text-xs">
                  {renewal?.student?.initials || 'NA'}
                </AvatarFallback>
              </Avatar>

              <div>
                <p className="text-sm font-semibold text-stone-900">
                  {renewal?.student?.name}
                </p>
                <p className="text-[11px] text-stone-400">
                  {renewal?.student?.pdm_id}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-stone-500">
              <p>{renewal?.student?.program}</p>
              <p>{renewal?.renewal_status}</p>
            </div>
          </div>

          {/* CHECKLIST */}
          <div className="space-y-1">
            {documents.map((doc) => {
              const meta = DOC_STATUS[doc.status] || DOC_STATUS.pending;
              const isActive = activeDoc?.id === doc.id;

              return (
                <button
                  key={doc.id}
                  onClick={() => setDocKey(doc.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition ${isActive
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-stone-600 hover:bg-stone-100'
                    }`}
                >
                  <span className="truncate">{doc.name}</span>
                  <span
                    className="ml-2 text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT MAIN */}
        <div className="space-y-4">

          {/* DOCUMENT VIEW */}
          <Card className="border-stone-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-stone-50">
              <p className="text-sm font-medium text-stone-800">
                {activeDoc?.name || 'Document'}
              </p>

              {activeDoc?.url && (
                <a
                  href={activeDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-700 flex items-center gap-1"
                >
                  Open <ExternalLink size={12} />
                </a>
              )}
            </div>

            <div className="h-[520px] bg-stone-50 flex items-center justify-center">
              {activeDoc?.url ? (
                <iframe
                  src={activeDoc.url}
                  className="w-full h-full"
                  title="doc"
                />
              ) : (
                <p className="text-xs text-stone-400">
                  No document uploaded
                </p>
              )}
            </div>
          </Card>

          {/* ACTIONS */}
          <div className="grid lg:grid-cols-2 gap-4">

            {/* DOCUMENT ACTION */}
            <Card className="p-4 border-stone-200">
              <p className="text-[11px] uppercase text-stone-400 mb-2">
                Document Feedback
              </p>

              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={!activeDoc?.url}
                className="h-20 text-sm"
              />

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => setActiveStatus('verified')}
                  disabled={!activeDoc?.url}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Verify
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveStatus('rejected')}
                >
                  Re-upload
                </Button>
              </div>
            </Card>

            {/* FINAL ACTION */}
            <Card className="p-4 border-stone-200">
              <p className="text-[11px] uppercase text-stone-400 mb-2">
                Final Decision
              </p>

              <Textarea
                value={finalComment}
                onChange={(e) => setFinalComment(e.target.value)}
                className="h-20 text-sm"
              />

              <div className="grid grid-cols-3 gap-2 mt-3">
                <Button
                  size="sm"
                  className="bg-green-700"
                  onClick={() => handleSubmitReview('approve')}
                >
                  Approve
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSubmitReview('reupload')}
                >
                  Re-upload
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200"
                  onClick={() => handleSubmitReview('reject')}
                >
                  Reject
                </Button>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
