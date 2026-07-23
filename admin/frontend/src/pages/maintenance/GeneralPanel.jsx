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
    Megaphone,
    Loader2,
    ShieldCheck,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { DEFAULT_LANDING_CONTENT, mergeLandingContent } from '@/constants/landingContent';
import {
    DEFAULT_POLICY_CONTENT,
    POLICY_ICON_OPTIONS,
    mergePolicyContent,
} from '@/constants/policyContent';
import { toast } from 'sonner';
import { C, FieldLabel, GroupCard, Toggle, EmptyState } from './components/MaintenanceShared';

const DEFAULT_ABOUT_OSFA =
    'The Office for Scholarship and Financial Assistance helps manage scholarship access, application review coordination, and student support monitoring for qualified PDM students. Through SMaRT-PDM, applicants and offices can follow a clearer workflow for requirements, endorsement, status tracking, and final scholar readiness.';

const DEFAULT_ELIGIBILITY_SUMMARY =
    'Scholarship eligibility varies by program. Applicants must be enrolled at PDM, meet the academic and financial qualifications of the selected scholarship, and submit complete and accurate information for OSFA review.';

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

const DEFAULT_FEATURED_NOTICE = {
    title: 'Welcome to SMaRT-PDM',
    message: 'Check the mobile application and official OSFA channels for current scholarship updates.',
    link_label: '',
    link_url: '',
    is_visible: false,
    start_date: '',
    end_date: '',
};

function normalizeFeaturedNotice(notice) {
    return {
        ...DEFAULT_FEATURED_NOTICE,
        ...(notice && typeof notice === 'object' ? notice : {}),
        start_date: String(notice?.start_date || ''),
        end_date: String(notice?.end_date || ''),
        is_visible: notice?.is_visible === true,
    };
}

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
        <div className="group rounded-2xl border border-stone-200 bg-white p-4">
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
    const [officeEditing, setOfficeEditing] = useState(false);
    const [aboutOsfa, setAboutOsfa] = useState(DEFAULT_ABOUT_OSFA);
    const [eligibilitySummary, setEligibilitySummary] = useState(DEFAULT_ELIGIBILITY_SUMMARY);
    const [landingContent, setLandingContent] = useState(DEFAULT_LANDING_CONTENT);
    const [savedLandingContent, setSavedLandingContent] = useState(DEFAULT_LANDING_CONTENT);
    const [policyContent, setPolicyContent] = useState(DEFAULT_POLICY_CONTENT);
    const [savedPolicyContent, setSavedPolicyContent] = useState(DEFAULT_POLICY_CONTENT);
    const [featuredNotice, setFeaturedNotice] = useState(DEFAULT_FEATURED_NOTICE);
    const [landingFaqs, setLandingFaqs] = useState(DEFAULT_FAQS);
    const [globalDeadline, setGlobalDeadline] = useState(DEFAULT_APPLICATION.global_deadline);
    const [appOpen, setAppOpen] = useState(DEFAULT_APPLICATION.applications_open);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeSection, setActiveSection] = useState('office');
    const [activeLandingSection, setActiveLandingSection] = useState('about');
    const [activeFaqTab, setActiveFaqTab] = useState('current');
    const [faqDialogOpen, setFaqDialogOpen] = useState(false);
    const [faqForm, setFaqForm] = useState(DEFAULT_FAQ_FORM);
    const [editingFaqId, setEditingFaqId] = useState(null);
    const [savingKey, setSavingKey] = useState('');
    const [savedKey, setSavedKey] = useState('');
    const [faqActionId, setFaqActionId] = useState('');

    const showSuccess = useCallback((message, key = '') => {
        setSavedKey(key);
        if (key) {
            toast.success('Changes saved', { description: message });
        } else {
            toast.info('Ready to save', { description: message });
        }
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
            setEligibilitySummary(payload?.eligibility_summary || DEFAULT_ELIGIBILITY_SUMMARY);
            const nextLandingContent = mergeLandingContent(payload?.landing_content);
            const nextPolicyContent = mergePolicyContent(payload?.policy_content);
            setLandingContent(nextLandingContent);
            setSavedLandingContent(nextLandingContent);
            setPolicyContent(nextPolicyContent);
            setSavedPolicyContent(nextPolicyContent);
            setFeaturedNotice(normalizeFeaturedNotice(payload?.featured_notice));
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
                if (typeof payload?.eligibility_summary === 'string') {
                    setEligibilitySummary(payload.eligibility_summary);
                }
                if (payload?.featured_notice && typeof payload.featured_notice === 'object') {
                    setFeaturedNotice(normalizeFeaturedNotice(payload.featured_notice));
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
        const saved = await updateGeneralSettings(
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
        if (saved) setOfficeEditing(false);
    };

    const saveAboutOsfa = async () => {
        await updateGeneralSettings(
            { about_osfa: aboutOsfa },
            'about-osfa',
            'About OSFA content saved successfully.'
        );
    };

    const saveEligibilitySummary = async () => {
        await updateGeneralSettings(
            { eligibility_summary: eligibilitySummary },
            'about-eligibility',
            'Eligibility summary saved successfully.'
        );
    };

    const saveFeaturedNotice = async () => {
        await updateGeneralSettings(
            { featured_notice: featuredNotice },
            'notice',
            'Featured public notice saved successfully.'
        );
    };

    const saveLandingCopyGroup = async (group) => {
        const fieldsByGroup = {
            hero: ['hero_badge', 'hero_title', 'hero_description', 'mobile_app_title', 'mobile_app_description'],
            guide: ['guide_title', 'guide_description', 'guide_steps'],
            requirements: ['requirements_title', 'requirements_description', 'requirement_items', 'requirement_notices'],
            features: ['features_title', 'features_description', 'feature_items'],
            campus: ['campus_title', 'campus_description', 'credibility_title', 'credibility_description'],
        };
        const nextContent = { ...savedLandingContent };
        fieldsByGroup[group].forEach((field) => {
            nextContent[field] = landingContent[field];
        });
        const saved = await updateGeneralSettings(
            { landing_content: nextContent },
            `copy-${group}`,
            `${group} landing content saved successfully.`
        );
        if (saved?.landing_content) {
            setSavedLandingContent(mergeLandingContent(saved.landing_content));
        }
    };

    const savePolicyGroup = async (group) => {
        const fieldsByGroup = {
            shared: ['effective_date'],
            privacy: ['privacy_icon', 'privacy_intro', 'privacy_sections'],
            consent: ['consent_icon', 'consent_title', 'consent_body', 'consent_note'],
            terms: ['terms_icon', 'terms_intro', 'terms_sections'],
        };
        const nextContent = { ...savedPolicyContent };
        fieldsByGroup[group].forEach((field) => {
            nextContent[field] = policyContent[field];
        });
        const saved = await updateGeneralSettings(
            { policy_content: nextContent },
            `policy-${group}`,
            `${group} policy content saved successfully.`
        );
        if (saved?.policy_content) {
            setSavedPolicyContent(mergePolicyContent(saved.policy_content));
        }
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

    const restoreAboutOsfaDefault = () => {
        setAboutOsfa(DEFAULT_ABOUT_OSFA);
        showSuccess('About OSFA content restored locally. Save to apply.');
    };

    const restoreEligibilityDefault = () => {
        setEligibilitySummary(DEFAULT_ELIGIBILITY_SUMMARY);
        showSuccess('Eligibility summary restored locally. Save to apply.');
    };

    const restoreLandingGroupDefaults = (group) => {
        const fieldsByGroup = {
            hero: ['hero_badge', 'hero_title', 'hero_description', 'mobile_app_title', 'mobile_app_description'],
            guide: ['guide_title', 'guide_description', 'guide_steps'],
            requirements: ['requirements_title', 'requirements_description', 'requirement_items', 'requirement_notices'],
            features: ['features_title', 'features_description', 'feature_items'],
            campus: ['campus_title', 'campus_description', 'credibility_title', 'credibility_description'],
        };
        setLandingContent((current) => {
            const next = { ...current };
            fieldsByGroup[group].forEach((field) => {
                next[field] = DEFAULT_LANDING_CONTENT[field];
            });
            return next;
        });
        showSuccess(`${group} landing content restored locally. Save to apply.`);
    };

    const restorePolicyGroupDefaults = (group) => {
        const fieldsByGroup = {
            shared: ['effective_date'],
            privacy: ['privacy_icon', 'privacy_intro', 'privacy_sections'],
            consent: ['consent_icon', 'consent_title', 'consent_body', 'consent_note'],
            terms: ['terms_icon', 'terms_intro', 'terms_sections'],
        };
        setPolicyContent((current) => {
            const next = { ...current };
            fieldsByGroup[group].forEach((field) => {
                next[field] = DEFAULT_POLICY_CONTENT[field];
            });
            return next;
        });
        showSuccess(`${group} policy content restored locally. Save to apply.`);
    };

    const updateLandingField = (field, value) => {
        setLandingContent((current) => ({ ...current, [field]: value }));
    };

    const updateLandingItem = (collection, index, field, value) => {
        setLandingContent((current) => ({
            ...current,
            [collection]: current[collection].map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item
            ),
        }));
    };

    const updateLandingTextItem = (collection, index, value) => {
        setLandingContent((current) => ({
            ...current,
            [collection]: current[collection].map((item, itemIndex) =>
                itemIndex === index ? value : item
            ),
        }));
    };

    const updatePolicyField = (field, value) => {
        setPolicyContent((current) => ({ ...current, [field]: value }));
    };

    const updatePolicySection = (collection, index, field, value) => {
        setPolicyContent((current) => ({
            ...current,
            [collection]: current[collection].map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item
            ),
        }));
    };

    const restoreFeaturedNoticeDefaults = () => {
        setFeaturedNotice(DEFAULT_FEATURED_NOTICE);
        showSuccess('Featured notice restored locally. Save to apply.');
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
                {savingKey === key ? 'Saving' : savedKey === key ? 'Saved' : 'Save Changes'}
            </Button>
        </>
    );

    const renderContentGroupActions = (type, group) => {
        const isLanding = type === 'copy';
        const restore = () => (
            isLanding
                ? restoreLandingGroupDefaults(group)
                : restorePolicyGroupDefaults(group)
        );
        const save = () => (
            isLanding
                ? saveLandingCopyGroup(group)
                : savePolicyGroup(group)
        );
        return (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 pt-4">
                {renderSectionActions(restore, save, `${type}-${group}`)}
            </div>
        );
    };

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
                        actions={
                            <button
                                type="button"
                                aria-pressed={officeEditing}
                                onClick={() => setOfficeEditing((current) => !current)}
                                className={`inline-flex h-10 w-[138px] items-center justify-between rounded-xl border px-3 text-xs font-semibold transition-colors ${
                                    officeEditing
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm'
                                        : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                                }`}
                            >
                                <span>Edit mode</span>
                                <span
                                    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                                        officeEditing ? 'bg-emerald-500' : 'bg-stone-300'
                                    }`}
                                    aria-hidden="true"
                                >
                                    <span
                                        className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                            officeEditing ? 'translate-x-4' : 'translate-x-0'
                                        }`}
                                    />
                                </span>
                            </button>
                        }
                    >
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <GroupCard title="Institution Info" icon={Globe}>
                                <div className="space-y-3">
                                    <div>
                                        <FieldLabel>Institution Name</FieldLabel>
                                        <Input
                                            value={instName}
                                            onChange={(e) => setInstName(e.target.value)}
                                            disabled={!officeEditing}
                                            className="h-9 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                                        />
                                    </div>

                                    <div>
                                        <FieldLabel>Office Name</FieldLabel>
                                        <Input
                                            value={officeName}
                                            onChange={(e) => setOfficeName(e.target.value)}
                                            disabled={!officeEditing}
                                            className="h-9 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                                        />
                                    </div>

                                    <div>
                                        <FieldLabel>Office Email</FieldLabel>
                                        <Input
                                            value={officeEmail}
                                            onChange={(e) => setOfficeEmail(e.target.value)}
                                            disabled={!officeEditing}
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
                                                 disabled={!officeEditing}
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
                                                 disabled={!officeEditing}
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
                                                 disabled={!officeEditing}
                                                className="h-9 rounded-lg border-stone-200 bg-stone-50/50 pl-9 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </GroupCard>
                        </div>
                        {officeEditing ? (
                            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-stone-800">Office editing is active</p>
                                    <p className="mt-1 text-[11px] text-stone-500">Review both information groups before saving.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                    {renderSectionActions(restoreOfficeDefaults, saveOfficeSettings, 'office')}
                                </div>
                            </div>
                        ) : null}
                    </SectionFrame>
                ) : null}

                {activeSection === 'landing' ? (
                    <SectionFrame
                        title="Landing Content"
                        description="Manage each public landing display in a separated view with group-specific save controls."
                    >
                        <div className="space-y-4">
                            <div className="rounded-xl border border-stone-100 bg-stone-50/80 p-3">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Landing Sections
                                </p>
                                <p className="mt-1 text-sm text-stone-500">
                                    Open one section at a time so editing stays cleaner and easier to use.
                                </p>

                                <div className="mt-3 inline-flex flex-wrap rounded-full border border-stone-200 bg-white p-1">
                                    <button
                                        type="button"
                                        onClick={() => setActiveLandingSection('about')}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                            activeLandingSection === 'about'
                                                ? 'text-white shadow-sm'
                                                : 'text-stone-600 hover:text-stone-900'
                                        }`}
                                        style={activeLandingSection === 'about' ? { background: C.brownMid } : undefined}
                                    >
                                        About OSFA
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveLandingSection('notice')}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                            activeLandingSection === 'notice'
                                                ? 'text-white shadow-sm'
                                                : 'text-stone-600 hover:text-stone-900'
                                        }`}
                                        style={activeLandingSection === 'notice' ? { background: C.brownMid } : undefined}
                                    >
                                        Featured Notice
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveLandingSection('copy')}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                            activeLandingSection === 'copy'
                                                ? 'text-white shadow-sm'
                                                : 'text-stone-600 hover:text-stone-900'
                                        }`}
                                        style={activeLandingSection === 'copy' ? { background: C.brownMid } : undefined}
                                    >
                                        Page Text
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveLandingSection('faq')}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                            activeLandingSection === 'faq'
                                                ? 'text-white shadow-sm'
                                                : 'text-stone-600 hover:text-stone-900'
                                        }`}
                                        style={activeLandingSection === 'faq' ? { background: C.brownMid } : undefined}
                                    >
                                        Landing FAQs
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveLandingSection('policy')}
                                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                            activeLandingSection === 'policy'
                                                ? 'text-white shadow-sm'
                                                : 'text-stone-600 hover:text-stone-900'
                                        }`}
                                        style={activeLandingSection === 'policy' ? { background: C.brownMid } : undefined}
                                    >
                                        Policy Content
                                    </button>
                                </div>
                            </div>

                            {activeLandingSection === 'about' ? (
                                <GroupCard title="Landing About OSFA & Eligibility" icon={Globe}>
                                <div className="space-y-5">
                                    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                        <div className="-mx-4 -mt-4 mb-5 border-b border-stone-200 bg-stone-100/70 px-4 py-3.5">
                                            <p className="text-sm font-semibold text-stone-900">About OSFA</p>
                                            <p className="mt-1 text-xs text-stone-500">Public description of the scholarship office and its role.</p>
                                        </div>
                                        <FieldLabel>About OSFA Text</FieldLabel>
                                        <textarea
                                            value={aboutOsfa}
                                            onChange={(e) => setAboutOsfa(e.target.value)}
                                            rows={13}
                                            className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-700 outline-none"
                                            placeholder="Write the public About OSFA description shown on the landing page."
                                        />
                                        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-4">
                                            {renderSectionActions(restoreAboutOsfaDefault, saveAboutOsfa, 'about-osfa')}
                                        </div>
                                    </div>

                                    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                        <div className="-mx-4 -mt-4 mb-5 border-b border-stone-200 bg-stone-100/70 px-4 py-3.5">
                                            <p className="text-sm font-semibold text-stone-900">Eligibility Summary</p>
                                            <p className="mt-1 text-xs text-stone-500">General guidance shown before detailed scholarship requirements are available.</p>
                                        </div>
                                        <FieldLabel>Eligibility Summary</FieldLabel>
                                        <textarea
                                            value={eligibilitySummary}
                                            onChange={(e) => setEligibilitySummary(e.target.value)}
                                            rows={6}
                                            maxLength={1200}
                                            className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-700 outline-none"
                                            placeholder="Summarize who may qualify. Detailed requirements can be added later."
                                        />
                                        <p className="mt-1 text-[11px] text-stone-500">
                                            This appears in the public eligibility overview. Keep it general when requirements vary by scholarship.
                                        </p>
                                        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-4">
                                            {renderSectionActions(restoreEligibilityDefault, saveEligibilitySummary, 'about-eligibility')}
                                        </div>
                                    </div>
                                </div>
                                </GroupCard>
                            ) : null}

                            {activeLandingSection === 'copy' ? (
                                <GroupCard title="Editable Landing Page Content" icon={LayoutTemplate}>
                                    <div className="space-y-5">
                                        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                            <div className="-mx-4 -mt-4 mb-5 border-b border-stone-200 bg-stone-100/70 px-4 py-3.5">
                                                <p className="text-sm font-semibold text-stone-900">Hero & Mobile App</p>
                                                <p className="mt-1 text-xs text-stone-500">The first message and mobile-app information visitors see.</p>
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div><FieldLabel>Hero Badge</FieldLabel><Input value={landingContent.hero_badge} onChange={(e) => updateLandingField('hero_badge', e.target.value)} maxLength={80} /></div>
                                                <div><FieldLabel>Hero Title</FieldLabel><Input value={landingContent.hero_title} onChange={(e) => updateLandingField('hero_title', e.target.value)} maxLength={180} /></div>
                                                <div className="md:col-span-2"><FieldLabel>Hero Description</FieldLabel><textarea value={landingContent.hero_description} onChange={(e) => updateLandingField('hero_description', e.target.value)} rows={3} maxLength={600} className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm" /></div>
                                                <div><FieldLabel>Mobile App Title</FieldLabel><Input value={landingContent.mobile_app_title} onChange={(e) => updateLandingField('mobile_app_title', e.target.value)} maxLength={100} /></div>
                                                <div><FieldLabel>Mobile App Description</FieldLabel><Input value={landingContent.mobile_app_description} onChange={(e) => updateLandingField('mobile_app_description', e.target.value)} maxLength={400} /></div>
                                            </div>
                                            {renderContentGroupActions('copy', 'hero')}
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                            <div className="-mx-4 -mt-4 mb-5 border-b border-stone-200 bg-stone-100/70 px-4 py-3.5">
                                                <p className="text-sm font-semibold text-stone-900">Applicant Guide</p>
                                                <p className="mt-1 text-xs text-stone-500">Heading, introduction, and the four application steps.</p>
                                            </div>
                                            <FieldLabel>Applicant Guide Heading</FieldLabel>
                                            <Input value={landingContent.guide_title} onChange={(e) => updateLandingField('guide_title', e.target.value)} maxLength={160} />
                                            <div className="mt-3"><FieldLabel>Guide Introduction</FieldLabel><Input value={landingContent.guide_description} onChange={(e) => updateLandingField('guide_description', e.target.value)} maxLength={400} /></div>
                                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                {landingContent.guide_steps.map((item, index) => (
                                                    <div key={`guide-${index}`} className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                                                        <FieldLabel>Step {index + 1}</FieldLabel>
                                                        <Input value={item.title} onChange={(e) => updateLandingItem('guide_steps', index, 'title', e.target.value)} maxLength={120} />
                                                        <textarea value={item.description} onChange={(e) => updateLandingItem('guide_steps', index, 'description', e.target.value)} rows={3} maxLength={500} className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm" />
                                                    </div>
                                                ))}
                                            </div>
                                            {renderContentGroupActions('copy', 'guide')}
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                            <div className="-mx-4 -mt-4 mb-5 border-b border-stone-200 bg-stone-100/70 px-4 py-3.5">
                                                <p className="text-sm font-semibold text-stone-900">Application Requirements</p>
                                                <p className="mt-1 text-xs text-stone-500">Checklist and important notices displayed in the public requirements modal.</p>
                                            </div>
                                            <FieldLabel>Requirements Heading</FieldLabel>
                                            <Input value={landingContent.requirements_title} onChange={(e) => updateLandingField('requirements_title', e.target.value)} maxLength={160} />
                                            <div className="mt-3">
                                                <FieldLabel>Requirements Introduction</FieldLabel>
                                                <textarea value={landingContent.requirements_description} onChange={(e) => updateLandingField('requirements_description', e.target.value)} rows={3} maxLength={600} className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm" />
                                            </div>
                                            <div className="mt-4 grid gap-4 xl:grid-cols-2">
                                                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-600">Required Documents</p>
                                                    <div className="space-y-2">
                                                        {landingContent.requirement_items.map((item, index) => (
                                                            <div key={`requirement-${index}`}>
                                                                <FieldLabel>Requirement {index + 1}</FieldLabel>
                                                                <textarea value={item} onChange={(e) => updateLandingTextItem('requirement_items', index, e.target.value)} rows={2} maxLength={500} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-600">Important Notices</p>
                                                    <div className="space-y-2">
                                                        {landingContent.requirement_notices.map((item, index) => (
                                                            <div key={`requirement-notice-${index}`}>
                                                                <FieldLabel>Notice {index + 1}</FieldLabel>
                                                                <textarea value={item} onChange={(e) => updateLandingTextItem('requirement_notices', index, e.target.value)} rows={2} maxLength={500} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            {renderContentGroupActions('copy', 'requirements')}
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                            <div className="-mx-4 -mt-4 mb-5 border-b border-stone-200 bg-stone-100/70 px-4 py-3.5">
                                                <p className="text-sm font-semibold text-stone-900">Platform Features</p>
                                                <p className="mt-1 text-xs text-stone-500">Heading, introduction, and four feature descriptions.</p>
                                            </div>
                                            <FieldLabel>Features Heading</FieldLabel>
                                            <Input value={landingContent.features_title} onChange={(e) => updateLandingField('features_title', e.target.value)} maxLength={160} />
                                            <div className="mt-3"><FieldLabel>Features Introduction</FieldLabel><Input value={landingContent.features_description} onChange={(e) => updateLandingField('features_description', e.target.value)} maxLength={400} /></div>
                                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                {landingContent.feature_items.map((item, index) => (
                                                    <div key={`feature-${index}`} className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                                                        <FieldLabel>Feature {index + 1}</FieldLabel>
                                                        <Input value={item.title} onChange={(e) => updateLandingItem('feature_items', index, 'title', e.target.value)} maxLength={120} />
                                                        <textarea value={item.description} onChange={(e) => updateLandingItem('feature_items', index, 'description', e.target.value)} rows={3} maxLength={500} className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm" />
                                                    </div>
                                                ))}
                                            </div>
                                            {renderContentGroupActions('copy', 'features')}
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                            <div className="-mx-4 -mt-4 mb-5 border-b border-stone-200 bg-stone-100/70 px-4 py-3.5">
                                                <p className="text-sm font-semibold text-stone-900">Campus & Credibility</p>
                                                <p className="mt-1 text-xs text-stone-500">Institutional campus message and official-platform verification guidance.</p>
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                                                <FieldLabel>Campus Heading</FieldLabel><Input value={landingContent.campus_title} onChange={(e) => updateLandingField('campus_title', e.target.value)} maxLength={160} />
                                                <div className="mt-3"><FieldLabel>Campus Description</FieldLabel><textarea value={landingContent.campus_description} onChange={(e) => updateLandingField('campus_description', e.target.value)} rows={4} maxLength={400} className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm" /></div>
                                                </div>
                                                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                                                <FieldLabel>Official Platform Heading</FieldLabel><Input value={landingContent.credibility_title} onChange={(e) => updateLandingField('credibility_title', e.target.value)} maxLength={180} />
                                                <div className="mt-3"><FieldLabel>Verification Description</FieldLabel><textarea value={landingContent.credibility_description} onChange={(e) => updateLandingField('credibility_description', e.target.value)} rows={4} maxLength={600} className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm" /></div>
                                                </div>
                                            </div>
                                            {renderContentGroupActions('copy', 'campus')}
                                        </div>
                                    </div>
                                </GroupCard>
                            ) : null}

                            {activeLandingSection === 'policy' ? (
                                <GroupCard title="Privacy, Consent & Terms" icon={ShieldCheck}>
                                    <div className="space-y-5">
                                        <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-4 py-3">
                                            <p className="text-xs font-semibold text-stone-800">Review before publishing</p>
                                            <p className="mt-1 text-[11px] leading-5 text-stone-500">Policy changes affect public institutional statements. Have final wording reviewed by the authorized PDM office.</p>
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                            <div className="-mx-4 -mt-4 mb-5 border-b border-stone-200 bg-stone-100/70 px-4 py-3.5">
                                                <p className="text-sm font-semibold text-stone-900">Shared Policy Settings</p>
                                                <p className="mt-1 text-xs text-stone-500">Set the public effective date used by both pages.</p>
                                            </div>
                                            <div className="max-w-xs">
                                                <FieldLabel>Effective Date</FieldLabel>
                                                <Input type="date" value={policyContent.effective_date} onChange={(e) => updatePolicyField('effective_date', e.target.value)} />
                                            </div>
                                            {renderContentGroupActions('policy', 'shared')}
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                            <div className="-mx-4 -mt-4 mb-5 border-b border-stone-200 bg-stone-100/70 px-4 py-3.5">
                                                <p className="text-sm font-semibold text-stone-900">Privacy Notice</p>
                                                <p className="mt-1 text-xs text-stone-500">Choose its page icon and edit the introduction and five notice sections.</p>
                                            </div>
                                            <div className="max-w-xs">
                                                <FieldLabel>Privacy Page Icon</FieldLabel>
                                                <select value={policyContent.privacy_icon} onChange={(e) => updatePolicyField('privacy_icon', e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700">
                                                    {POLICY_ICON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="mt-4"><FieldLabel>Privacy Introduction</FieldLabel><textarea value={policyContent.privacy_intro} onChange={(e) => updatePolicyField('privacy_intro', e.target.value)} rows={4} maxLength={1600} className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm" /></div>
                                            <div className="mt-4 space-y-3">
                                                {policyContent.privacy_sections.map((section, index) => (
                                                    <div key={`privacy-${index}`} className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                                                        <FieldLabel>Privacy Section {index + 1}</FieldLabel>
                                                        <Input value={section.title} onChange={(e) => updatePolicySection('privacy_sections', index, 'title', e.target.value)} maxLength={160} />
                                                        <textarea value={section.body} onChange={(e) => updatePolicySection('privacy_sections', index, 'body', e.target.value)} rows={4} maxLength={1800} className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm" />
                                                    </div>
                                                ))}
                                            </div>
                                            {renderContentGroupActions('policy', 'privacy')}
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                            <div className="-mx-4 -mt-4 mb-5 border-b border-stone-200 bg-stone-100/70 px-4 py-3.5">
                                                <p className="text-sm font-semibold text-stone-900">Data Processing Consent</p>
                                                <p className="mt-1 text-xs text-stone-500">Edit the consent section displayed inside the Privacy Notice.</p>
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div>
                                                    <FieldLabel>Consent Icon</FieldLabel>
                                                    <select value={policyContent.consent_icon} onChange={(e) => updatePolicyField('consent_icon', e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700">
                                                        {POLICY_ICON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                    </select>
                                                </div>
                                                <div><FieldLabel>Consent Heading</FieldLabel><Input value={policyContent.consent_title} onChange={(e) => updatePolicyField('consent_title', e.target.value)} maxLength={160} /></div>
                                            </div>
                                            <div className="mt-4"><FieldLabel>Consent Statement</FieldLabel><textarea value={policyContent.consent_body} onChange={(e) => updatePolicyField('consent_body', e.target.value)} rows={5} maxLength={1800} className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm" /></div>
                                            <div className="mt-4"><FieldLabel>Consent Additional Note</FieldLabel><textarea value={policyContent.consent_note} onChange={(e) => updatePolicyField('consent_note', e.target.value)} rows={4} maxLength={1200} className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm" /></div>
                                            {renderContentGroupActions('policy', 'consent')}
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                            <div className="-mx-4 -mt-4 mb-5 border-b border-stone-200 bg-stone-100/70 px-4 py-3.5">
                                                <p className="text-sm font-semibold text-stone-900">Terms of Use</p>
                                                <p className="mt-1 text-xs text-stone-500">Choose its page icon and edit the introduction and six terms sections.</p>
                                            </div>
                                            <div className="max-w-xs">
                                                <FieldLabel>Terms Page Icon</FieldLabel>
                                                <select value={policyContent.terms_icon} onChange={(e) => updatePolicyField('terms_icon', e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700">
                                                    {POLICY_ICON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="mt-4"><FieldLabel>Terms Introduction</FieldLabel><textarea value={policyContent.terms_intro} onChange={(e) => updatePolicyField('terms_intro', e.target.value)} rows={4} maxLength={1600} className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm" /></div>
                                            <div className="mt-4 space-y-3">
                                                {policyContent.terms_sections.map((section, index) => (
                                                    <div key={`terms-${index}`} className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                                                        <FieldLabel>Terms Section {index + 1}</FieldLabel>
                                                        <Input value={section.title} onChange={(e) => updatePolicySection('terms_sections', index, 'title', e.target.value)} maxLength={160} />
                                                        <textarea value={section.body} onChange={(e) => updatePolicySection('terms_sections', index, 'body', e.target.value)} rows={4} maxLength={1800} className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm" />
                                                    </div>
                                                ))}
                                            </div>
                                            {renderContentGroupActions('policy', 'terms')}
                                        </div>
                                    </div>
                                </GroupCard>
                            ) : null}

                            {activeLandingSection === 'notice' ? (
                                <GroupCard title="Featured Public Notice" icon={Megaphone}>
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-xs font-semibold text-stone-800">Landing-page notice</p>
                                                <p className="mt-1 text-[11px] text-stone-500">
                                                    Publish one important public update without exposing internal office notifications.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {renderSectionActions(restoreFeaturedNoticeDefaults, saveFeaturedNotice, 'notice')}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-stone-200 bg-white p-4">
                                            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-stone-400">Visibility</p>
                                            <Toggle
                                                value={featuredNotice.is_visible}
                                                onChange={(value) => setFeaturedNotice((current) => ({ ...current, is_visible: value }))}
                                                labels={['Published', 'Hidden']}
                                            />
                                        </div>

                                        <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 md:grid-cols-2">
                                            <div className="md:col-span-2">
                                                <FieldLabel>Notice Title</FieldLabel>
                                                <Input
                                                    value={featuredNotice.title}
                                                    onChange={(event) => setFeaturedNotice((current) => ({ ...current, title: event.target.value }))}
                                                    maxLength={140}
                                                    className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                                                    placeholder="Important scholarship update"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <FieldLabel>Public Message</FieldLabel>
                                                <textarea
                                                    value={featuredNotice.message}
                                                    onChange={(event) => setFeaturedNotice((current) => ({ ...current, message: event.target.value }))}
                                                    maxLength={500}
                                                    rows={5}
                                                    className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-700 outline-none"
                                                    placeholder="Write a short public notice for applicants and families."
                                                />
                                            </div>
                                            <div>
                                                <FieldLabel>Button Label (Optional)</FieldLabel>
                                                <Input
                                                    value={featuredNotice.link_label}
                                                    onChange={(event) => setFeaturedNotice((current) => ({ ...current, link_label: event.target.value }))}
                                                    maxLength={60}
                                                    className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                                                    placeholder="Learn more"
                                                />
                                            </div>
                                            <div>
                                                <FieldLabel>Button Link (Optional)</FieldLabel>
                                                <Input
                                                    value={featuredNotice.link_url}
                                                    onChange={(event) => setFeaturedNotice((current) => ({ ...current, link_url: event.target.value }))}
                                                    className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                                                    placeholder="https://... or /landing"
                                                />
                                            </div>
                                            <div>
                                                <FieldLabel>Publish From (Optional)</FieldLabel>
                                                <Input
                                                    type="date"
                                                    value={featuredNotice.start_date}
                                                    onChange={(event) => setFeaturedNotice((current) => ({ ...current, start_date: event.target.value }))}
                                                    className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <FieldLabel>Publish Until (Optional)</FieldLabel>
                                                <Input
                                                    type="date"
                                                    value={featuredNotice.end_date}
                                                    onChange={(event) => setFeaturedNotice((current) => ({ ...current, end_date: event.target.value }))}
                                                    className="h-10 rounded-lg border-stone-200 bg-stone-50/50 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                </GroupCard>
                            ) : null}

                            {activeLandingSection === 'faq' ? (
                                <GroupCard title="Landing FAQs" icon={LayoutTemplate}>
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50/80 p-4 md:flex-row md:items-center md:justify-between">
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
                                                    className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
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
                                                    ? 'Archived landing FAQs will appear here.'
                                                    : 'Add a landing FAQ to start building the public help section.'
                                            }
                                        />
                                    )}
                                </div>
                            </GroupCard>
                            ) : null}
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
