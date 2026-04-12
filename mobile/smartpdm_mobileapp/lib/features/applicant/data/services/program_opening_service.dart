import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';

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

  Future<AppNotification?> fetchLatestOpeningOfficeUpdate() async {
    final response = await _apiClient.getObject('/api/openings/latest');
    final item = response['item'];

    if (item is! Map) {
      return null;
    }

    return AppNotification.fromLatestOpening(Map<String, dynamic>.from(item));
  }

  Future<Map<String, dynamic>> applyToOpening({
    required String openingId,
    required Map<String, dynamic> body,
  }) {
    return _apiClient.postJson('/api/openings/$openingId/apply', body: body);
  }
}
