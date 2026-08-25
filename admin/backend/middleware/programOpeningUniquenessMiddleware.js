const supabase = require('../config/supabase');

const ACTIVE_OPENING_STATUSES = new Set(['draft', 'open']);

function normalizeStatus(value, fallback = '') {
    const normalized = String(value ?? fallback).trim().toLowerCase();
    return normalized || fallback;
}

async function resolvePeriodIdFromAcademicYear(academicYearId) {
    if (!academicYearId) return null;

    const { data, error } = await supabase
        .from('academic_period')
        .select('period_id, is_active')
        .eq('academic_year_id', academicYearId)
        .order('is_active', { ascending: false })
        .limit(1);

    if (error) {
        console.error('OPENING UNIQUENESS PERIOD RESOLUTION ERROR:', error);
        throw new Error(error.message);
    }

    return data?.[0]?.period_id || null;
}

async function fetchExistingOpening(openingId) {
    if (!openingId) return null;

    const { data, error } = await supabase
        .from('program_openings')
        .select(`
            opening_id,
            program_id,
            academic_year_id,
            period_id,
            posting_status,
            is_archived
        `)
        .eq('opening_id', openingId)
        .maybeSingle();

    if (error) {
        console.error('OPENING UNIQUENESS EXISTING OPENING ERROR:', error);
        throw new Error(error.message);
    }

    return data || null;
}

function openingWouldBeActive({ postingStatus, isArchived }) {
    if (isArchived === true) return false;

    const normalizedStatus = normalizeStatus(postingStatus, 'draft');
    return ACTIVE_OPENING_STATUSES.has(normalizedStatus);
}

async function findConflictingOpening({
    programId,
    academicYearId,
    periodId,
    excludeOpeningId = null,
}) {
    let query = supabase
        .from('program_openings')
        .select(`
            opening_id,
            opening_title,
            program_id,
            academic_year_id,
            period_id,
            posting_status,
            is_archived
        `)
        .eq('program_id', programId)
        .eq('is_archived', false);

    if (periodId) {
        query = query.eq('period_id', periodId);
    } else {
        query = query
            .eq('academic_year_id', academicYearId)
            .is('period_id', null);
    }

    if (excludeOpeningId) {
        query = query.neq('opening_id', excludeOpeningId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('OPENING UNIQUENESS CONFLICT QUERY ERROR:', error);
        throw new Error(error.message);
    }

    return (data || []).find((opening) => {
        if (opening.is_archived === true) return false;
        return ACTIVE_OPENING_STATUSES.has(
            normalizeStatus(opening.posting_status, 'draft')
        );
    }) || null;
}

async function validateOpeningUniqueness(req, res, next) {
    try {
        const openingId = req.params?.openingId || null;
        const existing = openingId
            ? await fetchExistingOpening(openingId)
            : null;

        if (openingId && !existing) {
            return next();
        }

        const programId =
            req.body?.program_id ??
            existing?.program_id ??
            null;

        const academicYearId =
            req.body?.academic_year_id ??
            existing?.academic_year_id ??
            null;

        let periodId;

        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'period_id')) {
            periodId = req.body.period_id || null;
        } else if (
            existing &&
            academicYearId === existing.academic_year_id
        ) {
            periodId = existing.period_id || null;
        } else {
            periodId = null;
        }

        if (!programId || !academicYearId) {
            return next();
        }

        if (!periodId) {
            periodId = await resolvePeriodIdFromAcademicYear(academicYearId);
        }

        const requestedStatus = Object.prototype.hasOwnProperty.call(
            req.body || {},
            'posting_status'
        )
            ? req.body.posting_status
            : existing?.posting_status ?? 'draft';

        const requestedArchived = Object.prototype.hasOwnProperty.call(
            req.body || {},
            'is_archived'
        )
            ? req.body.is_archived === true
            : existing?.is_archived === true;

        if (
            !openingWouldBeActive({
                postingStatus: requestedStatus,
                isArchived: requestedArchived,
            })
        ) {
            return next();
        }

        const conflict = await findConflictingOpening({
            programId,
            academicYearId,
            periodId,
            excludeOpeningId: openingId,
        });

        if (!conflict) {
            return next();
        }

        return res.status(409).json({
            message:
                'This scholarship program already has an active opening for the selected academic period.',
            error:
                'Only one Draft or Open opening is allowed per scholarship program within the same academic period.',
            conflict: {
                opening_id: conflict.opening_id,
                opening_title: conflict.opening_title || 'Existing opening',
                posting_status: normalizeStatus(
                    conflict.posting_status,
                    'draft'
                ),
            },
        });
    } catch (error) {
        console.error('PROGRAM OPENING UNIQUENESS VALIDATION ERROR:', error);

        return res.status(500).json({
            message:
                error.message ||
                'Failed to validate scholarship opening uniqueness.',
            error:
                error.message ||
                'Failed to validate scholarship opening uniqueness.',
        });
    }
}

module.exports = {
    validateOpeningUniqueness,
};
