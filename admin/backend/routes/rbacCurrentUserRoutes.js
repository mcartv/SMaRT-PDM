'use strict';
const express = require('express');
const db = require('../config/db');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// This endpoint is read-only and relies on protect() to verify the session.
router.get('/me/permissions', protect, async (req, res) => {
  const userId = req.staffAccount?.user_id || req.user?.user_id;
  if (!userId) return res.status(401).json({ code: 'AUTH_REQUIRED' });
  try {
    const result = await db.query(`
      SELECT DISTINCT r.role_code, p.permission_code
      FROM public.rbac_user_roles ur
      JOIN public.rbac_roles r ON r.role_id = ur.role_id
      LEFT JOIN public.rbac_role_permissions rp ON rp.role_id = r.role_id
      LEFT JOIN public.rbac_permissions p ON p.permission_id = rp.permission_id
      WHERE ur.user_id = $1 AND ur.is_active = true
        AND r.is_active = true AND r.role_scope = 'staff'
      ORDER BY r.role_code, p.permission_code
    `, [userId]);
    const roles = [...new Set(result.rows.map(row => row.role_code))];
    const permissions = [...new Set(result.rows.map(row => row.permission_code).filter(Boolean))];
    res.set('Cache-Control', 'no-store');
    return res.json({ roles, permissions });
  } catch (error) {
    console.error('RBAC permission retrieval unavailable:', error.message);
    return res.status(503).json({code:'RBAC_UNAVAILABLE', message:'Permissions temporarily unavailable.'});
  }
});
module.exports = router;
