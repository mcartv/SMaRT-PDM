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

    _studentName = [firstName, lastName]
        .where((value) => value.isNotEmpty)
        .join(' ');

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
      _showMessage(
        'Request timed out. Check your connection and try again.',
      );
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasPrefilledId = _studentIdController.text.trim().isNotEmpty;
    final visibleId = StudentIdInputFormatter.toFullStudentId(
      _studentIdController.text,
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF8F5F0),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
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
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.darkBrown,
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),
                  Container(
                    padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(30),
                      border: Border.all(
                        color: AppColors.gold.withOpacity(0.24),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.07),
                          blurRadius: 30,
                          offset: const Offset(0, 16),
                        ),
                      ],
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            width: 72,
                            height: 72,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: AppColors.darkBrown,
                              borderRadius: BorderRadius.circular(22),
                            ),
                            child: const Icon(
                              Icons.lock_person_rounded,
                              color: AppColors.gold,
                              size: 36,
                            ),
                          ),
                          const SizedBox(height: 22),
                          Text(
                            _studentName.isEmpty
                                ? 'Welcome back'
                                : 'Welcome back, $_studentName',
                            style: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.copyWith(
                                  color: AppColors.darkBrown,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            hasPrefilledId
                                ? 'Your Student ID is ready. Enter your password to continue.'
                                : 'Enter your Student ID and password to continue.',
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  color: Colors.grey.shade700,
                                  height: 1.45,
                                ),
                          ),
                          const SizedBox(height: 22),
                          if (hasPrefilledId)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.gold.withOpacity(0.10),
                                borderRadius: BorderRadius.circular(17),
                                border: Border.all(
                                  color: AppColors.gold.withOpacity(0.30),
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
                                      style: const TextStyle(
                                        color: AppColors.darkBrown,
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
                                label: 'Student ID',
                                hint: '0000-000000',
                                prefixText: 'PDM-',
                                icon: Icons.badge_outlined,
                              ),
                              validator: (value) {
                                final fullStudentId =
                                    StudentIdInputFormatter.toFullStudentId(
                                  value ?? '',
                                );
                                if (!RegExp(r'^PDM-\d{4}-\d{6}$')
                                    .hasMatch(fullStudentId)) {
                                  return 'Enter a valid Student ID.';
                                }
                                return null;
                              },
                            ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _passwordController,
                            focusNode: _passwordFocusNode,
                            obscureText: _obscurePassword,
                            textInputAction: TextInputAction.done,
                            onFieldSubmitted: (_) => _handleLogin(),
                            decoration: _inputDecoration(
                              label: 'Password',
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
                              child: const Text(
                                'Forgot password?',
                                style: TextStyle(
                                  color: AppColors.brown,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            height: 52,
                            child: FilledButton(
                              onPressed:
                                  _isLoading ? null : _handleLogin,
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
                          const SizedBox(height: 18),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'No account yet?',
                                style: TextStyle(
                                  color: Colors.grey.shade700,
                                ),
                              ),
                              TextButton(
                                onPressed: () =>
                                    Navigator.pushReplacementNamed(
                                  context,
                                  AppRoutes.studentLookup,
                                  arguments: 'new',
                                ),
                                child: const Text(
                                  'Create account',
                                  style: TextStyle(
                                    color: AppColors.brown,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
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
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixText: prefixText,
      prefixIcon: Icon(icon),
      filled: true,
      fillColor: const Color(0xFFFAF8F4),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide(
          color: AppColors.gold.withOpacity(0.24),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(
          color: AppColors.brown,
          width: 1.6,
        ),
      ),
    );
  }
}
