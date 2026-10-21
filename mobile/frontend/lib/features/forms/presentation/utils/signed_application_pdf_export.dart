import 'dart:typed_data';

import 'package:smartpdm_mobileapp/core/files/downloaded_file_handler.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/printable_application_service.dart';

typedef SignedApplicationPdfSaver =
    Future<String> Function({
      required Uint8List bytes,
      required String fileName,
      required String contentType,
    });

/// Generates Form-02 only from the authenticated applicant's submitted
/// snapshot and finalized signature evidence. The service performs the
/// server-bound ownership and evidence checks; callers must not pass form data
/// or signature bytes into this helper.
Future<String> downloadVerifiedSignedApplicationPdf(
  PrintableApplicationService printableApplicationService, {
  SignedApplicationPdfSaver? saveFile,
}) async {
  final bytes = await printableApplicationService
      .generateBytesFromMySubmittedApplicationForm();
  final saver = saveFile ?? saveAndOpenDownloadedFile;
  return saver(
    bytes: bytes,
    fileName: 'SMaRT-PDM_Application_Form.pdf',
    contentType: 'application/pdf',
  );
}
