import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/profile/data/services/profile_service.dart';

typedef ApplicantHomeRoleProfileLoader =
    Future<Map<String, dynamic>> Function();

/// Resolves the dashboard branch without coupling Home availability to the
/// notification, device-token, or socket initialization lifecycle.
class ApplicantHomeRoleResolver {
  ApplicantHomeRoleResolver({
    SessionService sessionService = const SessionService(),
    ApplicantHomeRoleProfileLoader? loadProfile,
  }) : _sessionService = sessionService,
       _loadProfile =
           loadProfile ??
           ProfileService(sessionService: sessionService).fetchMyProfile;

  final SessionService _sessionService;
  final ApplicantHomeRoleProfileLoader _loadProfile;

  Future<bool> resolve({bool liveScholarAccess = false}) async {
    if (liveScholarAccess) return true;

    final cachedSession = await _sessionService.getCurrentUser();
    if (cachedSession.hasScholarAccess) return true;
    if (cachedSession.token.isEmpty) return false;

    try {
      final profile = await _loadProfile();
      return profile['has_scholar_access'] == true;
    } catch (_) {
      final fallbackSession = await _sessionService.getCurrentUser();
      return fallbackSession.hasScholarAccess;
    }
  }
}
