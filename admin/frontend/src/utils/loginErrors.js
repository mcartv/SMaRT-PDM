const LOGIN_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  ACCOUNT_DEACTIVATED:
    'Your account has been disabled by an administrator. Please contact the administrator for assistance.',
  WRONG_PORTAL:
    'This account does not have access to this portal. Choose the correct office portal.',
  NETWORK_ERROR:
    'The server cannot be reached. Check your connection and try again.',
  ADMIN_ACTIVE_DEVICE_LIMIT_REACHED:
    'This Admin account is already active on another device. Log out that session or recover the Admin account before trying again.',
  ADMIN_ACTIVE_SESSION_CONFLICT:
    'An Admin session is already active on this device. Refresh the page and try again.',
  SERVER_ERROR:
    'The server could not complete the sign-in request. Please try again shortly.',
};

export function getLoginErrorMessage(error, portalLabel = 'this') {
  const knownMessage = LOGIN_ERROR_MESSAGES[error?.code];
  if (knownMessage) return knownMessage;

  if (Number(error?.status) >= 500) {
    return LOGIN_ERROR_MESSAGES.SERVER_ERROR;
  }

  return (
    error?.message ||
    `Unable to sign in to the ${portalLabel} portal. Please try again.`
  );
}
