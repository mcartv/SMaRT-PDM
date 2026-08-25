import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.label});

  final String label;

  Color _color() {
    final value = label.trim().toLowerCase();
    if (value.contains('verified') ||
        value.contains('selected') ||
        value.contains('active') ||
        value.contains('released') ||
        value.contains('promoted')) {
      return Colors.green;
    }
    if (value.contains('reject') ||
        value.contains('not selected') ||
        value.contains('resubmission') ||
        value.contains('missing')) {
      return Colors.red;
    }
    if (value.contains('wait') ||
        value.contains('pending') ||
        value.contains('review') ||
        value.contains('qualified')) {
      return Colors.orange;
    }
    return Colors.blueGrey;
  }

  @override
  Widget build(BuildContext context) {
    final color = _color();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
  }
}
