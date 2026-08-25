import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cpu, Activity, Database, RefreshCw, Settings } from 'lucide-react';
import { GroupCard, Toggle } from './components/MaintenanceShared';

export default function SystemPanel() {
    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-stone-900">System Efficiency & OCR</h2>
                <p className="text-sm text-stone-500">Core services, engine health, and manual control</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Card className="p-5 border-stone-200 shadow-none flex flex-col items-center justify-center text-center">
                    <Cpu className="w-9 h-9 text-stone-300 mb-3" />
                    <p className="text-2xl font-semibold text-stone-800">Tesseract v5.3</p>
                    <p className="text-[10px] font-medium uppercase text-stone-400 mt-1 tracking-wide">
                        Core OCR Engine
                    </p>
                </Card>

                <Card className="p-5 border-stone-200 shadow-none flex flex-col items-center justify-center text-center">
                    <Activity className="w-9 h-9 text-green-400 mb-3" />
                    <p className="text-2xl font-semibold text-stone-800">94.2%</p>
                    <p className="text-[10px] font-medium uppercase text-stone-400 mt-1 tracking-wide">
                        Success Rate
                    </p>
                </Card>

                <Card className="p-5 border-stone-200 shadow-none flex flex-col items-center justify-center text-center">
                    <Database className="w-9 h-9 text-blue-400 mb-3" />
                    <p className="text-2xl font-semibold text-stone-800">14.2 GB</p>
                    <p className="text-[10px] font-medium uppercase text-stone-400 mt-1 tracking-wide">
                        Storage Used
                    </p>
                </Card>
            </div>

            <GroupCard title="Manual Overrides" icon={Settings}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="p-4 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-stone-800">Maintenance Mode</p>
                            <p className="text-xs text-stone-400 mt-0.5">Disable student portal access</p>
                        </div>
                        <Toggle value={false} onChange={() => { }} labels={['Offline', 'Online']} />
                    </div>

                    <Button
                        variant="outline"
                        className="h-auto py-4 rounded-xl border-stone-200 flex flex-col items-center gap-1 hover:border-stone-400 bg-white"
                    >
                        <RefreshCw size={20} className="text-stone-400" />
                        <span className="text-xs font-medium uppercase tracking-wide">
                            Run Manual DB Backup
                        </span>
                    </Button>
                </div>
            </GroupCard>
        </div>
    );
}