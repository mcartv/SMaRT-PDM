import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/intake_form_ui.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:url_launcher/url_launcher.dart';

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
  static final Uri _termsUri = Uri.parse('https://smart-pdm.vercel.app/terms');
  static final Uri _privacyUri = Uri.parse(
    'https://smart-pdm.vercel.app/privacy',
  );

  late bool certRead;
  late bool agreeTerms;

  @override
  void initState() {
    super.initState();
    certRead = widget.data.certificationRead;
    agreeTerms = widget.data.agree;
  }

  Future<void> _openLink(Uri uri) async {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open ${uri.toString()}')),
      );
    }
  }

  bool _empty(String value) => value.trim().isEmpty;

  String _clean(String value) => value.trim().isEmpty ? 'N/A' : value.trim();

  String _name(String first, String middle, String last) {
    final parts = [
      first,
      middle,
      last,
    ].map((value) => value.trim()).where((value) => value.isNotEmpty).toList();
    return parts.isEmpty ? 'N/A' : parts.join(' ');
  }

  String _address() {
    final parts = [
      widget.data.unitBldgNo,
      widget.data.houseLotBlockNo,
      widget.data.street,
      widget.data.subdivision,
      widget.data.barangay,
      widget.data.city,
      widget.data.province,
      widget.data.zipCode,
    ].map((value) => value.trim()).where((value) => value.isNotEmpty).toList();
    return parts.isEmpty ? 'N/A' : parts.join(', ');
  }

  String _familyAddress() {
    final text = widget.data.parentGuardianAddress.trim();
    return text.isEmpty ? 'N/A' : text;
  }

  String _education(String value) => _clean(value);

  String _yesNo(bool value) => value ? 'Yes' : 'No';

  String _parentNativeDetails() {
    final status = widget.data.parentNativeStatus.trim();
    if (status.isEmpty) return '-';
    if (status == 'No') {
      final origin = widget.data.parentPreviousTownProvince.trim();
      return origin.isEmpty ? status : '$status, from $origin';
    }
    final years = widget.data.parentMarilaoResidencyDuration.trim();
    return years.isEmpty ? status : '$status, resident for $years';
  }

  List<String> _missingFields() {
    final missing = <String>[];
    if (_empty(widget.data.firstName)) missing.add('First name');
    if (_empty(widget.data.lastName)) missing.add('Last name');
    if (_empty(widget.data.dateOfBirth)) missing.add('Date of birth');
    if (_empty(widget.data.age)) missing.add('Age');
    if (_empty(widget.data.sex)) missing.add('Sex');
    if (_empty(widget.data.religion)) missing.add('Religion');
    if (_empty(widget.data.mobileNumber)) missing.add('Mobile number');
    if (_empty(widget.data.email)) missing.add('Email address');
    if (_empty(widget.data.currentCourse)) missing.add('Course');
    if (_empty(widget.data.currentYearLevel)) missing.add('Year level');
    if (_empty(widget.data.studentNumber)) missing.add('Student number');
    if (_empty(widget.data.describeYourselfEssay)) {
      missing.add('Describe yourself essay');
    }
    if (_empty(widget.data.aimsAndAmbitionEssay)) {
      missing.add('Aims and ambition essay');
    }
    return missing;
  }

  Widget _warningBox() {
    final missing = _missingFields();
    if (missing.isEmpty) {
      return const IntakeInfoCard(
        title: 'Ready to submit',
        message:
            'Your required sections are complete. Review the information below before final submission.',
        icon: Icons.verified_outlined,
      );
    }

    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 16),
      backgroundColor: const Color(0xFFFFF2EE),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Review required fields',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: Colors.redAccent,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          ...missing.map(
            (field) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                '• $field',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.redAccent,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoListCard({required String title, required List<String> items}) {
    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 16),
      backgroundColor: const Color(0xFFFFF8EA),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: IntakePalette.text,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            items.map((item) => '• $item').join('\n'),
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: IntakePalette.subtext,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _certificationArea() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IntakeSectionHeader(title: 'VI. CERTIFICATION & SUBMISSION'),
        const IntakeInfoCard(
          title: 'Before you submit',
          message:
              'Submitting this form creates your application for the selected scholarship. After submission, upload the required documents to continue the review process.',
          icon: Icons.assignment_turned_in_outlined,
        ),
        _infoListCard(
          title: 'Documentary Requirements',
          items: const [
            'Fully accomplished survey form',
            'Letter of request for scholarship grant',
            'Certificate of indigency from the Punong Barangay',
            'Photocopy of recent Certificate of Registration (COR)',
            'Grade report for the current semester',
          ],
        ),
        IntakeCard(
          margin: const EdgeInsets.only(bottom: 16),
          backgroundColor: const Color(0xFFFFEFE4),
          child: Text(
            'Certification: I certify that all answers given above are true and correct to the best of my knowledge. I understand that any false information will disqualify my application.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: IntakePalette.text,
              fontWeight: FontWeight.w700,
              height: 1.5,
            ),
          ),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: certRead,
          onChanged: (value) {
            setState(() {
              certRead = value ?? false;
              widget.data.certificationRead = certRead;
            });
            widget.onChanged();
          },
          title: const Text(
            'I certify that all information I provided is truthful, accurate, and complete to the best of my knowledge.',
          ),
          controlAffinity: ListTileControlAffinity.leading,
        ),
        if (widget.showErrors && !certRead)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              'You must confirm the certification statement.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.redAccent,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: agreeTerms,
          onChanged: (value) {
            setState(() {
              agreeTerms = value ?? false;
              widget.data.agree = agreeTerms;
            });
            widget.onChanged();
          },
          title: RichText(
            text: TextSpan(
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: IntakePalette.subtext,
                height: 1.45,
              ),
              children: [
                const TextSpan(text: 'By continuing, I agree to the '),
                TextSpan(
                  text: 'Terms of Service',
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontWeight: FontWeight.w700,
                    decoration: TextDecoration.underline,
                  ),
                  recognizer: TapGestureRecognizer()
                    ..onTap = () => _openLink(_termsUri),
                ),
                const TextSpan(text: ' and the '),
                TextSpan(
                  text: 'SMaRT-PDM Privacy Statement',
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontWeight: FontWeight.w700,
                    decoration: TextDecoration.underline,
                  ),
                  recognizer: TapGestureRecognizer()
                    ..onTap = () => _openLink(_privacyUri),
                ),
                const TextSpan(
                  text:
                      '. I understand that using an account that is not mine may invalidate this scholarship application.',
                ),
              ],
            ),
          ),
          controlAffinity: ListTileControlAffinity.leading,
        ),
        if (widget.showErrors && !agreeTerms)
          Text(
            'You must agree to the legal terms and privacy statement.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.redAccent,
              fontWeight: FontWeight.w700,
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IntakeSectionHeader(title: 'V. REVIEW APPLICATION'),
        _warningBox(),
        const SizedBox(height: 16),
        IntakeReviewCard(
          title: 'Personal Information',
          onEdit: () => widget.onEditStep(0),
          rows: [
            IntakeReviewRow(
              label: 'Name',
              value: _name(
                widget.data.firstName,
                widget.data.middleName,
                widget.data.lastName,
              ),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Birth Date',
              value: _clean(widget.data.dateOfBirth),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Age',
              value: _clean(widget.data.age),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Sex',
              value: _clean(widget.data.sex),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Place of Birth',
              value: _clean(widget.data.placeOfBirth),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Citizenship',
              value: _clean(widget.data.citizenship),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Civil Status',
              value: _clean(widget.data.civilStatus),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Religion',
              value: _clean(widget.data.religion),
              required: true,
            ),
          ],
        ),
        IntakeReviewCard(
          title: 'Contact Information',
          onEdit: () => widget.onEditStep(0),
          rows: [
            IntakeReviewRow(
              label: 'Mobile Number',
              value: _clean(widget.data.mobileNumber),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Email Address',
              value: _clean(widget.data.email),
              required: true,
            ),
            IntakeReviewRow(label: 'Permanent Address', value: _address()),
          ],
        ),
        IntakeReviewCard(
          title: 'Family Information',
          onEdit: () => widget.onEditStep(1),
          rows: [
            IntakeReviewRow(
              label: 'Same Address as Applicant',
              value: _yesNo(widget.data.sameAddressAsApplicant),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Parent / Guardian Address',
              value: _familyAddress(),
            ),
            IntakeReviewRow(
              label: 'Father Present / Listed',
              value: _yesNo(widget.data.fatherPresent),
              required: true,
            ),
            if (widget.data.fatherPresent) ...[
              IntakeReviewRow(
                label: 'Father Name',
                value: _name(
                  widget.data.fatherFirstName,
                  widget.data.fatherMiddleName,
                  widget.data.fatherLastName,
                ),
                required: true,
              ),
              IntakeReviewRow(
                label: 'Father Educational Attainment',
                value: _education(widget.data.fatherEducationalAttainment),
              ),
              IntakeReviewRow(
                label: 'Father Occupation',
                value: _clean(widget.data.fatherOccupation),
              ),
              IntakeReviewRow(
                label: 'Father Company / Address',
                value: _clean(widget.data.fatherCompanyNameAndAddress),
              ),
            ],
            IntakeReviewRow(
              label: 'Mother Present / Listed',
              value: _yesNo(widget.data.motherPresent),
              required: true,
            ),
            if (widget.data.motherPresent) ...[
              IntakeReviewRow(
                label: 'Mother Name',
                value: _name(
                  widget.data.motherFirstName,
                  widget.data.motherMiddleName,
                  widget.data.motherLastName,
                ),
                required: true,
              ),
              IntakeReviewRow(
                label: 'Mother Educational Attainment',
                value: _education(widget.data.motherEducationalAttainment),
              ),
              IntakeReviewRow(
                label: 'Mother Occupation',
                value: _clean(widget.data.motherOccupation),
              ),
              IntakeReviewRow(
                label: 'Mother Company / Address',
                value: _clean(widget.data.motherCompanyNameAndAddress),
              ),
            ],
            IntakeReviewRow(
              label: 'Sibling Name',
              value: _name(
                widget.data.siblingFirstName,
                widget.data.siblingMiddleName,
                widget.data.siblingLastName,
              ),
            ),
            IntakeReviewRow(
              label: 'Sibling Educational Attainment',
              value: _education(widget.data.siblingEducationalAttainment),
            ),
            IntakeReviewRow(
              label: 'Sibling Occupation',
              value: _clean(widget.data.siblingOccupation),
            ),
            IntakeReviewRow(
              label: 'Sibling Company / Address',
              value: _clean(widget.data.siblingCompanyNameAndAddress),
            ),
            IntakeReviewRow(
              label: 'Guardian Only',
              value: _yesNo(widget.data.guardianOnly),
              required: true,
            ),
            if (widget.data.guardianOnly ||
                widget.data.guardianFirstName.trim().isNotEmpty ||
                widget.data.guardianLastName.trim().isNotEmpty) ...[
              IntakeReviewRow(
                label: 'Guardian Name',
                value: _name(
                  widget.data.guardianFirstName,
                  widget.data.guardianMiddleName,
                  widget.data.guardianLastName,
                ),
                required: widget.data.guardianOnly,
              ),
              IntakeReviewRow(
                label: 'Guardian Educational Attainment',
                value: _education(widget.data.guardianEducationalAttainment),
              ),
              IntakeReviewRow(
                label: 'Guardian Occupation',
                value: _clean(widget.data.guardianOccupation),
              ),
              IntakeReviewRow(
                label: 'Guardian Company / Address',
                value: _clean(widget.data.guardianCompanyNameAndAddress),
              ),
            ],
            IntakeReviewRow(
              label: 'Parents Native of Marilao',
              value: _parentNativeDetails(),
              required: true,
            ),
            if (widget.data.parentNativeStatus.trim().startsWith('Yes'))
              IntakeReviewRow(
                label: 'Residence in Marilao',
                value: _clean(widget.data.parentMarilaoResidencyDuration),
              ),
            if (widget.data.parentNativeStatus.trim() == 'No')
              IntakeReviewRow(
                label: 'Previous Town / Province',
                value: _clean(widget.data.parentPreviousTownProvince),
              ),
          ],
        ),
        IntakeReviewCard(
          title: 'Academic Information',
          onEdit: () => widget.onEditStep(2),
          rows: [
            IntakeReviewRow(
              label: 'Course',
              value: _clean(widget.data.currentCourse),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Year Level',
              value: _clean(widget.data.currentYearLevel),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Section',
              value: _clean(widget.data.currentSection),
            ),
            IntakeReviewRow(
              label: 'Student Number',
              value: _clean(widget.data.studentNumber),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Financial Support',
              value: _clean(widget.data.financialSupport),
              required: true,
            ),
            if (widget.data.financialSupport == 'Other')
              IntakeReviewRow(
                label: 'Other Financial Support',
                value: _clean(widget.data.scholarshipOthersSpecify),
                required: true,
              ),
            IntakeReviewRow(
              label: 'Scholarship History',
              value: _yesNo(widget.data.scholarshipHistory),
              required: true,
            ),
            if (widget.data.scholarshipHistory) ...[
              IntakeReviewRow(
                label: 'Scholarship Elementary',
                value: _yesNo(widget.data.scholarshipElementary),
              ),
              IntakeReviewRow(
                label: 'Scholarship High School',
                value: _yesNo(widget.data.scholarshipHighSchool),
              ),
              IntakeReviewRow(
                label: 'Scholarship College',
                value: _yesNo(widget.data.scholarshipCollege),
              ),
              IntakeReviewRow(
                label: 'Scholarship Others',
                value: _yesNo(widget.data.scholarshipOthers),
              ),
              if (widget.data.scholarshipOthers)
                IntakeReviewRow(
                  label: 'Scholarship Others Specify',
                  value: _clean(widget.data.scholarshipOthersSpecify),
                ),
              IntakeReviewRow(
                label: 'Scholarship Details',
                value: _clean(widget.data.scholarshipDetails),
              ),
            ],
            IntakeReviewRow(
              label: 'Disciplinary Action',
              value: _yesNo(widget.data.disciplinaryAction),
              required: true,
            ),
            if (widget.data.disciplinaryAction)
              IntakeReviewRow(
                label: 'Disciplinary Explanation',
                value: _clean(widget.data.disciplinaryExplanation),
              ),
          ],
        ),
        IntakeReviewCard(
          title: 'Essay',
          onEdit: () => widget.onEditStep(3),
          rows: [
            IntakeReviewRow(
              label: 'Describe Yourself',
              value: _clean(widget.data.describeYourselfEssay),
              required: true,
            ),
            IntakeReviewRow(
              label: 'Aims and Ambitions',
              value: _clean(widget.data.aimsAndAmbitionEssay),
              required: true,
            ),
          ],
        ),
        const SizedBox(height: 10),
        _certificationArea(),
      ],
    );
  }
}
