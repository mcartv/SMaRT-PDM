import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:smartpdm_mobileapp/config/app_config.dart';
import 'package:smartpdm_mobileapp/services/api_exception.dart';
import 'package:smartpdm_mobileapp/services/session_service.dart';

class ApiClient {
  ApiClient({http.Client? httpClient})
    : _httpClient = httpClient ?? http.Client();

  final http.Client _httpClient;
  final SessionService _sessionService = const SessionService();

  Uri buildUri(String path) => Uri.parse('${AppConfig.apiBaseUrl}$path');

  Future<Map<String, String>> _buildHeaders({
    String? contentType,
    Map<String, String> extra = const {},
  }) async {
    final headers = <String, String>{...extra};
    if (contentType != null) {
      headers['Content-Type'] = contentType;
    }

    final session = await _sessionService.getCurrentUser();
    if (session.token.isNotEmpty) {
      headers['Authorization'] = 'Bearer ${session.token}';
    }

    return headers;
  }

  Future<Map<String, dynamic>> postJson(
    String path, {
    required Map<String, dynamic> body,
    Duration timeout = const Duration(seconds: 15),
  }) async {
    try {
      final response = await _httpClient
          .post(
            buildUri(path),
            headers: await _buildHeaders(contentType: 'application/json'),
            body: jsonEncode(body),
          )
          .timeout(timeout);

      return _decodeObjectResponse(response);
    } on TimeoutException {
      throw const ApiException(
        'Request timed out. Please check your connection and try again.',
      );
    } on SocketException {
      throw const ApiException(
        'Network connection error. Please check your internet connection.',
      );
    } on http.ClientException {
      throw const ApiException(
        'Connection error. Please ensure your backend is running and accessible.',
      );
    }
  }

  Future<List<dynamic>> getList(
    String path, {
    Duration timeout = const Duration(seconds: 15),
  }) async {
    try {
      final response = await _httpClient
          .get(buildUri(path), headers: await _buildHeaders())
          .timeout(timeout);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw _buildApiException(response);
      }

      if (response.body.isEmpty) {
        return const [];
      }

      final decoded = jsonDecode(response.body);
      if (decoded is List<dynamic>) {
        return decoded;
      }

      throw const ApiException('Unexpected response from server.');
    } on TimeoutException {
      throw const ApiException(
        'Request timed out. Please check your connection and try again.',
      );
    } on SocketException {
      throw const ApiException(
        'Network connection error. Please check your internet connection.',
      );
    } on http.ClientException {
      throw const ApiException(
        'Connection error. Please ensure your backend is running and accessible.',
      );
    }
  }

  Future<Map<String, dynamic>> getObject(
    String path, {
    Duration timeout = const Duration(seconds: 15),
  }) async {
    try {
      final response = await _httpClient
          .get(buildUri(path), headers: await _buildHeaders())
          .timeout(timeout);

      return _decodeObjectResponse(response);
    } on TimeoutException {
      throw const ApiException(
        'Request timed out. Please check your connection and try again.',
      );
    } on SocketException {
      throw const ApiException(
        'Network connection error. Please check your internet connection.',
      );
    } on http.ClientException {
      throw const ApiException(
        'Connection error. Please ensure your backend is running and accessible.',
      );
    }
  }

  Future<Map<String, dynamic>> patchJson(
    String path, {
    Map<String, dynamic> body = const {},
    Duration timeout = const Duration(seconds: 15),
  }) async {
    try {
      final response = await _httpClient
          .patch(
            buildUri(path),
            headers: await _buildHeaders(contentType: 'application/json'),
            body: jsonEncode(body),
          )
          .timeout(timeout);

      return _decodeObjectResponse(response);
    } on TimeoutException {
      throw const ApiException(
        'Request timed out. Please check your connection and try again.',
      );
    } on SocketException {
      throw const ApiException(
        'Network connection error. Please check your internet connection.',
      );
    } on http.ClientException {
      throw const ApiException(
        'Connection error. Please ensure your backend is running and accessible.',
      );
    }
  }

  Future<Map<String, dynamic>> deleteJson(
    String path, {
    Duration timeout = const Duration(seconds: 15),
  }) async {
    try {
      final response = await _httpClient
          .delete(buildUri(path), headers: await _buildHeaders())
          .timeout(timeout);

      return _decodeObjectResponse(response);
    } on TimeoutException {
      throw const ApiException(
        'Request timed out. Please check your connection and try again.',
      );
    } on SocketException {
      throw const ApiException(
        'Network connection error. Please check your internet connection.',
      );
    } on http.ClientException {
      throw const ApiException(
        'Connection error. Please ensure your backend is running and accessible.',
      );
    }
  }

  Future<Map<String, dynamic>> uploadFile(
    String path, {
    required String fieldName,
    required String filePath,
    Map<String, String> fields = const {},
    Duration timeout = const Duration(seconds: 30),
  }) async {
    try {
      final request = http.MultipartRequest('POST', buildUri(path));
      request.fields.addAll(fields);
      request.headers.addAll(await _buildHeaders());
      request.files.add(await http.MultipartFile.fromPath(fieldName, filePath));

      final streamedResponse = await request.send().timeout(timeout);
      final response = await http.Response.fromStream(streamedResponse);
      return _decodeObjectResponse(response);
    } on TimeoutException {
      throw const ApiException(
        'Upload timed out. Please check your connection and try again.',
      );
    } on SocketException {
      throw const ApiException(
        'Network connection error. Please check your internet connection.',
      );
    } on http.ClientException {
      throw const ApiException(
        'Connection error. Please ensure your backend is running and accessible.',
      );
    }
  }

  Future<Map<String, dynamic>> uploadBytes(
    String path, {
    required String fieldName,
    required Uint8List bytes,
    required String fileName,
    Map<String, String> fields = const {},
    Duration timeout = const Duration(seconds: 30),
  }) async {
    try {
      final request = http.MultipartRequest('POST', buildUri(path));
      request.fields.addAll(fields);
      request.headers.addAll(await _buildHeaders());
      request.files.add(
        http.MultipartFile.fromBytes(fieldName, bytes, filename: fileName),
      );

      final streamedResponse = await request.send().timeout(timeout);
      final response = await http.Response.fromStream(streamedResponse);
      return _decodeObjectResponse(response);
    } on TimeoutException {
      throw const ApiException(
        'Upload timed out. Please check your connection and try again.',
      );
    } on SocketException {
      throw const ApiException(
        'Network connection error. Please check your internet connection.',
      );
    } on http.ClientException {
      throw const ApiException(
        'Connection error. Please ensure your backend is running and accessible.',
      );
    }
  }

  Map<String, dynamic> _decodeObjectResponse(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _buildApiException(response);
    }

    if (response.body.isEmpty) {
      return <String, dynamic>{};
    }

    final decoded = jsonDecode(response.body);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }

    throw const ApiException('Unexpected response from server.');
  }

  ApiException _buildApiException(http.Response response) {
    if (response.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          final message = decoded['error'] ?? decoded['message'];
          if (message is String && message.trim().isNotEmpty) {
            return ApiException(message, statusCode: response.statusCode);
          }
        }
      } catch (_) {
        // Fall through to the generic message below.
      }
    }

    return ApiException(
      'Request failed with status ${response.statusCode}.',
      statusCode: response.statusCode,
    );
  }
}
