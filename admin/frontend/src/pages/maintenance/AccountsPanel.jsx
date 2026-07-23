import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
    Building2,
    ChevronDown,
    Edit,
    Eye,
    EyeOff,
    Filter,
    Info,
    Loader2,
    Mail,
    Phone,
    Plus,
    RefreshCw,
    Save,
    Search,
    UsersRound,
    X,
} from 'lucide-react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { C, EmptyState, FieldLabel } from './components/MaintenanceShared';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
    {
        value: 'admin',
        label: 'Admin',
        department: 'Office for Scholarship and Financial Assistance (OSFA)',
        position: 'OSFA Administrator',
    },
    {
        value: 'pd',
        label: 'Program Director',
        department: '',
        position: 'Program Director',
    },
    {
        value: 'guidance',
        label: 'GCO',
        department: 'Guidance and Counseling Office',
        position: 'Guidance Staff',
    },
    {
        value: 'sdo',
        label: 'SDO',
        department: 'Student Welfare and Development Office',
        position: 'SDO Officer',
    },
];

const DEPARTMENT_OPTIONS = {
    admin: [
        {
            value: 'Office for Scholarship and Financial Assistance (OSFA)',
            label: 'Office for Scholarship and Financial Assistance (OSFA)',
        },
    ],
    pd: [
        {
            value: 'Office of the College of Hospitality and Tourism Management',
            label: 'Hospitality and Tourism Management',
            hint: 'HM and TM',
        },
        {
            value: 'Office of the College of Computer Studies',
            label: 'College of Computer Studies',
            hint: 'IT and CS',
        },
        {
            value: 'Office of the Program Head - Office Administration',
            label: 'Program Head - Office Administration',
            hint: 'OAD and Entrep',
        },
        {
            value: 'Office of the Program Head - Teacher Education Program',
            label: 'Program Head - Teacher Education',
            hint: 'BTLED and BECED',
        },
    ],
    guidance: [
        {
            value: 'Guidance and Counseling Office',
            label: 'Guidance and Counseling Office',
        },
    ],
    sdo: [
        {
            value: 'Student Welfare and Development Office',
            label: 'Student Welfare and Development Office',
        },
    ],
};

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
    course_ids: [],
};

function inferPdDepartment(assignedCourses = []) {
    const departmentByCode = new Map([
        ['HM', DEPARTMENT_OPTIONS.pd[0].value],
        ['BSHM', DEPARTMENT_OPTIONS.pd[0].value],
        ['TM', DEPARTMENT_OPTIONS.pd[0].value],
        ['BSTM', DEPARTMENT_OPTIONS.pd[0].value],
        ['IT', DEPARTMENT_OPTIONS.pd[1].value],
        ['BSIT', DEPARTMENT_OPTIONS.pd[1].value],
        ['CS', DEPARTMENT_OPTIONS.pd[1].value],
        ['BSCS', DEPARTMENT_OPTIONS.pd[1].value],
        ['OAD', DEPARTMENT_OPTIONS.pd[2].value],
        ['BSOA', DEPARTMENT_OPTIONS.pd[2].value],
        ['ENTREP', DEPARTMENT_OPTIONS.pd[2].value],
        ['BSENTREP', DEPARTMENT_OPTIONS.pd[2].value],
        ['BTLED', DEPARTMENT_OPTIONS.pd[3].value],
        ['BECED', DEPARTMENT_OPTIONS.pd[3].value],
    ]);
    const matches = new Set(
        assignedCourses
            .map((course) => departmentByCode.get(String(course.course_code || '').trim().toUpperCase()))
            .filter(Boolean)
    );

    return matches.size === 1 ? [...matches][0] : '';
}

function normalizeDepartment(role, department, assignedCourses = []) {
    const options = DEPARTMENT_OPTIONS[role] || [];
    const current = String(department || '').trim();

    if (options.some((option) => option.value === current)) return current;
    if (role === 'pd') return inferPdDepartment(assignedCourses);
    return options[0]?.value || '';
}

function DepartmentField({ role, value, onChange, disabled = false }) {
    const options = DEPARTMENT_OPTIONS[role] || [];

    return (
        <div>
            <FieldLabel>Department / Office</FieldLabel>
            <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
                    <SelectValue placeholder="Select department or office" />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            <span className="flex flex-col">
                                <span>{option.label}</span>
                                {option.hint ? (
                                    <span className="text-[11px] text-stone-500">{option.hint} courses</span>
                                ) : null}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {role === 'pd' ? (
                <p className="mt-1 text-[11px] text-stone-500">
                    Choose the office that supervises the assigned courses.
                </p>
            ) : null}
        </div>
    );
}

function CourseAssignmentField({ form, setField, courses, currentUserId = null, disabled = false }) {
    const [open, setOpen] = useState(false);
    if (form.role !== 'pd') return null;
    const selected = new Set(form.course_ids || []);
    const selectedCourses = courses.filter((course) => selected.has(course.course_id));
    const isOwnedByAnother = (course) => course.assigned_pd?.user_id && course.assigned_pd.user_id !== currentUserId;
    const availableCourses = courses.filter((course) => !isOwnedByAnother(course));
    const unavailableCourses = courses.filter(isOwnedByAnother);

    const toggleCourse = (courseId) => {
        setField('course_ids', selected.has(courseId)
            ? [...selected].filter((id) => id !== courseId)
            : [...selected, courseId]);
    };

    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="text-xs font-semibold text-stone-700">Assigned courses</label>
                <span className="text-xs text-stone-500">
                    {selected.size} selected
                </span>
            </div>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled || !courses.length}
                        aria-expanded={open}
                        className="flex h-10 w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-3 text-left text-sm shadow-sm outline-none transition hover:border-stone-300 focus-visible:border-violet-400 focus-visible:ring-2 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:opacity-60"
                    >
                        <span className="text-stone-500">Select courses</span>
                        <ChevronDown className={`h-4 w-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] gap-0 border border-stone-200 bg-white p-1.5 shadow-xl"
                >
                    <Command>
                        <CommandInput placeholder="Search course code or name..." />
                        <CommandList className="max-h-64">
                            <CommandEmpty>No matching course found.</CommandEmpty>
                            <CommandGroup heading="Available courses">
                                {availableCourses.map((course) => {
                                    const isSelected = selected.has(course.course_id);

                                    return (
                                        <CommandItem
                                            key={course.course_id}
                                            value={`${course.course_code} ${course.course_name}`}
                                            disabled={disabled}
                                            data-checked={isSelected}
                                            onSelect={() => toggleCourse(course.course_id)}
                                            className="px-3 py-2.5"
                                        >
                                            <span className="min-w-0 flex-1 truncate">
                                                <span className="font-semibold text-stone-800">{course.course_code}</span>
                                                <span className="ml-2 text-xs text-stone-500">{course.course_name}</span>
                                            </span>
                                        </CommandItem>
                                    );
                                })}
                                {!availableCourses.length ? (
                                    <p className="px-3 py-2 text-xs text-stone-500">No courses are available for assignment.</p>
                                ) : null}
                            </CommandGroup>
                            {unavailableCourses.length ? (
                                <CommandGroup heading="Assigned to another Program Director">
                                    {unavailableCourses.map((course) => (
                                        <CommandItem
                                            key={course.course_id}
                                            value={`${course.course_code} ${course.course_name} ${course.assigned_pd?.name || course.assigned_pd?.email || ''}`}
                                            disabled
                                            className="px-3 py-2.5"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-stone-600">
                                                    {course.course_code}
                                                    <span className="ml-2 text-xs font-normal text-stone-400">{course.course_name}</span>
                                                </span>
                                                <span className="block truncate text-xs text-amber-700">
                                                    Assigned to {course.assigned_pd?.name || course.assigned_pd?.email}
                                                </span>
                                            </span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            ) : null}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <div className="mt-2 flex min-h-6 flex-wrap gap-1.5">
                {selectedCourses.map((course) => (
                    <span
                        key={course.course_id}
                        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 py-1 pl-2 pr-1 text-xs font-medium text-stone-700"
                        title={course.course_name}
                    >
                        {course.course_code}
                        <button
                            type="button"
                            onClick={() => toggleCourse(course.course_id)}
                            disabled={disabled}
                            aria-label={`Remove ${course.course_code}`}
                            className="rounded p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-700 disabled:opacity-50"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                {!selectedCourses.length ? (
                    <p className="self-center text-xs text-stone-400">
                        {courses.length ? 'No courses selected yet.' : 'No active courses are available.'}
                    </p>
                ) : null}
            </div>
            <p className="mt-1.5 text-[11px] text-stone-400">Course options are managed in Maintenance &gt; Courses.</p>
        </div>
    );
}

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
    if (!(DEPARTMENT_OPTIONS[form.role] || []).some((option) => option.value === form.department)) {
        return 'Select a valid department or office.';
    }
    if (form.role === 'pd' && !(form.course_ids || []).length) return 'Select at least one course for the Program Director.';

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
    if (!(DEPARTMENT_OPTIONS[form.role] || []).some((option) => option.value === form.department)) {
        return 'Select a valid department or office.';
    }
    if (form.role === 'pd' && !(form.course_ids || []).length) return 'Select at least one course for the Program Director.';

    return validatePasswordFields(form.password, form.confirm_password, false);
}

function PasswordInput({ label, value, onChange, placeholder = '', disabled = false, optional = false }) {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">{label}</span>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button type="button" className="text-stone-400 hover:text-stone-700" aria-label="View password requirements">
                                <Info className="h-3 w-3" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6}>
                            {optional ? 'Optional. If changed, use ' : 'Use '}8+ characters with uppercase, lowercase, and a number.
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            <div className="relative">
                <Input
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={onChange}
                    className="h-9 rounded-lg border-stone-200 pr-9 text-sm"
                    placeholder={placeholder}
                    disabled={disabled}
                />
                <button
                    type="button"
                    onClick={() => setVisible((current) => !current)}
                    disabled={disabled}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-stone-400 transition hover:text-stone-700 disabled:opacity-50"
                >
                    {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
            </div>
        </div>
    );
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
    courses,
}) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl"
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

                    <CourseAssignmentField form={form} setField={setField} courses={courses} disabled={saving} />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DepartmentField
                            role={form.role}
                            value={form.department}
                            onChange={(value) => setField('department', value)}
                            disabled={saving}
                        />

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
                        <PasswordInput
                            label="Password"
                            value={form.password}
                            onChange={(event) => setField('password', event.target.value)}
                            disabled={saving}
                        />

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
                        <p className="flex items-start gap-1.5 text-xs font-medium text-red-600">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{error}</span>
                        </p>
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
    error,
    onClearError,
    onClose,
    onSave,
    courses,
    currentUserId,
}) {
    if (!open) return null;

    const setField = (field, value) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
        onClearError();
    };

    const handleRoleChange = (role) => {
        const defaults = ROLE_OPTIONS.find((option) => option.value === role);

        setForm((current) => ({
            ...current,
            role,
            course_ids: role === 'pd' ? current.course_ids : [],
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
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl"
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
                        <DepartmentField
                            role={form.role}
                            value={form.department}
                            onChange={(value) => setField('department', value)}
                            disabled={saving}
                        />

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

                    <CourseAssignmentField form={form} setField={setField} courses={courses} currentUserId={currentUserId} disabled={saving} />

                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                        <p className="mb-2 text-xs font-semibold text-stone-700">
                            Password Reset
                        </p>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <PasswordInput
                                label="New Password"
                                value={form.password}
                                onChange={(event) => setField('password', event.target.value)}
                                placeholder="Leave blank to keep current"
                                disabled={saving}
                                optional
                            />

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
                        {error ? (
                            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-600">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{error}</span>
                            </p>
                        ) : null}
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

function StaffProfileModal({ account, onClose, onEdit }) {
    if (!account) return null;

    const roleLabel = ROLE_OPTIONS.find((role) => role.value === account.role)?.label || account.role;
    const initials = `${account.first_name?.[0] || ''}${account.last_name?.[0] || ''}`.toUpperCase() || account.name?.[0]?.toUpperCase() || 'S';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3">
                    <div>
                        <p className="text-sm font-semibold text-stone-900">Staff Profile</p>
                        <p className="mt-0.5 text-xs text-stone-500">Account and assignment information</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close staff profile"
                        className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-4">
                    <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
                        <Avatar className="h-12 w-12">
                            <AvatarImage
                                src={account.avatar_url || account.profile_photo_url || undefined}
                                alt={`${account.name} profile`}
                            />
                            <AvatarFallback className="bg-stone-900 text-sm font-bold text-white">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-base font-semibold text-stone-900">{account.name}</h3>
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${roleTone(account.role)}`}>
                                    {roleLabel}
                                </span>
                            </div>
                            <p className="mt-1 truncate text-sm text-stone-500">{account.email}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${account.is_archived ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {account.is_archived ? 'Archived' : 'Active'}
                        </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3">
                            <div className="flex items-center gap-2 text-stone-400">
                                <Building2 className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-semibold uppercase tracking-wide">Department</span>
                            </div>
                            <p className="mt-1.5 text-sm font-medium text-stone-800">{account.department || 'Not provided'}</p>
                        </div>
                        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Position</p>
                            <p className="mt-1.5 text-sm font-medium text-stone-800">{account.position || 'Not provided'}</p>
                        </div>
                        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3">
                            <div className="flex items-center gap-2 text-stone-400">
                                <Mail className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-semibold uppercase tracking-wide">Email Address</span>
                            </div>
                            <p className="mt-1.5 break-all text-sm font-medium text-stone-800">{account.email}</p>
                        </div>
                        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3">
                            <div className="flex items-center gap-2 text-stone-400">
                                <Phone className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-semibold uppercase tracking-wide">Phone Number</span>
                            </div>
                            <p className="mt-1.5 text-sm font-medium text-stone-800">{account.phone_number || 'Not provided'}</p>
                        </div>
                    </div>

                    {account.role === 'pd' ? (
                        <div className="mt-4 rounded-lg border border-stone-200 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-stone-800">Assigned Courses</p>
                                <span className="text-xs text-stone-500">{account.assigned_courses?.length || 0} total</span>
                            </div>
                            <div className="mt-2 space-y-1.5">
                                {(account.assigned_courses || []).map((course) => (
                                    <div key={course.course_id} className="flex items-center gap-3 rounded-md bg-violet-50 px-2.5 py-2">
                                        <span className="shrink-0 text-xs font-bold text-violet-700">{course.course_code}</span>
                                        <span className="min-w-0 truncate text-xs text-stone-600">{course.course_name}</span>
                                    </div>
                                ))}
                                {!account.assigned_courses?.length ? (
                                    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">No courses are currently assigned.</p>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3">
                    <Button variant="outline" onClick={onClose} className="h-8 rounded-lg border-stone-200 text-xs">
                        Close
                    </Button>
                    {!account.is_archived ? (
                        <Button
                            onClick={() => onEdit(account)}
                            className="h-8 rounded-lg border-none px-3 text-xs text-white"
                            style={{ background: C.brownMid }}
                        >
                            <Edit className="mr-1.5 h-3.5 w-3.5" />
                            Edit Account
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default function AccountsPanel() {
    const [accounts, setAccounts] = useState([]);
    const [courses, setCourses] = useState([]);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [editForm, setEditForm] = useState(DEFAULT_FORM);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingAccountId, setEditingAccountId] = useState(null);
    const [profileAccount, setProfileAccount] = useState(null);

    const [error, setError] = useState('');
    const [editError, setEditError] = useState('');
    const [search, setSearch] = useState('');
    const [pageTab, setPageTab] = useState('current');
    const [roleFilter, setRoleFilter] = useState('all');
    const [courseFilter, setCourseFilter] = useState('all');

    const currentCount = useMemo(
        () => accounts.filter((account) => account.is_archived !== true).length,
        [accounts]
    );

    const archivedCount = useMemo(
        () => accounts.filter((account) => account.is_archived === true).length,
        [accounts]
    );
    const activePdCount = useMemo(
        () => accounts.filter((account) => account.role === 'pd' && !account.is_archived).length,
        [accounts]
    );
    const assignedCourseCount = useMemo(
        () => courses.filter((course) => course.assigned_pd).length,
        [courses]
    );

    const filteredAccounts = useMemo(() => {
        const q = search.trim().toLowerCase();

        return accounts.filter((account) => {
            const isArchived = account.is_archived === true;

            if (pageTab === 'current' && isArchived) return false;
            if (pageTab === 'archived' && !isArchived) return false;

            if (!accountMatchesRoleGroup(account, roleFilter)) return false;
            if (courseFilter !== 'all' && !(account.course_ids || []).includes(courseFilter)) return false;

            if (!q) return true;

            return (
                String(account.name || '').toLowerCase().includes(q) ||
                String(account.first_name || '').toLowerCase().includes(q) ||
                String(account.last_name || '').toLowerCase().includes(q) ||
                String(account.email || '').toLowerCase().includes(q) ||
                String(account.department || '').toLowerCase().includes(q) ||
                String(account.position || '').toLowerCase().includes(q) ||
                (account.assigned_courses || []).some((course) => String(course.course_code || '').toLowerCase().includes(q))
            );
        });
    }, [accounts, search, pageTab, roleFilter, courseFilter]);

    const loadAccounts = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const [response, courseResponse] = await Promise.all([
                fetch(buildApiUrl('/api/accounts/staff'), { headers: getAuthHeaders() }),
                fetch(buildApiUrl('/api/courses'), { headers: getAuthHeaders() }),
            ]);
            const data = await response.json().catch(() => ({}));
            const courseData = await courseResponse.json().catch(() => []);

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.error?.message ||
                    data.message ||
                    'Failed to load staff accounts.'
                );
            }
            if (!courseResponse.ok) throw new Error(courseData.message || 'Failed to load courses.');

            setAccounts(Array.isArray(data.data) ? data.data : []);
            setCourses((Array.isArray(courseData) ? courseData : []).filter((course) => !course.is_archived));
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
            if (!payload?.module || ['accounts', 'courses', 'pd_course_assignments'].includes(payload.module)) {
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
            course_ids: role === 'pd' ? current.course_ids : [],
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
        setEditError('');
        setEditingAccountId(account.user_id);

        setEditForm({
            first_name: account.first_name || '',
            last_name: account.last_name || '',
            email: account.email || '',
            phone_number: account.phone_number || '',
            role: account.role || 'admin',
            department: normalizeDepartment(
                account.role || 'admin',
                account.department,
                account.assigned_courses || []
            ),
            position: account.position || '',
            password: '',
            confirm_password: '',
            course_ids: account.course_ids || [],
        });

        setEditOpen(true);
    };

    const closeEditModal = () => {
        if (updating) return;

        setEditOpen(false);
        setEditError('');
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
            toast.success('Staff account created', {
                description: form.role === 'pd' ? 'The Program Director and course assignments are active.' : 'The account is ready to use.',
            });
        } catch (err) {
            setError(err.message || 'Failed to create staff account.');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        const validationError = validateEditForm(editForm);

        if (validationError) {
            setEditError(validationError);
            return;
        }

        try {
            setUpdating(true);
            setEditError('');

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
            setEditOpen(false);
            setEditingAccountId(null);
            setEditForm(DEFAULT_FORM);
            toast.success('Account updated', { description: 'Account details and course assignments were saved.' });
        } catch (err) {
            setEditError(err.message || 'Failed to update staff account.');
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
            toast.success(isRestore ? 'Account restored' : 'Account archived', {
                description: account.role === 'pd'
                    ? (isRestore ? 'Assign courses again before the Program Director handles applicants.' : 'Active course assignments were released.')
                    : 'The account status was updated successfully.',
            });
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
                courses={courses}
            />

            <StaffEditModal
                open={editOpen}
                form={editForm}
                setForm={setEditForm}
                saving={updating}
                error={editError}
                onClearError={() => setEditError('')}
                onClose={closeEditModal}
                onSave={handleUpdate}
                courses={courses}
                currentUserId={editingAccountId}
            />

            <StaffProfileModal
                account={profileAccount}
                onClose={() => setProfileAccount(null)}
                onEdit={(account) => {
                    setProfileAccount(null);
                    openEditModal(account);
                }}
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
                                <p className="mt-1 text-[11px] text-stone-500">
                                    {activePdCount} Program Director{activePdCount === 1 ? '' : 's'} · {assignedCourseCount} assigned course{assignedCourseCount === 1 ? '' : 's'} · {Math.max(courses.length - assignedCourseCount, 0)} unassigned
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
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-8 rounded-lg border-stone-200 px-3 text-xs">
                                            <Filter className="mr-1.5 h-3.5 w-3.5" />
                                            Filter
                                            {(roleFilter !== 'all' || courseFilter !== 'all') ? (
                                                <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-stone-900 px-1 text-[9px] font-bold text-white">
                                                    {(roleFilter !== 'all' ? 1 : 0) + (courseFilter !== 'all' ? 1 : 0)}
                                                </span>
                                            ) : null}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-72 gap-0 border border-stone-200 bg-white p-3 shadow-xl">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-stone-900">Filter Accounts</p>
                                                <p className="mt-0.5 text-xs text-stone-500">Narrow the staff registry.</p>
                                            </div>
                                            {(roleFilter !== 'all' || courseFilter !== 'all') ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setRoleFilter('all');
                                                        setCourseFilter('all');
                                                    }}
                                                    className="text-xs font-semibold text-stone-600 hover:text-stone-900"
                                                >
                                                    Clear
                                                </button>
                                            ) : null}
                                        </div>

                                        <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
                                            <div>
                                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">Account Role</label>
                                                <Select
                                                    value={roleFilter}
                                                    onValueChange={(value) => {
                                                        setRoleFilter(value);
                                                        if (!['all', 'pd'].includes(value)) setCourseFilter('all');
                                                    }}
                                                >
                                                    <SelectTrigger className="h-9 w-full rounded-lg border-stone-200 bg-white text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Staff</SelectItem>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                        <SelectItem value="office">Office (SDO/GCO)</SelectItem>
                                                        <SelectItem value="pd">Program Director</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">Assigned PD Course</label>
                                                <Select
                                                    value={courseFilter}
                                                    onValueChange={(value) => {
                                                        setCourseFilter(value);
                                                        if (value !== 'all') setRoleFilter('pd');
                                                    }}
                                                >
                                                    <SelectTrigger className="h-9 w-full rounded-lg border-stone-200 bg-white text-xs">
                                                        <SelectValue placeholder="All courses" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Courses</SelectItem>
                                                        {courses.map((course) => (
                                                            <SelectItem key={course.course_id} value={course.course_id}>
                                                                {course.course_code} - {course.course_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                {(search || roleFilter !== 'all' || courseFilter !== 'all') && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setSearch('');
                                            setRoleFilter('all');
                                            setCourseFilter('all');
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

                <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                    {loading ? (
                        <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-xs text-stone-400">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Loading staff accounts...
                        </div>
                    ) : error ? (
                        <div className="m-4 flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-6 text-center text-xs text-red-700">
                            <AlertTriangle className="h-5 w-5" />
                            {error}
                        </div>
                    ) : filteredAccounts.length === 0 ? (
                        <div className="p-4">
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
                        </div>
                    ) : (
                        <div>
                            <div className="hidden grid-cols-[minmax(210px,1.35fr)_145px_minmax(180px,1fr)_minmax(220px,1.25fr)_150px] gap-4 border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500 lg:grid">
                                <span>Account</span>
                                <span>Access</span>
                                <span>Office / Position</span>
                                <span>Assigned Courses</span>
                                <span className="text-right">Actions</span>
                            </div>

                            <div className="divide-y divide-stone-100">
                                {filteredAccounts.map((account) => {
                                    const isBusy = actionLoadingId === account.user_id;
                                    const roleLabel = ROLE_OPTIONS.find((role) => role.value === account.role)?.label || account.role;

                                    return (
                                        <div
                                            key={account.user_id}
                                            className={`grid gap-3 px-4 py-3 transition-colors lg:grid-cols-[minmax(210px,1.35fr)_145px_minmax(180px,1fr)_minmax(220px,1.25fr)_150px] lg:items-center lg:gap-4 ${account.is_archived ? 'bg-stone-50/80' : 'hover:bg-stone-50/60'}`}
                                        >
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage
                                                        src={account.avatar_url || account.profile_photo_url || undefined}
                                                        alt={`${account.name} profile`}
                                                    />
                                                    <AvatarFallback className="bg-stone-100 text-xs font-bold text-stone-600">
                                                        {(account.first_name?.[0] || account.name?.[0] || 'S').toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="truncate text-sm font-semibold text-stone-900">{account.name}</p>
                                                        {account.is_archived ? (
                                                            <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Archived</span>
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-0.5 truncate text-xs text-stone-500">{account.email}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 lg:block">
                                                <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-stone-400 lg:hidden">Access</span>
                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${roleTone(account.role)}`}>
                                                    {roleLabel}
                                                </span>
                                            </div>

                                            <div className="flex min-w-0 gap-2 text-xs lg:block">
                                                <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-stone-400 lg:hidden">Office</span>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-stone-700">{account.department || 'No department'}</p>
                                                    <p className="mt-0.5 truncate text-stone-500">{account.position || 'No position'}</p>
                                                </div>
                                            </div>

                                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                                <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-stone-400 lg:hidden">Courses</span>
                                                {account.role === 'pd' ? (
                                                    <>
                                                        {(account.assigned_courses || []).slice(0, 3).map((course) => (
                                                            <span
                                                                key={course.course_id}
                                                                className="rounded-md border border-violet-100 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700"
                                                                title={course.course_name}
                                                            >
                                                                {course.course_code}
                                                            </span>
                                                        ))}
                                                        {(account.assigned_courses || []).length > 3 ? (
                                                            <span className="text-xs font-medium text-stone-500">+{account.assigned_courses.length - 3} more</span>
                                                        ) : null}
                                                        {!account.assigned_courses?.length ? (
                                                            <span className="text-xs font-medium text-amber-700">Not assigned</span>
                                                        ) : null}
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-stone-400">Not applicable</span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-1.5 lg:justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setProfileAccount(account)}
                                                    disabled={isBusy}
                                                    className="h-8 rounded-lg border-stone-200 px-2.5 text-xs"
                                                >
                                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                                    View
                                                </Button>
                                                {account.is_archived ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleArchiveRestore(account)}
                                                        disabled={isBusy}
                                                        className="h-8 rounded-lg border-green-200 px-2.5 text-xs text-green-700 hover:bg-green-50"
                                                    >
                                                        {isBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />}
                                                        Restore
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => openEditModal(account)}
                                                            disabled={isBusy}
                                                            className="h-8 rounded-lg border-stone-200 px-2.5 text-xs"
                                                        >
                                                            <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleArchiveRestore(account)}
                                                            disabled={isBusy}
                                                            aria-label={`Archive ${account.name}`}
                                                            title="Archive account"
                                                            className="h-8 w-8 rounded-lg border-red-200 p-0 text-red-700 hover:bg-red-50"
                                                        >
                                                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
