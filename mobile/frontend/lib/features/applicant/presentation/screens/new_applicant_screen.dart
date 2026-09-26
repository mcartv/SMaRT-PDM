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
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/focus_invalid_field.dart';
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
  final _stepContentKey = GlobalKey();
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

    // APPLICATION FORM DATABASE PREFILL
    // Refresh the profile before applying draft/submitted-form data so Section,
    // LRN, course, and student number use the latest stored database values.
    try {
      final profile = await _profileService.fetchMyProfile();
      final databaseSection =
          (profile['section'] ?? profile['current_section'])
              ?.toString()
              .trim() ??
          '';
      final databaseLrn =
          profile['learners_reference_number']?.toString().trim() ?? '';
      final databaseCourse = profile['course_code']?.toString().trim() ?? '';
      final databaseStudentId = profile['student_id']?.toString().trim() ?? '';

      _data.currentSection = databaseSection;
      if (databaseLrn.isNotEmpty) _data.learnersReferenceNumber = databaseLrn;
      if (databaseCourse.isNotEmpty) _data.currentCourse = databaseCourse;
      if (databaseStudentId.isNotEmpty) {
        _data.accountStudentId = databaseStudentId;
        _data.studentNumber = databaseStudentId;
      }
    } catch (error) {
      debugPrint('APPLICATION FORM DATABASE PREFILL ERROR: $error');
    }

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

      final savedOpening = Map<String, dynamic>.from(
        savedFormData['opening'] as Map? ?? const {},
      );

      final savedOpeningId = _savedString(savedOpening['opening_id']).trim();

      final shouldReplaceDraft =
          widget.replaceExistingDraft &&
          initialOpeningId.isNotEmpty &&
          savedOpeningId.isNotEmpty &&
          savedOpeningId != initialOpeningId;

      // SMART_PDM_SEMESTER_PREFILL_RETAIN_V1
      // Replacing an old-semester draft must replace only its opening
      // association. Reusable applicant information is still loaded first.
      _data.applySavedForm(savedFormData);

      if (shouldReplaceDraft) {
        // applySavedForm may contain the old draft opening, so restore the
        // newly selected semester/opening after hydrating the reusable fields.
        _applyOpeningSelection(
          openingId: initialOpeningId,
          openingTitle: widget.initialOpeningTitle?.trim() ?? '',
          programName: widget.initialProgramName?.trim() ?? '',
        );

        // The first autosave below creates/replaces the draft for the new
        // opening while keeping the prefilled applicant information.
        _hasDraftLoaded = false;
      } else {
        _hasDraftLoaded =
            widget.editExistingApplication ||
            savedFormData['has_saved_form'] == true;
      }

      await _syncAccountHolderCache();
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
      section: _data.currentSection.trim(),
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

  static const String _parentGuardianMobileRequiredMessage =
      'Provide at least one parent or guardian mobile number.';

  bool _hasUsableParentGuardianMobile() {
    return <String>[
      _data.fatherMobile,
      _data.motherMobile,
      _data.guardianMobile,
    ].any((value) {
      final normalized = value.trim();
      return normalized.isNotEmpty && normalized.toUpperCase() != 'N/A';
    });
  }

  List<String> _parentGuardianMobileSnapshot() => <String>[
    _data.fatherMobile,
    _data.motherMobile,
    _data.guardianMobile,
  ];

  void _fillBlankParentGuardianMobilesWithNA() {
    if (_data.fatherMobile.trim().isEmpty) _data.fatherMobile = 'N/A';
    if (_data.motherMobile.trim().isEmpty) _data.motherMobile = 'N/A';
    if (_data.guardianMobile.trim().isEmpty) _data.guardianMobile = 'N/A';
  }

  void _restoreParentGuardianMobiles(List<String> snapshot) {
    _data.fatherMobile = snapshot[0];
    _data.motherMobile = snapshot[1];
    _data.guardianMobile = snapshot[2];
  }

  String? _validateFamilyWithOptionalMobiles() {
    if (!_hasUsableParentGuardianMobile()) {
      return _parentGuardianMobileRequiredMessage;
    }

    final snapshot = _parentGuardianMobileSnapshot();
    _fillBlankParentGuardianMobilesWithNA();
    try {
      return _submissionValidator.validateFamilyProgression(_data).firstMessage;
    } finally {
      _restoreParentGuardianMobiles(snapshot);
    }
  }

  ApplicationSubmissionValidationResult
  _validateSubmissionWithOptionalFamilyMobiles() {
    if (!_hasUsableParentGuardianMobile()) {
      return const ApplicationSubmissionValidationResult([
        ApplicationSubmissionIssue(
          code: 'family.mobile.contact.required',
          section: ApplicationSubmissionSection.family,
          field: 'familyMobileContact',
          message: _parentGuardianMobileRequiredMessage,
          repairAction: 'Enter one valid parent or guardian mobile number.',
        ),
      ]);
    }

    final snapshot = _parentGuardianMobileSnapshot();
    _fillBlankParentGuardianMobilesWithNA();
    try {
      return _submissionValidator.validateSubmissionPreflight(_data);
    } finally {
      _restoreParentGuardianMobiles(snapshot);
    }
  }

  void _next() {
    final validationError = _validateCurrentForm();
    if (validationError != null) {
      setState(() {
        _showValidationErrors = true;
        _formFeedbackError = validationError;
      });
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(validationError),
            behavior: SnackBarBehavior.floating,
          ),
        );
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final stepContext = _stepContentKey.currentContext;
        if (stepContext == null || !focusFirstInvalidField(stepContext)) {
          _scrollToFormTop();
        }
      });
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

  // SMART_PDM_APPLICATION_FORM_PRE_SUBMIT_CONFIRMATION_V1
  Future<bool> _confirmUpdatedApplicationSubmission() async {
    if (!mounted) return false;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        final theme = Theme.of(dialogContext);
        final surfaceColor = AppSurfacePalette.surface(dialogContext);
        final titleColor = AppSurfacePalette.text(dialogContext);
        final bodyColor = AppSurfacePalette.mutedText(dialogContext);
        final borderColor = AppSurfacePalette.outline(dialogContext);

        Widget reviewPoint(String text) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 22,
                  height: 22,
                  margin: const EdgeInsets.only(top: 1),
                  decoration: BoxDecoration(
                    color: AppColors.gold.withOpacity(0.14),
                    borderRadius: BorderRadius.all(
                      Radius.circular(AppRadii.sm),
                    ),
                  ),
                  child: Icon(
                    Icons.check_rounded,
                    size: 15,
                    color: AppColors.gold,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    text,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: bodyColor,
                      height: 1.4,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          );
        }

        final backButton = OutlinedButton.icon(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          icon: const Icon(Icons.arrow_back_rounded, size: 18),
          label: const Text('Back to Edit'),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 52),
            foregroundColor: titleColor,
            side: BorderSide(color: borderColor),
            shape: RoundedRectangleBorder(borderRadius: AppRadii.control),
            textStyle: const TextStyle(fontWeight: FontWeight.w800),
          ),
        );

        final submitButton = FilledButton.icon(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          icon: const Icon(Icons.verified_outlined, size: 18),
          label: const Text('Submit for Verification'),
          style: FilledButton.styleFrom(
            minimumSize: const Size(0, 52),
            backgroundColor: AppColors.gold,
            foregroundColor: const Color(0xFF3D2A1D),
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: AppRadii.control),
            textStyle: const TextStyle(fontWeight: FontWeight.w900),
          ),
        );

        return Dialog(
          elevation: 0,
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 20,
            vertical: 24,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Container(
              decoration: BoxDecoration(
                color: surfaceColor,
                borderRadius: AppRadii.card,
                border: Border.all(color: borderColor),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x18000000),
                    blurRadius: 24,
                    offset: Offset(0, 10),
                  ),
                ],
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: AppColors.gold.withOpacity(0.14),
                            borderRadius: AppRadii.control,
                          ),
                          child: Icon(
                            Icons.fact_check_outlined,
                            color: AppColors.gold,
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Review before submitting',
                                style: theme.textTheme.titleMedium?.copyWith(
                                  color: titleColor,
                                  fontWeight: FontWeight.w900,
                                  height: 1.2,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'You are about to submit your updated '
                                'Application Form for verification.',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: bodyColor,
                                  height: 1.35,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
                      decoration: BoxDecoration(
                        color: AppSurfacePalette.surfaceMuted(dialogContext),
                        borderRadius: AppRadii.card,
                        border: Border.all(
                          color: AppColors.gold.withOpacity(0.25),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Before you continue',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: titleColor,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 10),
                          reviewPoint(
                            'Triple-check your personal, family, academic, '
                            'and essay information.',
                          ),
                          reviewPoint(
                            'Make sure names, dates, contact details, and '
                            'other important information are complete and correct.',
                          ),
                          reviewPoint(
                            'After submission, Edit Form will be temporarily '
                            'disabled while OSFA/Admin verifies your update.',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'If another correction is required, you will receive '
                      'a notification and Edit Form will become available again.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: bodyColor,
                        height: 1.4,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 18),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final stackButtons = constraints.maxWidth < 330;

                        if (stackButtons) {
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              backButton,
                              const SizedBox(height: 10),
                              submitButton,
                            ],
                          );
                        }

                        return Row(
                          children: [
                            Expanded(child: backButton),
                            const SizedBox(width: 10),
                            Expanded(child: submitButton),
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );

    return confirmed == true;
  }

  Future<void> _submitApplication() async {
    if (!_hasSelectedOpening) {
      setState(() {
        _formFeedbackError = 'Choose a scholarship before submitting.';
      });
      return;
    }

    final validationResult = _validateSubmissionWithOptionalFamilyMobiles();
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

    if (widget.editExistingApplication) {
      final shouldSubmitUpdatedForm =
          await _confirmUpdatedApplicationSubmission();

      if (!mounted || !shouldSubmitUpdatedForm) {
        return;
      }
    }

    // The form requires at least one reachable parent/guardian contact. Empty
    // secondary contact fields are persisted as N/A so existing backend/PDF
    // contracts remain compatible without forcing duplicate phone numbers.
    _fillBlankParentGuardianMobilesWithNA();

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
    switch (_step) {
      case 0:
        return _submissionValidator
            .validatePersonalProgression(_data)
            .firstMessage;
      case 1:
        return _validateFamilyWithOptionalMobiles();
      case 2:
        return _submissionValidator
            .validateAcademicProgression(_data)
            .firstMessage;
      case 3:
        return _submissionValidator
            .validateEssayProgression(_data)
            .firstMessage;
      case 4:
        return _validateSubmissionWithOptionalFamilyMobiles().firstMessage;
      default:
        return null;
    }
  }

  void _handleFormChanged() {
    final validationError = _showValidationErrors
        ? _validateCurrentForm()
        : null;

    setState(() {
      if (_showValidationErrors && validationError == null) {
        _showValidationErrors = false;
      }
      _formFeedbackError = validationError;
    });

    _queueAutosave();
  }

  Widget _buildStep() =>
      KeyedSubtree(key: _stepContentKey, child: _buildStepContent());

  Widget _buildStepContent() {
    switch (_step) {
      case 0:
        return StepPersonal(
          data: _data,
          onChanged: _handleFormChanged,
          showErrors: _showValidationErrors,
        );
      case 1:
        return StepFamily(
          data: _data,
          onChanged: _handleFormChanged,
          showErrors: _showValidationErrors,
        );
      case 2:
        return StepAcademic(
          data: _data,
          onRepairCourse: _repairMissingCourse,
          onChanged: _handleFormChanged,
          showErrors: _showValidationErrors,
        );
      case 3:
        return StepEssay(
          data: _data,
          onChanged: _handleFormChanged,
          showErrors: _showValidationErrors,
        );
      case 4:
        return StepSubmit(
          data: _data,
          onChanged: _handleFormChanged,
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
    final cardColor = AppSurfacePalette.surface(context);
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;

    return Scaffold(
      backgroundColor: AppSurfacePalette.background(context),
      body: ColoredBox(
        color: AppSurfacePalette.background(context),
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
                  ).textTheme.bodyLarge?.copyWith(height: 1.45),
                  bodyMedium: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(height: 1.45),
                ),
              );

              return Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: 920,
                  ),
                  child: Theme(
                    data: formTheme,
                    child: Card(
                      color: cardColor,
                      margin: EdgeInsets.zero,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.zero,
                      ),
                      elevation: 0,
                      shadowColor: Colors.transparent,
                      clipBehavior: Clip.antiAlias,
                      child: Column(
                        children: [
                          AppHeader(
                            subtitle: widget.editExistingApplication
                                ? 'Edit Application Form'
                                : 'Scholarship Application Form',
                            onBack: () => Navigator.maybePop(context),
                          ),
                          if (!_isBootstrapping && _hasSelectedOpening) ...[
                            Padding(
                              padding: EdgeInsets.fromLTRB(
                                compact ? 12 : 20,
                                2,
                                compact ? 12 : 20,
                                AppSpacing.md,
                              ),
                              child: _buildSelectedOpeningCard(context),
                            ),
                            Padding(
                              padding: EdgeInsets.fromLTRB(
                                compact ? 10 : 20,
                                0,
                                compact ? 10 : 20,
                                compact ? 8 : 12,
                              ),
                              child: StepIndicator(
                                currentStep: _step,
                                labels: _stepLabels,
                              ),
                            ),
                          ],
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
                          if (!keyboardOpen) _buildFooter(provider),
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
    final textColor = AppSurfacePalette.text(context);
    final mutedColor = AppSurfacePalette.mutedText(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppSurfacePalette.surfaceMuted(context),
        border: Border.all(color: AppSurfacePalette.outline(context)),
        borderRadius: AppRadii.card,
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
    final textColor = AppSurfacePalette.text(context);
    final mutedColor = AppSurfacePalette.mutedText(context);
    final feedback = _formFeedbackError != null
        ? _formFeedbackError!
        : widget.editExistingApplication
        ? 'Changes are saved when you submit the updated form.'
        : _isAutosaving
        ? 'Saving draft...'
        : _autosaveError == null
        ? 'Draft autosaves automatically.'
        : _autosaveError!;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: AppSurfacePalette.surfaceMuted(context),
        borderRadius: AppRadii.control,
        border: Border.all(color: AppSurfacePalette.outline(context)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.15),
              borderRadius: AppRadii.control,
            ),
            child: const Icon(
              Icons.workspace_premium_outlined,
              size: 20,
              color: AppColors.gold,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Selected scholarship',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: mutedColor,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _data.openingTitle.isNotEmpty
                      ? _data.openingTitle
                      : 'Scholarship Opening',
                  maxLines: 2,
                  overflow: TextOverflow.fade,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: textColor,
                    fontWeight: FontWeight.w900,
                    height: 1.2,
                  ),
                ),
                if (_data.openingProgramName.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    _data.openingProgramName,
                    maxLines: 1,
                    overflow: TextOverflow.fade,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: mutedColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                const SizedBox(height: 5),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      _isAutosaving ? Icons.sync_rounded : Icons.save_outlined,
                      size: 14,
                      color: _formFeedbackError != null
                          ? Theme.of(context).colorScheme.error
                          : mutedColor,
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        feedback,
                        maxLines: 2,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: _formFeedbackError != null
                              ? Theme.of(context).colorScheme.error
                              : mutedColor,
                          fontWeight: _formFeedbackError != null
                              ? FontWeight.w700
                              : FontWeight.w500,
                          height: 1.25,
                        ),
                      ),
                    ),
                  ],
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
      return 'Complete Questions';
    }

    if (_step == 3 && !_requiredStepGateComplete) {
      return 'Finish Essay';
    }

    return 'Next';
  }

  Widget _buildFooter(NewScholarProvider provider) {
    final compact = MediaQuery.sizeOf(context).width < 360;
    return Container(
      padding: EdgeInsets.fromLTRB(
        compact ? 12 : 20,
        12,
        compact ? 12 : 20,
        compact ? 12 : 18,
      ),
      decoration: BoxDecoration(
        color: AppSurfacePalette.surface(context),
        border: Border(
          top: BorderSide(color: AppSurfacePalette.outline(context)),
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
                ? NavyButton(label: _nextButtonLabel, onTap: _next)
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
                      disabledBackgroundColor: AppSurfacePalette.outline(
                        context,
                      ),
                      disabledForegroundColor: AppSurfacePalette.mutedText(
                        context,
                      ),
                      minimumSize: const Size(0, 52),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 16,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: AppRadii.control,
                      ),
                      elevation: 0,
                    ),
                    child: Text(
                      widget.editExistingApplication
                          ? 'Save Updates'
                          : 'Submit Application',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
