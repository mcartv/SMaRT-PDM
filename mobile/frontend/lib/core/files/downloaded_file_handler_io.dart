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

// SMART_PDM_FILE_VIEW_DOWNLOAD_SPLIT_V1
Future<String> openDownloadedFilePreviewImpl({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) async {
  final safeName = _safeFileName(fileName);
  final directory = await getTemporaryDirectory();
  final file = File('${directory.path}/preview-$safeName');

  await file.writeAsBytes(bytes, flush: true);

  final result = await OpenFilex.open(file.path);

  if (result.type != ResultType.done) {
    return 'The official endorsement slip was loaded, but no compatible PDF viewer is available on this device.';
  }

  return 'Opened $safeName.';
}

Future<Directory> _downloadDirectory() async {
  // Android uses the app-specific Downloads directory. This works with scoped
  // storage and does not require broad storage permission.
  if (Platform.isAndroid) {
    try {
      final directories = await getExternalStorageDirectories(
        type: StorageDirectory.downloads,
      );

      if (directories != null && directories.isNotEmpty) {
        return directories.first;
      }
    } catch (_) {
      // Fall through to the application documents directory.
    }
  }

  try {
    final downloads = await getDownloadsDirectory();
    if (downloads != null) return downloads;
  } catch (_) {
    // Some mobile platforms do not expose a public downloads directory.
  }

  return getApplicationDocumentsDirectory();
}

Future<String> saveDownloadedFileImpl({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) async {
  final safeName = _safeFileName(fileName);
  final directory = await _downloadDirectory();
  await directory.create(recursive: true);

  final file = File('${directory.path}/$safeName');
  await file.writeAsBytes(bytes, flush: true);

  return 'Downloaded $safeName.';
}

String _safeFileName(String value) {
  final cleaned = value
      .trim()
      .replaceAll(RegExp(r'[^a-zA-Z0-9._-]+'), '_')
      .replaceAll(RegExp(r'_+'), '_');
  return cleaned.isEmpty ? 'document.pdf' : cleaned;
}
