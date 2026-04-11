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

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'V. CERTIFICATION & SUBMISSION',
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
              'This will save your base application now so you can immediately start uploading scholarship requirements. Scholarship program selection can still be completed later.',
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
                  '- Certificate of Good Moral Character (from PDM Guidance Office)\n'
                  '- Photocopy of Senior High School Card (FRESHMAN) or ALL Grade Forms (OLD STUDENT)\n'
                  '- Photocopy of recent Certificate of Registration (COR)\n'
                  '- Two (2) copies of 1x1 recent picture (white background)',
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
      ),
    );
  }
}
