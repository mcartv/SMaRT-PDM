import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/shared/validation/app_field_validators.dart';

void main() {
  group('AppFieldValidators', () {
    test('required text rejects blank and whitespace-only values', () {
      expect(
        AppFieldValidators.requiredText('', label: 'First name'),
        'First name is required.',
      );
      expect(
        AppFieldValidators.requiredText('     ', label: 'First name'),
        'First name is required.',
      );
      expect(
        AppFieldValidators.requiredText('  Teresa  ', label: 'First name'),
        isNull,
      );
    });

    test('required text supports safe field-specific length limits', () {
      expect(
        AppFieldValidators.requiredText('A', label: 'Address', minLength: 2),
        'Address must contain at least 2 characters.',
      );

      expect(
        AppFieldValidators.requiredText(
          '123456',
          label: 'Reference',
          maxLength: 5,
        ),
        'Reference must not exceed 5 characters.',
      );
    });

    test('uses one Philippine mobile rule', () {
      expect(AppFieldValidators.philippineMobile('09123456789'), isNull);

      // International/canonical account values are accepted after
      // normalization and resolve to the same 09XXXXXXXXX rule.
      expect(AppFieldValidators.philippineMobile('+639123456789'), isNull);
      expect(AppFieldValidators.philippineMobile('639123456789'), isNull);
      expect(AppFieldValidators.philippineMobile('0912 345 6789'), isNull);
      expect(AppFieldValidators.philippineMobile('0912-345-6789'), isNull);

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

    test('validates Filipino and compound names consistently', () {
      expect(
        AppFieldValidators.name("Dela Cruz-O'Neil", label: 'Name'),
        isNull,
      );
      expect(AppFieldValidators.name('Peña', label: 'Name'), isNull);
      expect(AppFieldValidators.name('Mary Anne', label: 'First name'), isNull);
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
    });

    test('validates email consistently', () {
      expect(AppFieldValidators.email('student@pdm.edu.ph'), isNull);
      expect(
        AppFieldValidators.email('student@'),
        'Enter a valid email address.',
      );
      expect(AppFieldValidators.email('     '), 'Email address is required.');
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
