const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smart-pdm-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function normalizeDecodedUser(decoded = {}) {
  const normalizedUserId = decoded.user_id || decoded.userId || decoded.sub || null;

  return {
    ...decoded,
    sub: decoded.sub || normalizedUserId || undefined,
    user_id: normalizedUserId,
    userId: normalizedUserId,
  };
}

function extractToken(value = '') {
  if (!value || typeof value !== 'string') return null;
  return value.startsWith('Bearer ') ? value.slice(7).trim() : value.trim();
}

function buildAuthToken(user) {
  return jwt.sign(
    normalizeDecodedUser({
      sub: user.user_id,
      user_id: user.user_id,
      userId: user.user_id,
      email: user.email,
      student_id: user.username,
      role: user.role,
    }),
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return normalizeDecodedUser(jwt.verify(token, JWT_SECRET));
}

function protect(req, res, next) {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    req.user = verifyToken(token);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

function authenticateSocket(socket, next) {
  try {
    const rawToken =
      socket.handshake?.auth?.token ||
      socket.handshake?.headers?.authorization ||
      socket.handshake?.query?.token;

    const token = extractToken(rawToken);

    if (!token) {
      return next(new Error('Authentication required.'));
    }

    socket.user = verifyToken(token);
    return next();
  } catch (error) {
    return next(new Error('Invalid or expired authentication token.'));
  }
}

module.exports = {
  buildAuthToken,
  protect,
  authenticateSocket,
};
