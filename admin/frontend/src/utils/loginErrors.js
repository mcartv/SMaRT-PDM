const LOGIN_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  ACCOUNT_DEACTIVATED:
    'Your account has been disabled by an administrator. Please contact the administrator for assistance.',
  WRONG_PORTAL:
    'This user account does not have configured access to SMaRT-PDM. Please contact an administrator.',
  USER_ACCESS_NOT_CONFIGURED:
    'This user account does not have configured access to SMaRT-PDM. Please contact an administrator.',
  STAFF_ACCESS_NOT_CONFIGURED:
    'This user account does not have configured access to SMaRT-PDM. Please contact an administrator.',
  NETWORK_ERROR:
    'The server cannot be reached. Check your connection and try again.',
  ADMIN_ACTIVE_SESSION_CONFLICT:
    'An Admin session is already active on this device. Refresh the page and try again.',
  ADMIN_DEVICE_LIMIT_REACHED:
    'This Admin account is already active on 3 devices. Log out from one device and try again.',
  SERVER_ERROR:
    'The server could not complete the sign-in request. Please try again shortly.',
};

export function getLoginErrorMessage(error) {
  const knownMessage = LOGIN_ERROR_MESSAGES[error?.code];
  if (knownMessage) return knownMessage;

  if (Number(error?.status) >= 500) {
    return LOGIN_ERROR_MESSAGES.SERVER_ERROR;
  }

  return 'Unable to sign in. Please check your details and try again.';
}
