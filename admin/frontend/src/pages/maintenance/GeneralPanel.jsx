import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Globe, Calendar, User, Mail, Phone, Save, Check } from 'lucide-react';
import { C, FieldLabel, GroupCard, Toggle } from './components/MaintenanceShared';

const DEFAULT_ADMIN_ACCOUNT = {
    first_name: 'Carmelita',
    last_name: 'Dela Cruz',
    email: 'cdelacruz@pdm.edu.ph',
    phone_number: '+63 917 123 4567',
    position: 'OSFA Administrator',
    department: 'OSFA',
    role: 'Super Admin',
    is_active: true,
};

export default function GeneralPanel() {
    const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');
    const [officeEmail, setOfficeEmail] = useState('osfa@pdm.edu.ph');
    const [globalDeadline, setGlobalDeadline] = useState('2026-03-31');
    const [appOpen, setAppOpen] = useState(true);
    const [saved, setSaved] = useState(false);

    const [adminAccount, setAdminAccount] = useState(DEFAULT_ADMIN_ACCOUNT);

    const handleSaveGeneral = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleAdminFieldChange = (field, value) => {
        setAdminAccount((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSaveAdminAccount = async () => {
        try {
            alert('Admin account changes are ready to be connected to backend.');
        } catch (err) {
            console.error('ADMIN ACCOUNT SAVE ERROR:', err);
            alert('Failed to save admin account changes');
        }
    };

    const handleResetAdminAccount = () => {
        setAdminAccount(DEFAULT_ADMIN_ACCOUNT);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-stone-900">General Configuration</h2>
                    <p className="mt-0.5 text-xs text-stone-500">
                        System preferences and admin account settings
                    </p>
                </div>

                <Button
                    onClick={handleSaveGeneral}
                    className="h-8 rounded-lg border-none px-3 text-xs text-white"
                    style={{ background: saved ? C.green : C.brownMid }}
                >
                    {saved ? (
                        <Check size={14} className="mr-1.5" />
                    ) : (
                        <Save size={14} className="mr-1.5" />
                    )}
                    {saved ? 'Saved' : 'Save Changes'}
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <GroupCard title="Institution Info" icon={Globe}>
                    <div className="space-y-3">
                        <div>
                            <FieldLabel>Institution Name</FieldLabel>
                            <Input
                                value={instName}
                                onChange={(e) => setInstName(e.target.value)}
                                className="h-9 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                            />
                        </div>

                        <div>
                            <FieldLabel>Office Email</FieldLabel>
                            <Input
                                value={officeEmail}
                                onChange={(e) => setOfficeEmail(e.target.value)}
                                className="h-9 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                            />
                        </div>
                    </div>
                </GroupCard>

                <GroupCard title="Application Window" icon={Calendar}>
                    <div className="space-y-3">
                        <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-3">
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                                Status
                            </p>
                            <Toggle
                                value={appOpen}
                                onChange={setAppOpen}
                                labels={['Registration Open', 'Registration Closed']}
                            />
                        </div>

                        <div>
                            <FieldLabel>Global Deadline</FieldLabel>
                            <Input
                                type="date"
                                value={globalDeadline}
                                onChange={(e) => setGlobalDeadline(e.target.value)}
                                className="h-9 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                            />
                        </div>
                    </div>
                </GroupCard>
            </div>

            <GroupCard title="Admin Account Management" icon={User}>
                <div className="space-y-4">
                    <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3">
                        <p className="text-xs font-medium text-amber-800">
                            Profile editing is managed here under General Maintenance.
                        </p>
                        <p className="mt-1 text-[11px] text-amber-700">
                            Use this section to update the current admin account information shown in the profile page.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <FieldLabel>First Name</FieldLabel>
                            <Input
                                value={adminAccount.first_name}
                                onChange={(e) => handleAdminFieldChange('first_name', e.target.value)}
                                className="h-9 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                            />
                        </div>

                        <div>
                            <FieldLabel>Last Name</FieldLabel>
                            <Input
                                value={adminAccount.last_name}
                                onChange={(e) => handleAdminFieldChange('last_name', e.target.value)}
                                className="h-9 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                            />
                        </div>

                        <div>
                            <FieldLabel>Email Address</FieldLabel>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                                <Input
                                    value={adminAccount.email}
                                    onChange={(e) => handleAdminFieldChange('email', e.target.value)}
                                    className="h-9 rounded-lg border-stone-200 bg-stone-50/50 pl-8 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <FieldLabel>Phone Number</FieldLabel>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                                <Input
                                    value={adminAccount.phone_number}
                                    onChange={(e) => handleAdminFieldChange('phone_number', e.target.value)}
                                    className="h-9 rounded-lg border-stone-200 bg-stone-50/50 pl-8 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <FieldLabel>Position</FieldLabel>
                            <Input
                                value={adminAccount.position}
                                onChange={(e) => handleAdminFieldChange('position', e.target.value)}
                                className="h-9 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                            />
                        </div>

                        <div>
                            <FieldLabel>Department</FieldLabel>
                            <Input
                                value={adminAccount.department}
                                onChange={(e) => handleAdminFieldChange('department', e.target.value)}
                                className="h-9 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-stone-400">Role</p>
                            <p className="mt-1 text-xs font-medium text-stone-800">
                                {adminAccount.role}
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-stone-400">Account Status</p>
                            <p className="mt-1 text-xs font-medium text-stone-800">
                                {adminAccount.is_active ? 'Active' : 'Inactive'}
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-stone-400">Display Name</p>
                            <p className="mt-1 text-xs font-medium text-stone-800">
                                {adminAccount.first_name} {adminAccount.last_name}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                            variant="outline"
                            className="h-8 rounded-lg border-stone-200 text-xs"
                            onClick={handleResetAdminAccount}
                        >
                            Reset
                        </Button>

                        <Button
                            onClick={handleSaveAdminAccount}
                            className="h-8 rounded-lg border-none text-xs text-white"
                            style={{ background: C.brownMid }}
                        >
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            Save Admin Account
                        </Button>
                    </div>
                </div>
            </GroupCard>
        </div>
    );
}