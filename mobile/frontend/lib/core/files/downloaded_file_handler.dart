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
