import 'package:flutter/material.dart';

class StepPersonal extends StatelessWidget {
  const StepPersonal({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Personal Data Form (Full name, DOB, sex, civil status, religion, permanent address, contact info)'),
          // TODO: Implement actual form fields here
        ],
      ),
    );
  }
}