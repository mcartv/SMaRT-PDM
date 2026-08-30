import 'dart:typed_data';

import 'package:smartpdm_mobileapp/shared/models/scholar_renewal.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';

class RenewalService {
  RenewalService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

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
    if (routeParam.trim().isEmpty) {
      throw ArgumentError('Renewal document ID is required.');
    }

    if (fileName.trim().isEmpty) {
      throw ArgumentError('File name is required.');
    }

    if (fileBytes != null && fileBytes.isEmpty) {
      throw ArgumentError('The selected file is empty.');
    }

    final path = '/api/renewals/me/documents/${routeParam.trim()}/upload';

    if (fileBytes == null && (filePath == null || filePath.trim().isEmpty)) {
      throw ArgumentError('filePath or fileBytes is required.');
    }

    final response = fileBytes != null
        ? await _apiClient.uploadBytes(
            path,
            fieldName: 'document',
            bytes: fileBytes,
            fileName: fileName,
            timeout: const Duration(seconds: 60),
          )
        : await _apiClient.uploadFile(
            path,
            fieldName: 'document',
            filePath: filePath!,
            timeout: const Duration(seconds: 60),
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
