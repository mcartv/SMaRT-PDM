import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
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
  Loader2,
  Camera,
} from 'lucide-react';

function resolveProfileImage(profile) {
  const candidates = [
    profile?.avatar_url,
    profile?.profile_photo_url,
    profile?.photo_url,
    profile?.image_url,
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

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

function useDepartmentAccountManager({
  config,
  tokenStorageKey,
  profileStorageKey,
}) {
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState('');
  const [initialAccount, setInitialAccount] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const fileInputRef = useRef(null);
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

  const loadProfile = useCallback(async () => {
    let active = true;
    try {
      setLoadingProfile(true);
      setAccountFeedback('');

      const token = sessionStorage.getItem(tokenStorageKey);
      if (!token) {
        throw new Error('Session expired. Please log in again.');
      }

      const response = await fetch(buildApiUrl('/api/accounts/me'), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || 'Failed to load account profile.');
      }

      const profile = payload?.data || {};
      if (!active) return;

      const nextAccount = {
        first_name: profile.first_name || config.account.first_name,
        last_name: profile.last_name || config.account.last_name,
        email: profile.email || config.account.email,
        phone_number: profile.phone_number || '',
        position: profile.position || config.account.position,
        department: profile.department || config.account.department,
        role: profile.role || config.account.role,
        is_active: true,
      };

      setAccount(nextAccount);
      setInitialAccount(nextAccount);
      setProfileData(profile);
      sessionStorage.setItem(
        profileStorageKey,
        JSON.stringify({
          ...(JSON.parse(sessionStorage.getItem(profileStorageKey) || '{}')),
          ...profile,
          name: profile.name || `${nextAccount.first_name} ${nextAccount.last_name}`.trim(),
        })
      );
    } catch (err) {
      if (!active) return;
      setAccountFeedback(err.message || 'Failed to load account profile.');
    } finally {
      if (active) setLoadingProfile(false);
    }

    return () => {
      active = false;
    };
  }, [config.account, profileStorageKey, tokenStorageKey]);

  useEffect(() => {
    let cleanup = () => {};

    const run = async () => {
      cleanup = (await loadProfile()) || (() => {});
    };

    run();

    return () => {
      cleanup();
    };
  }, [loadProfile]);

  useSocketEvent('maintenance:updated', () => {
    const latestProfile = sessionStorage.getItem(profileStorageKey);
    if (latestProfile) {
      try {
        setProfileData(JSON.parse(latestProfile));
      } catch {
        setProfileData(null);
      }
    }
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!photoPreview) return undefined;

    return () => {
      window.URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    if (!accountFeedback) return undefined;

    const timer = window.setTimeout(() => {
      setAccountFeedback('');
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [accountFeedback]);

  const resetAccount = () => {
    setAccount(initialAccount || {
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

  const currentProfileImage = photoPreview || resolveProfileImage(profileData);
  const displayName = `${account.first_name} ${account.last_name}`.trim() || config.shortName;
  const feedbackIsError = /failed|please|expired|already|valid|required|unable/i.test(accountFeedback);
  const initials = useMemo(() => {
    const parts = displayName.split(' ').filter(Boolean);
    if (parts.length <= 1) return (parts[0]?.[0] || config.shortName[0] || 'S').toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [config.shortName, displayName]);

  const handlePhotoSelection = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    if (!nextFile.type.startsWith('image/')) {
      setAccountFeedback('Please choose a valid image file for the profile photo.');
      return;
    }

    if (photoPreview) {
      window.URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(nextFile);
    setPhotoPreview(window.URL.createObjectURL(nextFile));
    setAccountFeedback('Profile photo selected. Click upload to save it.');
  };

  const handleUploadPhoto = async () => {
    if (!photoFile) {
      setAccountFeedback('Please choose a profile photo first.');
      return;
    }

    try {
      setUploadingPhoto(true);
      setAccountFeedback('');

      const token = sessionStorage.getItem(tokenStorageKey);
      if (!token) {
        throw new Error('Session expired. Please log in again.');
      }

      const formData = new FormData();
      formData.append('file', photoFile);

      const response = await fetch(buildApiUrl('/api/accounts/me/profile-photo'), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || 'Failed to upload profile photo.');
      }

      const savedProfile = payload?.data || {};
      setProfileData(savedProfile);
      setPhotoFile(null);
      if (photoPreview) {
        window.URL.revokeObjectURL(photoPreview);
      }
      setPhotoPreview('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      sessionStorage.setItem(
        profileStorageKey,
        JSON.stringify({
          ...(JSON.parse(sessionStorage.getItem(profileStorageKey) || '{}')),
          ...savedProfile,
          name: savedProfile.name || `${savedProfile.first_name || account.first_name} ${savedProfile.last_name || account.last_name}`.trim(),
        })
      );

      setAccountFeedback(`${config.shortName} profile photo updated successfully.`);
    } catch (err) {
      console.error(`${config.shortName.toUpperCase()} PROFILE PHOTO UPLOAD ERROR:`, err);
      setAccountFeedback(err.message || `Failed to upload ${config.shortName} profile photo.`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setRemovingPhoto(true);
      setAccountFeedback('');

      const token = sessionStorage.getItem(tokenStorageKey);
      if (!token) {
        throw new Error('Session expired. Please log in again.');
      }

      const response = await fetch(buildApiUrl('/api/accounts/me/profile-photo'), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || 'Failed to remove profile photo.');
      }

      const savedProfile = payload?.data || {};
      setProfileData(savedProfile);
      setPhotoFile(null);
      if (photoPreview) {
        window.URL.revokeObjectURL(photoPreview);
      }
      setPhotoPreview('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      sessionStorage.setItem(
        profileStorageKey,
        JSON.stringify({
          ...(JSON.parse(sessionStorage.getItem(profileStorageKey) || '{}')),
          ...savedProfile,
          name: savedProfile.name || `${savedProfile.first_name || account.first_name} ${savedProfile.last_name || account.last_name}`.trim(),
        })
      );

      setAccountFeedback(`${config.shortName} profile photo removed successfully.`);
    } catch (err) {
      console.error(`${config.shortName.toUpperCase()} PROFILE PHOTO REMOVE ERROR:`, err);
      setAccountFeedback(err.message || `Failed to remove ${config.shortName} profile photo.`);
    } finally {
      setRemovingPhoto(false);
    }
  };

  const handleSaveAccount = async () => {
    try {
      setSavingAccount(true);
      setAccountFeedback('');

      const token = sessionStorage.getItem(tokenStorageKey);
      if (!token) {
        throw new Error('Session expired. Please log in again.');
      }

      const response = await fetch(buildApiUrl('/api/accounts/me'), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(account),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.message || 'Failed to save account changes.');
      }

      const savedProfile = payload?.data || {};
      const updatedAccount = {
        first_name: savedProfile.first_name || account.first_name,
        last_name: savedProfile.last_name || account.last_name,
        email: savedProfile.email || account.email,
        phone_number: savedProfile.phone_number || '',
        position: savedProfile.position || account.position,
        department: savedProfile.department || account.department,
        role: savedProfile.role || account.role,
        is_active: true,
      };

      setAccount(updatedAccount);
      setInitialAccount(updatedAccount);
      sessionStorage.setItem(
        profileStorageKey,
        JSON.stringify({
          ...(JSON.parse(sessionStorage.getItem(profileStorageKey) || '{}')),
          ...savedProfile,
          name: savedProfile.name || `${updatedAccount.first_name} ${updatedAccount.last_name}`.trim(),
        })
      );
      setAccountFeedback(`${config.shortName} account updated successfully.`);
    } catch (err) {
      console.error(`${config.shortName.toUpperCase()} ACCOUNT SAVE ERROR:`, err);
      setAccountFeedback(err.message || `Failed to save ${config.shortName} account changes.`);
    } finally {
      setSavingAccount(false);
    }
  };

  return {
    loadingProfile,
    savingAccount,
    accountFeedback,
    account,
    currentProfileImage,
    displayName,
    feedbackIsError,
    initials,
    uploadingPhoto,
    removingPhoto,
    fileInputRef,
    handlePhotoSelection,
    handleRemovePhoto,
    handleUploadPhoto,
    handleSaveAccount,
    handleFieldChange,
    resetAccount,
    photoFile,
  };
}

function GeneralPanel({
  config,
  palette,
}) {
  const [saved, setSaved] = useState(false);
  const [featureOpen, setFeatureOpen] = useState(true);
  const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');

  const handleSaveGeneral = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">General Configuration</h2>
          <p className="text-sm text-stone-500">
            System-wide preferences and office identity for {config.shortName}
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

      {saved ? (
        <div className="rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 text-sm text-green-900 shadow-sm">
          General configuration changes were saved for {config.shortName}.
        </div>
      ) : null}

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
    </div>
  );
}

function AccountPanel({
  config,
  palette,
  tokenStorageKey,
  profileStorageKey,
}) {
  const {
    loadingProfile,
    savingAccount,
    accountFeedback,
    account,
    currentProfileImage,
    displayName,
    feedbackIsError,
    initials,
    uploadingPhoto,
    removingPhoto,
    fileInputRef,
    handlePhotoSelection,
    handleRemovePhoto,
    handleUploadPhoto,
    handleSaveAccount,
    handleFieldChange,
    resetAccount,
    photoFile,
  } = useDepartmentAccountManager({
    config,
    tokenStorageKey,
    profileStorageKey,
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Account Management</h2>
        <p className="text-sm text-stone-500">
          Update the active {config.shortName} account details, profile photo, and display information
        </p>
      </div>

      <GroupCard title={`${config.shortName} Account Management`} icon={User}>
        <div className="space-y-5">
          <div className={`rounded-xl border px-4 py-3 ${palette.infoBox}`}>
            <p className="text-sm font-medium">Manage the current office account in one place.</p>
            <p className="mt-1 text-xs">
              Changes here update the profile used across the {config.shortName} portal.
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-stone-50/60 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              {currentProfileImage ? (
                <img
                  src={currentProfileImage}
                  alt={displayName}
                  className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-sm"
                />
              ) : (
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white text-xl font-bold text-white shadow-sm"
                  style={{ background: palette.base }}
                >
                  {initials}
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-stone-800">Profile Photo</p>
                <p className="mt-1 text-xs text-stone-500">
                  Upload a real photo for the portal header and profile page. Initials will remain as the fallback when no image is set.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelection}
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg border-stone-200 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto || removingPhoto}
              >
                <Camera className="mr-2 h-4 w-4" />
                Choose Photo
              </Button>
              <Button
                type="button"
                className="h-9 rounded-lg border-none text-xs text-white"
                style={{ background: palette.base }}
                onClick={handleUploadPhoto}
                disabled={!photoFile || uploadingPhoto || removingPhoto}
              >
                {uploadingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Upload Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg border-stone-200 text-xs text-stone-700"
                onClick={handleRemovePhoto}
                disabled={!currentProfileImage || uploadingPhoto || removingPhoto}
              >
                {removingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4" />}
                Remove Photo
              </Button>
            </div>
          </div>

          {accountFeedback ? (
            <div className={`rounded-xl border px-4 py-3 text-sm ${
              feedbackIsError
                ? 'border-red-100 bg-red-50 text-red-700'
                : 'border-green-100 bg-green-50 text-green-800'
            }`}>
              {accountFeedback}
            </div>
          ) : null}

          {loadingProfile ? (
            <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading current {config.shortName} account details...
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>First Name</FieldLabel>
              <Input
                value={account.first_name}
                onChange={(e) => handleFieldChange('first_name', e.target.value)}
                className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                disabled={loadingProfile || savingAccount}
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Last Name</FieldLabel>
              <Input
                value={account.last_name}
                onChange={(e) => handleFieldChange('last_name', e.target.value)}
                className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                disabled={loadingProfile || savingAccount}
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
                  disabled={loadingProfile || savingAccount}
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
                  disabled={loadingProfile || savingAccount}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Position</FieldLabel>
              <Input
                value={account.position}
                onChange={(e) => handleFieldChange('position', e.target.value)}
                className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                disabled={loadingProfile || savingAccount}
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Department</FieldLabel>
              <Input
                value={account.department}
                onChange={(e) => handleFieldChange('department', e.target.value)}
                className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                disabled={loadingProfile || savingAccount}
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
              disabled={loadingProfile || savingAccount}
            >
              {savingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
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

export default function DepartmentMaintenancePage({
  config,
  palette,
  tokenStorageKey = 'adminToken',
  profileStorageKey = 'adminProfile',
}) {
  const [tab, setTab] = useState('general');
  const tabs = [
    { key: 'general', label: 'General', icon: SlidersHorizontal },
    { key: 'account', label: 'Account', icon: User },
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
          {tab === 'general' && (
            <GeneralPanel
              config={config}
              palette={palette}
            />
          )}
          {tab === 'account' && (
            <AccountPanel
              config={config}
              palette={palette}
              tokenStorageKey={tokenStorageKey}
              profileStorageKey={profileStorageKey}
            />
          )}
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
