import 'dart:io';
import 'dart:typed_data';

import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

Future<String> saveAndOpenDownloadedFileImpl({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) async {
  final safeName = _safeFileName(fileName);
  final directory = await getApplicationDocumentsDirectory();
  final file = File('${directory.path}/$safeName');
  await file.writeAsBytes(bytes, flush: true);

  final result = await OpenFilex.open(file.path);
  if (result.type != ResultType.done) {
    return 'Saved as $safeName. No compatible app was available to open it automatically.';
  }
  return 'Saved and opened $safeName.';
}

String _safeFileName(String value) {
  final cleaned = value
      .trim()
      .replaceAll(RegExp(r'[^a-zA-Z0-9._-]+'), '_')
      .replaceAll(RegExp(r'_+'), '_');
  return cleaned.isEmpty ? 'document.pdf' : cleaned;
}
