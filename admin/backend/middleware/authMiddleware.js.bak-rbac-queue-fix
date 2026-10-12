// SMaRT-PDM: Authentication — auth Middleware (admin backend middleware); validates or transforms requests before controller handling.
const jwt = require('jsonwebtoken');
const adminSessionService = require('../services/adminSessionService');
const staffSessionService = require('../services/staffSessionService');
const systemActivityService = require('../services/systemActivityService');
const { attachSystemAuditCoverage } = require('./systemAuditCoverageMiddleware');

// protect: handles protect for the Authentication flow.
const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'No token, authorization denied',
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const normalizedRole = String(decoded.role || '').trim().toLowerCase();

        req.user = {
            ...decoded,
            userId: decoded.userId || decoded.user_id || decoded.sub || null,
            user_id: decoded.user_id || decoded.userId || decoded.sub || null,
            role: normalizedRole || null,
        };
        req.authToken = token;

        // JWT verification alone is not sufficient for staff accounts. Always
        // confirm that the account still exists, is active, still belongs to
        // the same role family, and has the same token_version as the session.
        req.staffAccount = await staffSessionService.assertCurrentStaffSession({
            decoded: req.user,
        });

        if (normalizedRole === 'admin') {
            if (!decoded.sid) {
                return res.status(401).json({
                    code: 'ADMIN_SESSION_MIGRATION_REQUIRED',
                    message: 'Admin session must be renewed. Please sign in again.',
                });
            }

            req.adminSession = await adminSessionService.assertActiveAdminSession({
                decoded: req.user,
                rawToken: token,
            });
        }

        systemActivityService.recordAuthenticatedRequest({
            req,
            user: req.user,
            rawToken: token,
        });

        // Every authenticated mutation gets a fallback System Log only when
        // its controller did not already create a purpose-built audit entry.
        attachSystemAuditCoverage(req, res);

        return next();
    } catch (err) {
        console.error('JWT/SESSION VERIFY ERROR:', err.message);

        if (err instanceof staffSessionService.StaffSessionError) {
            return res.status(err.statusCode).json({
                code: err.code,
                message: err.message,
            });
        }

        if (err instanceof adminSessionService.AdminSessionError) {
            return res.status(err.statusCode).json({
                code: err.code,
                message: err.message,
            });
        }

        if (err?.name === 'TokenExpiredError') {
            return res.status(401).json({
                code: 'TOKEN_EXPIRED',
                message: 'Your session has expired. Please sign in again.',
            });
        }

        if (err?.name === 'JsonWebTokenError' || err?.name === 'NotBeforeError') {
            return res.status(401).json({
                code: 'TOKEN_INVALID',
                message: 'Token is not valid',
            });
        }

        // Database/network failures during account or managed-session checks do
        // not prove that the signed token is invalid. Returning TOKEN_INVALID
        // here caused the web client to erase valid sessions during transient
        // backend outages.
        return res.status(503).json({
            code: 'SESSION_VALIDATION_UNAVAILABLE',
            message: 'Session validation is temporarily unavailable. Please try again.',
        });
    }
};

// authorizeRoles: handles authorize roles for the Authentication flow.
// Database-backed compatibility for existing portal role guards. The requested
// legacy portal role is a capability, not a hardcoded list of allowed users.
// The admin portal is deliberately NOT delegable to other roles.
const db = require('../config/db');
const authorizeRoles = (...roles) => async (req,res,next) => {
    const userId=req.user?.user_id || req.user?.userId || req.user?.sub;
    if (!userId) return res.status(401).json({message:'Authentication required'});
    const required=roles.map(x=>String(x||'').trim().toLowerCase());
    const tokenRole=String(req.user?.role||'').toLowerCase();
    if (required.includes('admin')) {
        if(tokenRole!=='admin')return res.status(403).json({message:'Administrator access required'});
        return next();
    }
    try {
        const q=await db.query(
          `SELECT 1 FROM public.rbac_user_roles ur
             JOIN public.rbac_roles r ON r.role_id=ur.role_id
             JOIN public.rbac_role_portals p ON p.role_id=r.role_id
             WHERE ur.user_id=$1 AND ur.is_active=TRUE AND r.is_active=TRUE
               AND r.role_scope='staff' AND p.portal_code=ANY($2::text[]) LIMIT 1`,
          [userId,required]);
        if(q.rowCount)return next();
        return res.status(403).json({message:'Access denied for this account'});
    }catch(err){
        console.error('[RBAC portal access]',err.message);
        return res.status(503).json({message:'Authorization temporarily unavailable'});
    }
};

module.exports = { protect, authorizeRoles };
