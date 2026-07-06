import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-stone-400">
      {children}
    </label>
  );
}

function GroupCard({ title, icon: Icon, children }) {
  return (
    <Card className="overflow-hidden border-stone-200 bg-white shadow-none">
      <div className="flex items-center gap-2.5 border-b border-stone-100 bg-stone-50/60 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 bg-white">
          <Icon className="h-4 w-4 text-stone-600" />
        </div>
        <p className="text-sm font-semibold text-stone-800">{title}</p>
      </div>
      <CardContent className="space-y-5 p-5">{children}</CardContent>
    </Card>
  );
}

function Toggle({ value, onChange, labels = ['Enabled', 'Disabled'], activeColorClass = 'text-green-600' }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center gap-2">
      {value ? (
        <ToggleRight className={`h-7 w-7 ${activeColorClass}`} />
      ) : (
        <ToggleLeft className="h-7 w-7 text-stone-300" />
      )}
      <span className={`text-xs font-medium ${value ? activeColorClass.replace('600', '700') : 'text-stone-400'}`}>
        {value ? labels[0] : labels[1]}
      </span>
    </button>
  );
}

function GeneralPanel({ config, palette }) {
  const [saved, setSaved] = useState(false);
  const [featureOpen, setFeatureOpen] = useState(true);
  const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');
  const [account, setAccount] = useState({
    first_name: config.account.first_name,
    last_name: config.account.last_name,
    email: config.account.email,
    phone_number: config.account.phone_number,
    position: config.account.position,
    department: config.account.department,
    role: config.account.role,
    is_active: true,
  });

  const handleSaveGeneral = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetAccount = () => {
    setAccount({
      first_name: config.account.first_name,
      last_name: config.account.last_name,
      email: config.account.email,
      phone_number: config.account.phone_number,
      position: config.account.position,
      department: config.account.department,
      role: config.account.role,
      is_active: true,
    });
  };

  const handleFieldChange = (field, value) => {
    setAccount((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveAccount = async () => {
    try {
      alert(`${config.shortName} account changes are ready to be connected to backend.`);
    } catch (err) {
      console.error(`${config.shortName.toUpperCase()} ACCOUNT SAVE ERROR:`, err);
      alert(`Failed to save ${config.shortName} account changes`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">General Configuration</h2>
          <p className="text-sm text-stone-500">
            System-wide preferences, office identity, and {config.shortName} account settings
          </p>
        </div>

        <Button
          onClick={handleSaveGeneral}
          className="rounded-lg border-none text-xs text-white"
          style={{ background: saved ? palette.accent : palette.base }}
        >
          {saved ? <Check size={16} className="mr-2" /> : <Save size={16} className="mr-2" />}
          {saved ? 'Saved' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <GroupCard title="Institution Info" icon={Globe}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel>Institution Name</FieldLabel>
              <Input
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                className="rounded-lg border-stone-200 bg-stone-50/50"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Office Email</FieldLabel>
              <Input
                defaultValue={config.account.email}
                className="rounded-lg border-stone-200 bg-stone-50/50"
              />
            </div>
          </div>
        </GroupCard>

        <GroupCard title={config.featureTitle} icon={Calendar}>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 p-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                  Status
                </p>
                <Toggle
                  value={featureOpen}
                  onChange={setFeatureOpen}
                  labels={config.featureLabels}
                  activeColorClass={palette.toggleClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>{config.featureFieldLabel}</FieldLabel>
              <Input
                defaultValue={config.featureFieldDefault}
                className="rounded-lg border-stone-200 bg-stone-50/50"
              />
            </div>
          </div>
        </GroupCard>
      </div>

      <GroupCard title={`${config.shortName} Account Management`} icon={User}>
        <div className="space-y-5">
          <div className={`rounded-xl border px-4 py-3 ${palette.infoBox}`}>
            <p className="text-sm font-medium">Profile editing is managed here under General Maintenance.</p>
            <p className="mt-1 text-xs">
              Use this section to update the current {config.shortName} account information shown in the portal.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>First Name</FieldLabel>
              <Input
                value={account.first_name}
                onChange={(e) => handleFieldChange('first_name', e.target.value)}
                className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Last Name</FieldLabel>
              <Input
                value={account.last_name}
                onChange={(e) => handleFieldChange('last_name', e.target.value)}
                className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Email Address</FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  value={account.email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  className="h-10 rounded-lg border-stone-200 bg-stone-50/50 pl-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Phone Number</FieldLabel>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  value={account.phone_number}
                  onChange={(e) => handleFieldChange('phone_number', e.target.value)}
                  className="h-10 rounded-lg border-stone-200 bg-stone-50/50 pl-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Position</FieldLabel>
              <Input
                value={account.position}
                onChange={(e) => handleFieldChange('position', e.target.value)}
                className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Department</FieldLabel>
              <Input
                value={account.department}
                onChange={(e) => handleFieldChange('department', e.target.value)}
                className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Role</p>
              <p className="mt-1 text-sm font-medium text-stone-800">{account.role}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Account Status</p>
              <p className="mt-1 text-sm font-medium text-stone-800">
                {account.is_active ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Display Name</p>
              <p className="mt-1 text-sm font-medium text-stone-800">
                {account.first_name} {account.last_name}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" className="h-9 rounded-lg border-stone-200 text-xs" onClick={resetAccount}>
              Reset
            </Button>
            <Button
              onClick={handleSaveAccount}
              className="h-9 rounded-lg border-none text-xs text-white"
              style={{ background: palette.base }}
            >
              <Save className="mr-2 h-4 w-4" />
              Save {config.shortName} Account
            </Button>
          </div>
        </div>
      </GroupCard>
    </div>
  );
}

function AuditPanel({ config, palette }) {
  const auditEntries = config.auditEntries;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Audit Trail</h2>
        <p className="text-sm text-stone-500">
          Recent {config.shortName}-side actions and maintenance activity
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="border-stone-200 shadow-none">
          <CardContent className="p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50">
              <Activity className="h-4 w-4 text-green-700" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-stone-900">{auditEntries.length}</div>
            <p className="mt-0.5 text-xs text-stone-500">Recent Entries</p>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-none">
          <CardContent className="p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-stone-900">
              {auditEntries.filter((entry) => entry.status === 'Success').length}
            </div>
            <p className="mt-0.5 text-xs text-stone-500">Successful Actions</p>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-none">
          <CardContent className="p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100">
              <ClipboardList className="h-4 w-4 text-stone-600" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-stone-900">{config.auditScope}</div>
            <p className="mt-0.5 text-xs text-stone-500">Audit Scope</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-stone-200 shadow-none">
        <div className="border-b border-stone-100 bg-stone-50/50 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Audit Registry</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Placeholder audit panel for now. Backend audit integration can be wired later.
            </p>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="space-y-3">
            {auditEntries.map((entry, index) => (
              <div
                key={index}
                className="rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-stone-900">{entry.action}</h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                          entry.status === 'Success'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-stone-500">
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

export default function DepartmentMaintenancePage({ config, palette }) {
  const [tab, setTab] = useState('general');
  const tabs = [
    { key: 'general', label: 'General', icon: SlidersHorizontal },
    { key: 'audit', label: 'Audit', icon: ClipboardList },
  ];

  return (
    <div className="animate-in space-y-5 fade-in duration-500" style={{ background: palette.bg }}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Settings & Maintenance</h1>
        <p className="mt-1 text-sm text-stone-500">{config.pageSubtitle}</p>
      </div>

      <Card className="min-h-[600px] overflow-hidden border-stone-200 shadow-none">
        <div className="flex overflow-x-auto border-b border-stone-100 bg-stone-50/50">
          {tabs.map((tabOption) => (
            <button
              key={tabOption.key}
              type="button"
              onClick={() => setTab(tabOption.key)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-all ${
                tab === tabOption.key
                  ? 'bg-white text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
              style={{ borderBottomColor: tab === tabOption.key ? palette.base : 'transparent' }}
            >
              <tabOption.icon size={14} />
              {tabOption.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'general' && <GeneralPanel config={config} palette={palette} />}
          {tab === 'audit' && <AuditPanel config={config} palette={palette} />}
        </div>
      </Card>

      <footer className="border-t border-stone-100 pb-2 pt-6">
        <p className="text-center text-[11px] uppercase tracking-widest text-stone-300">
          {config.footerLabel}
        </p>
      </footer>
    </div>
  );
}
