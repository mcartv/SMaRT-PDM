import 'dart:async';

import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/formatters/student_id_input_formatter.dart';
import 'package:smartpdm_mobileapp/shared/validation/app_field_validators.dart';
import 'package:smartpdm_mobileapp/core/constants/legal_documents.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/auth_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/legal_document_sheet.dart';
import 'package:smartpdm_mobileapp/shared/widgets/shared_widgets.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final AuthService _authService = AuthService();
  final _formKey = GlobalKey<FormState>();

  final _identifierController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _acceptedPolicies = false;
  bool _isLoading = false;
  bool _didApplyArgs = false;
  bool _isStudentIdReadOnly = false;

  Map<String, dynamic>? _studentData;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    if (_didApplyArgs) return;
    _didApplyArgs = true;

    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;

    final student = (args?['student'] as Map?)?.cast<String, dynamic>();
    final prefillStudentId = args?['prefillStudentId']?.toString().trim() ?? '';
    final prefillEmail = args?['prefillEmail']?.toString().trim() ?? '';

    _studentData = student;
    _isStudentIdReadOnly = args?['isStudentIdReadOnly'] == true;

    if (prefillStudentId.isNotEmpty) {
      _identifierController.text = StudentIdInputFormatter.formatVisible(
        StudentIdInputFormatter.stripPdmPrefix(prefillStudentId),
      );
    } else if (student != null) {
      final rawStudentId =
          (student['pdm_id'] ?? student['student_number'] ?? '')
              .toString()
              .trim();
      _identifierController.text = StudentIdInputFormatter.formatVisible(
        StudentIdInputFormatter.stripPdmPrefix(rawStudentId),
      );
    }

    if (prefillEmail.isNotEmpty) {
      _emailController.text = prefillEmail;
    } else if (student != null) {
      _emailController.text = (student['email_address'] ?? '')
          .toString()
          .trim();
    }
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    if (!_acceptedPolicies) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'You must agree to the Terms of Service and Privacy Statement first.',
          ),
        ),
      );
      return;
    }

    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final identifier = StudentIdInputFormatter.toFullStudentId(
        _identifierController.text,
      );

      final registration = await _authService.register(
        email: _emailController.text.trim().toLowerCase(),
        password: _passwordController.text,
        studentId: identifier,
      );

      if (!mounted) return;

      Navigator.pushNamed(
        context,
        AppRoutes.otp,
        arguments: {
          'email': _emailController.text.trim().toLowerCase(),
          'user_id': registration.userId,
          'student_id': registration.studentId,
        },
      );
    } on TimeoutException {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Request timed out. Please check your connection or try again.',
          ),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Widget _buildRegistrySummary() {
    if (_studentData == null) return const SizedBox.shrink();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;
    final mutedColor = isDark
        ? AppColors.applicantDarkTextMuted
        : Colors.grey.shade800;

    final firstName = (_studentData!['first_name'] ?? '').toString().trim();
    final middleName = (_studentData!['middle_name'] ?? '').toString().trim();
    final lastName = (_studentData!['last_name'] ?? '').toString().trim();
    final yearLevel = (_studentData!['year_level'] ?? '').toString().trim();
    final courseCode = (_studentData!['course_code'] ?? '').toString().trim();
    final courseName = (_studentData!['course_name'] ?? '').toString().trim();

    final fullName = [
      firstName,
      middleName,
      lastName,
    ].where((e) => e.isNotEmpty).join(' ');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Registry Record Found',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: textColor,
            ),
          ),
          const SizedBox(height: 8),
          if (fullName.isNotEmpty)
            Text(
              'Name: $fullName',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: mutedColor),
            ),
          if (courseCode.isNotEmpty || courseName.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Course: ${[courseCode, courseName].where((e) => e.isNotEmpty).join(' • ')}',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: mutedColor),
            ),
          ],
          if (yearLevel.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Year Level: $yearLevel',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: mutedColor),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPolicyAgreement() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark
        ? AppColors.applicantDarkTextMuted
        : Colors.grey.shade800;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.applicantDarkSurfaceMuted
            : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _acceptedPolicies
              ? accentColor.withValues(alpha: 0.45)
              : (isDark
                    ? AppColors.applicantDarkOutline
                    : Colors.grey.shade300),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Checkbox(
            value: _acceptedPolicies,
            onChanged: (value) {
              setState(() {
                _acceptedPolicies = value ?? false;
              });
            },
            activeColor: accentColor,
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    children: [
                      Text(
                        'I have read and agree to the ',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: mutedColor,
                          height: 1.5,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => showLegalDocumentSheet(
                          context,
                          title: LegalDocuments.termsOfServiceTitle,
                          content: LegalDocuments.termsOfService,
                        ),
                        child: const Text(
                          'Terms of Service',
                          style: TextStyle(
                            color: Colors.orange,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Text(
                        ' and the ',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: mutedColor,
                          height: 1.5,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => showLegalDocumentSheet(
                          context,
                          title: LegalDocuments.privacyStatementTitle,
                          content: LegalDocuments.privacyStatement,
                        ),
                        child: const Text(
                          'SMaRT-PDM Privacy Statement',
                          style: TextStyle(
                            color: Colors.orange,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Text(
                        '.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: mutedColor,
                          height: 1.5,
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
    );
  }

  String? _validateStudentId(String? value) {
    return AppFieldValidators.studentId(value);
  }

  @override
  Widget build(BuildContext context) {
    final hasRegistryRecord = _studentData != null;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark
        ? AppColors.applicantDarkSurface
        : Colors.white;
    final textColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;
    final mutedColor = isDark
        ? AppColors.applicantDarkTextMuted
        : Colors.grey.shade700;
    final titleStyle = Theme.of(context).textTheme.displayLarge?.copyWith(
      fontWeight: FontWeight.bold,
      fontSize: 31,
    );
    final bodyStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
      color: mutedColor,
      fontSize: 16,
      height: 1.35,
    );

    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: isDark
                ? const [
                    AppColors.applicantDarkBackground,
                    Color(0xFF24180F),
                  ]
                : const [Color(0xFFF3E4D5), Color(0xFFF8F5F0)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: cardColor,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: isDark ? 0.24 : 0.08),
                        blurRadius: 24,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Image.asset(
                          'assets/images/school_logo.png',
                          height: 132,
                          fit: BoxFit.contain,
                        ),
                        const SizedBox(height: 18),
                        Text(
                          'Finish account setup',
                          style: titleStyle?.copyWith(
                            color: textColor,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Your Student ID was verified. Complete the remaining details to secure your account.',
                          style: bodyStyle,
                          textAlign: TextAlign.center,
                        ),
                        if (hasRegistryRecord) ...[
                          const SizedBox(height: 20),
                          _buildRegistrySummary(),
                        ],
                        const SizedBox(height: 24),
                        TextFormField(
                          controller: _identifierController,
                          readOnly: _isStudentIdReadOnly,
                          textCapitalization: TextCapitalization.characters,
                          style: const TextStyle(fontSize: 17),
                          decoration: InputDecoration(
                            labelText: 'Student ID *',
                            prefixIcon: const Icon(Icons.school_outlined),
                            suffixIcon: _isStudentIdReadOnly
                                ? const Icon(Icons.lock_outline)
                                : null,
                            labelStyle: TextStyle(
                              color: isDark
                                  ? AppColors.applicantDarkTextMuted
                                  : AppColors.brown,
                              fontWeight: FontWeight.w600,
                            ),
                            floatingLabelStyle: TextStyle(
                              color: isDark ? AppColors.gold : AppColors.darkBrown,
                              fontWeight: FontWeight.w800,
                            ),
                            focusedBorder: UnderlineInputBorder(
                              borderSide: BorderSide(
                                color: isDark ? AppColors.gold : AppColors.darkBrown,
                                width: 2,
                              ),
                            ),
                          ),
                          validator: _validateStudentId,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          style: const TextStyle(fontSize: 17),
                          decoration: const InputDecoration(
                            labelText: 'Email Address *',
                            prefixIcon: Icon(Icons.email_outlined),
                          ),
                          validator: (value) => AppFieldValidators.email(value),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          style: const TextStyle(fontSize: 17),
                          decoration: InputDecoration(
                            labelText: 'Password *',
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_off
                                    : Icons.visibility,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                            ),
                          ),
                          autovalidateMode: AutovalidateMode.onUserInteraction,
                          validator: AppFieldValidators.password,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _confirmPasswordController,
                          obscureText: _obscureConfirmPassword,
                          style: const TextStyle(fontSize: 17),
                          decoration: InputDecoration(
                            labelText: 'Confirm Password *',
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscureConfirmPassword
                                    ? Icons.visibility_off
                                    : Icons.visibility,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscureConfirmPassword =
                                      !_obscureConfirmPassword;
                                });
                              },
                            ),
                          ),
                          validator: (value) => AppFieldValidators.confirmPassword(
                            value,
                            password: _passwordController.text,
                          ),
                        ),
                        const SizedBox(height: 20),
                        _buildPolicyAgreement(),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: _isLoading
                              ? const Center(
                                  child: SizedBox(
                                    height: 24,
                                    width: 24,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  ),
                                )
                              : GoldButton(
                                  label: 'Sign Up',
                                  onTap: _handleRegister,
                                ),
                        ),
                        const SizedBox(height: 24),
                        Wrap(
                          alignment: WrapAlignment.center,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 4,
                          runSpacing: 2,
                          children: [
                            Text(
                              'Already registered?',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: mutedColor),
                            ),
                            TextButton(
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                  vertical: 2,
                                ),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                visualDensity: VisualDensity.compact,
                              ),
                              onPressed: () => Navigator.pushReplacementNamed(
                                context,
                                AppRoutes.login,
                                arguments: {
                                  'prefillStudentId':
                                      StudentIdInputFormatter.toFullStudentId(
                                        _identifierController.text,
                                      ),
                                  'focusPassword': true,
                                },
                              ),
                              child: const Text(
                                'Log in',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
