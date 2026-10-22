import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:smartpdm_mobileapp/features/forms/data/services/scholarship_form_pdf_service.dart';
import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';

void main() {
  Uint8List signatureFixture() {
    final image = img.Image(width: 420, height: 180, numChannels: 4);
    // A varied, multi-stroke handwritten-like fixture exercises transparent
    // crop bounds and aspect-ratio scaling more faithfully than a line.
    for (var x = 48; x < 368; x += 1) {
      final wave = ((x ~/ 13) % 21) - 10;
      final y = 84 + wave;
      for (var thickness = -3; thickness <= 3; thickness += 1) {
        image.setPixelRgba(x, y + thickness, 25, 35, 50, 255);
        if (x % 5 == 0) {
          image.setPixelRgba(x, y + thickness + 24, 25, 35, 50, 210);
        }
      }
    }
    for (var y = 58; y < 126; y += 1) {
      final x = 68 + ((y * 3) % 56);
      image.setPixelRgba(x, y, 25, 35, 50, 255);
    }
    return Uint8List.fromList(img.encodePng(image));
  }

  test(
    'renders a representative Form-02 calibration fixture on the template',
    () async {
      final outputPath = Platform.environment['PDF_CALIBRATION_OUTPUT'];
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
              studentSignaturePng: signatureFixture(),
              guardianSignaturePng: signatureFixture(),
            ),
          );
      final document = PdfDocument(inputBytes: bytes);
      expect(document.pages.count, 1);
      document.dispose();

      if (outputPath != null && outputPath.isNotEmpty) {
        final output = File(outputPath);
        await output.parent.create(recursive: true);
        await output.writeAsBytes(bytes, flush: true);
        expect(output.existsSync(), isTrue);
      }
    },
  );
}
