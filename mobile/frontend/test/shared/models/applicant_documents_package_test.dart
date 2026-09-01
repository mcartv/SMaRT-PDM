import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';

void main() {
  group('ApplicantRequirementDocument', () {
    test('maps a missing document to missing', () {
      final document = ApplicantRequirementDocument.fromJson({
        'document_id': 'doc-1',
        'document_type': 'Certificate of Registration',
        'is_submitted': false,
        'review_status': 'pending',
      });

      expect(document.isRequired, isTrue);
      expect(document.isMissing, isTrue);
      expect(document.status, 'missing');
    });

    test('maps uploaded pending to under review', () {
      final document = ApplicantRequirementDocument.fromJson({
        'document_id': 'doc-2',
        'document_type': 'Grade Report',
        'is_submitted': true,
        'review_status': 'pending',
      });

      expect(document.isUnderReview, isTrue);
      expect(document.status, 'under_review');
    });

    test('maps reupload variants consistently', () {
      for (final value in [
        'reupload_required',
        'Requires Reupload',
        'needs re-upload',
        'flagged',
      ]) {
        final document = ApplicantRequirementDocument.fromJson({
          'document_id': 'doc-3',
          'document_type': 'Birth Certificate / PSA',
          'is_submitted': true,
          'review_status': value,
        });

        expect(document.needsReplacement, isTrue, reason: value);
        expect(document.status, 'reupload_required', reason: value);
      }
    });

    test('keeps rejected separate while allowing replacement', () {
      final document = ApplicantRequirementDocument.fromJson({
        'document_id': 'doc-4',
        'document_type': 'Letter of Request',
        'is_submitted': true,
        'review_status': 'rejected',
        'remarks': 'Upload a signed copy.',
      });

      expect(document.isRejected, isTrue);
      expect(document.needsReplacement, isTrue);
      expect(document.adminComment, 'Upload a signed copy.');
    });
  });

  test('package counts required states correctly', () {
    final package = ApplicantDocumentsPackage.fromJson({
      'application': {
        'application_id': 'app-1',
        'application_status': 'Pending Review',
      },
      'documents': [
        {
          'document_id': '1',
          'document_type': 'Birth Certificate / PSA',
          'is_submitted': true,
          'review_status': 'verified',
          'required': false,
        },
        {
          'document_id': '2',
          'document_type': 'Certificate of Registration',
          'is_submitted': true,
          'review_status': 'pending',
        },
        {
          'document_id': '3',
          'document_type': 'Certificate of Indigency',
          'is_submitted': false,
          'review_status': 'pending',
        },
        {
          'document_id': '4',
          'document_type': 'Grade Report',
          'is_submitted': true,
          'review_status': 'reupload_required',
        },
        {
          'document_id': '5',
          'document_type': 'Letter of Request',
          'is_submitted': false,
          'review_status': 'pending',
        },
      ],
    });

    expect(package.requiredCount, 4);
    expect(package.optionalDocuments.single.documentType, 'Birth Certificate / PSA');
    expect(package.uploadedCount, 2);
    expect(package.missingCount, 2);
    expect(package.verifiedCount, 0);
    expect(package.needsReplacementCount, 1);
    expect(package.allRequiredUploaded, isFalse);
  });
}
