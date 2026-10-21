import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

class SignaturePadController extends ChangeNotifier {
  final List<List<Offset>> _strokes = <List<Offset>>[];
  List<List<Offset>> get strokes => List.unmodifiable(_strokes);
  bool get isEmpty => _strokes.every((stroke) => stroke.isEmpty);

  void begin(Offset point) {
    _strokes.add(<Offset>[point]);
    notifyListeners();
  }

  void add(Offset point) {
    if (_strokes.isNotEmpty) {
      _strokes.last.add(point);
    }
    notifyListeners();
  }

  void clear() {
    _strokes.clear();
    notifyListeners();
  }
}

class SignaturePad extends StatelessWidget {
  const SignaturePad({
    super.key,
    required this.controller,
    required this.label,
  });

  final SignaturePadController controller;
  final String label;

  @override
  Widget build(BuildContext context) => Semantics(
    label: '$label signature canvas',
    child: Container(
      height: 190,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Theme.of(context).colorScheme.outline),
        borderRadius: BorderRadius.circular(12),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(11),
        child: GestureDetector(
          onPanStart: (details) => controller.begin(details.localPosition),
          onPanUpdate: (details) => controller.add(details.localPosition),
          child: AnimatedBuilder(
            animation: controller,
            builder: (_, _) => CustomPaint(
              painter: _SignaturePainter(controller.strokes),
              child: const SizedBox.expand(),
            ),
          ),
        ),
      ),
    ),
  );
}

class _SignaturePainter extends CustomPainter {
  const _SignaturePainter(this.strokes);
  final List<List<Offset>> strokes;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF1C2833)
      ..strokeWidth = 2.6
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    for (final stroke in strokes) {
      if (stroke.length == 1) {
        canvas.drawPoints(ui.PointMode.points, stroke, paint);
      }
      for (var index = 1; index < stroke.length; index++) {
        canvas.drawLine(stroke[index - 1], stroke[index], paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}

Future<Uint8List> exportSignaturePng(SignaturePadController controller) async {
  if (controller.isEmpty) throw StateError('Signature is empty.');
  const size = Size(900, 360);
  final recorder = ui.PictureRecorder();
  // The pad itself remains white for usability, but exported evidence must
  // retain alpha so it can overlay the official PDF without obscuring it.
  final canvas = Canvas(recorder);
  _SignaturePainter(controller.strokes).paint(canvas, size);
  final image = await recorder.endRecording().toImage(
    size.width.toInt(),
    size.height.toInt(),
  );
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  if (data == null) throw StateError('Unable to export signature.');
  return data.buffer.asUint8List();
}
