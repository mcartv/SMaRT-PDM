// SMaRT-PDM: downloaded file handler web — downloaded file handler web (mobile frontend); supports mobile UI behavior.
// ignore_for_file: deprecated_member_use
import 'dart:html' as html;
import 'dart:typed_data';

// saveAndOpenDownloadedFileImpl: validates and saves save and open downloaded file impl for the downloaded file handler web flow.
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

  // Keep the object URL alive until the browser consumes the synthetic click.
  // Revoking it synchronously can cancel downloads in desktop browsers.
  await Future<void>.delayed(const Duration(seconds: 1));
  html.Url.revokeObjectUrl(url);
  return 'Download started for $safeName.';
}

// _safeFileName: handles safe file name for the downloaded file handler web flow.
String _safeFileName(String value) {
  final cleaned = value
      .trim()
      .replaceAll(RegExp(r'[^a-zA-Z0-9._-]+'), '_')
      .replaceAll(RegExp(r'_+'), '_');
  return cleaned.isEmpty ? 'document.pdf' : cleaned;
}
