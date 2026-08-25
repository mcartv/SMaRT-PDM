import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:smartpdm_mobileapp/core/config/app_config.dart';

class RecoveryCaptchaService {
  RecoveryCaptchaService();

  static const MethodChannel _channel = MethodChannel(
    'smartpdm/recovery_captcha',
  );

  bool get isSupported =>
      !kIsWeb &&
      defaultTargetPlatform == TargetPlatform.android &&
      AppConfig.recaptchaAndroidSiteKey.isNotEmpty;

  Future<String> executePasswordResetCaptcha() async {
    if (!isSupported) {
      throw Exception(
        'Account recovery verification is currently available on Android only.',
      );
    }

    try {
      final token = await _channel.invokeMethod<String>('executeCaptcha', {
        'siteKey': AppConfig.recaptchaAndroidSiteKey,
        'action': 'password_reset',
      });

      if (token == null || token.trim().isEmpty) {
        throw Exception('The security challenge did not return a token.');
      }

      return token.trim();
    } on PlatformException catch (error) {
      final message = error.message?.trim();
      throw Exception(
        message == null || message.isEmpty
            ? 'Unable to complete the security challenge.'
            : message,
      );
    }
  }
}
