import { useState } from 'react';
import { Button } from "../components/ui/button"
import {
  Users, GraduationCap, TrendingUp, TrendingDown,
  Download, AlertCircle, Award,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  brownLight: '#92500f',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  yellow: '#fbbf24',
  yellowSoft: '#fef3c7',
  sand: '#fdf6ec',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  border: '#e8d5b7',
  muted: '#a0785a',
  text: '#3b1f0a',
  bg: '#faf7f2',
  white: '#FFFFFF',
};

const BD = '1px solid ' + C.border;
const BD2 = '2px solid ' + C.border;

const CARD = {
  background: C.white,
  border: BD,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(107,58,31,0.07)',
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: C.white,
    border: BD,
    borderRadius: 10,
    fontSize: 12,
    color: C.text,
    boxShadow: '0 4px 12px rgba(107,58,31,0.10)',
  },
};

const AXIS_PROPS = {
  tick: { fontSize: 11, fill: C.muted },
  axisLine: false,
  tickLine: false,
};

const TABS = [
  { key: 'uaqtea', label: 'UAQTEA' },
  { key: 'tdp', label: 'TDP' },
  { key: 'fhe', label: 'FHE' },
];

function CardHeader({ title, sub }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-bold" style={{ color: C.text }}>{title}</h2>
      {sub && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>}
    </div>
  );
}

function ChartGrid() {
  return <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('uaqtea');

  return (
    <div className="space-y-6 py-1" style={{ color: C.text, background: C.bg }}>
      <h1 className="text-2xl font-bold">Dashboard</h1>
    </div>
  );
}