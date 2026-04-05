import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';
import 'package:smartpdm_mobileapp/screens/forms/step_academic.dart';
import 'package:smartpdm_mobileapp/screens/forms/step_essay.dart';
import 'package:smartpdm_mobileapp/screens/forms/step_family.dart';
import 'package:smartpdm_mobileapp/screens/forms/step_personal.dart';
import 'package:smartpdm_mobileapp/screens/forms/step_submit.dart';
import 'package:smartpdm_mobileapp/screens/providers/new_scholar_provider.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';
import 'package:smartpdm_mobileapp/widgets/shared_widgets.dart';

class NewApplicantScreen extends StatefulWidget {
  const NewApplicantScreen({super.key});

  @override
  State<NewApplicantScreen> createState() => _NewApplicantScreenState();
}

class _NewApplicantScreenState extends State<NewApplicantScreen> {
  int _step = 0;
  final _data = ApplicationData();
  final _scrollCtrl = ScrollController();
  bool _isBootstrapping = true;
  bool _showValidationErrors = false;

  static const _stepLabels = [
    'Personal',
    'Family',
    'Academic',
    'Essay',
    'Submit',
  ];

  @override
  void initState() {
    super.initState();
    _bootstrapFormData();
  }

  Future<void> _bootstrapFormData() async {
    final prefs = await SharedPreferences.getInstance();

    _data.userId = prefs.getString('user_id') ?? '';
    _data.accountStudentId = prefs.getString('user_student_id') ?? '';
    _data.studentNumber = _data.accountStudentId;
    _data.email = prefs.getString('user_email') ?? '';
    _data.firstName = prefs.getString('user_first_name') ?? '';
    _data.lastName = prefs.getString('user_last_name') ?? '';
    _data.mobileNumber = prefs.getString('user_phone') ?? '';
    _data.currentCourse = prefs.getString('user_course') ?? '';
    _data.currentSection = prefs.getString('user_section') ?? '';

    if (!mounted) return;
    setState(() => _isBootstrapping = false);
  }

  void _next() {
    final validationError = _validateCurrentForm();
    if (validationError != null) {
      setState(() => _showValidationErrors = true);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(validationError)));
      return;
    }

    if (_step < 4) {
      setState(() => _step++);
      _scrollCtrl.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  void _back() {
    if (_step > 0) {
      setState(() => _step--);
      _scrollCtrl.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _submitApplication() async {
    if (!_data.agree) {
      setState(() => _showValidationErrors = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Please complete the required certification and legal agreement checkboxes.',
          ),
        ),
      );
      return;
    }

    if (!_data.certificationRead) {
      setState(() => _showValidationErrors = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please confirm the certification statement.'),
        ),
      );
      return;
    }

    if (_data.userId.isEmpty || _data.accountStudentId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Your account details are missing. Please log in again.',
          ),
        ),
      );
      return;
    }

    final validationError = _validateCurrentForm();
    if (validationError != null) {
      setState(() => _showValidationErrors = true);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(validationError)));
      return;
    }

    final provider = context.read<NewScholarProvider>();
    final success = await provider.submitApplication(_data);

    if (!mounted) return;

    if (success) {
      final successMessage =
          provider.successMessage ??
          'Profile details saved successfully. Scholarship program selection is temporarily unavailable.';
      final isProfileOnly = successMessage.toLowerCase().contains(
        'profile details saved successfully',
      );
      Navigator.pushReplacementNamed(
        context,
        '/success',
        arguments: {
          'appBarTitle': isProfileOnly
              ? 'Profile Details Saved'
              : 'Application Submitted',
          'title': isProfileOnly
              ? 'Profile Details Saved Successfully!'
              : 'Application Submitted Successfully!',
          'message': successMessage,
        },
      );
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          provider.submissionError ?? 'Failed to submit application.',
        ),
      ),
    );
  }

  String? _validateCurrentForm() {
    String? validatePersonalAndContact() {
      final requiredFields = <String, String>{
        'Last name': _data.lastName,
        'First name': _data.firstName,
        'Age': _data.age,
        'Date of birth': _data.dateOfBirth,
        'Sex': _data.sex,
        'Place of birth': _data.placeOfBirth,
        'Citizenship': _data.citizenship,
        'Civil status': _data.civilStatus,
        'Religion': _data.religion,
        'Mobile number': _data.mobileNumber,
      };

      for (final entry in requiredFields.entries) {
        if (entry.value.trim().isEmpty) {
          return '${entry.key} is required.';
        }
      }

      final birthDate = ApplicationData.parseInputDate(_data.dateOfBirth);
      if (birthDate == null || birthDate.isAfter(DateTime.now())) {
        return 'Date of birth must be a valid past date.';
      }

      final inputAge = ApplicationData.parseAgeValue(_data.age);
      final computedAge = ApplicationData.calculateAge(birthDate);
      if (inputAge == null) {
        return 'Age must be a valid number.';
      }
      if (inputAge < 0) {
        return 'Age cannot be negative.';
      }
      if (inputAge < 16) {
        return 'Age must be at least 16.';
      }
      if (computedAge == null || inputAge != computedAge) {
        return 'Age must match the selected date of birth.';
      }

      final rawMobile = _data.mobileNumber.trim();
      final normalizedMobile = ApplicationData.normalizeMobileNumber(rawMobile);
      if (normalizedMobile.isEmpty) {
        return 'Mobile number is required.';
      }
      if (!RegExp(
        r'^\+?\d+$',
      ).hasMatch(rawMobile.replaceAll(RegExp(r'[\s-]+'), ''))) {
        return 'Mobile number must contain digits only.';
      }
      if (!normalizedMobile.startsWith('09')) {
        return 'Mobile number must start with 09 or +639.';
      }
      if (normalizedMobile.length < 11) {
        return 'Mobile number is too short.';
      }
      if (normalizedMobile.length > 11) {
        return 'Mobile number is too long.';
      }

      return null;
    }

    String? validateAcademic() {
      if (_data.currentCourse.trim().isEmpty) {
        return 'Course is required.';
      }
      if (_data.currentYearLevel.trim().isEmpty) {
        return 'Year level is required.';
      }

      final yearLevel = int.tryParse(_data.currentYearLevel.trim());
      if (yearLevel == null) {
        return 'Year level must be a valid number.';
      }
      if (yearLevel < 1) {
        return 'Year level must be at least 1.';
      }
      if (yearLevel > 6) {
        return 'Year level cannot be above 6.';
      }

      if (_data.currentSection.trim().isEmpty) {
        return 'Section is required.';
      }
      if (_data.studentNumber.trim().isEmpty) {
        return 'Student number is required.';
      }
      if (_data.accountStudentId.isNotEmpty &&
          _data.studentNumber.trim() != _data.accountStudentId.trim()) {
        return 'Student number must match your logged-in account.';
      }
      if (_data.financialSupport == 'Other' &&
          _data.scholarshipOthersSpecify.trim().isEmpty) {
        return 'Please specify the other financial support.';
      }

      return null;
    }

    switch (_step) {
      case 0:
        return validatePersonalAndContact();
      case 2:
        return validateAcademic();
      case 4:
        return validatePersonalAndContact() ?? validateAcademic();
      default:
        return null;
    }
  }

  Widget _buildStep() {
    switch (_step) {
      case 0:
        return StepPersonal(
          data: _data,
          onChanged: () => setState(() {}),
          showErrors: _showValidationErrors,
        );
      case 1:
        return StepFamily(data: _data, onChanged: () => setState(() {}));
      case 2:
        return StepAcademic(
          data: _data,
          onChanged: () => setState(() {}),
          showErrors: _showValidationErrors,
        );
      case 3:
        return StepEssay(data: _data, onChanged: () => setState(() {}));
      case 4:
        return StepSubmit(
          data: _data,
          onChanged: () => setState(() {}),
          showErrors: _showValidationErrors,
        );
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NewScholarProvider>();

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.darkBrown, AppColors.brown, AppColors.gold],
            stops: [0.0, 0.6, 1.0],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Card(
                margin: const EdgeInsets.all(16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: AppColors.gold, width: 2),
                ),
                elevation: 24,
                shadowColor: Colors.black87,
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    const AppHeader(subtitle: 'Student Profile Intake Form'),
                    Expanded(
                      child: SingleChildScrollView(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          children: [
                            StepIndicator(
                              currentStep: _step,
                              labels: _stepLabels,
                            ),
                            const SizedBox(height: 24),
                            if (_isBootstrapping)
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 48),
                                child: CircularProgressIndicator(),
                              )
                            else
                              AnimatedSwitcher(
                                duration: const Duration(milliseconds: 250),
                                child: KeyedSubtree(
                                  key: ValueKey(_step),
                                  child: _buildStep(),
                                ),
                              ),
                            const SizedBox(height: 24),
                            Row(
                              children: [
                                if (_step > 0) ...[
                                  Expanded(
                                    child: GhostButton(
                                      label: 'Back',
                                      onTap: _back,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                ],
                                Expanded(
                                  flex: 2,
                                  child: _step < 4
                                      ? NavyButton(label: 'Next', onTap: _next)
                                      : provider.isLoading
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
                                          label: 'Save Profile Details',
                                          onTap: _submitApplication,
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
      ),
    );
  }
}
