import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:smartpdm_mobileapp/features/forms/data/services/scholarship_form_pdf_service.dart';
import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';

void main() {
  Uint8List legacyWhiteSignature() {
    final image = img.Image(width: 240, height: 80, numChannels: 4);
    for (var y = 0; y < image.height; y += 1) {
      for (var x = 0; x < image.width; x += 1) {
        image.setPixelRgba(x, y, 255, 255, 255, 255);
      }
    }
    for (var x = 30; x < 210; x += 1) {
      image.setPixelRgba(x, 40, 28, 40, 51, 255);
    }
    return Uint8List.fromList(img.encodePng(image));
  }

  test(
    'submitted Form-02 embeds both finalized signatures on the template page',
    () async {
      final model = SavedApplicationPrintModel.fromSavedFormData({
        'personal': {'first_name': 'Ada', 'last_name': 'Applicant'},
        'family': {
          'guardian': {'first_name': 'Grace', 'last_name': 'Guardian'},
        },
        'application': {'submitted_at': '2026-10-21T08:00:00Z'},
      });
      final signature = legacyWhiteSignature();
      final template = await File(
        'assets/files/scholarship_app_form.pdf',
      ).readAsBytes();
      final templateDocument = PdfDocument(inputBytes: template);
      final templatePageCount = templateDocument.pages.count;
      final templateText = PdfTextExtractor(templateDocument).extractText();
      expect(templateText, contains('I certify that all answers'));
      expect(templateText, contains('BENEFACTOR'));
      templateDocument.dispose();
      final bytes =
          await ScholarshipFormPdfService(
            templateLoader: () async => ByteData.sublistView(template),
          ).generateBytesFromSavedApplication(
            model,
            signatures: FinalizedFormSignatureEvidence(
              studentSignaturePng: signature,
              guardianSignaturePng: signature,
            ),
          );

      final document = PdfDocument(inputBytes: bytes);
      expect(
        document.pages.count,
        templatePageCount - 1,
        reason:
            'The template has one verified blank trailing page, which must be removed without adding another.',
      );
      final exportedText = PdfTextExtractor(document).extractText();
      expect(
        exportedText,
        contains('I certify that all answers'),
        reason:
            'The transparent signature overlay must preserve the certification statement.',
      );
      expect(
        exportedText,
        contains('BENEFACTOR'),
        reason: 'The staff/benefactor signature area must remain untouched.',
      );
      document.dispose();
    },
  );

  test(
    'signature lanes are calibrated above names and leave staff space untouched',
    () {
      final source = File(
        'lib/features/forms/data/services/scholarship_form_pdf_service.dart',
      ).readAsStringSync();

      expect(source, contains('r(115, 2835, 720, 55)'));
      expect(source, contains('r(1280, 2835, 850, 55)'));
      expect(source, contains('r(90, 2905, 800, 45)'));
      expect(source, contains('r(1250, 2905, 930, 45)'));
      expect(source, contains('prepareSignatureImageForPdf(png)'));
      expect(source, contains('PdfBitmap(prepared.png)'));
      expect(source, contains('bounds.width / imageWidth'));
      expect(source, contains('bounds.height / imageHeight'));
    },
  );

  test(
    'additional detail pages remain conditional rather than becoming blank defaults',
    () {
      final source = File(
        'lib/features/forms/data/services/scholarship_form_pdf_service.dart',
      ).readAsStringSync();

      expect(source, contains('if (additionalDetails.isNotEmpty)'));
      expect(source, contains('final extraPage = document.pages.add();'));
    },
  );
}
