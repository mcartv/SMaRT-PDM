import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';

class ProgramOpeningService {
  ProgramOpeningService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<ProgramOpeningsResult> fetchAvailableOpenings() async {
    // This list must always reflect the current Admin opening state. The
    // revision prevents web/proxy caches from retaining stale status or slot
    // counts after an Admin update.
    final revision = DateTime.now().millisecondsSinceEpoch;
    final response = await _apiClient.getObject(
      '/api/openings?revision=$revision',
    );
    final items = (response['items'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((item) => ProgramOpening.fromJson(Map<String, dynamic>.from(item)))
        // Defense in depth: Available Scholarships only shows Admin Open
        // openings. The backend already excludes Closed rows, but this keeps
        // stale/legacy responses from rendering a Closed opening.
        .where(
          (opening) =>
              opening.isVisible &&
              opening.postingStatus.trim().toLowerCase() == 'open',
        )
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
  /// Keep the Dashboard aligned with the full scholarship-opening list. A
  /// visible Admin opening should still be previewed when its action is
  /// disabled for this student; the detail screen explains the actual state.
  Future<ProgramOpeningsResult> fetchDashboardOpenings() async {
    final result = await fetchAvailableOpenings();

    final dashboardItems = result.isApprovedScholar
        ? const <ProgramOpening>[]
        : result.items
              .where((opening) => opening.isVisible && !opening.hasApplied)
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
