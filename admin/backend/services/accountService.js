const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../config/db');
const supabase = require('../config/supabase');
const { resolveStaffRole } = require('../utils/staffRoles');
const { extractAvatarStoragePath, resolveAvatarUrl } = require('./avatarService');

const ROLE_CONFIG = {
    admin: {
        dbRole: 'Admin',
        department: 'OSFA',
        position: 'OSFA Administrator',
    },
    pd: {
        dbRole: 'Admin',
        department: 'Program Department',
        position: 'Program Director',
    },
    guidance: {
        dbRole: 'Admin',
        department: 'Guidance Office',
        position: 'Guidance Staff',
    },
    sdo: {
        dbRole: 'SDO',
        department: 'Student Disciplinary Office',
        position: 'SDO Officer',
    },
};

const staffAccountSchema = z
    .object({
        first_name: z.string().trim().min(1, 'First name is required.'),
        last_name: z.string().trim().min(1, 'Last name is required.'),
        email: z.string().trim().toLowerCase().email('A valid email address is required.'),
        phone_number: z.string().trim().optional().default(''),
        role: z.enum(['admin', 'pd', 'guidance', 'sdo'], {
            error: 'Invalid role selected.',
        }),
        department: z.string().trim().optional().default(''),
        position: z.string().trim().optional().default(''),
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters.')
            .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
            .regex(/[0-9]/, 'Password must contain at least one number.'),
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
        profile_photo_url: row.profile_photo_url || null,
        created_at: row.created_at,
    };
}

async function decorateStaffAccount(row) {
    const account = mapStaffAccount(row);
    return {
        ...account,
        avatar_url: await resolveAvatarUrl(account.profile_photo_url),
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

async function listStaffAccounts() {
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
            a.profile_photo_url
        FROM users u
        INNER JOIN admin_profiles a ON a.user_id = u.user_id
        WHERE COALESCE(a.is_archived, false) = false
        ORDER BY u.created_at DESC
    `);

    const accounts = await Promise.all(result.rows.map((row) => decorateStaffAccount(row)));

    return accounts.filter((account) => ['admin', 'pd', 'guidance', 'sdo'].includes(account.role));
}

async function getCurrentStaffProfile(userId) {
    if (!userId) {
        throw createHttpError(400, 'User ID is required.');
    }

    const result = await db.query(
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
            a.profile_photo_url
        FROM users u
        INNER JOIN admin_profiles a ON a.user_id = u.user_id
        WHERE u.user_id = $1
          AND COALESCE(a.is_archived, false) = false
        LIMIT 1
        `,
        [userId]
    );

    const row = result.rows[0];

    if (!row) {
        throw createHttpError(404, 'Staff profile not found.');
    }

    return decorateStaffAccount(row);
}

async function updateCurrentStaffProfile(userId, payload = {}) {
    if (!userId) {
        throw createHttpError(400, 'User ID is required.');
    }

    const firstName = safeText(payload.first_name);
    const lastName = safeText(payload.last_name);
    const email = safeText(payload.email).toLowerCase();
    const phoneNumber = safeText(payload.phone_number) || null;
    const department = safeText(payload.department);
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

        const currentProfileResult = await client.query(
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
                a.profile_photo_url
            FROM users u
            INNER JOIN admin_profiles a ON a.user_id = u.user_id
            WHERE u.user_id = $1
              AND COALESCE(a.is_archived, false) = false
            LIMIT 1
            `,
            [userId]
        );

        const currentProfile = currentProfileResult.rows[0];

        if (!currentProfile) {
            throw createHttpError(404, 'Staff profile not found.');
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

        const nextDepartment = department || currentProfile.department || '';
        const nextPosition = position || currentProfile.position || '';

        await client.query(
            `
            UPDATE users
            SET email = $2,
                phone_number = $3
            WHERE user_id = $1
            `,
            [userId, email, phoneNumber]
        );

        await client.query(
            `
            UPDATE admin_profiles
            SET first_name = $2,
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

async function createStaffAccount(payload) {
    const parsed = staffAccountSchema.safeParse(payload);

    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        throw createHttpError(400, firstIssue?.message || 'Invalid staff account details.');
    }

    const {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumberInput,
        role,
        password,
    } = parsed.data;

    const config = ROLE_CONFIG[role];
    const phoneNumber = safeText(phoneNumberInput) || null;
    const department = safeText(payload.department) || config.department;
    const position = safeText(payload.position) || config.position;
    const passwordHash = await bcrypt.hash(password, 12);
    const client = await db.connect();

    try {
        await client.query('BEGIN');

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
                INSERT INTO users (role, username, password_hash, email, phone_number, is_otp_verified)
                VALUES ($1, $2, $3, $4, $5, true)
                RETURNING user_id, email, username, phone_number, role AS user_role, created_at
            `,
            [config.dbRole, username, passwordHash, email, phoneNumber]
        );

        const user = userResult.rows[0];
        const profileResult = await client.query(
            `
                INSERT INTO admin_profiles (user_id, first_name, last_name, department, position, is_archived)
                VALUES ($1, $2, $3, $4, $5, false)
                RETURNING admin_id, first_name, last_name, department, position, profile_photo_url
            `,
            [user.user_id, firstName, lastName, department, position]
        );

        await client.query('COMMIT');

        return decorateStaffAccount({
            ...user,
            ...profileResult.rows[0],
        });
    } catch (error) {
        await client.query('ROLLBACK');

        if (error.code === '23505') {
            throw createHttpError(400, 'An account with this email or username already exists.');
        }

        throw error;
    } finally {
        client.release();
    }
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

module.exports = {
    createStaffAccount,
    getCurrentStaffProfile,
    listStaffAccounts,
    updateCurrentStaffProfile,
    uploadCurrentStaffProfilePhoto,
};
