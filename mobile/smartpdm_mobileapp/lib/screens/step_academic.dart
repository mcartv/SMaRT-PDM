import 'package:flutter/material.dart';

class StepAcademic extends StatelessWidget {
  const StepAcademic({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Academic Information Form (Educational background table, current enrollment, financial support, scholarship/disciplinary history)'),
          // TODO: Implement actual form fields here
        ],
      ),
    );
  }
}