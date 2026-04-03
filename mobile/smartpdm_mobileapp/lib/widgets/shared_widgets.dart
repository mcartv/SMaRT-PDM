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
        style: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.bold,
          color: AppColors.darkBrown,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

class StepIndicator extends StatelessWidget {
  final int currentStep;
  final List<String> labels;

  const StepIndicator({
    super.key,
    required this.currentStep,
    required this.labels,
  });

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
              child: Text(
                '${index + 1}',
                style: TextStyle(
                  color: isActive ? AppColors.darkBrown : Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              labels[index],
              style: TextStyle(
                fontSize: 10,
                color: isActive ? AppColors.brown : AppColors.lightGray,
              ),
            ),
          ],
        );
      }),
    );
  }
}

class GhostButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final Widget? icon;

  const GhostButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.brown,
        side: const BorderSide(color: AppColors.brown),
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
      child: icon == null
          ? Text(label)
          : Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [icon!, const SizedBox(width: 8), Text(label)],
            ),
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

/// Simple Google "G" mark built with canvas (avoids extra assets/packages).
class GoogleLogo extends StatelessWidget {
  final double size;
  const GoogleLogo({super.key, this.size = 20});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _GoogleLogoPainter()),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  static const _blue = Color(0xFF4285F4);
  static const _red = Color(0xFFDB4437);
  static const _yellow = Color(0xFFF4B400);
  static const _green = Color(0xFF0F9D58);

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.22;
    final rect = Rect.fromLTWH(
      stroke,
      stroke,
      size.width - 2 * stroke,
      size.height - 2 * stroke,
    );
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    // Blue arc (start)
    paint.color = _blue;
    canvas.drawArc(rect, -0.25 * 3.1416, 0.9 * 3.1416, false, paint);

    // Red arc
    paint.color = _red;
    canvas.drawArc(rect, 0.65 * 3.1416, 0.45 * 3.1416, false, paint);

    // Yellow arc
    paint.color = _yellow;
    canvas.drawArc(rect, 1.1 * 3.1416, 0.45 * 3.1416, false, paint);

    // Green arc (closing)
    paint.color = _green;
    canvas.drawArc(rect, 1.55 * 3.1416, 0.4 * 3.1416, false, paint);

    // Horizontal bar of the "G"
    paint
      ..color = _blue
      ..strokeCap = StrokeCap.square;
    final centerY = size.height / 2;
    final startX = size.width * 0.55;
    final endX = size.width * 0.86;
    canvas.drawLine(Offset(startX, centerY), Offset(endX, centerY), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
