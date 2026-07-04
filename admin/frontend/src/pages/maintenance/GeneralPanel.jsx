import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Globe, Calendar, Save, Check } from 'lucide-react';
import { C, FieldLabel, GroupCard, Toggle } from './components/MaintenanceShared';

export default function GeneralPanel() {
    const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');
    const [officeEmail, setOfficeEmail] = useState('osfa@pdm.edu.ph');
    const [globalDeadline, setGlobalDeadline] = useState('2026-03-31');
    const [appOpen, setAppOpen] = useState(true);
    const [saved, setSaved] = useState(false);

    const handleSaveGeneral = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
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
        </div>
    );
}
