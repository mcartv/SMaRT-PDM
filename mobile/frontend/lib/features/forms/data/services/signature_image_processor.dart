import 'dart:math' as math;
import 'dart:typed_data';

import 'package:image/image.dart' as img;

/// A transparent, tightly bounded PNG for overlaying onto Form-02.
class PreparedSignatureImage {
  const PreparedSignatureImage({
    required this.png,
    required this.width,
    required this.height,
  });

  final Uint8List png;
  final int width;
  final int height;
}

/// Normalizes finalized PNG evidence in memory, without changing stored files.
///
/// Historic captures used an opaque white canvas. Only fully opaque,
/// near-white background pixels are removed; existing alpha and darker pixels
/// (including pale anti-aliased ink) are retained.
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
      normalized.setPixelRgba(x, y, red, green, blue, outputAlpha);

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

  // Crop transparent padding so small marks remain legible in the narrow
  // official signature lane, retaining a safety margin around every stroke.
  const padding = 16;
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
  );
}
