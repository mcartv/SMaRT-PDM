import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/auth_service.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/password_reset_service.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/login_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/register_screen.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_essay_intake.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

class _FakeAuthService extends AuthService {
  var loginCalls = 0;
  var registerCalls = 0;
  Completer<AuthResult>? loginCompleter;

  @override
  Future<AuthResult> login({
    required String studentId,
    required String password,
  }) {
    loginCalls += 1;
    return (loginCompleter ??= Completer<AuthResult>()).future;
  }

  @override
  Future<RegistrationResult> register({
    required String email,
    required String password,
    required String studentId,
  }) async {
    registerCalls += 1;
    return RegistrationResult(
      userId: 'user-1',
      studentId: studentId,
      email: email,
      message: 'OTP sent.',
    );
  }
}

class _FakePasswordResetService extends PasswordResetService {
  var calls = 0;

  @override
  Future<String> forgotPassword(String studentId) async {
    calls += 1;
    return 'Reset instructions sent.';
  }
}

void main() {
  testWidgets('login Enter validates then submits once while loading', (
    tester,
  ) async {
    final auth = _FakeAuthService();
    await tester.pumpWidget(
      MaterialApp(
        routes: {AppRoutes.home: (_) => const Scaffold(body: Text('Home'))},
        home: LoginScreen(authService: auth),
      ),
    );

    final fields = find.byType(TextFormField);
    await tester.tap(fields.at(1));
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(find.text('Enter your password.'), findsOneWidget);
    expect(auth.loginCalls, 0);

    await tester.enterText(fields.first, '2024-000123');
    await tester.enterText(fields.at(1), 'Secret123!');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(auth.loginCalls, 1);
  });

  testWidgets('auth forms expose browser-compatible autofill semantics', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
    final loginFields = tester
        .widgetList<EditableText>(find.byType(EditableText))
        .toList();
    expect(loginFields.first.autofillHints, contains(AutofillHints.username));
    expect(loginFields.last.autofillHints, contains(AutofillHints.password));
    expect(find.byType(AutofillGroup), findsOneWidget);

    await tester.pumpWidget(const MaterialApp(home: RegisterScreen()));
    final registrationFields = tester
        .widgetList<EditableText>(find.byType(EditableText))
        .toList();
    expect(registrationFields[1].autofillHints, contains(AutofillHints.email));
    expect(
      registrationFields[2].autofillHints,
      contains(AutofillHints.newPassword),
    );
    expect(find.byType(AutofillGroup), findsOneWidget);
  });

  testWidgets('login password visibility toggle remains keyboard-accessible', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
    final passwordInput = find.byType(EditableText).last;
    expect(tester.widget<EditableText>(passwordInput).obscureText, isTrue);

    await tester.tap(find.byIcon(Icons.visibility_off_rounded));
    await tester.pump();
    expect(tester.widget<EditableText>(passwordInput).obscureText, isFalse);
  });

  testWidgets(
    'registration Enter advances but does not submit before consent',
    (tester) async {
      final auth = _FakeAuthService();
      await tester.pumpWidget(
        MaterialApp(home: RegisterScreen(authService: auth)),
      );
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.first, '2024-000123');
      await tester.enterText(fields.at(1), 'student@example.com');
      await tester.enterText(fields.at(2), 'Secret123!');
      await tester.enterText(fields.at(3), 'Secret123!');
      await tester.ensureVisible(fields.at(3));
      await tester.tap(fields.at(3));
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();
      expect(auth.registerCalls, 0);
    },
  );

  testWidgets('forgot-password Enter submits a valid student ID once', (
    tester,
  ) async {
    final service = _FakePasswordResetService();
    await tester.pumpWidget(
      MaterialApp(
        routes: {
          AppRoutes.resetPasswordOtp: (_) => const Scaffold(body: Text('OTP')),
        },
        home: ForgotPasswordScreen(passwordResetService: service),
      ),
    );
    await tester.enterText(find.byType(TextFormField), '2024-000123');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(service.calls, 1);
  });

  testWidgets(
    'essay Enter remains a newline and cannot submit an application',
    (tester) async {
      final data = ApplicationData();
      var changes = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: StepEssay(data: data, onChanged: () => changes += 1),
            ),
          ),
        ),
      );

      final essay = find.byType(TextFormField).first;
      await tester.enterText(essay, 'First line\nSecond line');
      await tester.pump();
      expect(data.describeYourselfEssay, 'First line\nSecond line');
      expect(changes, greaterThan(0));
      expect(
        tester
            .widget<EditableText>(find.byType(EditableText).first)
            .textInputAction,
        TextInputAction.newline,
      );
    },
  );
}
