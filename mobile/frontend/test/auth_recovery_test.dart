import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/password_reset_service.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/recovery_service.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/login_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/otp_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/register_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/reset_password_otp_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/reset_password_screen.dart';

class _FakePasswordResetService extends PasswordResetService {
  _FakePasswordResetService();

  String? lastStudentId;

  @override
  Future<String> forgotPassword(String studentId) async {
    lastStudentId = studentId;
    return 'If an account exists, password reset instructions have been sent.';
  }
}

class _PendingPasswordResetService extends PasswordResetService {
  final result = Completer<String>();
  int calls = 0;

  @override
  Future<String> resetPassword({
    required String studentId,
    required String otp,
    required String password,
    required String confirmPassword,
  }) {
    calls++;
    return result.future;
  }
}

void main() {
  for (final useSystemBack in [false, true]) {
    testWidgets(
      'registration OTP handles ${useSystemBack ? 'system' : 'toolbar'} back',
      (tester) async {
        final navigatorKey = GlobalKey<NavigatorState>();
        await tester.pumpWidget(
          MaterialApp(
            navigatorKey: navigatorKey,
            home: const Scaffold(body: Text('Registration')),
          ),
        );
        unawaited(
          navigatorKey.currentState!.push<void>(
            MaterialPageRoute<void>(builder: (_) => const OtpScreen()),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Verify Code'), findsOneWidget);
        if (useSystemBack) {
          await tester.binding.handlePopRoute();
        } else {
          await tester.tap(find.byIcon(Icons.arrow_back));
        }
        await tester.pumpAndSettle();
        expect(find.text('Registration'), findsOneWidget);
        expect(find.byType(OtpScreen), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }

  for (final error in [
    const ApiException('Reset code expired.', statusCode: 400),
    StateError('Connection interrupted'),
  ]) {
    testWidgets(
      'reset failure after leaving is safe for ${error.runtimeType}',
      (tester) async {
        final service = _PendingPasswordResetService();
        final navigatorKey = GlobalKey<NavigatorState>();
        await tester.pumpWidget(
          MaterialApp(navigatorKey: navigatorKey, home: const Scaffold()),
        );
        unawaited(
          navigatorKey.currentState!.push<void>(
            MaterialPageRoute<void>(
              settings: const RouteSettings(
                arguments: {'studentId': 'PDM-2024-000123', 'otp': '123456'},
              ),
              builder: (_) =>
                  ResetPasswordScreen(passwordResetService: service),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final fields = find.byType(TextFormField);
        await tester.enterText(fields.first, 'Secret123!');
        await tester.enterText(fields.last, 'Secret123!');
        await tester.ensureVisible(find.text('Reset Password'));
        await tester.tap(find.text('Reset Password'));
        await tester.pump();
        expect(service.calls, 1);

        await tester.pumpWidget(const SizedBox.shrink());
        service.result.completeError(error);
        await tester.pump();
        expect(tester.takeException(), isNull);
      },
    );
  }

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

      await tester.enterText(find.byType(TextFormField), '2026123');
      await tester.tap(find.text('Send Verification Code'));
      await tester.pumpAndSettle();

      expect(find.text('Student ID must contain 10 digits.'), findsOneWidget);
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
      await tester.tap(find.text('Send Verification Code'));
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

  testWidgets('Phase 2 auth screens remain usable at 320px width', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MaterialApp(home: RegisterScreen()));
    await tester.pump();
    expect(find.text('Finish account setup'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const MaterialApp(home: OtpScreen()));
    await tester.pump();
    expect(find.text('Verify Code'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(6));
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const MaterialApp(home: ResetPasswordOtpScreen()));
    await tester.pump();
    expect(find.text('Verify Code'), findsWidgets);
    expect(find.byType(TextFormField), findsNWidgets(6));
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const MaterialApp(home: ResetPasswordScreen()));
    await tester.pump();
    expect(find.text('Create a new password'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
