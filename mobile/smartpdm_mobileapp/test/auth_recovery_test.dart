import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/auth/data/models/recovery_models.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/recovery_captcha_service.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/recovery_service.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/login_screen.dart';

class _FakeRecoveryService extends RecoveryService {
  _FakeRecoveryService({this.accounts = const []});

  final List<RecoveryAccount> accounts;
  String? lastLookupIdentifier;

  @override
  Future<List<RecoveryAccount>> lookupRecoveryAccounts(
    String identifier,
  ) async {
    lastLookupIdentifier = identifier;
    return accounts;
  }
}

class _FakeCaptchaService extends RecoveryCaptchaService {
  @override
  bool get isSupported => true;

  @override
  Future<String> executePasswordResetCaptcha() async => 'fake-captcha-token';
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
    testWidgets('moves to choose account after a successful lookup', (
      WidgetTester tester,
    ) async {
      final fakeRecoveryService = _FakeRecoveryService(
        accounts: const [
          RecoveryAccount(
            userId: 'user-1',
            displayName: 'Venice Pelima',
            studentId: 'PDM-2024-000001',
            maskedEmail: 'v***@*******',
            maskedPhone: '+63912****89',
            hasEmail: true,
            hasPhone: true,
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ForgotPasswordScreen(
            recoveryService: fakeRecoveryService,
            captchaService: _FakeCaptchaService(),
          ),
        ),
      );

      await tester.enterText(find.byType(TextField).first, '+639123456789');
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(fakeRecoveryService.lastLookupIdentifier, '+639123456789');
      expect(find.text('Choose your account'), findsOneWidget);
      expect(find.text('Venice Pelima'), findsOneWidget);
      expect(find.text('PDM-2024-000001'), findsOneWidget);
    });

    testWidgets('shows available recovery methods after selecting an account', (
      WidgetTester tester,
    ) async {
      final fakeRecoveryService = _FakeRecoveryService(
        accounts: const [
          RecoveryAccount(
            userId: 'user-1',
            displayName: 'Venice Pelima',
            studentId: 'PDM-2024-000001',
            maskedEmail: 'v***@*******',
            maskedPhone: '+63912****89',
            hasEmail: true,
            hasPhone: true,
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ForgotPasswordScreen(
            recoveryService: fakeRecoveryService,
            captchaService: _FakeCaptchaService(),
          ),
        ),
      );

      await tester.enterText(find.byType(TextField).first, '09123456789');
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Venice Pelima'));
      await tester.pumpAndSettle();

      expect(find.text('Choose a way to login'), findsOneWidget);
      expect(find.text('Get code via email'), findsOneWidget);
      expect(find.text('Get code via SMS'), findsOneWidget);
      expect(find.text('Continue with password'), findsOneWidget);
      expect(find.text('Not you?'), findsOneWidget);
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
