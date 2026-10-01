import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/constants/legal_documents.dart';
import 'package:smartpdm_mobileapp/features/forms/domain/validation/application_submission_validator.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/intake_form_ui.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/shared/widgets/legal_document_sheet.dart';

class StepSubmit extends StatefulWidget {
  const StepSubmit({
    super.key,
    required this.data,
    required this.onChanged,
    required this.onEditStep,
    this.showErrors = false,
  });

  final ApplicationData data;
  final VoidCallback onChanged;
  final ValueChanged<int> onEditStep;
  final bool showErrors;

  @override
  State<StepSubmit> createState() => _StepSubmitState();
}

class _StepSubmitState extends State<StepSubmit> {
  static const ApplicationSubmissionValidator _validator =
      ApplicationSubmissionValidator();

  late bool certRead;
  late bool agreeTerms;
  late final TapGestureRecognizer _termsRecognizer;
  late final TapGestureRecognizer _privacyRecognizer;

  final Set<String> _expandedSections = <String>{'personal'};

  @override
  void initState() {
    super.initState();
    certRead = widget.data.certificationRead;
    agreeTerms = widget.data.agree;

    _termsRecognizer = TapGestureRecognizer()
      ..onTap = () => showLegalDocumentSheet(
        context,
        title: LegalDocuments.termsOfServiceTitle,
        content: LegalDocuments.termsOfService,
      );

    _privacyRecognizer = TapGestureRecognizer()
      ..onTap = () => showLegalDocumentSheet(
        context,
        title: LegalDocuments.privacyStatementTitle,
        content: LegalDocuments.privacyStatement,
      );
  }

  @override
  void dispose() {
    _termsRecognizer.dispose();
    _privacyRecognizer.dispose();
    super.dispose();
  }

  String _clean(String value) {
    final text = value.trim();
    if (text.isEmpty || text.toUpperCase() == 'N/A') return 'Not provided';
    return text;
  }

  String _yesNo(bool value) => value ? 'Yes' : 'No';

  String _answerLabel(bool answered, bool value) {
    if (!answered) return 'Not answered';
    return value ? 'Yes' : 'No';
  }

  String _residencyDurationLabel(String value) {
    final raw = value.trim();
    final years = int.tryParse(raw);

    if (raw.toLowerCase() == 'less than a year' || years == 0) {
      return 'Less than a year';
    }
    if (raw.toLowerCase() == '1-5 years' ||
        (years != null && years >= 1 && years <= 5)) {
      return '1-5 years';
    }
    if (raw.toLowerCase() == '6-10 years' ||
        (years != null && years >= 6 && years <= 10)) {
      return '6-10 years';
    }
    if (raw.toLowerCase() == 'more than 10 years' ||
        (years != null && years > 10)) {
      return 'More than 10 years';
    }

    return _clean(raw);
  }

  String _scholarshipLevels() {
    final levels = <String>[
      if (widget.data.scholarshipElementary) 'Elementary',
      if (widget.data.scholarshipHighSchool) 'Junior High School',
      if (widget.data.scholarshipCollege) 'College',
      if (widget.data.scholarshipOthers)
        widget.data.scholarshipOthersSpecify.trim().isEmpty
            ? 'Others'
            : 'Others: ${widget.data.scholarshipOthersSpecify.trim()}',
    ];

    return levels.isEmpty ? 'Not provided' : levels.join(', ');
  }

  ApplicationSubmissionValidationResult _reviewValidation() {
    return _validator.validateReviewReadiness(widget.data);
  }

  Widget _warningBox() {
    if (!widget.showErrors) return const SizedBox.shrink();

    final validation = _reviewValidation();

    if (validation.isValid) {
      return const IntakeInfoCard(
        title: 'Ready to submit',
        message:
            'Your required sections are complete. Review the information below before final submission.',
        icon: Icons.verified_outlined,
      );
    }

    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      backgroundColor: intakeIsDark(context)
          ? AppColors.applicantDarkSurfaceMuted
          : const Color(0xFFFFF2EE),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Review required fields',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: Colors.redAccent,
              fontWeight: FontWeight.w900,
              fontSize: 17,
            ),
          ),
          const SizedBox(height: 10),
          ...validation.repairActions.map(
            (action) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                '- $action',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.redAccent,
                  fontWeight: FontWeight.w600,
                  fontSize: 14.5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _reviewSection({
    required String sectionKey,
    required String title,
    required IconData icon,
    required int editStep,
    required List<Widget> rows,
  }) {
    final expanded = _expandedSections.contains(sectionKey);

    void toggle() {
      setState(() {
        if (expanded) {
          _expandedSections.remove(sectionKey);
        } else {
          _expandedSections.add(sectionKey);
        }
      });
    }

    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 14),
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: toggle,
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: AppColors.gold.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(icon, size: 19, color: AppColors.gold),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              title,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(
                                    color: intakeTextColor(context),
                                    fontWeight: FontWeight.w900,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => widget.onEditStep(editStep),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: const Size(0, 40),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    'Edit',
                    style: TextStyle(
                      color: AppColors.gold,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: toggle,
                  tooltip: expanded ? 'Collapse section' : 'Expand section',
                  visualDensity: VisualDensity.compact,
                  icon: AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 160),
                    child: Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: intakeSubtextColor(context),
                    ),
                  ),
                ),
              ],
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            child: expanded
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Divider(
                        height: 1,
                        color: intakeMutedBorderColor(context),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: rows,
                        ),
                      ),
                    ],
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  List<Widget> _personalRows() {
    final data = widget.data;
    return [
      IntakeReviewRow(label: 'First Name', value: _clean(data.firstName)),
      IntakeReviewRow(label: 'Middle Name', value: _clean(data.middleName)),
      IntakeReviewRow(label: 'Last Name', value: _clean(data.lastName)),
      IntakeReviewRow(label: 'Maiden Name', value: _clean(data.maidenName)),
      IntakeReviewRow(label: 'Date of Birth', value: _clean(data.dateOfBirth)),
      IntakeReviewRow(label: 'Age', value: _clean(data.age)),
      IntakeReviewRow(label: 'Sex', value: _clean(data.sex)),
      IntakeReviewRow(label: 'Place of Birth', value: _clean(data.placeOfBirth)),
      IntakeReviewRow(label: 'Citizenship', value: _clean(data.citizenship)),
      IntakeReviewRow(label: 'Civil Status', value: _clean(data.civilStatus)),
      IntakeReviewRow(label: 'Religion', value: _clean(data.religion)),
      IntakeReviewRow(label: 'Unit / Building No.', value: _clean(data.unitBldgNo)),
      IntakeReviewRow(
        label: 'House / Lot / Block No.',
        value: _clean(data.houseLotBlockNo),
      ),
      IntakeReviewRow(label: 'Phase', value: _clean(data.phase)),
      IntakeReviewRow(label: 'Street', value: _clean(data.street)),
      IntakeReviewRow(label: 'Subdivision', value: _clean(data.subdivision)),
      IntakeReviewRow(label: 'Barangay', value: _clean(data.barangay)),
      IntakeReviewRow(label: 'City / Municipality', value: _clean(data.city)),
      IntakeReviewRow(label: 'Province', value: _clean(data.province)),
      IntakeReviewRow(label: 'ZIP Code', value: _clean(data.zipCode)),
      IntakeReviewRow(label: 'Landline', value: _clean(data.landline)),
      IntakeReviewRow(label: 'Mobile Number', value: _clean(data.mobileNumber)),
      IntakeReviewRow(label: 'Email Address', value: _clean(data.email)),
    ];
  }

  List<Widget> _familyRows() {
    final data = widget.data;
    return [
      IntakeReviewRow(
        label: 'Parent / Guardian Address',
        value: data.sameAddressAsApplicant
            ? 'Same as applicant address'
            : _clean(data.parentGuardianAddress),
      ),
      IntakeReviewRow(
        label: 'Same Address as Applicant',
        value: _yesNo(data.sameAddressAsApplicant),
      ),
      IntakeReviewRow(
        label: 'Guardian Only',
        value: _yesNo(data.guardianOnly),
      ),
      IntakeReviewRow(
        label: 'Father Present / Listed',
        value: _yesNo(data.fatherPresent && !data.guardianOnly),
      ),
      IntakeReviewRow(label: 'Father First Name', value: _clean(data.fatherFirstName)),
      IntakeReviewRow(label: 'Father Middle Name', value: _clean(data.fatherMiddleName)),
      IntakeReviewRow(label: 'Father Last Name', value: _clean(data.fatherLastName)),
      IntakeReviewRow(label: 'Father Mobile Number', value: _clean(data.fatherMobile)),
      IntakeReviewRow(
        label: 'Father Educational Attainment',
        value: _clean(data.fatherEducationalAttainment),
      ),
      IntakeReviewRow(label: 'Father Occupation', value: _clean(data.fatherOccupation)),
      IntakeReviewRow(
        label: 'Father Company Name / Address',
        value: _clean(data.fatherCompanyNameAndAddress),
      ),
      IntakeReviewRow(
        label: 'Mother Present / Listed',
        value: _yesNo(data.motherPresent && !data.guardianOnly),
      ),
      IntakeReviewRow(label: 'Mother First Name', value: _clean(data.motherFirstName)),
      IntakeReviewRow(label: 'Mother Middle Name', value: _clean(data.motherMiddleName)),
      IntakeReviewRow(label: 'Mother Last Name', value: _clean(data.motherLastName)),
      IntakeReviewRow(label: 'Mother Mobile Number', value: _clean(data.motherMobile)),
      IntakeReviewRow(
        label: 'Mother Educational Attainment',
        value: _clean(data.motherEducationalAttainment),
      ),
      IntakeReviewRow(label: 'Mother Occupation', value: _clean(data.motherOccupation)),
      IntakeReviewRow(
        label: 'Mother Company Name / Address',
        value: _clean(data.motherCompanyNameAndAddress),
      ),
      IntakeReviewRow(label: 'Sibling First Name', value: _clean(data.siblingFirstName)),
      IntakeReviewRow(label: 'Sibling Middle Name', value: _clean(data.siblingMiddleName)),
      IntakeReviewRow(label: 'Sibling Last Name', value: _clean(data.siblingLastName)),
      IntakeReviewRow(label: 'Sibling Mobile Number', value: _clean(data.siblingMobile)),
      IntakeReviewRow(
        label: 'Sibling Educational Attainment',
        value: _clean(data.siblingEducationalAttainment),
      ),
      IntakeReviewRow(label: 'Sibling Occupation', value: _clean(data.siblingOccupation)),
      IntakeReviewRow(
        label: 'Sibling Company Name / Address',
        value: _clean(data.siblingCompanyNameAndAddress),
      ),
      IntakeReviewRow(label: 'Guardian First Name', value: _clean(data.guardianFirstName)),
      IntakeReviewRow(label: 'Guardian Middle Name', value: _clean(data.guardianMiddleName)),
      IntakeReviewRow(label: 'Guardian Last Name', value: _clean(data.guardianLastName)),
      IntakeReviewRow(label: 'Guardian Mobile Number', value: _clean(data.guardianMobile)),
      IntakeReviewRow(
        label: 'Guardian Educational Attainment',
        value: _clean(data.guardianEducationalAttainment),
      ),
      IntakeReviewRow(label: 'Guardian Occupation', value: _clean(data.guardianOccupation)),
      IntakeReviewRow(
        label: 'Guardian Company Name / Address',
        value: _clean(data.guardianCompanyNameAndAddress),
      ),
      IntakeReviewRow(
        label: 'Native of Marilao',
        value: _clean(data.parentNativeStatus),
      ),
      IntakeReviewRow(
        label: 'Years as Marilao Resident',
        value: _residencyDurationLabel(data.parentMarilaoResidencyDuration),
      ),
      IntakeReviewRow(
        label: 'Previous City / Municipality',
        value: _clean(data.parentPreviousTownMunicipality),
      ),
      IntakeReviewRow(
        label: 'Previous Province',
        value: _clean(data.parentPreviousProvince),
      ),
    ];
  }

  List<Widget> _academicRows() {
    final data = widget.data;
    return [
      IntakeReviewRow(label: 'College / Current School', value: _clean(data.collegeSchool)),
      IntakeReviewRow(label: 'College Address', value: _clean(data.collegeAddress)),
      IntakeReviewRow(label: 'College Honors / Awards', value: _clean(data.collegeHonors)),
      IntakeReviewRow(label: 'College Club / Organization', value: _clean(data.collegeClub)),
      IntakeReviewRow(label: 'College Year / Status', value: _clean(data.collegeYearGraduated)),
      IntakeReviewRow(label: 'Junior High School', value: _clean(data.highSchoolSchool)),
      IntakeReviewRow(label: 'Junior High Address', value: _clean(data.highSchoolAddress)),
      IntakeReviewRow(label: 'Junior High Honors / Awards', value: _clean(data.highSchoolHonors)),
      IntakeReviewRow(label: 'Junior High Club / Organization', value: _clean(data.highSchoolClub)),
      IntakeReviewRow(label: 'Junior High Year Graduated', value: _clean(data.highSchoolYearGraduated)),
      IntakeReviewRow(label: 'Senior High School', value: _clean(data.seniorHighSchool)),
      IntakeReviewRow(label: 'Senior High Address', value: _clean(data.seniorHighAddress)),
      IntakeReviewRow(label: 'Senior High Honors / Awards', value: _clean(data.seniorHighHonors)),
      IntakeReviewRow(label: 'Senior High Club / Organization', value: _clean(data.seniorHighClub)),
      IntakeReviewRow(label: 'Senior High Year Graduated', value: _clean(data.seniorHighYearGraduated)),
      IntakeReviewRow(label: 'Elementary School', value: _clean(data.elementarySchool)),
      IntakeReviewRow(label: 'Elementary Address', value: _clean(data.elementaryAddress)),
      IntakeReviewRow(label: 'Elementary Honors / Awards', value: _clean(data.elementaryHonors)),
      IntakeReviewRow(label: 'Elementary Club / Organization', value: _clean(data.elementaryClub)),
      IntakeReviewRow(label: 'Elementary Year Graduated', value: _clean(data.elementaryYearGraduated)),
      IntakeReviewRow(label: 'Course', value: _clean(data.currentCourse)),
      IntakeReviewRow(label: 'Year Level', value: _clean(data.currentYearLevel)),
      IntakeReviewRow(label: 'Section', value: _clean(data.currentSection)),
      IntakeReviewRow(label: 'Student Number', value: _clean(data.studentNumber)),
      IntakeReviewRow(
        label: 'Learner Reference Number (LRN)',
        value: _clean(data.learnersReferenceNumber),
      ),
      IntakeReviewRow(label: 'GWA', value: _clean(data.gwa)),
      IntakeReviewRow(label: 'Financial Support', value: _clean(data.financialSupport)),
      IntakeReviewRow(
        label: 'Other Financial Support',
        value: _clean(data.financialSupportOtherSpecify),
      ),
      IntakeReviewRow(
        label: 'Previous Scholarship',
        value: _answerLabel(data.scholarshipHistoryAnswered, data.scholarshipHistory),
      ),
      IntakeReviewRow(label: 'Scholarship Level(s)', value: _scholarshipLevels()),
      IntakeReviewRow(label: 'Scholarship Details', value: _clean(data.scholarshipDetails)),
      IntakeReviewRow(
        label: 'Disciplinary Action',
        value: _answerLabel(data.disciplinaryActionAnswered, data.disciplinaryAction),
      ),
      IntakeReviewRow(
        label: 'Disciplinary Explanation',
        value: _clean(data.disciplinaryExplanation),
      ),
    ];
  }

  List<Widget> _statementRows() {
    return [
      IntakeReviewRow(
        label: 'Describe Yourself',
        value: _clean(widget.data.describeYourselfEssay),
      ),
      IntakeReviewRow(
        label: 'Aims and Ambitions After Graduation',
        value: _clean(widget.data.aimsAndAmbitionEssay),
      ),
    ];
  }

  Widget _consentCard() {
    final consentAccepted = certRead && agreeTerms;

    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      backgroundColor: intakeIsDark(context)
          ? AppColors.applicantDarkSurfaceMuted
          : const Color(0xFFFFF8EA),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            visualDensity: VisualDensity.compact,
            value: consentAccepted,
            onChanged: (value) {
              final accepted = value ?? false;
              setState(() {
                certRead = accepted;
                agreeTerms = accepted;
                widget.data.certificationRead = accepted;
                widget.data.agree = accepted;
              });
              widget.onChanged();
            },
            title: RichText(
              text: TextSpan(
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: intakeTextColor(context),
                  fontWeight: FontWeight.w600,
                  height: 1.4,
                  fontSize: 14.5,
                ),
                children: [
                  const TextSpan(
                    text:
                        'I certify that my application details are true and complete, and I agree to the ',
                  ),
                  TextSpan(
                    text: 'Terms of Service',
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontWeight: FontWeight.w800,
                      decoration: TextDecoration.underline,
                    ),
                    recognizer: _termsRecognizer,
                  ),
                  const TextSpan(text: ' and '),
                  TextSpan(
                    text: 'Privacy Statement',
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontWeight: FontWeight.w800,
                      decoration: TextDecoration.underline,
                    ),
                    recognizer: _privacyRecognizer,
                  ),
                  const TextSpan(text: '.'),
                ],
              ),
            ),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          if (widget.showErrors && !consentAccepted)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              child: Text(
                'Confirm this statement before submitting.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.redAccent,
                  fontWeight: FontWeight.w700,
                  fontSize: 13.5,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _confirmationArea() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 10),
        Text(
          'Before you submit',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: intakeTextColor(context),
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 10),
        const IntakeInfoCard(
          title: 'Final check',
          message:
              'Submitting this form creates your scholarship application. After submission, you can upload the required documents from the next application stage.',
          icon: Icons.assignment_turned_in_outlined,
        ),
        const SizedBox(height: 18),
        _consentCard(),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IntakeSectionHeader(title: 'V. REVIEW & SUBMIT'),
        Text(
          'Open each section and check every detail you entered before submitting.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: intakeSubtextColor(context),
            fontWeight: FontWeight.w600,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 16),
        _warningBox(),
        if (widget.showErrors) const SizedBox(height: 18),
        _reviewSection(
          sectionKey: 'personal',
          title: 'Personal Information',
          icon: Icons.person_outline_rounded,
          editStep: 0,
          rows: _personalRows(),
        ),
        _reviewSection(
          sectionKey: 'family',
          title: 'Family Information',
          icon: Icons.family_restroom_outlined,
          editStep: 1,
          rows: _familyRows(),
        ),
        _reviewSection(
          sectionKey: 'academic',
          title: 'Academic Information',
          icon: Icons.school_outlined,
          editStep: 2,
          rows: _academicRows(),
        ),
        _reviewSection(
          sectionKey: 'statement',
          title: 'Personal Statement',
          icon: Icons.edit_note_outlined,
          editStep: 3,
          rows: _statementRows(),
        ),
        _confirmationArea(),
      ],
    );
  }
}
