import 'dart:typed_data';

import 'package:smartpdm_mobileapp/core/networking/api_client.dart';

class SigningSession {
  const SigningSession({
    required this.id,
    required this.expiresAt,
    required this.complete,
    required this.documents,
  });

  final String id;
  final DateTime? expiresAt;
  final bool complete;
  final Map<String, Map<String, dynamic>> documents;

  factory SigningSession.fromJson(Map<String, dynamic> json) {
    final rawDocuments = Map<String, dynamic>.from(
      json['documents'] as Map? ?? const {},
    );
    return SigningSession(
      id: json['signing_session_id']?.toString() ?? '',
      expiresAt: DateTime.tryParse(json['expires_at']?.toString() ?? ''),
      complete: json['complete'] == true,
      documents: rawDocuments.map(
        (key, value) => MapEntry(key, Map<String, dynamic>.from(value as Map)),
      ),
    );
  }

  bool uploaded(String type) => documents[type]?['uploaded'] == true;
}

class ApplicationSigningService {
  ApplicationSigningService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<SigningSession> createSession({
    required Map<String, dynamic> applicationForm,
    required String guardianName,
    required String guardianRelationship,
    required bool consentAcknowledged,
  }) async {
    final response = await _apiClient.postJson(
      '/api/applications/me/signing-sessions',
      body: {
        'application_form': applicationForm,
        'guardian_name': guardianName.trim(),
        'guardian_relationship': guardianRelationship.trim(),
        'consent_acknowledged': consentAcknowledged,
      },
      timeout: const Duration(seconds: 30),
    );
    return SigningSession.fromJson(response);
  }

  Future<SigningSession> getSession(String sessionId) async =>
      SigningSession.fromJson(
        await _apiClient.getObject(
          '/api/applications/me/signing-sessions/$sessionId',
        ),
      );

  Future<SigningSession> uploadBytes({
    required String sessionId,
    required String documentType,
    required Uint8List bytes,
    required String fileName,
  }) async => SigningSession.fromJson(
    await _apiClient.uploadBytes(
      '/api/applications/me/signing-sessions/$sessionId/documents/$documentType',
      fieldName: 'document',
      bytes: bytes,
      fileName: fileName,
      timeout: const Duration(seconds: 60),
    ),
  );
}
