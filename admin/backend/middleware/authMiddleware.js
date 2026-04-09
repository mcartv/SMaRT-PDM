const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('JWT VERIFY ERROR:', err.message);
        return res.status(401).json({ message: 'Token is not valid' });
    }
};

const authorizeRoles = (...roles) => (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied for this account' });
    }

    next();
};

module.exports = { protect, authorizeRoles };