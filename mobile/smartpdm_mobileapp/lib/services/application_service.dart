import 'package:smartpdm_mobileapp/models/app_data.dart';
import 'package:smartpdm_mobileapp/services/api_client.dart';

class ApplicationService {
  ApplicationService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> submitApplication(
    ApplicationData applicationData,
  ) async {
    return await _apiClient.postJson(
      '/api/applications',
      body: applicationData.toSubmissionPayload(),
      timeout: const Duration(seconds: 20),
    );
  }

  Future<List<Map<String, dynamic>>> fetchScholarshipPrograms() async {
    final response = await _apiClient.getList('/api/scholarship-programs');
    return response
        .whereType<Map<String, dynamic>>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<Map<String, dynamic>> fetchApplicationDetails(
    String applicationId,
  ) async {
    return await _apiClient.getObject('/api/applications/$applicationId');
  }
}
