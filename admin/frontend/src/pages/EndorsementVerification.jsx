import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { buildApiUrl } from '@/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

export default function EndorsementVerification() {
  const { token } = useParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadVerification = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(buildApiUrl(`/api/endorsement-slips/verify/${token}`));
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to verify slip');
        }

        setPayload(data);
      } catch (err) {
        setError(err.message || 'Failed to verify slip.');
      } finally {
        setLoading(false);
      }
    };

    loadVerification();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-stone-400" />
          <p className="mt-3 text-sm text-stone-500">Verifying endorsement slip...</p>
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
        <Card className="w-full max-w-xl border-red-100 bg-red-50 shadow-none">
          <CardContent className="p-8 text-center">
            <XCircle className="mx-auto h-8 w-8 text-red-400" />
            <p className="mt-3 text-lg font-semibold text-red-800">Verification failed</p>
            <p className="mt-1 text-sm text-red-600">{error || 'Token not found.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
      <Card className="w-full max-w-2xl border-stone-200 bg-white shadow-none">
        <CardContent className="space-y-5 p-8">
          <div className="text-center">
            {payload.verified ? (
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
            ) : (
              <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
            )}
            <p className="mt-3 text-2xl font-semibold text-stone-900">
              {payload.verified ? 'Verified Endorsement Slip' : 'Endorsement Record Found'}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              This page confirms the digital authenticity of the endorsement workflow record.
            </p>
          </div>

          <div className="grid gap-4 rounded-2xl border border-stone-200 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Student</p>
              <p className="font-medium text-stone-900">{payload.student_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">PDM ID</p>
              <p className="font-medium text-stone-900">{payload.pdm_id}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Slip Code</p>
              <p className="font-medium text-stone-900">{payload.slip_code || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Program</p>
              <p className="font-medium text-stone-900">{payload.program_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Semester</p>
              <p className="font-medium text-stone-900">{payload.semester || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">School Year</p>
              <p className="font-medium text-stone-900">{payload.school_year || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Status</p>
              <Badge className={payload.verified ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}>
                {payload.overall_status_label}
              </Badge>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-stone-500">Completed</p>
              <p className="font-medium text-stone-900">{formatDate(payload.completed_at)}</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              ['PD Endorsement', payload.stages?.pd],
              ['Guidance Clearance', payload.stages?.guidance],
              ['SDO Clearance', payload.stages?.sdo],
            ].map(([label, stage]) => (
              <div key={label} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-stone-900">{label}</p>
                  <Badge className="bg-stone-100 text-stone-700">
                    {stage?.result_label || stage?.decision || 'pending'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-stone-500">{formatDate(stage?.acted_at)}</p>
                {stage?.remarks ? (
                  <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                    {stage.remarks}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
