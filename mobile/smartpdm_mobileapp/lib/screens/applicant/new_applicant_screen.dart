import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';
import 'package:smartpdm_mobileapp/screens/forms/step_academic.dart';
import 'package:smartpdm_mobileapp/screens/forms/step_essay.dart';
import 'package:smartpdm_mobileapp/screens/forms/step_family.dart';
import 'package:smartpdm_mobileapp/screens/forms/step_personal.dart';
import 'package:smartpdm_mobileapp/screens/forms/step_submit.dart';
import 'package:smartpdm_mobileapp/screens/providers/new_scholar_provider.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';
import 'package:smartpdm_mobileapp/widgets/shared_widgets.dart';

class NewApplicantScreen extends StatefulWidget {
  const NewApplicantScreen({super.key});

  @override
  State<NewApplicantScreen> createState() => _NewApplicantScreenState();
}

class _NewApplicantScreenState extends State<NewApplicantScreen> {
  int _step = 0;
  final _data = ApplicationData();
  final _scrollCtrl = ScrollController();
  bool _isBootstrapping = true;

  static const _stepLabels = [
    'Personal',
    'Family',
    'Academic',
    'Essay',
    'Submit',
  ];

  @override
  void initState() {
    super.initState();
    _bootstrapFormData();
  }

  Future<void> _bootstrapFormData() async {
    final prefs = await SharedPreferences.getInstance();

    _data.userId = prefs.getString('user_id') ?? '';
    _data.accountStudentId = prefs.getString('user_student_id') ?? '';
    _data.studentNumber = _data.accountStudentId;
    _data.email = prefs.getString('user_email') ?? '';
    _data.firstName = prefs.getString('user_first_name') ?? '';
    _data.lastName = prefs.getString('user_last_name') ?? '';
    _data.mobileNumber = prefs.getString('user_phone') ?? '';
    _data.currentCourse = prefs.getString('user_course') ?? '';
    _data.currentSection = prefs.getString('user_section') ?? '';

    if (!mounted) return;
    setState(() => _isBootstrapping = false);
  }

  void _next() {
    if (_step < 4) {
      setState(() => _step++);
      _scrollCtrl.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  void _back() {
    if (_step > 0) {
      setState(() => _step--);
      _scrollCtrl.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _submitApplication() async {
    if (!_data.agree) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please check the certification checkbox to proceed.'),
        ),
      );
      return;
    }

    if (_data.userId.isEmpty || _data.accountStudentId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Your account details are missing. Please log in again.',
          ),
        ),
      );
      return;
    }

    if (_data.programId.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Please select a scholarship program before submitting.',
          ),
        ),
      );
      return;
    }

    final provider = context.read<NewScholarProvider>();
    final success = await provider.submitApplication(_data);

    if (!mounted) return;

    if (success) {
      Navigator.pushReplacementNamed(context, '/success');
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          provider.submissionError ?? 'Failed to submit application.',
        ),
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case 0:
        return StepPersonal(data: _data, onChanged: () => setState(() {}));
      case 1:
        return StepFamily(data: _data, onChanged: () => setState(() {}));
      case 2:
        return StepAcademic(data: _data, onChanged: () => setState(() {}));
      case 3:
        return StepEssay(data: _data, onChanged: () => setState(() {}));
      case 4:
        return StepSubmit(data: _data, onChanged: () => setState(() {}));
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NewScholarProvider>();

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
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: AppColors.gold, width: 2),
                ),
                elevation: 24,
                shadowColor: Colors.black87,
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
                            StepIndicator(
                              currentStep: _step,
                              labels: _stepLabels,
                            ),
                            const SizedBox(height: 24),
                            if (_isBootstrapping)
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 48),
                                child: CircularProgressIndicator(),
                              )
                            else
                              AnimatedSwitcher(
                                duration: const Duration(milliseconds: 250),
                                child: KeyedSubtree(
                                  key: ValueKey(_step),
                                  child: _buildStep(),
                                ),
                              ),
                            const SizedBox(height: 24),
                            Row(
                              children: [
                                if (_step > 0) ...[
                                  Expanded(
                                    child: GhostButton(
                                      label: 'Back',
                                      onTap: _back,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                ],
                                Expanded(
                                  flex: 2,
                                  child: _step < 4
                                      ? NavyButton(label: 'Next', onTap: _next)
                                      : provider.isLoading
                                      ? const Center(
                                          child: SizedBox(
                                            height: 24,
                                            width: 24,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          ),
                                        )
                                      : GoldButton(
                                          label: 'Submit Application',
                                          onTap: _submitApplication,
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
