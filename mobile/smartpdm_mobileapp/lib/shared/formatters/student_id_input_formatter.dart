import 'package:flutter/services.dart';

class StudentIdInputFormatter extends TextInputFormatter {
  const StudentIdInputFormatter();

  static String digitsOnly(String value) {
    return value
        .replaceAll(RegExp(r'\D'), '')
        .substring(0, value.replaceAll(RegExp(r'\D'), '').length.clamp(0, 10));
  }

  static String formatVisible(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');

    final limited = digits.length > 10 ? digits.substring(0, 10) : digits;

    if (limited.length <= 4) {
      return limited;
    }

    return '${limited.substring(0, 4)}-${limited.substring(4)}';
  }

  static String toFullStudentId(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');

    if (digits.length != 10) {
      return '';
    }

    return 'PDM-${digits.substring(0, 4)}-${digits.substring(4)}';
  }

  static String stripPdmPrefix(String value) {
    return value
        .toUpperCase()
        .replaceAll('PDM-', '')
        .replaceAll(RegExp(r'[^0-9]'), '');
  }

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');

    final limited = digits.length > 10 ? digits.substring(0, 10) : digits;

    final formatted = formatVisible(limited);

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
