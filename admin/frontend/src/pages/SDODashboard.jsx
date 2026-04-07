import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Users } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_BASE = 'http://localhost:5000/api';

function getSdoToken() {
  return localStorage.getItem('sdoToken');
}

function getDisciplinaryTone(level) {
  if (level === 'major') {
    return 'bg-red-50 text-red-700 border-red-200';
  }

  if (level === 'minor') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

export default function SDODashboard() {
  const [stats, setStats] = useState(null);
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError('');

        const headers = {
          Authorization: `Bearer ${getSdoToken()}`,
          'Content-Type': 'application/json',
        };

        const [statsRes, scholarsRes] = await Promise.all([
          fetch(`${API_BASE}/scholars/sdo/stats`, { headers }),
          fetch(`${API_BASE}/scholars`, { headers }),
        ]);

        const statsData = await statsRes.json();
        const scholarsData = await scholarsRes.json();

        if (!statsRes.ok) {
          throw new Error(statsData.message || 'Failed to load SDO analytics');
        }

        if (!scholarsRes.ok) {
          throw new Error(scholarsData.message || 'Failed to load scholars');
        }

        setStats(statsData);
        setScholars(Array.isArray(scholarsData) ? scholarsData : []);
      } catch (err) {
        setError(err.message || 'Failed to load SDO dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const highlightedScholars = useMemo(() => {
    return [...scholars]
      .filter((scholar) => scholar.sdu_level === 'minor' || scholar.sdu_level === 'major')
      .sort((a, b) => {
        const weight = { major: 2, minor: 1, none: 0 };
        return weight[b.sdu_level] - weight[a.sdu_level];
      })
      .slice(0, 6);
  }, [scholars]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-stone-500">Loading SDO analytics...</div>;
  }

  if (error) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  const cards = [
    {
      label: 'Total Scholars',
      value: Number(stats?.total || 0),
      icon: Users,
      tone: 'bg-stone-100 text-stone-800',
    },
    {
      label: 'Clear Record',
      value: Number(stats?.clear_count || 0),
      icon: CheckCircle2,
      tone: 'bg-emerald-100 text-emerald-800',
    },
    {
      label: 'Minor Offense',
      value: Number(stats?.minor_count || 0),
      icon: ShieldAlert,
      tone: 'bg-amber-100 text-amber-800',
    },
    {
      label: 'Major Offense',
      value: Number(stats?.major_count || 0),
      icon: AlertTriangle,
      tone: 'bg-red-100 text-red-800',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-stone-900">Dashboard Analytics</h2>
        <p className="mt-1 text-sm text-stone-500">
          Real-time disciplinary view of scholars with probation-linked records.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-3xl border-stone-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className={`rounded-2xl p-3 ${card.tone}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-stone-900">{card.value}</p>
              <p className="mt-1 text-sm text-stone-500">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl border-stone-200 shadow-none">
        <CardHeader>
          <h3 className="text-lg font-semibold text-stone-900">Priority Scholar Watchlist</h3>
          <p className="text-sm text-stone-500">Highest-risk disciplinary records requiring SDO attention.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {highlightedScholars.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
              No minor or major offense records are currently flagged.
            </div>
          ) : (
            highlightedScholars.map((scholar) => (
              <div
                key={scholar.scholar_id}
                className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-stone-900">{scholar.student_name}</p>
                  <p className="text-xs text-stone-500">
                    {scholar.student_number} • {scholar.program_name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getDisciplinaryTone(scholar.sdu_level)}>
                    {(scholar.sdu_level || 'clear').toUpperCase()}
                  </Badge>
                  <span className="text-xs text-stone-500">
                    {scholar.sdo_comment ? 'Latest comment available' : 'No comment yet'}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
