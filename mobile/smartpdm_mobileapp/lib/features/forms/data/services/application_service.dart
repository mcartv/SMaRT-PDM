import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';

class ApplicationService {
  ApplicationService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> submitApplication(
    ApplicationData applicationData,
  ) async {
    final openingId = applicationData.openingId.trim();

    if (openingId.isEmpty) {
      throw Exception(
        'Choose a scholarship opening before submitting your application.',
      );
    }

    return _apiClient.postJson(
      '/api/applications/me/submit',
      body: applicationData.toSubmissionPayload(),
      timeout: const Duration(seconds: 30),
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
    return _apiClient.getObject('/api/applications/$applicationId');
  }

  Future<Map<String, dynamic>> fetchMySavedFormData() async {
    return _apiClient.getObject('/api/applications/me/form-data');
  }

  Future<Map<String, dynamic>> saveMySavedFormData(
    ApplicationData applicationData,
  ) async {
    return _apiClient.putJson(
      '/api/applications/me/form-data',
      body: applicationData.toDraftPayload(),
      timeout: const Duration(seconds: 20),
    );
  }

  Future<ApplicationStatusSummary> fetchMyApplicationStatusSummary() async {
    final response = await _apiClient.getObject(
      '/api/applications/me/status-summary',
    );

    return ApplicationStatusSummary.fromJson(response);
  }
}
