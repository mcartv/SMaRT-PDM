// SMaRT-PDM: philippine mobile input formatter — philippine mobile input formatter (mobile frontend); supports mobile UI behavior.
import 'package:flutter/services.dart';

class PhilippineMobileInputFormatter extends TextInputFormatter {
  const PhilippineMobileInputFormatter();

  @override
  // formatEditUpdate: formats format edit update for the philippine mobile input formatter flow.
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 11) {
      digits = digits.substring(0, 11);
    }

    if (digits.isNotEmpty && !digits.startsWith('0')) {
      return oldValue;
    }
    if (digits.length >= 2 && !digits.startsWith('09')) {
      return oldValue;
    }

    return TextEditingValue(
      text: digits,
      selection: TextSelection.collapsed(offset: digits.length),
    );
  }
}
