import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_academic.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_essay.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_family.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_personal.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_submit.dart';
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
      if (savedFormData['has_saved_form'] == true) {
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
          _hydrateFromSavedForm(savedFormData);
          _hasDraftLoaded = true;
          await _syncAccountHolderCache();
        }
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

  String _formatSavedDate(dynamic value) {
    final raw = _savedString(value).trim();
    if (raw.isEmpty) return '';

    final parsed = DateTime.tryParse(raw);
    if (parsed == null) {
      return raw;
    }

    final month = parsed.month.toString().padLeft(2, '0');
    final day = parsed.day.toString().padLeft(2, '0');
    final year = parsed.year.toString().padLeft(4, '0');
    return '$month/$day/$year';
  }

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

  void _hydrateFromSavedForm(Map<String, dynamic> payload) {
    final opening = Map<String, dynamic>.from(
      payload['opening'] as Map? ?? const {},
    );
    final account = Map<String, dynamic>.from(
      payload['account'] as Map? ?? const {},
    );
    final personal = Map<String, dynamic>.from(
      payload['personal'] as Map? ?? const {},
    );
    final address = Map<String, dynamic>.from(
      payload['address'] as Map? ?? const {},
    );
    final contact = Map<String, dynamic>.from(
      payload['contact'] as Map? ?? const {},
    );
    final family = Map<String, dynamic>.from(
      payload['family'] as Map? ?? const {},
    );
    final academic = Map<String, dynamic>.from(
      payload['academic'] as Map? ?? const {},
    );
    final support = Map<String, dynamic>.from(
      payload['support'] as Map? ?? const {},
    );
    final discipline = Map<String, dynamic>.from(
      payload['discipline'] as Map? ?? const {},
    );
    final essays = Map<String, dynamic>.from(
      payload['essays'] as Map? ?? const {},
    );
    final certification = Map<String, dynamic>.from(
      payload['certification'] as Map? ?? const {},
    );

    final father = Map<String, dynamic>.from(
      family['father'] as Map? ?? const {},
    );
    final mother = Map<String, dynamic>.from(
      family['mother'] as Map? ?? const {},
    );
    final sibling = Map<String, dynamic>.from(
      family['sibling'] as Map? ?? const {},
    );
    final guardian = Map<String, dynamic>.from(
      family['guardian'] as Map? ?? const {},
    );

    _data.userId = _savedString(account['user_id']).isNotEmpty
        ? _savedString(account['user_id'])
        : _data.userId;
    _data.accountStudentId = _savedString(account['student_id']).isNotEmpty
        ? _savedString(account['student_id'])
        : _data.accountStudentId;
    _data.studentNumber = _savedString(academic['student_number']).isNotEmpty
        ? _savedString(academic['student_number'])
        : _data.accountStudentId;
    _data.email = _savedString(contact['email']).isNotEmpty
        ? _savedString(contact['email'])
        : _data.email;
    if (_savedString(opening['opening_id']).trim().isNotEmpty) {
      _applyOpeningSelection(
        openingId: _savedString(opening['opening_id']),
        openingTitle: _savedString(opening['opening_title']),
        programName: _savedString(opening['program_name']),
      );
    }

    _data.firstName = _savedString(personal['first_name']);
    _data.middleName = _savedString(personal['middle_name']);
    _data.lastName = _savedString(personal['last_name']);
    _data.maidenName = _savedString(personal['maiden_name']);
    _data.age = _savedString(personal['age']);
    _data.dateOfBirth = _formatSavedDate(personal['date_of_birth']);
    _data.sex = _savedString(personal['sex']).isNotEmpty
        ? _savedString(personal['sex'])
        : _data.sex;
    _data.placeOfBirth = _savedString(personal['place_of_birth']);
    _data.citizenship = _savedString(personal['citizenship']).isNotEmpty
        ? _savedString(personal['citizenship'])
        : _data.citizenship;
    _data.civilStatus = _savedString(personal['civil_status']).isNotEmpty
        ? _savedString(personal['civil_status'])
        : _data.civilStatus;
    _data.religion = _savedString(personal['religion']);

    _data.street = _savedString(address['street']);
    _data.subdivision = _savedString(address['subdivision']);
    _data.barangay = _savedString(address['barangay']);
    _data.city = _savedString(address['city_municipality']).isNotEmpty
        ? _savedString(address['city_municipality'])
        : _data.city;
    _data.province = _savedString(address['province']).isNotEmpty
        ? _savedString(address['province'])
        : _data.province;
    _data.zipCode = _savedString(address['zip_code']).isNotEmpty
        ? _savedString(address['zip_code'])
        : _data.zipCode;

    _data.landline = _savedString(contact['landline']);
    _data.mobileNumber = _savedString(contact['mobile_number']).isNotEmpty
        ? _savedString(contact['mobile_number'])
        : _data.mobileNumber;

    _data.parentGuardianAddress = _savedString(
      family['parent_guardian_address'],
    );
    _data.fatherLastName = _savedString(father['last_name']);
    _data.fatherFirstName = _savedString(father['first_name']);
    _data.fatherMiddleName = _savedString(father['middle_name']);
    _data.fatherMobile = _savedString(father['mobile']);
    _data.fatherEducationalAttainment = _savedString(
      father['educational_attainment'],
    );
    _data.fatherOccupation = _savedString(father['occupation']);
    _data.fatherCompanyNameAndAddress = _savedString(
      father['company_name_and_address'],
    );
    _data.motherLastName = _savedString(mother['last_name']);
    _data.motherFirstName = _savedString(mother['first_name']);
    _data.motherMiddleName = _savedString(mother['middle_name']);
    _data.motherMobile = _savedString(mother['mobile']);
    _data.motherEducationalAttainment = _savedString(
      mother['educational_attainment'],
    );
    _data.motherOccupation = _savedString(mother['occupation']);
    _data.motherCompanyNameAndAddress = _savedString(
      mother['company_name_and_address'],
    );
    _data.siblingLastName = _savedString(sibling['last_name']);
    _data.siblingFirstName = _savedString(sibling['first_name']);
    _data.siblingMiddleName = _savedString(sibling['middle_name']);
    _data.siblingMobile = _savedString(sibling['mobile']);
    _data.guardianLastName = _savedString(guardian['last_name']);
    _data.guardianFirstName = _savedString(guardian['first_name']);
    _data.guardianMiddleName = _savedString(guardian['middle_name']);
    _data.guardianMobile = _savedString(guardian['mobile']);
    _data.guardianEducationalAttainment = _savedString(
      guardian['educational_attainment'],
    );
    _data.guardianOccupation = _savedString(guardian['occupation']);
    _data.guardianCompanyNameAndAddress = _savedString(
      guardian['company_name_and_address'],
    );
    _data.parentNativeStatus =
        _savedString(family['parent_native_status']).isNotEmpty
        ? _savedString(family['parent_native_status'])
        : _data.parentNativeStatus;
    _data.parentMarilaoResidencyDuration = _savedString(
      family['parent_marilao_residency_duration'],
    );
    _data.parentPreviousTownProvince = _savedString(
      family['parent_previous_town_province'],
    );

    _data.collegeSchool = _savedString(academic['college_school']);
    _data.collegeAddress = _savedString(academic['college_address']);
    _data.collegeHonors = _savedString(academic['college_honors']);
    _data.collegeClub = _savedString(academic['college_club']);
    _data.collegeYearGraduated = _savedString(
      academic['college_year_graduated'],
    );
    _data.highSchoolSchool = _savedString(academic['high_school_school']);
    _data.highSchoolAddress = _savedString(academic['high_school_address']);
    _data.highSchoolHonors = _savedString(academic['high_school_honors']);
    _data.highSchoolClub = _savedString(academic['high_school_club']);
    _data.highSchoolYearGraduated = _savedString(
      academic['high_school_year_graduated'],
    );
    _data.seniorHighSchool = _savedString(academic['senior_high_school']);
    _data.seniorHighAddress = _savedString(academic['senior_high_address']);
    _data.seniorHighHonors = _savedString(academic['senior_high_honors']);
    _data.seniorHighClub = _savedString(academic['senior_high_club']);
    _data.seniorHighYearGraduated = _savedString(
      academic['senior_high_year_graduated'],
    );
    _data.elementarySchool = _savedString(academic['elementary_school']);
    _data.elementaryAddress = _savedString(academic['elementary_address']);
    _data.elementaryHonors = _savedString(academic['elementary_honors']);
    _data.elementaryClub = _savedString(academic['elementary_club']);
    _data.elementaryYearGraduated = _savedString(
      academic['elementary_year_graduated'],
    );
    _data.currentCourse =
        _savedString(academic['current_course_code']).isNotEmpty
        ? _savedString(academic['current_course_code'])
        : _data.currentCourse;
    _data.currentYearLevel = _savedString(academic['current_year_level']);
    _data.currentSection = _savedString(academic['current_section']).isNotEmpty
        ? _savedString(academic['current_section'])
        : _data.currentSection;
    _data.lrn = _savedString(academic['lrn']);

    _data.financialSupport =
        _savedString(support['financial_support']).isNotEmpty
        ? _savedString(support['financial_support'])
        : _data.financialSupport;
    _data.scholarshipHistory = support['scholarship_history'] == true;
    _data.scholarshipDetails = _savedString(support['scholarship_details']);
    _data.scholarshipOthersSpecify = _savedString(
      support['scholarship_others_specify'],
    );

    _data.disciplinaryAction = discipline['disciplinary_action'] == true;
    _data.disciplinaryExplanation = _savedString(
      discipline['disciplinary_explanation'],
    );

    _data.describeYourselfEssay = _savedString(
      essays['describe_yourself_essay'],
    );
    _data.aimsAndAmbitionEssay = _savedString(
      essays['aims_and_ambition_essay'],
    );
    _data.certificationRead = certification['certification_read'] == true;
    _data.agree = certification['agree'] == true;
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

    final missingAccountFields = <String>[];
    if (_data.userId.trim().isEmpty) {
      missingAccountFields.add('user ID');
    }
    if (_data.accountStudentId.trim().isEmpty) {
      missingAccountFields.add('student ID');
    }
    if (_data.email.trim().isEmpty) {
      missingAccountFields.add('email');
    }

    if (missingAccountFields.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Missing required account details: ${missingAccountFields.join(', ')}. Please log in again.',
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

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(successMessage)));

      Navigator.pushReplacementNamed(
        context,
        AppRoutes.documents,
        arguments: {
          'initialTitle': openingTitle,
          'initialProgramName': programName,
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
        );
      case 4:
        return StepSubmit(
          data: _data,
          onChanged: () {
            setState(() {});
            _queueAutosave();
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
                            else if (!_hasSelectedOpening)
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF7F1E5),
                                  border: Border.all(
                                    color: AppColors.gold,
                                    width: 1.2,
                                  ),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Choose an opening first',
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.darkBrown,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    const Text(
                                      'This application form is now tied to one admin-posted scholarship opening. Select the opening you want to apply for before continuing.',
                                      style: TextStyle(
                                        fontSize: 14,
                                        height: 1.45,
                                        color: AppColors.brown,
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    SizedBox(
                                      width: double.infinity,
                                      child: GoldButton(
                                        label: 'View Scholarship Openings',
                                        onTap: () =>
                                            Navigator.pushReplacementNamed(
                                              context,
                                              AppRoutes.scholarshipOpenings,
                                            ),
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            else
                              Column(
                                children: [
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF7F1E5),
                                      border: Border.all(
                                        color: AppColors.gold,
                                        width: 1.1,
                                      ),
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          'Selected Opening',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.brown,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          _data.openingTitle.isNotEmpty
                                              ? _data.openingTitle
                                              : 'Scholarship Opening',
                                          style: const TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.darkBrown,
                                          ),
                                        ),
                                        if (_data.openingProgramName.isNotEmpty)
                                          Padding(
                                            padding: const EdgeInsets.only(
                                              top: 4,
                                            ),
                                            child: Text(
                                              _data.openingProgramName,
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w700,
                                                color: AppColors.brown,
                                              ),
                                            ),
                                          ),
                                        const SizedBox(height: 10),
                                        ConstrainedBox(
                                          constraints: const BoxConstraints(
                                            minHeight: 34,
                                          ),
                                          child: Row(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Padding(
                                                padding: const EdgeInsets.only(
                                                  top: 1,
                                                ),
                                                child: Icon(
                                                  _isAutosaving
                                                      ? Icons.sync
                                                      : Icons.save_outlined,
                                                  size: 16,
                                                  color: AppColors.brown,
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Text(
                                                  _isAutosaving
                                                      ? 'Saving draft...'
                                                      : _autosaveError == null
                                                      ? 'Draft autosaves as you complete the form.'
                                                      : _autosaveError!,
                                                  style: const TextStyle(
                                                    fontSize: 12,
                                                    color: AppColors.brown,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 20),
                                  AnimatedSwitcher(
                                    duration: const Duration(milliseconds: 250),
                                    child: KeyedSubtree(
                                      key: ValueKey(_step),
                                      child: _buildStep(),
                                    ),
                                  ),
                                ],
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
                                  child: !_hasSelectedOpening
                                      ? const SizedBox.shrink()
                                      : _step < 4
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
                                          label: 'Submit Application',
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
