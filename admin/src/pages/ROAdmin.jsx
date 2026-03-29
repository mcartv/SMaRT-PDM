import { useState } from 'react';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { CheckCircle, XCircle, Clock, FileText, Building2, Calendar, User, Bell } from 'lucide-react';

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

const CARD = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const PENDING = [
  { id: 'RO-001', student: { name: 'Juan Dela Cruz', id: 'S2023-001', program: 'TES' }, obligation: 'Community Service — Library', submitted: 'Oct 28, 2025', dept: 'Library' },
];

export default function ROAdmin() {
  const [tab, setTab] = useState('pending');

  return (
    <div className="space-y-5 py-1 text-gray-900">
      <div>
        <h1 className="text-2xl font-bold">Return of Obligations</h1>
        <p className="text-sm text-gray-400">Manage and verify scholar obligations</p>
      </div>

      <div style={CARD} className="overflow-hidden">
        <div className="flex border-b border-gray-200">
          {['pending', 'verified', 'overdue'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-5 py-3 text-sm font-semibold capitalize border-b-2 transition-all ${tab === t ? 'border-amber-900 text-amber-900' : 'border-transparent text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="divide-y divide-gray-100">
          {tab === 'pending' && PENDING.map((ro) => (
            <div key={ro.id} className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-stone-800 text-white text-xs">JD</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold">{ro.student.name}</p>
                  <p className="text-[10px] text-gray-400">{ro.obligation}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-lg border border-green-200">Approve</button>
                <button className="px-3 py-1.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-200">Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}