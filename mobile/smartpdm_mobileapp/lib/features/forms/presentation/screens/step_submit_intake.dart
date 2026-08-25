import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/forms/domain/validation/application_submission_validator.dart';
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
  static const ApplicationSubmissionValidator _validator =
      ApplicationSubmissionValidator();

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

  String _clean(String value) {
    final text = value.trim();
    return text.isEmpty ? '-' : text;
  }

  String _name(String first, String middle, String last) {
    final parts = [
      first,
      middle,
      last,
    ].map((value) => value.trim()).where((value) => value.isNotEmpty).toList();
    return parts.isEmpty ? '-' : parts.join(' ');
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
    return parts.isEmpty ? '-' : parts.join(', ');
  }

  ApplicationSubmissionValidationResult _reviewValidation() {
    return _validator.validateReviewReadiness(widget.data);
  }

  Widget _warningBox() {
    final validation = _reviewValidation();
    if (validation.isValid) {
      return IntakeInfoCard(
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
          ...validation.repairActions.map(
            (action) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                '- $action',
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

  Widget _certificationArea() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IntakeSectionHeader(title: 'VI. CERTIFICATION & SUBMISSION'),
        const IntakeInfoCard(
          title: 'Before you submit',
          message:
              'Submitting this form creates your scholarship application for the selected scholarship. After submission, upload the required documents to continue the review process.',
          icon: Icons.assignment_turned_in_outlined,
        ),
        const SizedBox(height: 16),
        IntakeCard(
          margin: const EdgeInsets.only(bottom: 16),
          backgroundColor: const Color(0xFFFFF8EA),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Documentary Requirements',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: IntakePalette.text,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '• Fully accomplished survey form\n'
                '• Letter of request for scholarship grant\n'
                '• Certificate of indigency from the Punong Barangay\n'
                '• Photocopy of recent Certificate of Registration (COR)\n'
                '• Grade report for the current semester',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: IntakePalette.subtext,
                  height: 1.5,
                ),
              ),
            ],
          ),
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
            ),
            IntakeReviewRow(
              label: 'Citizenship',
              value: _clean(widget.data.citizenship),
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
              label: 'Parent / Guardian Address',
              value: _clean(widget.data.parentGuardianAddress),
            ),
            IntakeReviewRow(
              label: 'Father',
              value: widget.data.fatherPresent
                  ? _name(
                      widget.data.fatherFirstName,
                      widget.data.fatherMiddleName,
                      widget.data.fatherLastName,
                    )
                  : 'Not present / not listed',
            ),
            IntakeReviewRow(
              label: 'Mother',
              value: widget.data.motherPresent
                  ? _name(
                      widget.data.motherFirstName,
                      widget.data.motherMiddleName,
                      widget.data.motherLastName,
                    )
                  : 'Not present / not listed',
            ),
            IntakeReviewRow(
              label: 'Guardian',
              value: _name(
                widget.data.guardianFirstName,
                widget.data.guardianMiddleName,
                widget.data.guardianLastName,
              ),
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
