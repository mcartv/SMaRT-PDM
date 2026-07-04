function getSafeStatusCode(error, fallback = 500) {
  const parsed = Number.parseInt(error?.statusCode, 10);

  if (Number.isInteger(parsed) && parsed >= 400 && parsed <= 599) {
    return parsed;
  }

  return fallback;
}

module.exports = {
  getSafeStatusCode,
};
