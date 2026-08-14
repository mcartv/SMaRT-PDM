import 'package:smartpdm_mobileapp/shared/formatters/student_id_input_formatter.dart';

class AppFieldValidators {
  const AppFieldValidators._();

  static final RegExp _namePattern = RegExp(r"^[a-zA-ZñÑ\s.'-]+$");
  static final RegExp _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  static final RegExp _mobilePattern = RegExp(r'^09\d{9}$');
  static final RegExp _zipCodePattern = RegExp(r'^\d{4}$');

  static const Set<String> commonPasswords = {
    '12345678',
    '123456789',
    '1234567890',
    'password',
    'password1',
    'password123',
    'qwerty123',
    'admin123',
    'welcome123',
    'iloveyou',
    'abc12345',
    'letmein123',
    'p@ssw0rd',
  };

  static String? requiredText(
    String? value, {
    required String label,
  }) {
    if ((value ?? '').trim().isEmpty) {
      return '$label is required.';
    }
    return null;
  }

  static String? name(
    String? value, {
    required String label,
    bool required = true,
    int minLength = 2,
  }) {
    final text = (value ?? '').trim();
    if (text.isEmpty) {
      return required ? '$label is required.' : null;
    }
    if (text.length < minLength) {
      return '$label is too short.';
    }
    if (!_namePattern.hasMatch(text)) {
      return 'Enter a valid $label.';
    }
    return null;
  }

  static String? email(
    String? value, {
    String label = 'Email address',
    bool required = true,
  }) {
    final text = (value ?? '').trim().toLowerCase();
    if (text.isEmpty) {
      return required ? '$label is required.' : null;
    }
    if (!_emailPattern.hasMatch(text)) {
      return 'Enter a valid email address.';
    }
    return null;
  }

  static String? differentEmail(
    String? value, {
    required String currentEmail,
  }) {
    final formatError = email(value);
    if (formatError != null) return formatError;

    final next = (value ?? '').trim().toLowerCase();
    if (next == currentEmail.trim().toLowerCase()) {
      return 'Enter an email different from your current email.';
    }
    return null;
  }

  static String normalizePhilippineMobile(String value) {
    final trimmed = value.trim();
    final compact = trimmed.replaceAll(RegExp(r'[\s-]+'), '');
    if (compact.startsWith('+639') && compact.length == 13) {
      return '09${compact.substring(4)}';
    }
    if (compact.startsWith('639') && compact.length == 12) {
      return '09${compact.substring(3)}';
    }
    return compact.replaceAll(RegExp(r'\D'), '');
  }

  static String? philippineMobile(
    String? value, {
    String label = 'Mobile number',
    bool required = true,
  }) {
    final text = (value ?? '').trim();
    if (text.isEmpty) {
      return required ? '$label is required.' : null;
    }
    if (!_mobilePattern.hasMatch(text)) {
      return '$label must be exactly 11 digits and start with 09.';
    }
    return null;
  }

  static String? zipCode(
    String? value, {
    bool required = true,
  }) {
    final text = (value ?? '').trim();
    if (text.isEmpty) {
      return required ? 'ZIP code is required.' : null;
    }
    if (!_zipCodePattern.hasMatch(text)) {
      return 'ZIP code must contain exactly 4 digits.';
    }
    return null;
  }

  static String? yearLevel(
    Object? value, {
    bool required = true,
  }) {
    final text = value?.toString().trim() ?? '';
    if (text.isEmpty) {
      return required ? 'Year level is required.' : null;
    }
    final parsed = int.tryParse(text);
    if (parsed == null || parsed < 1 || parsed > 4) {
      return 'Year level must be 1, 2, 3, or 4.';
    }
    return null;
  }

  static String? studentId(String? value) {
    return StudentIdInputFormatter.validationMessage(value);
  }

  static String? password(String? value) {
    final password = value ?? '';
    if (password.isEmpty) {
      return 'Password is required.';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (!RegExp(r'[A-Z]').hasMatch(password)) {
      return 'Password must contain at least one uppercase letter.';
    }
    if (!RegExp(r'[a-z]').hasMatch(password)) {
      return 'Password must contain at least one lowercase letter.';
    }
    if (!RegExp(r'\d').hasMatch(password)) {
      return 'Password must contain at least one number.';
    }
    if (commonPasswords.contains(password.toLowerCase())) {
      return 'Choose a less common password.';
    }
    return null;
  }

  static String? confirmPassword(
    String? value, {
    required String password,
  }) {
    final confirm = value ?? '';
    if (confirm.isEmpty) {
      return 'Please confirm your password.';
    }
    if (confirm != password) {
      return 'Passwords do not match.';
    }
    return null;
  }
}
