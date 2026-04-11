import 'dart:typed_data';

import 'package:smartpdm_mobileapp/models/scholar_renewal.dart';
import 'package:smartpdm_mobileapp/services/api_client.dart';

class RenewalService {
  RenewalService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<ScholarRenewalPackage> fetchCurrentRenewal() async {
    final response = await _apiClient.getObject('/api/renewals/me/current');
    return ScholarRenewalPackage.fromJson(response);
  }

  Future<ScholarRenewalPackage> uploadDocument({
    required String routeParam,
    required String fileName,
    String? filePath,
    Uint8List? fileBytes,
  }) async {
    final path = '/api/renewals/me/documents/$routeParam/upload';

    if (fileBytes == null && (filePath == null || filePath.isEmpty)) {
      throw ArgumentError('filePath or fileBytes is required.');
    }

    final response =
        fileBytes != null
            ? await _apiClient.uploadBytes(
              path,
              fieldName: 'document',
              bytes: fileBytes,
              fileName: fileName,
            )
            : await _apiClient.uploadFile(
              path,
              fieldName: 'document',
              filePath: filePath!,
            );

    return ScholarRenewalPackage.fromJson(response);
  }

  Future<ScholarRenewalPackage> submitRenewal() async {
    final response = await _apiClient.postJson(
      '/api/renewals/me/submit',
      body: const {},
    );
    return ScholarRenewalPackage.fromJson(response);
  }
}
