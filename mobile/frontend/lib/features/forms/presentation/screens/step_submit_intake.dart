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
    // Validation feedback belongs to the submit attempt. Do not show an error
    // banner merely because the applicant opened the review step before
    // checking the certification and legal-consent boxes.
    if (!widget.showErrors) return const SizedBox.shrink();

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

  Widget _confirmationCard() {
    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      backgroundColor: intakeIsDark(context)
          ? AppColors.applicantDarkSurfaceMuted
          : const Color(0xFFFFEFE4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
            title: Text(
              'I confirm that the information I provided in this application is true, accurate, and complete to the best of my knowledge. I understand that false or misleading information may result in the rejection or disqualification of my application.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: intakeTextColor(context),
                fontWeight: FontWeight.w700,
                height: 1.5,
                fontSize: 15.5,
              ),
            ),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          if (widget.showErrors && !certRead)
            Padding(
              padding: const EdgeInsets.only(left: 12, right: 12, bottom: 8),
              child: Text(
                'You must confirm that the information you provided is accurate.',
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

  Widget _legalAgreementCard() {
    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      backgroundColor: intakeIsDark(context)
          ? AppColors.applicantDarkSurfaceMuted
          : const Color(0xFFFFF8EA),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
                  color: intakeTextColor(context),
                  fontWeight: FontWeight.w600,
                  height: 1.5,
                  fontSize: 15.5,
                ),
                children: [
                  const TextSpan(text: 'By continuing, I agree to the '),
                  TextSpan(
                    text: 'Terms of Service',
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontWeight: FontWeight.w800,
                      decoration: TextDecoration.underline,
                    ),
                    recognizer: _termsRecognizer,
                  ),
                  const TextSpan(text: ' and acknowledge the '),
                  TextSpan(
                    text: 'SMaRT-PDM Privacy Statement',
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontWeight: FontWeight.w800,
                      decoration: TextDecoration.underline,
                    ),
                    recognizer: _privacyRecognizer,
                  ),
                  const TextSpan(
                    text:
                        '. I understand how my account and information will be used for scholarship-related services.',
                  ),
                ],
              ),
            ),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          if (widget.showErrors && !agreeTerms)
            Padding(
              padding: const EdgeInsets.only(left: 12, right: 12, bottom: 8),
              child: Text(
                'You must agree to the Terms of Service and acknowledge the Privacy Statement.',
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
        const IntakeSectionHeader(title: 'VI. CONFIRM & SUBMIT'),
        const IntakeInfoCard(
          title: 'Before you submit',
          message:
              'Submitting this form creates your scholarship application. After submission, you can upload the required documents from the next application stage.',
          icon: Icons.assignment_turned_in_outlined,
        ),
        const SizedBox(height: 18),
        _confirmationCard(),
        _legalAgreementCard(),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IntakeSectionHeader(title: 'V. REVIEW APPLICATION'),
        Text(
          'Please double-check your application form and make sure all information is correct before submitting.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: intakeSubtextColor(context),
            fontWeight: FontWeight.w600,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 16),
        _warningBox(),
        if (widget.showErrors) const SizedBox(height: 18),
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
        _confirmationArea(),
      ],
    );
  }
}
