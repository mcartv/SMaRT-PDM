import 'package:flutter/material.dart';
import '../constants.dart';

class ExistingScholarScreen extends StatelessWidget {
  const ExistingScholarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Update Personal Data'),
        backgroundColor: primaryColor,
      ),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(padding),
          child: Text('This is the form for existing scholars to update their personal data. Content coming soon!'),
        ),
      ),
    );
  }
}