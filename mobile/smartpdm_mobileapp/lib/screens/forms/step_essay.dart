import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';

class StepEssay extends StatefulWidget {
  final ApplicationData data;
  final VoidCallback onChanged;

  const StepEssay({super.key, required this.data, required this.onChanged});

  @override
  State<StepEssay> createState() => _StepEssayState();
}

class _StepEssayState extends State<StepEssay> {
  late final TextEditingController describeYourselfController;
  late final TextEditingController aimsAndAmbitionController;

  InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      );

  @override
  void initState() {
    super.initState();

    describeYourselfController = TextEditingController(text: widget.data.describeYourselfEssay);
    aimsAndAmbitionController = TextEditingController(text: widget.data.aimsAndAmbitionEssay);

    describeYourselfController.addListener(() {
      widget.data.describeYourselfEssay = describeYourselfController.text;
      widget.onChanged();
    });

    aimsAndAmbitionController.addListener(() {
      widget.data.aimsAndAmbitionEssay = aimsAndAmbitionController.text;
      widget.onChanged();
    });
  }

  @override
  void dispose() {
    describeYourselfController.dispose();
    aimsAndAmbitionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('IV. PERSONAL STATEMENT', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.brown)),
          const Divider(color: Colors.orange, thickness: 2),
          const SizedBox(height: 24),

          const Text('1. Write a short essay describing yourself. (200-300 words)',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 16),
          TextFormField(
            controller: describeYourselfController,
            maxLines: 6,
            decoration: _dec('Write about yourself...'),
          ),
          const SizedBox(height: 24),

          const Text('2. State briefly your aims and ambition after graduation (include plans for hometown or province). (200-300 words)',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 16),
          TextFormField(
            controller: aimsAndAmbitionController,
            maxLines: 6,
            decoration: _dec('Share your aims and ambitions...'),
          ),
          const SizedBox(height: 32),

          const Text('Tips:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 8),
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
