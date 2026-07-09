const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'No token, authorization denied',
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = {
            ...decoded,
            userId: decoded.userId || decoded.user_id || decoded.sub || null,
            user_id: decoded.user_id || decoded.userId || decoded.sub || null,
            role: String(decoded.role || '').trim().toLowerCase() || null,
        };

        next();
    } catch (err) {
        console.error('JWT VERIFY ERROR:', err.message);
        return res.status(401).json({
            message: 'Token is not valid',
        });
    }
};

const authorizeRoles = (...roles) => (req, res, next) => {
    const userRole = String(req.user?.role || '').trim().toLowerCase();

    const allowedRoles = roles.map((role) =>
        String(role || '').trim().toLowerCase()
    );

    if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
            message: 'Access denied for this account',
        });
    }

    next();
};

module.exports = { protect, authorizeRoles };