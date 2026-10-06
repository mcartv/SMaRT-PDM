// SMaRT-PDM: Scholars — existing scholar screen (mobile screen); loads state, handles user actions, and renders the screen.
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';

class ExistingScholarScreen extends StatelessWidget {
  const ExistingScholarScreen({super.key});

  @override
  // build: builds build for the Scholars flow.
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Update Personal Data'),
        backgroundColor: primaryColor,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(padding),
          child: const Text(
            'This is the form for existing scholars to update their personal data. Content coming soon!',
          ),
        ),
      ),
    );
  }
}
