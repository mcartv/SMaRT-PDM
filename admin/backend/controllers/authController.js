const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ALLOWED_ADMIN_EMAIL = 'admin@pdm.edu.ph';
const ALLOWED_SDO_EMAIL = 'sdo@pdm.edu.ph';

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

function isSdoProfile(profile) {
    const department = String(profile?.department || '').toLowerCase();
    const position = String(profile?.position || '').toLowerCase();

    return (
        department.includes('disciplinary') ||
        department.includes('student discipline') ||
        department.includes('sdo') ||
        position.includes('disciplinary') ||
        position.includes('student discipline') ||
        position.includes('sdo')
    );
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

        if (role === 'admin' && normalizedEmail !== ALLOWED_ADMIN_EMAIL) {
            return res.status(403).json({
                message: 'Only admin@pdm.edu.ph is authorized for the admin portal',
            });
        }

        if (role === 'sdo' && normalizedEmail !== ALLOWED_SDO_EMAIL) {
            return res.status(403).json({
                message: 'Only sdo@pdm.edu.ph is authorized for the SDO portal',
            });
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

        if (role === 'admin') {
            if (!user.admin_id) {
                return res.status(403).json({
                    message: 'This account is not authorized for the admin portal',
                });
            }

            if (normalizeEmail(user.email) !== ALLOWED_ADMIN_EMAIL) {
                return res.status(403).json({
                    message: 'Only admin@pdm.edu.ph is authorized for the admin portal',
                });
            }
        }

        if (role === 'sdo') {
            if (!(user.user_role === 'SDO' || isSdoProfile(user))) {
                return res.status(403).json({
                    message: 'This account is not authorized for the SDO portal',
                });
            }

            if (normalizeEmail(user.email) !== ALLOWED_SDO_EMAIL) {
                return res.status(403).json({
                    message: 'Only sdo@pdm.edu.ph is authorized for the SDO portal',
                });
            }
        }

        const token = buildToken(user, role);
        const displayName =
            [user.first_name, user.last_name].filter(Boolean).join(' ') ||
            user.username ||
            user.email;

        return res.json({
            token,
            message: role === 'sdo' ? 'Welcome to the SDO panel' : 'Welcome back',
            user: {
                name: displayName,
                email: user.email,
                position: user.position || (role === 'sdo' ? 'SDO Officer' : 'Staff'),
                department: user.department || (role === 'sdo' ? 'Student Disciplinary Office' : null),
                role,
            },
        });
    } catch (err) {
        console.error(`${role.toUpperCase()} LOGIN ERROR:`, err);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

exports.adminLogin = async (req, res) => loginWithRole(req, res, 'admin');
exports.sdoLogin = async (req, res) => loginWithRole(req, res, 'sdo');
