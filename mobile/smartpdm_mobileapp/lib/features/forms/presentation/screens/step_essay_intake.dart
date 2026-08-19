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
      if (mounted) setState(() {});
    });

    aimsAndAmbitionController.addListener(() {
      widget.data.aimsAndAmbitionEssay = aimsAndAmbitionController.text;
      widget.onChanged();
      if (mounted) setState(() {});
    });
  }

  String? _essayError(String field) {
    if (!widget.showErrors) return null;
    return _validator
        .validateEssayProgression(widget.data)
        .issueForField(field)
        ?.message;
  }

  Widget _essayCard({
    required int number,
    required String title,
    required TextEditingController controller,
    required String hint,
    required String field,
  }) {
    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
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
                    color: intakeTextColor(context),
                    fontSize: 15,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  '$title *',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: intakeTextColor(context),
                    fontWeight: FontWeight.w800,
                    fontSize: 17,
                    height: 1.35,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: controller,
            minLines: 8,
            maxLines: 14,
            textCapitalization: TextCapitalization.sentences,
            decoration: intakeInputDecoration(
              context,
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
          bottomSpacing: 22,
        ),
        const IntakeInfoCard(
          title: 'Essay guidance',
          message:
              'Both responses are required. Write clearly and answer each prompt in your own words. There is no minimum word-count requirement.',
          icon: Icons.info_outline_rounded,
        ),
        const SizedBox(height: 18),
        _essayCard(
          number: 1,
          title: 'Write a short essay describing yourself.',
          controller: describeYourselfController,
          hint: 'Start writing here...',
          field: 'describeYourselfEssay',
        ),
        _essayCard(
          number: 2,
          title:
              'State briefly your aims and ambition after graduation, including plans for your hometown or province.',
          controller: aimsAndAmbitionController,
          hint: 'Start writing here...',
          field: 'aimsAndAmbitionEssay',
        ),
        const IntakeInfoCard(
          title: 'Tips for a strong essay',
          message:
              'Be honest and genuine in your responses.\nProofread for grammar and spelling.\nAnswer the prompt directly.\nUse clear and concise language.',
          icon: Icons.lightbulb_outline_rounded,
        ),
      ],
    );
  }
}
