import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  Loader2,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EndorsementProgressTracker from '@/components/endorsement/EndorsementProgressTracker';

const STAGE_META = {
  completed: 'bg-green-50 text-green-700',
  approved: 'bg-green-50 text-green-700',
  cleared: 'bg-green-50 text-green-700',
  pending: 'bg-amber-50 text-amber-700',
  not_started: 'bg-stone-100 text-stone-600',
  rejected: 'bg-red-50 text-red-700',
  held: 'bg-amber-50 text-amber-700',
  disqualified_minor: 'bg-amber-50 text-amber-700',
  disqualified_major: 'bg-red-50 text-red-700',
};

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StageIcon({ status }) {
  if (['completed', 'approved', 'cleared'].includes(status)) {
    return <CheckCircle2 className="h-4 w-4 text-green-700" />;
  }
  if (['rejected', 'disqualified_major', 'held'].includes(status)) {
    return <XCircle className="h-4 w-4 text-red-700" />;
  }
  if (status === 'disqualified_minor') {
    return <Clock3 className="h-4 w-4 text-amber-700" />;
  }
  return <Clock3 className="h-4 w-4 text-amber-700" />;
}

export default function EndorsementSlipDetail({ tokenStorageKey = 'adminToken' }) {
  const navigate = useNavigate();
  const { slipId } = useParams();
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const loadDetail = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(buildApiUrl(`/api/endorsement-slips/${slipId}`), {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem(tokenStorageKey)}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load endorsement slip');
        }

        setSlip(data);
      } catch (err) {
        setError(err.message || 'Failed to load endorsement slip.');
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [slipId]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-stone-400" />
        <p className="text-sm text-stone-500">Loading endorsement slip...</p>
      </div>
    );
  }

  if (error || !slip) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <XCircle className="mx-auto mb-3 h-7 w-7 text-red-400" />
        <p className="text-sm font-semibold text-red-800">Failed to load endorsement slip</p>
        <p className="mt-1 text-sm text-red-600">{error || 'Slip not found.'}</p>
      </div>
    );
  }

  const handleDownloadSlip = async () => {
    try {
      setDownloading(true);
      const response = await fetch(buildApiUrl(`/api/endorsement-slips/${slipId}/pdf`), {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem(tokenStorageKey)}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to download endorsement slip PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slip.slip_code || 'endorsement-slip'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download endorsement slip PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="border-stone-200"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Endorsement Slip</p>
          <h1 className="text-2xl font-semibold text-stone-900">{slip.student_name}</h1>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.3fr]">
        <Card className="border-stone-200 shadow-none">
          <CardHeader className="border-b border-stone-100">
            <h2 className="text-base font-semibold text-stone-900">Student Summary</h2>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 text-sm text-stone-700">
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Slip Code</p>
              <p className="font-mono text-xs">{slip.slip_code || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">PDM ID</p>
              <p className="font-medium">{slip.pdm_id}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Program</p>
              <p className="font-medium">{slip.program_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Opening</p>
              <p className="font-medium">{slip.opening_title}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Semester</p>
              <p className="font-medium">{slip.semester || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">School Year</p>
              <p className="font-medium">{slip.school_year || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Application ID</p>
              <p className="font-mono text-xs">{slip.application_id}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Submitted</p>
              <p className="font-medium">{formatDate(slip.submitted_at)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">GWA</p>
              <p className="font-medium">{slip.grade_summary?.gwa ?? 'N/A'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-stone-900 text-white hover:bg-stone-800"
                onClick={handleDownloadSlip}
                disabled={downloading}
              >
                {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download Slip PDF
              </Button>
              {slip.final_pdf_url ? (
                <a href={slip.final_pdf_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="border-stone-200">
                    <Download className="mr-2 h-4 w-4" />
                    Open Stored Final PDF
                  </Button>
                </a>
              ) : null}
              <a
                href={`${window.location.origin}/endorsement/verify/${slip.verification_token}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" className="border-stone-200">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Open Public Verification
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-none">
          <CardHeader className="border-b border-stone-100">
            <h2 className="text-base font-semibold text-stone-900">Workflow Tracker</h2>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <EndorsementProgressTracker tracker={slip.tracker} />
            {slip.stages.map((stage) => (
              <div key={stage.key} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <StageIcon status={stage.status} />
                    <div>
                      <p className="font-semibold text-stone-900">{stage.label}</p>
                      <p className="text-sm text-stone-700">
                        {stage.result_label || stage.status}
                      </p>
                      <p className="text-sm text-stone-500">{formatDate(stage.acted_at)}</p>
                    </div>
                  </div>
                  <Badge className={STAGE_META[stage.status] || 'bg-stone-100 text-stone-700'}>
                    {stage.status}
                  </Badge>
                </div>
                {stage.acted_by_name || stage.acted_by_user_id ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-stone-700">
                    <UserRound className="h-4 w-4 text-stone-400" />
                    <span>{stage.acted_by_name || stage.acted_by_user_id}</span>
                  </div>
                ) : null}
                {stage.remarks ? (
                  <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                    {stage.remarks}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-stone-200 shadow-none">
        <CardHeader className="border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">Office Notes</h2>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-700">
            <p className="text-xs uppercase tracking-wide text-stone-500">SDO Result</p>
            <p className="mt-1 font-medium text-stone-900">{slip.office_results?.sdo || 'Pending'}</p>
            {slip.sdo_offense_detail?.offense_type ? (
              <div className="mt-3 space-y-1 text-xs text-stone-500">
                <p>Offense Type: {slip.sdo_offense_detail.offense_type}</p>
                <p>Date of Incident: {slip.sdo_offense_detail.incident_date || 'N/A'}</p>
                <p>Case Note / Ref No.: {slip.sdo_offense_detail.case_reference_number || 'N/A'}</p>
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-700">
            <p className="text-xs uppercase tracking-wide text-stone-500">Guidance Result</p>
            <p className="mt-1 font-medium text-stone-900">{slip.office_results?.guidance || 'Pending'}</p>
            <p className="mt-3 text-xs text-stone-500">
              Guidance can now clear, hold for counseling, or reject the endorsement.
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-700">
            <p className="text-xs uppercase tracking-wide text-stone-500">PD Result</p>
            <p className="mt-1 font-medium text-stone-900">{slip.office_results?.pd || 'Pending'}</p>
            <p className="mt-3 text-xs text-stone-500">
              Final scholar activation still depends on both endorsement and requirements readiness.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-stone-200 shadow-none">
        <CardHeader className="border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">Application Files</h2>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {(slip.documents || []).length === 0 ? (
            <p className="text-sm text-stone-500">No documents found.</p>
          ) : (
            slip.documents.map((document) => (
              <div
                key={document.document_id}
                className="flex flex-col gap-2 rounded-xl border border-stone-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-stone-900">{document.document_type}</p>
                  <p className="text-sm text-stone-500">{document.file_name || 'Unnamed file'}</p>
                </div>
                {document.file_url ? (
                  <a
                    href={document.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
                  >
                    Open File
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-sm text-stone-400">No file URL</span>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
