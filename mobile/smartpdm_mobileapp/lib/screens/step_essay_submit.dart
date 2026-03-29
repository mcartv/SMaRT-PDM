import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';

class StepEssay extends StatefulWidget {
  final ApplicationData data;
  final VoidCallback onChanged;

  const StepEssay({super.key, required this.data, required this.onChanged});

  @override
  State<StepEssay> createState() => _StepEssayState();
}

class _StepEssayState extends State<StepEssay> {
  late final TextEditingController scholarshipController;
  late final TextEditingController achievementsController;
  late final TextEditingController financialNeedController;

  InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      );

  @override
  void initState() {
    super.initState();

    scholarshipController = TextEditingController(text: widget.data.scholarshipEssay);
    achievementsController = TextEditingController(text: widget.data.achievementsEssay);
    financialNeedController = TextEditingController(text: widget.data.financialNeedEssay);

    scholarshipController.addListener(() {
      widget.data.scholarshipEssay = scholarshipController.text;
      widget.onChanged();
    });

    achievementsController.addListener(() {
      widget.data.achievementsEssay = achievementsController.text;
      widget.onChanged();
    });

    financialNeedController.addListener(() {
      widget.data.financialNeedEssay = financialNeedController.text;
      widget.onChanged();
    });
  }

  @override
  void dispose() {
    scholarshipController.dispose();
    achievementsController.dispose();
    financialNeedController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('ESSAY QUESTIONS', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.brown)),
          const SizedBox(height: 16),

          const Text('1. Why do you want to become a scholar of SMaRT-PDM? (200-300 words)',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 8),
          TextFormField(
            controller: scholarshipController,
            maxLines: 6,
            decoration: _dec('Share your reasons for pursuing this scholarship...'),
          ),
          const SizedBox(height: 16),

          const Text('2. Describe your academic achievements and awards (200-300 words)',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 8),
          TextFormField(
            controller: achievementsController,
            maxLines: 6,
            decoration: _dec('Highlight your achievements, awards, and recognition...'),
          ),
          const SizedBox(height: 16),

          const Text('3. Explain your financial need and how the scholarship will help you (200-300 words)',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 8),
          TextFormField(
            controller: financialNeedController,
            maxLines: 6,
            decoration: _dec('Describe your financial situation and goals...'),
          ),
          const SizedBox(height: 24),

          const Text('Tips:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 4),
          const Text(
            '• Be honest and genuine in your responses\n'
            '• Proofread for grammar and spelling\n'
            '• Stay within the word limit\n'
            '• Use clear and concise language',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ],
      ),
    );
  }
}


class StepSubmit extends StatefulWidget {
  final ApplicationData data;
  final VoidCallback onChanged;

  const StepSubmit({super.key, required this.data, required this.onChanged});

  @override
  State<StepSubmit> createState() => _StepSubmitState();
}

class _StepSubmitState extends State<StepSubmit> {
  late bool certRead;
  late bool agreeTerms;

  @override
  void initState() {
    super.initState();
    certRead = widget.data.certificationRead;
    agreeTerms = widget.data.agree;
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Title
          const Text('V. CERTIFICATION & SUBMISSION',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.brown)),
          const Divider(color: Colors.orange, thickness: 2),
          const SizedBox(height: 16),

          // Documentary Requirements Box
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFFAF3E0),
              border: Border.all(color: Colors.orange, width: 1),
              borderRadius: BorderRadius.circular(8),
            ),
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Documentary Requirements:',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF8B6F47)),
                ),
                const SizedBox(height: 8),
                const Text(
                  '• Fully accomplished Survey Form\n'
                  '• Letter of request for scholarship grant\n'
                  '• Certificate of Indigency (from Punong Barangay)\n'
                  '• Certificate of Good Moral Character (from PDM Guidance Office)\n'
                  '• Photocopy of Senior High School Card (FRESHMAN) or ALL Grade Forms (OLD STUDENT)\n'
                  '• Photocopy of recent Certificate of Registration (COR)\n'
                  '• Two (2) copies of 1x1 recent picture (white background)',
                  style: TextStyle(fontSize: 12, color: Color(0xFF8B6F47), height: 1.5),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Certification Text
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFFFE8D6),
              border: Border.all(color: Colors.orange, width: 1),
              borderRadius: BorderRadius.circular(8),
            ),
            padding: const EdgeInsets.all(12),
            child: const Text(
              'Certification: I certify that all answers given above are true and correct to the best of my knowledge. I understand that any false information will disqualify my application.',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Color(0xFF8B4513)),
            ),
          ),
          const SizedBox(height: 16),

          // Checkbox 1: Read and Agree
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
                  padding: const EdgeInsets.only(top: 6.0),
                  child: Text(
                    'I have read and agree to the terms above. I certify that all information I provided is truthful and accurate.',
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
          const SizedBox(height: 12),

          // Checkbox 2: Terms and Conditions + Privacy Policy
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
                  padding: const EdgeInsets.only(top: 6.0),
                  child: RichText(
                    text: TextSpan(
                      style: TextStyle(fontSize: 12, color: Colors.grey[700], height: 1.4),
                      children: [
                        const TextSpan(text: 'I agree to the '),
                        TextSpan(
                          text: 'Terms and Conditions',
                          style: const TextStyle(color: Colors.orange, fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
                          recognizer: TapGestureRecognizer()
                            ..onTap = () => _showTerms(context, 'Terms and Conditions'),
                        ),
                        const TextSpan(text: ' and '),
                        TextSpan(
                          text: 'Privacy Policy',
                          style: const TextStyle(color: Colors.orange, fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
                          recognizer: TapGestureRecognizer()
                            ..onTap = () => _showTerms(context, 'Privacy Policy'),
                        ),
                        const TextSpan(text: ' of the PDM Scholarship Portal.'),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Submit Button (optional, can be handled by parent)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (certRead && agreeTerms) ? () => _onSubmit(context) : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange,
                disabledBackgroundColor: Colors.grey[300],
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text(
                'SUBMIT APPLICATION',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showTerms(BuildContext context, String title) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: SingleChildScrollView(
          child: Text(
            title == 'Terms and Conditions'
                ? 'SMaRT-PDM Scholarship Program Terms and Conditions:\n\n'
                    '1. Applicants must be residents of Marilao, Bulacan.\n'
                    '2. Academic excellence is prioritized.\n'
                    '3. Recipients must maintain good academic standing.\n'
                    '4. Scholarship is renewable annually based on performance.\n'
                    '5. Falsification of documents will result in disqualification.\n'
                    '6. Recipients agree to community service requirement.'
                : 'Privacy Policy:\n\n'
                    '1. Personal information will be kept confidential.\n'
                    '2. Data will only be used for scholarship evaluation.\n'
                    '3. Information will not be shared with third parties.\n'
                    '4. Applicants have the right to access their data.\n'
                    '5. We comply with data protection regulations.\n'
                    '6. For inquiries, contact pdm@barangaymarilao.gov.ph',
            style: const TextStyle(fontSize: 12, height: 1.6),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _onSubmit(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Application submitted successfully!')),
    );
  }
}