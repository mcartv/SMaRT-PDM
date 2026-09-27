import 'package:flutter/material.dart';

/// Keeps the complete account name on one line and scales it down only when
/// the available card width is too narrow.
class ResponsiveDisplayName extends StatelessWidget {
  const ResponsiveDisplayName({super.key, required this.name, this.style});

  final String name;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final fullName = name.trim();

    return Semantics(
      label: fullName,
      child: ExcludeSemantics(
        child: FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(fullName, maxLines: 1, softWrap: false, style: style),
        ),
      ),
    );
  }
}
