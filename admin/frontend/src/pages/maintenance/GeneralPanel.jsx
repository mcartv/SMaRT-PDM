import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Globe,
    Calendar,
    Save,
    Check,
    MapPin,
    Clock3,
    Phone,
    Building2,
    LayoutTemplate,
    RotateCcw,
    Plus,
    Pencil,
    Archive,
    ArchiveRestore,
    HelpCircle,
    Loader2,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { C, FieldLabel, GroupCard, Toggle, EmptyState } from './components/MaintenanceShared';

const DEFAULT_ABOUT_OSFA =
    'The Office for Scholarship and Financial Assistance helps manage scholarship access, application review coordination, and student support monitoring for qualified PDM students. Through SMaRT-PDM, applicants and offices can follow a clearer workflow for requirements, endorsement, status tracking, and final scholar readiness.';

const DEFAULT_FAQS = [
    {
        faq_id: 'faq-1',
        question: 'Who can apply?',
        answer: 'Applicants must meet the eligibility requirements of the scholarship program and submit the required records through the SMaRT-PDM application process.',
        is_archived: false,
    },
    {
        faq_id: 'faq-2',
        question: 'What documents are required?',
        answer: 'Required documents depend on the scholarship program, but applicants are expected to upload the listed requirements in the system before final review.',
        is_archived: false,
    },
    {
        faq_id: 'faq-3',
        question: 'How does endorsement work?',
        answer: 'The endorsement slip passes through SDO, Guidance, and Program Director review. Each office records its decision before the slip can be completed.',
        is_archived: false,
    },
    {
        faq_id: 'faq-4',
        question: 'When does scholar activation happen?',
        answer: 'Scholar activation only happens after both requirements and endorsement are complete and the admin side confirms final readiness.',
        is_archived: false,
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

const DEFAULT_FAQ_FORM = {
    faq_id: '',
    question: '',
    answer: '',
};

function normalizeFaqs(faqs) {
    const source = Array.isArray(faqs) && faqs.length ? faqs : DEFAULT_FAQS;
    return source
        .slice(0, 20)
        .map((item, index) => ({
            faq_id: String(item?.faq_id || `faq-${index + 1}`),
            question: String(item?.question || '').trim(),
            answer: String(item?.answer || '').trim(),
            is_archived: item?.is_archived === true,
        }))
        .filter((item) => item.question && item.answer);
}

function createFaqId() {
    return `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function SectionFrame({ title, description, children, actions }) {
    return (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
                    <p className="mt-1 text-xs text-stone-500">{description}</p>
                </div>
                {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
            <div className="pt-4">{children}</div>
        </div>
    );
}

function FaqEditorDialog({
    open,
    onOpenChange,
    form,
    setForm,
    saving,
    onSubmit,
    editing,
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{editing ? 'Edit landing FAQ' : 'Add landing FAQ'}</DialogTitle>
                    <DialogDescription>
                        Manage the public questions and answers shown on the landing page.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <FieldLabel>Question</FieldLabel>
                        <Input
                            value={form.question}
                            onChange={(event) =>
                                setForm((current) => ({ ...current, question: event.target.value }))
                            }
                            className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                            placeholder="Enter the question"
                        />
                    </div>

                    <div>
                        <FieldLabel>Answer</FieldLabel>
                        <textarea
                            value={form.answer}
                            onChange={(event) =>
                                setForm((current) => ({ ...current, answer: event.target.value }))
                            }
                            rows={7}
                            className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-700 outline-none"
                            placeholder="Enter the answer"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        className="border-stone-200"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className="text-white"
                        style={{ background: C.brownMid }}
                        onClick={onSubmit}
                        disabled={saving}
                    >
                        {saving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Save size={14} className="mr-1.5" />}
                        {editing ? 'Save Changes' : 'Add FAQ'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function GeneralPanel() {
    const SECTION_OPTIONS = [
        { key: 'office', label: 'Office & Contact' },
        { key: 'landing', label: 'Landing Content' },
        { key: 'application', label: 'Application Window' },
    ];

    const [instName, setInstName] = useState(DEFAULT_OFFICE.institution_name);
    const [officeName, setOfficeName] = useState(DEFAULT_OFFICE.office_name);
    const [officeEmail, setOfficeEmail] = useState(DEFAULT_OFFICE.office_email);
    const [officeAddress, setOfficeAddress] = useState(DEFAULT_OFFICE.office_address);
    const [landlineNumber, setLandlineNumber] = useState(DEFAULT_OFFICE.landline_number);
    const [officeHours, setOfficeHours] = useState(DEFAULT_OFFICE.office_hours);
    const [aboutOsfa, setAboutOsfa] = useState(DEFAULT_ABOUT_OSFA);
    const [landingFaqs, setLandingFaqs] = useState(DEFAULT_FAQS);
    const [globalDeadline, setGlobalDeadline] = useState(DEFAULT_APPLICATION.global_deadline);
    const [appOpen, setAppOpen] = useState(DEFAULT_APPLICATION.applications_open);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [activeSection, setActiveSection] = useState('office');
    const [activeFaqTab, setActiveFaqTab] = useState('current');
    const [faqDialogOpen, setFaqDialogOpen] = useState(false);
    const [faqForm, setFaqForm] = useState(DEFAULT_FAQ_FORM);
    const [editingFaqId, setEditingFaqId] = useState(null);
    const [savingKey, setSavingKey] = useState('');
    const [savedKey, setSavedKey] = useState('');
    const [faqActionId, setFaqActionId] = useState('');

    const showSuccess = useCallback((message, key = '') => {
        setSuccessMessage(message);
        setSavedKey(key);
        window.setTimeout(() => setSuccessMessage(''), 2600);
        if (key) {
            window.setTimeout(() => setSavedKey((current) => (current === key ? '' : current)), 2200);
        }
    }, []);

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

            setInstName(payload?.institution_name || DEFAULT_OFFICE.institution_name);
            setOfficeName(payload?.office_name || DEFAULT_OFFICE.office_name);
            setOfficeEmail(payload?.office_email || DEFAULT_OFFICE.office_email);
            setOfficeAddress(payload?.office_address || DEFAULT_OFFICE.office_address);
            setLandlineNumber(payload?.landline_number || DEFAULT_OFFICE.landline_number);
            setOfficeHours(payload?.office_hours || DEFAULT_OFFICE.office_hours);
            setAboutOsfa(payload?.about_osfa || DEFAULT_ABOUT_OSFA);
            setLandingFaqs(normalizeFaqs(payload?.landing_faqs));
            setGlobalDeadline(payload?.global_deadline || DEFAULT_APPLICATION.global_deadline);
            setAppOpen(typeof payload?.applications_open === 'boolean' ? payload.applications_open : DEFAULT_APPLICATION.applications_open);
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

    const updateGeneralSettings = useCallback(
        async (patchPayload, key, successText) => {
            try {
                setError('');
                setSavingKey(key);
                const token = sessionStorage.getItem('adminToken') || '';
                const response = await fetch(buildApiUrl('/api/general-settings'), {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(patchPayload),
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(payload?.error || 'Failed to save general settings.');
                }

                if (Array.isArray(payload?.landing_faqs)) {
                    setLandingFaqs(normalizeFaqs(payload.landing_faqs));
                }
                if (typeof payload?.about_osfa === 'string') {
                    setAboutOsfa(payload.about_osfa);
                }
                if (typeof payload?.institution_name === 'string') {
                    setInstName(payload.institution_name);
                }
                if (typeof payload?.office_name === 'string') {
                    setOfficeName(payload.office_name);
                }
                if (typeof payload?.office_email === 'string') {
                    setOfficeEmail(payload.office_email);
                }
                if (typeof payload?.office_address === 'string') {
                    setOfficeAddress(payload.office_address);
                }
                if (typeof payload?.landline_number === 'string') {
                    setLandlineNumber(payload.landline_number);
                }
                if (typeof payload?.office_hours === 'string') {
                    setOfficeHours(payload.office_hours);
                }
                if (typeof payload?.global_deadline === 'string' || payload?.global_deadline === null) {
                    setGlobalDeadline(payload.global_deadline || DEFAULT_APPLICATION.global_deadline);
                }
                if (typeof payload?.applications_open === 'boolean') {
                    setAppOpen(payload.applications_open);
                }

                showSuccess(successText, key);
                return payload;
            } catch (nextError) {
                setError(nextError.message || 'Failed to save general settings.');
                return null;
            } finally {
                setSavingKey('');
            }
        },
        [showSuccess]
    );

    const saveOfficeSettings = async () => {
        await updateGeneralSettings(
            {
                institution_name: instName,
                office_name: officeName,
                office_email: officeEmail,
                office_address: officeAddress,
                landline_number: landlineNumber,
                office_hours: officeHours,
            },
            'office',
            'Office and contact details saved successfully.'
        );
    };

    const saveAboutSettings = async () => {
        await updateGeneralSettings(
            { about_osfa: aboutOsfa },
            'about',
            'Landing About OSFA content saved successfully.'
        );
    };

    const saveApplicationSettings = async () => {
        await updateGeneralSettings(
            {
                global_deadline: globalDeadline,
                applications_open: appOpen,
            },
            'application',
            'Application window settings saved successfully.'
        );
    };

    const restoreOfficeDefaults = () => {
        setInstName(DEFAULT_OFFICE.institution_name);
        setOfficeName(DEFAULT_OFFICE.office_name);
        setOfficeEmail(DEFAULT_OFFICE.office_email);
        setOfficeAddress(DEFAULT_OFFICE.office_address);
        setLandlineNumber(DEFAULT_OFFICE.landline_number);
        setOfficeHours(DEFAULT_OFFICE.office_hours);
        showSuccess('Office and contact fields restored locally. Save to apply.');
    };

    const restoreAboutDefaults = () => {
        setAboutOsfa(DEFAULT_ABOUT_OSFA);
        showSuccess('Landing About OSFA restored locally. Save to apply.');
    };

    const restoreFaqDefaults = async () => {
        await updateGeneralSettings(
            { landing_faqs: DEFAULT_FAQS },
            'faq',
            'Landing FAQs restored to defaults.'
        );
        setActiveFaqTab('current');
    };

    const restoreApplicationDefaults = () => {
        setGlobalDeadline(DEFAULT_APPLICATION.global_deadline);
        setAppOpen(DEFAULT_APPLICATION.applications_open);
        showSuccess('Application window settings restored locally. Save to apply.');
    };

    const currentFaqs = useMemo(
        () => landingFaqs.filter((item) => item.is_archived !== true),
        [landingFaqs]
    );
    const archivedFaqs = useMemo(
        () => landingFaqs.filter((item) => item.is_archived === true),
        [landingFaqs]
    );
    const visibleFaqs = activeFaqTab === 'archived' ? archivedFaqs : currentFaqs;

    const openCreateFaq = () => {
        setEditingFaqId(null);
        setFaqForm(DEFAULT_FAQ_FORM);
        setFaqDialogOpen(true);
    };

    const openEditFaq = (faq) => {
        setEditingFaqId(faq.faq_id);
        setFaqForm({
            faq_id: faq.faq_id,
            question: faq.question,
            answer: faq.answer,
        });
        setFaqDialogOpen(true);
    };

    const closeFaqDialog = (open) => {
        setFaqDialogOpen(open);
        if (!open) {
            setEditingFaqId(null);
            setFaqForm(DEFAULT_FAQ_FORM);
        }
    };

    const submitFaq = async () => {
        const question = String(faqForm.question || '').trim();
        const answer = String(faqForm.answer || '').trim();

        if (!question || !answer) {
            setError('Question and answer are required for the landing FAQ.');
            return;
        }

        const nextFaqs = editingFaqId
            ? landingFaqs.map((item) =>
                  item.faq_id === editingFaqId
                      ? { ...item, question, answer }
                      : item
              )
            : [
                  {
                      faq_id: createFaqId(),
                      question,
                      answer,
                      is_archived: false,
                  },
                  ...landingFaqs,
              ];

        const result = await updateGeneralSettings(
            { landing_faqs: nextFaqs },
            'faq',
            editingFaqId ? 'Landing FAQ updated successfully.' : 'Landing FAQ added successfully.'
        );

        if (result) {
            closeFaqDialog(false);
            setActiveFaqTab('current');
        }
    };

    const handleFaqArchiveRestore = async (faq) => {
        try {
            setFaqActionId(faq.faq_id);
            const nextFaqs = landingFaqs.map((item) =>
                item.faq_id === faq.faq_id
                    ? { ...item, is_archived: !faq.is_archived }
                    : item
            );

            const result = await updateGeneralSettings(
                { landing_faqs: nextFaqs },
                'faq',
                faq.is_archived
                    ? 'Landing FAQ restored successfully.'
                    : 'Landing FAQ archived successfully.'
            );

            if (result && faq.is_archived) {
                setActiveFaqTab('current');
            }
        } finally {
            setFaqActionId('');
        }
    };

    const renderSectionActions = (onRestore, onSave, key) => (
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
                onClick={onSave}
                className="h-8 rounded-lg border-none px-3 text-xs text-white"
                style={{ background: savedKey === key ? C.green : C.brownMid }}
                disabled={savingKey === key}
            >
                {savingKey === key ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                ) : savedKey === key ? (
                    <Check size={14} className="mr-1.5" />
                ) : (
                    <Save size={14} className="mr-1.5" />
                )}
                {savingKey === key ? 'Saving' : savedKey === key ? 'Saved' : 'Save'}
            </Button>
        </>
    );

    return (
        <div className="space-y-4">
            <FaqEditorDialog
                open={faqDialogOpen}
                onOpenChange={closeFaqDialog}
                form={faqForm}
                setForm={setFaqForm}
                saving={savingKey === 'faq'}
                onSubmit={submitFaq}
                editing={Boolean(editingFaqId)}
            />

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
                        actions={renderSectionActions(restoreOfficeDefaults, saveOfficeSettings, 'office')}
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
                        description="Manage the public About OSFA section and landing FAQ records separately."
                    >
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                            <GroupCard title="Landing About OSFA" icon={Globe}>
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5">
                                        <div>
                                            <p className="text-xs font-semibold text-stone-800">About section content</p>
                                            <p className="text-[11px] text-stone-500">This text appears in the public landing page About OSFA section.</p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-8 rounded-lg border-stone-200 px-3 text-xs text-stone-700"
                                                onClick={restoreAboutDefaults}
                                            >
                                                <RotateCcw size={13} className="mr-1.5" />
                                                Restore
                                            </Button>
                                            <Button
                                                type="button"
                                                className="h-8 rounded-lg border-none px-3 text-xs text-white"
                                                style={{ background: savedKey === 'about' ? C.green : C.brownMid }}
                                                onClick={saveAboutSettings}
                                                disabled={savingKey === 'about'}
                                            >
                                                {savingKey === 'about' ? (
                                                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                                                ) : savedKey === 'about' ? (
                                                    <Check size={14} className="mr-1.5" />
                                                ) : (
                                                    <Save size={14} className="mr-1.5" />
                                                )}
                                                {savingKey === 'about' ? 'Saving' : savedKey === 'about' ? 'Saved' : 'Save'}
                                            </Button>
                                        </div>
                                    </div>

                                    <div>
                                        <FieldLabel>About OSFA Text</FieldLabel>
                                        <textarea
                                            value={aboutOsfa}
                                            onChange={(e) => setAboutOsfa(e.target.value)}
                                            rows={13}
                                            className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-700 outline-none"
                                            placeholder="Write the public About OSFA description shown on the landing page."
                                        />
                                    </div>
                                </div>
                            </GroupCard>

                            <GroupCard title="Landing FAQ Records" icon={LayoutTemplate}>
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-3 rounded-xl border border-stone-100 bg-stone-50/80 p-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                                FAQ Records
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-stone-900">
                                                {currentFaqs.length} current · {archivedFaqs.length} archived
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setActiveFaqTab('current')}
                                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                                    activeFaqTab === 'current'
                                                        ? 'text-white'
                                                        : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                                }`}
                                                style={activeFaqTab === 'current' ? { background: C.brownMid } : undefined}
                                            >
                                                Current ({currentFaqs.length})
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setActiveFaqTab('archived')}
                                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                                    activeFaqTab === 'archived'
                                                        ? 'text-white'
                                                        : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                                }`}
                                                style={activeFaqTab === 'archived' ? { background: C.brownMid } : undefined}
                                            >
                                                Archived ({archivedFaqs.length})
                                            </button>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-8 rounded-lg border-stone-200 px-3 text-xs"
                                                onClick={restoreFaqDefaults}
                                                disabled={savingKey === 'faq'}
                                            >
                                                <RotateCcw size={13} className="mr-1.5" />
                                                Restore Defaults
                                            </Button>

                                            <Button
                                                type="button"
                                                className="h-8 rounded-lg border-none px-3 text-xs text-white"
                                                style={{ background: C.brownMid }}
                                                onClick={openCreateFaq}
                                            >
                                                <Plus size={13} className="mr-1.5" />
                                                Add FAQ
                                            </Button>
                                        </div>
                                    </div>

                                    {visibleFaqs.length ? (
                                        <div className="space-y-3">
                                            {visibleFaqs.map((faq) => (
                                                <div
                                                    key={faq.faq_id}
                                                    className="rounded-xl border border-stone-200 bg-white p-3"
                                                >
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                                                                        faq.is_archived
                                                                            ? 'bg-stone-100 text-stone-500'
                                                                            : 'bg-amber-50 text-amber-700'
                                                                    }`}
                                                                >
                                                                    {faq.is_archived ? 'Archived FAQ' : 'Current FAQ'}
                                                                </span>
                                                            </div>
                                                            <p className="mt-2 text-sm font-semibold text-stone-900">
                                                                {faq.question}
                                                            </p>
                                                            <p className="mt-1 line-clamp-3 text-xs leading-6 text-stone-500">
                                                                {faq.answer}
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="h-8 rounded-lg border-stone-200 px-3 text-xs"
                                                                onClick={() => openEditFaq(faq)}
                                                            >
                                                                <Pencil size={13} className="mr-1.5" />
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="h-8 rounded-lg border-stone-200 px-3 text-xs"
                                                                onClick={() => handleFaqArchiveRestore(faq)}
                                                                disabled={faqActionId === faq.faq_id || savingKey === 'faq'}
                                                            >
                                                                {faqActionId === faq.faq_id ? (
                                                                    <Loader2 size={13} className="mr-1.5 animate-spin" />
                                                                ) : faq.is_archived ? (
                                                                    <ArchiveRestore size={13} className="mr-1.5" />
                                                                ) : (
                                                                    <Archive size={13} className="mr-1.5" />
                                                                )}
                                                                {faq.is_archived ? 'Restore' : 'Archive'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            icon={HelpCircle}
                                            title={activeFaqTab === 'archived' ? 'No archived FAQs' : 'No current FAQs'}
                                            subtitle={
                                                activeFaqTab === 'archived'
                                                    ? 'Archived FAQ records will appear here.'
                                                    : 'Add a landing FAQ to start building the public help section.'
                                            }
                                        />
                                    )}
                                </div>
                            </GroupCard>
                        </div>
                    </SectionFrame>
                ) : null}

                {activeSection === 'application' ? (
                    <SectionFrame
                        title="Application Window"
                        description="Control public application availability and the default deadline used by the system."
                        actions={renderSectionActions(restoreApplicationDefaults, saveApplicationSettings, 'application')}
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
