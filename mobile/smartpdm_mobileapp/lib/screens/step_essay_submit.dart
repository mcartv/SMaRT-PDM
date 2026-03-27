import 'package:flutter/material.dart';

class StepEssaySubmit extends StatelessWidget {
  const StepEssaySubmit({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Personal Statement Form (Self-description essay + aims and ambitions after graduation)'),
          // TODO: Implement actual form fields here
        ],
      ),
    );
  }
}