import 'dart:math' as math;
import 'dart:typed_data';

import 'package:image/image.dart' as img;

/// A transparent, tightly bounded PNG for overlaying onto Form-02.
class PreparedSignatureImage {
  const PreparedSignatureImage({
    required this.png,
    required this.width,
    required this.height,
    required this.visibleInkWidth,
    required this.visibleInkHeight,
  });

  final Uint8List png;
  final int width;
  final int height;
  final int visibleInkWidth;
  final int visibleInkHeight;
}

/// Converts a camera or gallery image to the PNG-only evidence format accepted
/// by the signing API. Decoding and re-encoding preserves alpha in existing
/// PNG captures; white-background legacy images are deliberately left intact
/// here and are normalized only in memory when the official PDF is produced.
Uint8List prepareUploadedSignaturePng(Uint8List source) {
  final decoded = img.decodeImage(source);
  if (decoded == null || decoded.width == 0 || decoded.height == 0) {
    throw StateError('Choose a readable signature image.');
  }
  return Uint8List.fromList(img.encodePng(decoded));
}

/// Normalizes finalized PNG evidence in memory, without changing stored files.
///
/// Historic captures used an opaque white canvas. Only fully opaque,
/// near-white background pixels are removed. The rendering copy is then
/// tightly cropped to its visible ink and conservatively darkens only pale,
/// opaque strokes; the finalized source evidence is never changed.
PreparedSignatureImage prepareSignatureImageForPdf(Uint8List png) {
  final source = img.decodePng(png);
  if (source == null || source.width == 0 || source.height == 0) {
    throw StateError('Finalized signature evidence is not a valid PNG image.');
  }

  final normalized = img.Image(
    width: source.width,
    height: source.height,
    numChannels: 4,
  );
  var minX = source.width;
  var minY = source.height;
  var maxX = -1;
  var maxY = -1;

  for (var y = 0; y < source.height; y += 1) {
    for (var x = 0; x < source.width; x += 1) {
      final pixel = source.getPixel(x, y);
      final red = pixel.r.toInt();
      final green = pixel.g.toInt();
      final blue = pixel.b.toInt();
      final alpha = pixel.a.toInt();
      final isLegacyWhiteBackground =
          alpha == 255 && red >= 250 && green >= 250 && blue >= 250;
      final outputAlpha = isLegacyWhiteBackground ? 0 : alpha;
      final brightestChannel = math.max(red, math.max(green, blue));
      // Camera captures can contain a signature that is fully opaque but so
      // light that it nearly disappears against the official form. Keep its
      // hue and alpha while reducing only its brightness, so anti-aliased or
      // already dark handwritten strokes retain their natural shape.
      final contrastScale = outputAlpha == 255 && brightestChannel > 180
          ? (170 + ((brightestChannel - 170) * .25)) / brightestChannel
          : 1.0;
      normalized.setPixelRgba(
        x,
        y,
        (red * contrastScale).round(),
        (green * contrastScale).round(),
        (blue * contrastScale).round(),
        outputAlpha,
      );

      if (outputAlpha > 0) {
        minX = math.min(minX, x);
        minY = math.min(minY, y);
        maxX = math.max(maxX, x);
        maxY = math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    throw StateError('Finalized signature evidence contains no visible ink.');
  }

  // Crop transparent padding so wide handwritten marks can use the available
  // Form-02 lane height. Four pixels retain anti-aliased edge safety without
  // letting a fixed oversized border make visible ink look tiny.
  const padding = 4;
  final left = math.max(0, minX - padding);
  final top = math.max(0, minY - padding);
  final right = math.min(source.width, maxX + padding + 1);
  final bottom = math.min(source.height, maxY + padding + 1);
  final cropped = img.copyCrop(
    normalized,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  );

  return PreparedSignatureImage(
    png: Uint8List.fromList(img.encodePng(cropped)),
    width: cropped.width,
    height: cropped.height,
    visibleInkWidth: maxX - minX + 1,
    visibleInkHeight: maxY - minY + 1,
  );
}
