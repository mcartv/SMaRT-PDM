const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../config/db');
const supabase = require('../config/supabase');
const { resolveStaffRole } = require('../utils/staffRoles');
const { extractAvatarStoragePath, resolveAvatarUrl } = require('./avatarService');
const pdCourseAssignmentService = require('./pdCourseAssignmentService');
const adminSessionService = require('./adminSessionService');

const ROLE_CONFIG = {
    admin: {
        dbRole: 'Admin',
        department: 'Office for Scholarship and Financial Assistance (OSFA)',
        position: 'OSFA Administrator',
    },
    pd: {
        dbRole: 'Admin',
        department: '',
        position: 'Program Director',
    },
    guidance: {
        dbRole: 'Admin',
        department: 'Guidance and Counseling Office',
        position: 'Guidance Officer',
    },
    sdo: {
        dbRole: 'SDO',
        department: 'Student Welfare and Development Office',
        position: 'SDO Officer',
    },
    ro_coordinator: {
        dbRole: 'Admin',
        department: '',
        position: 'RO Coordinator',
    },
};

const DEPARTMENTS_BY_ROLE = {
    admin: ['Office for Scholarship and Financial Assistance (OSFA)'],
    pd: [
        'Office of the College of Hospitality and Tourism Management',
        'Office of the College of Computer Studies',
        'Office of the Program Head - Office Administration',
        'Office of the Program Head - Teacher Education Program',
    ],
    guidance: ['Guidance and Counseling Office'],
    sdo: ['Student Welfare and Development Office'],
    ro_coordinator: [],
};

const ROLE_VALUES = Object.keys(ROLE_CONFIG);
const OPERATIONAL_ROLE_VALUES = ['pd', 'guidance', 'sdo', 'ro_coordinator'];

const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.');

const staffAccountSchema = z
    .object({
        first_name: z.string().trim().min(1, 'First name is required.'),
        last_name: z.string().trim().min(1, 'Last name is required.'),
        email: z.string().trim().toLowerCase().email('A valid email address is required.'),
        phone_number: z.string().trim().optional().default(''),
        role: z.enum(OPERATIONAL_ROLE_VALUES, {
            error: 'Select Program Director, SDO, Guidance, or RO Coordinator.',
        }),
        department: z.string().trim().optional().default(''),
        position: z.string().trim().optional().default(''),
        password: passwordSchema,
        confirm_password: z.string(),
    })
    .refine((data) => data.password === data.confirm_password, {
        path: ['confirm_password'],
        message: 'Passwords do not match.',
    });

const adminAccountSchema = z
    .object({
        first_name: z.string().trim().min(1, 'First name is required.'),
        last_name: z.string().trim().min(1, 'Last name is required.'),
        email: z.string().trim().toLowerCase().email('A valid email address is required.'),
        password: passwordSchema,
        confirm_password: z.string(),
    })
    .refine((data) => data.password === data.confirm_password, {
        path: ['confirm_password'],
        message: 'Passwords do not match.',
    });

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function validateDepartment(role, value) {
    const department = safeText(value);
    const allowedDepartments = DEPARTMENTS_BY_ROLE[role] || [];

    if (!department) {
        throw createHttpError(400, 'Select a department or office.');
    }

    if (role === 'ro_coordinator') {
        return department;
    }

    if (!allowedDepartments.includes(department)) {
        throw createHttpError(400, 'The selected department or office is not valid for this role.');
    }

    return department;
}

async function validateRoCoordinatorDepartment(department, client = db) {
    const result = await client.query(
        `SELECT department_name FROM ro_departments WHERE department_name = $1 AND is_active = true LIMIT 1`,
        [department]
    );

    if (!result.rows.length) {
        throw createHttpError(400, 'Select an active RO department, office, or faculty area.');
    }

    return result.rows[0].department_name;
}

async function assertRoCoordinatorAreaAvailable(department, excludedUserId = null, client = db) {
    const result = await client.query(
        `
        SELECT rac.user_id
        FROM ro_area_coordinators rac
        JOIN ro_departments rd ON rd.department_id = rac.ro_area_id
        WHERE LOWER(TRIM(rd.department_name)) = LOWER(TRIM($1))
          AND rac.is_active = true
          AND ($2::uuid IS NULL OR rac.user_id <> $2::uuid)
        LIMIT 1
        `,
        [department, excludedUserId]
    );

    if (result.rows.length) {
        throw createHttpError(409, 'This RO Area already has an active coordinator.');
    }
}

async function syncStandaloneRoCoordinatorAssignment({
    userId,
    department,
    actorUserId = null,
    active = true,
    client = db,
}) {
    await client.query(
        `UPDATE ro_area_coordinators
         SET is_active = false, archived_at = now(), updated_at = now()
         WHERE user_id = $1 AND is_active = true`,
        [userId]
    );

    if (!active) return;

    const areaResult = await client.query(
        `SELECT department_id
         FROM ro_departments
         WHERE LOWER(TRIM(department_name)) = LOWER(TRIM($1))
           AND is_active = true
         LIMIT 1`,
        [department]
    );
    const areaId = areaResult.rows[0]?.department_id;
    if (!areaId) {
        throw createHttpError(400, 'Select an active RO Area.');
    }

    const existingResult = await client.query(
        `SELECT coordinator_assignment_id
         FROM ro_area_coordinators
         WHERE ro_area_id = $1 AND user_id = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [areaId, userId]
    );

    if (existingResult.rows.length) {
        await client.query(
            `UPDATE ro_area_coordinators
             SET is_active = true,
                 assigned_by_user_id = $2,
                 assigned_at = now(),
                 archived_at = NULL,
                 updated_at = now()
             WHERE coordinator_assignment_id = $1`,
            [existingResult.rows[0].coordinator_assignment_id, actorUserId]
        );
    } else {
        await client.query(
            `INSERT INTO ro_area_coordinators (
               ro_area_id, user_id, assigned_by_user_id
             )
             VALUES ($1, $2, $3)`,
            [areaId, userId, actorUserId]
        );
    }
}

async function assertNoPendingRoRequests(department, client = db) {
    const result = await client.query(
        `
        SELECT COUNT(*)::int AS pending_count
        FROM ro_placements rp
        JOIN ro_departments rd ON rd.department_id = rp.ro_area_id
        WHERE LOWER(TRIM(rd.department_name)) = LOWER(TRIM($1))
          AND rp.placement_status = 'Pending'
        `,
        [department]
    );

    const pendingCount = Number(result.rows[0]?.pending_count || 0);
    if (pendingCount > 0) {
        throw createHttpError(
            409,
            `This RO Coordinator still has ${pendingCount} pending request${pendingCount === 1 ? '' : 's'}. Resolve or reassign them first.`
        );
    }
}

function validatePassword(password, confirmPassword) {
    if (!password) return null;

    if (password.length < 8) {
        throw createHttpError(400, 'Password must be at least 8 characters.');
    }

    if (!/[a-z]/.test(password)) {
        throw createHttpError(400, 'Password must contain at least one lowercase letter.');
    }

    if (!/[A-Z]/.test(password)) {
        throw createHttpError(400, 'Password must contain at least one uppercase letter.');
    }

    if (!/[0-9]/.test(password)) {
        throw createHttpError(400, 'Password must contain at least one number.');
    }

    if (password !== confirmPassword) {
        throw createHttpError(400, 'Passwords do not match.');
    }

    return password;
}

async function hasAdminProfilePhotoColumn(client = db) {
    const result = await client.query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_profiles'
          AND column_name = 'profile_photo_url'
        LIMIT 1
        `
    );

    return result.rows.length > 0;
}

function buildProfilePhotoSelect(alias = 'a', enabled = false) {
    return enabled
        ? `${alias}.profile_photo_url AS profile_photo_url`
        : `NULL::text AS profile_photo_url`;
}

function mapStaffAccount(row) {
    const role = resolveStaffRole(row);
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ');

    return {
        user_id: row.user_id,
        admin_id: row.admin_id,
        name,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        username: row.username,
        phone_number: row.phone_number || '',
        department: row.department || '',
        position: row.position || '',
        role,
        db_role: row.user_role,
        is_archived: row.is_archived === true,
        profile_photo_url: row.profile_photo_url || null,
        created_at: row.created_at,
    };
}

async function hasActiveRoCoordinatorAssignment(userId, client = db) {
    if (!userId) return false;

    const result = await client.query(
        `SELECT 1
         FROM ro_area_coordinators rac
         JOIN ro_departments rd
           ON rd.department_id = rac.ro_area_id
          AND rd.is_active = true
         WHERE rac.user_id = $1
           AND rac.is_active = true
         LIMIT 1`,
        [userId]
    );

    return result.rows.length > 0;
}

async function decorateStaffAccount(row, client = db) {
    const account = mapStaffAccount(row);
    const canHoldRoCoordinatorAssignment = ['pd', 'sdo', 'guidance', 'ro_coordinator'].includes(account.role);
    const [assignedCourses, hasRoCoordinatorAccess] = await Promise.all([
        account.role === 'pd'
            ? pdCourseAssignmentService.getAssignmentsForUser(account.user_id, client)
            : [],
        canHoldRoCoordinatorAssignment
            ? hasActiveRoCoordinatorAssignment(account.user_id, client)
            : Promise.resolve(false),
    ]);

    return {
        ...account,
        avatar_url: await resolveAvatarUrl(account.profile_photo_url),
        assigned_courses: assignedCourses,
        course_ids: assignedCourses.map((course) => course.course_id),
        has_ro_coordinator_access: hasRoCoordinatorAccess,
    };
}

function sanitizeFileName(value) {
    return String(value || 'profile-photo')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'profile-photo';
}

async function buildUniqueUsername(client, email) {
    const localPart = email.split('@')[0] || 'staff';
    const base = localPart
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
        .replace(/^[._-]+|[._-]+$/g, '') || 'staff';

    for (let index = 0; index < 100; index += 1) {
        const candidate = index === 0 ? base : `${base}${index + 1}`;

        const existing = await client.query(
            'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
            [candidate]
        );

        if (!existing.rows.length) {
            return candidate;
        }
    }

    throw createHttpError(500, 'Unable to generate a unique username.');
}

async function fetchStaffAccountRow(userId, client = db, includeArchived = true) {
    const photoEnabled = await hasAdminProfilePhotoColumn(client);

    const result = await client.query(
        `
        SELECT
            u.user_id,
            u.email,
            u.username,
            u.phone_number,
            u.role AS user_role,
            u.created_at,
            a.admin_id,
            a.first_name,
            a.last_name,
            a.department,
            a.position,
            COALESCE(a.is_archived, false) AS is_archived,
            ${buildProfilePhotoSelect('a', photoEnabled)}
        FROM users u
        INNER JOIN admin_profiles a ON a.user_id = u.user_id
        WHERE u.user_id = $1
          ${includeArchived ? '' : 'AND COALESCE(a.is_archived, false) = false'}
        LIMIT 1
        `,
        [userId]
    );

    return result.rows[0] || null;
}

async function getStaffAccountById(userId, includeArchived = true) {
    const row = await fetchStaffAccountRow(userId, db, includeArchived);
    return row ? decorateStaffAccount(row) : null;
}

async function listStaffAccounts() {
    const photoEnabled = await hasAdminProfilePhotoColumn();

    const result = await db.query(`
        SELECT
            u.user_id,
            u.email,
            u.username,
            u.phone_number,
            u.role AS user_role,
            u.created_at,
            a.admin_id,
            a.first_name,
            a.last_name,
            a.department,
            a.position,
            COALESCE(a.is_archived, false) AS is_archived,
            ${buildProfilePhotoSelect('a', photoEnabled)}
        FROM users u
        INNER JOIN admin_profiles a ON a.user_id = u.user_id
        ORDER BY
            COALESCE(a.is_archived, false) ASC,
            u.created_at DESC
    `);

    const accounts = await Promise.all(result.rows.map((row) => decorateStaffAccount(row)));

    return accounts.filter((account) =>
        ROLE_VALUES.includes(account.role)
    );
}

async function getCurrentStaffProfile(userId) {
    if (!userId) {
        throw createHttpError(400, 'User ID is required.');
    }

    const row = await fetchStaffAccountRow(userId, db, false);

    if (!row) {
        throw createHttpError(404, 'Account profile not found.');
    }

    return decorateStaffAccount(row);
}

async function createAccountFromParsedData(parsedData, rawPayload = {}, actorUserId = null) {
    const {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumberInput = '',
        role,
        password,
    } = parsedData;

    const config = ROLE_CONFIG[role];
    if (!config) {
        throw createHttpError(400, 'Invalid role selected.');
    }

    const phoneNumber = safeText(phoneNumberInput) || null;
    let department = validateDepartment(role, rawPayload.department || parsedData.department || config.department);
    const position = role === 'ro_coordinator'
        ? config.position
        : safeText(rawPayload.position || parsedData.position) || config.position;
    const passwordHash = await bcrypt.hash(password, 12);

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const photoEnabled = await hasAdminProfilePhotoColumn(client);
        if (role === 'ro_coordinator') {
            department = await validateRoCoordinatorDepartment(department, client);
            await assertRoCoordinatorAreaAvailable(department, null, client);
        }

        const duplicateEmail = await client.query(
            'SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [email]
        );

        if (duplicateEmail.rows.length) {
            throw createHttpError(400, 'An account with this email already exists.');
        }

        const username = await buildUniqueUsername(client, email);

        const userResult = await client.query(
            `
            INSERT INTO users (
                role,
                username,
                password_hash,
                email,
                phone_number,
                is_otp_verified
            )
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING
                user_id,
                email,
                username,
                phone_number,
                role AS user_role,
                created_at
            `,
            [config.dbRole, username, passwordHash, email, phoneNumber]
        );

        const user = userResult.rows[0];

        const profileResult = await client.query(
            `
            INSERT INTO admin_profiles (
                user_id,
                first_name,
                last_name,
                department,
                position,
                is_archived
            )
            VALUES ($1, $2, $3, $4, $5, false)
            RETURNING
                admin_id,
                first_name,
                last_name,
                department,
                position,
                COALESCE(is_archived, false) AS is_archived,
                ${photoEnabled ? 'profile_photo_url' : 'NULL::text AS profile_photo_url'}
            `,
            [user.user_id, firstName, lastName, department, position]
        );

        if (role === 'pd') {
            await pdCourseAssignmentService.syncAssignments({
                userId: user.user_id,
                courseIds: rawPayload.course_ids,
                assignedByUserId: actorUserId,
                client,
            });
        }

        if (role === 'ro_coordinator') {
            await syncStandaloneRoCoordinatorAssignment({
                userId: user.user_id,
                department,
                actorUserId,
                client,
            });
        }

        await client.query('COMMIT');

        return decorateStaffAccount({
            ...user,
            ...profileResult.rows[0],
        });
    } catch (error) {
        await client.query('ROLLBACK');

        if (
            error.code === '23505' &&
            ['uq_active_ro_coordinator_area', 'uq_ro_area_active_coordinator'].includes(
                error.constraint
            )
        ) {
            throw createHttpError(409, 'This RO Area already has an active coordinator.');
        }

        if (error.code === '23505') {
            throw createHttpError(400, 'An account with this email or username already exists.');
        }

        throw error;
    } finally {
        client.release();
    }
}

async function createStaffAccount(payload, actorUserId = null) {
    if (safeText(payload?.role).toLowerCase() === 'admin') {
        throw createHttpError(
            400,
            'Admin accounts must be created through Create Admin Account.'
        );
    }

    const parsed = staffAccountSchema.safeParse(payload);

    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        throw createHttpError(400, firstIssue?.message || 'Invalid account details.');
    }

    return createAccountFromParsedData(parsed.data, payload, actorUserId);
}

async function createAdminAccount(payload, actorUserId = null) {
    const parsed = adminAccountSchema.safeParse(payload);

    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        throw createHttpError(400, firstIssue?.message || 'Invalid Admin account details.');
    }

    const config = ROLE_CONFIG.admin;

    return createAccountFromParsedData(
        {
            ...parsed.data,
            phone_number: '',
            role: 'admin',
            department: config.department,
            position: config.position,
        },
        {
            ...payload,
            department: config.department,
            position: config.position,
            course_ids: [],
        },
        actorUserId
    );
}

async function revokeStaffSessionVersion(client, userId) {
    await client.query(
        `UPDATE users
         SET token_version = COALESCE(token_version, 1) + 1
         WHERE user_id = $1`,
        [userId]
    );

    // Admin accounts also have managed server-side sessions. Revoke those rows
    // at the same time so an invalidated Admin session cannot occupy a device
    // slot after the account is changed, archived, or restored.
    await adminSessionService.revokeAllAdminSessionsForUser(client, userId);
}

async function updateStaffAccount(userId, payload = {}, actorUserId = null) {
    if (!userId) {
        throw createHttpError(400, 'User ID is required.');
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const current = await fetchStaffAccountRow(userId, client, true);

        if (!current) {
            await client.query('ROLLBACK');
            return null;
        }

        const currentRole = resolveStaffRole(current);

        const nextRole = payload.role !== undefined
            ? safeText(payload.role).toLowerCase()
            : currentRole;

        if (!ROLE_CONFIG[nextRole]) {
            throw createHttpError(400, 'Invalid role selected.');
        }

        const crossesAdminBoundary =
            (currentRole === 'admin' && nextRole !== 'admin') ||
            (currentRole !== 'admin' && nextRole === 'admin');

        if (crossesAdminBoundary) {
            throw createHttpError(
                400,
                'Admin accounts and department accounts cannot be converted into each other. Archive the account and create the appropriate account type instead.'
            );
        }

        const roleChanged = nextRole !== currentRole;
        const config = ROLE_CONFIG[nextRole];

        const firstName = payload.first_name !== undefined
            ? safeText(payload.first_name)
            : safeText(current.first_name);

        const lastName = payload.last_name !== undefined
            ? safeText(payload.last_name)
            : safeText(current.last_name);

        const email = payload.email !== undefined
            ? safeText(payload.email).toLowerCase()
            : safeText(current.email).toLowerCase();

        const phoneNumber = payload.phone_number !== undefined
            ? safeText(payload.phone_number) || null
            : safeText(current.phone_number) || null;

        const departmentInput = payload.department !== undefined
            ? safeText(payload.department) || config.department
            : roleChanged
                ? config.department
                : safeText(current.department) || config.department;
        let department = validateDepartment(nextRole, departmentInput);
        if (nextRole === 'ro_coordinator') {
            department = await validateRoCoordinatorDepartment(department, client);
        }

        const position = nextRole === 'ro_coordinator'
            ? config.position
            : payload.position !== undefined
                ? safeText(payload.position) || config.position
                : roleChanged
                    ? config.position
                    : safeText(current.position) || config.position;

        const nextIsArchived = payload.is_archived !== undefined
            ? payload.is_archived === true
            : current.is_archived === true;

        const sessionIdentityChanged =
            roleChanged || nextIsArchived !== (current.is_archived === true);

        if (
            currentRole === 'ro_coordinator' &&
            (
                nextRole !== 'ro_coordinator' ||
                nextIsArchived ||
                department.toLowerCase() !== safeText(current.department).toLowerCase()
            )
        ) {
            await assertNoPendingRoRequests(current.department, client);
        }

        if (nextRole === 'ro_coordinator' && !nextIsArchived) {
            await assertRoCoordinatorAreaAvailable(department, userId, client);
        }

        if (!firstName) {
            throw createHttpError(400, 'First name is required.');
        }

        if (!lastName) {
            throw createHttpError(400, 'Last name is required.');
        }

        if (!email) {
            throw createHttpError(400, 'Email is required.');
        }

        const parsedEmail = z.string().trim().toLowerCase().email().safeParse(email);

        if (!parsedEmail.success) {
            throw createHttpError(400, 'A valid email address is required.');
        }

        const duplicateEmailResult = await client.query(
            `
            SELECT user_id
            FROM users
            WHERE LOWER(email) = LOWER($1)
              AND user_id <> $2
            LIMIT 1
            `,
            [email, userId]
        );

        if (duplicateEmailResult.rows.length) {
            throw createHttpError(400, 'Another account is already using this email address.');
        }

        const nextPassword = safeText(payload.password);
        const confirmPassword = safeText(payload.confirm_password);
        const validPassword = validatePassword(nextPassword, confirmPassword);

        if (validPassword) {
            const currentPasswordResult = await client.query(
                `
                SELECT password_hash
                FROM users
                WHERE user_id = $1
                FOR UPDATE
                `,
                [userId]
            );
            const currentPasswordHash = currentPasswordResult.rows[0]?.password_hash || '';
            const reusesCurrentPassword = currentPasswordHash
                ? await bcrypt.compare(validPassword, currentPasswordHash)
                : false;

            if (reusesCurrentPassword) {
                throw createHttpError(400, 'New password must be different from the current password.');
            }

            const passwordHash = await bcrypt.hash(validPassword, 12);

            await client.query(
                `
                UPDATE users
                SET
                    email = $2,
                    phone_number = $3,
                    role = $4,
                    password_hash = $5
                WHERE user_id = $1
                `,
                [userId, email, phoneNumber, config.dbRole, passwordHash]
            );
        } else {
            await client.query(
                `
                UPDATE users
                SET
                    email = $2,
                    phone_number = $3,
                    role = $4
                WHERE user_id = $1
                `,
                [userId, email, phoneNumber, config.dbRole]
            );
        }

        if (sessionIdentityChanged) {
            await revokeStaffSessionVersion(client, userId);
        }

        await client.query(
            `
            UPDATE admin_profiles
            SET
                first_name = $2,
                last_name = $3,
                department = $4,
                position = $5,
                is_archived = $6
            WHERE user_id = $1
            `,
            [userId, firstName, lastName, department, position, nextIsArchived]
        );

        if (nextRole === 'pd' && !nextIsArchived) {
            const existingAssignments = await pdCourseAssignmentService.getAssignmentsForUser(userId, client);
            const courseIds = payload.course_ids !== undefined
                ? payload.course_ids
                : existingAssignments.map((course) => course.course_id);
            await pdCourseAssignmentService.syncAssignments({
                userId,
                courseIds,
                assignedByUserId: actorUserId,
                client,
            });
        } else {
            await pdCourseAssignmentService.releaseAssignments(userId, client);
        }

        if (nextRole === 'ro_coordinator') {
            await syncStandaloneRoCoordinatorAssignment({
                userId,
                department,
                actorUserId,
                active: !nextIsArchived,
                client,
            });
        } else if (currentRole === 'ro_coordinator') {
            await syncStandaloneRoCoordinatorAssignment({
                userId,
                department: current.department,
                actorUserId,
                active: false,
                client,
            });
        }

        await client.query('COMMIT');

        const updatedAccount = await getStaffAccountById(userId, true);
        if (updatedAccount && sessionIdentityChanged) {
            Object.defineProperty(updatedAccount, 'session_invalidated', {
                value: true,
                enumerable: false,
            });
        }

        return updatedAccount;
    } catch (error) {
        await client.query('ROLLBACK');

        if (
            error.code === '23505' &&
            ['uq_active_ro_coordinator_area', 'uq_ro_area_active_coordinator'].includes(
                error.constraint
            )
        ) {
            throw createHttpError(409, 'This RO Area already has an active coordinator.');
        }

        if (error.code === '23505') {
            throw createHttpError(400, 'An account with this email or username already exists.');
        }

        throw error;
    } finally {
        client.release();
    }
}

async function archiveStaffAccount(userId, actorUserId = null) {
    if (!userId) {
        throw createHttpError(400, 'User ID is required.');
    }

    if (actorUserId && String(actorUserId) === String(userId)) {
        throw createHttpError(400, 'You cannot archive your own account.');
    }

    const existing = await getStaffAccountById(userId, true);

    if (!existing) {
        return null;
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const coordinatorPendingResult = await client.query(
            `SELECT COUNT(*)::int AS pending_count
             FROM ro_placements rp
             JOIN ro_area_coordinators rac
               ON rac.coordinator_assignment_id = rp.coordinator_assignment_id
             WHERE rac.user_id = $1
               AND rac.is_active = true
               AND rp.placement_status = 'Pending'`,
            [userId]
        );
        if (Number(coordinatorPendingResult.rows[0]?.pending_count || 0) > 0) {
            throw createHttpError(
                409,
                'This account still has pending RO placement requests. Reassign them before archiving the account.'
            );
        }
        await client.query(
            `UPDATE admin_profiles SET is_archived = true WHERE user_id = $1`,
            [userId]
        );
        await revokeStaffSessionVersion(client, userId);
        await pdCourseAssignmentService.releaseAssignments(userId, client);
        await client.query(
            `UPDATE ro_area_coordinators
             SET is_active = false, archived_at = now(), updated_at = now()
             WHERE user_id = $1 AND is_active = true`,
            [userId]
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    return getStaffAccountById(userId, true);
}

async function restoreStaffAccount(userId) {
    if (!userId) {
        throw createHttpError(400, 'User ID is required.');
    }

    const existing = await getStaffAccountById(userId, true);

    if (!existing) {
        return null;
    }

    if (existing.role === 'ro_coordinator') {
        await validateRoCoordinatorDepartment(existing.department);
        await assertRoCoordinatorAreaAvailable(existing.department, userId);
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE admin_profiles
             SET is_archived = false
             WHERE user_id = $1`,
            [userId]
        );
        // Restoring an account deliberately does not revive its old browser
        // sessions. The user must sign in again and receive the new version.
        await revokeStaffSessionVersion(client, userId);
        if (existing.role === 'ro_coordinator') {
            await syncStandaloneRoCoordinatorAssignment({
                userId,
                department: existing.department,
                active: true,
                client,
            });
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    return getStaffAccountById(userId, true);
}

async function updateCurrentStaffProfile(userId, payload = {}) {
    if (!userId) {
        throw createHttpError(400, 'User ID is required.');
    }

    const firstName = safeText(payload.first_name);
    const lastName = safeText(payload.last_name);
    const email = safeText(payload.email).toLowerCase();
    const phoneNumber = safeText(payload.phone_number) || null;
    const position = safeText(payload.position);

    if (!firstName) {
        throw createHttpError(400, 'First name is required.');
    }

    if (!lastName) {
        throw createHttpError(400, 'Last name is required.');
    }

    if (!email) {
        throw createHttpError(400, 'Email is required.');
    }

    const parsedEmail = z.string().trim().toLowerCase().email().safeParse(email);

    if (!parsedEmail.success) {
        throw createHttpError(400, 'A valid email address is required.');
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const currentProfile = await fetchStaffAccountRow(userId, client, false);

        if (!currentProfile) {
            throw createHttpError(404, 'Account profile not found.');
        }

        const duplicateEmailResult = await client.query(
            `
            SELECT user_id
            FROM users
            WHERE LOWER(email) = LOWER($1)
              AND user_id <> $2
            LIMIT 1
            `,
            [email, userId]
        );

        if (duplicateEmailResult.rows.length) {
            throw createHttpError(400, 'Another account is already using this email address.');
        }

        // Department/office ownership remains an administrative assignment.
        // Self-service profile updates may change personal identity/contact
        // details and position text, but must never move an account between
        // departments or RO areas.
        const nextDepartment = currentProfile.department || '';
        const nextPosition = position || currentProfile.position || '';

        await client.query(
            `
            UPDATE users
            SET
                email = $2,
                phone_number = $3
            WHERE user_id = $1
            `,
            [userId, email, phoneNumber]
        );

        await client.query(
            `
            UPDATE admin_profiles
            SET
                first_name = $2,
                last_name = $3,
                department = $4,
                position = $5
            WHERE user_id = $1
            `,
            [userId, firstName, lastName, nextDepartment, nextPosition]
        );

        await client.query('COMMIT');

        return getCurrentStaffProfile(userId);
    } catch (error) {
        await client.query('ROLLBACK');

        if (error.code === '23505') {
            throw createHttpError(400, 'An account with this email already exists.');
        }

        throw error;
    } finally {
        client.release();
    }
}


async function verifyCurrentStaffPassword(userId, payload = {}) {
    if (!userId) {
        throw createHttpError(400, 'User ID is required.');
    }

    const currentPassword = String(payload.current_password || '');
    if (!currentPassword) {
        throw createHttpError(400, 'Current password is required.');
    }

    const result = await db.query(
        `SELECT password_hash FROM users WHERE user_id = $1 LIMIT 1`,
        [userId]
    );

    const passwordHash = result.rows[0]?.password_hash || '';
    if (!passwordHash) {
        throw createHttpError(404, 'Account not found.');
    }

    const currentMatches = await bcrypt.compare(currentPassword, passwordHash);
    if (!currentMatches) {
        throw createHttpError(401, 'Current password is incorrect.');
    }

    return { verified: true };
}


async function changeCurrentStaffPassword(userId, payload = {}) {
    if (!userId) {
        throw createHttpError(400, 'User ID is required.');
    }

    const currentPassword = String(payload.current_password || '');
    const newPassword = String(payload.new_password || '');
    const confirmPassword = String(payload.confirm_password || '');

    if (!currentPassword) {
        throw createHttpError(400, 'Current password is required.');
    }

    const validPassword = validatePassword(newPassword, confirmPassword);
    if (!validPassword) {
        throw createHttpError(400, 'New password is required.');
    }

    const result = await db.query(
        `SELECT password_hash FROM users WHERE user_id = $1 LIMIT 1`,
        [userId]
    );

    const passwordHash = result.rows[0]?.password_hash || '';
    if (!passwordHash) {
        throw createHttpError(404, 'Account not found.');
    }

    const currentMatches = await bcrypt.compare(currentPassword, passwordHash);
    if (!currentMatches) {
        throw createHttpError(401, 'Current password is incorrect.');
    }

    const reusesCurrentPassword = await bcrypt.compare(validPassword, passwordHash);
    if (reusesCurrentPassword) {
        throw createHttpError(400, 'New password must be different from the current password.');
    }

    const nextHash = await bcrypt.hash(validPassword, 12);
    await db.query(
        `UPDATE users SET password_hash = $2 WHERE user_id = $1`,
        [userId, nextHash]
    );

    return { changed: true };
}

async function uploadCurrentStaffProfilePhoto(userId, file) {
    if (!userId) {
        throw createHttpError(400, 'User ID is required.');
    }

    if (!file) {
        throw createHttpError(400, 'Profile photo file is required.');
    }

    const mimeType = safeText(file.mimetype).toLowerCase();

    if (!mimeType.startsWith('image/')) {
        throw createHttpError(400, 'Only image files are allowed for profile photos.');
    }

    const photoEnabled = await hasAdminProfilePhotoColumn();

    if (!photoEnabled) {
        throw createHttpError(400, 'Profile photo upload is not enabled yet for these accounts.');
    }

    const currentProfile = await getCurrentStaffProfile(userId);
    const originalName = sanitizeFileName(file.originalname || 'profile-photo');
    const baseName = originalName.replace(/\.[^.]+$/, '') || 'profile-photo';
    const extension = originalName.includes('.') ? originalName.split('.').pop() : 'png';
    const storagePath = `staff/${userId}/${Date.now()}-${baseName}.${extension}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, file.buffer, {
            contentType: file.mimetype || 'image/png',
            upsert: true,
        });

    if (uploadError) {
        throw createHttpError(500, uploadError.message || 'Failed to upload profile photo.');
    }

    const oldPath = extractAvatarStoragePath(currentProfile.profile_photo_url);

    if (oldPath && oldPath !== storagePath) {
        await supabase.storage.from('avatars').remove([oldPath]).catch(() => null);
    }

    await db.query(
        `
        UPDATE admin_profiles
        SET profile_photo_url = $2
        WHERE user_id = $1
        `,
        [userId, storagePath]
    );

    return getCurrentStaffProfile(userId);
}

async function removeCurrentStaffProfilePhoto(userId) {
    if (!userId) {
        throw createHttpError(400, 'User ID is required.');
    }

    const photoEnabled = await hasAdminProfilePhotoColumn();

    if (!photoEnabled) {
        throw createHttpError(400, 'Profile photo removal is not enabled yet for these accounts.');
    }

    const currentProfile = await getCurrentStaffProfile(userId);
    const oldPath = extractAvatarStoragePath(currentProfile.profile_photo_url);

    if (oldPath) {
        await supabase.storage.from('avatars').remove([oldPath]).catch(() => null);
    }

    await db.query(
        `
        UPDATE admin_profiles
        SET profile_photo_url = NULL
        WHERE user_id = $1
        `,
        [userId]
    );

    return getCurrentStaffProfile(userId);
}

module.exports = {
    archiveStaffAccount,
    hasActiveRoCoordinatorAssignment,
    changeCurrentStaffPassword,
    createAdminAccount,
    createStaffAccount,
    getCurrentStaffProfile,
    listStaffAccounts,
    removeCurrentStaffProfilePhoto,
    restoreStaffAccount,
    updateCurrentStaffProfile,
    updateStaffAccount,
    uploadCurrentStaffProfilePhoto,
    verifyCurrentStaffPassword,
};
