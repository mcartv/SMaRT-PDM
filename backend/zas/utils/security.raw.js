// Extracted OTP/security helpers
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isLoopbackAddress(value) {
  const normalized = (value || '').toString().trim().replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost';
}

function safeCompareSecrets(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorizedInternalRequest(req) {
  const expectedSecret = (process.env.INTERNAL_NOTIFICATION_SECRET || '').trim();
  const providedSecret = (req.get('x-internal-notification-secret') || '').trim();

  if (expectedSecret) {
    return safeCompareSecrets(providedSecret, expectedSecret);
  }

  return (
    isLoopbackAddress(req.ip) ||
    isLoopbackAddress(req.socket?.remoteAddress)
  );
}
