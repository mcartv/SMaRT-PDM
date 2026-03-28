import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';
import 'package:smartpdm_mobileapp/widgets/shared_widgets.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';
import 'package:smartpdm_mobileapp/screens/step_personal.dart';
import 'package:smartpdm_mobileapp/screens/step_family.dart';
import 'package:smartpdm_mobileapp/screens/step_academic.dart';
import 'package:smartpdm_mobileapp/screens/step_essay_submit.dart';

class NewApplicantScreen extends StatefulWidget {
  const NewApplicantScreen({super.key});

  @override
  State<NewApplicantScreen> createState() => _NewApplicantScreenState();
}

class _NewApplicantScreenState extends State<NewApplicantScreen> {
  int _step = 0;
  final _data = ApplicationData();
  final _scrollCtrl = ScrollController();

  static const _stepLabels = ['Personal', 'Family', 'Academic', 'Essay', 'Submit'];

  void _next() {
    if (_step < 4) {
      setState(() => _step++);
      _scrollCtrl.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    } else {
      if (_data.agree) Navigator.pushReplacementNamed(context, '/success');
    }
  }

  void _back() {
    if (_step > 0) {
      setState(() => _step--);
      _scrollCtrl.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    }
  }

  Widget _buildStep() {
    switch (_step) {
      case 0: return StepPersonal(data: _data, onChanged: () => setState(() {}));
      case 1: return StepFamily(data: _data, onChanged: () => setState(() {}));
      case 2: return StepAcademic(data: _data, onChanged: () => setState(() {}));
      case 3: return StepEssay(data: _data, onChanged: () => setState(() {}));
      case 4: return StepSubmit(data: _data, onChanged: () => setState(() {}));
      default: return const SizedBox();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.darkBrown, AppColors.brown, AppColors.gold],
            stops: [0.0, 0.6, 1.0],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Card(
                margin: const EdgeInsets.all(16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 24,
                shadowColor: Colors.black54,
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    const AppHeader(subtitle: 'New Scholar Application Form'),
                    Expanded(
                      child: SingleChildScrollView(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          children: [
                            // Step indicator
                            StepIndicator(currentStep: _step, labels: _stepLabels),
                            const SizedBox(height: 24),

                            // Step content
                            AnimatedSwitcher(
                              duration: const Duration(milliseconds: 250),
                              child: KeyedSubtree(
                                key: ValueKey(_step),
                                child: _buildStep(),
                              ),
                            ),

                            const SizedBox(height: 24),

                            // Navigation buttons
                            Row(
                              children: [
                                if (_step > 0) ...[
                                  Expanded(child: GhostButton(label: '← Back', onTap: _back)),
                                  const SizedBox(width: 10),
                                ],
                                Expanded(
                                  flex: 2,
                                  child: _step < 4
                                      ? NavyButton(label: 'Next →', onTap: _next)
                                      : GoldButton(
                                          label: 'Submit Application',
                                          onTap: _data.agree ? _next : () {
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              const SnackBar(content: Text('Please check the certification checkbox to proceed.')),
                                            );
                                          },
                                        ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}