import 'dart:typed_data';

import 'package:smartpdm_mobileapp/models/opening_application_package.dart';
import 'package:smartpdm_mobileapp/services/api_client.dart';

class OpeningApplicationService {
  OpeningApplicationService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<OpeningApplicationPackage> fetchOpeningApplication(
    String openingId,
  ) async {
    final response = await _apiClient.getObject(
      '/api/openings/$openingId/application',
    );
    return OpeningApplicationPackage.fromJson(response);
  }

  Future<OpeningApplicationPackage> uploadDocument({
    required String openingId,
    required String documentRouteParam,
    required String fileName,
    String? filePath,
    Uint8List? fileBytes,
  }) async {
    final path =
        '/api/openings/$openingId/documents/$documentRouteParam/upload';
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

    return OpeningApplicationPackage.fromJson(response);
  }
}
