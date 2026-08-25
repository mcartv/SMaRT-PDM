import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/password_reset_service.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/recovery_service.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/login_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/reset_password_otp_screen.dart';

class _FakePasswordResetService extends PasswordResetService {
  _FakePasswordResetService();

  String? lastStudentId;

  @override
  Future<String> forgotPassword(String studentId) async {
    lastStudentId = studentId;
    return 'If an account exists, password reset instructions have been sent.';
  }
}

void main() {
  group('RecoveryService lookup helpers', () {
    test('normalizes Philippine mobile numbers to 09 format', () {
      expect(
        RecoveryService.normalizeLookupIdentifier('+639123456789'),
        '09123456789',
      );
      expect(
        RecoveryService.normalizeLookupIdentifier('639123456789'),
        '09123456789',
      );
      expect(
        RecoveryService.normalizeLookupIdentifier('9123456789'),
        '09123456789',
      );
      expect(RecoveryService.isValidLookupIdentifier('09123456789'), isTrue);
    });

    test('normalizes email addresses to lowercase', () {
      expect(
        RecoveryService.normalizeLookupIdentifier('User@Example.COM'),
        'user@example.com',
      );
      expect(
        RecoveryService.isValidLookupIdentifier('User@Example.COM'),
        isTrue,
      );
    });
  });

  group('ForgotPasswordScreen', () {
    testWidgets('validates student id format', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ForgotPasswordScreen(
            passwordResetService: _FakePasswordResetService(),
          ),
        ),
      );

      await tester.enterText(find.byType(TextFormField), 'invalid-id');
      await tester.tap(find.text('Send Instructions'));
      await tester.pumpAndSettle();

      expect(
        find.text('Please enter a valid Student ID (e.g., PDM-2024-000123)'),
        findsOneWidget,
      );
    });

    testWidgets('submits student id and navigates to otp screen', (
      WidgetTester tester,
    ) async {
      final fakeService = _FakePasswordResetService();

      await tester.pumpWidget(
        MaterialApp(
          routes: {
            AppRoutes.resetPasswordOtp: (_) => const ResetPasswordOtpScreen(),
          },
          home: ForgotPasswordScreen(passwordResetService: fakeService),
        ),
      );

      await tester.enterText(find.byType(TextFormField), 'PDM-2024-000123');
      await tester.tap(find.text('Send Instructions'));
      await tester.pumpAndSettle();

      expect(fakeService.lastStudentId, 'PDM-2024-000123');
      expect(find.text('Enter Reset Code'), findsOneWidget);
    });
  });

  testWidgets('LoginScreen applies prefilled student id from route arguments', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        onGenerateRoute: (settings) {
          if (settings.name == '/login') {
            return MaterialPageRoute<void>(
              settings: const RouteSettings(
                name: '/login',
                arguments: {
                  'prefillStudentId': 'PDM-2024-000001',
                  'focusPassword': true,
                },
              ),
              builder: (_) => const LoginScreen(),
            );
          }
          return null;
        },
        initialRoute: '/login',
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('PDM-2024-000001'), findsOneWidget);
  });
}
