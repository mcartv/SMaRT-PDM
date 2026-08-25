import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';

enum PasswordStrength { weak, fair, good, strong }

class PasswordStrengthResult {
  const PasswordStrengthResult({
    required this.strength,
    required this.hasMinLength,
    required this.hasUppercase,
    required this.hasLowercase,
    required this.hasNumber,
  });

  final PasswordStrength strength;
  final bool hasMinLength;
  final bool hasUppercase;
  final bool hasLowercase;
  final bool hasNumber;

  double get score {
    var points = 0;
    if (hasMinLength) points++;
    if (hasUppercase) points++;
    if (hasLowercase) points++;
    if (hasNumber) points++;
    return points / 4;
  }

  static PasswordStrengthResult evaluate(String password) {
    final hasMinLength = password.length >= 8;
    final hasUppercase = RegExp(r'[A-Z]').hasMatch(password);
    final hasLowercase = RegExp(r'[a-z]').hasMatch(password);
    final hasNumber = RegExp(r'\d').hasMatch(password);

    final points = [
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
    ].where((value) => value).length;

    PasswordStrength strength;
    switch (points) {
      case 0:
      case 1:
        strength = PasswordStrength.weak;
      case 2:
        strength = PasswordStrength.fair;
      case 3:
        strength = PasswordStrength.good;
      default:
        strength = PasswordStrength.strong;
    }

    return PasswordStrengthResult(
      strength: strength,
      hasMinLength: hasMinLength,
      hasUppercase: hasUppercase,
      hasLowercase: hasLowercase,
      hasNumber: hasNumber,
    );
  }
}

class PasswordStrengthIndicator extends StatelessWidget {
  const PasswordStrengthIndicator({
    super.key,
    required this.password,
  });

  final String password;

  Color _strengthColor(PasswordStrength strength) {
    switch (strength) {
      case PasswordStrength.weak:
        return Colors.red.shade400;
      case PasswordStrength.fair:
        return Colors.orange.shade400;
      case PasswordStrength.good:
        return Colors.amber.shade600;
      case PasswordStrength.strong:
        return Colors.green.shade600;
    }
  }

  String _strengthLabel(PasswordStrength strength) {
    switch (strength) {
      case PasswordStrength.weak:
        return 'Weak';
      case PasswordStrength.fair:
        return 'Fair';
      case PasswordStrength.good:
        return 'Good';
      case PasswordStrength.strong:
        return 'Strong';
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = PasswordStrengthResult.evaluate(password);
    final color = _strengthColor(result.strength);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: password.isEmpty ? 0 : result.score,
                  minHeight: 6,
                  backgroundColor: Colors.grey.shade200,
                  color: password.isEmpty ? Colors.grey.shade300 : color,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              password.isEmpty ? 'Strength' : _strengthLabel(result.strength),
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: password.isEmpty ? AppColors.lightGray : color,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _RequirementRow(
          label: 'At least 8 characters',
          met: result.hasMinLength,
        ),
        _RequirementRow(
          label: 'One uppercase letter',
          met: result.hasUppercase,
        ),
        _RequirementRow(
          label: 'One lowercase letter',
          met: result.hasLowercase,
        ),
        _RequirementRow(
          label: 'One number',
          met: result.hasNumber,
        ),
      ],
    );
  }
}

class _RequirementRow extends StatelessWidget {
  const _RequirementRow({
    required this.label,
    required this.met,
  });

  final String label;
  final bool met;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(
            met ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
            size: 16,
            color: met ? Colors.green.shade600 : Colors.grey.shade400,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: met ? Colors.green.shade700 : Colors.grey.shade600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
