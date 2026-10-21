import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/printable_application_service.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/utils/signed_application_pdf_export.dart';

class _FakePrintableApplicationService extends PrintableApplicationService {
  _FakePrintableApplicationService({this.failure});

  final Object? failure;
  var submittedFormRequests = 0;

  @override
  Future<Uint8List> generateBytesFromMySubmittedApplicationForm() async {
    submittedFormRequests += 1;
    if (failure != null) throw failure!;
    return Uint8List.fromList(<int>[37, 80, 68, 70]);
  }
}

void main() {
  test('exports only the authenticated submitted Form-02 bytes', () async {
    final service = _FakePrintableApplicationService();
    Uint8List? savedBytes;
    String? savedFileName;

    final result = await downloadVerifiedSignedApplicationPdf(
      service,
      saveFile:
          ({required bytes, required fileName, required contentType}) async {
            savedBytes = bytes;
            savedFileName = fileName;
            expect(contentType, 'application/pdf');
            return 'Download started.';
          },
    );

    expect(service.submittedFormRequests, 1);
    expect(savedBytes, orderedEquals(<int>[37, 80, 68, 70]));
    expect(savedFileName, 'SMaRT-PDM_Application_Form.pdf');
    expect(result, 'Download started.');
  });

  test(
    'surfaces finalized-evidence failures instead of exporting a fallback',
    () async {
      final service = _FakePrintableApplicationService(
        failure: StateError('Student signature evidence is unavailable.'),
      );

      await expectLater(
        () => downloadVerifiedSignedApplicationPdf(
          service,
          saveFile: ({required bytes, required fileName, required contentType}) {
            fail(
              'A PDF must not be saved when finalized evidence retrieval fails.',
            );
          },
        ),
        throwsA(isA<StateError>()),
      );
      expect(service.submittedFormRequests, 1);
    },
  );
}
