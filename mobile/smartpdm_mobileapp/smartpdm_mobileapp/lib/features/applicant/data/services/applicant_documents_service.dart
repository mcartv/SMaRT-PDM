import 'dart:typed_data';

import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';

class ApplicantDocumentsService {
  ApplicantDocumentsService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<ApplicantDocumentsPackage> fetchMyDocuments() async {
    final response = await _apiClient.getObject(
      '/api/applications/me/documents',
    );
    return ApplicantDocumentsPackage.fromJson(response);
  }

  Future<ApplicantDocumentsPackage> uploadDocument({
    required String documentRouteParam,
    required String fileName,
    String? filePath,
    Uint8List? fileBytes,
  }) async {
    final documentId = documentRouteParam.trim();

    if (documentId.isEmpty) {
      throw ArgumentError('Document ID is required for upload.');
    }

    final path = '/api/applications/me/documents/$documentId/upload';

    Map<String, dynamic> response;

    if (fileBytes != null) {
      response = await _apiClient.uploadBytes(
        path,
        fieldName: 'document',
        bytes: fileBytes,
        fileName: fileName,
      );
    } else {
      if (filePath == null || filePath.isEmpty) {
        throw ArgumentError('filePath or fileBytes is required.');
      }

      response = await _apiClient.uploadFile(
        path,
        fieldName: 'document',
        filePath: filePath,
      );
    }

    return ApplicantDocumentsPackage.fromJson(response);
  }
}
