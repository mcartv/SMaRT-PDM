const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const screenRoot = path.join(
  mobileRoot,
  'frontend',
  'lib',
  'features',
  'auth',
  'presentation',
  'screens'
);

function readScreen(name) {
  return fs.readFileSync(path.join(screenRoot, name), 'utf8');
}

const register = readScreen('register_screen.dart');
const otp = readScreen('otp_screen.dart');
const forgotPassword = readScreen('forgot_password_screen.dart');
const resetOtp = readScreen('reset_password_otp_screen.dart');
const resetPassword = readScreen('reset_password_screen.dart');
const authScreens = [register, otp, forgotPassword, resetOtp, resetPassword];

test('Phase 2.2 registration keeps its workflow while reducing oversized branding', () => {
  assert.match(register, /SMART-PDM_MOBILE_AUTH_REGISTRATION_POLISH_PHASE2_2_V1/);
  assert.match(register, /height: isCompact \? 96 : 108/);
  assert.doesNotMatch(register, /height: 132/);
  assert.match(register, /Registry Record Found/);
  assert.match(register, /padding: EdgeInsets\.all\(isCompact \? 12 : 14\)/);
  assert.match(register, /Terms of Service/);
  assert.match(register, /Privacy Statement/);
  assert.match(register, /_authService\.register\(/);
});

test('Phase 2.3 registration OTP keeps six sequential responsive boxes', () => {
  assert.match(otp, /SMART-PDM_MOBILE_AUTH_OTP_POLISH_PHASE2_3_V1/);
  assert.match(otp, /Widget _buildOtpRow\(\)/);
  assert.match(otp, /LayoutBuilder/);
  assert.match(otp, /final gap = isCompact \? 4\.0 : 8\.0/);
  assert.match(otp, /List\.generate\(11/);
  assert.match(otp, /fontSize: 26/);
  assert.doesNotMatch(otp, /textTheme\.displayLarge\?\.copyWith\(fontWeight: FontWeight\.w700\)/);
  assert.match(otp, /'Verify Code'/);
  assert.match(otp, /_authService\.verifyOtp/);
});

test('Phase 2.4 forgot-password screen follows compact auth proportions', () => {
  assert.match(forgotPassword, /SMART-PDM_MOBILE_AUTH_FORGOT_PASSWORD_POLISH_PHASE2_4_V1/);
  assert.match(forgotPassword, /MediaQuery\.sizeOf\(context\)\.width < 360/);
  assert.match(forgotPassword, /isCompact \? 56 : 64/);
  assert.match(forgotPassword, /Send Verification Code/);
  assert.match(forgotPassword, /AppRoutes\.resetPasswordOtp/);
});

test('Phase 2.5 reset OTP uses a dark surface and responsive controlled OTP type', () => {
  assert.match(resetOtp, /SMART-PDM_MOBILE_AUTH_RESET_OTP_POLISH_PHASE2_5_V1/);
  assert.match(resetOtp, /Widget _buildOtpRow\(\)/);
  assert.match(resetOtp, /LayoutBuilder/);
  assert.match(resetOtp, /fontSize: 26/);
  assert.match(
    resetOtp,
    /color: isDark\s*\? AppColors\.applicantDarkSurface\s*: Colors\.white/
  );
  assert.match(resetOtp, /'Verify Code'/);
  assert.doesNotMatch(resetOtp, /'VERIFY'/);
  assert.match(resetOtp, /verifyResetOtp/);
  assert.match(resetOtp, /AppRoutes\.resetPassword/);
});

test('Phase 2.6 reset password uses the shared auth card language', () => {
  assert.match(resetPassword, /SMART-PDM_MOBILE_AUTH_RESET_PASSWORD_POLISH_PHASE2_6_V1/);
  assert.match(resetPassword, /AppColors\.applicantDarkSurface/);
  assert.match(resetPassword, /AppColors\.gold\.withValues\(alpha: 0\.24\)/);
  assert.match(resetPassword, /headlineMedium/);
  assert.match(resetPassword, /PasswordStrengthIndicator/);
  assert.match(resetPassword, /GoldButton\(\s*label: 'Reset Password'/);
  assert.match(resetPassword, /_passwordResetService\.resetPassword/);
});

test('Phase 2 auth forms remain keyboard-safe and avoid forced ellipsis', () => {
  for (const source of authScreens) {
    assert.match(source, /SafeArea/);
    assert.match(source, /SingleChildScrollView/);
    assert.doesNotMatch(source, /TextOverflow\.ellipsis/);
  }
});
