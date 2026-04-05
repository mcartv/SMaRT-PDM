import 'package:shared_preferences/shared_preferences.dart';

class SessionUser {
  final String token;
  final String userId;
  final String email;
  final String studentId;
  final String? avatarUrl;

  const SessionUser({
    required this.token,
    required this.userId,
    required this.email,
    required this.studentId,
    this.avatarUrl,
  });
}

class SessionService {
  const SessionService();

  Future<void> saveAuthSession({
    required String token,
    required String userId,
    required String email,
    required String studentId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', token);
    await prefs.setString('user_id', userId);
    await prefs.setString('user_email', email);
    await prefs.setString('user_student_id', studentId);
  }

  Future<SessionUser> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    return SessionUser(
      token: prefs.getString('jwt_token') ?? '',
      userId: prefs.getString('user_id') ?? '',
      email: prefs.getString('user_email') ?? '',
      studentId: prefs.getString('user_student_id') ?? '',
      avatarUrl: prefs.getString('user_profile_image'),
    );
  }

  Future<void> saveProfileImage(String avatarUrl) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_profile_image', avatarUrl);
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await prefs.remove('user_id');
    await prefs.remove('user_email');
    await prefs.remove('user_student_id');
    await prefs.remove('user_first_name');
    await prefs.remove('user_last_name');
    await prefs.remove('user_profile_image');
  }
}
