// SMaRT-PDM: Applications — printable application service (mobile service); calls APIs or shared services and returns processed results.
import 'dart:io';
import 'dart:convert';
import 'dart:typed_data';

import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/scholarship_form_pdf_service.dart';

class PrintableApplicationService {
  PrintableApplicationService({
    ApplicationService? applicationService,
    ScholarshipFormPdfService? pdfService,
  }) : _applicationService = applicationService ?? ApplicationService(),
       _pdfService = pdfService ?? ScholarshipFormPdfService();

  final ApplicationService _applicationService;
  final ScholarshipFormPdfService _pdfService;

  // generateBytesFromSubmissionPayload: handles generate bytes from submission payload for the Applications flow.
  Future<Uint8List> generateBytesFromSubmissionPayload(
    Map<String, dynamic> payload,
  ) async {
    final model = SavedApplicationPrintModel.fromSavedFormData(payload);
    return _pdfService.generateBytesFromSavedApplication(model);
  }

  // generateBytesFromMySubmittedApplicationForm: handles generate bytes from my submitted application form for the Applications flow.
  Future<Uint8List> generateBytesFromMySubmittedApplicationForm() async {
    final responses = await Future.wait([
      _applicationService.fetchMySubmittedApplicationForm(),
      _applicationService.fetchMySubmittedFormSignatureEvidence(),
    ]);
    final response = responses[0];
    final signatureResponse = responses[1];
    final payload = Map<String, dynamic>.from(
      response['form_data'] as Map? ?? const {},
    );

    if (payload.isEmpty) {
      throw Exception('Submitted application form is not available yet.');
    }

    final application = Map<String, dynamic>.from(
      response['application'] as Map? ?? const {},
    );
    final evidenceApplicationId = signatureResponse['application_id']
        ?.toString()
        .trim();
    final submittedApplicationId = application['application_id']
        ?.toString()
        .trim();
    if (evidenceApplicationId == null ||
        evidenceApplicationId.isEmpty ||
        evidenceApplicationId != submittedApplicationId) {
      throw StateError(
        'Finalized signature evidence does not match this submitted application. Please refresh and try again.',
      );
    }
    final signatures = Map<String, dynamic>.from(
      signatureResponse['signatures'] as Map? ?? const {},
    );
    final studentSignature = _decodeFinalizedSignature(
      signatures['student_signature'],
      'Student',
    );
    final guardianSignature = _decodeFinalizedSignature(
      signatures['guardian_signature'],
      'Parent/guardian',
    );

    if (application.isNotEmpty) {
      final existingApplication = Map<String, dynamic>.from(
        payload['application'] as Map? ?? const {},
      );
      payload['application'] = {...existingApplication, ...application};
    }

    final model = SavedApplicationPrintModel.fromSavedFormData(payload);
    return _pdfService.generateBytesFromSavedApplication(
      model,
      signatures: FinalizedFormSignatureEvidence(
        studentSignaturePng: studentSignature,
        guardianSignaturePng: guardianSignature,
      ),
    );
  }

  Uint8List _decodeFinalizedSignature(dynamic value, String label) {
    final signature = Map<String, dynamic>.from(value as Map? ?? const {});
    final encoded = signature['png_base64']?.toString().trim() ?? '';
    if (encoded.isEmpty) {
      throw StateError(
        '$label signature evidence is unavailable. Please try again or contact OSFA for assistance.',
      );
    }
    try {
      final bytes = base64Decode(encoded);
      final isPng =
          bytes.length >= 8 &&
          bytes[0] == 0x89 &&
          bytes[1] == 0x50 &&
          bytes[2] == 0x4e &&
          bytes[3] == 0x47 &&
          bytes[4] == 0x0d &&
          bytes[5] == 0x0a &&
          bytes[6] == 0x1a &&
          bytes[7] == 0x0a;
      if (!isPng) throw const FormatException();
      return bytes;
    } on FormatException {
      throw StateError(
        '$label signature evidence is invalid. Please try again or contact OSFA for assistance.',
      );
    }
  }

  // generateFromSubmissionPayload: handles generate from submission payload for the Applications flow.
  Future<File> generateFromSubmissionPayload(
    Map<String, dynamic> payload,
  ) async {
    final model = SavedApplicationPrintModel.fromSavedFormData(payload);
    return _pdfService.generateFromSavedApplication(model);
  }

  // generateOpenFromSubmissionPayload: handles generate open from submission payload for the Applications flow.
  Future<void> generateOpenFromSubmissionPayload(
    Map<String, dynamic> payload,
  ) async {
    final file = await generateFromSubmissionPayload(payload);
    await _pdfService.openGeneratedPdf(file);
  }

  // generateFromMySavedFormData: handles generate from my saved form data for the Applications flow.
  Future<File> generateFromMySavedFormData() async {
    final payload = await _applicationService.fetchMySavedFormData();
    final model = SavedApplicationPrintModel.fromSavedFormData(payload);
    return _pdfService.generateFromSavedApplication(model);
  }

  // generateOpenFromMySavedFormData: handles generate open from my saved form data for the Applications flow.
  Future<void> generateOpenFromMySavedFormData() async {
    final file = await generateFromMySavedFormData();
    await _pdfService.openGeneratedPdf(file);
  }

  // generateFromApplicationId: handles generate from application id for the Applications flow.
  Future<File> generateFromApplicationId(String applicationId) async {
    final payload = await _applicationService.fetchApplicationDetails(
      applicationId,
    );
    final model = SavedApplicationPrintModel.fromApi(payload);
    return _pdfService.generateFromSavedApplication(model);
  }

  // generateOpenFromApplicationId: handles generate open from application id for the Applications flow.
  Future<void> generateOpenFromApplicationId(String applicationId) async {
    final file = await generateFromApplicationId(applicationId);
    await _pdfService.openGeneratedPdf(file);
  }
}
