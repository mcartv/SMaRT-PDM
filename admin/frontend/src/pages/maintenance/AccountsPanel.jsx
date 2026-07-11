import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertTriangle,
    Archive,
    ArchiveRestore,
    Edit,
    Loader2,
    Mail,
    Phone,
    Plus,
    RefreshCw,
    Save,
    Search,
    ShieldCheck,
    UsersRound,
    X,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { C, EmptyState, FieldLabel } from './components/MaintenanceShared';

const ROLE_OPTIONS = [
    {
        value: 'admin',
        label: 'Admin',
        department: 'OSFA',
        position: 'OSFA Administrator',
    },
    {
        value: 'pd',
        label: 'Program Director',
        department: 'Program Department',
        position: 'Program Director',
    },
    {
        value: 'guidance',
        label: 'GCO',
        department: 'Guidance Office',
        position: 'Guidance Staff',
    },
    {
        value: 'sdo',
        label: 'SDO',
        department: 'Student Disciplinary Office',
        position: 'SDO Officer',
    },
];

const DEFAULT_FORM = {
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    role: 'admin',
    department: ROLE_OPTIONS[0].department,
    position: ROLE_OPTIONS[0].position,
    password: '',
    confirm_password: '',
};

function getAuthHeaders() {
    return {
        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json',
    };
}

function roleTone(role) {
    if (role === 'admin') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (role === 'pd') return 'bg-purple-50 text-purple-700 border-purple-100';
    if (role === 'guidance') return 'bg-blue-50 text-blue-700 border-blue-100';
    if (role === 'sdo') return 'bg-emerald-50 text-emerald-700 border-emerald-100';

    return 'bg-stone-50 text-stone-700 border-stone-100';
}

function accountMatchesRoleGroup(account, roleFilter) {
    if (roleFilter === 'all') return true;
    if (roleFilter === 'admin') return account.role === 'admin';
    if (roleFilter === 'office') return ['sdo', 'guidance'].includes(account.role);
    if (roleFilter === 'pd') return account.role === 'pd';

    return true;
}

function validatePasswordFields(password, confirmPassword, required = true) {
    if (!required && !password && !confirmPassword) return '';

    if (password.length < 8) {
        return 'Password must be at least 8 characters.';
    }

    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        return 'Password must include uppercase, lowercase, and number characters.';
    }

    if (password !== confirmPassword) {
        return 'Passwords do not match.';
    }

    return '';
}

function validateCreateForm(form) {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
        return 'First name, last name, and email are required.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        return 'Enter a valid email address.';
    }

    if (!form.role) {
        return 'Select an account role.';
    }

    return validatePasswordFields(form.password, form.confirm_password, true);
}

function validateEditForm(form) {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
        return 'First name, last name, and email are required.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        return 'Enter a valid email address.';
    }

    if (!form.role) {
        return 'Select an account role.';
    }

    return validatePasswordFields(form.password, form.confirm_password, false);
}

function StaffCreateModal({
    open,
    form,
    saving,
    error,
    setField,
    handleRoleChange,
    onClose,
    onSubmit,
}) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3">
                    <h3 className="text-sm font-semibold text-stone-800">
                        Create Staff Account
                    </h3>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                    >
                        <X size={14} />
                    </button>
                </div>

                <form className="space-y-3 p-4" onSubmit={onSubmit}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <FieldLabel>First Name</FieldLabel>
                            <Input
                                value={form.first_name}
                                onChange={(event) => setField('first_name', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>

                        <div>
                            <FieldLabel>Last Name</FieldLabel>
                            <Input
                                value={form.last_name}
                                onChange={(event) => setField('last_name', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div>
                        <FieldLabel>Email Address</FieldLabel>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                            <Input
                                type="email"
                                value={form.email}
                                onChange={(event) => setField('email', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 pl-8 text-sm"
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <FieldLabel>Role</FieldLabel>
                            <Select
                                value={form.role}
                                onValueChange={handleRoleChange}
                                disabled={saving}
                            >
                                <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
                                    <SelectValue />
                                </SelectTrigger>

                                <SelectContent>
                                    {ROLE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <FieldLabel>Phone Number</FieldLabel>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                                <Input
                                    value={form.phone_number}
                                    onChange={(event) => setField('phone_number', event.target.value)}
                                    className="h-9 rounded-lg border-stone-200 pl-8 text-sm"
                                    disabled={saving}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <FieldLabel>Department</FieldLabel>
                            <Input
                                value={form.department}
                                onChange={(event) => setField('department', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>

                        <div>
                            <FieldLabel>Position</FieldLabel>
                            <Input
                                value={form.position}
                                onChange={(event) => setField('position', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <FieldLabel>Password</FieldLabel>
                            <Input
                                type="password"
                                value={form.password}
                                onChange={(event) => setField('password', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>

                        <div>
                            <FieldLabel>Confirm Password</FieldLabel>
                            <Input
                                type="password"
                                value={form.confirm_password}
                                onChange={(event) => setField('confirm_password', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>
                    </div>

                    {error ? (
                        <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    ) : null}

                    <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={saving}
                            className="h-8 rounded-lg border-stone-200 text-xs"
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            disabled={saving}
                            className="h-8 rounded-lg border-none px-3 text-xs text-white"
                            style={{ background: C.brownMid }}
                        >
                            {saving ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Create Account
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function StaffEditModal({
    open,
    form,
    setForm,
    saving,
    onClose,
    onSave,
}) {
    if (!open) return null;

    const setField = (field, value) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const handleRoleChange = (role) => {
        const defaults = ROLE_OPTIONS.find((option) => option.value === role);

        setForm((current) => ({
            ...current,
            role,
            department: defaults?.department || current.department,
            position: defaults?.position || current.position,
        }));
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3">
                    <h3 className="text-sm font-semibold text-stone-800">
                        Update Staff Account
                    </h3>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="space-y-3 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <FieldLabel>First Name</FieldLabel>
                            <Input
                                value={form.first_name}
                                onChange={(event) => setField('first_name', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>

                        <div>
                            <FieldLabel>Last Name</FieldLabel>
                            <Input
                                value={form.last_name}
                                onChange={(event) => setField('last_name', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div>
                        <FieldLabel>Email Address</FieldLabel>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                            <Input
                                type="email"
                                value={form.email}
                                onChange={(event) => setField('email', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 pl-8 text-sm"
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <FieldLabel>Role</FieldLabel>
                            <Select
                                value={form.role}
                                onValueChange={handleRoleChange}
                                disabled={saving}
                            >
                                <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
                                    <SelectValue />
                                </SelectTrigger>

                                <SelectContent>
                                    {ROLE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <FieldLabel>Phone Number</FieldLabel>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                                <Input
                                    value={form.phone_number}
                                    onChange={(event) => setField('phone_number', event.target.value)}
                                    className="h-9 rounded-lg border-stone-200 pl-8 text-sm"
                                    disabled={saving}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <FieldLabel>Department</FieldLabel>
                            <Input
                                value={form.department}
                                onChange={(event) => setField('department', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>

                        <div>
                            <FieldLabel>Position</FieldLabel>
                            <Input
                                value={form.position}
                                onChange={(event) => setField('position', event.target.value)}
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                        <p className="mb-2 text-xs font-semibold text-stone-700">
                            Password Reset
                        </p>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <FieldLabel>New Password</FieldLabel>
                                <Input
                                    type="password"
                                    value={form.password}
                                    onChange={(event) => setField('password', event.target.value)}
                                    className="h-9 rounded-lg border-stone-200 text-sm"
                                    placeholder="Leave blank to keep current"
                                    disabled={saving}
                                />
                            </div>

                            <div>
                                <FieldLabel>Confirm New Password</FieldLabel>
                                <Input
                                    type="password"
                                    value={form.confirm_password}
                                    onChange={(event) => setField('confirm_password', event.target.value)}
                                    className="h-9 rounded-lg border-stone-200 text-sm"
                                    placeholder="Leave blank to keep current"
                                    disabled={saving}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                        className="h-8 rounded-lg border-stone-200 text-xs"
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={onSave}
                        disabled={saving}
                        className="h-8 rounded-lg border-none px-3 text-xs text-white"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function AccountsPanel() {
    const [accounts, setAccounts] = useState([]);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [editForm, setEditForm] = useState(DEFAULT_FORM);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingAccountId, setEditingAccountId] = useState(null);

    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [pageTab, setPageTab] = useState('current');
    const [roleFilter, setRoleFilter] = useState('all');

    const currentCount = useMemo(
        () => accounts.filter((account) => account.is_archived !== true).length,
        [accounts]
    );

    const archivedCount = useMemo(
        () => accounts.filter((account) => account.is_archived === true).length,
        [accounts]
    );

    const filteredAccounts = useMemo(() => {
        const q = search.trim().toLowerCase();

        return accounts.filter((account) => {
            const isArchived = account.is_archived === true;

            if (pageTab === 'current' && isArchived) return false;
            if (pageTab === 'archived' && !isArchived) return false;

            if (!accountMatchesRoleGroup(account, roleFilter)) return false;

            if (!q) return true;

            return (
                String(account.name || '').toLowerCase().includes(q) ||
                String(account.first_name || '').toLowerCase().includes(q) ||
                String(account.last_name || '').toLowerCase().includes(q) ||
                String(account.email || '').toLowerCase().includes(q) ||
                String(account.department || '').toLowerCase().includes(q) ||
                String(account.position || '').toLowerCase().includes(q)
            );
        });
    }, [accounts, search, pageTab, roleFilter]);

    const visibleRoleOptions = useMemo(() => {
        if (roleFilter === 'admin') {
            return ROLE_OPTIONS.filter((role) => role.value === 'admin');
        }

        if (roleFilter === 'office') {
            return ROLE_OPTIONS.filter((role) => ['sdo', 'guidance'].includes(role.value));
        }

        if (roleFilter === 'pd') {
            return ROLE_OPTIONS.filter((role) => role.value === 'pd');
        }

        return ROLE_OPTIONS;
    }, [roleFilter]);

    const groupedAccounts = useMemo(() => {
        return visibleRoleOptions.map((role) => ({
            ...role,
            accounts: filteredAccounts.filter((account) => account.role === role.value),
        }));
    }, [filteredAccounts, visibleRoleOptions]);

    const loadAccounts = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(buildApiUrl('/api/accounts/staff'), {
                headers: getAuthHeaders(),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.error?.message ||
                    data.message ||
                    'Failed to load staff accounts.'
                );
            }

            setAccounts(Array.isArray(data.data) ? data.data : []);
        } catch (err) {
            setError(err.message || 'Failed to load staff accounts.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    useSocketEvent(
        'maintenance:updated',
        (payload = {}) => {
            if (!payload?.module || payload.module === 'accounts') {
                loadAccounts();
            }
        },
        [loadAccounts]
    );

    const setField = (field, value) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
        setError('');
    };

    const handleRoleChange = (role) => {
        const defaults = ROLE_OPTIONS.find((option) => option.value === role);

        setForm((current) => ({
            ...current,
            role,
            department: defaults?.department || current.department,
            position: defaults?.position || current.position,
        }));

        setError('');
    };

    const openCreateModal = () => {
        const defaults = ROLE_OPTIONS[0];

        setForm({
            ...DEFAULT_FORM,
            role: defaults.value,
            department: defaults.department,
            position: defaults.position,
        });

        setError('');
        setCreateOpen(true);
    };

    const closeCreateModal = () => {
        if (saving) return;

        setCreateOpen(false);
        setError('');
    };

    const openEditModal = (account) => {
        setEditingAccountId(account.user_id);

        setEditForm({
            first_name: account.first_name || '',
            last_name: account.last_name || '',
            email: account.email || '',
            phone_number: account.phone_number || '',
            role: account.role || 'admin',
            department: account.department || '',
            position: account.position || '',
            password: '',
            confirm_password: '',
        });

        setEditOpen(true);
    };

    const closeEditModal = () => {
        if (updating) return;

        setEditOpen(false);
        setEditingAccountId(null);
        setEditForm(DEFAULT_FORM);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const validationError = validateCreateForm(form);

        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            setSaving(true);
            setError('');

            const response = await fetch(buildApiUrl('/api/accounts/staff'), {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    ...form,
                    email: form.email.trim().toLowerCase(),
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.error?.message ||
                    data.message ||
                    'Failed to create staff account.'
                );
            }

            const createdAccount = data.data;
            const defaults =
                ROLE_OPTIONS.find((option) => option.value === form.role) ||
                ROLE_OPTIONS[0];

            setAccounts((current) => [createdAccount, ...current]);
            setForm({
                ...DEFAULT_FORM,
                role: form.role,
                department: defaults.department,
                position: defaults.position,
            });
            setPageTab('current');
            setCreateOpen(false);
        } catch (err) {
            setError(err.message || 'Failed to create staff account.');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        const validationError = validateEditForm(editForm);

        if (validationError) {
            alert(validationError);
            return;
        }

        try {
            setUpdating(true);

            const payload = {
                ...editForm,
                email: editForm.email.trim().toLowerCase(),
            };

            if (!payload.password && !payload.confirm_password) {
                delete payload.password;
                delete payload.confirm_password;
            }

            const response = await fetch(
                buildApiUrl(`/api/accounts/staff/${editingAccountId}`),
                {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.error?.message ||
                    data.message ||
                    'Failed to update staff account.'
                );
            }

            await loadAccounts();
            closeEditModal();
        } catch (err) {
            alert(err.message || 'Failed to update staff account.');
        } finally {
            setUpdating(false);
        }
    };

    const handleArchiveRestore = async (account) => {
        const isRestore = account.is_archived === true;

        try {
            setActionLoadingId(account.user_id);

            const response = await fetch(
                buildApiUrl(
                    `/api/accounts/staff/${account.user_id}/${isRestore ? 'restore' : 'archive'}`
                ),
                {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.error?.message ||
                    data.message ||
                    'Failed to update account status.'
                );
            }

            await loadAccounts();

            if (isRestore) {
                setPageTab('current');
            }
        } catch (err) {
            alert(err.message || 'Failed to update account status.');
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <StaffCreateModal
                open={createOpen}
                form={form}
                saving={saving}
                error={error}
                setField={setField}
                handleRoleChange={handleRoleChange}
                onClose={closeCreateModal}
                onSubmit={handleSubmit}
            />

            <StaffEditModal
                open={editOpen}
                form={editForm}
                setForm={setEditForm}
                saving={updating}
                onClose={closeEditModal}
                onSave={handleUpdate}
            />

            <div className="space-y-3">
                <div className="rounded-xl border border-stone-200 bg-white px-4 py-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Staff Account Records
                                </p>
                                <p className="mt-1 text-sm font-semibold text-stone-900">
                                    {currentCount} active · {archivedCount} archived
                                </p>
                            </div>

                            <div className="relative w-full md:w-[320px]">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                                <Input
                                    placeholder="Search account..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="h-9 rounded-lg border-stone-200 bg-white pl-9 text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-stone-100 pt-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPageTab('current')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${pageTab === 'current'
                                            ? 'bg-[#7c4a2e] text-white'
                                            : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                        }`}
                                >
                                    Current ({currentCount})
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPageTab('archived')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${pageTab === 'archived'
                                            ? 'bg-[#7c4a2e] text-white'
                                            : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                        }`}
                                >
                                    Archived ({archivedCount})
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Select value={roleFilter} onValueChange={setRoleFilter}>
                                    <SelectTrigger className="h-8 w-[185px] rounded-lg border-stone-200 bg-white text-xs">
                                        <SelectValue placeholder="Filter account type" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        <SelectItem value="all">All Staff</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="office">Office (SDO/GCO)</SelectItem>
                                        <SelectItem value="pd">Program Director</SelectItem>
                                    </SelectContent>
                                </Select>

                                {(search || roleFilter !== 'all') && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setSearch('');
                                            setRoleFilter('all');
                                        }}
                                        className="h-8 rounded-lg border-stone-200 text-xs"
                                    >
                                        Reset
                                    </Button>
                                )}

                                <Button
                                    variant="outline"
                                    onClick={loadAccounts}
                                    disabled={loading}
                                    className="h-8 rounded-lg border-stone-200 text-xs"
                                >
                                    {loading ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    Refresh
                                </Button>

                                <Button
                                    size="sm"
                                    onClick={openCreateModal}
                                    className="h-8 rounded-lg border-none text-xs text-white"
                                    style={{ background: C.brownMid }}
                                >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Add
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-stone-200 bg-white p-4">
                    {loading ? (
                        <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-xs text-stone-400">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Loading staff accounts...
                        </div>
                    ) : error ? (
                        <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-6 text-center text-xs text-red-700">
                            <AlertTriangle className="h-5 w-5" />
                            {error}
                        </div>
                    ) : filteredAccounts.length === 0 ? (
                        <EmptyState
                            icon={UsersRound}
                            title={
                                pageTab === 'archived'
                                    ? 'No archived staff accounts'
                                    : 'No staff accounts found'
                            }
                            subtitle={
                                pageTab === 'archived'
                                    ? 'Archived staff accounts will appear here.'
                                    : 'Create the first role-based account using the Add button.'
                            }
                        />
                    ) : (
                        <div className="space-y-4">
                            {groupedAccounts.map((group) => (
                                <div key={group.value} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleTone(group.value)}`}
                                        >
                                            {group.label}
                                        </span>
                                        <span className="text-[11px] text-stone-400">
                                            {group.accounts.length} account
                                            {group.accounts.length === 1 ? '' : 's'}
                                        </span>
                                    </div>

                                    {group.accounts.length ? (
                                        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                                            {group.accounts.map((account) => {
                                                const isBusy =
                                                    actionLoadingId === account.user_id;

                                                return (
                                                    <div
                                                        key={account.user_id}
                                                        className={`rounded-xl border px-3 py-3 ${account.is_archived
                                                                ? 'border-stone-200 bg-stone-50'
                                                                : 'border-stone-200 bg-white'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <p className="truncate text-sm font-semibold text-stone-900">
                                                                        {account.name}
                                                                    </p>

                                                                    {account.is_archived && (
                                                                        <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] text-red-700">
                                                                            Archived
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <p className="truncate text-xs text-stone-500">
                                                                    {account.email}
                                                                </p>
                                                            </div>

                                                            <ShieldCheck className="h-4 w-4 shrink-0 text-stone-300" />
                                                        </div>

                                                        <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-stone-500 sm:grid-cols-2">
                                                            <span className="truncate">
                                                                {account.department || 'No department'}
                                                            </span>
                                                            <span className="truncate">
                                                                {account.position || 'No position'}
                                                            </span>
                                                        </div>

                                                        <div className="mt-3 flex flex-wrap justify-end gap-1.5">
                                                            {account.is_archived ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleArchiveRestore(account)}
                                                                    disabled={isBusy}
                                                                    className="h-7 rounded-lg border-green-200 px-2 text-xs text-green-700 hover:bg-green-50"
                                                                >
                                                                    {isBusy ? (
                                                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                    ) : (
                                                                        <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                                                                    )}
                                                                    Restore
                                                                </Button>
                                                            ) : (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => openEditModal(account)}
                                                                        disabled={isBusy}
                                                                        className="h-7 rounded-lg border-stone-200 px-2 text-xs"
                                                                    >
                                                                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                                        Edit
                                                                    </Button>

                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleArchiveRestore(account)}
                                                                        disabled={isBusy}
                                                                        className="h-7 rounded-lg border-red-200 px-2 text-xs text-red-700 hover:bg-red-50"
                                                                    >
                                                                        {isBusy ? (
                                                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Archive className="mr-1.5 h-3.5 w-3.5" />
                                                                        )}
                                                                        Archive
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-4 text-center text-xs text-stone-400">
                                            No {group.label} accounts.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}