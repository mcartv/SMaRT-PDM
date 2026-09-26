'use strict';

const db = require('../config/db');
const supabase = require('../config/supabase');

const APPROVED_APPLICATION_STATUSES = [
  'Approved',
  'Approved Scholar',
  'Accepted',
];

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function extractAvatarStoragePath(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) return null;

  if (!/^https?:\/\//i.test(rawValue)) {
    return rawValue.replace(/^avatars\//, '');
  }

  const markers = [
    '/storage/v1/object/public/avatars/',
    '/storage/v1/object/sign/avatars/',
    '/storage/v1/object/authenticated/avatars/',
  ];

  for (const marker of markers) {
    const markerIndex = rawValue.indexOf(marker);
    if (markerIndex >= 0) {
      return rawValue.slice(markerIndex + marker.length).split('?')[0];
    }
  }

  return null;
}

async function resolveAvatarUrl(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) return null;

  const storagePath = extractAvatarStoragePath(rawValue);

  if (!storagePath) return rawValue;

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (error) return rawValue;

  return data?.signedUrl || rawValue;
}

async function getCurrentAcademicPeriod() {
  const result = await db.query(
    `
      SELECT
        period_id,
        academic_year_id,
        term
      FROM academic_period
      WHERE is_active = true
      ORDER BY
        activated_at DESC NULLS LAST,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST
      LIMIT 1
    `
  );

  const period = result.rows[0] || null;

  if (!period) {
    throw createHttpError(
      409,
      'No current academic semester is active. Set the current semester in Maintenance > Academic Years.'
    );
  }

  return period;
}

function normalizeBucket(value) {
  const bucket = normalizeText(value);

  if (bucket === 'unassigned' || bucket === 'cleared') {
    return bucket;
  }

  return 'assigned';
}

function normalizeStatusFilter(value) {
  const status = normalizeText(value);

  return [
    'all',
    'pending_approval',
    'assigned',
    'in_progress',
    'for_validation',
    'conflict',
    'cleared',
  ].includes(status)
    ? status
    : 'all';
}

function mapPlacement(value) {
  if (!value || typeof value !== 'object') return null;

  return {
    placement_id: value.placement_id || null,
    ro_area_id: value.ro_area_id || null,
    assigned_area: value.assigned_area || '',
    placement_status: value.placement_status || 'Pending',
    admin_remarks: value.admin_remarks || null,
    coordinator_remarks: value.coordinator_remarks || null,
    requested_at: value.requested_at || null,
    decided_at: value.decided_at || null,
  };
}

async function serializePageRow(row) {
  const placements = Array.isArray(row.placements)
    ? row.placements.map(mapPlacement).filter(Boolean)
    : [];

  const requiredHours = Math.max(0, Number(row.required_hours || 0));
  const requiredMinutes = requiredHours * 60;
  const submittedMinutes = Math.max(0, Number(row.submitted_minutes || 0));
  const validatedMinutes = Math.max(0, Number(row.validated_minutes || 0));
  const submittedProgress = Math.min(
    100,
    Math.max(0, Number(row.submitted_progress || 0))
  );
  const validatedProgress = Math.min(
    100,
    Math.max(0, Number(row.ro_progress || 0))
  );
  const cleared = row.is_cleared === true;
  const assignmentStatus = cleared
    ? 'Cleared'
    : row.assignment_status || 'Unassigned';
  const progressStatus = cleared
    ? 'Cleared'
    : row.progress_status || 'Not Started';

  return {
    student_id: row.student_id,
    pdm_id: row.pdm_id || '',
    first_name: row.first_name || '',
    middle_name: row.middle_name || '',
    last_name: row.last_name || '',
    name: row.name || 'Unknown Scholar',
    year_level: row.year_level,
    profile_photo_url: await resolveAvatarUrl(row.profile_photo_url),
    is_active_scholar: row.is_active_scholar === true,

    course_id: row.course_id || null,
    course_code: row.course_code || null,
    course_name: row.course_name || null,

    application_id: row.application_id,
    application_status: row.application_status,
    submission_date: row.submission_date,

    program_id: row.program_id || null,
    program_name: row.program_name || 'Scholarship Program',
    benefactor_name: row.benefactor_name || null,

    opening_id: row.opening_id || null,
    opening_title: row.opening_title || 'Scholarship Opening',
    opening_status: row.opening_status || null,

    ro_id: row.ro_id || null,
    ro_status: cleared ? 'Cleared' : row.ro_status || 'Pending',
    is_cleared: cleared,
    cleared_at: row.cleared_at || null,
    remarks: row.remarks || null,

    required_hours: requiredHours,
    requiredHours,
    required_minutes: requiredMinutes,
    requiredMinutes,

    submitted_minutes: submittedMinutes,
    submittedMinutes,

    validated_minutes: validatedMinutes,
    validatedMinutes,

    submitted_progress: submittedProgress,
    submittedProgress,

    ro_progress: validatedProgress,
    validatedProgress,

    progress_status: progressStatus,
    progressStatus,

    assigned_area: row.assigned_area || '',
    assignedArea: row.assigned_area || '',

    assignment_status: assignmentStatus,
    assignmentStatus,

    has_active_assignment: row.has_active_assignment === true,
    hasActiveAssignment: row.has_active_assignment === true,

    assignment_acknowledged_at: row.assignment_acknowledged_at || null,
    assignmentAcknowledgedAt: row.assignment_acknowledged_at || null,

    conflict_reason: row.conflict_reason || '',
    conflictReason: row.conflict_reason || '',

    assigned_at: row.assigned_at || null,
    assignedAt: row.assigned_at || null,

    coordinator_status: row.coordinator_status || null,
    coordinatorStatus: row.coordinator_status || null,
    coordinator_remarks: row.coordinator_remarks || null,
    coordinatorRemarks: row.coordinator_remarks || null,
    coordinator_decided_at: row.coordinator_decided_at || null,
    coordinatorDecidedAt: row.coordinator_decided_at || null,

    placements,
    logs: [],
    pending_log_count: Number(row.pending_log_count || 0),
    pendingLogCount: Number(row.pending_log_count || 0),
    proof_count: 0,
    proofCount: 0,
    activeLog: null,
  };
}

async function getROScholarsPage(filters = {}) {
  const currentPeriod = await getCurrentAcademicPeriod();

  const requestedPage = positiveInteger(filters.page, 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    positiveInteger(filters.limit, DEFAULT_PAGE_SIZE)
  );
  const bucket = normalizeBucket(filters.bucket);
  const statusFilter = normalizeStatusFilter(filters.statusFilter);

  const search = String(filters.search || '').trim();
  const courseId = String(filters.courseId || 'all').trim();
  const programId = String(filters.programId || 'all').trim();
  const yearLevel = String(filters.yearLevel || 'all').trim();
  const openingId = String(filters.openingId || 'all').trim();

  const values = [
    APPROVED_APPLICATION_STATUSES,
    currentPeriod.period_id,
  ];

  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  const baseWhere = [
    'a.application_status = ANY($1::text[])',
    's.is_active_scholar = true',
  ];

  if (courseId && courseId !== 'all') {
    const ref = addValue(courseId);
    baseWhere.push(`s.course_id = ${ref}::uuid`);
  }

  if (programId && programId !== 'all') {
    const ref = addValue(programId);
    baseWhere.push(`a.program_id = ${ref}::uuid`);
  }

  if (yearLevel && yearLevel !== 'all') {
    const ref = addValue(yearLevel);
    baseWhere.push(`TRIM(COALESCE(s.year_level::text, '')) = ${ref}`);
  }

  if (openingId && openingId !== 'all') {
    const ref = addValue(openingId);
    baseWhere.push(`a.opening_id = ${ref}::uuid`);
  }

  if (search) {
    const ref = addValue(`%${search}%`);
    baseWhere.push(`
      CONCAT_WS(
        ' ',
        s.pdm_id,
        s.first_name,
        s.middle_name,
        s.last_name,
        ac.course_code,
        ac.course_name,
        sp.program_name,
        po.opening_title,
        b.benefactor_name,
        COALESCE(placement_summary.active_area, ro.assigned_area, ''),
        ro.assignment_status,
        ro.progress_status
      ) ILIKE ${ref}
    `);
  }

  let bucketPredicate = `
    is_cleared = false
    AND has_active_assignment = true
  `;

  if (bucket === 'unassigned') {
    bucketPredicate = `
      is_cleared = false
      AND has_active_assignment = false
    `;
  } else if (bucket === 'cleared') {
    bucketPredicate = 'is_cleared = true';
  }

  let statusPredicate = 'TRUE';

  if (statusFilter === 'pending_approval') {
    statusPredicate = `
      (
        assignment_status_normalized = 'pending coordinator approval'
        OR (has_pending_placement = true AND has_approved_placement = false)
      )
    `;
  } else if (statusFilter === 'assigned') {
    statusPredicate = `
      (
        assignment_status_normalized = 'assigned'
        AND (has_pending_placement = false OR has_approved_placement = true)
      )
    `;
  } else if (statusFilter === 'in_progress') {
    statusPredicate = `
      (
        assignment_status_normalized = 'in progress'
        OR progress_status_normalized = 'in progress'
      )
    `;
  } else if (statusFilter === 'for_validation') {
    statusPredicate = `
      (
        assignment_status_normalized = 'for validation'
        OR progress_status_normalized = 'for validation'
      )
    `;
  } else if (statusFilter === 'conflict') {
    statusPredicate = `assignment_status_normalized = 'conflict reported'`;
  } else if (statusFilter === 'cleared') {
    statusPredicate = 'is_cleared = true';
  }

  const requestedPageRef = addValue(requestedPage);
  const limitRef = addValue(limit);

  const sql = `
    WITH base AS (
      SELECT
        a.application_id,
        a.student_id,
        a.program_id,
        a.opening_id,
        a.application_status,
        a.submission_date,

        s.pdm_id,
        s.first_name,
        s.middle_name,
        s.last_name,
        TRIM(
          CONCAT_WS(
            ' ',
            NULLIF(TRIM(COALESCE(s.first_name, '')), ''),
            NULLIF(TRIM(COALESCE(s.middle_name, '')), ''),
            NULLIF(TRIM(COALESCE(s.last_name, '')), '')
          )
        ) AS name,
        s.year_level,
        s.profile_photo_url,
        s.is_active_scholar,
        s.course_id,

        ac.course_code,
        ac.course_name,

        sp.program_name,
        b.benefactor_name,

        po.opening_title,
        po.posting_status AS opening_status,

        ro.ro_id,
        ro.ro_status,
        ro.cleared_at,
        ro.remarks,
        ro.required_hours,
        ro.progress_status,
        ro.submitted_progress,
        ro.ro_progress,
        ro.submitted_minutes,
        ro.validated_minutes,
        COALESCE(
          placement_summary.active_area,
          NULLIF(TRIM(COALESCE(ro.assigned_area, '')), ''),
          ''
        ) AS assigned_area,
        ro.assignment_status,
        ro.assignment_acknowledged_at,
        ro.conflict_reason,
        ro.assigned_at,
        ro.coordinator_status,
        ro.coordinator_remarks,
        ro.coordinator_decided_at,

        (
          LOWER(TRIM(COALESCE(ro.ro_status, ''))) = 'cleared'
          OR LOWER(TRIM(COALESCE(ro.assignment_status, ''))) = 'cleared'
        ) AS is_cleared,

        COALESCE(
          placement_summary.has_active_assignment,
          false
        ) AS has_active_assignment,

        COALESCE(
          placement_summary.has_pending_placement,
          false
        ) AS has_pending_placement,

        COALESCE(
          placement_summary.has_approved_placement,
          false
        ) AS has_approved_placement,

        LOWER(TRIM(COALESCE(ro.assignment_status, ''))) AS assignment_status_normalized,
        LOWER(TRIM(COALESCE(ro.progress_status, ''))) AS progress_status_normalized,

        COALESCE(log_summary.pending_log_count, 0)::int AS pending_log_count,
        COALESCE(placement_summary.placements, '[]'::jsonb) AS placements

      FROM applications a

      JOIN students s
        ON s.student_id = a.student_id

      LEFT JOIN academic_course ac
        ON ac.course_id = s.course_id

      LEFT JOIN scholarship_program sp
        ON sp.program_id = a.program_id

      LEFT JOIN benefactors b
        ON b.benefactor_id = sp.benefactor_id

      LEFT JOIN program_openings po
        ON po.opening_id = a.opening_id

      LEFT JOIN return_of_obligations ro
        ON ro.application_id = a.application_id
       AND ro.period_id = $2::uuid

      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            BOOL_OR(rp.placement_status IN ('Pending', 'Approved')),
            false
          ) AS has_active_assignment,

          COALESCE(
            BOOL_OR(rp.placement_status = 'Pending'),
            false
          ) AS has_pending_placement,

          COALESCE(
            BOOL_OR(rp.placement_status = 'Approved'),
            false
          ) AS has_approved_placement,

          (
            ARRAY_AGG(
              rd.department_name
              ORDER BY
                CASE
                  WHEN rp.placement_status = 'Approved' THEN 0
                  WHEN rp.placement_status = 'Pending' THEN 1
                  ELSE 2
                END,
                rp.updated_at DESC NULLS LAST,
                rp.created_at DESC NULLS LAST
            )
            FILTER (
              WHERE rp.placement_status IN ('Pending', 'Approved')
            )
          )[1] AS active_area,

          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'placement_id', rp.placement_id,
              'ro_area_id', rp.ro_area_id,
              'assigned_area', COALESCE(rd.department_name, ''),
              'placement_status', rp.placement_status,
              'admin_remarks', rp.admin_remarks,
              'coordinator_remarks', rp.coordinator_remarks,
              'requested_at', rp.requested_at,
              'decided_at', rp.decided_at
            )
            ORDER BY rp.created_at ASC
          )
          FILTER (WHERE rp.placement_id IS NOT NULL) AS placements

        FROM ro_placements rp

        LEFT JOIN ro_departments rd
          ON rd.department_id = rp.ro_area_id

        WHERE rp.ro_id = ro.ro_id
      ) placement_summary
        ON ro.ro_id IS NOT NULL

      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (
            WHERE rtl.validation_status = 'Pending Validation'
          )::int AS pending_log_count

        FROM ro_time_logs rtl

        WHERE rtl.ro_id = ro.ro_id
      ) log_summary
        ON ro.ro_id IS NOT NULL

      WHERE
        ${baseWhere.join('\n        AND ')}
    ),

    filtered AS (
      SELECT *
      FROM base
      WHERE
        ${bucketPredicate}
        AND (${statusPredicate})
    ),

    meta AS (
      SELECT COUNT(*)::int AS total_count
      FROM filtered
    )

    SELECT
      meta.total_count,
      paged.*

    FROM meta

    LEFT JOIN LATERAL (
      SELECT *
      FROM filtered
      ORDER BY
        submission_date DESC NULLS LAST,
        application_id DESC
      LIMIT ${limitRef}::int
      OFFSET (
        (
          LEAST(
            ${requestedPageRef}::int,
            GREATEST(
              1,
              CEIL(
                meta.total_count::numeric /
                GREATEST(${limitRef}::int, 1)::numeric
              )::int
            )
          ) - 1
        ) * ${limitRef}::int
      )
    ) paged
      ON TRUE
  `;

  const result = await db.query(sql, values);
  const firstRow = result.rows[0] || {};
  const total = Math.max(0, Number(firstRow.total_count || 0));
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);

  const rawRows = result.rows.filter((row) => row.application_id);
  const scholars = await Promise.all(rawRows.map(serializePageRow));

  const start = total > 0 ? (page - 1) * limit + 1 : 0;
  const end = total > 0 ? Math.min(start + scholars.length - 1, total) : 0;

  return {
    scholars,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
      start,
      end,
    },
    bucket,
    period: {
      period_id: currentPeriod.period_id,
      academic_year_id: currentPeriod.academic_year_id,
      term: currentPeriod.term,
    },
  };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  getROScholarsPage,
};
