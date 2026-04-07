import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Users } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_BASE = 'http://localhost:5000/api';

// ─── Theme (matching Admin Dashboard) ───────────────────────────────────────
const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  brownLight: '#92500f',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  yellow: '#fbbf24',
  sand: '#fdf6ec',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  border: '#e8d5b7',
  muted: '#78716c',
  text: '#1c1917',
  bg: '#faf7f2',
};

function getSdoToken() {
  return localStorage.getItem('sdoToken');
}

function getDisciplinaryTone(level) {
  if (level === 'major') {
    return { bg: C.redSoft, color: C.red, border: '#fecaca' };
  }
  if (level === 'minor') {
    return { bg: C.amberSoft, color: C.amber, border: '#fed7aa' };
  }
  return { bg: C.greenSoft, color: C.green, border: '#bbf7d0' };
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
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-7 h-7 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">
          Loading SDO analytics...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-xl text-center" style={{ background: C.redSoft, border: `1px solid #fecaca` }}>
        <AlertTriangle className="w-7 h-7 mx-auto mb-3" style={{ color: C.red }} />
        <p className="text-sm font-semibold" style={{ color: C.red }}>Failed to load dashboard</p>
        <p className="text-xs mt-1" style={{ color: C.red }}>{error}</p>
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Scholars',
      value: Number(stats?.total || 0),
      icon: Users,
      accent: C.brown,
      soft: C.amberSoft,
    },
    {
      label: 'Clear Record',
      value: Number(stats?.clear_count || 0),
      icon: CheckCircle2,
      accent: C.green,
      soft: C.greenSoft,
    },
    {
      label: 'Minor Offense',
      value: Number(stats?.minor_count || 0),
      icon: ShieldAlert,
      accent: C.amber,
      soft: C.amberSoft,
    },
    {
      label: 'Major Offense',
      value: Number(stats?.major_count || 0),
      icon: AlertTriangle,
      accent: C.red,
      soft: C.redSoft,
    },
  ];

  return (
    <div className="space-y-6 py-2" style={{ background: C.bg }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Dashboard Analytics
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            Real-time disciplinary view of scholars with probation-linked records.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Card key={card.label} className="border-stone-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: card.soft }}
              >
                <card.icon className="w-4 h-4" style={{ color: card.accent }} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold" style={{ color: C.text }}>
                {card.value}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Priority Scholar Watchlist */}
      <Card className="border-stone-200 shadow-none overflow-hidden">
        <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-4 px-5">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: C.text }}>
              Priority Scholar Watchlist
            </h3>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>
              Highest-risk disciplinary records requiring SDO attention.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          {highlightedScholars.length === 0 ? (
            <div
              className="rounded-xl border border-dashed px-5 py-6 text-center"
              style={{ borderColor: C.border, background: '#fefce8' }}
            >
              <p className="text-sm" style={{ color: C.muted }}>
                No minor or major offense records are currently flagged.
              </p>
            </div>
          ) : (
            highlightedScholars.map((scholar) => {
              const tone = getDisciplinaryTone(scholar.sdu_level);
              return (
                <div
                  key={scholar.scholar_id}
                  className="flex flex-col gap-3 rounded-xl border bg-white p-4 md:flex-row md:items-center md:justify-between"
                  style={{ borderColor: C.border }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: C.text }}>
                      {scholar.student_name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                      {scholar.student_number} • {scholar.program_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium px-2.5 py-1 rounded-full border-none"
                      style={{ background: tone.bg, color: tone.color }}
                    >
                      {(scholar.sdu_level || 'clear').toUpperCase()}
                    </Badge>
                    <span className="text-xs" style={{ color: C.muted }}>
                      {scholar.sdo_comment ? 'Latest comment available' : 'No comment yet'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SDO PDM · Student Disciplinary Office Portal
        </p>
      </footer>
    </div>
  );
}