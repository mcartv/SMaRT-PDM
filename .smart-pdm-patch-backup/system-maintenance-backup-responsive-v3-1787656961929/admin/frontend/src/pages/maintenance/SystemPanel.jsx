import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cpu, Activity, Database, RefreshCw, Settings } from 'lucide-react';
import { GroupCard, Toggle } from './components/MaintenanceShared';
import {
    MAINTENANCE_CARD_SUBTITLE_CLASS,
    MAINTENANCE_CARD_TITLE_CLASS,
} from './components/maintenanceTypography';

export default function SystemPanel({ embedded = false }) {
    return (
        <div className="space-y-4">
            {!embedded ? (
                <div>
                    <h2 className={MAINTENANCE_CARD_TITLE_CLASS}>System Efficiency & OCR</h2>
                    <p className={MAINTENANCE_CARD_SUBTITLE_CLASS}>Core services, engine health, and manual control</p>
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card className="flex items-center gap-3 border-stone-200 p-4 shadow-none">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100">
                        <Cpu className="h-5 w-5 text-stone-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-lg font-semibold leading-tight text-stone-900">Tesseract v5.3</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-500">Core OCR Engine</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-3 border-stone-200 p-4 shadow-none">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                        <Activity className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-lg font-semibold leading-tight text-stone-900">94.2%</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-500">Success Rate</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-3 border-stone-200 p-4 shadow-none">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                        <Database className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-lg font-semibold leading-tight text-stone-900">14.2 GB</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-500">Storage Used</p>
                    </div>
                </Card>
            </div>

            <GroupCard title="Manual Overrides" icon={Settings}>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-stone-900">Maintenance Mode</p>
                            <p className="mt-0.5 text-xs text-stone-500">Disable student portal access</p>
                        </div>
                        <Toggle value={false} onChange={() => { }} labels={['Offline', 'Online']} />
                    </div>

                    <Button
                        variant="outline"
                        className="h-16 justify-center rounded-xl border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                    >
                        <RefreshCw className="mr-2 h-4 w-4 text-stone-500" />
                        Run Manual DB Backup
                    </Button>
                </div>
            </GroupCard>
        </div>
    );
}
