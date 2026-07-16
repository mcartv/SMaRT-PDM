import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/features/forms/domain/validation/application_submission_validator.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/intake_form_ui.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

class StepEssay extends StatefulWidget {
  const StepEssay({
    super.key,
    required this.data,
    required this.onChanged,
    this.showErrors = false,
  });

  final ApplicationData data;
  final VoidCallback onChanged;
  final bool showErrors;

  @override
  State<StepEssay> createState() => _StepEssayState();
}

class _StepEssayState extends State<StepEssay> {
  static const ApplicationSubmissionValidator _validator =
      ApplicationSubmissionValidator();
  late final TextEditingController describeYourselfController;
  late final TextEditingController aimsAndAmbitionController;

  @override
  void initState() {
    super.initState();
    describeYourselfController = TextEditingController(
      text: widget.data.describeYourselfEssay,
    );
    aimsAndAmbitionController = TextEditingController(
      text: widget.data.aimsAndAmbitionEssay,
    );

    describeYourselfController.addListener(() {
      widget.data.describeYourselfEssay = describeYourselfController.text;
      widget.onChanged();
      setState(() {});
    });
    aimsAndAmbitionController.addListener(() {
      widget.data.aimsAndAmbitionEssay = aimsAndAmbitionController.text;
      widget.onChanged();
      setState(() {});
    });
  }

  int _wordCount(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return 0;
    return trimmed.split(RegExp(r'\s+')).length;
  }

  String? _essayError(String field) {
    if (!widget.showErrors) return null;
    return _validator.validateEssayProgression(widget.data).issueForField(field)
        ?.message;
  }

  Widget _essayCard({
    required int number,
    required String title,
    required TextEditingController controller,
    required String hint,
    required String errorLabel,
    required String field,
  }) {
    final count = _wordCount(controller.text);
    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: const BoxDecoration(
                  color: Color(0xFFFFC31A),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  '$number',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: IntakePalette.text,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: IntakePalette.text,
                    fontWeight: FontWeight.w800,
                    height: 1.35,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              '$count / 300 words',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: IntakePalette.subtext.withValues(alpha: 0.75),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: controller,
            maxLines: 7,
            decoration: intakeInputDecoration(
              hint: hint,
              errorText: _essayError(field),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    describeYourselfController.dispose();
    aimsAndAmbitionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IntakeSectionHeader(
          title: 'PERSONAL STATEMENT',
          icon: Icons.edit_outlined,
        ),
        _essayCard(
          number: 1,
          title: 'Write a short essay describing yourself. (200-300 words)',
          controller: describeYourselfController,
          hint: 'Start writing here...',
          errorLabel: 'Describe yourself essay',
          field: 'describeYourselfEssay',
        ),
        _essayCard(
          number: 2,
          title:
              'State briefly your aims and ambition after graduation (include plans for hometown or province). (200-300 words)',
          controller: aimsAndAmbitionController,
          hint: 'Start writing here...',
          errorLabel: 'Aims and ambition essay',
          field: 'aimsAndAmbitionEssay',
        ),
        const IntakeInfoCard(
          title: 'Tips for a strong essay',
          message:
              'Be honest and genuine in your responses.\nProofread for grammar and spelling.\nStay within the word limit.\nUse clear and concise language.',
          icon: Icons.lightbulb_outline_rounded,
        ),
      ],
    );
  }
}
