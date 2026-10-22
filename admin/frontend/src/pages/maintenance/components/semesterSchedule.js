export const SEMESTER_TERMS = ['First Semester', 'Second Semester'];

export function validateSemesterSchedule(windows, year, automatic, today) {
    const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(value + 'T00:00:00Z'))
        && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
    const minimum = year.start_date || `${year.start_year}-01-01`;
    const maximum = year.end_date || `${year.end_year}-12-31`;
    for (const row of windows) {
        if (!valid(row.start_date) || !valid(row.end_date)) return 'Enter a valid start and end date for both semesters.';
        if (row.end_date < row.start_date) return `${row.term}: the end date must be on or after the start date.`;
        if (row.start_date < minimum || row.end_date > maximum) return `Dates must stay within the academic year (${minimum} to ${maximum}).`;
    }
    if (windows[1].start_date <= windows[0].end_date) return 'Second Semester must start after First Semester ends. Dates cannot overlap.';
    if (automatic && windows.every(row => row.end_date < today)) return 'Both semesters have ended. Save these dates with automatic switching turned off.';
    return '';
}

export function semesterScheduleStatus(schedule, today) {
    if (!schedule?.start_date || !schedule?.end_date) return 'Dates not set';
    if (today < schedule.start_date) return 'Upcoming';
    if (today > schedule.end_date) return 'Completed';
    return 'In progress';
}

export function formatSemesterDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-PH', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value + 'T00:00:00Z'));
}
