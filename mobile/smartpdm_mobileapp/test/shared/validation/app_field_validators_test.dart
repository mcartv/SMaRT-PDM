import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/shared/validation/app_field_validators.dart';

void main() {
  group('AppFieldValidators', () {
    test('uses one Philippine mobile rule', () {
      expect(AppFieldValidators.philippineMobile('09123456789'), isNull);
      expect(
        AppFieldValidators.philippineMobile('9123456789'),
        'Mobile number must be exactly 11 digits and start with 09.',
      );
      expect(
        AppFieldValidators.philippineMobile('08123456789'),
        'Mobile number must be exactly 11 digits and start with 09.',
      );
      expect(
        AppFieldValidators.normalizePhilippineMobile('+639123456789'),
        '09123456789',
      );
    });

    test('validates names and email consistently', () {
      expect(
        AppFieldValidators.name("Dela Cruz-O'Neil", label: 'Name'),
        isNull,
      );
      expect(AppFieldValidators.name('Peña', label: 'Name'), isNull);
      expect(
        AppFieldValidators.name(
          'A',
          label: 'Middle name',
          required: false,
          minLength: 1,
        ),
        isNull,
      );
      expect(
        AppFieldValidators.name(
          '',
          label: 'Middle name',
          required: false,
          minLength: 1,
        ),
        isNull,
      );
      expect(
        AppFieldValidators.name('Name123', label: 'Name'),
        'Enter a valid Name.',
      );
      expect(AppFieldValidators.email('student@pdm.edu.ph'), isNull);
      expect(
        AppFieldValidators.email('student@'),
        'Enter a valid email address.',
      );
    });

    test('requires four-digit ZIP codes and year levels 1 through 4', () {
      expect(AppFieldValidators.zipCode('3019'), isNull);
      expect(
        AppFieldValidators.zipCode('301'),
        'ZIP code must contain exactly 4 digits.',
      );
      expect(AppFieldValidators.yearLevel(1), isNull);
      expect(AppFieldValidators.yearLevel(4), isNull);
      expect(
        AppFieldValidators.yearLevel(5),
        'Year level must be 1, 2, 3, or 4.',
      );
    });

    test('uses the reset-password strength policy everywhere', () {
      expect(AppFieldValidators.password('StrongPass123'), isNull);
      expect(
        AppFieldValidators.password('lowercase123'),
        'Password must contain at least one uppercase letter.',
      );
      expect(
        AppFieldValidators.password('Welcome123'),
        'Choose a less common password.',
      );
    });

    test('validates canonical student IDs through the shared formatter', () {
      expect(AppFieldValidators.studentId('2026-000001'), isNull);
      expect(
        AppFieldValidators.studentId('2026-00001'),
        'Student ID must contain 10 digits.',
      );
    });
  });
}
