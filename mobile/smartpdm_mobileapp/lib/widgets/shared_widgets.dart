import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';

class AppHeader extends StatelessWidget {
  final String subtitle;
  const AppHeader({super.key, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Text(
        subtitle,
        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.darkBrown),
        textAlign: TextAlign.center,
      ),
    );
  }
}

class StepIndicator extends StatelessWidget {
  final int currentStep;
  final List<String> labels;
  
  const StepIndicator({super.key, required this.currentStep, required this.labels});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: List.generate(labels.length, (index) {
        final isActive = index <= currentStep;
        return Column(
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: isActive ? AppColors.gold : AppColors.lightGray,
              child: Text('${index + 1}', style: TextStyle(color: isActive ? AppColors.darkBrown : Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 4),
            Text(labels[index], style: TextStyle(fontSize: 10, color: isActive ? AppColors.brown : AppColors.lightGray)),
          ],
        );
      }),
    );
  }
}

class GhostButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  
  const GhostButton({super.key, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.brown,
        side: const BorderSide(color: AppColors.brown),
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
      child: Text(label),
    );
  }
}

class NavyButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  
  const NavyButton({super.key, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.darkBrown,
        foregroundColor: AppColors.white,
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
      child: Text(label),
    );
  }
}

class GoldButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  
  const GoldButton({super.key, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.gold,
        foregroundColor: AppColors.darkBrown,
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
    );
  }
}