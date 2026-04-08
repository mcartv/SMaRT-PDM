import React, { useState } from 'react';

// --- SHADCN UI COMPONENTS ---
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// --- ICONS ---
import {
  SlidersHorizontal,
  ClipboardList,
  Globe,
  Calendar,
  Save,
  Check,
  ToggleLeft,
  ToggleRight,
  Mail,
  Phone,
  User,
  Activity,
  ShieldCheck,
} from 'lucide-react';

const C = {
  greenDark: '#2e4b43',
  greenMid: '#3f655b',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  greenSoftAlt: '#ecfdf5',
  text: '#1c1917',
  bg: '#f6f8f7',
  muted: '#78716c',
  border: '#d6e5df',
};

function FieldLabel({ children }) {
  return (
    <label className="text-[11px] font-medium uppercase tracking-wide block mb-1.5 text-stone-400">
      {children}
    </label>
  );
}

function GroupCard({ title, icon: Icon, children }) {
  return (
    <Card className="overflow-hidden border-stone-200 shadow-none bg-white">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-stone-100 bg-stone-50/60">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white border border-stone-200">
          <Icon className="w-4 h-4 text-stone-600" />
        </div>
        <p className="text-sm font-semibold text-stone-800">{title}</p>
      </div>
      <CardContent className="p-5 space-y-5">{children}</CardContent>
    </Card>
  );
}

function Toggle({ value, onChange, labels = ['Enabled', 'Disabled'] }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center gap-2">
      {value ? (
        <ToggleRight className="w-7 h-7 text-green-600" />
      ) : (
        <ToggleLeft className="w-7 h-7 text-stone-300" />
      )}
      <span className={`text-xs font-medium ${value ? 'text-green-700' : 'text-stone-400'}`}>
        {value ? labels[0] : labels[1]}
      </span>
    </button>
  );
}

function GeneralPanel() {
  const [saved, setSaved] = useState(false);
  const [monitoringOpen, setMonitoringOpen] = useState(true);

  const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');

  const [sdoAccount, setSdoAccount] = useState({
    first_name: 'SDO',
    last_name: 'Officer',
    email: 'sdo@pdm.edu.ph',
    phone_number: '+63 917 000 0000',
    position: 'Student Disciplinary Officer',
    department: 'SDO',
    role: 'SDO Staff',
    is_active: true,
  });

  const handleSaveGeneral = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSdoFieldChange = (field, value) => {
    setSdoAccount((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveSdoAccount = async () => {
    try {
      alert('SDO account changes are ready to be connected to backend.');
    } catch (err) {
      console.error('SDO ACCOUNT SAVE ERROR:', err);
      alert('Failed to save SDO account changes');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">General Configuration</h2>
          <p className="text-sm text-stone-500">
            System-wide preferences, office identity, and SDO account settings
          </p>
        </div>

        <Button
          onClick={handleSaveGeneral}
          className="rounded-lg text-white border-none text-xs"
          style={{ background: saved ? C.green : C.greenDark }}
        >
          {saved ? <Check size={16} className="mr-2" /> : <Save size={16} className="mr-2" />}
          {saved ? 'Saved' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <GroupCard title="Institution Info" icon={Globe}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel>Institution Name</FieldLabel>
              <Input
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                className="rounded-lg bg-stone-50/50 border-stone-200"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Office Email</FieldLabel>
              <Input
                defaultValue="sdo@pdm.edu.ph"
                className="rounded-lg bg-stone-50/50 border-stone-200"
              />
            </div>
          </div>
        </GroupCard>

        <GroupCard title="Disciplinary Monitoring" icon={Calendar}>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
              <div>
                <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">
                  Status
                </p>
                <Toggle
                  value={monitoringOpen}
                  onChange={setMonitoringOpen}
                  labels={['Monitoring Active', 'Monitoring Paused']}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Review Cycle</FieldLabel>
              <Input
                defaultValue="Weekly"
                className="rounded-lg bg-stone-50/50 border-stone-200"
              />
            </div>
          </div>
        </GroupCard>
      </div>

      <GroupCard title="SDO Account Management" icon={User}>
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-medium text-emerald-800">
              Profile editing is managed here under General Maintenance.
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              Use this section to update the current SDO account information shown in the profile page.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>First Name</FieldLabel>
              <Input
                value={sdoAccount.first_name}
                onChange={(e) => handleSdoFieldChange('first_name', e.target.value)}
                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Last Name</FieldLabel>
              <Input
                value={sdoAccount.last_name}
                onChange={(e) => handleSdoFieldChange('last_name', e.target.value)}
                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Email Address</FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input
                  value={sdoAccount.email}
                  onChange={(e) => handleSdoFieldChange('email', e.target.value)}
                  className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50 pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Phone Number</FieldLabel>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input
                  value={sdoAccount.phone_number}
                  onChange={(e) => handleSdoFieldChange('phone_number', e.target.value)}
                  className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50 pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Position</FieldLabel>
              <Input
                value={sdoAccount.position}
                onChange={(e) => handleSdoFieldChange('position', e.target.value)}
                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Department</FieldLabel>
              <Input
                value={sdoAccount.department}
                onChange={(e) => handleSdoFieldChange('department', e.target.value)}
                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Role</p>
              <p className="text-sm font-medium text-stone-800 mt-1">{sdoAccount.role}</p>
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Account Status</p>
              <p className="text-sm font-medium text-stone-800 mt-1">
                {sdoAccount.is_active ? 'Active' : 'Inactive'}
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Display Name</p>
              <p className="text-sm font-medium text-stone-800 mt-1">
                {sdoAccount.first_name} {sdoAccount.last_name}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              className="h-9 rounded-lg border-stone-200 text-xs"
              onClick={() =>
                setSdoAccount({
                  first_name: 'SDO',
                  last_name: 'Officer',
                  email: 'sdo@pdm.edu.ph',
                  phone_number: '+63 917 000 0000',
                  position: 'Student Disciplinary Officer',
                  department: 'SDO',
                  role: 'SDO Staff',
                  is_active: true,
                })
              }
            >
              Reset
            </Button>

            <Button
              onClick={handleSaveSdoAccount}
              className="h-9 rounded-lg text-white text-xs border-none"
              style={{ background: C.greenDark }}
            >
              <Save className="w-4 h-4 mr-2" />
              Save SDO Account
            </Button>
          </div>
        </div>
      </GroupCard>
    </div>
  );
}

function AuditPanel() {
  const auditEntries = [
    {
      action: 'Updated scholar probation status',
      actor: 'SDO Officer',
      time: 'Apr 08, 2026 · 10:15 AM',
      status: 'Success',
    },
    {
      action: 'Saved SDO profile settings',
      actor: 'SDO Officer',
      time: 'Apr 08, 2026 · 09:42 AM',
      status: 'Success',
    },
    {
      action: 'Viewed disciplinary records dashboard',
      actor: 'SDO Officer',
      time: 'Apr 07, 2026 · 03:10 PM',
      status: 'Viewed',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Audit Trail</h2>
        <p className="text-sm text-stone-500">
          Recent SDO-side actions and maintenance activity
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-stone-200 shadow-none">
          <CardContent className="p-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-green-50">
              <Activity className="w-4 h-4 text-green-700" />
            </div>
            <div className="text-2xl font-semibold text-stone-900 mt-3">{auditEntries.length}</div>
            <p className="text-xs text-stone-500 mt-0.5">Recent Entries</p>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-none">
          <CardContent className="p-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-50">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl font-semibold text-stone-900 mt-3">
              {auditEntries.filter((x) => x.status === 'Success').length}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">Successful Actions</p>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-none">
          <CardContent className="p-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-stone-100">
              <ClipboardList className="w-4 h-4 text-stone-600" />
            </div>
            <div className="text-2xl font-semibold text-stone-900 mt-3">SDO</div>
            <p className="text-xs text-stone-500 mt-0.5">Audit Scope</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-stone-200 shadow-none overflow-hidden">
        <div className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Audit Registry</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Placeholder audit panel for now. Backend audit integration can be wired later.
            </p>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="space-y-3">
            {auditEntries.map((entry, index) => (
              <div
                key={index}
                className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-stone-900">{entry.action}</h3>

                      <span
                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${
                          entry.status === 'Success'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </div>

                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      {entry.actor} • {entry.time}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SDOMaintenance() {
  const [tab, setTab] = useState('general');

  const TABS = [
    { key: 'general', label: 'General', icon: SlidersHorizontal },
    { key: 'audit', label: 'Audit', icon: ClipboardList },
  ];

  return (
    <div className="space-y-5 py-2 animate-in fade-in duration-500" style={{ background: C.bg }}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Settings & Maintenance</h1>
        <p className="text-sm text-stone-500 mt-1">
          SDO configuration and disciplinary monitoring maintenance
        </p>
      </div>

      <Card className="border-stone-200 shadow-none overflow-hidden min-h-[600px]">
        <div className="flex border-b border-stone-100 bg-stone-50/50 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all shrink-0 ${
                tab === t.key
                  ? 'text-stone-900 bg-white'
                  : 'text-stone-400 border-transparent hover:text-stone-600'
              }`}
              style={{ borderBottomColor: tab === t.key ? C.greenDark : 'transparent' }}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'general' && <GeneralPanel />}
          {tab === 'audit' && <AuditPanel />}
        </div>
      </Card>

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · SDO Maintenance Layer
        </p>
      </footer>
    </div>
  );
}