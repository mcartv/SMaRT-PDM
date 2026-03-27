import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/screens/step_academic.dart';
import 'package:smartpdm_mobileapp/screens/step_essay_submit.dart';
import 'package:smartpdm_mobileapp/screens/step_family.dart';
import 'package:smartpdm_mobileapp/screens/step_personal.dart';
import '../constants.dart';

class NewApplicantScreen extends StatefulWidget {
  const NewApplicantScreen({super.key});

  @override
  State<NewApplicantScreen> createState() => _NewApplicantScreenState();
}

class _NewApplicantScreenState extends State<NewApplicantScreen> {
  int _currentStep = 0;
  final PageController _pageController = PageController();

  final List<Step> _steps = [
    Step(
      title: const Text('Personal Data'),
      content: const StepPersonal(),
      isActive: true,
    ),
    Step(
      title: const Text('Family Data'),
      content: const StepFamily(),
      isActive: true,
    ),
    Step(
      title: const Text('Academic Info'),
      content: const StepAcademic(),
      isActive: true,
    ),
    Step(
      title: const Text('Personal Statement'),
      content: const StepEssaySubmit(), // Renamed from step_essay_submit to reflect content
      isActive: true,
    ),
    Step(
      title: const Text('Certification'),
      content: const Center(child: Text('Certification & Submission Checklist')),
      isActive: true,
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Applicant Registration'),
        backgroundColor: primaryColor,
      ),
      body: Stepper(
        type: StepperType.horizontal, // Or StepperType.vertical
        currentStep: _currentStep,
        onStepContinue: () {
          if (_currentStep < _steps.length - 1) {
            setState(() {
              _currentStep++;
            });
            _pageController.animateToPage(
              _currentStep,
              duration: const Duration(milliseconds: 300),
              curve: Curves.ease,
            );
          } else {
            // Last step, submit form
            Navigator.pushReplacementNamed(context, '/success');
          }
        },
        onStepCancel: () {
          if (_currentStep > 0) {
            setState(() {
              _currentStep--;
            });
            _pageController.animateToPage(
              _currentStep,
              duration: const Duration(milliseconds: 300),
              curve: Curves.ease,
            );
          } else {
            Navigator.pop(context); // Go back to dashboard
          }
        },
        steps: _steps,
        controlsBuilder: (context, details) {
          return Padding(
            padding: const EdgeInsets.only(top: 16.0),
            child: Row(
              children: [
                ElevatedButton(onPressed: details.onStepContinue, child: Text(_currentStep == _steps.length - 1 ? 'SUBMIT' : 'NEXT')),
                const SizedBox(width: 10),
                if (_currentStep > 0) TextButton(onPressed: details.onStepCancel, child: const Text('BACK')),
              ],
            ),
          );
        },
      ),
    );
  }
}