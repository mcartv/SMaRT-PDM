import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/shared/formatters/student_id_input_formatter.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/shared/widgets/shared_widgets.dart';

class StudentLookupScreen extends StatefulWidget {
  final String? mode; // 'existing' or 'new'

  const StudentLookupScreen({super.key, this.mode});

  @override
  State<StudentLookupScreen> createState() => _StudentLookupScreenState();
}

class _StudentLookupScreenState extends State<StudentLookupScreen> {
  final TextEditingController _controller = TextEditingController();

  bool _loading = false;
  String? _error;

  bool get _isExisting => widget.mode == 'existing';

  Future<void> _checkStudent() async {
    final studentId = StudentIdInputFormatter.toFullStudentId(_controller.text);

    if (studentId.isEmpty) {
      setState(() => _error = 'Student ID is required');
      return;
    }

    final studentIdRegex = RegExp(r'^PDM-\d{4}-\d{6}$');
    if (!studentIdRegex.hasMatch(studentId)) {
      setState(() => _error = 'Invalid format. Use PDM-0000-000000');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final api = ApiClient();

      final res = await api.postJson(
        '/api/auth/check-student-id',
        body: {'student_id': studentId},
      );

      final exists = res['exists'] == true;
      final hasAccount = res['hasAccount'] == true;
      final student = (res['student'] as Map?)?.cast<String, dynamic>() ?? {};

      if (!exists) {
        setState(() {
          _error = 'Student ID not found in the registry.';
        });
        return;
      }

      if (!mounted) return;

      if (hasAccount) {
        Navigator.pushNamed(
          context,
          AppRoutes.login,
          arguments: {
            'prefillStudentId': studentId,
            'focusPassword': true,
            'prefillFirstName': student['first_name'],
            'prefillLastName': student['last_name'],
          },
        );
      } else {
        Navigator.pushNamed(
          context,
          AppRoutes.register,
          arguments: {
            'student': student,
            'prefillStudentId': student['pdm_id'] ?? studentId,
            'prefillEmail': student['email_address'] ?? '',
            'isStudentIdReadOnly': true,
          },
        );
      }
    } catch (e) {
      setState(() {
        _error = 'Unable to connect to the server.';
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _goBack() {
    Navigator.pop(context);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final title = _isExisting ? 'Existing Account' : 'New Applicant';
    final subtitle = _isExisting
        ? 'Enter your Student ID to continue to your account, whether you are an applicant or scholar.'
        : 'Enter your Student ID so we can check your registry record before registration.';
    final titleStyle = Theme.of(context).textTheme.displayLarge?.copyWith(
      fontWeight: FontWeight.bold,
      fontSize: 31,
    );
    final bodyStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
      color: Colors.grey.shade700,
      fontSize: 16,
      height: 1.35,
    );

    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AppColors.gold, AppColors.white],
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 28,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.95),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.08),
                        blurRadius: 26,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: IconButton(
                          onPressed: _goBack,
                          icon: const Icon(Icons.arrow_back_rounded),
                          color: AppColors.darkBrown,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Image.asset(
                        'assets/images/school_logo.png',
                        height: 132,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(height: 18),
                      Text(
                        title,
                        style: titleStyle?.copyWith(color: AppColors.darkBrown),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        subtitle,
                        style: bodyStyle,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 22),
                      TextField(
                        controller: _controller,
                        keyboardType: TextInputType.number,
                        inputFormatters: const [StudentIdInputFormatter()],
                        style: const TextStyle(fontSize: 17),
                        decoration: InputDecoration(
                          labelText: 'Student ID',
                          prefixText: 'PDM-',
                          hintText: '0000-000000',
                          prefixIcon: const Icon(Icons.badge_outlined),
                          errorText: _error,
                          labelStyle: const TextStyle(
                            color: AppColors.brown,
                            fontWeight: FontWeight.w600,
                          ),
                          floatingLabelStyle: const TextStyle(
                            color: AppColors.darkBrown,
                            fontWeight: FontWeight.w800,
                          ),
                          focusedBorder: const UnderlineInputBorder(
                            borderSide: BorderSide(
                              color: AppColors.darkBrown,
                              width: 2,
                            ),
                          ),
                        ),
                        onChanged: (_) {
                          if (_error != null) {
                            setState(() => _error = null);
                          }
                        },
                      ),
                      const SizedBox(height: 22),
                      SizedBox(
                        width: double.infinity,
                        child: _loading
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
                                label: 'Continue',
                                onTap: _checkStudent,
                              ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: GhostButton(label: 'Back', onTap: _goBack),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'Use your official Student ID to continue.',
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(color: Colors.grey.shade600),
                        textAlign: TextAlign.center,
                      ),
                    ],
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
