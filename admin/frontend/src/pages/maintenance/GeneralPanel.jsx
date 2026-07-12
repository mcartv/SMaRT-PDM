import React, { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Globe, Calendar, Save, Check, MapPin, Clock3, Phone, Building2 } from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { C, FieldLabel, GroupCard, Toggle } from './components/MaintenanceShared';

export default function GeneralPanel() {
    const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');
    const [officeName, setOfficeName] = useState('Office for Scholarship and Financial Assistance');
    const [officeEmail, setOfficeEmail] = useState('osfa@pdm.edu.ph');
    const [officeAddress, setOfficeAddress] = useState('Abangan Norte, Marilao, Bulacan');
    const [landlineNumber, setLandlineNumber] = useState('(044) 919-8191');
    const [officeHours, setOfficeHours] = useState('Monday - Friday, 8:00 AM - 5:00 PM');
    const [globalDeadline, setGlobalDeadline] = useState('2026-03-31');
    const [appOpen, setAppOpen] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const loadGeneralSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const token = sessionStorage.getItem('adminToken') || '';
            const response = await fetch(buildApiUrl('/api/general-settings'), {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to load general settings.');
            }

            setInstName(payload?.institution_name || 'Pambayang Dalubhasaan ng Marilao');
            setOfficeName(payload?.office_name || 'Office for Scholarship and Financial Assistance');
            setOfficeEmail(payload?.office_email || 'osfa@pdm.edu.ph');
            setOfficeAddress(payload?.office_address || 'Abangan Norte, Marilao, Bulacan');
            setLandlineNumber(payload?.landline_number || '(044) 919-8191');
            setOfficeHours(payload?.office_hours || 'Monday - Friday, 8:00 AM - 5:00 PM');
            setGlobalDeadline(payload?.global_deadline || '2026-03-31');
            setAppOpen(typeof payload?.applications_open === 'boolean' ? payload.applications_open : true);
        } catch (nextError) {
            setError(nextError.message || 'Failed to load general settings.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadGeneralSettings();
    }, [loadGeneralSettings]);

    useSocketEvent(
        'maintenance:updated',
        (payload) => {
            if (payload?.source !== 'general_settings') return;
            loadGeneralSettings();
        },
        [loadGeneralSettings]
    );

    const handleSaveGeneral = async () => {
        try {
            setError('');
            const token = sessionStorage.getItem('adminToken') || '';
            const response = await fetch(buildApiUrl('/api/general-settings'), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    institution_name: instName,
                    office_name: officeName,
                    office_email: officeEmail,
                    office_address: officeAddress,
                    landline_number: landlineNumber,
                    office_hours: officeHours,
                    global_deadline: globalDeadline,
                    applications_open: appOpen,
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to save general settings.');
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (nextError) {
            setError(nextError.message || 'Failed to save general settings.');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-stone-900">General Configuration</h2>
                    <p className="mt-0.5 text-xs text-stone-500">
                        System preferences and application settings
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

            {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            ) : null}

            {loading ? (
                <div className="rounded-xl border border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                    Loading general settings...
                </div>
            ) : null}

            <div className={`grid grid-cols-1 gap-4 lg:grid-cols-2 ${loading ? 'opacity-60' : ''}`}>
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
                            <FieldLabel>Office Name</FieldLabel>
                            <Input
                                value={officeName}
                                onChange={(e) => setOfficeName(e.target.value)}
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

                <GroupCard title="Office Contact" icon={Building2}>
                    <div className="space-y-3">
                        <div>
                            <FieldLabel>Office Address</FieldLabel>
                            <div className="relative">
                                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                                <Input
                                    value={officeAddress}
                                    onChange={(e) => setOfficeAddress(e.target.value)}
                                    className="h-9 rounded-lg border-stone-200 bg-stone-50/50 pl-9 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <FieldLabel>Landline Number</FieldLabel>
                            <div className="relative">
                                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                                <Input
                                    value={landlineNumber}
                                    onChange={(e) => setLandlineNumber(e.target.value)}
                                    className="h-9 rounded-lg border-stone-200 bg-stone-50/50 pl-9 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <FieldLabel>Office Hours</FieldLabel>
                            <div className="relative">
                                <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                                <Input
                                    value={officeHours}
                                    onChange={(e) => setOfficeHours(e.target.value)}
                                    className="h-9 rounded-lg border-stone-200 bg-stone-50/50 pl-9 text-sm"
                                />
                            </div>
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
        </div>
    );
}
