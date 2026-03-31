const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Join the users table with the admin_profiles table
        const query = `
      SELECT 
        u.user_id, 
        u.email, 
        u.password_hash, /* <-- 1. FIXED: Now asking for password_hash */
        a.admin_id, 
        a.first_name, 
        a.last_name, 
        a.department, 
        a.position
      FROM users u
      JOIN admin_profiles a ON u.user_id = a.user_id
      WHERE u.email = $1 
      AND a.is_archived = false
    `;

        const result = await db.query(query, [email]);
        const adminUser = result.rows[0];

        // 2. If no user is found, or they aren't an active admin
        if (!adminUser) {
            return res.status(401).json({ message: 'Invalid credentials or account deactivated' });
        }

        // 3. Check Password 
        // <-- 2. FIXED: Checking against adminUser.password_hash instead of .password
        const isMatch = await bcrypt.compare(password, adminUser.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 4. Create a richer JWT Token
        const token = jwt.sign(
            {
                userId: adminUser.user_id,
                adminId: adminUser.admin_id,
                role: 'admin',
                name: `${adminUser.first_name} ${adminUser.last_name}`,
                department: adminUser.department
            },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            message: 'Welcome back',
            user: {
                name: `${adminUser.first_name} ${adminUser.last_name}`,
                position: adminUser.position
            }
        });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};