import React, { useState } from 'react';
import OfficesPanel from './OfficesPanel';
import CoursesPanel from './CoursesPanel';
import { MAINTENANCE_CARD_TITLE_CLASS } from './components/maintenanceTypography';

export default function InstitutionalManagementPanel() {
    const [view, setView] = useState('offices');
    return <div className="min-w-0 space-y-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
            <h2 className={MAINTENANCE_CARD_TITLE_CLASS}>Offices & Courses</h2>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Offices and courses">
                {[
                    ['offices', 'Offices & Departments'],
                    ['courses', 'Courses'],
                ].map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`min-h-9 rounded-lg px-3 py-2 text-sm font-medium transition ${view === key ? 'text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-50'}`} style={view === key ? { background: 'var(--portal-base)' } : undefined}>{label}</button>)}
            </div>
        </div>
        {view === 'offices' ? <OfficesPanel /> : <CoursesPanel />}
    </div>;
}
