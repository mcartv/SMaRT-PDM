import React, { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Globe, Calendar, Save, Check, MapPin, Clock3, Phone, Building2 } from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { C, FieldLabel, GroupCard, Toggle } from './components/MaintenanceShared';

export default function GeneralPanel() {
    const defaultFaqs = [
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

    const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');
    const [officeName, setOfficeName] = useState('Office for Scholarship and Financial Assistance');
    const [officeEmail, setOfficeEmail] = useState('osfa@pdm.edu.ph');
    const [officeAddress, setOfficeAddress] = useState('Abangan Norte, Marilao, Bulacan');
    const [landlineNumber, setLandlineNumber] = useState('(044) 919-8191');
    const [officeHours, setOfficeHours] = useState('Monday - Friday, 8:00 AM - 5:00 PM');
    const [aboutOsfa, setAboutOsfa] = useState(
        'The Office for Scholarship and Financial Assistance helps manage scholarship access, application review coordination, and student support monitoring for qualified PDM students. Through SMaRT-PDM, applicants and offices can follow a clearer workflow for requirements, endorsement, status tracking, and final scholar readiness.'
    );
    const [landingFaqs, setLandingFaqs] = useState(defaultFaqs);
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
            setAboutOsfa(
                payload?.about_osfa ||
                    'The Office for Scholarship and Financial Assistance helps manage scholarship access, application review coordination, and student support monitoring for qualified PDM students. Through SMaRT-PDM, applicants and offices can follow a clearer workflow for requirements, endorsement, status tracking, and final scholar readiness.'
            );
            setLandingFaqs(
                Array.isArray(payload?.landing_faqs) && payload.landing_faqs.length
                    ? payload.landing_faqs.slice(0, 6).map((item, index) => ({
                        question: item?.question || defaultFaqs[index]?.question || '',
                        answer: item?.answer || defaultFaqs[index]?.answer || '',
                    }))
                    : defaultFaqs
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
            setTimeout(() => setSaved(false), 2000);
        } catch (nextError) {
            setError(nextError.message || 'Failed to save general settings.');
        }
    };

    const updateFaq = (index, field, value) => {
        setLandingFaqs((current) =>
            current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item
            )
        );
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

                <GroupCard title="Landing About OSFA" icon={Globe}>
                    <div className="space-y-3">
                        <div>
                            <FieldLabel>About OSFA Text</FieldLabel>
                            <textarea
                                value={aboutOsfa}
                                onChange={(e) => setAboutOsfa(e.target.value)}
                                rows={7}
                                className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-700 outline-none"
                                placeholder="Write the public About OSFA description shown on the landing page."
                            />
                        </div>
                    </div>
                </GroupCard>

                <GroupCard title="Landing FAQ" icon={Building2}>
                    <div className="space-y-4">
                        {landingFaqs.map((item, index) => (
                            <div key={`landing-faq-${index}`} className="rounded-lg border border-stone-100 bg-stone-50/70 p-3">
                                <div>
                                    <FieldLabel>Question {index + 1}</FieldLabel>
                                    <Input
                                        value={item.question}
                                        onChange={(e) => updateFaq(index, 'question', e.target.value)}
                                        className="h-9 rounded-lg border-stone-200 bg-white text-sm"
                                    />
                                </div>

                                <div className="mt-3">
                                    <FieldLabel>Answer {index + 1}</FieldLabel>
                                    <textarea
                                        value={item.answer}
                                        onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                                        rows={4}
                                        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </GroupCard>
            </div>
        </div>
    );
}
