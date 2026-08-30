import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:smartpdm_mobileapp/core/config/app_config.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';

class ApiDownload {
  const ApiDownload({
    required this.bytes,
    required this.fileName,
    required this.contentType,
  });

  final Uint8List bytes;
  final String fileName;
  final String contentType;
}

class ApiClient {
  ApiClient({http.Client? httpClient})
    : _httpClient = httpClient ?? http.Client();

  final http.Client _httpClient;
  final SessionService _sessionService = const SessionService();

  Uri buildUri(String path) {
    final normalizedBaseUrl = AppConfig.apiBaseUrl.replaceFirst(
      RegExp(r'/+$'),
      '',
    );
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$normalizedBaseUrl$normalizedPath');
  }

  Future<Map<String, String>> _buildHeaders({
    String? contentType,
    Map<String, String> extra = const {},
  }) async {
    final headers = <String, String>{...extra};

    headers.putIfAbsent('Accept', () => 'application/json');

    if (contentType != null) {
      headers['Content-Type'] = contentType;
    }

    final session = await _sessionService.getCurrentUser();

    if (session.token.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer ${session.token.trim()}';
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

  Future<ApiDownload> downloadBytes(
    String path, {
    Duration timeout = const Duration(seconds: 30),
  }) async {
    try {
      final response = await _httpClient
          .get(
            buildUri(path),
            headers: await _buildHeaders(
              extra: const {'Accept': 'application/pdf'},
            ),
          )
          .timeout(timeout);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw _buildApiException(response);
      }

      return ApiDownload(
        bytes: response.bodyBytes,
        fileName: _fileNameFromDisposition(
          response.headers['content-disposition'],
        ),
        contentType: response.headers['content-type'] ?? 'application/pdf',
      );
    } on TimeoutException {
      throw const ApiException(
        'Download timed out. Please check your connection and try again.',
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

  Future<Map<String, dynamic>> putJson(
    String path, {
    Map<String, dynamic> body = const {},
    Duration timeout = const Duration(seconds: 15),
  }) async {
    try {
      final response = await _httpClient
          .put(
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
    String? contentType,
    Map<String, String> fields = const {},
    Duration timeout = const Duration(seconds: 30),
  }) async {
    try {
      final request = http.MultipartRequest('POST', buildUri(path));
      request.fields.addAll(fields);
      request.headers.addAll(await _buildHeaders());
      request.files.add(
        await http.MultipartFile.fromPath(
          fieldName,
          filePath,
          contentType:
              contentType == null ? null : MediaType.parse(contentType),
        ),
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

  Future<Map<String, dynamic>> uploadBytes(
    String path, {
    required String fieldName,
    required Uint8List bytes,
    required String fileName,
    String? contentType,
    Map<String, String> fields = const {},
    Duration timeout = const Duration(seconds: 30),
  }) async {
    try {
      final request = http.MultipartRequest('POST', buildUri(path));
      request.fields.addAll(fields);
      request.headers.addAll(await _buildHeaders());
      request.files.add(
        http.MultipartFile.fromBytes(
          fieldName,
          bytes,
          filename: fileName,
          contentType:
              contentType == null ? null : MediaType.parse(contentType),
        ),
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
          final directMessage = decoded['error'] ?? decoded['message'];
          if (directMessage is String && directMessage.trim().isNotEmpty) {
            return ApiException.fromDynamicStatus(
              directMessage.trim(),
              decoded['statusCode'] ?? response.statusCode,
            );
          }

          final validationErrors = decoded['errors'];
          if (validationErrors is List) {
            final messages = validationErrors
                .map((item) {
                  if (item is String) return item.trim();
                  if (item is Map) {
                    return (item['message'] ?? item['error'])
                            ?.toString()
                            .trim() ??
                        '';
                  }
                  return '';
                })
                .where((message) => message.isNotEmpty)
                .toList(growable: false);

            if (messages.isNotEmpty) {
              return ApiException(
                messages.join('\n'),
                statusCode: response.statusCode,
              );
            }
          }
        }
      } catch (_) {
        // Fall through to the status-aware message below.
      }
    }

    return ApiException(
      _friendlyStatusMessage(response.statusCode),
      statusCode: response.statusCode,
    );
  }

  String _friendlyStatusMessage(int statusCode) {
    switch (statusCode) {
      case 400:
        return 'Some information is invalid or incomplete. Review the form and try again.';
      case 401:
        return 'Your session has expired. Log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested record is no longer available.';
      case 409:
        return 'This request conflicts with an existing record. Refresh and try again.';
      case 413:
        return 'The selected file is too large.';
      case 422:
        return 'Some required information is missing or invalid.';
      case 429:
        return 'Too many requests. Wait a moment before trying again.';
      default:
        if (statusCode >= 500) {
          return 'The server could not complete the request. Try again shortly.';
        }
        return 'The request could not be completed.';
    }
  }

  String _fileNameFromDisposition(String? value) {
    final header = value ?? '';
    final starMatch = RegExp(
      r"filename\*=UTF-8''([^;]+)",
      caseSensitive: false,
    ).firstMatch(header);
    if (starMatch != null) {
      return Uri.decodeComponent(starMatch.group(1) ?? '').trim();
    }

    final match = RegExp(
      r'filename="?([^";]+)"?',
      caseSensitive: false,
    ).firstMatch(header);
    final parsed = match?.group(1)?.trim();

    return parsed?.isNotEmpty == true ? parsed! : 'endorsement-slip.pdf';
  }
}
