import React, { useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Search,
    Users,
    AlertTriangle,
    RefreshCw,
    CheckCircle2,
    ArrowRightLeft,
    ShieldAlert,
    GraduationCap,
    FileCheck2,
    Loader2,
    Eye,
    X,
    GitCompareArrows,
    CircleDot,
} from "lucide-react";

const C = {
    brown: '#5c2d0e',
    brownMid: '#7c4a2e',
    amber: '#d97706',
    amberSoft: '#FFF7ED',
    green: '#16a34a',
    greenSoft: '#F0FDF4',
    red: '#dc2626',
    redSoft: '#FEF2F2',
    blue: '#2563eb',
    blueSoft: '#EFF6FF',
    text: '#1c1917',
    bg: '#faf7f2',
    muted: '#78716c',
    border: '#e7e5e4',
};

const SLOT_STATUS_STYLE = {
    secure: { label: 'Secure', color: C.green, bg: C.greenSoft },
    under_review: { label: 'Under Review', color: C.amber, bg: C.amberSoft },
    possible_vacancy: { label: 'Possible Vacancy', color: C.red, bg: C.redSoft },
    vacated: { label: 'Vacated', color: '#991b1b', bg: '#fee2e2' },
    replaced: { label: 'Replaced', color: C.blue, bg: C.blueSoft },
};

const CANDIDATE_STATUS_STYLE = {
    candidate: { label: 'Candidate', color: C.blue, bg: C.blueSoft },
    shortlisted: { label: 'Shortlisted', color: C.amber, bg: C.amberSoft },
    assigned: { label: 'Assigned', color: C.green, bg: C.greenSoft },
    declined: { label: 'Declined', color: C.red, bg: C.redSoft },
};

const RISK_REASON_STYLE = {
    gwa: { label: 'Low / Risk GWA', color: C.red, bg: C.redSoft },
    incomplete_grade: { label: 'Incomplete Grade', color: C.amber, bg: C.amberSoft },
    sdu: { label: 'SDU Concern', color: C.red, bg: '#fee2e2' },
    ro: { label: 'RO Compliance', color: C.amber, bg: C.amberSoft },
    withdrawal: { label: 'Withdrawal', color: C.red, bg: C.redSoft },
    other: { label: 'Other', color: '#57534e', bg: '#f5f5f4' },
};

const VIEW_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'slots', label: 'At-Risk / Vacated Slots' },
    { id: 'pool', label: 'Replacement Pool' },
    { id: 'workspace', label: 'Matching Workspace' },
];

function getSlotMeta(value) {
    return SLOT_STATUS_STYLE[value] || SLOT_STATUS_STYLE.under_review;
}

function getCandidateMeta(value) {
    return CANDIDATE_STATUS_STYLE[value] || CANDIDATE_STATUS_STYLE.candidate;
}

function getRiskMeta(value) {
    return RISK_REASON_STYLE[value] || RISK_REASON_STYLE.other;
}

function scoreCandidateForSlot(slot, candidate) {
    let score = 0;

    const gwa = Number(candidate.gwa || 99);
    if (gwa <= 1.25) score += 35;
    else if (gwa <= 1.5) score += 30;
    else if (gwa <= 1.75) score += 25;
    else if (gwa <= 2.0) score += 20;
    else score += 5;

    if ((slot.program_name || '') === (candidate.program_name || '')) score += 30;
    if ((slot.organization_name || '') === (candidate.recommended_program_name || '')) score += 10;
    if (candidate.documents_ready) score += 20;
    if (candidate.verified) score += 15;
    if (candidate.waitlist_rank && Number(candidate.waitlist_rank) <= 5) score += 10;

    return score;
}

function buildRecommendations(slots, candidates) {
    return slots.map((slot) => {
        const ranked = candidates
            .filter((candidate) => candidate.replacement_status !== 'assigned')
            .map((candidate) => ({
                ...candidate,
                match_score: scoreCandidateForSlot(slot, candidate),
            }))
            .sort((a, b) => b.match_score - a.match_score);

        return {
            ...slot,
            recommendations: ranked.slice(0, 5),
        };
    });
}

function StatusPill({ meta }) {
    return (
        <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium"
            style={{ background: meta.bg, color: meta.color }}
        >
            {meta.label}
        </span>
    );
}

function MiniInfo({ label, value, mono = false }) {
    return (
        <div>
            <p className="text-[10px] uppercase tracking-wide text-stone-400">{label}</p>
            <p className={`text-sm ${mono ? 'font-mono' : 'font-medium'} text-stone-800 mt-0.5`}>
                {value || 'N/A'}
            </p>
        </div>
    );
}

function CandidateProfileModal({ candidate, onClose }) {
    if (!candidate) return null;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-2xl border-stone-200 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">Replacement Candidate Profile</h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            {candidate.name} · {candidate.student_number}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <CardContent className="p-5 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <MiniInfo label="Applicant Name" value={candidate.name} />
                        <MiniInfo label="Student Number" value={candidate.student_number} mono />
                        <MiniInfo label="Program Applied" value={candidate.program_name} />
                        <MiniInfo label="Recommended Program" value={candidate.recommended_program_name} />
                        <MiniInfo label="GWA" value={candidate.gwa} mono />
                        <MiniInfo label="Waitlist Rank" value={candidate.waitlist_rank || 'N/A'} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <StatusPill meta={getCandidateMeta(candidate.replacement_status)} />
                        <StatusPill meta={candidate.documents_ready ? { label: 'Documents Ready', color: C.green, bg: C.greenSoft } : { label: 'Docs Incomplete', color: C.red, bg: C.redSoft }} />
                        <StatusPill meta={candidate.verified ? { label: 'Verified', color: C.blue, bg: C.blueSoft } : { label: 'Needs Review', color: C.amber, bg: C.amberSoft }} />
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                        <p className="text-xs font-medium text-stone-700 mb-2">Admin Notes</p>
                        <p className="text-sm text-stone-600 leading-relaxed">
                            {candidate.remarks || 'No remarks available for this applicant.'}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function AssignReplacementModal({ slot, candidate, onClose, onConfirm, saving }) {
    const [notes, setNotes] = useState('');

    useEffect(() => {
        setNotes('');
    }, [slot, candidate]);

    if (!slot || !candidate) return null;

    return (
        <div
            className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-2xl border-stone-200 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">Assign Replacement Slot</h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Confirm reassignment to available / vacated scholarship slot
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <CardContent className="p-5 space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-stone-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
                                Vacated / At-Risk Slot
                            </p>
                            <div className="space-y-3">
                                <MiniInfo label="Scholar" value={slot.scholar_name} />
                                <MiniInfo label="Program" value={slot.program_name} />
                                <MiniInfo label="Benefactor" value={slot.organization_name} />
                                <MiniInfo label="Risk Reason" value={getRiskMeta(slot.risk_reason).label} />
                                <StatusPill meta={getSlotMeta(slot.slot_status)} />
                            </div>
                        </div>

                        <div className="rounded-xl border border-stone-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
                                Selected Candidate
                            </p>
                            <div className="space-y-3">
                                <MiniInfo label="Applicant" value={candidate.name} />
                                <MiniInfo label="GWA" value={candidate.gwa} mono />
                                <MiniInfo label="Program Applied" value={candidate.program_name} />
                                <MiniInfo label="Recommended Match Score" value={`${candidate.match_score || 0}`} mono />
                                <StatusPill meta={getCandidateMeta(candidate.replacement_status)} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400 block mb-1.5">
                            Assignment Notes
                        </label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add assignment justification, compatibility notes, or admin remarks..."
                            className="min-h-[100px] rounded-lg border-stone-200 text-sm resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="h-9 rounded-lg border-stone-200 text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => onConfirm({ slot, candidate, notes })}
                            disabled={saving}
                            className="h-9 rounded-lg text-white text-xs border-none"
                            style={{ background: C.brownMid }}
                        >
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                            Confirm Assignment
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function ReplacementManagement() {
    const [loading, setLoading] = useState(true);
    const [savingAssignment, setSavingAssignment] = useState(false);
    const [error, setError] = useState(null);

    const [slotRows, setSlotRows] = useState([]);
    const [candidateRows, setCandidateRows] = useState([]);

    const [tab, setTab] = useState('overview');

    const [searchSlots, setSearchSlots] = useState('');
    const [searchCandidates, setSearchCandidates] = useState('');

    const [slotStatusFilter, setSlotStatusFilter] = useState('All Slot');
    const [candidateStatusFilter, setCandidateStatusFilter] = useState('All Candidate');

    const [selectedSlotId, setSelectedSlotId] = useState(null);
    const [selectedCandidateId, setSelectedCandidateId] = useState(null);

    const [candidateModal, setCandidateModal] = useState(null);
    const [assignmentModal, setAssignmentModal] = useState({ slot: null, candidate: null });

    useEffect(() => {
        const fetchReplacementData = async () => {
            try {
                setLoading(true);
                setError(null);

                const token = localStorage.getItem('adminToken');

                const [slotsRes, candidatesRes] = await Promise.all([
                    fetch('http://localhost:5000/api/replacements/slots', {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    }).catch(() => null),
                    fetch('http://localhost:5000/api/replacements/candidates', {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    }).catch(() => null),
                ]);

                let slots = [];
                let candidates = [];

                if (slotsRes && slotsRes.ok) {
                    slots = await slotsRes.json();
                } else {
                    slots = [
                        {
                            slot_id: 'slot-1',
                            scholar_name: 'Maria Santos',
                            scholar_id: 'SCH-001',
                            student_number: '2023-0001',
                            gwa: '2.18',
                            program_name: 'TES - Tertiary Education Subsidy',
                            organization_name: 'CHED',
                            slot_status: 'possible_vacancy',
                            risk_reason: 'incomplete_grade',
                            remarks: 'One subject has no final grade yet.',
                        },
                        {
                            slot_id: 'slot-2',
                            scholar_name: 'John Dela Cruz',
                            scholar_id: 'SCH-002',
                            student_number: '2023-0002',
                            gwa: '2.27',
                            program_name: 'Kaizen Scholarship',
                            organization_name: 'Kaizen',
                            slot_status: 'vacated',
                            risk_reason: 'gwa',
                            remarks: 'Retention requirement no longer met.',
                        },
                        {
                            slot_id: 'slot-3',
                            scholar_name: 'Angela Reyes',
                            scholar_id: 'SCH-003',
                            student_number: '2022-0148',
                            gwa: '1.89',
                            program_name: 'Food Crafters Grant',
                            organization_name: 'Food Crafters',
                            slot_status: 'under_review',
                            risk_reason: 'ro',
                            remarks: 'RO compliance still under checking.',
                        },
                    ];
                }

                if (candidatesRes && candidatesRes.ok) {
                    candidates = await candidatesRes.json();
                } else {
                    candidates = [
                        {
                            application_id: 'app-1001',
                            id: 'app-1001',
                            name: 'Paolo Manansala',
                            student_number: '2024-0311',
                            gwa: '1.32',
                            program_name: 'TES - Tertiary Education Subsidy',
                            recommended_program_name: 'CHED',
                            replacement_status: 'candidate',
                            waitlist_rank: 1,
                            documents_ready: true,
                            verified: true,
                            remarks: 'Complete documents and strong academic standing.',
                        },
                        {
                            application_id: 'app-1002',
                            id: 'app-1002',
                            name: 'Leah Mendoza',
                            student_number: '2024-0407',
                            gwa: '1.48',
                            program_name: 'Kaizen Scholarship',
                            recommended_program_name: 'Kaizen',
                            replacement_status: 'shortlisted',
                            waitlist_rank: 2,
                            documents_ready: true,
                            verified: true,
                            remarks: 'Excellent fit for private benefactor slot.',
                        },
                        {
                            application_id: 'app-1003',
                            id: 'app-1003',
                            name: 'Ralph Torres',
                            student_number: '2024-0278',
                            gwa: '1.74',
                            program_name: 'TES - Tertiary Education Subsidy',
                            recommended_program_name: 'CHED',
                            replacement_status: 'candidate',
                            waitlist_rank: 4,
                            documents_ready: true,
                            verified: false,
                            remarks: 'Pending one final admin verification step.',
                        },
                    ];
                }

                setSlotRows(Array.isArray(slots) ? slots : []);
                setCandidateRows(Array.isArray(candidates) ? candidates : []);
            } catch (err) {
                console.error('REPLACEMENT MANAGEMENT FETCH ERROR:', err);
                setError(err.message || 'Failed to load replacement management data');
            } finally {
                setLoading(false);
            }
        };

        fetchReplacementData();
    }, []);

    const filteredSlots = useMemo(() => {
        const q = searchSlots.trim().toLowerCase();

        return slotRows.filter((slot) => {
            const matchSearch =
                !q ||
                String(slot.scholar_name || '').toLowerCase().includes(q) ||
                String(slot.student_number || '').toLowerCase().includes(q) ||
                String(slot.program_name || '').toLowerCase().includes(q) ||
                String(slot.organization_name || '').toLowerCase().includes(q);

            const matchStatus =
                slotStatusFilter === 'All Slot' || slot.slot_status === slotStatusFilter;

            return matchSearch && matchStatus;
        });
    }, [slotRows, searchSlots, slotStatusFilter]);

    const filteredCandidates = useMemo(() => {
        const q = searchCandidates.trim().toLowerCase();

        return candidateRows.filter((candidate) => {
            const matchSearch =
                !q ||
                String(candidate.name || '').toLowerCase().includes(q) ||
                String(candidate.student_number || '').toLowerCase().includes(q) ||
                String(candidate.program_name || '').toLowerCase().includes(q);

            const matchStatus =
                candidateStatusFilter === 'All Candidate' || candidate.replacement_status === candidateStatusFilter;

            return matchSearch && matchStatus;
        });
    }, [candidateRows, searchCandidates, candidateStatusFilter]);

    const recommendationRows = useMemo(() => {
        return buildRecommendations(filteredSlots, filteredCandidates);
    }, [filteredSlots, filteredCandidates]);

    const selectedSlot = useMemo(
        () => recommendationRows.find((slot) => slot.slot_id === selectedSlotId) || recommendationRows[0] || null,
        [recommendationRows, selectedSlotId]
    );

    const workspaceCandidates = useMemo(() => selectedSlot?.recommendations || [], [selectedSlot]);

    const selectedCandidate = useMemo(
        () =>
            workspaceCandidates.find((candidate) => candidate.id === selectedCandidateId) ||
            workspaceCandidates[0] ||
            null,
        [workspaceCandidates, selectedCandidateId]
    );

    useEffect(() => {
        if (selectedSlot && selectedSlotId !== selectedSlot.slot_id) {
            setSelectedSlotId(selectedSlot.slot_id);
        }
    }, [selectedSlot, selectedSlotId]);

    useEffect(() => {
        if (selectedCandidate && selectedCandidateId !== selectedCandidate.id) {
            setSelectedCandidateId(selectedCandidate.id);
        }
    }, [selectedCandidate, selectedCandidateId]);

    const dashboardStats = useMemo(() => {
        return {
            total_slots: slotRows.length,
            vacant_slots: slotRows.filter((s) => s.slot_status === 'vacated').length,
            at_risk_slots: slotRows.filter((s) => s.slot_status === 'possible_vacancy' || s.slot_status === 'under_review').length,
            candidate_pool: candidateRows.filter((c) => c.replacement_status !== 'assigned').length,
        };
    }, [slotRows, candidateRows]);

    const handleAssignReplacement = async ({ slot, candidate, notes }) => {
        try {
            setSavingAssignment(true);

            const token = localStorage.getItem('adminToken');
            const res = await fetch('http://localhost:5000/api/replacements/assign', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    slot_id: slot.slot_id,
                    application_id: candidate.application_id || candidate.id,
                    notes,
                }),
            }).catch(() => null);

            if (res && !res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || 'Failed to assign replacement');
            }

            setSlotRows((prev) =>
                prev.map((row) =>
                    row.slot_id === slot.slot_id
                        ? {
                            ...row,
                            slot_status: 'replaced',
                            replacement_application_id: candidate.application_id || candidate.id,
                            replacement_name: candidate.name,
                        }
                        : row
                )
            );

            setCandidateRows((prev) =>
                prev.map((row) =>
                    row.id === candidate.id
                        ? {
                            ...row,
                            replacement_status: 'assigned',
                            assigned_slot_id: slot.slot_id,
                        }
                        : row
                )
            );

            setAssignmentModal({ slot: null, candidate: null });
        } catch (err) {
            console.error('ASSIGN REPLACEMENT ERROR:', err);
            alert(err.message || 'Failed to assign replacement');
        } finally {
            setSavingAssignment(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
                <p className="text-xs text-stone-400 uppercase tracking-widest">
                    Loading replacement management...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
                <AlertTriangle className="w-7 h-7 text-red-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-red-800">Failed to load replacement management</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
                <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    size="sm"
                    className="mt-4 border-red-200 text-red-600 text-xs"
                >
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-5 py-2" style={{ background: C.bg }}>
            <CandidateProfileModal
                candidate={candidateModal}
                onClose={() => setCandidateModal(null)}
            />

            <AssignReplacementModal
                slot={assignmentModal.slot}
                candidate={assignmentModal.candidate}
                onClose={() => setAssignmentModal({ slot: null, candidate: null })}
                onConfirm={handleAssignReplacement}
                saving={savingAssignment}
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
                        Replacement Management
                    </h1>
                    <p className="text-sm mt-0.5" style={{ color: C.muted }}>
                        Manage at-risk scholarship slots and assign replacement candidates
                    </p>
                </div>

                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="rounded-lg text-xs border-stone-200 text-stone-600"
                >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Refresh
                </Button>
            </div>

            <div className="flex flex-wrap gap-2">
                {VIEW_TABS.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setTab(item.id)}
                        className={`px-3.5 py-2 rounded-full text-xs font-medium border transition-all ${tab === item.id
                                ? 'bg-white border-stone-300 text-stone-800 shadow-sm'
                                : 'bg-transparent border-stone-200 text-stone-500 hover:bg-white'
                            }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {(tab === 'overview' || tab === 'slots' || tab === 'pool' || tab === 'workspace') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        {
                            label: 'Total Slots',
                            value: dashboardStats.total_slots,
                            icon: GraduationCap,
                            accent: C.brown,
                            soft: C.amberSoft,
                        },
                        {
                            label: 'Vacated Slots',
                            value: dashboardStats.vacant_slots,
                            icon: AlertTriangle,
                            accent: C.red,
                            soft: C.redSoft,
                        },
                        {
                            label: 'At-Risk Slots',
                            value: dashboardStats.at_risk_slots,
                            icon: ShieldAlert,
                            accent: C.amber,
                            soft: C.amberSoft,
                        },
                        {
                            label: 'Candidate Pool',
                            value: dashboardStats.candidate_pool,
                            icon: Users,
                            accent: C.blue,
                            soft: C.blueSoft,
                        },
                    ].map((s) => (
                        <Card key={s.label} className="border-stone-200 shadow-none">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                                <div
                                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ background: s.soft }}
                                >
                                    <s.icon className="w-4 h-4" style={{ color: s.accent }} />
                                </div>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <div className="text-2xl font-semibold" style={{ color: C.text }}>
                                    {s.value}
                                </div>
                                <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {(tab === 'overview' || tab === 'slots') && (
                <Card className="border-stone-200 shadow-none overflow-hidden">
                    <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-stone-800">At-Risk / Vacated Slots</h2>
                                <p className="text-xs text-stone-400">
                                    Scholars whose slot is under review, likely vacated, or already available for replacement
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative min-w-[220px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
                                    <Input
                                        value={searchSlots}
                                        onChange={(e) => setSearchSlots(e.target.value)}
                                        placeholder="Search scholar / slot..."
                                        className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
                                    />
                                </div>

                                <Select value={slotStatusFilter} onValueChange={setSlotStatusFilter}>
                                    <SelectTrigger className="w-[170px] h-9 rounded-lg border-stone-200 text-sm bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All Slot">All Slot</SelectItem>
                                        <SelectItem value="under_review">Under Review</SelectItem>
                                        <SelectItem value="possible_vacancy">Possible Vacancy</SelectItem>
                                        <SelectItem value="vacated">Vacated</SelectItem>
                                        <SelectItem value="replaced">Replaced</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3">
                        {filteredSlots.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
                                <p className="text-sm font-medium text-stone-600">No replacement slots found</p>
                                <p className="text-xs text-stone-400 mt-1">Try changing your filters.</p>
                            </div>
                        ) : (
                            filteredSlots.map((slot) => {
                                const slotMeta = getSlotMeta(slot.slot_status);
                                const riskMeta = getRiskMeta(slot.risk_reason);

                                return (
                                    <div
                                        key={slot.slot_id}
                                        className={`rounded-xl border p-4 bg-white transition-all ${selectedSlotId === slot.slot_id ? 'border-blue-300 shadow-sm bg-blue-50/30' : 'border-stone-200'
                                            }`}
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-semibold text-stone-800">{slot.scholar_name}</p>
                                                    <StatusPill meta={slotMeta} />
                                                    <StatusPill meta={riskMeta} />
                                                </div>
                                                <p className="text-xs text-stone-400 mt-1">
                                                    {slot.student_number} · {slot.program_name} · {slot.organization_name}
                                                </p>
                                                <p className="text-xs text-stone-500 mt-2">
                                                    {slot.remarks || 'No remarks available.'}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge className="bg-stone-100 text-stone-700 border-stone-200 text-[10px]">
                                                    GWA: {slot.gwa || 'N/A'}
                                                </Badge>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 px-3 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs shadow-none"
                                                    onClick={() => {
                                                        setSelectedSlotId(slot.slot_id);
                                                        setTab('workspace');
                                                    }}
                                                >
                                                    <GitCompareArrows className="w-3.5 h-3.5 mr-1.5" />
                                                    Match Candidates
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>
            )}

            {(tab === 'overview' || tab === 'pool') && (
                <Card className="border-stone-200 shadow-none overflow-hidden">
                    <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-stone-800">Replacement Candidate Pool</h2>
                                <p className="text-xs text-stone-400">
                                    Qualified applicants who were not awarded a slot but can be considered for reassignment
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative min-w-[220px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
                                    <Input
                                        value={searchCandidates}
                                        onChange={(e) => setSearchCandidates(e.target.value)}
                                        placeholder="Search candidate..."
                                        className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
                                    />
                                </div>

                                <Select value={candidateStatusFilter} onValueChange={setCandidateStatusFilter}>
                                    <SelectTrigger className="w-[180px] h-9 rounded-lg border-stone-200 text-sm bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All Candidate">All Candidate</SelectItem>
                                        <SelectItem value="candidate">Candidate</SelectItem>
                                        <SelectItem value="shortlisted">Shortlisted</SelectItem>
                                        <SelectItem value="assigned">Assigned</SelectItem>
                                        <SelectItem value="declined">Declined</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3">
                        {filteredCandidates.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
                                <p className="text-sm font-medium text-stone-600">No replacement candidates found</p>
                                <p className="text-xs text-stone-400 mt-1">Try changing your filters.</p>
                            </div>
                        ) : (
                            filteredCandidates.map((candidate) => {
                                const statusMeta = getCandidateMeta(candidate.replacement_status);

                                return (
                                    <div
                                        key={candidate.id}
                                        className={`rounded-xl border p-4 bg-white transition-all ${selectedCandidateId === candidate.id ? 'border-blue-300 shadow-sm bg-blue-50/30' : 'border-stone-200'
                                            }`}
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-semibold text-stone-800">{candidate.name}</p>
                                                    <StatusPill meta={statusMeta} />
                                                    <StatusPill meta={candidate.documents_ready ? { label: 'Documents Ready', color: C.green, bg: C.greenSoft } : { label: 'Docs Incomplete', color: C.red, bg: C.redSoft }} />
                                                </div>
                                                <p className="text-xs text-stone-400 mt-1">
                                                    {candidate.student_number} · {candidate.program_name}
                                                </p>
                                                <p className="text-xs text-stone-500 mt-2">
                                                    {candidate.remarks || 'No remarks available.'}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge className="bg-stone-100 text-stone-700 border-stone-200 text-[10px]">
                                                    GWA: {candidate.gwa || 'N/A'}
                                                </Badge>
                                                <Badge className="bg-stone-100 text-stone-700 border-stone-200 text-[10px]">
                                                    Rank: {candidate.waitlist_rank || 'N/A'}
                                                </Badge>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 px-3 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs shadow-none"
                                                    onClick={() => setCandidateModal(candidate)}
                                                >
                                                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                                                    View
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>
            )}

            {(tab === 'overview' || tab === 'workspace') && (
                <Card className="border-stone-200 shadow-none overflow-hidden">
                    <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
                        <div>
                            <h2 className="text-sm font-semibold text-stone-800">Matching Workspace</h2>
                            <p className="text-xs text-stone-400">
                                Compare an at-risk slot against the strongest replacement candidates
                            </p>
                        </div>
                    </CardHeader>

                    <CardContent className="p-4">
                        {!selectedSlot ? (
                            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
                                <p className="text-sm font-medium text-stone-600">No slot selected</p>
                                <p className="text-xs text-stone-400 mt-1">Choose a slot from the At-Risk / Vacated list.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
                                <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                                            Selected Slot
                                        </p>
                                        <p className="text-base font-semibold text-stone-800 mt-2">{selectedSlot.scholar_name}</p>
                                        <p className="text-xs text-stone-400 mt-1">
                                            {selectedSlot.student_number} · {selectedSlot.program_name}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <StatusPill meta={getSlotMeta(selectedSlot.slot_status)} />
                                        <StatusPill meta={getRiskMeta(selectedSlot.risk_reason)} />
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        <MiniInfo label="Benefactor" value={selectedSlot.organization_name} />
                                        <MiniInfo label="Current GWA" value={selectedSlot.gwa} mono />
                                        <MiniInfo label="Reason Note" value={selectedSlot.remarks || 'N/A'} />
                                    </div>

                                    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CircleDot className="w-4 h-4 text-stone-400" />
                                            <p className="text-xs font-medium text-stone-600">Admin Guidance</p>
                                        </div>
                                        <p className="text-xs text-stone-500 leading-relaxed">
                                            Prioritize candidates with complete documents, strong GWA, and the highest compatibility with the vacated benefactor/program slot.
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                                    <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
                                        <div className="flex items-center gap-2">
                                            <GitCompareArrows className="w-4 h-4 text-stone-500" />
                                            <h4 className="text-sm font-semibold text-stone-800">Recommended Candidates</h4>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-3">
                                        {workspaceCandidates.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
                                                <p className="text-sm font-medium text-stone-600">No recommendation available</p>
                                                <p className="text-xs text-stone-400 mt-1">There are no eligible candidates for this slot right now.</p>
                                            </div>
                                        ) : (
                                            workspaceCandidates.map((candidate) => (
                                                <div
                                                    key={`${selectedSlot.slot_id}-${candidate.id}`}
                                                    className={`rounded-xl border p-4 transition-all ${selectedCandidateId === candidate.id
                                                            ? 'border-blue-300 bg-blue-50/30 shadow-sm'
                                                            : 'border-stone-200 bg-white'
                                                        }`}
                                                >
                                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="text-sm font-semibold text-stone-800">{candidate.name}</p>
                                                                <StatusPill meta={getCandidateMeta(candidate.replacement_status)} />
                                                                <Badge className="bg-stone-100 text-stone-700 border-stone-200 text-[10px]">
                                                                    Match Score: {candidate.match_score}
                                                                </Badge>
                                                            </div>

                                                            <p className="text-xs text-stone-400 mt-1">
                                                                {candidate.student_number} · {candidate.program_name}
                                                            </p>

                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                <Badge className="bg-stone-100 text-stone-700 border-stone-200 text-[10px]">
                                                                    GWA: {candidate.gwa}
                                                                </Badge>
                                                                <Badge className="bg-stone-100 text-stone-700 border-stone-200 text-[10px]">
                                                                    Rank: {candidate.waitlist_rank || 'N/A'}
                                                                </Badge>
                                                                <Badge className={`${candidate.documents_ready ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'} text-[10px]`}>
                                                                    {candidate.documents_ready ? 'Documents Ready' : 'Docs Incomplete'}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 px-3 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs shadow-none"
                                                                onClick={() => setCandidateModal(candidate)}
                                                            >
                                                                <Eye className="w-3.5 h-3.5 mr-1.5" />
                                                                View
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                className="h-8 px-3 rounded-lg text-white text-xs border-none"
                                                                style={{ background: C.brownMid }}
                                                                onClick={() => setAssignmentModal({ slot: selectedSlot, candidate })}
                                                                disabled={candidate.replacement_status === 'assigned'}
                                                            >
                                                                <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                                                                Assign
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <footer className="pt-6 pb-2 border-t border-stone-100">
                <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
                    SMaRT PDM · Replacement Management Layer
                </p>
            </footer>
        </div>
    );
}