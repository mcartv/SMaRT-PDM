import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';

class StepEssay extends StatelessWidget {
  final ApplicationData data;
  final VoidCallback onChanged;

  const StepEssay({super.key, required this.data, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('Essay Form'));
  }
}

class StepSubmit extends StatelessWidget {
  final ApplicationData data;
  final VoidCallback onChanged;

  const StepSubmit({super.key, required this.data, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text('Review your application before submitting.'),
        Row(
          children: [
            Checkbox(
              value: data.agree,
              onChanged: (val) { data.agree = val ?? false; onChanged(); },
            ),
            const Expanded(child: Text('I certify that the information provided is true and correct.')),
          ],
        ),
      ],
    );
  }
}