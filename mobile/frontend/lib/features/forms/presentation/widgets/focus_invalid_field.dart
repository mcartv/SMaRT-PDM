// SMaRT-PDM: focus invalid field — focus invalid field (mobile widget); renders reusable mobile UI behavior.
import 'package:flutter/material.dart';

/// Call after error decorations have rebuilt. Traversal follows visual field
/// order and works for both text inputs and decorated dropdowns.
bool focusFirstInvalidField(BuildContext context) {
  Element? target;
  // findInvalid: finds and returns find invalid for the focus invalid field flow.
  void findInvalid(Element element) {
    if (target != null) return;
    final widget = element.widget;
    if (widget is InputDecorator &&
        (widget.decoration.errorText != null ||
            widget.decoration.error != null)) {
      target = element;
      return;
    }
    element.visitChildren(findInvalid);
  }

  context.visitChildElements(findInvalid);
  final invalid = target;
  if (invalid == null) return false;

  EditableText? input;
  // findInput: finds and returns find input for the focus invalid field flow.
  void findInput(Element element) {
    if (element.widget is EditableText) {
      input = element.widget as EditableText;
      return;
    }
    element.visitChildren(findInput);
  }

  invalid.visitChildren(findInput);
  if (input != null && !input!.readOnly) {
    input!.focusNode.requestFocus();
  } else {
    FocusScope.of(context).unfocus();
  }
  Scrollable.ensureVisible(
    invalid,
    alignment: 0.15,
    duration: const Duration(milliseconds: 300),
    curve: Curves.easeOut,
  );
  return true;
}
