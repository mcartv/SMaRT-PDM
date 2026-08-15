import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';

class ProgramOpeningService {
  ProgramOpeningService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<ProgramOpeningsResult> fetchAvailableOpenings() async {
    final response = await _apiClient.getObject('/api/openings');
    final items = (response['items'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((item) => ProgramOpening.fromJson(Map<String, dynamic>.from(item)))
        .where((opening) => opening.isVisible)
        .toList(growable: false);

    return ProgramOpeningsResult(
      hasSavedDraft: response['hasSavedDraft'] == true,
      draftOpeningId: response['draftOpeningId']?.toString() ?? '',
      draftOpeningTitle: response['draftOpeningTitle']?.toString() ?? '',
      draftProgramName: response['draftProgramName']?.toString() ?? '',
      activeApplicationId: response['activeApplicationId']?.toString() ?? '',
      activeOpeningId: response['activeOpeningId']?.toString() ?? '',
      isApprovedScholar: response['isApprovedScholar'] == true,
      items: items,
    );
  }

  /// Dashboard-only feed.
  ///
  /// The full scholarship openings screen still receives existing/closed
  /// records it may need for application/document management. Home should only
  /// advertise openings that the current applicant can actually act on.
  Future<ProgramOpeningsResult> fetchDashboardOpenings() async {
    final result = await fetchAvailableOpenings();

    final dashboardItems = result.isApprovedScholar
        ? const <ProgramOpening>[]
        : result.items
              .where(
                (opening) =>
                    opening.isVisible &&
                    opening.postingStatus.trim().toLowerCase() == 'open' &&
                    opening.canApply &&
                    !opening.hasApplied,
              )
              .toList(growable: false);

    return ProgramOpeningsResult(
      hasSavedDraft: result.hasSavedDraft,
      draftOpeningId: result.draftOpeningId,
      draftOpeningTitle: result.draftOpeningTitle,
      draftProgramName: result.draftProgramName,
      activeApplicationId: result.activeApplicationId,
      activeOpeningId: result.activeOpeningId,
      isApprovedScholar: result.isApprovedScholar,
      items: dashboardItems,
    );
  }

  Future<AppNotification?> fetchLatestOpeningOfficeUpdate() async {
    final response = await _apiClient.getObject('/api/openings/latest');
    final item = response['item'];

    if (item is! Map) return null;

    return AppNotification.fromLatestOpening(Map<String, dynamic>.from(item));
  }

  Future<Map<String, dynamic>> applyToOpening({
    required String openingId,
    required Map<String, dynamic> body,
  }) {
    return _apiClient.postJson('/api/openings/$openingId/apply', body: body);
  }

  Future<Map<String, dynamic>> submitApplicationForm({
    required Map<String, dynamic> body,
  }) {
    return _apiClient.postJson('/api/applications/me/submit', body: body);
  }
}
