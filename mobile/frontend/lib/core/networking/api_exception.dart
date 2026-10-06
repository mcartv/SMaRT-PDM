// SMaRT-PDM: api exception — api exception (mobile frontend); supports mobile UI behavior.
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
  // toString: handles to string for the api exception flow.
  String toString() => message;
}
