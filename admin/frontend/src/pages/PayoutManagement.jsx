import React, { useState, useMemo } from 'react';
import {
  Download, Plus, Check, X, Camera, Mail, Phone,
  ChevronLeft, ChevronRight, Eye, History, FileText,
  CreditCard, Banknote, Send, RefreshCw, AlertCircle,
  CheckCircle, Clock, Search
} from 'lucide-react';

// --- SHADCN UI COMPONENTS ---
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Palette ─────────────────────────────────────────────────
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
  purple: '#7c3aed',
  purpleSoft: '#FAF5FF',
  border: '#E5E7EB',
  muted: '#6B7280',
  text: '#111827',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  brownMid: '#7c4a2e',
};

// ─── Configs & Mock Data ─────────────────────────────────────
const BENEFACTOR_CONFIG = {
  'Kaizen': { payMode: 'check', contact: 'kaizen@corp.ph' },
  'Genmart': { payMode: 'check', contact: 'genmart@corp.ph' },
  'Food Crafters': { payMode: 'check', contact: 'fc@foodcrafters.ph' },
  'BC Packaging': { payMode: 'cash', contact: 'bcpkg@bcpackaging.ph' },
};

const INIT_PAYOUTS = [
  {
    id: 'PAY-2025-001',
    benefactor: 'Kaizen',
    payMode: 'check',
    ay: '2025-2026',
    sem: '1st',
    payDate: 'Oct 15, 2025',
    totalAmount: 480000,
    scholars: [
      { scholarId: 'S2023-001', name: 'Dela Cruz, Maria', program: 'BSIT', amount: 5000, received: true },
      { scholarId: 'S2023-002', name: 'Santos, Juan', program: 'BSTM', amount: 5000, received: true },
      { scholarId: 'S2023-003', name: 'Reyes, Ana', program: 'BSIT', amount: 5000, received: false },
    ],
    acknowledged: true,
    ackDate: 'Oct 16, 2025',
    ackChannel: 'email',
    hasProof: true,
    proofLabel: 'kaizen_payout_oct2025.jpg',
  },
];

const payModeStyle = {
  cash: { label: 'Cash', icon: Banknote, color: C.green, bg: C.greenSoft },
  check: { label: 'Check', icon: CreditCard, color: C.blue, bg: C.blueSoft },
};

const PAGE_SIZE = 5;

// ─── Sub-Components ───────────────────────────────────────────

function PayoutDetailPanel({ payout, onClose, onUpdate }) {
  const [local, setLocal] = useState({ ...payout });
  const pm = payModeStyle[local.payMode];
  const receivedCount = local.scholars.filter(s => s.received).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-stone-900/40" onClick={onClose}>
      <Card className="w-full max-w-2xl shadow-2xl border-none overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <div>
            <CardTitle className="text-sm font-bold text-stone-900">{local.benefactor} · {local.id}</CardTitle>
            <CardDescription className="text-xs">{local.sem} Sem · AY {local.ay}</CardDescription>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-200 rounded-full"><X className="w-4 h-4 text-stone-400" /></button>
        </div>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            {local.scholars.map(s => (
              <div key={s.scholarId} className="flex items-center justify-between px-4 py-3 rounded-xl border border-stone-100 bg-stone-50/50">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${s.received ? 'bg-green-600 border-green-600' : 'bg-white border-stone-200'}`}>
                    {s.received && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <p className="text-xs font-bold text-stone-700">{s.name}</p>
                </div>
                <span className="text-xs font-bold tabular-nums">₱{s.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
        <div className="p-4 bg-stone-50 border-t flex justify-between items-center px-6">
          <span className="text-sm font-bold">Total: ₱{local.scholars.reduce((acc, s) => acc + s.amount, 0).toLocaleString()}</span>
          <Button className="rounded-xl font-bold text-xs" style={{ background: C.brownMid }} onClick={onClose}>Close</Button>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function PayoutManagement() {
  const [tab, setTab] = useState('log');
  const [payouts, setPayouts] = useState(INIT_PAYOUTS);
  const [detail, setDetail] = useState(null);
  const [page, setPage] = useState(1);
  const [histSearch, setHistSearch] = useState('');

  const pageData = payouts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalDisbursed = payouts.reduce((acc, p) =>
    acc + p.scholars.filter(s => s.received).reduce((sum, s) => sum + s.amount, 0), 0);

  return (
    <div className="space-y-6 py-2 animate-in fade-in duration-500">
      {detail && <PayoutDetailPanel payout={detail} onClose={() => setDetail(null)} onUpdate={() => { }} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Payout Management</h1>
          <p className="text-sm font-medium text-stone-400 mt-1 uppercase tracking-widest">Disbursement Tracking · 2025–2026</p>
        </div>
        <Button className="rounded-xl shadow-md text-white border-none" style={{ background: C.brownMid }}>
          <Plus className="w-3 h-3 mr-2" /> Log Payout
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Disbursed', value: `₱${(totalDisbursed / 1000).toFixed(0)}K`, color: C.blueMid },
          { label: 'Payout Events', value: String(payouts.length), color: C.green },
          { label: 'Pending Ack.', value: String(payouts.filter(p => !p.acknowledged).length), color: C.orange },
          { label: 'Benefactors', value: '4', color: C.purple },
        ].map(s => (
          <Card key={s.label} className="border-stone-200 shadow-sm">
            <CardContent className="p-5">
              <p className="text-3xl font-bold tracking-tighter" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Container */}
      <Card className="border-stone-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-stone-100 bg-stone-50/50">
          {['log', 'history', 'renewal'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${tab === t ? 'text-blue-900 border-blue-900 bg-white' : 'text-stone-400 border-transparent hover:text-stone-600'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'log' && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-stone-50/80">
                <TableRow className="hover:bg-transparent border-stone-100">
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 px-6">Benefactor</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 text-center">Mode</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 text-center">Date</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 text-center">Receipts</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4 text-right px-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.map(p => {
                  const pm = payModeStyle[p.payMode];
                  const receivedCount = p.scholars.filter(s => s.received).length;
                  return (
                    <TableRow key={p.id} className="border-stone-100 hover:bg-amber-50/10 transition-colors">
                      <TableCell className="px-6 py-5">
                        <div className="font-bold text-stone-800 text-sm">{p.benefactor}</div>
                        <div className="text-[10px] font-mono text-stone-400 mt-1">{p.id}</div>
                      </TableCell>
                      <TableCell className="py-5 text-center">
                        <Badge variant="outline" className="border-none font-bold text-[9px] uppercase px-3 py-1" style={{ background: pm.bg, color: pm.color }}>{pm.label}</Badge>
                      </TableCell>
                      <TableCell className="py-5 text-center text-xs font-medium text-stone-500">{p.payDate}</TableCell>
                      <TableCell className="py-5 text-center">
                        <span className={`text-xs font-bold ${receivedCount === p.scholars.length ? 'text-green-600' : 'text-orange-600'}`}>
                          {receivedCount}/{p.scholars.length}
                        </span>
                      </TableCell>
                      <TableCell className="py-5 px-6 text-right">
                        <Button size="sm" variant="outline" onClick={() => setDetail(p)} className="h-8 rounded-lg font-bold text-[9px] uppercase border-stone-200">
                          <Eye className="w-3.5 h-3.5 mr-1.5" /> Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <footer className="pt-10 pb-6 border-t border-stone-100 text-center">
        <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">SMaRT PDM Integrated Finance Subsystem</p>
      </footer>
    </div>
  );
}