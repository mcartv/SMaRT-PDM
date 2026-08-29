import 'dart:typed_data';

import 'package:crop_your_image/crop_your_image.dart';
import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;

import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';

Future<Uint8List?> showProfilePhotoCropDialog(
  BuildContext context, {
  required Uint8List imageBytes,
}) {
  return showDialog<Uint8List>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _ProfilePhotoCropDialog(imageBytes: imageBytes),
  );
}

class _ProfilePhotoCropDialog extends StatefulWidget {
  const _ProfilePhotoCropDialog({
    required this.imageBytes,
  });

  final Uint8List imageBytes;

  @override
  State<_ProfilePhotoCropDialog> createState() =>
      _ProfilePhotoCropDialogState();
}

class _ProfilePhotoCropDialogState
    extends State<_ProfilePhotoCropDialog> {
  final CropController _cropController = CropController();

  bool _isCropping = false;
  String? _errorMessage;

  void _usePhoto() {
    if (_isCropping) return;

    setState(() {
      _isCropping = true;
      _errorMessage = null;
    });

    _cropController.crop();
  }

  void _handleCropResult(Uint8List croppedImage) {
    try {
      final decoded = img.decodeImage(croppedImage);

      if (decoded == null) {
        throw StateError('Unable to decode cropped photo.');
      }

      // Normalize every finalized avatar to one predictable square JPEG.
      // This prevents browser MIME ambiguity and keeps profile-photo
      // dimensions within the backend's accepted range.
      final normalized = img.copyResize(
        decoded,
        width: 768,
        height: 768,
        interpolation: img.Interpolation.average,
      );

      final jpegBytes = Uint8List.fromList(
        img.encodeJpg(normalized, quality: 90),
      );

      if (!mounted) return;
      Navigator.of(context).pop(jpegBytes);
    } catch (error) {
      debugPrint('PROFILE PHOTO CROP ERROR: $error');
      if (!mounted) return;
      setState(() {
        _isCropping = false;
        _errorMessage =
            'The cropped photo could not be prepared. Adjust it and try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark =
        Theme.of(context).brightness == Brightness.dark;
    final surface = isDark
        ? AppColors.applicantDarkSurface
        : Colors.white;
    final textColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;
    final mutedColor = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.brown.withValues(alpha: 0.68);
    final cropHeight =
        (MediaQuery.sizeOf(context).height * 0.46).clamp(260.0, 400.0);

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(
        horizontal: 18,
        vertical: 24,
      ),
      backgroundColor: Colors.transparent,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Container(
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(24),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 12, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Crop Profile Photo',
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(
                                  color: textColor,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Move and zoom the photo inside the circle.',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: mutedColor),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Cancel',
                      onPressed: _isCropping
                          ? null
                          : () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              SizedBox(
                height: cropHeight,
                child: ColoredBox(
                  color: Colors.black,
                  child: Crop(
                      image: widget.imageBytes,
                      controller: _cropController,
                      onCropped: _handleCropResult,
                      aspectRatio: 1,
                      initialSize: 0.82,
                      withCircleUi: true,
                      interactive: true,
                      fixCropRect: true,
                      baseColor: Colors.black,
                      maskColor: Colors.black.withValues(alpha: 0.56),
                      progressIndicator: const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.gold,
                        ),
                      ),
                      willUpdateScale: (scale) => scale <= 5,
                    ),
                  ),
                ),
              if (_errorMessage != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                  child: Text(
                    _errorMessage!,
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(
                          color: Theme.of(context).colorScheme.error,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _isCropping
                            ? null
                            : () => Navigator.of(context).pop(),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _isCropping ? null : _usePhoto,
                        icon: _isCropping
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.check_rounded),
                        label: Text(
                          _isCropping ? 'Preparing...' : 'Use Photo',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
