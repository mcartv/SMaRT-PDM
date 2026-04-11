import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';

class ExistingScholarScreen extends StatelessWidget {
  const ExistingScholarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Update Personal Data'),
        backgroundColor: primaryColor,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(padding),
          child: const Text('This is the form for existing scholars to update their personal data. Content coming soon!'),
        ),
      ),
    );
  }
}
