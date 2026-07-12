import React, { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Globe, Calendar, Save, Check, MapPin, Clock3, Phone, Building2, LayoutTemplate, RotateCcw, ChevronDown } from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { C, FieldLabel, GroupCard, Toggle } from './components/MaintenanceShared';

const DEFAULT_ABOUT_OSFA =
    'The Office for Scholarship and Financial Assistance helps manage scholarship access, application review coordination, and student support monitoring for qualified PDM students. Through SMaRT-PDM, applicants and offices can follow a clearer workflow for requirements, endorsement, status tracking, and final scholar readiness.';

const DEFAULT_FAQS = [
    {
        question: 'Who can apply?',
        answer: 'Applicants must meet the eligibility requirements of the scholarship program and submit the required records through the SMaRT-PDM application process.',
    },
    {
        question: 'What documents are required?',
        answer: 'Required documents depend on the scholarship program, but applicants are expected to upload the listed requirements in the system before final review.',
    },
    {
        question: 'How does endorsement work?',
        answer: 'The endorsement slip passes through SDO, Guidance, and Program Director review. Each office records its decision before the slip can be completed.',
    },
    {
        question: 'When does scholar activation happen?',
        answer: 'Scholar activation only happens after both requirements and endorsement are complete and the admin side confirms final readiness.',
    },
];

const DEFAULT_OFFICE = {
    institution_name: 'Pambayang Dalubhasaan ng Marilao',
    office_name: 'Office for Scholarship and Financial Assistance',
    office_email: 'osfa@pdm.edu.ph',
    office_address: 'Abangan Norte, Marilao, Bulacan',
    landline_number: '(044) 919-8191',
    office_hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
};

const DEFAULT_APPLICATION = {
    global_deadline: '2026-03-31',
    applications_open: true,
};

function SectionFrame({ title, description, children, actions }) {
    return (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
                    <p className="mt-1 text-xs text-stone-500">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
            </div>
            <div className="pt-4">{children}</div>
        </div>
    );
}

export default function GeneralPanel() {
    const SECTION_OPTIONS = [
        { key: 'office', label: 'Office & Contact' },
        { key: 'landing', label: 'Landing Content' },
        { key: 'application', label: 'Application Window' },
    ];

    const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');
    const [officeName, setOfficeName] = useState('Office for Scholarship and Financial Assistance');
    const [officeEmail, setOfficeEmail] = useState('osfa@pdm.edu.ph');
    const [officeAddress, setOfficeAddress] = useState('Abangan Norte, Marilao, Bulacan');
    const [landlineNumber, setLandlineNumber] = useState('(044) 919-8191');
    const [officeHours, setOfficeHours] = useState('Monday - Friday, 8:00 AM - 5:00 PM');
    const [aboutOsfa, setAboutOsfa] = useState(DEFAULT_ABOUT_OSFA);
    const [landingFaqs, setLandingFaqs] = useState(DEFAULT_FAQS);
    const [globalDeadline, setGlobalDeadline] = useState('2026-03-31');
    const [appOpen, setAppOpen] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [activeSection, setActiveSection] = useState('office');
    const [activeFaqEditor, setActiveFaqEditor] = useState(0);

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
            setAboutOsfa(
                payload?.about_osfa ||
                    DEFAULT_ABOUT_OSFA
            );
            setLandingFaqs(
                Array.isArray(payload?.landing_faqs) && payload.landing_faqs.length
                    ? payload.landing_faqs.slice(0, 6).map((item, index) => ({
                        question: item?.question || DEFAULT_FAQS[index]?.question || '',
                        answer: item?.answer || DEFAULT_FAQS[index]?.answer || '',
                    }))
                    : DEFAULT_FAQS
            );
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
                    about_osfa: aboutOsfa,
                    landing_faqs: landingFaqs,
                    global_deadline: globalDeadline,
                    applications_open: appOpen,
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to save general settings.');
            }

            setSaved(true);
            setSuccessMessage('General maintenance settings saved successfully.');
            setTimeout(() => setSaved(false), 2000);
            window.setTimeout(() => setSuccessMessage(''), 2600);
        } catch (nextError) {
            setError(nextError.message || 'Failed to save general settings.');
        }
    };

    const saveBySection = async () => {
        await handleSaveGeneral();
    };

    const updateFaq = (index, field, value) => {
        setLandingFaqs((current) =>
            current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item
            )
        );
    };

    const restoreOfficeDefaults = () => {
        setInstName(DEFAULT_OFFICE.institution_name);
        setOfficeName(DEFAULT_OFFICE.office_name);
        setOfficeEmail(DEFAULT_OFFICE.office_email);
        setOfficeAddress(DEFAULT_OFFICE.office_address);
        setLandlineNumber(DEFAULT_OFFICE.landline_number);
        setOfficeHours(DEFAULT_OFFICE.office_hours);
        setSuccessMessage('Office and contact fields restored to defaults. Save to apply.');
    };

    const restoreLandingDefaults = () => {
        setAboutOsfa(DEFAULT_ABOUT_OSFA);
        setLandingFaqs(DEFAULT_FAQS);
        setActiveFaqEditor(0);
        setSuccessMessage('Landing content restored to defaults. Save to apply.');
    };

    const restoreApplicationDefaults = () => {
        setGlobalDeadline(DEFAULT_APPLICATION.global_deadline);
        setAppOpen(DEFAULT_APPLICATION.applications_open);
        setSuccessMessage('Application window settings restored to defaults. Save to apply.');
    };

    const renderSectionActions = (onRestore) => (
        <>
            <Button
                type="button"
                onClick={onRestore}
                variant="outline"
                className="h-8 rounded-lg border-stone-200 px-3 text-xs text-stone-700"
            >
                <RotateCcw size={13} className="mr-1.5" />
                Restore Defaults
            </Button>
            <Button
                onClick={saveBySection}
                className="h-8 rounded-lg border-none px-3 text-xs text-white"
                style={{ background: saved ? C.green : C.brownMid }}
            >
                {saved ? <Check size={14} className="mr-1.5" /> : <Save size={14} className="mr-1.5" />}
                {saved ? 'Saved' : 'Save'}
            </Button>
        </>
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-stone-900">General Configuration</h2>
                    <p className="mt-0.5 text-xs text-stone-500">
                        System preferences and application settings
                    </p>
                </div>
            </div>

            {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                </div>
            ) : null}

            {successMessage ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    {successMessage}
                </div>
            ) : null}

            {loading ? (
                <div className="rounded-xl border border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                    Loading general settings...
                </div>
            ) : null}

            <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
                <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                        General Sections
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                        Switch between office details, landing content, and application settings.
                    </p>

                    <div className="mt-4 inline-flex flex-wrap rounded-full border border-stone-200 bg-stone-50 p-1">
                        {SECTION_OPTIONS.map((section) => (
                            <button
                                key={section.key}
                                type="button"
                                onClick={() => setActiveSection(section.key)}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                    activeSection === section.key
                                        ? 'text-white shadow-sm'
                                        : 'text-stone-600 hover:text-stone-900'
                                }`}
                                style={activeSection === section.key ? { background: C.brownMid } : undefined}
                            >
                                {section.label}
                            </button>
                        ))}
                    </div>
                </div>

                {activeSection === 'office' ? (
                    <SectionFrame
                        title="Office & Contact"
                        description="Manage institution identity, office details, and public contact information."
                        actions={renderSectionActions(restoreOfficeDefaults)}
                    >
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
                        </div>
                    </SectionFrame>
                ) : null}

                {activeSection === 'landing' ? (
                    <SectionFrame
                        title="Landing Content"
                        description="Edit the public About OSFA text and FAQ content shown on the landing page."
                        actions={renderSectionActions(restoreLandingDefaults)}
                    >
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                            <GroupCard title="Landing About OSFA" icon={Globe}>
                                <div className="space-y-3">
                                    <div>
                                        <FieldLabel>About OSFA Text</FieldLabel>
                                        <textarea
                                            value={aboutOsfa}
                                            onChange={(e) => setAboutOsfa(e.target.value)}
                                            rows={11}
                                            className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-700 outline-none"
                                            placeholder="Write the public About OSFA description shown on the landing page."
                                        />
                                    </div>
                                </div>
                            </GroupCard>

                            <GroupCard title="Landing FAQ" icon={LayoutTemplate}>
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-stone-100 bg-stone-50/70 p-2">
                                        {landingFaqs.map((item, index) => (
                                            <div key={`landing-faq-${index}`} className="border-b border-stone-100 last:border-b-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveFaqEditor((current) => (current === index ? -1 : index))}
                                                    className="flex w-full items-center justify-between gap-3 px-2 py-3 text-left"
                                                >
                                                    <div>
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                                                            Question {index + 1}
                                                        </p>
                                                        <p className="mt-1 text-sm font-semibold text-stone-900">
                                                            {item.question || `Untitled question ${index + 1}`}
                                                        </p>
                                                    </div>
                                                    <ChevronDown
                                                        size={16}
                                                        className={`shrink-0 text-stone-500 transition-transform ${activeFaqEditor === index ? 'rotate-180' : ''}`}
                                                    />
                                                </button>

                                                {activeFaqEditor === index ? (
                                                    <div className="space-y-3 px-2 pb-3">
                                                        <div>
                                                            <FieldLabel>Question</FieldLabel>
                                                            <Input
                                                                value={item.question}
                                                                onChange={(e) => updateFaq(index, 'question', e.target.value)}
                                                                className="h-9 rounded-lg border-stone-200 bg-white text-sm"
                                                            />
                                                        </div>

                                                        <div>
                                                            <FieldLabel>Answer</FieldLabel>
                                                            <textarea
                                                                value={item.answer}
                                                                onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                                                                rows={5}
                                                                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </GroupCard>
                        </div>
                    </SectionFrame>
                ) : null}

                {activeSection === 'application' ? (
                    <SectionFrame
                        title="Application Window"
                        description="Control public application availability and the default deadline used by the system."
                        actions={renderSectionActions(restoreApplicationDefaults)}
                    >
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                    </SectionFrame>
                ) : null}
            </div>
        </div>
    );
}
