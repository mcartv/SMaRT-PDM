const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || !String(secret).trim()) {
    throw new Error('JWT_SECRET is missing in .env');
  }

  return String(secret).trim();
}

function buildAuthToken(user) {
  const payload = {
    user_id: user.user_id,
    userId: user.user_id,
    id: user.user_id,
    role: user.role,
    email: user.email,
    username: user.username,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';

  if (!header) return null;

  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }

  return header.trim();
}

function protect(req, res, next) {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required.',
      });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    req.user = {
      user_id: decoded.user_id || decoded.userId || decoded.id,
      userId: decoded.user_id || decoded.userId || decoded.id,
      id: decoded.user_id || decoded.userId || decoded.id,
      role: decoded.role,
      email: decoded.email,
      username: decoded.username,
    };

    return next();
  } catch (error) {
    console.error('AUTH TOKEN ERROR:', error.message);

    return res.status(401).json({
      error: 'Invalid or expired authentication token.',
    });
  }
}

function authenticateSocket(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      '';

    if (!token) {
      return next(new Error('Authentication required.'));
    }

    const cleanToken = String(token).replace(/^Bearer\s+/i, '').trim();
    const decoded = jwt.verify(cleanToken, getJwtSecret());

    socket.user = {
      user_id: decoded.user_id || decoded.userId || decoded.id,
      userId: decoded.user_id || decoded.userId || decoded.id,
      id: decoded.user_id || decoded.userId || decoded.id,
      role: decoded.role,
      email: decoded.email,
      username: decoded.username,
    };

    return next();
  } catch (error) {
    console.error('SOCKET AUTH ERROR:', error.message);
    return next(new Error('Invalid or expired authentication token.'));
  }
}

module.exports = {
  buildAuthToken,
  protect,
  authenticateSocket,
};