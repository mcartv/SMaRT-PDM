// SMaRT-PDM: Applications — application service (mobile service); calls APIs or shared services and returns processed results.
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';

class ApplicationService {
  ApplicationService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  // submitApplication: handles submit application for the Applications flow.
  Future<Map<String, dynamic>> submitApplication(
    ApplicationData applicationData,
  ) async {
    final openingId = applicationData.openingId.trim();

    if (openingId.isEmpty) {
      throw Exception(
        'Choose a scholarship before submitting your application.',
      );
    }

    return _apiClient.postJson(
      '/api/applications/me/submit',
      body: applicationData.toSubmissionPayload(),
      // Submission persists the complete form, initializes document slots,
      // and creates the endorsement workflow. Allow for Render cold starts
      // without changing the shorter timeout used by ordinary API requests.
      timeout: const Duration(seconds: 90),
    );
  }

  // fetchScholarshipPrograms: fetches and returns fetch scholarship programs for the Applications flow.
  Future<List<Map<String, dynamic>>> fetchScholarshipPrograms() async {
    final response = await _apiClient.getList('/api/scholarship-programs');

    return response
        .whereType<Map<String, dynamic>>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  // fetchApplicationDetails: fetches and returns fetch application details for the Applications flow.
  Future<Map<String, dynamic>> fetchApplicationDetails(
    String applicationId,
  ) async {
    return _apiClient.getObject('/api/applications/$applicationId');
  }

  // fetchMySavedFormData: fetches and returns fetch my saved form data for the Applications flow.
  Future<Map<String, dynamic>> fetchMySavedFormData() async {
    return _apiClient.getObject('/api/applications/me/form-data');
  }

  // fetchMySubmittedApplicationForm: fetches and returns fetch my submitted application form for the Applications flow.
  Future<Map<String, dynamic>> fetchMySubmittedApplicationForm() async {
    return _apiClient.getObject('/api/applications/me/submitted-form');
  }

  // updateSubmittedApplication: updates update submitted application for the Applications flow.
  Future<Map<String, dynamic>> updateSubmittedApplication(
    ApplicationData applicationData,
  ) async {
    final body = applicationData.toSubmissionPayload();
    body['edit_existing_application'] = true;

    return _apiClient.postJson(
      '/api/applications/me/submit',
      body: body,
      timeout: const Duration(seconds: 90),
    );
  }

  // saveMySavedFormData: validates and saves save my saved form data for the Applications flow.
  Future<Map<String, dynamic>> saveMySavedFormData(
    ApplicationData applicationData,
  ) async {
    return _apiClient.putJson(
      '/api/applications/me/form-data',
      body: applicationData.toDraftPayload(),
      timeout: const Duration(seconds: 20),
    );
  }

  // fetchMyApplicationStatusSummary: fetches and returns fetch my application status summary for the Applications flow.
  Future<ApplicationStatusSummary> fetchMyApplicationStatusSummary() async {
    final response = await _apiClient.getObject(
      '/api/applications/me/status-summary',
    );

    return ApplicationStatusSummary.fromJson(response);
  }

  // downloadMyEndorsementSlip: downloads download my endorsement slip for the Applications flow.
  Future<ApiDownload> downloadMyEndorsementSlip() {
    return _apiClient.downloadBytes(
      '/api/applications/me/endorsement-slip/pdf',
    );
  }
}
