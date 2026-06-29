import React, { useEffect, useMemo, useState } from 'react';
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
    CheckCircle2,
    Loader2,
    Mail,
    Phone,
    Plus,
    RefreshCw,
    ShieldCheck,
    UserRound,
    UsersRound,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { C, EmptyState, FieldLabel, GroupCard } from './components/MaintenanceShared';

const ROLE_OPTIONS = [
    { value: 'admin', label: 'Admin', department: 'OSFA', position: 'OSFA Administrator' },
    { value: 'pd', label: 'PD', department: 'Program Department', position: 'Program Director' },
    { value: 'guidance', label: 'Guidance', department: 'Guidance Office', position: 'Guidance Staff' },
    { value: 'sdo', label: 'SDO', department: 'Student Disciplinary Office', position: 'SDO Officer' },
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

function roleLabel(role) {
    return ROLE_OPTIONS.find((option) => option.value === role)?.label || role || 'Staff';
}

function roleTone(role) {
    if (role === 'admin') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (role === 'pd') return 'bg-purple-50 text-purple-700 border-purple-100';
    if (role === 'guidance') return 'bg-blue-50 text-blue-700 border-blue-100';
    if (role === 'sdo') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    return 'bg-stone-50 text-stone-700 border-stone-100';
}

function validateForm(form) {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
        return 'First name, last name, and email are required.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        return 'Enter a valid email address.';
    }
    if (!form.role) {
        return 'Select an account role.';
    }
    if (form.password.length < 8) {
        return 'Password must be at least 8 characters.';
    }
    if (!/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
        return 'Password must include uppercase, lowercase, and number characters.';
    }
    if (form.password !== form.confirm_password) {
        return 'Passwords do not match.';
    }
    return '';
}

export default function AccountsPanel() {
    const [accounts, setAccounts] = useState([]);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const groupedAccounts = useMemo(() => {
        return ROLE_OPTIONS.map((role) => ({
            ...role,
            accounts: accounts.filter((account) => account.role === role.value),
        }));
    }, [accounts]);

    const setField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
        setError('');
        setSuccess('');
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
        setSuccess('');
    };

    const loadAccounts = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await fetch(buildApiUrl('/api/accounts/staff'), {
                headers: getAuthHeaders(),
            });
            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.error?.message || data.message || 'Failed to load staff accounts.');
            }

            setAccounts(Array.isArray(data.data) ? data.data : []);
        } catch (err) {
            setError(err.message || 'Failed to load staff accounts.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAccounts();
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const validationError = validateForm(form);

        if (validationError) {
            setError(validationError);
            setSuccess('');
            return;
        }

        try {
            setSaving(true);
            setError('');
            setSuccess('');

            const response = await fetch(buildApiUrl('/api/accounts/staff'), {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    ...form,
                    email: form.email.trim().toLowerCase(),
                }),
            });
            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.error?.message || data.message || 'Failed to create staff account.');
            }

            const createdAccount = data.data;
            setAccounts((current) => [createdAccount, ...current]);
            const defaults = ROLE_OPTIONS.find((option) => option.value === form.role) || ROLE_OPTIONS[0];
            setForm({
                ...DEFAULT_FORM,
                role: form.role,
                department: defaults.department,
                position: defaults.position,
            });
            setSuccess(`${createdAccount.name || createdAccount.email} can now sign in to the ${roleLabel(createdAccount.role)} portal.`);
        } catch (err) {
            setError(err.message || 'Failed to create staff account.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-stone-900">Role-Based Account Creation</h2>
                    <p className="mt-0.5 text-xs text-stone-500">
                        Create admin, PD, Guidance, and SDO staff accounts for their assigned portals.
                    </p>
                </div>

                <Button
                    variant="outline"
                    onClick={loadAccounts}
                    disabled={loading}
                    className="h-8 rounded-lg border-stone-200 text-xs"
                >
                    {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(360px,0.9fr)_1.4fr]">
                <GroupCard title="Create Staff Account" icon={UserRound}>
                    <form className="space-y-3" onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <FieldLabel>First Name</FieldLabel>
                                <Input value={form.first_name} onChange={(event) => setField('first_name', event.target.value)} className="h-9 rounded-lg border-stone-200 text-sm" />
                            </div>
                            <div>
                                <FieldLabel>Last Name</FieldLabel>
                                <Input value={form.last_name} onChange={(event) => setField('last_name', event.target.value)} className="h-9 rounded-lg border-stone-200 text-sm" />
                            </div>
                        </div>

                        <div>
                            <FieldLabel>Email Address</FieldLabel>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                                <Input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} className="h-9 rounded-lg border-stone-200 pl-8 text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <FieldLabel>Role</FieldLabel>
                                <Select value={form.role} onValueChange={handleRoleChange}>
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
                                    <Input value={form.phone_number} onChange={(event) => setField('phone_number', event.target.value)} className="h-9 rounded-lg border-stone-200 pl-8 text-sm" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <FieldLabel>Department</FieldLabel>
                                <Input value={form.department} onChange={(event) => setField('department', event.target.value)} className="h-9 rounded-lg border-stone-200 text-sm" />
                            </div>
                            <div>
                                <FieldLabel>Position</FieldLabel>
                                <Input value={form.position} onChange={(event) => setField('position', event.target.value)} className="h-9 rounded-lg border-stone-200 text-sm" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <FieldLabel>Password</FieldLabel>
                                <Input type="password" value={form.password} onChange={(event) => setField('password', event.target.value)} className="h-9 rounded-lg border-stone-200 text-sm" />
                            </div>
                            <div>
                                <FieldLabel>Confirm Password</FieldLabel>
                                <Input type="password" value={form.confirm_password} onChange={(event) => setField('confirm_password', event.target.value)} className="h-9 rounded-lg border-stone-200 text-sm" />
                            </div>
                        </div>

                        {error ? (
                            <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{error}</span>
                            </div>
                        ) : null}

                        {success ? (
                            <div className="flex items-start gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{success}</span>
                            </div>
                        ) : null}

                        <div className="flex justify-end pt-1">
                            <Button type="submit" disabled={saving} className="h-8 rounded-lg border-none px-3 text-xs text-white" style={{ background: C.brownMid }}>
                                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                                Create Account
                            </Button>
                        </div>
                    </form>
                </GroupCard>

                <GroupCard title="Staff Accounts" icon={UsersRound}>
                    {loading ? (
                        <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-xs text-stone-400">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Loading staff accounts...
                        </div>
                    ) : accounts.length === 0 ? (
                        <EmptyState icon={UsersRound} title="No staff accounts yet" subtitle="Create the first role-based account using the form." />
                    ) : (
                        <div className="space-y-4">
                            {groupedAccounts.map((group) => (
                                <div key={group.value} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleTone(group.value)}`}>
                                            {group.label}
                                        </span>
                                        <span className="text-[11px] text-stone-400">{group.accounts.length} account{group.accounts.length === 1 ? '' : 's'}</span>
                                    </div>

                                    {group.accounts.length ? (
                                        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                                            {group.accounts.map((account) => (
                                                <div key={account.user_id} className="rounded-xl border border-stone-200 bg-white px-3 py-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold text-stone-900">{account.name}</p>
                                                            <p className="truncate text-xs text-stone-500">{account.email}</p>
                                                        </div>
                                                        <ShieldCheck className="h-4 w-4 shrink-0 text-stone-300" />
                                                    </div>
                                                    <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-stone-500 sm:grid-cols-2">
                                                        <span className="truncate">{account.department || 'No department'}</span>
                                                        <span className="truncate">{account.position || 'No position'}</span>
                                                    </div>
                                                </div>
                                            ))}
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
                </GroupCard>
            </div>
        </div>
    );
}
