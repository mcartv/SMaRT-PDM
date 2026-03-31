import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Button } from "../components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Search, Download, Eye, ChevronLeft, ChevronRight,
  AlertTriangle, History, Shield, SlidersHorizontal, X, Plus,
} from 'lucide-react';

const C = {
  blue: '#1E3A8A',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  orange: '#d97706',
  orangeSoft: '#FFF7ED',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  border: '#E5E7EB',
  muted: '#6B7280',
  text: '#111827',
  bg: '#F9FAFB',
  white: '#FFFFFF',
};

const INIT_SCHOLARS = [
  { id: 'S2023-001', name: 'Dela Cruz, Maria', program: 'BS Computer Science', scholarship: 'TES', gwa: 1.45, status: 'Active', roPct: 100, roStatus: 'complete', sduLevel: 'none' },
];

export default function ScholarMonitoring() {
  const [scholars, setScholars] = useState(INIT_SCHOLARS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scholars.filter(s => !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [scholars, search]);

  return (
    <div className="space-y-5 py-1">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scholars</h1>
        <Button className="bg-stone-800 text-white font-bold rounded-xl h-9">
          <Download className="w-3.5 h-3.5 mr-2" /> Export
        </Button>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Search name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 border-stone-200 bg-stone-50 rounded-xl" />
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-200 text-[11px] uppercase font-bold text-stone-500">
            <tr>
              <th className="px-4 py-3">Scholar ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">GWA</th>
              <th className="px-4 py-3 text-right pr-5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-4 py-3.5 text-xs font-mono text-stone-500">{s.id}</td>
                <td className="px-4 py-3.5 text-sm font-semibold">{s.name}</td>
                <td className="px-4 py-3.5 text-xs text-stone-500">{s.program}</td>
                <td className="px-4 py-3.5 text-sm font-bold text-green-600">{s.gwa.toFixed(2)}</td>
                <td className="px-4 py-3.5 text-right pr-5">
                  <button className="p-1.5 border border-stone-200 rounded-lg hover:bg-stone-100"><Eye className="w-4 h-4 text-stone-500" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}