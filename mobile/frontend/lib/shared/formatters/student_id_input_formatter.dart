import 'package:flutter/services.dart';

class StudentIdInputFormatter extends TextInputFormatter {
  const StudentIdInputFormatter();

  static final RegExp _studentIdPattern = RegExp(r'^PDM-\d{4}-\d{6}$');

  static String digitsOnly(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    return digits.length > 10 ? digits.substring(0, 10) : digits;
  }

  static String formatVisible(String value) {
    final limited = digitsOnly(value);

    if (limited.length <= 4) {
      return limited;
    }

    return '${limited.substring(0, 4)}-${limited.substring(4)}';
  }

  static String toFullStudentId(String value) {
    final digits = digitsOnly(value);

    if (digits.length != 10) {
      return '';
    }

    return 'PDM-${digits.substring(0, 4)}-${digits.substring(4)}';
  }

  static String stripPdmPrefix(String value) {
    return digitsOnly(value.toUpperCase().replaceAll('PDM-', ''));
  }

  static bool isValid(String value) {
    return _studentIdPattern.hasMatch(toFullStudentId(value));
  }

  static String? validationMessage(String? value) {
    final digits = digitsOnly(value ?? '');

    if (digits.isEmpty) {
      return 'Student ID is required.';
    }

    if (digits.length < 10) {
      return 'Student ID must contain 10 digits.';
    }

    if (!_studentIdPattern.hasMatch(toFullStudentId(value ?? ''))) {
      return 'Use the format PDM-0000-000000.';
    }

    return null;
  }

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final formatted = formatVisible(newValue.text);

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
