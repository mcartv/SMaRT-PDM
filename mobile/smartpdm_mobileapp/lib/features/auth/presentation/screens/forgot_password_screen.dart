import 'dart:async';

import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/features/auth/data/models/recovery_models.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/recovery_captcha_service.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/recovery_service.dart';

const Color _recoveryBlue = Color(0xFF1877F2);
const Color _recoveryBorder = Color(0xFFD6D9DE);
const Color _recoveryMuted = Color(0xFF5A6573);

enum _RecoveryStep {
  findAccount,
  chooseAccount,
  chooseMethod,
  securityCheck,
  verifyCode,
  resetPassword,
  noAccessInfo,
  success,
}

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({
    super.key,
    this.recoveryService,
    this.captchaService,
  });

  final RecoveryService? recoveryService;
  final RecoveryCaptchaService? captchaService;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  static const Set<String> _commonPasswords = {
    '12345678',
    '123456789',
    '1234567890',
    'password',
    'password1',
    'password123',
    'qwerty123',
    'admin123',
    'welcome123',
    'iloveyou',
    'abc12345',
    'letmein123',
    'p@ssw0rd',
  };

  late final RecoveryService _recoveryService;
  late final RecoveryCaptchaService _captchaService;
  final TextEditingController _lookupController = TextEditingController();
  final TextEditingController _newPasswordController = TextEditingController();
  final TextEditingController _confirmPasswordController =
      TextEditingController();
  final List<TextEditingController> _otpControllers = List.generate(
    6,
    (_) => TextEditingController(),
  );
  final List<FocusNode> _otpFocusNodes = List.generate(6, (_) => FocusNode());

  _RecoveryStep _step = _RecoveryStep.findAccount;
  List<RecoveryAccount> _accounts = const [];
  RecoveryAccount? _selectedAccount;
  RecoveryChannel? _selectedChannel;
  RecoverySession? _recoverySession;
  PasswordResetGrant? _resetGrant;
  Timer? _resendTimer;
  Duration _resendRemaining = Duration.zero;
  bool _isLoading = false;
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _recoveryService = widget.recoveryService ?? RecoveryService();
    _captchaService = widget.captchaService ?? RecoveryCaptchaService();
  }

  @override
  void dispose() {
    _lookupController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    for (final controller in _otpControllers) {
      controller.dispose();
    }
    for (final focusNode in _otpFocusNodes) {
      focusNode.dispose();
    }
    _resendTimer?.cancel();
    super.dispose();
  }

  void _setError(String? message) {
    if (!mounted) return;
    setState(() {
      _errorMessage = message;
    });
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _setLoading(bool value) {
    if (!mounted) return;
    setState(() {
      _isLoading = value;
    });
  }

  void _moveToStep(_RecoveryStep step) {
    if (!mounted) return;
    setState(() {
      _step = step;
      _errorMessage = null;
    });
  }

  void _goBack() {
    switch (_step) {
      case _RecoveryStep.findAccount:
        Navigator.pop(context);
        break;
      case _RecoveryStep.chooseAccount:
        _moveToStep(_RecoveryStep.findAccount);
        break;
      case _RecoveryStep.chooseMethod:
        _selectedChannel = null;
        _moveToStep(_RecoveryStep.chooseAccount);
        break;
      case _RecoveryStep.securityCheck:
        _moveToStep(_RecoveryStep.chooseMethod);
        break;
      case _RecoveryStep.verifyCode:
        _moveToStep(_RecoveryStep.securityCheck);
        break;
      case _RecoveryStep.resetPassword:
        _moveToStep(_RecoveryStep.verifyCode);
        break;
      case _RecoveryStep.noAccessInfo:
        _moveToStep(_RecoveryStep.chooseMethod);
        break;
      case _RecoveryStep.success:
        _returnToLogin();
        break;
    }
  }

  Future<void> _lookupAccounts() async {
    final identifier = _lookupController.text.trim();
    if (!RecoveryService.isValidLookupIdentifier(identifier)) {
      _setError('Enter a valid mobile number or email address.');
      return;
    }

    _setLoading(true);
    _setError(null);

    try {
      final accounts = await _recoveryService.lookupRecoveryAccounts(
        identifier,
      );
      if (accounts.isEmpty) {
        _setError(
          'We couldn\'t find an account that matches that mobile number or email.',
        );
        return;
      }

      setState(() {
        _accounts = accounts;
        _selectedAccount = null;
        _selectedChannel = null;
        _recoverySession = null;
        _resetGrant = null;
        _step = _RecoveryStep.chooseAccount;
      });
    } catch (error) {
      _setError(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      _setLoading(false);
    }
  }

  void _chooseAccount(RecoveryAccount account) {
    setState(() {
      _selectedAccount = account;
      _selectedChannel = null;
      _recoverySession = null;
      _resetGrant = null;
      _step = _RecoveryStep.chooseMethod;
      _errorMessage = null;
    });
  }

  void _chooseMethod(RecoveryChannel channel) {
    setState(() {
      _selectedChannel = channel;
      _step = _RecoveryStep.securityCheck;
      _errorMessage = null;
    });
  }

  Future<void> _startRecovery() async {
    final account = _selectedAccount;
    final channel = _selectedChannel;
    if (account == null || channel == null) {
      _setError('Choose an account and recovery method first.');
      return;
    }

    if (!_captchaService.isSupported) {
      _setError(
        'Account recovery verification is currently available on Android only.',
      );
      return;
    }

    _setLoading(true);
    _setError(null);

    try {
      final captchaToken = await _captchaService.executePasswordResetCaptcha();
      final session = await _recoveryService.startRecovery(
        userId: account.userId,
        channel: channel,
        captchaToken: captchaToken,
      );

      _clearOtpInputs();
      _startResendCountdown(session.resendAvailableAt);

      setState(() {
        _recoverySession = session;
        _step = _RecoveryStep.verifyCode;
      });

      _showMessage('Security code sent.');
    } catch (error) {
      _setError(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      _setLoading(false);
    }
  }

  Future<void> _resendCode() async {
    final session = _recoverySession;
    if (session == null || _resendRemaining.inSeconds > 0) {
      return;
    }

    _setLoading(true);
    _setError(null);

    try {
      final nextSession = await _recoveryService.resendRecoveryCode(
        session.sessionId,
      );
      _startResendCountdown(nextSession.resendAvailableAt);
      setState(() {
        _recoverySession = nextSession;
      });
      _showMessage('A new code has been sent.');
    } catch (error) {
      _setError(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      _setLoading(false);
    }
  }

  Future<void> _verifyCode() async {
    final session = _recoverySession;
    if (session == null) {
      _setError('Start the recovery flow again.');
      return;
    }

    final code = _otpControllers.map((controller) => controller.text).join();
    if (code.length != 6) {
      _setError('Enter the 6-digit recovery code.');
      return;
    }

    _setLoading(true);
    _setError(null);

    try {
      final grant = await _recoveryService.verifyRecoveryCode(
        sessionId: session.sessionId,
        code: code,
      );
      setState(() {
        _resetGrant = grant;
        _step = _RecoveryStep.resetPassword;
      });
    } catch (error) {
      _setError(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      _setLoading(false);
    }
  }

  Future<void> _resetPassword() async {
    final grant = _resetGrant;
    if (grant == null) {
      _setError('Verify the recovery code before resetting the password.');
      return;
    }

    final passwordError = _validatePassword(_newPasswordController.text);
    if (passwordError != null) {
      _setError(passwordError);
      return;
    }

    if (_confirmPasswordController.text != _newPasswordController.text) {
      _setError('Passwords do not match.');
      return;
    }

    _setLoading(true);
    _setError(null);

    try {
      await _recoveryService.resetRecoveredPassword(
        resetToken: grant.resetToken,
        newPassword: _newPasswordController.text,
      );

      setState(() {
        _step = _RecoveryStep.success;
      });
    } catch (error) {
      _setError(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      _setLoading(false);
    }
  }

  void _openNoAccessInfo() {
    _moveToStep(_RecoveryStep.noAccessInfo);
  }

  void _notYou() {
    _resendTimer?.cancel();
    setState(() {
      _selectedAccount = null;
      _selectedChannel = null;
      _recoverySession = null;
      _resetGrant = null;
      _step = _RecoveryStep.findAccount;
      _errorMessage = null;
    });
  }

  void _continueWithPassword() {
    final studentId = _selectedAccount?.studentId.trim() ?? '';
    _returnToLogin(prefillStudentId: studentId);
  }

  void _returnToLogin({String prefillStudentId = ''}) {
    Navigator.pushNamedAndRemoveUntil(
      context,
      '/login',
      (route) => false,
      arguments: {
        'prefillStudentId': prefillStudentId,
        'focusPassword': prefillStudentId.isNotEmpty,
      },
    );
  }

  void _clearOtpInputs() {
    for (final controller in _otpControllers) {
      controller.clear();
    }
  }

  void _handleOtpChanged(int index, String value) {
    if (value.length > 1) {
      final characters = value.split('');
      for (var offset = 0; offset < characters.length; offset += 1) {
        final targetIndex = index + offset;
        if (targetIndex >= _otpControllers.length) {
          break;
        }
        _otpControllers[targetIndex].text = characters[offset];
      }

      final rawNextIndex = index + characters.length;
      if (rawNextIndex < _otpFocusNodes.length) {
        _otpFocusNodes[rawNextIndex].requestFocus();
      } else {
        _otpFocusNodes.last.unfocus();
      }
      return;
    }

    if (value.isNotEmpty) {
      if (index < _otpFocusNodes.length - 1) {
        _otpFocusNodes[index + 1].requestFocus();
      } else {
        _otpFocusNodes[index].unfocus();
      }
    } else if (index > 0) {
      _otpFocusNodes[index - 1].requestFocus();
    }
  }

  void _startResendCountdown(DateTime? resendAvailableAt) {
    _resendTimer?.cancel();
    if (resendAvailableAt == null) {
      setState(() {
        _resendRemaining = Duration.zero;
      });
      return;
    }

    void updateRemaining() {
      final remaining = resendAvailableAt.difference(DateTime.now());
      if (!mounted) return;
      setState(() {
        _resendRemaining = remaining.isNegative ? Duration.zero : remaining;
      });
    }

    updateRemaining();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      updateRemaining();
      if (_resendRemaining == Duration.zero) {
        _resendTimer?.cancel();
      }
    });
  }

  String? _validatePassword(String? value) {
    final password = value?.trim() ?? '';
    if (password.isEmpty) {
      return 'Please enter a password';
    }

    final hasLongLength = password.length >= 15;
    final hasStrongMixedRule =
        password.length >= 8 &&
        RegExp(r'[a-z]').hasMatch(password) &&
        RegExp(r'\d').hasMatch(password);

    if (!hasLongLength && !hasStrongMixedRule) {
      return 'Password should be at least 8 characters including a number and a lowercase letter.';
    }

    if (_commonPasswords.contains(password.toLowerCase())) {
      return 'Password is in a list of passwords commonly used on other websites.';
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 220),
          child: SingleChildScrollView(
            key: ValueKey<_RecoveryStep>(_step),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconButton(
                  padding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                  onPressed: _isLoading ? null : _goBack,
                  icon: const Icon(Icons.arrow_back_ios_new_rounded),
                ),
                const SizedBox(height: 12),
                if (_errorMessage != null) ...[
                  _RecoveryMessageBanner(message: _errorMessage!),
                  const SizedBox(height: 16),
                ],
                _buildStepContent(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case _RecoveryStep.findAccount:
        return _buildFindAccountStep();
      case _RecoveryStep.chooseAccount:
        return _buildChooseAccountStep();
      case _RecoveryStep.chooseMethod:
        return _buildChooseMethodStep();
      case _RecoveryStep.securityCheck:
        return _buildSecurityCheckStep();
      case _RecoveryStep.verifyCode:
        return _buildVerifyCodeStep();
      case _RecoveryStep.resetPassword:
        return _buildResetPasswordStep();
      case _RecoveryStep.noAccessInfo:
        return _buildNoAccessInfoStep();
      case _RecoveryStep.success:
        return _buildSuccessStep();
    }
  }

  Widget _buildFindAccountStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Find your account',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        const Text(
          'Enter your mobile number or email.',
          style: TextStyle(fontSize: 16),
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _lookupController,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          decoration: _inputDecoration(hintText: 'Mobile number or email'),
          onSubmitted: (_) => _isLoading ? null : _lookupAccounts(),
        ),
        const SizedBox(height: 32),
        _RecoveryPrimaryButton(
          label: 'Continue',
          isLoading: _isLoading,
          onPressed: _lookupAccounts,
        ),
      ],
    );
  }

  Widget _buildChooseAccountStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Choose your account',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        const Text(
          'These SMaRT-PDM profiles match the email or mobile number you entered.',
          style: TextStyle(fontSize: 16),
        ),
        const SizedBox(height: 20),
        for (final account in _accounts) ...[
          _AccountOptionCard(
            account: account,
            onTap: () => _chooseAccount(account),
          ),
          const SizedBox(height: 16),
        ],
      ],
    );
  }

  Widget _buildChooseMethodStep() {
    final account = _selectedAccount;
    if (account == null) {
      return const SizedBox.shrink();
    }

    final options = <Widget>[];
    if (account.hasEmail && account.maskedEmail != null) {
      options.add(
        _MethodOptionCard(
          title: RecoveryChannel.email.title,
          subtitle: account.maskedEmail!,
          onTap: () => _chooseMethod(RecoveryChannel.email),
        ),
      );
    }
    if (account.hasPhone && account.maskedPhone != null) {
      options.add(
        _MethodOptionCard(
          title: RecoveryChannel.sms.title,
          subtitle: account.maskedPhone!,
          onTap: () => _chooseMethod(RecoveryChannel.sms),
        ),
      );
    }
    options.add(
      _MethodOptionCard(
        title: 'Continue with password',
        subtitle: 'Use your password to continue',
        onTap: _continueWithPassword,
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Choose a way to login',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        Text(
          account.displayName,
          style: const TextStyle(fontSize: 16, color: _recoveryMuted),
        ),
        const SizedBox(height: 20),
        ...options.expand((widget) => [widget, const SizedBox(height: 14)]),
        const SizedBox(height: 8),
        Center(
          child: TextButton(
            onPressed: _openNoAccessInfo,
            child: const Text('No longer have access to these?'),
          ),
        ),
        Center(
          child: TextButton(onPressed: _notYou, child: const Text('Not you?')),
        ),
      ],
    );
  }

  Widget _buildSecurityCheckStep() {
    final channel = _selectedChannel;
    final sessionLabel = _selectedAccount == null || channel == null
        ? ''
        : (channel == RecoveryChannel.email
              ? _selectedAccount!.maskedEmail ?? ''
              : _selectedAccount!.maskedPhone ?? '');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Help us confirm it\'s you',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        const Text(
          'For your security, complete the confirmation step below in order to continue.',
          style: TextStyle(fontSize: 16),
        ),
        const SizedBox(height: 12),
        const Text(
          'This helps us to combat harmful conduct, detect and prevent spam and maintain the integrity of our Products.',
          style: TextStyle(fontSize: 15, color: _recoveryMuted, height: 1.45),
        ),
        const SizedBox(height: 12),
        const Text(
          'We’ve used Google\'s reCAPTCHA Enterprise product to provide this security check. Your use of reCAPTCHA Enterprise is subject to Google\'s Privacy Policy and Terms of Use.',
          style: TextStyle(fontSize: 15, color: _recoveryMuted, height: 1.45),
        ),
        const SizedBox(height: 12),
        const Text(
          'reCAPTCHA Enterprise collects hardware and software information, such as device and application data, and sends it to Google to provide, maintain, and improve reCAPTCHA Enterprise and for general security purposes. This information is not used by Google for personalized advertising.',
          style: TextStyle(fontSize: 15, color: _recoveryMuted, height: 1.45),
        ),
        if (sessionLabel.isNotEmpty) ...[
          const SizedBox(height: 18),
          Text(
            'We’ll send a code to $sessionLabel after verification.',
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: _recoveryMuted,
            ),
          ),
        ],
        if (!_captchaService.isSupported) ...[
          const SizedBox(height: 18),
          const Text(
            'This security check is only available on Android for now.',
            style: TextStyle(color: Colors.redAccent),
          ),
        ],
        const SizedBox(height: 32),
        _RecoveryPrimaryButton(
          label: 'Continue',
          isLoading: _isLoading,
          onPressed: _startRecovery,
        ),
      ],
    );
  }

  Widget _buildVerifyCodeStep() {
    final session = _recoverySession;
    final maskedDestination = session?.maskedDestination ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Enter security code',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        Text(
          maskedDestination.isEmpty
              ? 'Enter the 6-digit code we sent.'
              : 'Enter the 6-digit code sent to $maskedDestination.',
          style: const TextStyle(fontSize: 16),
        ),
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(_otpControllers.length, (index) {
            return SizedBox(
              width: 46,
              height: 56,
              child: TextField(
                controller: _otpControllers[index],
                focusNode: _otpFocusNodes[index],
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                maxLength: 6,
                decoration: _inputDecoration(counterText: ''),
                onChanged: (value) => _handleOtpChanged(index, value),
              ),
            );
          }),
        ),
        const SizedBox(height: 24),
        _RecoveryPrimaryButton(
          label: 'Continue',
          isLoading: _isLoading,
          onPressed: _verifyCode,
        ),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: _resendRemaining == Duration.zero && !_isLoading
                ? _resendCode
                : null,
            child: Text(
              _resendRemaining == Duration.zero
                  ? 'Resend code'
                  : 'Resend in ${_resendRemaining.inSeconds}s',
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildResetPasswordStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Create a new password',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        const Text(
          'Choose a strong password for your SMaRT-PDM account.',
          style: TextStyle(fontSize: 16),
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _newPasswordController,
          obscureText: _obscureNewPassword,
          decoration: _inputDecoration(
            hintText: 'New password',
            helperText:
                'Use 15+ chars, or 8+ with a number and lowercase letter.',
            suffixIcon: IconButton(
              onPressed: () {
                setState(() {
                  _obscureNewPassword = !_obscureNewPassword;
                });
              },
              icon: Icon(
                _obscureNewPassword
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _confirmPasswordController,
          obscureText: _obscureConfirmPassword,
          decoration: _inputDecoration(
            hintText: 'Confirm new password',
            suffixIcon: IconButton(
              onPressed: () {
                setState(() {
                  _obscureConfirmPassword = !_obscureConfirmPassword;
                });
              },
              icon: Icon(
                _obscureConfirmPassword
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
              ),
            ),
          ),
        ),
        const SizedBox(height: 32),
        _RecoveryPrimaryButton(
          label: 'Reset password',
          isLoading: _isLoading,
          onPressed: _resetPassword,
        ),
      ],
    );
  }

  Widget _buildNoAccessInfoStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Complete the security steps to recover this account',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        const Text(
          'This is so that we can make sure this account belongs to you.',
          style: TextStyle(fontSize: 16),
        ),
        const SizedBox(height: 28),
        _RecoveryPrimaryButton(
          label: 'Go back',
          isLoading: false,
          onPressed: () => _moveToStep(_RecoveryStep.chooseMethod),
        ),
      ],
    );
  }

  Widget _buildSuccessStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Password changed',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        const Text(
          'Your password has been updated. Use it to log in to your SMaRT-PDM account.',
          style: TextStyle(fontSize: 16),
        ),
        const SizedBox(height: 32),
        _RecoveryPrimaryButton(
          label: 'Back to login',
          isLoading: false,
          onPressed: () => _returnToLogin(
            prefillStudentId: _selectedAccount?.studentId ?? '',
          ),
        ),
      ],
    );
  }

  InputDecoration _inputDecoration({
    String? hintText,
    String? helperText,
    String? counterText,
    Widget? suffixIcon,
  }) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(18),
      borderSide: const BorderSide(color: _recoveryBorder),
    );

    return InputDecoration(
      hintText: hintText,
      helperText: helperText,
      counterText: counterText,
      suffixIcon: suffixIcon,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: const BorderSide(color: _recoveryBlue, width: 1.4),
      ),
    );
  }
}

class _RecoveryPrimaryButton extends StatelessWidget {
  const _RecoveryPrimaryButton({
    required this.label,
    required this.isLoading,
    required this.onPressed,
  });

  final String label;
  final bool isLoading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: _recoveryBlue,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(27),
          ),
        ),
        child: isLoading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : Text(
                label,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
    );
  }
}

class _RecoveryMessageBanner extends StatelessWidget {
  const _RecoveryMessageBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF2F2),
        border: Border.all(color: const Color(0xFFE57373)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(message, style: const TextStyle(color: Color(0xFFB71C1C))),
    );
  }
}

class _AccountOptionCard extends StatelessWidget {
  const _AccountOptionCard({required this.account, required this.onTap});

  final RecoveryAccount account;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: _recoveryBorder),
          ),
          child: Row(
            children: [
              _AccountAvatar(
                displayName: account.displayName,
                avatarUrl: account.avatarUrl,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      account.displayName,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (account.studentId.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        account.studentId,
                        style: const TextStyle(color: _recoveryMuted),
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, size: 30),
            ],
          ),
        ),
      ),
    );
  }
}

class _MethodOptionCard extends StatelessWidget {
  const _MethodOptionCard({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _recoveryBorder),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: const TextStyle(color: _recoveryMuted),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, size: 28),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccountAvatar extends StatelessWidget {
  const _AccountAvatar({required this.displayName, this.avatarUrl});

  final String displayName;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final trimmedAvatar = avatarUrl?.trim() ?? '';
    if (trimmedAvatar.isNotEmpty) {
      return CircleAvatar(
        radius: 34,
        backgroundImage: NetworkImage(trimmedAvatar),
      );
    }

    final trimmedName = displayName.trim();
    final initial = trimmedName.isEmpty ? '?' : trimmedName[0].toUpperCase();

    return CircleAvatar(
      radius: 34,
      backgroundColor: const Color(0xFFE7EEF9),
      child: Text(
        initial,
        style: const TextStyle(
          color: _recoveryBlue,
          fontSize: 24,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
