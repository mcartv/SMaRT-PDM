import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';

ApplicantRequirementDocument signingDocument(String status) {
  return ApplicantRequirementDocument.fromJson(<String, dynamic>{
    'document_id': 'signing-document-id',
    'document_type': 'Guardian Signature',
    'is_submitted': true,
    'review_status': status,
    'review_reason': 'Please provide a clearer signature.',
  });
}

void main() {
  group('Applicant signing correction model', () {
    test('shows guardian signing correction only when re-upload is requested', () {
      final document = signingDocument('reupload_required');

      expect(document.isSigningDocument, isTrue);
      expect(document.isSignature, isTrue);
      expect(document.displayName, 'Parent/Guardian Signature');
      expect(document.canReplaceSigningDocument, isTrue);
      expect(document.adminComment, 'Please provide a clearer signature.');
    });

    test('prevents correction for verified and pending signing evidence', () {
      expect(signingDocument('verified').canReplaceSigningDocument, isFalse);
      expect(signingDocument('pending').canReplaceSigningDocument, isFalse);
    });

    test('does not classify existing required documents as signing evidence', () {
      final document = ApplicantRequirementDocument.fromJson(<String, dynamic>{
        'document_id': 'cor-id',
        'document_type': 'Certificate of Registration',
        'is_submitted': true,
        'review_status': 'reupload_required',
      });

      expect(document.isSigningDocument, isFalse);
      expect(document.canReplaceSigningDocument, isFalse);
    });

    test('a returned pending replacement no longer exposes a duplicate correction', () {
      final document = signingDocument('pending');
      expect(document.isUnderReview, isTrue);
      expect(document.canReplaceSigningDocument, isFalse);
    });
  });
}
