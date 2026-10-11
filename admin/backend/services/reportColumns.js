// Keep previews, printed tables, and exports on the same concise field set.
const fields = {
    row_number: 'No.', last_name: 'Last Name', given_name: 'Given Name', middle_initial: 'MI',
    middle_name: 'Middle Name', period_from: 'Period Covered From', period_to: 'Period Covered To',
    pdm_id: 'Student Number', student_name: 'Student Name', course_code: 'Course',
    year_level: 'Year', program_name: 'Program', benefactor_name: 'Benefactor',
    academic_period: 'Academic Period', gwa: 'GWA', application_status: 'Application Status',
    document_status: 'Documents', verification_status: 'Verification', scholarship_status: 'Scholarship Status',
    ro_status: 'RO Status', history_summary: 'Scholarship History', latest_status: 'Latest Status',
    scholar_count: 'Scholars', payout_title: 'Payout', payout_date: 'Payout Date',
    amount_received: 'Amount Received', release_status: 'Release Status', payment_mode: 'Payout Mode',
    payout_venue: 'Venue',
    proof_status: 'Proof Status', submitted_at: 'Uploaded At', renewal_status: 'Renewal Status',
    opening_title: 'Opening', total_slots: 'Total Slots', filled_slots: 'Filled Slots',
    available_slots: 'Available Slots', released_slots: 'Released Slots', opening_status: 'Status',
    sdo_status: 'SDO Result', sdo_remarks: 'SDO Remarks', offense_classification: 'Offense Classification',
    remarks: 'Remarks', guidance_status: 'Guidance Result', guidance_remarks: 'Guidance Remarks',
    pd_status: 'PD Result', pd_remarks: 'PD Remarks', overall_status: 'Overall Status',
    ro_area: 'RO Area', required_hours: 'Required Hours', validated_hours: 'Validated Hours',
    progress_status: 'Progress Status', assigned_areas: 'RO Area', personnel_in_charge: 'PIC Name',
    remaining_hours: 'Remaining Hours', compliance_status: 'Compliance Status',
};

const REPORT_FIELDS = {
    applications: ['pdm_id', 'student_name', 'course_code', 'program_name', 'academic_period', 'application_status', 'document_status', 'verification_status'],
    scholars: ['row_number', 'last_name', 'given_name', 'middle_initial', 'course_code', 'year_level', 'benefactor_name'],
    beneficiary_graduates: ['row_number', 'last_name', 'given_name', 'middle_initial', 'course_code', 'benefactor_name', 'period_from', 'period_to'],
    newly_recommended: ['row_number', 'last_name', 'given_name', 'middle_name', 'course_code', 'year_level', 'gwa'],
    benefactor_grades: ['pdm_id', 'student_name', 'course_code', 'year_level', 'benefactor_name', 'program_name', 'academic_period', 'gwa'],
    scholarship_history: ['pdm_id', 'student_name', 'course_code', 'program_name', 'benefactor_name', 'history_summary', 'latest_status'],
    scholars_by_benefactor: ['benefactor_name', 'program_name', 'scholar_count'],
    payouts: ['pdm_id', 'student_name', 'payout_title', 'academic_period', 'payout_date', 'payout_venue', 'payment_mode', 'amount_received', 'release_status'],
    payout_proofs: ['pdm_id', 'student_name', 'payout_title', 'academic_period', 'amount_received', 'submitted_at', 'proof_status'],
    renewals: ['pdm_id', 'student_name', 'course_code', 'program_name', 'benefactor_name', 'academic_period', 'gwa', 'renewal_status'],
    slot_utilization: ['opening_title', 'program_name', 'benefactor_name', 'academic_period', 'total_slots', 'filled_slots', 'available_slots', 'released_slots', 'opening_status'],
    sdo: ['pdm_id', 'student_name', 'course_code', 'program_name', 'academic_period', 'sdo_status', 'sdo_remarks'],
    sdo_offenses: ['pdm_id', 'student_name', 'course_code', 'program_name', 'academic_period', 'offense_classification', 'remarks'],
    guidance: ['pdm_id', 'student_name', 'course_code', 'program_name', 'academic_period', 'guidance_status', 'guidance_remarks'],
    pd: ['pdm_id', 'student_name', 'course_code', 'program_name', 'academic_period', 'pd_status', 'pd_remarks'],
    endorsements: ['pdm_id', 'student_name', 'course_code', 'program_name', 'academic_period', 'sdo_status', 'guidance_status', 'pd_status', 'overall_status'],
    ro: ['pdm_id', 'student_name', 'course_code', 'academic_period', 'ro_area', 'required_hours', 'validated_hours', 'progress_status'],
    ro_compliance: ['pdm_id', 'student_name', 'course_code', 'academic_period', 'assigned_areas', 'personnel_in_charge', 'validated_hours', 'remaining_hours', 'compliance_status'],
};

function getReportColumns(type, filters = {}) {
    if (!REPORT_FIELDS[type]) throw new Error('Unknown report columns.');
    const keys = [...REPORT_FIELDS[type]];
    if (type === 'newly_recommended' && (!filters.benefactorId || filters.benefactorId === 'all')) keys.push('benefactor_name');
    if (type === 'newly_recommended' && (!filters.academicYearId || filters.academicYearId === 'all' || !filters.semester || filters.semester === 'all')) keys.push('academic_period');
    return keys.map((key) => ({ key, header: type === 'newly_recommended' && key === 'gwa' ? 'GWA (Current Record)' : fields[key] }));
}

function prepareReportRow(row) {
    return {
        ...row,
        last_name: row.last_name ?? row._last_name ?? '',
        given_name: row.given_name ?? row._given_name ?? '',
        middle_initial: row.middle_initial ?? row._middle_initial ?? '',
        academic_period: [row.applicable_academic_year || row.academic_year, row.semester].filter(Boolean).join(' / '),
        gwa: row.gwa ?? row._gwa ?? null,
    };
}

module.exports = { getReportColumns, prepareReportRow };
