const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
    WHERE u.email = $1
      AND (a.user_id IS NULL OR a.is_archived = false)
    LIMIT 1
`;

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
            userId: profile.user_id,
            adminId: profile.admin_id,
            role,
            name: fallbackName,
            department: profile.department,
            position: profile.position,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
}

async function loginWithRole(req, res, role) {
    const { email, password } = req.body;

    try {
        const result = await db.query(ADMIN_USER_QUERY, [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials or account deactivated' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (role === 'admin' && !user.admin_id) {
            return res.status(403).json({
                message: 'This account is not authorized for the admin portal',
            });
        }

        if (role === 'sdo' && !(user.user_role === 'SDO' || isSdoProfile(user))) {
            return res.status(403).json({
                message: 'This account is not authorized for the SDO portal',
            });
        }

        const token = buildToken(user, role);
        const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.email;

        return res.json({
            token,
            message: role === 'sdo' ? 'Welcome to the SDO panel' : 'Welcome back',
            user: {
                name: displayName,
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
