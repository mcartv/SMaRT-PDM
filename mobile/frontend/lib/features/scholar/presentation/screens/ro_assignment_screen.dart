import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_button_styles.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ROAssignmentScreen extends StatefulWidget {
  final bool showBottomNav;
  final bool showTopBar;

  const ROAssignmentScreen({
    super.key,
    this.showBottomNav = true,
    this.showTopBar = true,
  });

  @override
  State<ROAssignmentScreen> createState() => _ROAssignmentScreenState();
}

class RoPickedPhoto {
  const RoPickedPhoto({
    required this.file,
    required this.bytes,
    required this.fileName,
    required this.mimeType,
    required this.capturedAtDevice,
    required this.source,
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
  });

  final XFile file;
  final Uint8List bytes;
  final String fileName;
  final String mimeType;
  final DateTime capturedAtDevice;
  final ImageSource source;
  final double latitude;
  final double longitude;
  final double accuracyMeters;

  String get sourceLabel => source == ImageSource.camera ? 'camera' : 'gallery';
}

class RoActionInput {
  const RoActionInput({required this.note, required this.photo});

  final String note;
  final RoPickedPhoto? photo;
}

class RoConcernInput {
  const RoConcernInput({
    required this.category,
    required this.description,
  });

  final String category;
  final String description;
}

class _ROAssignmentScreenState extends State<ROAssignmentScreen>
    with SingleTickerProviderStateMixin {
  final ApiClient _apiClient = ApiClient();
  final SessionService _sessionService = const SessionService();
  final ImagePicker _imagePicker = ImagePicker();
  final TextEditingController _noteController = TextEditingController();


  NotificationProvider? _notificationProvider;
  int _lastRoRevision = 0;
  late final TabController _tabController;

  bool _isLoading = true;
  bool _pendingRealtimeReload = false;
  bool _isSubmitting = false;
  bool _isConcernSheetOpen = false;
  String? _errorMessage;

  List<RoAssignment> _items = [];
  bool _isApprovedScholar = false;
  bool _shouldShowModule = false;

  Timer? _activeTimer;
  Timer? _liveSyncTimer;
  bool _roFetchInProgress = false;
  String _captureArea = '';
  String _captureAction = 'RO ATTENDANCE';

  @override
  void initState() {
    super.initState();

    _tabController = TabController(length: 2, vsync: this);
    _loadRo();

    _activeTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;

      if (_items.any((item) => item.activeLog != null)) {
        setState(() {});
      }
    });
    _liveSyncTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
      _requestRoRefresh();
    });
  }
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (identical(_notificationProvider, provider)) {
      return;
    }

    _notificationProvider?.removeListener(_handleRealtimeRoUpdates);
    _notificationProvider = provider;
    _lastRoRevision = provider.roRevision;
    provider.addListener(_handleRealtimeRoUpdates);
  }

  void _handleRealtimeRoUpdates() {
    final provider = _notificationProvider;
    if (provider == null || provider.roRevision == _lastRoRevision) {
      return;
    }

    _lastRoRevision = provider.roRevision;
    _requestRoRefresh();
  }



  @override
  void dispose() {
    _notificationProvider?.removeListener(_handleRealtimeRoUpdates);
    _activeTimer?.cancel();
    _liveSyncTimer?.cancel();
    _tabController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  List<RoAssignment> get _activeItems {
    return _items.where((item) => !item.isCleared).toList();
  }

  List<RoAssignment> get _completedItems {
    return _items.where((item) => item.isCleared).toList();
  }

  bool get _hasAnyActiveSession {
    return _items.any((item) => item.activeLog != null);
  }

  Future<void> _loadRo({bool silent = false}) async {
    if (_roFetchInProgress) {
      _pendingRealtimeReload = true;
      return;
    }

    _roFetchInProgress = true;
    if (!silent && mounted) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final response = await _apiClient.getObject('/api/ro/me');
      final items = (response['items'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(RoAssignment.fromJson)
          .toList();

      if (!mounted) return;

      setState(() {
        _items = items;
        _isApprovedScholar = response['isApprovedScholar'] == true;
        _shouldShowModule = response['shouldShowModule'] == true;
        _errorMessage = null;
      });
    } catch (error) {
      if (!mounted) return;
      if (!silent || _items.isEmpty) {
        setState(() => _errorMessage = _cleanError(error));
      }
    } finally {
      _roFetchInProgress = false;
      if (mounted && !silent) {
        setState(() => _isLoading = false);
      }
      if (_pendingRealtimeReload && mounted && !_isSubmitting && !_isConcernSheetOpen) {
        _pendingRealtimeReload = false;
        scheduleMicrotask(() => _loadRo(silent: true));
      }
    }
  }

  void _requestRoRefresh() {
    if (!mounted) return;
    if (_roFetchInProgress || _isSubmitting || _isConcernSheetOpen) {
      _pendingRealtimeReload = true;
      return;
    }
    _loadRo(silent: true);
  }

  String _guessImageMimeType({required XFile file, required Uint8List bytes}) {
    final providedMime = (file.mimeType ?? '').trim().toLowerCase();

    if (providedMime.startsWith('image/')) {
      return providedMime == 'image/jpg' ? 'image/jpeg' : providedMime;
    }

    final name = file.name.trim().toLowerCase();

    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';

    if (bytes.length >= 3 &&
        bytes[0] == 0xFF &&
        bytes[1] == 0xD8 &&
        bytes[2] == 0xFF) {
      return 'image/jpeg';
    }

    if (bytes.length >= 8 &&
        bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4E &&
        bytes[3] == 0x47 &&
        bytes[4] == 0x0D &&
        bytes[5] == 0x0A &&
        bytes[6] == 0x1A &&
        bytes[7] == 0x0A) {
      return 'image/png';
    }

    if (bytes.length >= 12 &&
        bytes[0] == 0x52 &&
        bytes[1] == 0x49 &&
        bytes[2] == 0x46 &&
        bytes[3] == 0x46 &&
        bytes[8] == 0x57 &&
        bytes[9] == 0x45 &&
        bytes[10] == 0x42 &&
        bytes[11] == 0x50) {
      return 'image/webp';
    }

    return 'image/jpeg';
  }

  String _extensionFromMimeType(String mimeType) {
    final value = mimeType.trim().toLowerCase();

    if (value == 'image/png') return 'png';
    if (value == 'image/webp') return 'webp';

    return 'jpg';
  }

  String _safeRoPhotoFileName({required XFile file, required String mimeType}) {
    final rawName = file.name.trim();
    final lowerName = rawName.toLowerCase();

    if (lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.webp')) {
      return rawName;
    }

    final extension = _extensionFromMimeType(mimeType);
    return 'ro-proof-${DateTime.now().millisecondsSinceEpoch}.$extension';
  }

  Future<RoPickedPhoto?> _pickRoProofPhoto(ImageSource source) async {
    if (source != ImageSource.camera) {
      throw Exception('RO attendance requires a live camera photo.');
    }

    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception(
        'Enable location services before taking the attendance photo.',
      );
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw Exception('Location permission is required for RO attendance.');
    }

    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 12),
      ),
    );
    final pickedFile = await _imagePicker.pickImage(
      source: ImageSource.camera,
      imageQuality: 88,
      maxWidth: 1800,
      preferredCameraDevice: CameraDevice.rear,
    );
    if (pickedFile == null) return null;
    final capturedAt = DateTime.now();

    final originalBytes = await pickedFile.readAsBytes();
    final decoded = img.decodeImage(originalBytes);
    if (decoded == null) {
      throw Exception('The captured image could not be processed.');
    }

    final localTime = capturedAt.toLocal();
    final stampLines = <String>[
      _captureAction,
      'Date/Time: ${localTime.year.toString().padLeft(4, '0')}-${localTime.month.toString().padLeft(2, '0')}-${localTime.day.toString().padLeft(2, '0')} '
          '${localTime.hour.toString().padLeft(2, '0')}:${localTime.minute.toString().padLeft(2, '0')}:${localTime.second.toString().padLeft(2, '0')}',
      'RO Area: ${_captureArea.isEmpty ? 'Assigned Department' : _captureArea}',
      'Location: ${position.latitude.toStringAsFixed(6)}, ${position.longitude.toStringAsFixed(6)}',
      'Accuracy: ±${position.accuracy.toStringAsFixed(1)} m',
    ];

    const padding = 18;
    const lineHeight = 30;
    final panelHeight = padding * 2 + lineHeight * stampLines.length;
    final panelTop = decoded.height - panelHeight;
    img.fillRect(
      decoded,
      x1: 0,
      y1: panelTop < 0 ? 0 : panelTop,
      x2: decoded.width - 1,
      y2: decoded.height - 1,
      color: img.ColorRgba8(0, 0, 0, 190),
    );
    var y = (panelTop < 0 ? 0 : panelTop) + padding;
    for (final line in stampLines) {
      img.drawString(
        decoded,
        line,
        font: img.arial24,
        x: padding,
        y: y,
        color: img.ColorRgb8(255, 255, 255),
      );
      y += lineHeight;
    }

    final bytes = Uint8List.fromList(img.encodeJpg(decoded, quality: 88));
    final fileName =
        'ro-${_captureAction.toLowerCase().replaceAll(' ', '-')}-${capturedAt.millisecondsSinceEpoch}.jpg';

    return RoPickedPhoto(
      file: pickedFile,
      bytes: bytes,
      fileName: fileName,
      mimeType: 'image/jpeg',
      capturedAtDevice: capturedAt,
      source: ImageSource.camera,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyMeters: position.accuracy,
    );
  }

  Future<Map<String, String>> _buildMultipartHeaders() async {
    final session = await _sessionService.getCurrentUser();
    final headers = <String, String>{'Accept': 'application/json'};

    if (session.token.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer ${session.token.trim()}';
    }

    return headers;
  }

  Map<String, dynamic> _decodeMultipartResponse(http.Response response) {
    final body = response.body.trim();
    final fallbackMessage =
        response.statusCode >= 200 && response.statusCode < 300
        ? 'Request completed.'
        : 'Request failed.';

    if (body.isEmpty) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return <String, dynamic>{};
      }

      throw Exception(fallbackMessage);
    }

    final decoded = jsonDecode(body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (decoded is Map<String, dynamic>) {
        throw Exception(
          decoded['message']?.toString() ??
              decoded['error']?.toString() ??
              fallbackMessage,
        );
      }

      throw Exception(fallbackMessage);
    }

    if (decoded is Map<String, dynamic>) return decoded;

    throw Exception('Unexpected response from server.');
  }

  Future<Map<String, dynamic>> _sendRoMultipart({
    required String path,
    required Map<String, String> fields,
    RoPickedPhoto? photo,
    String method = 'POST',
    Duration timeout = const Duration(seconds: 45),
  }) async {
    try {
      final request = http.MultipartRequest(method, _apiClient.buildUri(path));
      request.headers.addAll(await _buildMultipartHeaders());
      request.fields.addAll(fields);

      if (photo != null) {
        request.files.add(
          http.MultipartFile.fromBytes(
            'photo',
            photo.bytes,
            filename: photo.fileName,
            contentType: MediaType.parse(photo.mimeType),
          ),
        );
      }

      final streamedResponse = await request.send().timeout(timeout);
      final response = await http.Response.fromStream(streamedResponse);
      return _decodeMultipartResponse(response);
    } on TimeoutException {
      throw Exception(
        'Upload timed out. Please check your connection and try again.',
      );
    } on http.ClientException {
      throw Exception(
        'Connection error. Please ensure your backend is running and accessible.',
      );
    } on FormatException {
      throw Exception('Unexpected response from server.');
    }
  }

  Future<RoActionInput?> _showRoActionDialog({
    required String title,
    required String hint,
    required String primaryLabel,
  }) async {
    _noteController.clear();
    RoPickedPhoto? selectedPhoto;

    return showDialog<RoActionInput>(
      context: context,
      barrierDismissible: !_isSubmitting,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> choosePhoto(ImageSource source) async {
              try {
                final photo = await _pickRoProofPhoto(source);

                if (photo == null) {
                  _showSnack('Photo selection was cancelled.');
                  return;
                }

                setDialogState(() {
                  selectedPhoto = photo;
                });
              } catch (error) {
                _showSnack('Unable to get photo: ${_cleanError(error)}');
              }
            }

            return Dialog(
              insetPadding: const EdgeInsets.symmetric(
                horizontal: 20,
                vertical: 24,
              ),
              backgroundColor: Colors.transparent,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 460),
                  child: AnimatedPadding(
                    duration: const Duration(milliseconds: 180),
                    curve: Curves.easeOut,
                    padding: EdgeInsets.only(
                      bottom: MediaQuery.of(context).viewInsets.bottom,
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(color: const Color(0xFFE7D8C7)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.18),
                            blurRadius: 28,
                            offset: const Offset(0, 14),
                          ),
                        ],
                      ),
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 44,
                              height: 5,
                              decoration: BoxDecoration(
                                color: const Color(0xFFB8A99A),
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                            const SizedBox(height: 18),
                            Text(
                              title,
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.titleLarge
                                  ?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    color: const Color(0xFF1C1917),
                                  ),
                            ),
                            const SizedBox(height: 18),
                            TextField(
                              controller: _noteController,
                              minLines: 3,
                              maxLines: 4,
                              textInputAction: TextInputAction.newline,
                              decoration: InputDecoration(
                                hintText: hint,
                                hintStyle: const TextStyle(
                                  color: Color(0xFF786D63),
                                  fontSize: 14,
                                ),
                                filled: true,
                                fillColor: const Color(0xFFFFFBF6),
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 14,
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(18),
                                  borderSide: const BorderSide(
                                    color: Color(0xFF8B7A68),
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(18),
                                  borderSide: const BorderSide(
                                    color: Color(0xFF4A2400),
                                    width: 1.5,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.74),
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color: const Color(0xFFE7D8C7),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Live camera proof is required',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF1C1917),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    selectedPhoto == null
                                        ? 'Take a live camera photo. The date, time, RO area, and GPS coordinates will be burned into the image.'
                                        : 'Selected: ${selectedPhoto!.fileName}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      height: 1.35,
                                      color: Color(0xFF78716C),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if (selectedPhoto != null) ...[
                                    const SizedBox(height: 12),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(16),
                                      child: Stack(
                                        children: [
                                          Container(
                                            width: double.infinity,
                                            height: 170,
                                            color: const Color(0xFFF5EEE6),
                                            child: Image.memory(
                                              selectedPhoto!.bytes,
                                              fit: BoxFit.cover,
                                              errorBuilder:
                                                  (context, error, stackTrace) {
                                                    return const Center(
                                                      child: Column(
                                                        mainAxisSize:
                                                            MainAxisSize.min,
                                                        children: [
                                                          Icon(
                                                            Icons
                                                                .broken_image_rounded,
                                                            color: Color(
                                                              0xFF78716C,
                                                            ),
                                                          ),
                                                          SizedBox(height: 6),
                                                          Text(
                                                            'Unable to preview image',
                                                            style: TextStyle(
                                                              color: Color(
                                                                0xFF78716C,
                                                              ),
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w700,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    );
                                                  },
                                            ),
                                          ),
                                          Positioned(
                                            left: 10,
                                            top: 10,
                                            child: Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 10,
                                                    vertical: 6,
                                                  ),
                                              decoration: BoxDecoration(
                                                color: Colors.black.withOpacity(
                                                  0.62,
                                                ),
                                                borderRadius:
                                                    BorderRadius.circular(999),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(
                                                    selectedPhoto!.source ==
                                                            ImageSource.camera
                                                        ? Icons
                                                              .camera_alt_rounded
                                                        : Icons
                                                              .photo_library_rounded,
                                                    color: Colors.white,
                                                    size: 14,
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    selectedPhoto!
                                                                .sourceLabel ==
                                                            'camera'
                                                        ? 'Camera'
                                                        : 'Gallery',
                                                    style: const TextStyle(
                                                      color: Colors.white,
                                                      fontSize: 11,
                                                      fontWeight:
                                                          FontWeight.w900,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                          Positioned(
                                            right: 10,
                                            top: 10,
                                            child: InkWell(
                                              onTap: _isSubmitting
                                                  ? null
                                                  : () {
                                                      setDialogState(() {
                                                        selectedPhoto = null;
                                                      });
                                                    },
                                              borderRadius:
                                                  BorderRadius.circular(999),
                                              child: Container(
                                                width: 32,
                                                height: 32,
                                                decoration: BoxDecoration(
                                                  color: Colors.black
                                                      .withOpacity(0.62),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: const Icon(
                                                  Icons.close_rounded,
                                                  color: Colors.white,
                                                  size: 18,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          onPressed: _isSubmitting
                                              ? null
                                              : () => choosePhoto(
                                                  ImageSource.camera,
                                                ),
                                          icon: const Icon(
                                            Icons.camera_alt_rounded,
                                            size: 18,
                                          ),
                                          label: Text(selectedPhoto == null ? 'Take Photo' : 'Retake Photo'),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor: const Color(
                                              0xFF4A2400,
                                            ),
                                            side: const BorderSide(
                                              color: Color(0xFFD8C7B3),
                                            ),
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(14),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (selectedPhoto != null) ...[
                                    const SizedBox(height: 8),
                                    SizedBox(
                                      width: double.infinity,
                                      child: TextButton.icon(
                                        onPressed: _isSubmitting
                                            ? null
                                            : () {
                                                setDialogState(() {
                                                  selectedPhoto = null;
                                                });
                                              },
                                        icon: const Icon(
                                          Icons.close_rounded,
                                          size: 18,
                                        ),
                                        label: const Text(
                                          'Remove selected photo',
                                        ),
                                        style: AppButtonStyles.destructiveText(
                                          dialogContext,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                style: FilledButton.styleFrom(
                                  backgroundColor: AppColors.darkBrown,
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 14,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                ),
                                onPressed: _isSubmitting
                                    ? null
                                    : () {
                                        if (selectedPhoto == null) {
                                          _showSnack(
                                            'Take the required live camera photo first.',
                                          );
                                          return;
                                        }
                                        Navigator.pop(
                                          dialogContext,
                                          RoActionInput(
                                            note: _noteController.text.trim(),
                                            photo: selectedPhoto,
                                          ),
                                        );
                                      },
                                child: Text(primaryLabel),
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextButton(
                              onPressed: _isSubmitting
                                  ? null
                                  : () => Navigator.pop(dialogContext),
                              style: AppButtonStyles.destructiveText(
                                dialogContext,
                              ),
                              child: const Text(
                                'Cancel',
                                style: TextStyle(fontWeight: FontWeight.w800),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<Map<String, String>> _buildProofFields({
    String? studentNote,
    RoPickedPhoto? photo,
  }) async {
    final capturedAt = photo?.capturedAtDevice ?? DateTime.now();
    final fields = <String, String>{
      'captured_at_device': capturedAt.toUtc().toIso8601String(),
      'device_timezone': capturedAt.timeZoneName,
      'location_source': 'device_gps',
      'device_info': jsonEncode({
        'platform': Theme.of(context).platform.name,
        'capture_method': photo?.sourceLabel ?? 'none',
        'source': 'smartpdm_mobile_ro',
        'has_photo': photo != null,
        'photo_name': photo?.fileName,
      }),
      'exif_metadata': jsonEncode({}),
      if (photo != null) 'mime_type': photo.mimeType,
      if (photo != null) 'file_name': photo.fileName,
      if (studentNote != null && studentNote.trim().isNotEmpty)
        'studentNote': studentNote.trim(),
    };

    if (photo != null) {
      fields['latitude'] = photo.latitude.toString();
      fields['longitude'] = photo.longitude.toString();
      fields['accuracy_meters'] = photo.accuracyMeters.toString();
      fields['location_permission_status'] = 'granted';
      return fields;
    }

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();

      if (!serviceEnabled) {
        fields['location_permission_status'] = 'service_disabled';
        return fields;
      }

      LocationPermission permission = await Geolocator.checkPermission();

      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      fields['location_permission_status'] = permission.name;

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return fields;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      fields['latitude'] = position.latitude.toString();
      fields['longitude'] = position.longitude.toString();
      fields['accuracy_meters'] = position.accuracy.toString();
      fields['altitude_meters'] = position.altitude.toString();
    } catch (error) {
      fields['location_permission_status'] = 'location_error';
      fields['location_error'] = error.toString();
    }

    return fields;
  }

  Future<void> _acknowledge(RoAssignment item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Acknowledge RO notice?'),
          content: Text(
            'You are acknowledging the required Return of Obligation assignment at ${item.assignedArea}. Failure to complete it may be reported to OSFA for review.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              style: AppButtonStyles.destructiveText(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: AppButtonStyles.confirmFilled(context),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Acknowledge'),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiClient.postJson(
        '/api/ro/${item.roId}/acknowledge',
        body: const {},
      );

      _applyResponse(response);
      _showSnack(response['message']?.toString() ?? 'RO notice acknowledged.');
    } catch (error) {
      setState(() => _errorMessage = _cleanError(error));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

    Future<void> _reportConcern(RoAssignment item) async {
    if (_isSubmitting || _isConcernSheetOpen || item.hasConflict) {
      if (item.hasConflict) {
        _showSnack(
          'A concern has already been submitted for this RO assignment.',
        );
      }
      return;
    }

    setState(() => _isConcernSheetOpen = true);

    RoConcernInput? concern;

    try {
      concern = await _showConcernSheet(
        title: 'Report an RO Concern',
        hint:
            'Describe the schedule, location, medical, academic, or assignment issue clearly. This report is sent to OSFA for review and does not automatically cancel the assignment.',
        primaryLabel: 'Submit Concern',
      );
    } finally {
      if (mounted) {
        setState(() => _isConcernSheetOpen = false);
      }
    }

    if (concern == null || !mounted) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiClient.postJson(
        '/api/ro/${item.roId}/conflict',
        body: {
          'category': concern.category,
          'reason': concern.description,
        },
      );

      _applyResponse(response);

      _showSnack(
        response['message']?.toString() ??
            'Concern submitted successfully. OSFA can now review it.',
      );
    } catch (error) {
      if (!mounted) return;

      _showSnack(
        'Unable to submit concern: ${_cleanError(error)}',
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _timeIn(RoAssignment item) async {
    final approvedPlacements = item.placements
        .where((placement) => placement.isApproved)
        .toList();
    if (approvedPlacements.isEmpty) {
      _showSnack('Wait for an RO Area coordinator to approve your placement.');
      return;
    }

    RoPlacement selectedPlacement = approvedPlacements.first;
    if (approvedPlacements.length > 1) {
      final choice = await showDialog<RoPlacement>(
        context: context,
        builder: (context) => SimpleDialog(
          title: const Text('Where will you render service?'),
          children: approvedPlacements
              .map(
                (placement) => SimpleDialogOption(
                  onPressed: () => Navigator.of(context).pop(placement),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Text(
                      placement.areaName,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      );
      if (choice == null) return;
      selectedPlacement = choice;
    }

    _captureArea = selectedPlacement.areaName;
    _captureAction = 'TIME IN';
    final input = await _showRoActionDialog(
      title: 'Time In',
      hint: 'Optional note before starting your RO session',
      primaryLabel: 'Start Time In',
    );

    if (input == null) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final fields = await _buildProofFields(
        studentNote: input.note,
        photo: input.photo,
      );
      fields['placementId'] = selectedPlacement.placementId;

      final response = await _sendRoMultipart(
        path: '/api/ro/${item.roId}/time-in',
        fields: fields,
        photo: input.photo,
      );

      _applyResponse(response);
      _showSnack(response['message']?.toString() ?? 'Timed in successfully.');
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _cleanError(error));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _timeOut(RoAssignment item) async {
    _captureArea = item.assignedArea;
    _captureAction = 'TIME OUT';
    final input = await _showRoActionDialog(
      title: 'Time Out',
      hint: 'Optional note before ending your RO session',
      primaryLabel: 'Submit Time Out',
    );

    if (input == null) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final fields = await _buildProofFields(
        studentNote: input.note,
        photo: input.photo,
      );

      final response = await _sendRoMultipart(
        path: '/api/ro/${item.roId}/time-out',
        fields: fields,
        photo: input.photo,
      );

      _applyResponse(response);
      _showSnack(response['message']?.toString() ?? 'Timed out successfully.');
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = _cleanError(error));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  void _applyResponse(Map<String, dynamic> response) {
    final items = (response['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(RoAssignment.fromJson)
        .toList();

    setState(() {
      _items = items;
      _isApprovedScholar = response['isApprovedScholar'] == true;
      _shouldShowModule = response['shouldShowModule'] == true;
      _errorMessage = null;
    });
  }

    Future<RoConcernInput?> _showConcernSheet({
    required String title,
    required String hint,
    required String primaryLabel,
  }) async {
    const categories = <String>[
      'Schedule Conflict',
      'Location / Transportation',
      'Medical / Health',
      'Academic Conflict',
      'RO Area / Assignment Issue',
      'Other',
    ];

    _noteController.clear();
    var selectedCategory = categories.first;
    String? validationMessage;

    return showModalBottomSheet<RoConcernInput>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final bottom = MediaQuery.of(context).viewInsets.bottom;

            void submit() {
              final text = _noteController.text.trim();

              if (text.length < 10) {
                setSheetState(() {
                  validationMessage =
                      'Describe the concern in at least 10 characters.';
                });
                return;
              }

              if (text.length > 1000) {
                setSheetState(() {
                  validationMessage =
                      'Keep the concern description within 1,000 characters.';
                });
                return;
              }

              Navigator.pop(
                sheetContext,
                RoConcernInput(
                  category: selectedCategory,
                  description: text,
                ),
              );
            }

            return SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(18, 18, 18, bottom + 18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Align(
                    child: Container(
                      width: 44,
                      height: 5,
                      decoration: BoxDecoration(
                        color: Colors.black26,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Select the concern type and provide enough detail for OSFA to review the assignment.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.black54,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: selectedCategory,
                    decoration: InputDecoration(
                      labelText: 'Concern Category',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    items: categories
                        .map(
                          (category) => DropdownMenuItem<String>(
                            value: category,
                            child: Text(category),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value == null) return;

                      setSheetState(() {
                        selectedCategory = value;
                        validationMessage = null;
                      });
                    },
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _noteController,
                    minLines: 4,
                    maxLines: 6,
                    maxLength: 1000,
                    textInputAction: TextInputAction.newline,
                    onChanged: (_) {
                      if (validationMessage == null) return;
                      setSheetState(() => validationMessage = null);
                    },
                    decoration: InputDecoration(
                      labelText: 'Concern Description',
                      hintText: hint,
                      alignLabelWithHint: true,
                      errorText: validationMessage,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Supporting attachments are not requested here because the current RO concern endpoint stores text concerns only. Attendance proof uploads remain separate.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.black45,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.darkBrown,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: submit,
                      icon: const Icon(Icons.report_problem_outlined),
                      label: Text(primaryLabel),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

Future<String?> _showNoteSheet({
    required String title,
    required String hint,
    required String primaryLabel,
    bool requiredInput = false,
  }) async {
    _noteController.clear();

    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        final bottom = MediaQuery.of(context).viewInsets.bottom;

        return Padding(
          padding: EdgeInsets.fromLTRB(18, 18, 18, bottom + 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.black26,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _noteController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: hint,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.darkBrown,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () {
                    final text = _noteController.text.trim();

                    if (requiredInput && text.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Please enter your reason first.'),
                        ),
                      );
                      return;
                    }

                    Navigator.pop(context, text);
                  },
                  child: Text(primaryLabel),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showSnack(String message) {
    if (!mounted) return;

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String _cleanError(Object error) {
    return error.toString().replaceFirst('Exception: ', '').trim();
  }

  String _formatMinutes(int minutes) {
    final safe = minutes < 0 ? 0 : minutes;
    final hours = safe ~/ 60;
    final mins = safe % 60;

    if (hours <= 0) return '${mins}m';
    if (mins <= 0) return '${hours}h';
    return '${hours}h ${mins}m';
  }

  String _formatElapsed(int seconds) {
    final safe = seconds < 0 ? 0 : seconds;
    final hours = safe ~/ 3600;
    final minutes = (safe % 3600) ~/ 60;
    final secs = safe % 60;

    return [
      hours.toString().padLeft(2, '0'),
      minutes.toString().padLeft(2, '0'),
      secs.toString().padLeft(2, '0'),
    ].join(':');
  }

  String _formatDateTime(DateTime? value) {
    if (value == null) return '—';

    final local = value.toLocal();
    final date = '${local.month}/${local.day}/${local.year}';
    final time = TimeOfDay.fromDateTime(local).format(context);

    return '$date · $time';
  }

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      selectedIndex: 2,
      showBottomNav: widget.showBottomNav,
      appBar: widget.showTopBar
          ? AppBar(
              backgroundColor: AppColors.darkBrown,
              foregroundColor: Colors.white,
              title: const Text(
                'Return of Obligation',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
            )
          : null,
      child: _buildContent(),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return RefreshIndicator(
        onRefresh: () => _loadRo(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            _StateCard(
              icon: Icons.warning_amber_rounded,
              title: 'Unable to load RO',
              message: _errorMessage!,
              actionLabel: 'Try Again',
              onAction: () => _loadRo(),
            ),
          ],
        ),
      );
    }

    if (!_isApprovedScholar || !_shouldShowModule) {
      return RefreshIndicator(
        onRefresh: () => _loadRo(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            _StateCard(
              icon: Icons.lock_outline_rounded,
              title: 'For approved scholars only',
              message:
                  'Return of Obligation is shown only after your scholarship application has been approved.',
            ),
          ],
        ),
      );
    }

    if (_items.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => _loadRo(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            _StateCard(
              icon: Icons.assignment_outlined,
              title: 'No RO notice yet',
              message:
                  'Your Return of Obligation notice will appear here once OSFA assigns it.',
            ),
          ],
        ),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tabSurfaceColor = isDark
        ? const Color(0xFF332216)
        : Colors.grey.withOpacity(0.12);
    final unselectedTabColor = isDark ? Colors.white70 : Colors.grey.shade700;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'My Return of Obligation',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: tabSurfaceColor,
            borderRadius: BorderRadius.circular(16),
          ),
          child: TabBar(
            controller: _tabController,
            indicator: BoxDecoration(
              color: AppColors.darkBrown,
              borderRadius: BorderRadius.circular(14),
            ),
            indicatorSize: TabBarIndicatorSize.tab,
            labelColor: Colors.white,
            unselectedLabelColor: unselectedTabColor,
            tabs: const [
              Tab(text: 'Active'),
              Tab(text: 'Completed'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => _loadRo(),
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildAssignmentList(_activeItems, completed: false),
                _buildAssignmentList(_completedItems, completed: true),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _showObligationDetails(RoAssignment item) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return _ObligationDetailsSheet(
          item: item,
          isSubmitting: _isSubmitting,
          hasAnyActiveSession: _hasAnyActiveSession,
          formatMinutes: _formatMinutes,
          formatElapsed: _formatElapsed,
          formatDateTime: _formatDateTime,
          onAcknowledge: () async {
            Navigator.of(sheetContext).pop();
            await _acknowledge(item);
          },
          onReportConcern: () async {
            Navigator.of(sheetContext).pop();
            await _reportConcern(item);
          },
          onTimeIn: () async {
            Navigator.of(sheetContext).pop();
            await _timeIn(item);
          },
          onTimeOut: () async {
            Navigator.of(sheetContext).pop();
            await _timeOut(item);
          },
        );
      },
    );
  }

  Widget _buildAssignmentList(
    List<RoAssignment> items, {
    required bool completed,
  }) {
    if (items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          _StateCard(
            icon: completed
                ? Icons.verified_rounded
                : Icons.assignment_outlined,
            title: completed ? 'No completed RO yet' : 'No active RO',
            message: completed
                ? 'Cleared Return of Obligation records will appear here.'
                : 'Active Return of Obligation records will appear here.',
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 14),
      itemBuilder: (context, index) {
        final item = items[index];

        return _AssignmentCard(
          item: item,
          formatMinutes: _formatMinutes,
          onTap: () => _showObligationDetails(item),
        );
      },
    );
  }
}

class RoAssignment {
  const RoAssignment({
    required this.roId,
    required this.title,
    required this.programName,
    required this.openingTitle,
    required this.academicYear,
    required this.semester,
    required this.assignedArea,
    required this.remarks,
    required this.requiredHours,
    required this.submittedMinutes,
    required this.validatedMinutes,
    required this.requiredMinutes,
    required this.submittedProgress,
    required this.validatedProgress,
    required this.roStatus,
    required this.progressStatus,
    required this.assignmentStatus,
    required this.conflictReason,
    required this.validationRemarks,
    required this.logs,
    required this.placements,
    required this.checkoutGraceMinutes,
    required this.activeSessionTargetMinutes,
    required this.activeSessionTargetAt,
    required this.activeSessionGraceDeadlineAt,
    this.activeLog,
  });

  final String roId;
  final String title;
  final String programName;
  final String openingTitle;
  final String academicYear;
  final String semester;
  final String assignedArea;
  final String remarks;

  final int requiredHours;
  final int submittedMinutes;
  final int validatedMinutes;
  final int requiredMinutes;
  final int submittedProgress;
  final int validatedProgress;

  final String roStatus;
  final String progressStatus;
  final String assignmentStatus;
  final String conflictReason;
  final String validationRemarks;
  final int checkoutGraceMinutes;
  final int activeSessionTargetMinutes;
  final DateTime? activeSessionTargetAt;
  final DateTime? activeSessionGraceDeadlineAt;

  final RoTimeLog? activeLog;
  final List<RoTimeLog> logs;
  final List<RoPlacement> placements;

  bool get isCleared => roStatus.toLowerCase() == 'cleared';

  bool get isAssignedOnly {
    final normalized = assignmentStatus.toLowerCase();
    return normalized == 'assigned' || normalized == 'pending';
  }

  bool get isAcknowledged {
    final normalized = assignmentStatus.toLowerCase();
    return normalized == 'acknowledged' || normalized == 'in progress';
  }

  bool get hasConflict {
    return assignmentStatus.toLowerCase() == 'conflict reported';
  }

  bool get isForValidation {
    return progressStatus.toLowerCase() == 'for validation';
  }

  RoTimeLog? get latestValidationFeedbackLog {
    for (final log in logs) {
      if (log.validationRemarks.trim().isNotEmpty) return log;
    }
    return null;
  }

  factory RoAssignment.fromJson(Map<String, dynamic> json) {
    return RoAssignment(
      roId: json['roId']?.toString() ?? json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Return of Obligation Notice',
      programName: json['programName']?.toString() ?? '',
      openingTitle: json['openingTitle']?.toString() ?? '',
      academicYear:
          json['academicYear']?.toString() ??
          json['academic_year']?.toString() ??
          '',
      semester: json['semester']?.toString() ?? json['term']?.toString() ?? '',
      assignedArea:
          json['assignedArea']?.toString() ??
          json['assigned_area']?.toString() ??
          '',
      remarks: json['remarks']?.toString() ?? '',
      requiredHours: _toInt(json['requiredHours']),
      submittedMinutes: _toInt(json['submittedMinutes']),
      validatedMinutes: _toInt(json['validatedMinutes']),
      requiredMinutes: _toInt(json['requiredMinutes']),
      submittedProgress: _toInt(json['submittedProgress']),
      validatedProgress: _toInt(json['validatedProgress']),
      roStatus:
          json['roStatus']?.toString() ??
          json['status']?.toString() ??
          'Pending',
      progressStatus: json['progressStatus']?.toString() ?? 'Not Started',
      assignmentStatus:
          json['assignmentStatus']?.toString() ??
          json['assignment_status']?.toString() ??
          'Assigned',
      conflictReason:
          json['conflictReason']?.toString() ??
          json['conflict_reason']?.toString() ??
          '',
      validationRemarks: json['validationRemarks']?.toString() ?? '',
      checkoutGraceMinutes: _toInt(json['checkoutGraceMinutes']),
      activeSessionTargetMinutes: _toInt(json['activeSessionTargetMinutes']),
      activeSessionTargetAt: _toDate(json['activeSessionTargetAt']),
      activeSessionGraceDeadlineAt: _toDate(
        json['activeSessionGraceDeadlineAt'],
      ),
      activeLog: json['activeLog'] is Map<String, dynamic>
          ? RoTimeLog.fromJson(json['activeLog'] as Map<String, dynamic>)
          : null,
      logs: (json['logs'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(RoTimeLog.fromJson)
          .toList(),
      placements: (json['placements'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(RoPlacement.fromJson)
          .toList(),
    );
  }
}

class RoPlacement {
  const RoPlacement({
    required this.placementId,
    required this.areaName,
    required this.status,
    required this.coordinatorRemarks,
  });

  final String placementId;
  final String areaName;
  final String status;
  final String coordinatorRemarks;

  bool get isApproved => status.toLowerCase() == 'approved';

  factory RoPlacement.fromJson(Map<String, dynamic> json) {
    return RoPlacement(
      placementId: json['placementId']?.toString() ?? '',
      areaName: json['areaName']?.toString() ?? 'RO Area',
      status: json['status']?.toString() ?? 'Pending',
      coordinatorRemarks: json['coordinatorRemarks']?.toString() ?? '',
    );
  }
}

class RoTimeLog {
  const RoTimeLog({
    required this.logId,
    required this.timeInAt,
    required this.timeOutAt,
    required this.durationMinutes,
    required this.logStatus,
    required this.validationStatus,
    required this.validatedMinutes,
    required this.validationRemarks,
    required this.studentNote,
    required this.proofs,
    required this.autoTimedOut,
    required this.autoTimeoutReason,
  });

  final String logId;
  final DateTime? timeInAt;
  final DateTime? timeOutAt;
  final int durationMinutes;
  final String logStatus;
  final String validationStatus;
  final int validatedMinutes;
  final String validationRemarks;
  final String studentNote;
  final List<RoProof> proofs;
  final bool autoTimedOut;
  final String autoTimeoutReason;

  bool get isActive => timeOutAt == null && logStatus == 'Timed In';

  int get elapsedSeconds {
    if (!isActive || timeInAt == null) return durationMinutes * 60;

    final diff = DateTime.now().difference(timeInAt!.toLocal()).inSeconds;
    return diff < 0 ? 0 : diff;
  }

  factory RoTimeLog.fromJson(Map<String, dynamic> json) {
    return RoTimeLog(
      logId: json['logId']?.toString() ?? '',
      timeInAt: _toDate(json['timeInAt']),
      timeOutAt: _toDate(json['timeOutAt']),
      durationMinutes: _toInt(json['durationMinutes']),
      logStatus: json['logStatus']?.toString() ?? '',
      validationStatus: _normalizeValidationStatus(
        json['departmentValidationStatus'] ??
            json['department_validation_status'] ??
            json['validationStatus'] ??
            json['validation_status'],
      ),
      validatedMinutes: _toInt(json['validatedMinutes']),
      validationRemarks:
          json['departmentValidationRemarks']?.toString() ??
          json['department_validation_remarks']?.toString() ??
          json['validationRemarks']?.toString() ??
          json['validation_remarks']?.toString() ??
          '',
      studentNote: json['studentNote']?.toString() ?? '',
      proofs: (json['proofs'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(RoProof.fromJson)
          .toList(),
      autoTimedOut:
          json['autoTimedOut'] == true || json['auto_timed_out'] == true,
      autoTimeoutReason:
          json['autoTimeoutReason']?.toString() ??
          json['auto_timeout_reason']?.toString() ??
          '',
    );
  }
}

class RoProof {
  const RoProof({
    required this.proofId,
    required this.proofType,
    required this.fileUrl,
    required this.capturedAtDevice,
    required this.capturedAtServer,
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    required this.proofStatus,
  });

  final String proofId;
  final String proofType;
  final String fileUrl;
  final DateTime? capturedAtDevice;
  final DateTime? capturedAtServer;
  final double? latitude;
  final double? longitude;
  final double? accuracyMeters;
  final String proofStatus;

  bool get isTimeIn => proofType.toLowerCase() == 'time_in';
  bool get isTimeOut => proofType.toLowerCase() == 'time_out';

  String get label => isTimeIn
      ? 'Time In'
      : isTimeOut
      ? 'Time Out'
      : proofType;

  factory RoProof.fromJson(Map<String, dynamic> json) {
    return RoProof(
      proofId:
          json['proofId']?.toString() ?? json['proof_id']?.toString() ?? '',
      proofType:
          json['proofType']?.toString() ?? json['proof_type']?.toString() ?? '',
      fileUrl:
          json['fileUrl']?.toString() ?? json['file_url']?.toString() ?? '',
      capturedAtDevice: _toDate(
        json['capturedAtDevice'] ?? json['captured_at_device'],
      ),
      capturedAtServer: _toDate(
        json['capturedAtServer'] ?? json['captured_at_server'],
      ),
      latitude: _toDouble(json['latitude']),
      longitude: _toDouble(json['longitude']),
      accuracyMeters: _toDouble(
        json['accuracyMeters'] ?? json['accuracy_meters'],
      ),
      proofStatus:
          json['proofStatus']?.toString() ??
          json['proof_status']?.toString() ??
          '',
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({
    required this.item,
    required this.formatMinutes,
    required this.onTap,
  });

  final RoAssignment item;
  final String Function(int minutes) formatMinutes;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    final progress = item.validatedProgress.clamp(0, 100);
    final department = item.assignedArea.trim().isEmpty
        ? 'RO Department'
        : item.assignedArea.trim();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: item.activeLog != null
                  ? Colors.green.withOpacity(0.32)
                  : AppColors.gold.withOpacity(0.24),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D000000),
                blurRadius: 10,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.gold.withOpacity(0.14),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  item.isCleared
                      ? Icons.verified_rounded
                      : Icons.apartment_rounded,
                  color: isDark ? AppColors.gold : AppColors.darkBrown,
                  size: 21,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      department,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (item.academicYear.isNotEmpty ||
                        item.semester.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        [
                          if (item.academicYear.isNotEmpty)
                            'AY ${item.academicYear}',
                          if (item.semester.isNotEmpty) item.semester,
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (item.activeLog != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: Colors.green.withOpacity(0.22),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                              color: isDark
                                  ? const Color(0xFF9BE9A8)
                                  : Colors.green,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                          const Text(
                            'Ongoing',
                            style: TextStyle(
                              color: Colors.green,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 5),
                  ],
                  Text(
                    '$progress% (${formatMinutes(item.validatedMinutes)} / ${formatMinutes(item.requiredMinutes)})',
                    textAlign: TextAlign.right,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: progress >= 100
                          ? (isDark
                                ? const Color(0xFF9BE9A8)
                                : Colors.green.shade700)
                          : scheme.onSurface,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 6),
              Icon(
                Icons.chevron_right_rounded,
                color: scheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ObligationDetailsSheet extends StatefulWidget {
  const _ObligationDetailsSheet({
    required this.item,
    required this.isSubmitting,
    required this.hasAnyActiveSession,
    required this.formatMinutes,
    required this.formatElapsed,
    required this.formatDateTime,
    required this.onAcknowledge,
    required this.onReportConcern,
    required this.onTimeIn,
    required this.onTimeOut,
  });

  final RoAssignment item;
  final bool isSubmitting;
  final bool hasAnyActiveSession;
  final String Function(int minutes) formatMinutes;
  final String Function(int seconds) formatElapsed;
  final String Function(DateTime? value) formatDateTime;
  final Future<void> Function() onAcknowledge;
  final Future<void> Function() onReportConcern;
  final Future<void> Function() onTimeIn;
  final Future<void> Function() onTimeOut;

  @override
  State<_ObligationDetailsSheet> createState() =>
      _ObligationDetailsSheetState();
}

class _ObligationDetailsSheetState extends State<_ObligationDetailsSheet> {
  Timer? _timer;

  RoAssignment get item => widget.item;

  @override
  void initState() {
    super.initState();
    if (item.activeLog != null) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activeLog = item.activeLog;
    final isTimedIn = activeLog != null;
    final feedbackLog = item.latestValidationFeedbackLog;
    final feedbackLogRemarks = feedbackLog?.validationRemarks.trim() ?? '';
    final validationFeedback = feedbackLogRemarks.isNotEmpty
        ? feedbackLogRemarks
        : item.validationRemarks.trim();
    final validationFeedbackStatus =
        feedbackLog?.validationStatus.trim().toLowerCase() ?? '';
    final validationFeedbackColor =
        validationFeedbackStatus == 'returned' ||
            validationFeedbackStatus == 'rejected'
        ? const Color(0xFFB3261E)
        : validationFeedbackStatus == 'approved'
        ? Colors.green.shade700
        : Colors.blue.shade700;

    final canAcknowledge =
        !item.isCleared && item.isAssignedOnly && !widget.isSubmitting;

    final canReportConcern =
        !item.isCleared && !item.hasConflict && !widget.isSubmitting;

    final canTimeIn =
        !item.isCleared &&
        item.isAcknowledged &&
        item.placements.any((placement) => placement.isApproved) &&
        !item.hasConflict &&
        !isTimedIn &&
        !widget.hasAnyActiveSession &&
        !widget.isSubmitting;

    final canTimeOut = !item.isCleared && isTimedIn && !widget.isSubmitting;

    final proofEntries = item.logs
        .expand(
          (log) =>
              log.proofs.map((proof) => _ProofEntry(log: log, proof: proof)),
        )
        .where((entry) => entry.proof.isTimeIn || entry.proof.isTimeOut)
        .take(8)
        .toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.58,
      maxChildSize: 0.96,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Color(0xFFFFFBF6),
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 10, 12, 8),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 5,
                      decoration: BoxDecoration(
                        color: Colors.black12,
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      tooltip: 'Close',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
                  children: [
                    Text(
                      item.assignedArea.trim().isEmpty
                          ? 'Return of Obligation'
                          : item.assignedArea,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: AppColors.darkBrown,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.programName.isNotEmpty
                          ? item.programName
                          : item.title,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.black54,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (item.academicYear.isNotEmpty ||
                        item.semester.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Row(
                        children: [
                          const Icon(
                            Icons.calendar_month_rounded,
                            size: 16,
                            color: Colors.black45,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              [
                                if (item.academicYear.isNotEmpty)
                                  'AY ${item.academicYear}',
                                if (item.semester.isNotEmpty) item.semester,
                              ].join(' · '),
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: Colors.black54,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 14),

                    _NoticeDetails(
                      item: item,
                      formatMinutes: widget.formatMinutes,
                    ),

                    if (!item.isCleared) ...[
                      const SizedBox(height: 12),
                      const _InfoBox(
                        icon: Icons.gavel_rounded,
                        title: 'Required Scholarship Obligation',
                        message:
                            'This assignment is mandatory. A legitimate conflict may be reported to OSFA. Complete attendance evidence is still required unless the RO Coordinator verifies an exception.',
                        color: Color(0xFF8A4B08),
                      ),
                    ],

                    if (item.placements.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: item.placements
                            .map(
                              (placement) => Chip(
                                avatar: Icon(
                                  placement.isApproved
                                      ? Icons.check_circle_rounded
                                      : Icons.schedule_rounded,
                                  size: 16,
                                  color: placement.isApproved
                                      ? Colors.green.shade700
                                      : Colors.orange.shade700,
                                ),
                                label: Text(
                                  '${placement.areaName} - ${placement.status}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                backgroundColor: placement.isApproved
                                    ? Colors.green.shade50
                                    : Colors.orange.shade50,
                                side: BorderSide(
                                  color: placement.isApproved
                                      ? Colors.green.shade200
                                      : Colors.orange.shade200,
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ],

                    const SizedBox(height: 18),
                    _ProgressLine(
                      label: 'Submitted',
                      value:
                          item.submittedProgress.clamp(0, 100).toDouble() / 100,
                      percent: item.submittedProgress,
                      caption:
                          '${widget.formatMinutes(item.submittedMinutes)} submitted of ${widget.formatMinutes(item.requiredMinutes)}',
                      color: AppColors.gold,
                    ),
                    const SizedBox(height: 14),
                    _ProgressLine(
                      label: 'Validated',
                      value:
                          item.validatedProgress.clamp(0, 100).toDouble() / 100,
                      percent: item.validatedProgress,
                      caption:
                          '${widget.formatMinutes(item.validatedMinutes)} validated of ${widget.formatMinutes(item.requiredMinutes)}',
                      color: Colors.green,
                    ),

                    if (validationFeedback.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _InfoBox(
                        icon: Icons.fact_check_outlined,
                        title: validationFeedbackStatus == 'returned' ||
                                validationFeedbackStatus == 'rejected'
                            ? 'Validation Feedback - Returned'
                            : validationFeedbackStatus == 'approved'
                                ? 'Validation Feedback - Approved'
                                : 'Validation Feedback',
                        message: validationFeedback,
                        color: validationFeedbackColor,
                      ),
                    ],

                    if (item.hasConflict && item.conflictReason.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _InfoBox(
                        icon: Icons.report_problem_rounded,
                        title: 'Concern Reported',
                        message: item.conflictReason,
                        color: const Color(0xFFB3261E),
                      ),
                    ],

                    if (isTimedIn) ...[
                      const SizedBox(height: 16),
                      _ActiveSessionBox(
                        log: activeLog,
                        targetMinutes: item.activeSessionTargetMinutes,
                        targetAt: item.activeSessionTargetAt,
                        graceDeadlineAt: item.activeSessionGraceDeadlineAt,
                        checkoutGraceMinutes: item.checkoutGraceMinutes,
                        formatElapsed: widget.formatElapsed,
                        formatDateTime: widget.formatDateTime,
                      ),
                    ],

                    const SizedBox(height: 20),
                    Text(
                      'Attendance Proofs',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      proofEntries.isEmpty
                          ? 'No time-in or time-out images have been recorded yet.'
                          : 'Tap an image to preview the recorded attendance proof.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.black54,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),

                    if (proofEntries.isNotEmpty)
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: proofEntries.length,
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              crossAxisSpacing: 10,
                              mainAxisSpacing: 10,
                              childAspectRatio: 0.82,
                            ),
                        itemBuilder: (context, index) {
                          final entry = proofEntries[index];
                          return _ProofPreviewCard(
                            entry: entry,
                            formatDateTime: widget.formatDateTime,
                          );
                        },
                      ),

                    const SizedBox(height: 20),
                    _LogsSection(
                      logs: item.logs,
                      formatMinutes: widget.formatMinutes,
                      formatDateTime: widget.formatDateTime,
                      initiallyExpanded: true,
                    ),

                    if (!item.isCleared && item.isAssignedOnly) ...[
                      const SizedBox(height: 18),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: canAcknowledge
                              ? widget.onAcknowledge
                              : null,
                          icon: const Icon(Icons.check_circle_rounded),
                          label: const Text('Acknowledge Notice'),
                          style: AppButtonStyles.confirmFilled(context).merge(
                            FilledButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 13),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              if (!item.isCleared)
                _ObligationActionFooter(
                  isSubmitting: widget.isSubmitting,
                  canTimeIn: canTimeIn,
                  canTimeOut: canTimeOut,
                  canReportConcern: canReportConcern,
                  isTimedIn: isTimedIn,
                  onTimeIn: widget.onTimeIn,
                  onTimeOut: widget.onTimeOut,
                  onReportConcern: widget.onReportConcern,
                ),
            ],
          ),
        );
      },
    );
  }
}

class _ObligationActionFooter extends StatelessWidget {
  const _ObligationActionFooter({
    required this.isSubmitting,
    required this.canTimeIn,
    required this.canTimeOut,
    required this.canReportConcern,
    required this.isTimedIn,
    required this.onTimeIn,
    required this.onTimeOut,
    required this.onReportConcern,
  });

  final bool isSubmitting;
  final bool canTimeIn;
  final bool canTimeOut;
  final bool canReportConcern;
  final bool isTimedIn;
  final Future<void> Function() onTimeIn;
  final Future<void> Function() onTimeOut;
  final Future<void> Function() onReportConcern;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(18, 12, 18, 10 + bottomInset),
      decoration: BoxDecoration(
        color: isDark ? scheme.surfaceContainer : const Color(0xFFFFFBF6),
        border: Border(
          top: BorderSide(
            color: isDark
                ? scheme.outlineVariant
                : Colors.black.withOpacity(0.08),
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.30 : 0.07),
            blurRadius: 14,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: FilledButton.icon(
                    onPressed: !isSubmitting && canTimeIn ? onTimeIn : null,
                    icon: const Icon(Icons.login_rounded, size: 19),
                    label: const Text(
                      'Time In',
                      style: TextStyle(fontWeight: FontWeight.w900),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.darkBrown,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: AppColors.darkBrown.withOpacity(
                        0.18,
                      ),
                      disabledForegroundColor: AppColors.darkBrown.withOpacity(
                        0.45,
                      ),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: FilledButton.icon(
                    onPressed: !isSubmitting && canTimeOut ? onTimeOut : null,
                    icon: const Icon(Icons.logout_rounded, size: 19),
                    label: const Text(
                      'Time Out',
                      style: TextStyle(fontWeight: FontWeight.w900),
                    ),
                    style: AppButtonStyles.destructiveFilled(context).merge(
                      FilledButton.styleFrom(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (!isTimedIn || canReportConcern) ...[
            const SizedBox(height: 9),
            Semantics(
              button: true,
              label: 'Report a concern about this RO assignment',
              child: InkWell(
                onTap: !isSubmitting && canReportConcern
                    ? onReportConcern
                    : null,
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  child: Text(
                    'Report a concern',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      decoration: TextDecoration.underline,
                      decorationThickness: 1.2,
                      color: canReportConcern
                          ? AppColors.darkBrown
                          : Colors.black26,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProofEntry {
  const _ProofEntry({required this.log, required this.proof});

  final RoTimeLog log;
  final RoProof proof;
}

class _ProofPreviewCard extends StatelessWidget {
  const _ProofPreviewCard({required this.entry, required this.formatDateTime});

  final _ProofEntry entry;
  final String Function(DateTime? value) formatDateTime;

  void _openPreview(BuildContext context) {
    if (entry.proof.fileUrl.trim().isEmpty) return;

    showDialog<void>(
      context: context,
      builder: (context) {
        return Dialog(
          backgroundColor: Colors.black,
          insetPadding: const EdgeInsets.all(12),
          child: Stack(
            children: [
              InteractiveViewer(
                minScale: 0.8,
                maxScale: 5,
                child: Image.network(
                  entry.proof.fileUrl,
                  width: double.infinity,
                  fit: BoxFit.contain,
                  errorBuilder: (_, _, _) => const SizedBox(
                    height: 320,
                    child: Center(
                      child: Text(
                        'Unable to load proof image.',
                        style: TextStyle(color: Colors.white70),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                right: 6,
                top: 6,
                child: IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final proof = entry.proof;
    final capturedAt =
        proof.capturedAtDevice ?? proof.capturedAtServer ?? entry.log.timeInAt;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: proof.fileUrl.trim().isEmpty
            ? null
            : () => _openPreview(context),
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE8DDD0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(15),
                  ),
                  child: proof.fileUrl.trim().isEmpty
                      ? const ColoredBox(
                          color: Color(0xFFF4EEE7),
                          child: Center(
                            child: Icon(
                              Icons.image_not_supported_outlined,
                              color: Colors.black38,
                            ),
                          ),
                        )
                      : Image.network(
                          proof.fileUrl,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => const ColoredBox(
                            color: Color(0xFFF4EEE7),
                            child: Center(
                              child: Icon(
                                Icons.broken_image_outlined,
                                color: Colors.black38,
                              ),
                            ),
                          ),
                        ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      proof.label,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      formatDateTime(capturedAt),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 10,
                        color: Colors.black54,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (proof.latitude != null && proof.longitude != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        '${proof.latitude!.toStringAsFixed(5)}, ${proof.longitude!.toStringAsFixed(5)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 9,
                          color: Colors.black45,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
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

class _NoticeHeader extends StatelessWidget {
  const _NoticeHeader({required this.item});

  final RoAssignment item;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    final statusColor = item.isCleared
        ? Colors.green
        : item.hasConflict
        ? const Color(0xFFB3261E)
        : item.progressStatus == 'For Validation'
        ? Colors.blue
        : AppColors.gold;

    final statusLabel = item.isCleared
        ? 'Cleared'
        : item.hasConflict
        ? 'Concern Reported'
        : item.assignmentStatus;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: AppColors.gold.withOpacity(0.18),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(
            Icons.assignment_turned_in_rounded,
            color: isDark ? AppColors.gold : AppColors.darkBrown,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.title,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
              if (item.programName.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  item.programName,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: 8),
        _StatusPill(label: statusLabel, color: statusColor),
      ],
    );
  }
}

class _NoticeDetails extends StatelessWidget {
  const _NoticeDetails({required this.item, required this.formatMinutes});

  final RoAssignment item;
  final String Function(int minutes) formatMinutes;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.gold.withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withOpacity(0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _DetailRow(
            icon: Icons.apartment_rounded,
            label: 'Assigned Department',
            value: item.assignedArea.isEmpty ? '—' : item.assignedArea,
          ),
          const SizedBox(height: 10),
          if (item.academicYear.isNotEmpty) ...[
            _DetailRow(
              icon: Icons.calendar_today_rounded,
              label: 'Academic Year',
              value: 'AY ${item.academicYear}',
            ),
            const SizedBox(height: 10),
          ],
          if (item.semester.isNotEmpty) ...[
            _DetailRow(
              icon: Icons.event_note_rounded,
              label: 'Semester',
              value: item.semester,
            ),
            const SizedBox(height: 10),
          ],
          _DetailRow(
            icon: Icons.timer_rounded,
            label: 'Required Hours',
            value:
                '${item.requiredHours} hour${item.requiredHours == 1 ? '' : 's'}',
          ),
          if (item.remarks.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            _DetailRow(
              icon: Icons.notes_rounded,
              label: 'Remarks',
              value: item.remarks.trim(),
            ),
          ],
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 19, color: AppColors.darkBrown),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Colors.black54,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ProgressLine extends StatelessWidget {
  const _ProgressLine({
    required this.label,
    required this.value,
    required this.percent,
    required this.caption,
    required this.color,
  });

  final String label;
  final double value;
  final int percent;
  final String caption;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final trackColor = Theme.of(context).brightness == Brightness.dark
        ? Colors.white12
        : Colors.grey.shade300;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            Text(
              '$percent%',
              style: TextStyle(color: color, fontWeight: FontWeight.w900),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: value,
            minHeight: 11,
            backgroundColor: trackColor,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          caption,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Colors.black54,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _ActiveSessionBox extends StatelessWidget {
  const _ActiveSessionBox({
    required this.log,
    required this.targetMinutes,
    required this.targetAt,
    required this.graceDeadlineAt,
    required this.checkoutGraceMinutes,
    required this.formatElapsed,
    required this.formatDateTime,
  });

  final RoTimeLog log;
  final int targetMinutes;
  final DateTime? targetAt;
  final DateTime? graceDeadlineAt;
  final int checkoutGraceMinutes;
  final String Function(int seconds) formatElapsed;
  final String Function(DateTime? value) formatDateTime;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    final now = DateTime.now();
    final target = targetAt?.toLocal();
    final graceDeadline = graceDeadlineAt?.toLocal();
    final requirementReached = target != null && !now.isBefore(target);
    final graceExpired = graceDeadline != null && !now.isBefore(graceDeadline);

    final creditedSeconds = targetMinutes <= 0
        ? 0
        : log.elapsedSeconds.clamp(0, targetMinutes * 60);

    final secondsUntilTarget = target == null
        ? 0
        : target.difference(now).inSeconds.clamp(0, 1 << 31);

    final graceSecondsRemaining = graceDeadline == null
        ? 0
        : graceDeadline.difference(now).inSeconds.clamp(0, 1 << 31);

    final boxColor = requirementReached
        ? (isDark
              ? const Color(0xFF173D28)
              : const Color(0xFFE8F5E9))
        : (isDark
              ? const Color(0xFF4A380F)
              : AppColors.gold.withOpacity(0.12));

    final borderColor = requirementReached
        ? Colors.green.withOpacity(0.45)
        : AppColors.gold.withOpacity(0.45);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: boxColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            requirementReached
                ? 'Required Hours Completed'
                : 'RO Service in Progress',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              color: requirementReached
                  ? (isDark
                        ? const Color(0xFF9BE9A8)
                        : Colors.green.shade800)
                  : scheme.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Started: ${formatDateTime(log.timeInAt)}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: scheme.onSurfaceVariant,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Credited: ${formatElapsed(creditedSeconds)}',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
              color: requirementReached
                  ? (isDark
                        ? const Color(0xFF9BE9A8)
                        : Colors.green.shade800)
                  : scheme.onSurface,
            ),
          ),
          const SizedBox(height: 6),
          if (!requirementReached)
            Text(
              '${formatElapsed(secondsUntilTarget)} remaining before your required RO time is reached.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
                fontWeight: FontWeight.w700,
              ),
            )
          else if (!graceExpired)
            Text(
              'Your credited time has stopped. Please Time Out and submit your proof within ${formatElapsed(graceSecondsRemaining)}. The checkout grace period is $checkoutGraceMinutes minute(s).',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: isDark
                    ? const Color(0xFF9BE9A8)
                    : Colors.green.shade800,
                fontWeight: FontWeight.w700,
              ),
            )
          else
            Text(
              'The checkout grace period has ended. The backend will automatically close this session; refresh if the status has not updated yet.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: isDark
                    ? const Color(0xFFFFC47A)
                    : Colors.orange.shade900,
                fontWeight: FontWeight.w700,
              ),
            ),
          if (log.studentNote.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              log.studentNote,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _LogsSection extends StatelessWidget {
  const _LogsSection({
    required this.logs,
    required this.formatMinutes,
    required this.formatDateTime,
    this.initiallyExpanded = false,
  });

  final List<RoTimeLog> logs;
  final String Function(int minutes) formatMinutes;
  final String Function(DateTime? value) formatDateTime;
  final bool initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    if (logs.isEmpty) {
      return const SizedBox.shrink();
    }

    return ExpansionTile(
      initiallyExpanded: initiallyExpanded,
      tilePadding: EdgeInsets.zero,
      childrenPadding: EdgeInsets.zero,
      title: const Text(
        'Recent Time Logs',
        style: TextStyle(fontWeight: FontWeight.w900),
      ),
      children: logs.take(5).map((log) {
        return Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.03),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${formatDateTime(log.timeInAt)} → ${formatDateTime(log.timeOutAt)}',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                '${formatMinutes(log.durationMinutes)} · ${log.validationStatus}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.black54,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (log.validationRemarks.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  log.validationRemarks,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.black54,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _InfoBox extends StatelessWidget {
  const _InfoBox({
    required this.icon,
    required this.title,
    required this.message,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String message;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final readableColor = isDark
        ? Color.alphaBlend(Colors.white.withOpacity(0.36), color)
        : color;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: readableColor, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: readableColor,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  message,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final readableColor = isDark
        ? Color.alphaBlend(Colors.white.withOpacity(0.36), color)
        : color;
    return Container(
      constraints: const BoxConstraints(maxWidth: 120),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(isDark ? 0.22 : 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: readableColor.withOpacity(isDark ? 0.58 : 0.28),
        ),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: readableColor,
          fontWeight: FontWeight.w900,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _StateCard extends StatelessWidget {
  const _StateCard({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(22),
      child: Card(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            children: [
              Icon(icon, size: 44, color: AppColors.gold),
              const SizedBox(height: 16),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.black54,
                  fontWeight: FontWeight.w600,
                  height: 1.4,
                ),
              ),
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: onAction,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.darkBrown,
                    foregroundColor: Colors.white,
                  ),
                  child: Text(actionLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

String _normalizeValidationStatus(dynamic value) {
  final normalized = value?.toString().trim().toLowerCase() ?? '';
  if (normalized == 'approved') return 'Approved';
  if (normalized == 'returned' || normalized == 'rejected') return 'Returned';
  return 'Pending';
}

double? _toDouble(dynamic value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

int _toInt(dynamic value) {
  if (value is int) return value;
  if (value is double) return value.round();
  if (value is num) return value.toInt();

  return int.tryParse(value?.toString() ?? '') ?? 0;
}

DateTime? _toDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}
