import 'dart:typed_data';

Future<String> saveAndOpenDownloadedFileImpl({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) {
  throw UnsupportedError('File download is not supported on this platform.');
}
