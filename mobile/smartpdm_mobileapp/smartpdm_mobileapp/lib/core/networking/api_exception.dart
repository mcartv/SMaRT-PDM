class ApiException implements Exception {
  final String message;
  final int? statusCode;

  const ApiException(this.message, {this.statusCode});

  factory ApiException.fromDynamicStatus(String message, dynamic statusCode) {
    return ApiException(
      message,
      statusCode: statusCode is int
          ? statusCode
          : int.tryParse(statusCode?.toString() ?? ''),
    );
  }

  @override
  String toString() => message;
}
