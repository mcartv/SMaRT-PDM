import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
  Loader2,
  Palette,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ThemePanel from '@/pages/maintenance/ThemePanel';

const SETTINGS_TABS = [
  { key: 'account', label: 'Account', icon: UserRound },
  { key: 'theme', label: 'Theme', icon: Palette },
  { key: 'security', label: 'Security', icon: ShieldCheck },
];

function roleLabel(role) {
  const labels = {
    sdo: 'Student Discipline Office',
    guidance: 'Guidance Office',
    pd: 'Program Director',
    ro_coordinator: 'RO Coordinator',
  };
  return labels[role] || role || 'Staff';
}

function SettingsNav({ activeTab, onChange }) {
  return (
    <div className="sticky top-0 z-20 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-6 overflow-x-auto px-4">
        {SETTINGS_TABS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`relative flex items-center gap-2 whitespace-nowrap py-3 text-sm font-medium transition ${
                active ? 'text-stone-900' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              <Icon size={14} />
              {item.label}
              {active ? <span className="absolute bottom-0 left-0 h-[2px] w-full bg-stone-900" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, description }) {
  return (
    <div className="border-b border-stone-100 bg-stone-50/70 px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700">
          {createElement(icon, { size: 18 })}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          <p className="mt-1 text-sm text-stone-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentSettingsPage({
  portalKey,
  tokenStorageKey,
  profilePath,
  themeTitle,
  themeSubtitle,
}) {
  const [activeTab, setActiveTab] = useState('account');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [verifyingCurrentPassword, setVerifyingCurrentPassword] = useState(false);
  const [currentPasswordVerified, setCurrentPasswordVerified] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const activeMeta = useMemo(
    () => SETTINGS_TABS.find((item) => item.key === activeTab) || SETTINGS_TABS[0],
    [activeTab]
  );

  const loadAccount = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = sessionStorage.getItem(tokenStorageKey);
      if (!token) throw new Error('Session expired. Please sign in again.');

      const response = await fetch(buildApiUrl('/api/accounts/me'), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || 'Failed to load account settings.');
      }
      setProfile(payload?.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load account settings.');
    } finally {
      setLoading(false);
    }
  }, [tokenStorageKey]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const verifyCurrentPassword = async () => {
    try {
      setVerifyingCurrentPassword(true);
      setFeedback('');
      setCurrentPasswordVerified(false);

      const token = sessionStorage.getItem(tokenStorageKey);
      if (!token) throw new Error('Session expired. Please sign in again.');
      if (!passwords.current_password) throw new Error('Enter your current password first.');

      const response = await fetch(buildApiUrl('/api/accounts/me/password/verify'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ current_password: passwords.current_password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Password verification is not available on the current backend build. Redeploy the admin backend, then try again.');
        }
        throw new Error(payload?.error?.message || payload?.message || 'Current password is incorrect.');
      }

      setCurrentPasswordVerified(true);
      setFeedback('Current password verified.');
    } catch (err) {
      setCurrentPasswordVerified(false);
      setPasswords((current) => ({
        ...current,
        new_password: '',
        confirm_password: '',
      }));
      setFeedback(err.message || 'Failed to verify current password.');
    } finally {
      setVerifyingCurrentPassword(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    try {
      setSavingPassword(true);
      setFeedback('');
      const token = sessionStorage.getItem(tokenStorageKey);
      if (!token) throw new Error('Session expired. Please sign in again.');

      const response = await fetch(buildApiUrl('/api/accounts/me/password'), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwords),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || 'Failed to change password.');
      }

      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      setCurrentPasswordVerified(false);
      setFeedback('Password changed successfully.');
    } catch (err) {
      setFeedback(err.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const renderAccount = () => (
    <Card className="overflow-hidden border-stone-200 shadow-none">
      <SectionHeader
        icon={UserRound}
        title="Account"
        description="View your sign-in identity and office account information."
      />
      <CardContent className="p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-stone-900">Account Information</p>
            <p className="mt-1 text-xs text-stone-500">
              Profile details such as your name, photo, and contact information remain in Profile.
            </p>
          </div>
          {profilePath ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = profilePath;
              }}
            >
              Open Profile
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading account…
          </div>
        ) : profile ? (
          <div className="grid overflow-hidden rounded-2xl border border-stone-200 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Username', profile.username || '—'],
              ['Email', profile.email || '—'],
              ['Role', roleLabel(profile.role)],
              ['Department', profile.department || profile.position || '—'],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={`min-w-0 p-4 ${index > 0 ? 'border-t border-stone-100 sm:border-t-0' : ''} ${
                  index % 2 === 1 ? 'sm:border-l' : ''
                } ${index >= 2 ? 'xl:border-l xl:border-t-0' : ''}`}
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-400">{label}</p>
                <p className="mt-1.5 break-words text-sm font-medium text-stone-900">{value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  const renderTheme = () => (
    <Card className="overflow-hidden border-stone-200 shadow-none">
      <SectionHeader
        icon={Palette}
        title="Theme"
        description="Choose the appearance used for your department workspace."
      />
      <CardContent className="p-5">
        <ThemePanel
          tokenStorageKey={tokenStorageKey}
          allowedPortals={[portalKey]}
          editablePortals={[portalKey]}
          title={themeTitle || 'Theme'}
          subtitle={themeSubtitle || 'Choose the appearance used for your department workspace.'}
        />
      </CardContent>
    </Card>
  );

  const renderSecurity = () => (
    <Card className="overflow-hidden border-stone-200 shadow-none">
      <SectionHeader
        icon={ShieldCheck}
        title="Security"
        description="Update your password and protect access to your account."
      />
      <CardContent className="p-5 md:p-8">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-center">
            <p className="text-sm font-medium text-stone-900">Change Password</p>
            <p className="mt-1 text-xs text-stone-500">
              Enter your current password first before creating a new password.
            </p>
          </div>

          <form className="space-y-4" onSubmit={changePassword}>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-600">Current Password</label>
              <div className="relative">
                <Input
                  type={showPasswords ? 'text' : 'password'}
                  value={passwords.current_password}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPasswords((current) => ({
                      ...current,
                      current_password: value,
                      new_password: currentPasswordVerified ? '' : current.new_password,
                      confirm_password: currentPasswordVerified ? '' : current.confirm_password,
                    }));
                    if (currentPasswordVerified) {
                      setCurrentPasswordVerified(false);
                      setFeedback('Current password changed. Verify it again to continue.');
                    }
                  }}
                  className="pr-10"
                  autoComplete="current-password"
                  required
                  autoFocus
                  disabled={verifyingCurrentPassword || savingPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                  aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!currentPasswordVerified ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={verifyCurrentPassword}
                disabled={verifyingCurrentPassword || savingPassword || !passwords.current_password}
              >
                {verifyingCurrentPassword ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Verify Current Password
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Current password verified
              </div>
            )}

            {currentPasswordVerified ? (
              <div className="space-y-4 border-t border-stone-100 pt-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-stone-600">New Password</label>
                  <div className="relative">
                    <Input
                      type={showPasswords ? 'text' : 'password'}
                      value={passwords.new_password}
                      onChange={(event) =>
                        setPasswords((current) => ({ ...current, new_password: event.target.value }))
                      }
                      className="pr-10"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                      aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                    >
                      {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-stone-600">Confirm New Password</label>
                  <div className="relative">
                    <Input
                      type={showPasswords ? 'text' : 'password'}
                      value={passwords.confirm_password}
                      onChange={(event) =>
                        setPasswords((current) => ({ ...current, confirm_password: event.target.value }))
                      }
                      className="pr-10"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                      aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                    >
                      {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-stone-500">
                  Use at least 8 characters with uppercase, lowercase, and a number.
                </p>
              </div>
            ) : null}

            {feedback ? (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  feedback.toLowerCase().includes('success') || feedback.toLowerCase().includes('verified')
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {feedback}
              </div>
            ) : null}

            {currentPasswordVerified ? (
              <Button
                type="submit"
                className="w-full"
                disabled={
                  savingPassword ||
                  !passwords.new_password ||
                  !passwords.confirm_password
                }
              >
                {savingPassword ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Change Password
              </Button>
            ) : null}
          </form>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 py-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Settings</h1>
        <p className="mt-1 text-sm text-stone-500">
          Manage your account information, department theme, and sign-in security.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <SettingsNav activeTab={activeTab} onChange={setActiveTab} />

      <main className="min-w-0">
        {activeMeta.key === 'account' ? renderAccount() : null}
        {activeMeta.key === 'theme' ? renderTheme() : null}
        {activeMeta.key === 'security' ? renderSecurity() : null}
      </main>
    </div>
  );
}
