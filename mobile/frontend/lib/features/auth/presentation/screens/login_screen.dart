import 'dart:async';

import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/auth_service.dart';
import 'package:smartpdm_mobileapp/shared/formatters/student_id_input_formatter.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  // SMART-PDM_MOBILE_AUTH_LOGIN_POLISH_PHASE2_1_V1
  final AuthService _authService = AuthService();
  final _formKey = GlobalKey<FormState>();
  final _studentIdController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordFocusNode = FocusNode();

  bool _obscurePassword = true;
  bool _isLoading = false;
  bool _didApplyRouteArgs = false;
  String _studentName = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    if (_didApplyRouteArgs) return;
    _didApplyRouteArgs = true;

    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final prefillStudentId = args?['prefillStudentId']?.toString().trim() ?? '';
    final firstName = args?['prefillFirstName']?.toString().trim() ?? '';
    final lastName = args?['prefillLastName']?.toString().trim() ?? '';

    _studentName = [
      firstName,
      lastName,
    ].where((value) => value.isNotEmpty).join(' ');

    if (prefillStudentId.isNotEmpty) {
      _studentIdController.text = StudentIdInputFormatter.formatVisible(
        StudentIdInputFormatter.stripPdmPrefix(prefillStudentId),
      );
    }

    if (args?['focusPassword'] == true) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _passwordFocusNode.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _studentIdController.dispose();
    _passwordController.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      await _authService.login(
        studentId: StudentIdInputFormatter.toFullStudentId(
          _studentIdController.text,
        ),
        password: _passwordController.text,
      );

      if (mounted) {
        Navigator.pushReplacementNamed(context, AppRoutes.home);
      }
    } on TimeoutException {
      _showMessage('Request timed out. Check your connection and try again.');
    } on ApiException catch (error) {
      _showMessage(error.message);
    } catch (error) {
      _showMessage(error.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final hasPrefilledId = _studentIdController.text.trim().isNotEmpty;
    final visibleId = StudentIdInputFormatter.toFullStudentId(
      _studentIdController.text,
    );
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? AppColors.applicantDarkSurface : Colors.white;
    final textColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;
    final mutedColor = isDark
        ? AppColors.applicantDarkTextMuted
        : Colors.grey.shade700;

    return Scaffold(
      backgroundColor: isDark
          ? AppColors.applicantDarkBackground
          : const Color(0xFFF8F5F0),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final textScale = MediaQuery.textScalerOf(context).scale(1);
            final isCompact = constraints.maxWidth < 360 || textScale > 1.15;
            final horizontalPadding = isCompact ? 16.0 : 20.0;
            final cardPadding = isCompact ? 20.0 : 22.0;
            final iconSize = isCompact ? 58.0 : 64.0;

            return Center(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                  horizontalPadding,
                  isCompact ? 12 : 16,
                  horizontalPadding,
                  isCompact ? 20 : 26,
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: IconButton.filledTonal(
                          onPressed: () => Navigator.pushReplacementNamed(
                            context,
                            AppRoutes.studentLookup,
                            arguments: 'existing',
                          ),
                          icon: const Icon(Icons.arrow_back_rounded),
                          style: IconButton.styleFrom(
                            backgroundColor: cardColor,
                            foregroundColor: textColor,
                          ),
                        ),
                      ),
                      SizedBox(height: isCompact ? 14 : 18),
                      Container(
                        padding: EdgeInsets.fromLTRB(
                          cardPadding,
                          isCompact ? 20 : 22,
                          cardPadding,
                          isCompact ? 18 : 20,
                        ),
                        decoration: BoxDecoration(
                          color: cardColor,
                          borderRadius: BorderRadius.circular(
                            isCompact ? 22 : 26,
                          ),
                          border: Border.all(
                            color: AppColors.gold.withValues(alpha: 0.24),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(
                                alpha: isDark ? 0.24 : 0.07,
                              ),
                              blurRadius: 26,
                              offset: const Offset(0, 12),
                            ),
                          ],
                        ),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Container(
                                width: iconSize,
                                height: iconSize,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: AppColors.darkBrown,
                                  borderRadius: BorderRadius.circular(
                                    isCompact ? 18 : 20,
                                  ),
                                ),
                                child: Icon(
                                  Icons.lock_person_rounded,
                                  color: AppColors.gold,
                                  size: isCompact ? 29 : 32,
                                ),
                              ),
                              SizedBox(height: isCompact ? 16 : 18),
                              Text(
                                _studentName.isEmpty
                                    ? 'Welcome back'
                                    : 'Welcome back, $_studentName',
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineMedium
                                    ?.copyWith(
                                      color: textColor,
                                      fontWeight: FontWeight.w800,
                                    ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                hasPrefilledId
                                    ? 'Your Student ID is ready. Enter your password to continue.'
                                    : 'Enter your Student ID and password to continue.',
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(color: mutedColor, height: 1.45),
                              ),
                              SizedBox(height: isCompact ? 18 : 20),
                              if (hasPrefilledId)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 14,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.gold.withValues(
                                      alpha: isDark ? 0.16 : 0.10,
                                    ),
                                    borderRadius: BorderRadius.circular(17),
                                    border: Border.all(
                                      color: AppColors.gold.withValues(
                                        alpha: isDark ? 0.42 : 0.30,
                                      ),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(
                                        Icons.badge_rounded,
                                        color: AppColors.brown,
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Text(
                                          visibleId,
                                          style: TextStyle(
                                            color: textColor,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.3,
                                          ),
                                        ),
                                      ),
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pushReplacementNamed(
                                              context,
                                              AppRoutes.studentLookup,
                                              arguments: 'existing',
                                            ),
                                        child: const Text('Change'),
                                      ),
                                    ],
                                  ),
                                )
                              else
                                TextFormField(
                                  controller: _studentIdController,
                                  keyboardType: TextInputType.number,
                                  inputFormatters: const [
                                    StudentIdInputFormatter(),
                                  ],
                                  decoration: _inputDecoration(
                                    label: 'Student ID *',
                                    hint: '0000-000000',
                                    prefixText: 'PDM-',
                                    icon: Icons.badge_outlined,
                                  ),
                                  validator:
                                      StudentIdInputFormatter.validationMessage,
                                ),
                              const SizedBox(height: 16),
                              TextFormField(
                                controller: _passwordController,
                                focusNode: _passwordFocusNode,
                                obscureText: _obscurePassword,
                                textInputAction: TextInputAction.done,
                                onFieldSubmitted: (_) => _handleLogin(),
                                decoration:
                                    _inputDecoration(
                                      label: 'Password *',
                                      hint: 'Enter your password',
                                      icon: Icons.lock_outline_rounded,
                                    ).copyWith(
                                      suffixIcon: IconButton(
                                        onPressed: () => setState(
                                          () => _obscurePassword =
                                              !_obscurePassword,
                                        ),
                                        icon: Icon(
                                          _obscurePassword
                                              ? Icons.visibility_off_rounded
                                              : Icons.visibility_rounded,
                                        ),
                                      ),
                                    ),
                                validator: (value) =>
                                    value == null || value.isEmpty
                                    ? 'Enter your password.'
                                    : null,
                              ),
                              const SizedBox(height: 10),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed: () => Navigator.pushNamed(
                                    context,
                                    AppRoutes.forgotPassword,
                                  ),
                                  child: Text(
                                    'Forgot password?',
                                    style: TextStyle(
                                      color: isDark
                                          ? AppColors.gold
                                          : AppColors.brown,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
                              SizedBox(
                                height: 52,
                                child: FilledButton(
                                  onPressed: _isLoading ? null : _handleLogin,
                                  style: FilledButton.styleFrom(
                                    backgroundColor: AppColors.gold,
                                    foregroundColor: AppColors.darkBrown,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(17),
                                    ),
                                  ),
                                  child: _isLoading
                                      ? const SizedBox(
                                          width: 22,
                                          height: 22,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: AppColors.darkBrown,
                                          ),
                                        )
                                      : const Text(
                                          'Log in',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                ),
                              ),
                              const SizedBox(height: 8),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String label,
    required String hint,
    required IconData icon,
    String? prefixText,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixText: prefixText,
      prefixIcon: Icon(icon),
      filled: true,
      fillColor: isDark
          ? AppColors.applicantDarkSurfaceMuted
          : const Color(0xFFFAF8F4),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide(
          color: isDark
              ? AppColors.applicantDarkOutline
              : AppColors.gold.withValues(alpha: 0.24),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide(
          color: isDark ? AppColors.gold : AppColors.brown,
          width: 1.6,
        ),
      ),
    );
  }
}
