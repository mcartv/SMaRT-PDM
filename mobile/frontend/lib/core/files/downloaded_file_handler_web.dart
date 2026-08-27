// ignore_for_file: deprecated_member_use
import 'dart:html' as html;
import 'dart:typed_data';

Future<String> saveAndOpenDownloadedFileImpl({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) async {
  final safeName = _safeFileName(fileName);
  final blob = html.Blob(<Object>[bytes], contentType);
  final url = html.Url.createObjectUrlFromBlob(blob);
  final anchor = html.AnchorElement(href: url)
    ..download = safeName
    ..style.display = 'none';

  html.document.body?.append(anchor);
  anchor.click();
  anchor.remove();
  html.Url.revokeObjectUrl(url);
  return 'Download started for $safeName.';
}

// SMART_PDM_FILE_VIEW_DOWNLOAD_SPLIT_V1
Future<String> openDownloadedFilePreviewImpl({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) async {
  final safeName = _safeFileName(fileName);
  final blob = html.Blob(<Object>[bytes], contentType);
  final url = html.Url.createObjectUrlFromBlob(blob);

  final opened = html.window.open(url, '_blank');

  // Keep the URL alive long enough for the browser/PDF viewer to consume it.
  Future<void>.delayed(const Duration(seconds: 30), () {
    html.Url.revokeObjectUrl(url);
  });

  if (opened == null) {
    return 'The official endorsement slip was loaded, but the browser blocked the preview window.';
  }

  return 'Opened $safeName.';
}

Future<String> saveDownloadedFileImpl({
  required Uint8List bytes,
  required String fileName,
  required String contentType,
}) async {
  final safeName = _safeFileName(fileName);
  final blob = html.Blob(<Object>[bytes], contentType);
  final url = html.Url.createObjectUrlFromBlob(blob);
  final anchor = html.AnchorElement(href: url)
    ..download = safeName
    ..style.display = 'none';

  html.document.body?.append(anchor);
  anchor.click();
  anchor.remove();
  html.Url.revokeObjectUrl(url);

  return 'Download started for $safeName.';
}

String _safeFileName(String value) {
  final cleaned = value
      .trim()
      .replaceAll(RegExp(r'[^a-zA-Z0-9._-]+'), '_')
      .replaceAll(RegExp(r'_+'), '_');
  return cleaned.isEmpty ? 'document.pdf' : cleaned;
}
