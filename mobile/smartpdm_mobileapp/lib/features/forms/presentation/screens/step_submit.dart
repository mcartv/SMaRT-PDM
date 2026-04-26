import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:url_launcher/url_launcher.dart';

class StepSubmit extends StatefulWidget {
  final ApplicationData data;
  final VoidCallback onChanged;
  final bool showErrors;

  const StepSubmit({
    super.key,
    required this.data,
    required this.onChanged,
    this.showErrors = false,
  });

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

  String _clean(String value) {
    final text = value.trim();
    return text.isEmpty ? '-' : text;
  }

  String _name(String first, String middle, String last) {
    final parts = [
      first,
      middle,
      last,
    ].map((v) => v.trim()).where((v) => v.isNotEmpty).toList();

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
    ].map((v) => v.trim()).where((v) => v.isNotEmpty).toList();

    return parts.isEmpty ? '-' : parts.join(', ');
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
    if (_empty(widget.data.currentCourse)) missing.add('Course');
    if (_empty(widget.data.currentYearLevel)) missing.add('Year level');
    if (_empty(widget.data.currentSection)) missing.add('Section');
    if (_empty(widget.data.studentNumber)) missing.add('Student number');

    final hasGuardianName =
        widget.data.guardianFirstName.trim().isNotEmpty ||
        widget.data.guardianLastName.trim().isNotEmpty;

    final hasParentOrGuardian =
        widget.data.fatherPresent ||
        widget.data.motherPresent ||
        widget.data.guardianOnly ||
        hasGuardianName;

    if (!hasParentOrGuardian) {
      missing.add('At least one parent or guardian');
    }

    if (widget.data.guardianOnly && !hasGuardianName) {
      missing.add('Guardian name');
    }

    return missing;
  }

  Widget _warningBox() {
    final missing = _missingFields();

    if (missing.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        margin: const EdgeInsets.only(bottom: 18),
        decoration: BoxDecoration(
          color: Colors.green.shade50,
          border: Border.all(color: Colors.green.shade300),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Text(
          'Review your information before submitting.',
          style: TextStyle(
            fontSize: 12,
            color: Colors.green,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      margin: const EdgeInsets.only(bottom: 18),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        border: Border.all(color: Colors.red.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Review required fields:',
            style: TextStyle(
              fontSize: 12,
              color: Colors.red,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          ...missing.map(
            (field) => Text(
              '• $field',
              style: const TextStyle(fontSize: 12, color: Colors.red),
            ),
          ),
        ],
      ),
    );
  }

  Widget _previewSection(String title, List<Widget> children) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F1E5),
        border: Border.all(color: Colors.orange.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: sectionTitle),
          const SizedBox(height: 8),
          const Divider(height: 1, color: Colors.orange),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }

  Widget _previewRow(String label, String value, {bool required = false}) {
    final isMissing = required && value.trim().isEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(
              required ? '$label *' : label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF5A3A1A),
              ),
            ),
          ),
          Expanded(
            flex: 6,
            child: Text(
              isMissing ? 'Missing' : _clean(value),
              style: TextStyle(
                fontSize: 12,
                color: isMissing ? Colors.red : Colors.black87,
                fontWeight: isMissing ? FontWeight.w800 : FontWeight.normal,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _previewArea() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'V. REVIEW APPLICATION',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.brown,
          ),
        ),
        const Divider(color: Colors.orange, thickness: 2),
        const SizedBox(height: 16),
        _warningBox(),
        _previewSection('Personal Information', [
          _previewRow(
            'Name',
            _name(
              widget.data.firstName,
              widget.data.middleName,
              widget.data.lastName,
            ),
            required: true,
          ),
          _previewRow('Date of Birth', widget.data.dateOfBirth, required: true),
          _previewRow('Age', widget.data.age, required: true),
          _previewRow('Sex', widget.data.sex, required: true),
          _previewRow('Religion', widget.data.religion, required: true),
          _previewRow('Civil Status', widget.data.civilStatus),
          _previewRow('Place of Birth', widget.data.placeOfBirth),
          _previewRow('Citizenship', widget.data.citizenship),
          _previewRow(
            'Mobile Number',
            widget.data.mobileNumber,
            required: true,
          ),
          _previewRow('Email', widget.data.email),
        ]),
        _previewSection('Permanent Address', [
          _previewRow('Address', _address()),
        ]),
        _previewSection('Family Information', [
          _previewRow(
            'Parent / Guardian Address',
            widget.data.parentGuardianAddress,
          ),
          _previewRow(
            'Father',
            widget.data.fatherPresent
                ? _name(
                    widget.data.fatherFirstName,
                    widget.data.fatherMiddleName,
                    widget.data.fatherLastName,
                  )
                : 'Not present / not listed',
          ),
          _previewRow(
            'Mother',
            widget.data.motherPresent
                ? _name(
                    widget.data.motherFirstName,
                    widget.data.motherMiddleName,
                    widget.data.motherLastName,
                  )
                : 'Not present / not listed',
          ),
          if (widget.data.guardianOnly ||
              widget.data.guardianFirstName.trim().isNotEmpty ||
              widget.data.guardianLastName.trim().isNotEmpty)
            _previewRow(
              'Guardian',
              _name(
                widget.data.guardianFirstName,
                widget.data.guardianMiddleName,
                widget.data.guardianLastName,
              ),
              required: widget.data.guardianOnly,
            ),
        ]),
        _previewSection('Academic Information', [
          _previewRow('Course', widget.data.currentCourse, required: true),
          _previewRow(
            'Year Level',
            widget.data.currentYearLevel,
            required: true,
          ),
          _previewRow('Section', widget.data.currentSection, required: true),
          _previewRow(
            'Student Number',
            widget.data.studentNumber,
            required: true,
          ),
        ]),
        _previewSection('Essay', [
          _previewRow('Describe Yourself', widget.data.describeYourselfEssay),
          _previewRow('Aims and Ambitions', widget.data.aimsAndAmbitionEssay),
        ]),
        _previewSection('Scholarship / Discipline', [
          _previewRow('Financial Support', widget.data.financialSupport),
          _previewRow(
            'Scholarship History',
            widget.data.scholarshipHistory ? 'Yes' : 'No',
          ),
          if (widget.data.scholarshipHistory)
            _previewRow('Scholarship Details', widget.data.scholarshipDetails),
          _previewRow(
            'Disciplinary Action',
            widget.data.disciplinaryAction ? 'Yes' : 'No',
          ),
          if (widget.data.disciplinaryAction)
            _previewRow(
              'Disciplinary Explanation',
              widget.data.disciplinaryExplanation,
            ),
        ]),
      ],
    );
  }

  Widget _certificationArea() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'VI. CERTIFICATION & SUBMISSION',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.brown,
          ),
        ),
        const Divider(color: Colors.orange, thickness: 2),
        const SizedBox(height: 24),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF7F1E5),
            border: Border.all(color: Colors.orange, width: 1),
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.all(16),
          child: const Text(
            'Submitting this form will create your scholarship application for the selected opening. After submission, upload the required documents from Documents to continue the review process.',
            style: TextStyle(
              fontSize: 12,
              color: Color(0xFF7A5C2E),
              height: 1.5,
            ),
          ),
        ),
        const SizedBox(height: 24),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFFAF3E0),
            border: Border.all(color: Colors.orange, width: 1),
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.all(16),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Documentary Requirements:',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: Color(0xFF8B6F47),
                ),
              ),
              SizedBox(height: 12),
              Text(
                '- Fully accomplished Survey Form\n'
                '- Letter of request for scholarship grant\n'
                '- Certificate of Indigency (from Punong Barangay)\n'
                '- Photocopy of recent Certificate of Registration (COR)\n'
                '- Grade report for the current semester\n',
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xFF8B6F47),
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFFFE8D6),
            border: Border.all(color: Colors.orange, width: 1),
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.all(16),
          child: const Text(
            'Certification: I certify that all answers given above are true and correct to the best of my knowledge. I understand that any false information will disqualify my application.',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 12,
              color: Color(0xFF8B4513),
            ),
          ),
        ),
        const SizedBox(height: 24),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: certRead,
              onChanged: (val) {
                setState(() {
                  certRead = val ?? false;
                  widget.data.certificationRead = certRead;
                });
                widget.onChanged();
              },
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'I certify that all information I provided is truthful, accurate, and complete to the best of my knowledge.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[700],
                    height: 1.4,
                  ),
                ),
              ),
            ),
          ],
        ),
        if (widget.showErrors && !certRead)
          const Padding(
            padding: EdgeInsets.only(left: 12, top: 4),
            child: Text(
              'You must confirm the certification statement.',
              style: TextStyle(color: Colors.red, fontSize: 12),
            ),
          ),
        const SizedBox(height: 20),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Checkbox(
              value: agreeTerms,
              onChanged: (val) {
                setState(() {
                  agreeTerms = val ?? false;
                  widget.data.agree = agreeTerms;
                });
                widget.onChanged();
              },
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 6),
                child: RichText(
                  text: TextSpan(
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[700],
                      height: 1.4,
                    ),
                    children: [
                      const TextSpan(text: 'By continuing, I agree to the '),
                      TextSpan(
                        text: 'Terms of Service',
                        style: const TextStyle(
                          color: Colors.orange,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                        ),
                        recognizer: TapGestureRecognizer()
                          ..onTap = () => _openLink(_termsUri),
                      ),
                      const TextSpan(
                        text:
                            '. For more information about SMaRT-PDM\'s privacy practices, see the ',
                      ),
                      TextSpan(
                        text: 'SMaRT-PDM Privacy Statement',
                        style: const TextStyle(
                          color: Colors.orange,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                        ),
                        recognizer: TapGestureRecognizer()
                          ..onTap = () => _openLink(_privacyUri),
                      ),
                      const TextSpan(
                        text:
                            '. I understand SMaRT-PDM may send account-related emails.',
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        if (widget.showErrors && !agreeTerms)
          const Padding(
            padding: EdgeInsets.only(left: 12, top: 4),
            child: Text(
              'You must agree to the legal terms and privacy statement.',
              style: TextStyle(color: Colors.red, fontSize: 12),
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _previewArea(),
          const SizedBox(height: 24),
          _certificationArea(),
        ],
      ),
    );
  }
}

const TextStyle sectionTitle = TextStyle(
  fontSize: 15,
  fontWeight: FontWeight.bold,
  color: Colors.brown,
);
