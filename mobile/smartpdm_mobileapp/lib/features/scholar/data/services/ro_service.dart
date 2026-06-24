import 'dart:typed_data';

import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/shared/models/ro_assignment.dart';

class RoService {
  RoService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<RoAssignmentsPackage> fetchMyAssignments() async {
    final response = await _apiClient.getObject('/api/ro/me');
    return RoAssignmentsPackage.fromJson(response);
  }

  Future<RoAssignmentsPackage> submitCompletion({
    required String roId,
    required String fileName,
    required int renderedHours,
    String? filePath,
    Uint8List? fileBytes,
  }) async {
    final path = '/api/ro/$roId/submit';

    if (fileBytes == null && (filePath == null || filePath.isEmpty)) {
      throw ArgumentError('filePath or fileBytes is required.');
    }

    final response =
        fileBytes != null
            ? await _apiClient.uploadBytes(
              path,
              fieldName: 'proof',
              bytes: fileBytes,
              fileName: fileName,
              fields: {'rendered_hours': renderedHours.toString()},
            )
            : await _apiClient.uploadFile(
              path,
              fieldName: 'proof',
              filePath: filePath!,
              fields: {'rendered_hours': renderedHours.toString()},
            );

    return RoAssignmentsPackage.fromJson(response);
  }
}
