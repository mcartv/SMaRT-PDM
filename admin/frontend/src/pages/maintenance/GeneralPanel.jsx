import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Globe, Calendar, User, Mail, Phone, Save, Check } from 'lucide-react';
import { C, FieldLabel, GroupCard, Toggle } from './components/MaintenanceShared';

export default function GeneralPanel() {
    const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');
    const [appOpen, setAppOpen] = useState(true);
    const [saved, setSaved] = useState(false);

    const [adminAccount, setAdminAccount] = useState({
        first_name: 'Carmelita',
        last_name: 'Dela Cruz',
        email: 'cdelacruz@pdm.edu.ph',
        phone_number: '+63 917 123 4567',
        position: 'OSFA Administrator',
        department: 'OSFA',
        role: 'Super Admin',
        is_active: true,
    });

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

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-stone-900">General Configuration</h2>
                    <p className="text-sm text-stone-500">
                        System-wide preferences, institutional identity, and admin account settings
                    </p>
                </div>

                <Button
                    onClick={handleSaveGeneral}
                    className="rounded-lg text-white border-none text-xs"
                    style={{ background: saved ? C.green : C.brownMid }}
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
                                defaultValue="osfa@pdm.edu.ph"
                                className="rounded-lg bg-stone-50/50 border-stone-200"
                            />
                        </div>
                    </div>
                </GroupCard>

                <GroupCard title="Application Window" icon={Calendar}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                            <div>
                                <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">
                                    Status
                                </p>
                                <Toggle
                                    value={appOpen}
                                    onChange={setAppOpen}
                                    labels={['Registration Open', 'Registration Closed']}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Global Deadline</FieldLabel>
                            <Input
                                type="date"
                                defaultValue="2026-03-31"
                                className="rounded-lg bg-stone-50/50 border-stone-200"
                            />
                        </div>
                    </div>
                </GroupCard>
            </div>

            <GroupCard title="Admin Account Management" icon={User}>
                <div className="space-y-5">
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                        <p className="text-sm font-medium text-amber-800">
                            Profile editing is managed here under General Maintenance.
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                            Use this section to update the current admin account information shown in the profile page.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <FieldLabel>First Name</FieldLabel>
                            <Input
                                value={adminAccount.first_name}
                                onChange={(e) => handleAdminFieldChange('first_name', e.target.value)}
                                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Last Name</FieldLabel>
                            <Input
                                value={adminAccount.last_name}
                                onChange={(e) => handleAdminFieldChange('last_name', e.target.value)}
                                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Email Address</FieldLabel>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <Input
                                    value={adminAccount.email}
                                    onChange={(e) => handleAdminFieldChange('email', e.target.value)}
                                    className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50 pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Phone Number</FieldLabel>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <Input
                                    value={adminAccount.phone_number}
                                    onChange={(e) => handleAdminFieldChange('phone_number', e.target.value)}
                                    className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50 pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Position</FieldLabel>
                            <Input
                                value={adminAccount.position}
                                onChange={(e) => handleAdminFieldChange('position', e.target.value)}
                                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Department</FieldLabel>
                            <Input
                                value={adminAccount.department}
                                onChange={(e) => handleAdminFieldChange('department', e.target.value)}
                                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-stone-400">Role</p>
                            <p className="text-sm font-medium text-stone-800 mt-1">{adminAccount.role}</p>
                        </div>

                        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-stone-400">Account Status</p>
                            <p className="text-sm font-medium text-stone-800 mt-1">
                                {adminAccount.is_active ? 'Active' : 'Inactive'}
                            </p>
                        </div>

                        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-stone-400">Display Name</p>
                            <p className="text-sm font-medium text-stone-800 mt-1">
                                {adminAccount.first_name} {adminAccount.last_name}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                            variant="outline"
                            className="h-9 rounded-lg border-stone-200 text-xs"
                            onClick={() =>
                                setAdminAccount({
                                    first_name: 'Carmelita',
                                    last_name: 'Dela Cruz',
                                    email: 'cdelacruz@pdm.edu.ph',
                                    phone_number: '+63 917 123 4567',
                                    position: 'OSFA Administrator',
                                    department: 'OSFA',
                                    role: 'Super Admin',
                                    is_active: true,
                                })
                            }
                        >
                            Reset
                        </Button>

                        <Button
                            onClick={handleSaveAdminAccount}
                            className="h-9 rounded-lg text-white text-xs border-none"
                            style={{ background: C.brownMid }}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            Save Admin Account
                        </Button>
                    </div>
                </div>
            </GroupCard>
        </div>
    );
}