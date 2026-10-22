import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' show Rect;

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:smartpdm_mobileapp/features/forms/data/services/scholarship_form_pdf_service.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/signature_image_processor.dart';
import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';

void main() {
  Uint8List signatureFixture() {
    final image = img.Image(width: 420, height: 180, numChannels: 4);
    // Representative handwritten evidence: joined, rising/falling strokes
    // with ascenders and descenders. This deliberately rejects the earlier
    // near-flat test line, which could not prove readable PDF rendering.
    void stamp(int x, int y, {int alpha = 255}) {
      for (var dy = -3; dy <= 3; dy += 1) {
        for (var dx = -3; dx <= 3; dx += 1) {
          if ((dx * dx) + (dy * dy) <= 9) {
            image.setPixelRgba(x + dx, y + dy, 20, 35, 65, alpha);
          }
        }
      }
    }

    void stroke(List<(int, int)> points, {int alpha = 255}) {
      for (
        var pointIndex = 0;
        pointIndex < points.length - 1;
        pointIndex += 1
      ) {
        final start = points[pointIndex];
        final end = points[pointIndex + 1];
        final steps = (end.$1 - start.$1).abs() > (end.$2 - start.$2).abs()
            ? (end.$1 - start.$1).abs()
            : (end.$2 - start.$2).abs();
        for (var step = 0; step <= steps; step += 1) {
          stamp(
            start.$1 + (((end.$1 - start.$1) * step) / steps).round(),
            start.$2 + (((end.$2 - start.$2) * step) / steps).round(),
            alpha: alpha,
          );
        }
      }
    }

    stroke([(55, 132), (82, 72), (106, 142), (129, 90), (151, 132)]);
    stroke([(128, 122), (151, 102), (174, 137), (196, 95), (218, 130)]);
    stroke([(205, 128), (232, 83), (254, 146), (279, 92), (306, 132)]);
    stroke([(292, 126), (324, 105), (350, 136), (380, 111)], alpha: 225);
    stroke([(70, 152), (152, 145), (235, 151), (338, 143)], alpha: 150);
    return Uint8List.fromList(img.encodePng(image));
  }

  test(
    'renders a representative Form-02 calibration fixture on the template',
    () async {
      final outputPath = Platform.environment['PDF_CALIBRATION_OUTPUT'];
      final signature = signatureFixture();
      final prepared = prepareSignatureImageForPdf(signature);
      expect(
        prepared.visibleInkHeight / prepared.visibleInkWidth,
        greaterThan(.2),
        reason: 'The diagnostic fixture must exercise non-flat handwriting.',
      );
      final template = await File(
        'assets/files/scholarship_app_form.pdf',
      ).readAsBytes();
      final model = SavedApplicationPrintModel.fromSavedFormData({
        'personal': {
          'first_name': 'Viancy',
          'middle_name': 'F',
          'last_name': 'Romawak',
          'date_of_birth': '2006-11-17',
          'place_of_birth': 'Meycauayan',
          'citizenship': 'Filipino',
          'civil_status': 'Single',
          'religion': 'Roman Catholic',
          'sex': 'Female',
        },
        'address': {
          'house_lot_block_no': 'Block/Lot: N/A',
          'phase': 'N/A',
          'street': '900 Benedicto St.',
          'subdivision': 'N/A',
          'barangay': 'Prenza I',
          'city_municipality': 'Marilao',
          'province': 'Bulacan',
          'zip_code': '3019',
        },
        'contact': {
          'mobile_number': '09115046040',
          'email': 'viancy.romawak88@outlook.com',
        },
        'family': {
          'parent_guardian_address':
              '900 Benedicto St., Prenza I, Marilao, Bulacan',
          'father': {
            'first_name': 'Mark',
            'last_name': 'Romawak',
            'mobile': '09123113211',
          },
          'mother': {
            'first_name': 'Lea',
            'last_name': 'Romawak',
            'mobile': '09123123123',
          },
          'guardian': {
            'first_name': 'Mark',
            'last_name': 'Romawak',
            'mobile': '09123113211',
          },
          'parent_native_status': 'yes, both parents',
        },
        'academic': {
          'college_school': 'Pambayang Dalubhasaan Ng Marilao',
          'college_address': 'Abangan, Norte, Marilao, Bulacan',
          'college_year_graduated': 'Ongoing',
          'current_course': 'BECED',
          'current_year_level': '1',
          'current_section': 'C',
          'student_number': 'PDM-2026-000048',
          'lrn': '435435345435',
        },
        'support': {
          'financial_support': 'Parents',
          'scholarship_history': false,
        },
        'discipline': {'disciplinary_action': false},
        'essays': {
          'describe_yourself_essay': 'A responsible and hardworking student.',
          'aims_and_ambition_essay': 'Finish college and serve the community.',
        },
        'application': {'submitted_at': '2026-10-21T08:00:00Z'},
      });

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
      expect(document.pages.count, 1);
      document.dispose();

      if (outputPath != null && outputPath.isNotEmpty) {
        final output = File(outputPath);
        await output.parent.create(recursive: true);
        await output.writeAsBytes(bytes, flush: true);
        const pageScale = 936 / 3900;
        final applicantCell = Rect.fromLTWH(
          115 * 612 / 2550,
          Form02Layout.signatureCellTopY * pageScale,
          720 * 612 / 2550,
          Form02Layout.signatureCellHeight * pageScale,
        );
        final guardianCell = Rect.fromLTWH(
          1280 * 612 / 2550,
          Form02Layout.signatureCellTopY * pageScale,
          850 * 612 / 2550,
          Form02Layout.signatureCellHeight * pageScale,
        );
        final applicantDestination = Form02Layout.signatureDestinationRect(
          cell: applicantCell,
          imageWidth: prepared.width.toDouble(),
          imageHeight: prepared.height.toDouble(),
        );
        final guardianDestination = Form02Layout.signatureDestinationRect(
          cell: guardianCell,
          imageWidth: prepared.width.toDouble(),
          imageHeight: prepared.height.toDouble(),
        );
        await File(
          '${output.parent.path}/original-signature.png',
        ).writeAsBytes(signature, flush: true);
        await File(
          '${output.parent.path}/processed-signature.png',
        ).writeAsBytes(prepared.png, flush: true);
        await File(
          '${output.parent.path}/signature-diagnostics.json',
        ).writeAsString(
          const JsonEncoder.withIndent('  ').convert({
            'source': {'width': 420, 'height': 180},
            'processed': {
              'width': prepared.width,
              'height': prepared.height,
              'visibleInkWidth': prepared.visibleInkWidth,
              'visibleInkHeight': prepared.visibleInkHeight,
            },
            'applicantDestination': {
              'left': applicantDestination.left,
              'top': applicantDestination.top,
              'width': applicantDestination.width,
              'height': applicantDestination.height,
            },
            'guardianDestination': {
              'left': guardianDestination.left,
              'top': guardianDestination.top,
              'width': guardianDestination.width,
              'height': guardianDestination.height,
            },
          }),
          flush: true,
        );
        expect(output.existsSync(), isTrue);
      }
    },
  );
}
