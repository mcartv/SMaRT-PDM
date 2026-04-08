import 'dart:typed_data';

import 'package:smartpdm_mobileapp/models/program_opening.dart';
import 'package:smartpdm_mobileapp/services/api_client.dart';

class ProgramOpeningService {
  ProgramOpeningService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<ProgramOpeningsResult> fetchAvailableOpenings() async {
    final response = await _apiClient.getObject('/api/openings');
    final items = (response['items'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((item) => ProgramOpening.fromJson(Map<String, dynamic>.from(item)))
        .toList();

    return ProgramOpeningsResult(
      hasBaseApplicationProfile: response['hasBaseApplicationProfile'] == true,
      items: items,
    );
  }

  Future<Map<String, dynamic>> applyToOpening({
    required String openingId,
    required String fileName,
    String? filePath,
    Uint8List? fileBytes,
  }) {
    if (fileBytes != null) {
      return _apiClient.uploadBytes(
        '/api/openings/$openingId/apply',
        fieldName: 'indigency',
        bytes: fileBytes,
        fileName: fileName,
      );
    }

    if (filePath == null || filePath.isEmpty) {
      throw ArgumentError('filePath or fileBytes is required.');
    }

    return _apiClient.uploadFile(
      '/api/openings/$openingId/apply',
      fieldName: 'indigency',
      filePath: filePath,
    );
  }
}
