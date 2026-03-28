import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';

class StepFamily extends StatelessWidget {
  final ApplicationData data;
  final VoidCallback onChanged;

  const StepFamily({super.key, required this.data, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return const Center(child: Text('Family Data Form'));
  }
}