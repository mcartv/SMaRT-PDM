import { useState, useMemo } from 'react';
import {
  Download, Plus, Check, X, Camera, Mail, Phone,
  ChevronLeft, ChevronRight, Eye, History, FileText,
  CreditCard, Banknote, Send, RefreshCw, AlertCircle,
  CheckCircle, Clock,
} from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// ─── Palette ─────────────────────────────────────────────────
const C = {
  blue:       '#1E3A8A',
  blueMid:    '#2563EB',
  blueSoft:   '#EFF6FF',
  green:      '#16a34a',
  greenSoft:  '#F0FDF4',
  orange:     '#d97706',
  orangeSoft: '#FFF7ED',
  red:        '#dc2626',
  redSoft:    '#FEF2F2',
  purple:     '#7c3aed',
  purpleSoft: '#FAF5FF',
  border:     '#E5E7EB',
  muted:      '#6B7280',
  text:       '#111827',
  bg:         '#F9FAFB',
  white:      '#FFFFFF',
} as const;

const BD = '1px solid ' + C.border;

const CARD: React.CSSProperties = {
  background:   C.white,
  border:       BD,
  borderRadius: 16,
  boxShadow:    '0 1px 3px rgba(0,0,0,0.06)',
};

// ─── Types ───────────────────────────────────────────────────
type PayMode = 'cash' | 'check';
type AckChannel = 'email' | 'messenger' | 'in-person' | 'phone';

type ScholarPayout = {
  scholarId:   string;
  name:        string;
  program:     string;
  amount:      number;
  received:    boolean;
};

type PayoutEvent = {
  id:           string;
  benefactor:   string;
  payMode:      PayMode;
  ay:           string;
  sem:          string;
  payDate:      string;
  totalAmount:  number;
  scholars:     ScholarPayout[];
  acknowledged: boolean;
  ackDate:      string;
  ackChannel:   AckChannel | '';
  hasProof:     boolean;
  proofLabel:   string;
  remarks:      string;
};

// ─── Benefactor payment mode config (Feature 12) ─────────────
const BENEFACTOR_CONFIG: Record<string, { payMode: PayMode; contact: string }> = {
  'Kaizen':         { payMode: 'check', contact: 'kaizen@corp.ph'      },
  'Genmart':        { payMode: 'check', contact: 'genmart@corp.ph'      },
  'Food Crafters':  { payMode: 'check', contact: 'fc@foodcrafters.ph'   },
  'BC Packaging':   { payMode: 'cash',  contact: 'bcpkg@bcpackaging.ph' },
};

const BENEFACTORS = Object.keys(BENEFACTOR_CONFIG);

// ─── Mock payout data ─────────────────────────────────────────
const INIT_PAYOUTS: PayoutEvent[] = [
  {
    id: 'PAY-2025-001',
    benefactor:   'Kaizen',
    payMode:      'check',
    ay:           '2025-2026',
    sem:          '1st',
    payDate:      'Oct 15, 2025',
    totalAmount:  480000,
    scholars: [
      { scholarId: 'S2023-001', name: 'Dela Cruz, Maria',   program: 'BSIT', amount: 5000, received: true  },
      { scholarId: 'S2023-002', name: 'Santos, Juan',        program: 'BSTM', amount: 5000, received: true  },
      { scholarId: 'S2023-003', name: 'Reyes, Ana',          program: 'BSIT', amount: 5000, received: false },
    ],
    acknowledged: true,
    ackDate:      'Oct 16, 2025',
    ackChannel:   'email',
    hasProof:     true,
    proofLabel:   'kaizen_payout_oct2025.jpg',
    remarks:      'Check received from Kaizen. Converted to cash for distribution.',
  },
  {
    id: 'PAY-2025-002',
    benefactor:   'BC Packaging',
    payMode:      'cash',
    ay:           '2025-2026',
    sem:          '1st',
    payDate:      'Oct 18, 2025',
    totalAmount:  17500,
    scholars: [
      { scholarId: 'S2023-004', name: 'Garcia, Pedro',  program: 'BECED', amount: 3500, received: true },
      { scholarId: 'S2023-005', name: 'Lopez, Rosa',    program: 'BTLED', amount: 3500, received: true },
    ],
    acknowledged: true,
    ackDate:      'Oct 18, 2025',
    ackChannel:   'in-person',
    hasProof:     true,
    proofLabel:   'bcpkg_payout_oct2025.jpg',
    remarks:      'Cash delivered directly to office by BC Packaging representative.',
  },
  {
    id: 'PAY-2025-003',
    benefactor:   'Genmart',
    payMode:      'check',
    ay:           '2025-2026',
    sem:          '1st',
    payDate:      'Oct 22, 2025',
    totalAmount:  67500,
    scholars: [
      { scholarId: 'S2023-006', name: 'Martinez, Carlos', program: 'BSIT', amount: 4500, received: false },
      { scholarId: 'S2023-007', name: 'Fernandez, Lisa',  program: 'BSHM', amount: 4500, received: true  },
    ],
    acknowledged: false,
    ackDate:      '',
    ackChannel:   '',
    hasProof:     false,
    proofLabel:   '',
    remarks:      '',
  },
];

// Scholar payout history (Feature 15)
const SCHOLAR_HISTORY: Record<string, { ay: string; sem: string; benefactor: string; amount: number; payDate: string }[]> = {
  'S2023-001': [
    { ay: '2024-2025', sem: '2nd', benefactor: 'Kaizen', amount: 5000, payDate: 'Mar 10, 2025' },
    { ay: '2024-2025', sem: '1st', benefactor: 'Kaizen', amount: 5000, payDate: 'Oct 12, 2024' },
    { ay: '2025-2026', sem: '1st', benefactor: 'Kaizen', amount: 5000, payDate: 'Oct 15, 2025' },
  ],
  'S2023-002': [
    { ay: '2024-2025', sem: '2nd', benefactor: 'Kaizen', amount: 5000, payDate: 'Mar 10, 2025' },
    { ay: '2025-2026', sem: '1st', benefactor: 'Kaizen', amount: 5000, payDate: 'Oct 15, 2025' },
  ],
};

const TABS = [
  { key: 'log',     label: 'Disbursement Log'    },
  { key: 'history', label: 'Scholar Payout History' },
  { key: 'renewal', label: 'Renewal Attachments'  },
] as const;
type TabKey = typeof TABS[number]['key'];

const PAGE_SIZE = 5;

// ─── Helpers ─────────────────────────────────────────────────
const payModeStyle: Record<PayMode, { label: string; icon: React.FC<any>; color: string; bg: string }> = {
  cash:  { label: 'Cash',  icon: Banknote,    color: C.green,  bg: C.greenSoft  },
  check: { label: 'Check', icon: CreditCard,  color: C.blue,   bg: C.blueSoft   },
};

const ackChannelLabel: Record<AckChannel, string> = {
  email:     'Email',
  messenger: 'Messenger',
  'in-person': 'In-Person',
  phone:     'Phone',
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
      {children}
    </label>
  );
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ background: bg, color }}>
      {label}
    </span>
  );
}

// ─── Payout Detail Panel ─────────────────────────────────────
function PayoutDetailPanel({ payout, onClose, onUpdate }: {
  payout: PayoutEvent;
  onClose: () => void;
  onUpdate: (updated: PayoutEvent) => void;
}) {
  const [local, setLocal] = useState({ ...payout });
  const [showAckForm, setShowAckForm] = useState(false);
  const [ackDate,    setAckDate]    = useState(local.ackDate);
  const [ackChannel, setAckChannel] = useState<AckChannel | ''>(local.ackChannel);

  const pm = payModeStyle[local.payMode];

  function toggleReceived(scholarId: string) {
    setLocal(p => ({
      ...p,
      scholars: p.scholars.map(s => s.scholarId === scholarId ? { ...s, received: !s.received } : s),
    }));
  }

  function saveAck() {
    const updated = { ...local, acknowledged: true, ackDate, ackChannel };
    setLocal(updated);
    onUpdate(updated);
    setShowAckForm(false);
  }

  function markProof() {
    const updated = { ...local, hasProof: true, proofLabel: local.benefactor.toLowerCase().replace(' ', '_') + '_proof_' + Date.now() + '.jpg' };
    setLocal(updated);
    onUpdate(updated);
  }

  const receivedCount = local.scholars.filter(s => s.received).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl overflow-hidden"
        style={{ background: C.white, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: BD, background: C.bg }}>
          <div>
            <p className="text-sm font-bold" style={{ color: C.text }}>{local.benefactor} · {local.id}</p>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>{local.sem} Sem · AY {local.ay} · Paid {local.payDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: pm.bg, color: pm.color }}>
              <pm.icon className="w-3 h-3" />{pm.label}
            </span>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg"
              style={{ background: C.border }}>
              <X className="w-4 h-4" style={{ color: C.muted }} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

          {/* Scholar receipt checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold" style={{ color: C.text }}>Scholar Receipt Checklist</p>
              <span className="text-[11px] font-semibold" style={{ color: receivedCount === local.scholars.length ? C.green : C.orange }}>
                {receivedCount}/{local.scholars.length} received
              </span>
            </div>
            <div className="space-y-2">
              {local.scholars.map(s => (
                <div key={s.scholarId}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border"
                  style={{ background: s.received ? C.greenSoft : C.white, borderColor: s.received ? '#bbf7d0' : C.border }}>
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => toggleReceived(s.scholarId)}
                      className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                      style={{ background: s.received ? C.green : C.white, borderColor: s.received ? C.green : C.border }}>
                      {s.received && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: C.text }}>{s.name}</p>
                      <p className="text-[11px]" style={{ color: C.muted }}>{s.scholarId} · {s.program}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold tabular-nums" style={{ color: s.received ? C.green : C.muted }}>
                    ₱{s.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Acknowledgement tracker (Feature 13) */}
          <div style={{ borderTop: BD, paddingTop: 16 }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold" style={{ color: C.text }}>Benefactor Acknowledgement</p>
              {local.acknowledged && (
                <Pill label={'Acknowledged · ' + local.ackDate} color={C.green} bg={C.greenSoft} />
              )}
            </div>
            {local.acknowledged ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: C.greenSoft }}>
                <CheckCircle className="w-4 h-4 shrink-0" style={{ color: C.green }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: C.green }}>Receipt acknowledged</p>
                  <p className="text-[11px]" style={{ color: C.green }}>
                    Sent via {local.ackChannel ? ackChannelLabel[local.ackChannel as AckChannel] : '—'} · {local.ackDate}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <button onClick={() => setShowAckForm(v => !v)}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold border transition-colors"
                  style={{ borderColor: C.border, color: C.blue, background: C.white }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.blueSoft)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
                  <Send className="w-3.5 h-3.5" /> Mark as Acknowledged
                </button>
                {showAckForm && (
                  <div className="mt-3 p-3 rounded-xl space-y-3" style={{ background: C.bg, border: BD }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Date Sent</FieldLabel>
                        <Input type="date" className="h-9 text-sm rounded-xl bg-white border-gray-200"
                          value={ackDate} onChange={e => setAckDate(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Channel</FieldLabel>
                        <Select value={ackChannel} onValueChange={v => setAckChannel(v as AckChannel)}>
                          <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-white">
                            <SelectValue placeholder="Select channel" />
                          </SelectTrigger>
                          <SelectContent>
                            {(['email', 'messenger', 'in-person', 'phone'] as AckChannel[]).map(ch => (
                              <SelectItem key={ch} value={ch}>{ackChannelLabel[ch]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <button onClick={saveAck} disabled={!ackDate || !ackChannel}
                      className="px-4 h-8 rounded-xl text-xs font-bold text-white disabled:opacity-40"
                      style={{ background: C.green }}>
                      Confirm Acknowledgement
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Proof of receipt (Feature 14) */}
          <div style={{ borderTop: BD, paddingTop: 16 }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold" style={{ color: C.text }}>Proof of Receipt / Payout Photo</p>
              {local.hasProof && (
                <Pill label="Photo attached" color={C.green} bg={C.greenSoft} />
              )}
            </div>
            {local.hasProof ? (
              <div className="flex items-center gap-3">
                {/* Simulated photo thumbnail */}
                <div className="rounded-xl overflow-hidden shrink-0"
                  style={{ width: 72, height: 54, background: C.bg, border: BD, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'repeating-linear-gradient(45deg, #e5e7eb 0px, #e5e7eb 2px, transparent 2px, transparent 10px)',
                    opacity: 0.5,
                  }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Camera className="w-5 h-5" style={{ color: C.muted }} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: C.text }}>{local.proofLabel}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>Payout photo · attached to record</p>
                </div>
              </div>
            ) : (
              <button onClick={markProof}
                className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold border transition-colors w-full justify-center"
                style={{ borderColor: C.border, color: C.muted, background: C.bg, borderStyle: 'dashed' }}
                onMouseEnter={e => (e.currentTarget.style.background = C.white)}
                onMouseLeave={e => (e.currentTarget.style.background = C.bg)}>
                <Camera className="w-3.5 h-3.5" /> Upload Payout Photo
              </button>
            )}
          </div>

          {/* Remarks */}
          {local.remarks && (
            <div style={{ borderTop: BD, paddingTop: 16 }}>
              <p className="text-xs font-bold mb-1" style={{ color: C.text }}>Remarks</p>
              <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{local.remarks}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 shrink-0 flex justify-between items-center" style={{ borderTop: BD }}>
          <p className="text-xs font-bold" style={{ color: C.text }}>
            Total: ₱{local.scholars.reduce((s, sc) => s + sc.amount, 0).toLocaleString()}
          </p>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold border"
              style={{ borderColor: C.border, color: C.muted, background: C.white }}>
              <Download className="w-3.5 h-3.5" /> Payroll Report
            </button>
            <button onClick={() => { onUpdate(local); onClose(); }}
              className="px-4 h-8 rounded-xl text-xs font-bold text-white"
              style={{ background: C.blue }}>
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Payout Form ─────────────────────────────────────────
function AddPayoutForm({ onSave, onClose }: {
  onSave: (p: PayoutEvent) => void; onClose: () => void;
}) {
  const [benefactor, setBenefactor] = useState('');
  const [payDate,    setPayDate]    = useState('');
  const [ay,         setAy]         = useState('2025-2026');
  const [sem,        setSem]        = useState('1st');
  const [remarks,    setRemarks]    = useState('');

  const config = benefactor ? BENEFACTOR_CONFIG[benefactor] : null;

  function handleSave() {
    if (!benefactor || !payDate) return;
    const evt: PayoutEvent = {
      id:           'PAY-' + Date.now(),
      benefactor,
      payMode:      config?.payMode ?? 'cash',
      ay, sem,
      payDate,
      totalAmount:  0,
      scholars:     [],
      acknowledged: false,
      ackDate:      '',
      ackChannel:   '',
      hasProof:     false,
      proofLabel:   '',
      remarks,
    };
    onSave(evt);
    onClose();
  }

  return (
    <div style={CARD} className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.blue }}>New Payout Event</p>
        <button onClick={onClose}><X className="w-4 h-4" style={{ color: C.muted }} /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Benefactor</FieldLabel>
          <Select value={benefactor} onValueChange={setBenefactor}>
            <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
              <SelectValue placeholder="Select benefactor" />
            </SelectTrigger>
            <SelectContent>
              {BENEFACTORS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Feature 12 — auto-show payment mode */}
          {config && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {config.payMode === 'cash'
                ? <Banknote className="w-3 h-3" style={{ color: C.green }} />
                : <CreditCard className="w-3 h-3" style={{ color: C.blue }} />}
              <span className="text-[11px] font-semibold"
                style={{ color: config.payMode === 'cash' ? C.green : C.blue }}>
                {config.payMode === 'cash' ? 'Cash payment' : 'Check payment'} · {config.contact}
              </span>
            </div>
          )}
        </div>
        <div>
          <FieldLabel>Payout Date</FieldLabel>
          <Input type="date" className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50"
            value={payDate} onChange={e => setPayDate(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Academic Year</FieldLabel>
          <Select value={ay} onValueChange={setAy}>
            <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['2025-2026', '2024-2025', '2023-2024'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel>Semester</FieldLabel>
          <div className="flex gap-2">
            {['1st', '2nd', 'Summer'].map(s => (
              <button key={s} onClick={() => setSem(s)}
                className="flex-1 py-2 rounded-xl border text-xs font-semibold transition-all"
                style={{ background: sem === s ? C.blue : C.white, color: sem === s ? C.white : C.muted, borderColor: sem === s ? C.blue : C.border }}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <FieldLabel>Remarks</FieldLabel>
          <Input className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50"
            placeholder="e.g. Check received from benefactor, converted to cash for distribution…"
            value={remarks} onChange={e => setRemarks(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2" style={{ borderTop: BD }}>
        <button onClick={onClose} className="px-4 h-9 rounded-xl text-xs font-semibold border"
          style={{ borderColor: C.border, color: C.muted, background: C.white }}>Cancel</button>
        <button onClick={handleSave} disabled={!benefactor || !payDate}
          className="px-4 h-9 rounded-xl text-xs font-bold text-white disabled:opacity-40"
          style={{ background: C.blue }}>
          Create Payout Event
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function PayoutManagement() {
  const [tab,      setTab]      = useState<TabKey>('log');
  const [payouts,  setPayouts]  = useState<PayoutEvent[]>(INIT_PAYOUTS);
  const [detail,   setDetail]   = useState<PayoutEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [page,     setPage]     = useState(1);
  const [filterAY, setFilterAY] = useState('All');
  const [filterB,  setFilterB]  = useState('All');

  // Scholar history state
  const [histSearch,  setHistSearch]  = useState('');
  const [histScholar, setHistScholar] = useState<string | null>(null);

  function updatePayout(updated: PayoutEvent) {
    setPayouts(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (detail?.id === updated.id) setDetail(updated);
  }

  const filtered = useMemo(() => payouts.filter(p => {
    const matchAY = filterAY === 'All' || p.ay === filterAY;
    const matchB  = filterB  === 'All' || p.benefactor === filterB;
    return matchAY && matchB;
  }), [payouts, filterAY, filterB]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalDisbursed = payouts.reduce((s, p) => s + p.scholars.filter(sc => sc.received).reduce((a, sc) => a + sc.amount, 0), 0);
  const pendingAck     = payouts.filter(p => !p.acknowledged).length;

  return (
    <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* Detail modal */}
      {detail && (
        <PayoutDetailPanel
          payout={detail}
          onClose={() => setDetail(null)}
          onUpdate={updatePayout}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>Financial Assistance & Payout</h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>Track disbursements, acknowledgements, and payout history</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold border"
            style={{ borderColor: C.border, color: C.muted, background: C.white }}>
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold text-white"
            style={{ background: C.blue }}>
            <Plus className="w-3.5 h-3.5" /> Log Payout
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Disbursed',      value: '₱' + (totalDisbursed / 1000).toFixed(0) + 'K',  color: C.blue   },
          { label: 'Payout Events',        value: String(payouts.length),                           color: C.green  },
          { label: 'Pending Ack.',         value: String(pendingAck),                               color: C.orange },
          { label: 'Scholars Paid (AY)',   value: String(new Set(payouts.flatMap(p => p.scholars.filter(s => s.received).map(s => s.scholarId))).size), color: C.purple },
        ].map(s => (
          <div key={s.label} style={CARD} className="p-5">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-medium mt-1" style={{ color: C.muted }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && <AddPayoutForm onSave={p => { setPayouts(prev => [p, ...prev]); }} onClose={() => setShowForm(false)} />}

      {/* Benefactor payment mode quick-ref (Feature 12) */}
      <div style={CARD} className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: C.muted }}>
          Payment Mode per Benefactor
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(BENEFACTOR_CONFIG).map(([name, cfg]) => {
            const pm = payModeStyle[cfg.payMode];
            return (
              <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                style={{ background: pm.bg, borderColor: pm.color + '44' }}>
                <pm.icon className="w-3.5 h-3.5" style={{ color: pm.color }} />
                <span className="text-xs font-bold" style={{ color: pm.color }}>{name}</span>
                <span className="text-[11px] font-semibold" style={{ color: pm.color }}>· {pm.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ ...CARD, overflow: 'hidden' }}>
        <div className="flex" style={{ borderBottom: BD }}>
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className="px-5 py-3.5 text-xs font-semibold border-b-2 transition-all"
              style={{
                borderBottomColor: tab === key ? C.blue : 'transparent',
                color:             tab === key ? C.blue : C.muted,
                background:        'transparent',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Disbursement Log tab ── */}
        {tab === 'log' && (
          <>
            {/* Filters */}
            <div className="px-5 py-3 flex flex-wrap gap-3 items-center" style={{ borderBottom: BD }}>
              <Select value={filterB} onValueChange={v => { setFilterB(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[160px] text-xs rounded-xl border-gray-200 bg-gray-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Benefactors</SelectItem>
                  {BENEFACTORS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterAY} onValueChange={v => { setFilterAY(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[140px] text-xs rounded-xl border-gray-200 bg-gray-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['All', '2025-2026', '2024-2025'].map(y => <SelectItem key={y} value={y}>{y === 'All' ? 'All AY' : y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: C.bg, borderBottom: BD }}>
                    {['ID', 'Benefactor', 'Mode', 'Semester', 'Date', 'Scholars', 'Acknowledged', 'Proof', ''].map((h, i) => (
                      <th key={i}
                        className={'px-4 py-3 text-[11px] font-bold uppercase tracking-wider ' + (i === 8 ? 'text-right pr-5' : 'text-left')}
                        style={{ color: C.muted }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageData.length === 0 ? (
                    <tr><td colSpan={9} className="px-5 py-10 text-center text-sm" style={{ color: C.muted }}>
                      No payout records found.
                    </td></tr>
                  ) : pageData.map((p, i) => {
                    const pm = payModeStyle[p.payMode];
                    const receivedCount = p.scholars.filter(s => s.received).length;
                    return (
                      <tr key={p.id}
                        style={{ borderBottom: BD, background: i % 2 === 0 ? C.white : C.bg, transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f9ff'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? C.white : C.bg}>
                        <td className="px-4 py-3.5 text-xs font-mono" style={{ color: C.muted }}>{p.id}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: C.text }}>{p.benefactor}</td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg"
                            style={{ background: pm.bg, color: pm.color }}>
                            <pm.icon className="w-3 h-3" />{pm.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs" style={{ color: C.muted }}>{p.sem} Sem · {p.ay}</td>
                        <td className="px-4 py-3.5 text-xs" style={{ color: C.muted }}>{p.payDate}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-semibold" style={{ color: receivedCount === p.scholars.length ? C.green : C.orange }}>
                            {receivedCount}/{p.scholars.length}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {p.acknowledged
                            ? <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: C.greenSoft, color: C.green }}>
                                <Check className="w-3 h-3" /> Sent
                              </span>
                            : <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: C.orangeSoft, color: C.orange }}>
                                <Clock className="w-3 h-3" /> Pending
                              </span>}
                        </td>
                        <td className="px-4 py-3.5">
                          {p.hasProof
                            ? <Camera className="w-4 h-4" style={{ color: C.green }} />
                            : <Camera className="w-4 h-4 opacity-30" style={{ color: C.muted }} />}
                        </td>
                        <td className="px-4 py-3.5 pr-5 text-right">
                          <button onClick={() => setDetail(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                            style={{ borderColor: C.border, color: C.blue, background: C.white }}
                            onMouseEnter={e => (e.currentTarget.style.background = C.blueSoft)}
                            onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: BD }}>
              <p className="text-xs" style={{ color: C.muted }}>
                Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-40"
                  style={{ borderColor: C.border, background: C.white }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
                  <ChevronLeft className="w-4 h-4" style={{ color: C.muted }} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setPage(n)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold border"
                    style={{ background: page === n ? C.blue : C.white, color: page === n ? C.white : C.muted, borderColor: page === n ? C.blue : C.border }}>
                    {n}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-40"
                  style={{ borderColor: C.border, background: C.white }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
                  <ChevronRight className="w-4 h-4" style={{ color: C.muted }} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Scholar Payout History tab (Feature 15) ── */}
        {tab === 'history' && (
          <div className="p-5 space-y-4">
            <p className="text-xs" style={{ color: C.muted }}>
              View the full payout history for individual scholars across all semesters.
            </p>
            <div className="relative">
              <Input
                placeholder="Enter Scholar ID (e.g. S2023-001)…"
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50"
              />
            </div>
            {/* Quick lookup buttons */}
            <div className="flex flex-wrap gap-2">
              {Object.keys(SCHOLAR_HISTORY).map(id => (
                <button key={id} onClick={() => { setHistScholar(id); setHistSearch(id); }}
                  className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all"
                  style={{
                    background:  histScholar === id ? C.blueSoft : C.white,
                    borderColor: histScholar === id ? C.blue     : C.border,
                    color:       histScholar === id ? C.blue     : C.muted,
                  }}>
                  {id}
                </button>
              ))}
            </div>

            {/* History records */}
            {histScholar && SCHOLAR_HISTORY[histScholar] && (
              <div>
                <p className="text-xs font-bold mb-3" style={{ color: C.text }}>
                  Payout history for {histScholar}
                </p>
                <div className="relative pl-5 space-y-3">
                  <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: C.border }} />
                  {[...SCHOLAR_HISTORY[histScholar]].reverse().map((h, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-3.5 top-2 w-3 h-3 rounded-full border-2"
                        style={{ background: i === 0 ? C.blueSoft : C.bg, borderColor: i === 0 ? C.blue : C.border }} />
                      <div className="px-3 py-3 rounded-xl" style={{ background: i === 0 ? C.blueSoft : C.bg, border: BD }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold" style={{ color: i === 0 ? C.blue : C.text }}>
                            {h.sem} Sem · AY {h.ay}
                          </span>
                          <span className="text-sm font-bold tabular-nums" style={{ color: i === 0 ? C.blue : C.green }}>
                            ₱{h.amount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px]" style={{ color: C.muted }}>
                          {h.benefactor} · Paid {h.payDate}
                        </p>
                        {i === 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-1 inline-block"
                            style={{ background: C.blue, color: C.white }}>Latest</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 px-4 py-3 rounded-xl flex items-center justify-between"
                  style={{ background: C.greenSoft, border: '1px solid #bbf7d0' }}>
                  <span className="text-xs font-semibold" style={{ color: C.green }}>
                    Total received by scholar
                  </span>
                  <span className="text-base font-bold" style={{ color: C.green }}>
                    ₱{SCHOLAR_HISTORY[histScholar].reduce((s, h) => s + h.amount, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Renewal Attachments tab (Feature 16) ── */}
        {tab === 'renewal' && (
          <div className="p-5 space-y-4">
            <div className="px-4 py-3 rounded-xl flex items-start gap-3"
              style={{ background: C.blueSoft, border: '1px solid #bfdbfe' }}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.blue }} />
              <p className="text-xs leading-relaxed" style={{ color: C.blue }}>
                During scholarship renewal, the system automatically attaches the scholar's most recent payout record as supporting proof that they received assistance last semester. Admins can review and print these before submission.
              </p>
            </div>

            <p className="text-xs font-bold" style={{ color: C.text }}>Renewal-Ready Scholars</p>
            <div className="space-y-3">
              {Object.entries(SCHOLAR_HISTORY).map(([scholarId, history]) => {
                const latest = history[history.length - 1];
                return (
                  <div key={scholarId} className="flex items-center justify-between px-4 py-3.5 rounded-xl border"
                    style={{ background: C.white, borderColor: C.border }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: C.greenSoft }}>
                        <RefreshCw className="w-4 h-4" style={{ color: C.green }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: C.text }}>{scholarId}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                          Last paid: {latest.sem} Sem AY {latest.ay} · {latest.benefactor} · ₱{latest.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: C.greenSoft, color: C.green }}>
                        Auto-attached
                      </span>
                      <button className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors"
                        style={{ borderColor: C.border, color: C.muted, background: C.white }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                        onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
                        <FileText className="w-3.5 h-3.5" /> Preview
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}