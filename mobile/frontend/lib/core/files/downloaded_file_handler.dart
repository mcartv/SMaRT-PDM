import 'dart:typed_data';

import 'downloaded_file_handler_stub.dart'
    if (dart.library.io) 'downloaded_file_handler_io.dart'
    if (dart.library.html) 'downloaded_file_handler_web.dart';

Future<String> saveAndOpenDownloadedFile({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) {
  return saveAndOpenDownloadedFileImpl(
    bytes: bytes,
    fileName: fileName,
    contentType: contentType,
  );
}

// SMART_PDM_FILE_VIEW_DOWNLOAD_SPLIT_V1
// View uses a temporary/platform preview location.
// Download saves a persistent copy without forcing the file viewer to open.
Future<String> openDownloadedFilePreview({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) {
  return openDownloadedFilePreviewImpl(
    bytes: bytes,
    fileName: fileName,
    contentType: contentType,
  );
}

Future<String> saveDownloadedFile({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) {
  return saveDownloadedFileImpl(
    bytes: bytes,
    fileName: fileName,
    contentType: contentType,
  );
}
