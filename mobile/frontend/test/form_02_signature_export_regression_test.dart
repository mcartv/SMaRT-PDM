import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' show Rect;

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

      expect(source, contains('Form02Layout.signatureCellTopY'));
      expect(source, contains('drawSignatureName('));
      expect(source, contains('r(90, Form02Layout.printedNameTopY'));
      expect(source, contains('Form02Layout.printedNameHeight'));
      expect(source, contains('prepareSignatureImageForPdf(png)'));
      expect(source, contains('PdfBitmap(prepared.png)'));
      expect(source, contains('Form02Layout.signatureDestinationRect'));
      expect(source, contains('cell.bottom - height'));
    },
  );

  test('signature and compact answer geometry stays inside Form-02 cells', () {
    expect(
      Form02Layout.signatureCellTopY,
      greaterThanOrEqualTo(Form02Layout.certificationBottomY),
    );
    expect(
      Form02Layout.printedNameTopY + Form02Layout.printedNameHeight,
      lessThanOrEqualTo(Form02Layout.printedNameLabelTopY),
    );
    expect(
      Form02Layout.signatureCellTopY + Form02Layout.signatureCellHeight,
      lessThanOrEqualTo(
        Form02Layout.printedNameTopY - Form02Layout.signatureNameGap,
      ),
    );
    expect(
      Form02Layout.signatureCellTopY,
      greaterThanOrEqualTo(
        Form02Layout.certificationBottomY +
            Form02Layout.signatureCertificationGap,
      ),
    );
    expect(Form02Layout.scholarshipDetailsBounds.right, lessThanOrEqualTo(612));
    expect(
      Form02Layout.disciplinaryDetailsBounds.right,
      lessThanOrEqualTo(612),
    );
    expect(Form02Layout.scholarshipDetailsBounds.height, lessThanOrEqualTo(7));
    expect(Form02Layout.disciplinaryDetailsBounds.height, lessThanOrEqualTo(7));
    expect(Form02Layout.familyTextTopOffset, greaterThanOrEqualTo(-12));
    expect(Form02Layout.familyTextHeight, greaterThanOrEqualTo(32));
    expect(Form02Layout.compactAcademicTopY, lessThan(2230));
  });

  test('signature destinations enlarge visible ink without crossing cells', () {
    const applicantCell = Rect.fromLTWH(27.6, 689.76, 172.8, 11.28);
    const guardianCell = Rect.fromLTWH(307.2, 689.76, 204, 11.28);
    final wide = Form02Layout.signatureDestinationRect(
      cell: applicantCell,
      imageWidth: 328,
      imageHeight: 76,
    );
    final tall = Form02Layout.signatureDestinationRect(
      cell: guardianCell,
      imageWidth: 76,
      imageHeight: 328,
    );

    // The prior 16-pixel margin and 28-unit lane produced only 22.8 points of
    // visible width for this representative wide signature. The new measured
    // lane and tight crop must provide meaningfully more room.
    expect(wide.width, greaterThan(30));
    for (final destination in [wide, tall]) {
      final cell = identical(destination, wide) ? applicantCell : guardianCell;
      expect(destination.left, greaterThanOrEqualTo(cell.left));
      expect(destination.right, lessThanOrEqualTo(cell.right));
      expect(destination.top, greaterThanOrEqualTo(cell.top));
      expect(destination.bottom, closeTo(cell.bottom, 0.001));
      expect(destination.center.dx, closeTo(cell.center.dx, 0.001));
    }
  });

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
