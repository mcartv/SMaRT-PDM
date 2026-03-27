import 'package:flutter/material.dart';

class StepFamily extends StatelessWidget {
  const StepFamily({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Family Data Form (Father, mother, sibling, guardian info blocks; educational attainment, occupation, company address, Marilao native status)'),
          // TODO: Implement actual form fields here
        ],
      ),
    );
  }
}