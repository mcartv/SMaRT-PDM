import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_academic_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_essay_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_family_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_personal_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_submit_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/domain/validation/application_submission_validator.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/providers/new_scholar_provider.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/shared_widgets.dart';

class NewApplicantScreen extends StatefulWidget {
  const NewApplicantScreen({
    super.key,
    this.initialOpeningId,
    this.initialOpeningTitle,
    this.initialProgramName,
    this.replaceExistingDraft = false,
  });

  final String? initialOpeningId;
  final String? initialOpeningTitle;
  final String? initialProgramName;
  final bool replaceExistingDraft;

  @override
  State<NewApplicantScreen> createState() => _NewApplicantScreenState();
}

class _NewApplicantScreenState extends State<NewApplicantScreen> {
  final ApplicationService _applicationService = ApplicationService();
  final SessionService _sessionService = const SessionService();
  int _step = 0;
  final _data = ApplicationData();
  final _scrollCtrl = ScrollController();
  bool _isBootstrapping = true;
  bool _showValidationErrors = false;
  Timer? _autosaveDebounce;
  bool _isAutosaving = false;
  bool _hasDraftLoaded = false;
  String? _autosaveError;
  final ApplicationSubmissionValidator _submissionValidator =
      const ApplicationSubmissionValidator();

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

  void _applyOpeningSelection({
    required String openingId,
    required String openingTitle,
    required String programName,
  }) {
    _data.applyOpeningSelection(
      openingId: openingId,
      openingTitle: openingTitle,
      programName: programName,
    );
  }

  bool get _hasSelectedOpening => _data.openingId.trim().isNotEmpty;

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

    if ((widget.initialOpeningId ?? '').trim().isNotEmpty) {
      _applyOpeningSelection(
        openingId: widget.initialOpeningId!.trim(),
        openingTitle: widget.initialOpeningTitle?.trim() ?? '',
        programName: widget.initialProgramName?.trim() ?? '',
      );
    }

    try {
      final savedFormData = await _applicationService.fetchMySavedFormData();
      debugPrint('APPLICATION FORM PREFILL RESPONSE: $savedFormData');

      final savedOpening = Map<String, dynamic>.from(
        savedFormData['opening'] as Map? ?? const {},
      );

      final savedOpeningId = _savedString(savedOpening['opening_id']).trim();

      final shouldReplaceDraft =
          widget.replaceExistingDraft &&
          (widget.initialOpeningId ?? '').trim().isNotEmpty &&
          savedOpeningId.isNotEmpty &&
          savedOpeningId != (widget.initialOpeningId ?? '').trim();

      if (!shouldReplaceDraft) {
        _data.applySavedForm(savedFormData);
        _hasDraftLoaded = savedFormData['has_saved_form'] == true;
        await _syncAccountHolderCache();
      }
    } catch (_) {
      // If the backend has no saved form yet, keep the local bootstrap values.
    }

    if (!mounted) return;
    setState(() => _isBootstrapping = false);

    if (_hasSelectedOpening && !_hasDraftLoaded) {
      _queueAutosave(immediate: true);
    }
  }

  String _savedString(dynamic value) => value?.toString() ?? '';

  void _queueAutosave({bool immediate = false}) {
    if (_isBootstrapping || !_hasSelectedOpening) {
      return;
    }

    _autosaveDebounce?.cancel();
    final delay = immediate ? Duration.zero : const Duration(milliseconds: 600);
    _autosaveDebounce = Timer(delay, _saveDraft);
  }

  Future<void> _saveDraft() async {
    if (_isBootstrapping || !_hasSelectedOpening) {
      return;
    }

    if (mounted) {
      setState(() {
        _isAutosaving = true;
        _autosaveError = null;
      });
    }

    try {
      await _applicationService.saveMySavedFormData(_data);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _autosaveError = error
            .toString()
            .replaceFirst('Exception: ', '')
            .trim();
      });
    } finally {
      if (mounted) {
        setState(() => _isAutosaving = false);
      }
    }
  }

  Future<void> _syncAccountHolderCache() async {
    await _sessionService.saveProfileCache(
      firstName: ApplicationData.toTitleCase(_data.firstName),
      lastName: ApplicationData.toTitleCase(_data.lastName),
      email: ApplicationData.normalizeEmail(_data.email),
      studentId: _data.accountStudentId.trim(),
      course: _data.currentCourse.trim(),
      phone: ApplicationData.normalizeMobileNumber(_data.mobileNumber),
    );
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
      _queueAutosave();
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
      _queueAutosave();
      _scrollCtrl.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _submitApplication() async {
    if (!_hasSelectedOpening) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Choose a scholarship opening before submitting.'),
        ),
      );
      return;
    }

    final validationResult =
        _submissionValidator.validateSubmissionPreflight(_data);
    if (!validationResult.isValid) {
      setState(() => _showValidationErrors = true);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(
        SnackBar(content: Text(validationResult.firstMessage ?? 'Review the form before submitting.')),
      );
      return;
    }

    final submissionPayload = _data.toSubmissionPayload();
    final provider = context.read<NewScholarProvider>();
    final success = await provider.submitApplication(
      _data,
      openingId: _data.openingId,
    );

    if (!mounted) return;

    if (success) {
      _autosaveDebounce?.cancel();
      await _syncAccountHolderCache();
      if (!mounted) return;

      final successMessage =
          provider.successMessage ?? 'Application submitted successfully.';
      final application =
          provider.lastSubmissionResponse?['application']
              as Map<String, dynamic>?;
      final openingTitle = _data.openingTitle.isNotEmpty
          ? _data.openingTitle
          : application?['opening_title']?.toString();
      final programName = _data.openingProgramName.isNotEmpty
          ? _data.openingProgramName
          : application?['program_name']?.toString();
      final applicationId =
          application?['application_id']?.toString() ??
          provider.lastSubmissionResponse?['application_id']?.toString() ??
          '';

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(successMessage)));

      provider.resetApplication();

      Navigator.pushReplacementNamed(
        context,
        AppRoutes.success,
        arguments: {
          'applicationId': applicationId,
          'openingId': _data.openingId,
          'openingTitle': openingTitle,
          'programName': programName,
          'submissionPayload': submissionPayload,
          'canUploadRequirements': true,
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

      final address = [
        _data.unitBldgNo,
        _data.houseLotBlockNo,
        _data.street,
        _data.subdivision,
        _data.barangay,
        _data.city,
        _data.province,
        _data.zipCode,
      ].any((value) => value.trim().isNotEmpty);
      if (!address) {
        return 'Address is required.';
      }

      final email = _data.email.trim();
      if (email.isEmpty) {
        return 'Email address is required.';
      }
      final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
      if (!emailRegex.hasMatch(email)) {
        return 'Please enter a valid email address.';
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
      if (yearLevel < 1 || yearLevel > 4) {
        return 'Year level must be 1, 2, 3, or 4.';
      }

      if (_data.studentNumber.trim().isEmpty) {
        return 'Student number is required.';
      }
      if (_data.accountStudentId.isNotEmpty &&
          _data.studentNumber.trim() != _data.accountStudentId.trim()) {
        return 'Student number must match your logged-in account.';
      }
      if (_data.financialSupport.trim().isEmpty) {
        return 'Financial support is required.';
      }
      if (_data.financialSupport == 'Other' &&
          _data.scholarshipOthersSpecify.trim().isEmpty) {
        return 'Please specify the other financial support.';
      }
      if (_data.disciplinaryAction &&
          _data.disciplinaryExplanation.trim().isEmpty) {
        return 'Please explain the disciplinary action.';
      }

      return null;
    }

    String? validateEssay() {
      return _submissionValidator
          .validateEssayProgression(_data)
          .firstMessage;
    }

    String? validateFamily() {
      final hasNamedFather =
          _data.fatherPresent &&
          (_data.fatherFirstName.trim().isNotEmpty ||
              _data.fatherLastName.trim().isNotEmpty);
      final hasNamedMother =
          _data.motherPresent &&
          (_data.motherFirstName.trim().isNotEmpty ||
              _data.motherLastName.trim().isNotEmpty);
      final hasNamedGuardian =
          _data.guardianFirstName.trim().isNotEmpty ||
          _data.guardianLastName.trim().isNotEmpty;

      if (!hasNamedFather && !hasNamedMother && !hasNamedGuardian) {
        return 'Add at least one parent or guardian.';
      }

      if (_data.guardianOnly && !hasNamedGuardian) {
        return 'Guardian name is required.';
      }

      return null;
    }

    switch (_step) {
      case 0:
        return validatePersonalAndContact();
      case 1:
        return validateFamily();
      case 2:
        return validateAcademic();
      case 3:
        return validateEssay();
      case 4:
        return _submissionValidator.validateSubmissionPreflight(_data).firstMessage;
      default:
        return null;
    }
  }

  Widget _buildStep() {
    switch (_step) {
      case 0:
        return StepPersonal(
          data: _data,
          onChanged: () {
            setState(() {});
            _queueAutosave();
          },
          showErrors: _showValidationErrors,
        );
      case 1:
        return StepFamily(
          data: _data,
          onChanged: () {
            setState(() {});
            _queueAutosave();
          },
        );
      case 2:
        return StepAcademic(
          data: _data,
          onChanged: () {
            setState(() {});
            _queueAutosave();
          },
          showErrors: _showValidationErrors,
        );
      case 3:
        return StepEssay(
          data: _data,
          onChanged: () {
            setState(() {});
            _queueAutosave();
          },
          showErrors: _showValidationErrors,
        );
      case 4:
        return StepSubmit(
          data: _data,
          onChanged: () {
            setState(() {});
            _queueAutosave();
          },
          onEditStep: (step) {
            setState(() => _step = step);
            _queueAutosave();
            _scrollCtrl.animateTo(
              0,
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOut,
            );
          },
          showErrors: _showValidationErrors,
        );
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  void dispose() {
    _autosaveDebounce?.cancel();
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NewScholarProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFFF7F1E8),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFFBF5EA), Color(0xFFF7F1E5), Color(0xFFFDFCF8)],
            stops: [0.0, 0.55, 1.0],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Card(
                margin: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(28),
                  side: const BorderSide(color: Color(0xFFF0D59A), width: 1.2),
                ),
                elevation: 10,
                shadowColor: Colors.black26,
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    AppHeader(
                      subtitle: 'Student Profile Intake Form',
                      onBack: () => Navigator.maybePop(context),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
                      child: StepIndicator(
                        currentStep: _step,
                        labels: _stepLabels,
                      ),
                    ),
                    Expanded(
                      child: SingleChildScrollView(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                        child: Column(
                          children: [
                            if (_isBootstrapping)
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 72),
                                child: CircularProgressIndicator(),
                              )
                            else if (!_hasSelectedOpening)
                              _buildOpeningReminder(context)
                            else
                              Column(
                                children: [
                                  _buildSelectedOpeningCard(context),
                                  AnimatedSwitcher(
                                    duration: const Duration(milliseconds: 220),
                                    child: KeyedSubtree(
                                      key: ValueKey(_step),
                                      child: _buildStep(),
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
                    ),
                    _buildFooter(provider),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOpeningReminder(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFF0D59A), width: 1.2),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Choose an opening first',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              color: AppColors.darkBrown,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'This application form is tied to one scholarship opening. Select the opening you want to apply for before continuing.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              height: 1.45,
              color: AppColors.brown,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: GoldButton(
              label: 'View Scholarship Openings',
              onTap: () => Navigator.pushReplacementNamed(
                context,
                AppRoutes.scholarshipOpenings,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSelectedOpeningCard(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF0D59A), width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1C9),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'Selected Opening',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.brown,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _data.openingTitle.isNotEmpty
                ? _data.openingTitle
                : 'Scholarship Opening',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: AppColors.darkBrown,
              height: 1.15,
            ),
          ),
          if (_data.openingProgramName.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              _data.openingProgramName,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.brown,
              ),
            ),
          ],
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF9EE),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                Icon(
                  _isAutosaving ? Icons.sync : Icons.save_outlined,
                  size: 18,
                  color: AppColors.brown,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _isAutosaving
                        ? 'Saving draft...'
                        : _autosaveError == null
                        ? 'Draft autosaves as you complete the form.'
                        : _autosaveError!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.brown,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFooter(NewScholarProvider provider) {
    final submissionReady =
        _submissionValidator.validateSubmissionPreflight(_data).isValid;
    final submitEnabled =
        _hasSelectedOpening && submissionReady && !provider.isLoading;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 18),
      decoration: const BoxDecoration(
        color: Color(0xFFFDFCF8),
        border: Border(top: BorderSide(color: Color(0xFFE9DED2))),
      ),
      child: Row(
        children: [
          if (_step > 0) ...[
            Expanded(
              child: GhostButton(label: 'Back', onTap: _back),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            flex: 2,
            child: !_hasSelectedOpening
                ? const SizedBox.shrink()
                : _step < 4
                ? NavyButton(label: 'Next', onTap: _next)
                : provider.isLoading
                ? const Center(
                    child: SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : ElevatedButton(
                    onPressed: submitEnabled ? _submitApplication : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.gold,
                      foregroundColor: AppColors.darkBrown,
                      disabledBackgroundColor: const Color(0xFFF0D8A0),
                      disabledForegroundColor: AppColors.darkBrown
                          .withValues(alpha: 0.6),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(28),
                      ),
                      elevation: 0,
                    ),
                    child: Text(
                      'Submit Application',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
