import { useState, useMemo } from 'react';
import {
  Download, Plus, Check, X, Camera,
  ChevronLeft, ChevronRight, Eye, FileText,
  CreditCard, Banknote, Send, RefreshCw, AlertCircle,
  CheckCircle, Clock,
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const C = {
  blue: '#1E3A8A', blueMid: '#2563EB', blueSoft: '#EFF6FF',
  green: '#16a34a', greenSoft: '#F0FDF4',
  orange: '#d97706', orangeSoft: '#FFF7ED',
  red: '#dc2626', redSoft: '#FEF2F2',
  purple: '#7c3aed', border: '#E5E7EB',
  muted: '#6B7280', text: '#111827', bg: '#F9FAFB', white: '#FFFFFF',
};

const BD = '1px solid ' + C.border;

const CARD = {
  background: C.white,
  border: BD,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const BENEFACTOR_CONFIG = {
  'Kaizen': { payMode: 'check', contact: 'kaizen@corp.ph' },
  'Genmart': { payMode: 'check', contact: 'genmart@corp.ph' },
  'Food Crafters': { payMode: 'check', contact: 'fc@foodcrafters.ph' },
  'BC Packaging': { payMode: 'cash', contact: 'bcpkg@bcpackaging.ph' },
};

const INIT_PAYOUTS = [
  {
    id: 'PAY-2025-001', benefactor: 'Kaizen', payMode: 'check', ay: '2025-2026', sem: '1st', payDate: 'Oct 15, 2025',
    totalAmount: 480000, scholars: [], acknowledged: true, ackDate: 'Oct 16, 2025', ackChannel: 'email', hasProof: true, proofLabel: 'proof.jpg', remarks: '...'
  }
];

const TABS = [
  { key: 'log', label: 'Disbursement Log' },
  { key: 'history', label: 'Scholar Payout History' },
  { key: 'renewal', label: 'Renewal Attachments' },
];

function PayoutDetailPanel({ payout, onClose, onUpdate }) {
  const [local, setLocal] = useState({ ...payout });
  const [showAckForm, setShowAckForm] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-stone-200 bg-stone-50 flex justify-between">
          <div><p className="font-bold">{local.benefactor} · {local.id}</p></div>
          <button onClick={onClose} className="p-1 bg-stone-200 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-stone-500">Payout details and checklist would render here.</p>
        </div>
      </div>
    </div>
  );
}

export default function PayoutManagement() {
  const [tab, setTab] = useState('log');
  const [payouts, setPayouts] = useState(INIT_PAYOUTS);
  const [detail, setDetail] = useState(null);

  return (
    <div className="space-y-5 py-1">
      {detail && <PayoutDetailPanel payout={detail} onClose={() => setDetail(null)} onUpdate={() => { }} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payout Management</h1>
        <button className="bg-blue-900 text-white px-4 py-2 rounded-xl text-xs font-bold">+ Log Payout</button>
      </div>

      <div style={CARD} className="overflow-hidden">
        <div className="flex border-b border-stone-200">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)} className={`px-5 py-3 text-xs font-semibold border-b-2 transition-all ${tab === key ? 'border-blue-900 text-blue-900' : 'border-transparent text-stone-400'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="p-6 bg-stone-50">
          {tab === 'log' && (
            <div className="bg-white border rounded-xl p-8 text-center text-stone-400 text-sm">Disbursement records view</div>
          )}
        </div>
      </div>
    </div>
  );
}