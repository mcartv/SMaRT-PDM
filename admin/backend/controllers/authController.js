const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { resolveStaffRole } = require('../utils/staffRoles');

const ADMIN_USER_QUERY = `
    SELECT
        u.user_id,
        u.email,
        u.username,
        u.role AS user_role,
        u.password_hash,
        a.admin_id,
        a.first_name,
        a.last_name,
        a.department,
        a.position
    FROM users u
    LEFT JOIN admin_profiles a ON u.user_id = a.user_id
    WHERE LOWER(u.email) = LOWER($1)
      AND (a.user_id IS NULL OR a.is_archived = false)
    LIMIT 1
`;

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function buildToken(profile, role) {
    const fallbackName = [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(' ')
        || profile.username
        || profile.email;

    return jwt.sign(
        {
            sub: profile.user_id,
            userId: profile.user_id,
            user_id: profile.user_id,
            adminId: profile.admin_id,
            role,
            name: fallbackName,
            email: profile.email,
            department: profile.department,
            position: profile.position,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
}

async function loginWithRole(req, res, role) {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    try {
        if (!normalizedEmail || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const result = await db.query(ADMIN_USER_QUERY, [normalizedEmail]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials or account deactivated' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const resolvedRole = resolveStaffRole(user);

        if (role === 'admin') {
            if (!resolvedRole || !['admin', 'pd', 'guidance', 'sdo'].includes(resolvedRole)) {
                return res.status(403).json({
                    message: 'This account is not authorized for the admin portal',
                });
            }
        }

        const departmentPortalLabels = {
            pd: 'PD',
            guidance: 'Guidance',
            sdo: 'SDO',
        };

        if (departmentPortalLabels[role] && resolvedRole !== role) {
            return res.status(403).json({
                message: `This account is not authorized for the ${departmentPortalLabels[role]} portal`,
            });
        }

        const tokenRole = departmentPortalLabels[role] ? role : resolvedRole;
        const token = buildToken(user, tokenRole);
        const displayName =
            [user.first_name, user.last_name].filter(Boolean).join(' ') ||
            user.username ||
            user.email;
        const portalTitle = departmentPortalLabels[role];

        return res.json({
            token,
            message: portalTitle ? `Welcome to the ${portalTitle} panel` : 'Welcome back',
            user: {
                user_id: user.user_id,
                admin_id: user.admin_id || null,
                name: displayName,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                email: user.email,
                phone_number: user.phone_number || '',
                position: user.position || (tokenRole === 'sdo' ? 'SDO Officer' : 'Staff'),
                department: user.department || (tokenRole === 'sdo' ? 'Student Disciplinary Office' : null),
                role: tokenRole,
            },
        });
    } catch (err) {
        console.error(`${role.toUpperCase()} LOGIN ERROR:`, err);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

exports.adminLogin = async (req, res) => loginWithRole(req, res, 'admin');
exports.pdLogin = async (req, res) => loginWithRole(req, res, 'pd');
exports.guidanceLogin = async (req, res) => loginWithRole(req, res, 'guidance');
exports.sdoLogin = async (req, res) => loginWithRole(req, res, 'sdo');
