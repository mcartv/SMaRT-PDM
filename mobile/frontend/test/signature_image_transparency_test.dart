import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:smartpdm_mobileapp/features/forms/data/services/signature_image_processor.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/signature_pad.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('newly captured signature PNG has a transparent background', () async {
    final controller = SignaturePadController()
      ..begin(const Offset(120, 100))
      ..add(const Offset(220, 130));

    final png = await exportSignaturePng(controller);
    final image = img.decodePng(png)!;

    expect(image.getPixel(0, 0).a.toInt(), 0);
    expect(image.getPixel(120, 100).a.toInt(), greaterThan(0));
  });

  test('legacy white background is removed without removing light ink', () {
    final legacy = img.Image(width: 40, height: 20, numChannels: 4);
    for (var y = 0; y < legacy.height; y += 1) {
      for (var x = 0; x < legacy.width; x += 1) {
        legacy.setPixelRgba(x, y, 255, 255, 255, 255);
      }
    }
    legacy.setPixelRgba(10, 10, 28, 40, 51, 255);
    legacy.setPixelRgba(11, 10, 249, 249, 249, 255);

    final prepared = prepareSignatureImageForPdf(
      Uint8List.fromList(img.encodePng(legacy)),
    );
    final image = img.decodePng(prepared.png)!;

    expect(image.getPixel(0, 0).a.toInt(), 0);
    // Four pixels of transparent safety padding are retained around the
    // detected visible-ink bounds for PDF placement.
    expect(image.getPixel(4, 4).a.toInt(), 255);
    expect(image.getPixel(4, 4).r.toInt(), 28);
    expect(image.getPixel(5, 4).a.toInt(), 255);
    expect(image.getPixel(5, 4).r.toInt(), lessThan(249));
  });

  test('existing transparent PNG alpha is retained for PDF embedding', () {
    final source = img.Image(width: 40, height: 20, numChannels: 4);
    source.setPixelRgba(10, 10, 28, 40, 51, 255);
    source.setPixelRgba(11, 10, 100, 110, 120, 80);

    final prepared = prepareSignatureImageForPdf(
      Uint8List.fromList(img.encodePng(source)),
    );
    final image = img.decodePng(prepared.png)!;

    expect(image.getPixel(4, 4).a.toInt(), 255);
    expect(image.getPixel(5, 4).a.toInt(), 80);
  });

  test('rendering copy tightly crops and darkens faint handwritten ink', () {
    final source = img.Image(width: 300, height: 150, numChannels: 4);
    // Wide, multi-stroke handwriting with transparent capture padding.
    for (var x = 70; x < 230; x += 1) {
      final y = 72 + ((x ~/ 9) % 7);
      source.setPixelRgba(x, y, 232, 232, 240, 255);
      source.setPixelRgba(x, y + 1, 126, 130, 170, 110);
    }
    for (var y = 48; y < 96; y += 1) {
      source.setPixelRgba(82 + ((y * 3) % 20), y, 232, 232, 240, 255);
    }

    final prepared = prepareSignatureImageForPdf(
      Uint8List.fromList(img.encodePng(source)),
    );
    final image = img.decodePng(prepared.png)!;

    expect(prepared.visibleInkWidth, greaterThan(150));
    expect(prepared.visibleInkHeight, greaterThan(45));
    expect(prepared.width, lessThan(180));
    expect(prepared.height, lessThan(65));
    // The opaque faint stroke is darker but remains visible; translucent
    // anti-aliased pixels retain their original alpha.
    expect(image.getPixel(4, 28).r.toInt(), lessThan(232));
    expect(image.getPixel(4, 29).a.toInt(), 110);
  });

  test(
    'uploaded transparent PNG remains transparent and uses PNG evidence',
    () {
      final source = img.Image(width: 24, height: 12, numChannels: 4);
      source.setPixelRgba(8, 6, 28, 40, 51, 255);
      source.setPixelRgba(9, 6, 100, 110, 120, 80);

      final prepared = prepareUploadedSignaturePng(
        Uint8List.fromList(img.encodePng(source)),
      );
      final image = img.decodePng(prepared)!;

      expect(image.getPixel(0, 0).a.toInt(), 0);
      expect(image.getPixel(8, 6).a.toInt(), 255);
      expect(image.getPixel(9, 6).a.toInt(), 80);
    },
  );
}
