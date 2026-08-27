import 'dart:typed_data';

Future<String> saveAndOpenDownloadedFileImpl({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) {
  throw UnsupportedError('File download is not supported on this platform.');
}

// SMART_PDM_FILE_VIEW_DOWNLOAD_SPLIT_V1
Future<String> openDownloadedFilePreviewImpl({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) {
  throw UnsupportedError('File preview is not supported on this platform.');
}

Future<String> saveDownloadedFileImpl({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) {
  throw UnsupportedError('File download is not supported on this platform.');
}
