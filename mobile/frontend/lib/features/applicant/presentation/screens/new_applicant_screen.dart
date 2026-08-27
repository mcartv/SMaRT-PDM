import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/profile/data/services/profile_service.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_academic_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_essay_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_family_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_personal_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_submit_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/intake_form_ui.dart';
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
    this.editExistingApplication = false,
  });

  final String? initialOpeningId;
  final String? initialOpeningTitle;
  final String? initialProgramName;
  final bool replaceExistingDraft;
  final bool editExistingApplication;

  @override
  State<NewApplicantScreen> createState() => _NewApplicantScreenState();
}

class _NewApplicantScreenState extends State<NewApplicantScreen> {
  final ApplicationService _applicationService = ApplicationService();
  final ProfileService _profileService = ProfileService();
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
  String? _formFeedbackError;
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

    /*
   * An opening passed through navigation takes priority initially.
   */
    final initialOpeningId = widget.initialOpeningId?.trim() ?? '';

    if (initialOpeningId.isNotEmpty) {
      _applyOpeningSelection(
        openingId: initialOpeningId,
        openingTitle: widget.initialOpeningTitle?.trim() ?? '',
        programName: widget.initialProgramName?.trim() ?? '',
      );
    }

    try {
      final savedFormData = widget.editExistingApplication
          ? Map<String, dynamic>.from(
              (await _applicationService
                          .fetchMySubmittedApplicationForm())['form_data']
                      as Map? ??
                  const {},
            )
          : await _applicationService.fetchMySavedFormData();

      debugPrint('APPLICATION FORM PREFILL RESPONSE: $savedFormData');

      final savedOpening = Map<String, dynamic>.from(
        savedFormData['opening'] as Map? ?? const {},
      );

      final savedOpeningId = _savedString(savedOpening['opening_id']).trim();

      final shouldReplaceDraft =
          widget.replaceExistingDraft &&
          initialOpeningId.isNotEmpty &&
          savedOpeningId.isNotEmpty &&
          savedOpeningId != initialOpeningId;

      if (!shouldReplaceDraft) {
        _data.applySavedForm(savedFormData);

        _hasDraftLoaded =
            widget.editExistingApplication ||
            savedFormData['has_saved_form'] == true;

        await _syncAccountHolderCache();
      }
    } catch (error) {
      debugPrint('APPLICATION FORM PREFILL ERROR: $error');
    }

    /*
   * Submitted applications no longer have an application-form draft
   * because the backend deletes the draft after submission.
   *
   * When the saved form response does not contain an opening, retrieve
   * the opening from the applicant's current submitted application.
   */
    if (!_hasSelectedOpening) {
      try {
        final statusSummary = await _applicationService
            .fetchMyApplicationStatusSummary();

        final submittedOpeningId = statusSummary.openingId?.trim() ?? '';

        if (statusSummary.hasApplication && submittedOpeningId.isNotEmpty) {
          _applyOpeningSelection(
            openingId: submittedOpeningId,
            openingTitle: statusSummary.openingTitle?.trim() ?? '',
            programName: statusSummary.programName?.trim() ?? '',
          );

          /*
         * Treat the submitted application as existing saved form data.
         * The form fields were reconstructed by the form-data endpoint,
         * while the opening came from the application status endpoint.
         */
          _hasDraftLoaded = true;

          debugPrint(
            'APPLICATION FORM OPENING RESTORED: '
            '$submittedOpeningId',
          );
        }
      } catch (error) {
        debugPrint('APPLICATION STATUS OPENING FALLBACK ERROR: $error');
      }
    }

    if (!mounted) {
      return;
    }

    setState(() {
      _isBootstrapping = false;
    });

    /*
   * When a new opening was selected and no previous application or draft
   * exists, immediately create the first autosave.
   */
    if (_hasSelectedOpening && !_hasDraftLoaded) {
      _queueAutosave(immediate: true);
    }
  }

  String _savedString(dynamic value) => value?.toString() ?? '';

  void _queueAutosave({bool immediate = false}) {
    if (_isBootstrapping ||
        !_hasSelectedOpening ||
        widget.editExistingApplication) {
      return;
    }

    _autosaveDebounce?.cancel();
    final delay = immediate ? Duration.zero : const Duration(milliseconds: 600);
    _autosaveDebounce = Timer(delay, _saveDraft);
  }

  Future<void> _saveDraft() async {
    if (_isBootstrapping ||
        !_hasSelectedOpening ||
        widget.editExistingApplication) {
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

  void _scrollToFormTop() {
    FocusScope.of(context).unfocus();
    if (!_scrollCtrl.hasClients) return;
    _scrollCtrl.animateTo(
      0,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  int _stepForSection(ApplicationSubmissionSection section) {
    switch (section) {
      case ApplicationSubmissionSection.personal:
      case ApplicationSubmissionSection.account:
        return 0;
      case ApplicationSubmissionSection.family:
        return 1;
      case ApplicationSubmissionSection.academic:
        return 2;
      case ApplicationSubmissionSection.essay:
        return 3;
      case ApplicationSubmissionSection.certification:
        return 4;
    }
  }

  Future<void> _repairMissingCourse() async {
    await _saveDraft();
    if (!mounted) return;

    await Navigator.pushNamed(context, AppRoutes.profile);
    if (!mounted) return;

    try {
      final profile = await _profileService.fetchMyProfile();
      if (!mounted) return;

      final refreshedCourse = (profile['course_code']?.toString() ?? '').trim();
      setState(() {
        _data.currentCourse = refreshedCourse;
      });

      if (refreshedCourse.isNotEmpty) {
        _queueAutosave(immediate: true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Course updated from your profile.')),
        );
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Course is still missing. Update your profile to continue.',
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to refresh your course: $error')),
      );
    }
  }

  void _next() {
    final validationError = _validateCurrentForm();
    if (validationError != null) {
      setState(() {
        _showValidationErrors = true;
        _formFeedbackError = validationError;
      });
      _scrollToFormTop();
      return;
    }

    if (_step < 4) {
      setState(() {
        _step++;
        _showValidationErrors = false;
        _formFeedbackError = null;
      });
      _queueAutosave();
      _scrollToFormTop();
    }
  }

  void _back() {
    if (_step > 0) {
      setState(() {
        _step--;
        _showValidationErrors = false;
        _formFeedbackError = null;
      });
      _queueAutosave();
      _scrollToFormTop();
    }
  }

  Future<void> _submitApplication() async {
    if (!_hasSelectedOpening) {
      setState(() {
        _formFeedbackError = 'Choose a scholarship before submitting.';
      });
      return;
    }

    final validationResult = _submissionValidator.validateSubmissionPreflight(
      _data,
    );
    if (!validationResult.isValid) {
      final firstIssue = validationResult.issues.first;
      setState(() {
        _step = _stepForSection(firstIssue.section);
        _showValidationErrors = true;
        _formFeedbackError = firstIssue.message;
      });
      _scrollToFormTop();
      return;
    }

    setState(() {
      _formFeedbackError = null;
    });

    final submissionPayload = _data.toSubmissionPayload();
    final provider = context.read<NewScholarProvider>();
    final success = await provider.submitApplication(
      _data,
      openingId: _data.openingId,
      editExistingApplication: widget.editExistingApplication,
    );

    if (!mounted) return;

    if (success) {
      _autosaveDebounce?.cancel();
      await _syncAccountHolderCache();
      if (!mounted) return;

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

      provider.resetApplication();

      if (widget.editExistingApplication) {
        // SMART_PDM_MOBILE_APPLICATION_FORM_CORRECTION_NOTIFICATION_V2
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (dialogContext) {
            return AlertDialog(
              title: const Text('Application Form Submitted for Verification'),
              content: const Text(
                'Your updated Application Form has been submitted for verification. '
                'Please make sure all important information you entered is complete and correct. '
                'Wait for the next verification update from OSFA/Admin before making further changes. '
                'You will receive a notification if another correction is required or when the review status changes.',
              ),
              actions: [
                FilledButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Got it'),
                ),
              ],
            );
          },
        );

        if (!mounted) return;
        Navigator.of(context).pop(true);
        return;
      }

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

    setState(() {
      _formFeedbackError =
          provider.submissionError ?? 'Failed to submit application.';
    });
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

      final hasStreetAddress =
          _data.unitBldgNo.trim().isNotEmpty ||
          _data.houseLotBlockNo.trim().isNotEmpty ||
          _data.street.trim().isNotEmpty ||
          _data.subdivision.trim().isNotEmpty;
      if (!hasStreetAddress) {
        return 'House, building, street, or subdivision is required.';
      }
      if (_data.barangay.trim().isEmpty) return 'Barangay is required.';
      if (_data.city.trim().isEmpty) return 'City is required.';
      if (_data.province.trim().isEmpty) return 'Province is required.';
      if (_data.zipCode.trim().isEmpty) return 'ZIP code is required.';

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
      return _submissionValidator
          .validateAcademicProgression(_data)
          .firstMessage;
    }

    String? validateEssay() {
      return _submissionValidator.validateEssayProgression(_data).firstMessage;
    }

    String? validateFamily() {
      final hasNamedFather =
          _data.fatherPresent &&
          _data.fatherFirstName.trim().isNotEmpty &&
          _data.fatherLastName.trim().isNotEmpty;
      final hasNamedMother =
          _data.motherPresent &&
          _data.motherFirstName.trim().isNotEmpty &&
          _data.motherLastName.trim().isNotEmpty;
      final hasNamedGuardian =
          _data.guardianFirstName.trim().isNotEmpty &&
          _data.guardianLastName.trim().isNotEmpty;

      if (!hasNamedFather && !hasNamedMother && !hasNamedGuardian) {
        return 'Enter the complete name of at least one parent or guardian.';
      }

      if (_data.guardianOnly && !hasNamedGuardian) {
        return 'Guardian name is required.';
      }
      if (!_data.guardianOnly) {
        if (_data.parentNativeStatus == 'No') {
          if (_data.parentPreviousTownMunicipality.trim().isEmpty) {
            return 'Town or municipality is required.';
          }

          if (_data.parentPreviousProvince.trim().isEmpty) {
            return 'Province is required.';
          }
        } else {
          final residencyDuration = _data.parentMarilaoResidencyDuration.trim();

          if (residencyDuration.isEmpty) {
            return 'Marilao residency duration is required.';
          }

          if (!RegExp(r'^\d+$').hasMatch(residencyDuration)) {
            return 'Enter the number of years as a Marilao resident using digits only.';
          }
        }
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
        return _submissionValidator
            .validateSubmissionPreflight(_data)
            .firstMessage;
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
          showErrors: _showValidationErrors,
        );
      case 2:
        return StepAcademic(
          data: _data,
          onRepairCourse: _repairMissingCourse,
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
            setState(() {
              _step = step;
              _showValidationErrors = false;
            });
            _queueAutosave();
            _scrollToFormTop();
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark
        ? AppColors.applicantDarkSurface
        : const Color(0xFFFDFCF8);
    final borderColor = isDark
        ? AppColors.applicantDarkOutline
        : const Color(0xFFF0D59A);

    return Scaffold(
      backgroundColor: isDark
          ? AppColors.applicantDarkBackground
          : const Color(0xFFF7F1E8),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: isDark
                ? const [
                    AppColors.applicantDarkBackground,
                    Color(0xFF24180F),
                    AppColors.applicantDarkBackground,
                  ]
                : const [
                    Color(0xFFFBF5EA),
                    Color(0xFFF7F1E5),
                    Color(0xFFFDFCF8),
                  ],
            stops: const [0.0, 0.55, 1.0],
          ),
        ),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;
              final compact = IntakeLayout.isCompact(width);
              final gutter = IntakeLayout.horizontalPadding(width);
              final formTheme = Theme.of(context).copyWith(
                textTheme: Theme.of(context).textTheme.copyWith(
                  bodyLarge: Theme.of(
                    context,
                  ).textTheme.bodyLarge?.copyWith(fontSize: 16, height: 1.45),
                  bodyMedium: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontSize: 15, height: 1.45),
                  labelLarge: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(fontSize: 15),
                ),
              );

              return Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: IntakeLayout.contentMaxWidth,
                  ),
                  child: Theme(
                    data: formTheme,
                    child: Card(
                      color: cardColor,
                      margin: EdgeInsets.fromLTRB(
                        gutter,
                        0,
                        gutter,
                        compact ? 6 : 12,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(compact ? 22 : 28),
                        side: BorderSide(color: borderColor, width: 1.2),
                      ),
                      elevation: isDark ? 2 : 10,
                      shadowColor: Colors.black.withValues(
                        alpha: isDark ? 0.28 : 0.26,
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: Column(
                        children: [
                          AppHeader(
                            subtitle: widget.editExistingApplication
                                ? 'Edit Application Form'
                                : 'Scholarship Application Form',
                            onBack: () => Navigator.maybePop(context),
                          ),
                          Padding(
                            padding: EdgeInsets.fromLTRB(
                              compact ? 10 : 20,
                              4,
                              compact ? 10 : 20,
                              compact ? 8 : 12,
                            ),
                            child: StepIndicator(
                              currentStep: _step,
                              labels: _stepLabels,
                            ),
                          ),
                          Expanded(
                            child: SingleChildScrollView(
                              controller: _scrollCtrl,
                              padding: EdgeInsets.fromLTRB(
                                compact ? 12 : 20,
                                compact ? 6 : 12,
                                compact ? 12 : 20,
                                24,
                              ),
                              child: Column(
                                children: [
                                  if (_isBootstrapping)
                                    const Padding(
                                      padding: EdgeInsets.symmetric(
                                        vertical: 72,
                                      ),
                                      child: CircularProgressIndicator(),
                                    )
                                  else if (!_hasSelectedOpening)
                                    _buildOpeningReminder(context)
                                  else
                                    Column(
                                      children: [
                                        _buildSelectedOpeningCard(context),
                                        AnimatedSwitcher(
                                          duration: const Duration(
                                            milliseconds: 220,
                                          ),
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
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildOpeningReminder(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;
    final mutedColor = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.brown;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.applicantDarkSurfaceMuted : Colors.white,
        border: Border.all(
          color: isDark
              ? AppColors.applicantDarkOutline
              : const Color(0xFFF0D59A),
          width: 1.2,
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Choose an opening first',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              color: textColor,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'This application form is tied to one scholarship opening. Select the opening you want to apply for before continuing.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(height: 1.45, color: mutedColor),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;
    final mutedColor = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.brown;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? AppColors.applicantDarkSurfaceMuted : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark
              ? AppColors.applicantDarkOutline
              : const Color(0xFFF0D59A),
          width: 1.2,
        ),
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
                  color: isDark
                      ? AppColors.applicantDarkSurface
                      : const Color(0xFFFFF1C9),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'Selected Opening',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: mutedColor,
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
              color: textColor,
              height: 1.15,
            ),
          ),
          if (_data.openingProgramName.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              _data.openingProgramName,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: mutedColor,
              ),
            ),
          ],
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.applicantDarkSurface
                  : const Color(0xFFFFF9EE),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                Icon(
                  _isAutosaving ? Icons.sync : Icons.save_outlined,
                  size: 18,
                  color: mutedColor,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _formFeedbackError != null
                        ? _formFeedbackError!
                        : widget.editExistingApplication
                        ? 'Changes are saved only when you tap Save Updated Application.'
                        : _isAutosaving
                        ? 'Saving draft...'
                        : _autosaveError == null
                        ? 'Draft autosaves as you complete the form.'
                        : _autosaveError!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: _formFeedbackError != null
                          ? Theme.of(context).colorScheme.error
                          : mutedColor,
                      fontWeight: _formFeedbackError != null
                          ? FontWeight.w700
                          : FontWeight.w400,
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

  bool get _requiredStepGateComplete {
    if (_step == 2) {
      return _data.scholarshipHistoryAnswered &&
          _data.disciplinaryActionAnswered;
    }

    if (_step == 3) {
      return _data.describeYourselfEssay.trim().isNotEmpty &&
          _data.aimsAndAmbitionEssay.trim().isNotEmpty;
    }

    return true;
  }

  String get _nextButtonLabel {
    if (_step == 2 && !_requiredStepGateComplete) {
      return 'Answer Required Questions';
    }

    if (_step == 3 && !_requiredStepGateComplete) {
      return 'Complete Personal Statement';
    }

    return 'Next';
  }

  Widget _buildFooter(NewScholarProvider provider) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final compact = MediaQuery.sizeOf(context).width < 360;
    return Container(
      padding: EdgeInsets.fromLTRB(
        compact ? 12 : 20,
        12,
        compact ? 12 : 20,
        compact ? 12 : 18,
      ),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.applicantDarkSurface
            : const Color(0xFFFDFCF8),
        border: Border(
          top: BorderSide(
            color: isDark
                ? AppColors.applicantDarkOutline
                : const Color(0xFFE9DED2),
          ),
        ),
      ),
      child: Row(
        children: [
          if (_step > 0) ...[
            Expanded(
              child: GhostButton(label: 'Back', onTap: _back),
            ),
            SizedBox(width: compact ? 8 : 12),
          ],
          Expanded(
            flex: 2,
            child: !_hasSelectedOpening
                ? const SizedBox.shrink()
                : _step < 4
                ? NavyButton(
                    label: _nextButtonLabel,
                    onTap: _requiredStepGateComplete ? _next : null,
                  )
                : provider.isLoading
                ? const Center(
                    child: SizedBox(
                      height: 24,
                      width: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : ElevatedButton(
                    onPressed: _hasSelectedOpening ? _submitApplication : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.gold,
                      foregroundColor: AppColors.darkBrown,
                      disabledBackgroundColor: const Color(0xFFF0D8A0),
                      disabledForegroundColor: AppColors.darkBrown.withValues(
                        alpha: 0.6,
                      ),
                      minimumSize: const Size(0, 56),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 16,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(28),
                      ),
                      elevation: 0,
                    ),
                    child: Text(
                      widget.editExistingApplication
                          ? 'Save Updated Application'
                          : 'Submit Application',
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
