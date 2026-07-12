import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileStack,
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
import { useSocketEvent } from '@/hooks/useSocket';
import usePortalTheme from '@/hooks/usePortalTheme';

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

function formatStageBadgeLabel(value = '') {
  return (
    String(value || '')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Pending'
  );
}

function StageIcon({ status }) {
  if (['completed', 'approved', 'cleared'].includes(status)) {
    return <CheckCircle2 className="h-4 w-4 text-green-700" />;
  }
  if (['rejected', 'disqualified_major', 'held'].includes(status)) {
    return <XCircle className="h-4 w-4 text-red-700" />;
  }
  return <Clock3 className="h-4 w-4 text-amber-700" />;
}

function portalMeta(tokenStorageKey) {
  if (tokenStorageKey === 'adminToken') {
    return {
      name: 'Admin',
      cardTint: 'border-stone-200 bg-stone-50/70',
      sectionBorder: 'border-stone-200',
      softBadge: 'border-stone-200 bg-stone-50 text-stone-700',
      actionPath: 'documents',
    };
  }

  if (tokenStorageKey === 'sdoToken') {
    return {
      name: 'SDO',
      cardTint: 'border-emerald-200 bg-emerald-50/70',
      sectionBorder: 'border-emerald-200',
      softBadge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      actionPath: null,
    };
  }

  if (tokenStorageKey === 'guidanceToken') {
    return {
      name: 'Guidance',
      cardTint: 'border-blue-200 bg-blue-50/70',
      sectionBorder: 'border-blue-200',
      softBadge: 'border-blue-200 bg-blue-50 text-blue-800',
      actionPath: null,
    };
  }

  return {
    name: 'PD',
    cardTint: 'border-violet-200 bg-violet-50/70',
    sectionBorder: 'border-violet-200',
    softBadge: 'border-violet-200 bg-violet-50 text-violet-800',
    actionPath: null,
  };
}

function DetailItem({ label, value, mono = false }) {
  return (
    <div className="rounded-2xl bg-stone-50 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className={`mt-1 text-sm text-stone-900 ${mono ? 'font-mono text-xs' : 'font-medium'}`}>
        {value || 'N/A'}
      </p>
    </div>
  );
}

function OfficeResultCard({ title, result, note, detailLines = [] }) {
  return (
    <div className="rounded-[22px] border border-stone-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">{title}</p>
      <p className="mt-2 text-base font-semibold text-stone-900">{result || 'Pending'}</p>
      {note ? <p className="mt-2 text-xs text-stone-500">{note}</p> : null}
      {detailLines.length ? (
        <div className="mt-3 space-y-1 text-xs text-stone-600">
          {detailLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function EndorsementSlipDetail({ tokenStorageKey = 'adminToken' }) {
  const navigate = useNavigate();
  const { slipId } = useParams();
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const meta = portalMeta(tokenStorageKey);
  const isAdminView = tokenStorageKey === 'adminToken';
  const portalKey =
    tokenStorageKey === 'sdoToken'
      ? 'sdo'
      : tokenStorageKey === 'guidanceToken'
        ? 'guidance'
        : tokenStorageKey === 'pdToken'
          ? 'pd'
          : 'admin';
  const { theme } = usePortalTheme(portalKey);

  const loadDetail = useCallback(
    async ({ soft = false } = {}) => {
      try {
        if (!soft) {
          setLoading(true);
        }
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
        if (!soft) {
          setLoading(false);
        }
      }
    },
    [slipId, tokenStorageKey]
  );

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadDetail({ soft: true });
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [loadDetail]);

  useSocketEvent(
    'endorsement:updated',
    (payload) => {
      const updatedSlipId = payload?.slip_id?.toString?.() || '';
      if (updatedSlipId && updatedSlipId === String(slipId)) {
        loadDetail({ soft: true });
      }
    },
    [loadDetail, slipId]
  );

  const historyItems = useMemo(() => {
    if (!slip) return [];

    return (slip.stages || []).filter(
      (stage) => stage.acted_at || stage.remarks || stage.acted_by_name || stage.status
    );
  }, [slip]);

  const lastActionAt = useMemo(() => {
    if (!historyItems.length) return slip?.submitted_at || null;

    return historyItems
      .map((stage) => stage.acted_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [historyItems, slip]);

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
      <section
        className="overflow-hidden rounded-[28px] text-white shadow-sm"
        style={{
          background: `linear-gradient(90deg, ${theme.base} 0%, ${theme.active} 52%, ${theme.accent} 100%)`,
        }}
      >
        <div className="flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-7">
          <div className="max-w-3xl">
            <Button
              variant="outline"
              size="sm"
              className="border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
              {meta.name} Slip View
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{slip.student_name}</h1>
            <p className="mt-2 text-sm text-white/80">
              {slip.pdm_id || 'No PDM ID'} • {slip.opening_title || 'Opening not set'} • {slip.semester || 'N/A'} / {slip.school_year || 'N/A'}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className={STAGE_META[slip.overall_status] || 'bg-stone-100 text-stone-700'}>
                {formatStageBadgeLabel(slip.overall_status_label || slip.overall_status)}
              </Badge>
              <Badge variant="outline" className="border-white/25 bg-white/10 text-white">
                {formatStageBadgeLabel(slip.current_stage_label || slip.current_stage)}
              </Badge>
              <Badge variant="outline" className="border-white/25 bg-white/10 text-white font-mono">
                {slip.slip_code || 'N/A'}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-white text-stone-900 hover:bg-stone-100"
              onClick={handleDownloadSlip}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </Button>

            {isAdminView ? (
              <Button
                variant="outline"
                className="border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => navigate(`/admin/applications/${slip.application_id}/documents`)}
              >
                <FileStack className="mr-2 h-4 w-4" />
                Open Documents
              </Button>
            ) : null}

            <a
              href={`${window.location.origin}/endorsement/verify/${slip.verification_token}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                className="border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Verify
              </Button>
            </a>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card className={`rounded-[22px] shadow-none ${meta.sectionBorder}`}>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Current Office</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {formatStageBadgeLabel(slip.current_stage_label || slip.current_stage)}
            </p>
          </CardContent>
        </Card>
        <Card className={`rounded-[22px] shadow-none ${meta.sectionBorder}`}>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Submitted</p>
            <p className="mt-2 text-sm font-semibold text-stone-900">{formatDate(slip.submitted_at)}</p>
          </CardContent>
        </Card>
        <Card className={`rounded-[22px] shadow-none ${meta.sectionBorder}`}>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Last Activity</p>
            <p className="mt-2 text-sm font-semibold text-stone-900">{formatDate(lastActionAt)}</p>
          </CardContent>
        </Card>
        <Card className={`rounded-[22px] shadow-none ${meta.sectionBorder}`}>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Files Attached</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{(slip.documents || []).length}</p>
          </CardContent>
        </Card>
      </section>

      <Card className={`rounded-[24px] shadow-none ${meta.sectionBorder}`}>
        <CardContent className="grid gap-3 p-5 md:grid-cols-3">
          <div className={`rounded-[20px] border px-4 py-4 ${meta.cardTint}`}>
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Slip Code</p>
            <p className="mt-2 font-mono text-sm font-semibold text-stone-900">{slip.slip_code || 'N/A'}</p>
            <p className="mt-2 text-xs text-stone-500">Use this code when cross-checking the printed slip, registry, and admin records.</p>
          </div>
          <div className={`rounded-[20px] border px-4 py-4 ${meta.cardTint}`}>
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Final Handling</p>
            <p className="mt-2 text-sm font-semibold text-stone-900">
              {slip.overall_status === 'completed'
                ? 'Endorsement complete'
                : 'Endorsement still in progress'}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Final scholar activation still depends on endorsement completion and admin requirements readiness.
            </p>
          </div>
          <div className={`rounded-[20px] border px-4 py-4 ${meta.cardTint}`}>
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">PDF Access</p>
            <p className="mt-2 text-sm font-semibold text-stone-900">
              {slip.final_pdf_url ? 'Stored final copy available' : 'Use generated PDF download'}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Admin and offices can download the latest slip copy directly from this page anytime.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className={`rounded-[24px] shadow-none ${meta.sectionBorder}`}>
          <CardHeader className="border-b border-stone-100">
            <div>
              <h2 className="text-base font-semibold text-stone-900">At a Glance</h2>
              <p className="text-sm text-stone-500">Core student and slip information first.</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
            <DetailItem label="Slip Code" value={slip.slip_code} mono />
            <DetailItem label="Application ID" value={slip.application_id} mono />
            <DetailItem label="PDM ID" value={slip.pdm_id} />
            <DetailItem label="Student" value={slip.student_name} />
            <DetailItem label="Opening" value={slip.opening_title} />
            <DetailItem label="Program" value={slip.program_name || 'N/A'} />
            <DetailItem label="Semester" value={slip.semester || 'N/A'} />
            <DetailItem label="School Year" value={slip.school_year || 'N/A'} />
            <DetailItem label="GWA" value={slip.grade_summary?.gwa ?? 'N/A'} />
            <DetailItem label="Stored Final PDF" value={slip.final_pdf_url ? 'Available' : 'Not stored'} />

            {slip.final_pdf_url ? (
              <div className="sm:col-span-2">
                <a href={slip.final_pdf_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="border-stone-200">
                    <Download className="mr-2 h-4 w-4" />
                    Open Stored Final PDF
                  </Button>
                </a>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className={`rounded-[24px] shadow-none ${meta.sectionBorder}`}>
          <CardHeader className="border-b border-stone-100">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Workflow Overview</h2>
              <p className="text-sm text-stone-500">Progress status and office-by-office outcome.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <EndorsementProgressTracker tracker={slip.tracker} />

            <div className="grid gap-3 md:grid-cols-3">
              <OfficeResultCard
                title="SDO"
                result={slip.office_results?.sdo}
                detailLines={
                  slip.sdo_offense_detail?.offense_type
                    ? [
                        `Offense Type: ${slip.sdo_offense_detail.offense_type}`,
                        `Date of Incident: ${slip.sdo_offense_detail.incident_date || 'N/A'}`,
                        `Case Note / Ref No.: ${slip.sdo_offense_detail.case_reference_number || 'N/A'}`,
                      ]
                    : []
                }
              />
              <OfficeResultCard
                title="Guidance"
                result={slip.office_results?.guidance}
                note="Guidance may clear, hold for counseling, or reject the endorsement."
              />
              <OfficeResultCard
                title="Program Director"
                result={slip.office_results?.pd}
                note="Final scholar activation still depends on endorsement and requirements readiness."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={`rounded-[24px] shadow-none ${meta.sectionBorder}`}>
        <CardHeader className="border-b border-stone-100">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Detailed Workflow History</h2>
            <p className="text-sm text-stone-500">Who acted, when they acted, and any remarks left on the slip.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {historyItems.length === 0 ? (
            <p className="text-sm text-stone-500">No office history recorded yet.</p>
          ) : (
            historyItems.map((stage) => (
              <div
                key={`${stage.key}-${stage.acted_at || stage.status}`}
                className="rounded-[22px] border border-stone-200 bg-white p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <StageIcon status={stage.status} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{stage.label}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {stage.acted_by_name || 'No recorded staff yet'}
                        {stage.acted_at ? ` • ${formatDate(stage.acted_at)}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge className={STAGE_META[stage.status] || 'bg-stone-100 text-stone-700'}>
                    {formatStageBadgeLabel(stage.result_label || stage.status)}
                  </Badge>
                </div>

                {stage.remarks ? (
                  <p className="mt-3 rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
                    {stage.remarks}
                  </p>
                ) : null}

                {stage.key === 'sdo' && slip.sdo_offense_detail?.offense_type ? (
                  <div className="mt-3 grid gap-2 text-xs text-stone-600 md:grid-cols-3">
                    <p>Offense: {slip.sdo_offense_detail.offense_type}</p>
                    <p>Incident: {slip.sdo_offense_detail.incident_date || 'N/A'}</p>
                    <p>Reference: {slip.sdo_offense_detail.case_reference_number || 'N/A'}</p>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className={`rounded-[24px] shadow-none ${meta.sectionBorder}`}>
        <CardHeader className="border-b border-stone-100">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Application Files</h2>
            <p className="text-sm text-stone-500">Uploaded records connected to this application.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {(slip.documents || []).length === 0 ? (
            <p className="text-sm text-stone-500">No documents found.</p>
          ) : (
            slip.documents.map((document) => (
              <div
                key={document.document_id}
                className="flex flex-col gap-3 rounded-[20px] border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-stone-900">{document.document_type}</p>
                  <p className="mt-1 text-sm text-stone-500">{document.file_name || 'Unnamed file'}</p>
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
