// Extracted network/retry helpers
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error) {
  const message = [error?.message, error?.details, error?.cause?.message]
    .filter(Boolean)
    .join(' ');

  return [
    'fetch failed',
    'econnreset',
    'etimedout',
    'eai_again',
    'enotfound',
    'socket hang up',
  ].some((token) => message.toLowerCase().includes(token));
}

function getRequestMethod(input, init) {
  if (init?.method) return String(init.method).toUpperCase();
  if (typeof input === 'object' && input?.method) {
    return String(input.method).toUpperCase();
  }

  return 'GET';
}

async function supabaseFetchWithRetry(input, init) {
  const method = getRequestMethod(input, init);
  const canRetry = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  const maxAttempts = canRetry ? 3 : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;

