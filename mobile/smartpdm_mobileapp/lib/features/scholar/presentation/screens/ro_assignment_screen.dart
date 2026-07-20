import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
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

class ObligationsScreen extends StatelessWidget {
  const ObligationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ROAssignmentScreen();
  }
}

class RoPickedPhoto {
  const RoPickedPhoto({
    required this.file,
    required this.bytes,
    required this.fileName,
    required this.mimeType,
    required this.capturedAtDevice,
    required this.source,
  });

  final XFile file;
  final Uint8List bytes;
  final String fileName;
  final String mimeType;
  final DateTime capturedAtDevice;
  final ImageSource source;

  String get sourceLabel => source == ImageSource.camera ? 'camera' : 'gallery';
}

class RoActionInput {
  const RoActionInput({required this.note, required this.photo});

  final String note;
  final RoPickedPhoto? photo;
}

class _ROAssignmentScreenState extends State<ROAssignmentScreen>
    with SingleTickerProviderStateMixin {
  final ApiClient _apiClient = ApiClient();
  final SessionService _sessionService = const SessionService();
  final ImagePicker _imagePicker = ImagePicker();
  final TextEditingController _noteController = TextEditingController();

  late final TabController _tabController;

  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;

  List<RoAssignment> _items = [];
  bool _isApprovedScholar = false;
  bool _shouldShowModule = false;

  Timer? _activeTimer;

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
  }

  @override
  void dispose() {
    _activeTimer?.cancel();
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

  Future<void> _loadRo() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

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

      setState(() {
        _errorMessage = _cleanError(error);
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
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
    final pickedFile = await _imagePicker.pickImage(
      source: source,
      imageQuality: 78,
      maxWidth: 1600,
    );

    if (pickedFile == null) return null;

    final bytes = await pickedFile.readAsBytes();
    final mimeType = _guessImageMimeType(file: pickedFile, bytes: bytes);
    final fileName = _safeRoPhotoFileName(file: pickedFile, mimeType: mimeType);

    return RoPickedPhoto(
      file: pickedFile,
      bytes: bytes,
      fileName: fileName,
      mimeType: mimeType,
      capturedAtDevice: DateTime.now(),
      source: source,
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
                                    'Photo proof is optional for now',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF1C1917),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    selectedPhoto == null
                                        ? 'Continue without a photo, take one using the camera, or choose from gallery.'
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
                                          label: const Text('Camera'),
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
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          onPressed: _isSubmitting
                                              ? null
                                              : () => choosePhoto(
                                                  ImageSource.gallery,
                                                ),
                                          icon: const Icon(
                                            Icons.photo_library_rounded,
                                            size: 18,
                                          ),
                                          label: const Text('Gallery'),
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
                                        style: TextButton.styleFrom(
                                          foregroundColor: const Color(
                                            0xFFB3261E,
                                          ),
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
                              child: const Text(
                                'Cancel',
                                style: TextStyle(
                                  color: Color(0xFF78716C),
                                  fontWeight: FontWeight.w800,
                                ),
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
    final capturedAt = DateTime.now();
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
            'You are acknowledging your Return of Obligation assignment at ${item.assignedArea}.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.darkBrown,
                foregroundColor: Colors.white,
              ),
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
    final concern = await _showNoteSheet(
      title: 'Report Concern',
      hint: 'Explain your concern or conflict with this RO assignment',
      primaryLabel: 'Submit Concern',
      requiredInput: true,
    );

    if (concern == null) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiClient.postJson(
        '/api/ro/${item.roId}/conflict',
        body: {'reason': concern.trim()},
      );

      _applyResponse(response);
      _showSnack(response['message']?.toString() ?? 'Concern submitted.');
    } catch (error) {
      setState(() => _errorMessage = _cleanError(error));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _timeIn(RoAssignment item) async {
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
      showDrawer: false,
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
        onRefresh: _loadRo,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            _StateCard(
              icon: Icons.warning_amber_rounded,
              title: 'Unable to load RO',
              message: _errorMessage!,
              actionLabel: 'Try Again',
              onAction: _loadRo,
            ),
          ],
        ),
      );
    }

    if (!_isApprovedScholar || !_shouldShowModule) {
      return RefreshIndicator(
        onRefresh: _loadRo,
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
        onRefresh: _loadRo,
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
            onRefresh: _loadRo,
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
      separatorBuilder: (_, __) => const SizedBox(height: 14),
      itemBuilder: (context, index) {
        final item = items[index];

        return _AssignmentCard(
          item: item,
          isSubmitting: _isSubmitting,
          hasAnyActiveSession: _hasAnyActiveSession,
          formatMinutes: _formatMinutes,
          formatElapsed: _formatElapsed,
          formatDateTime: _formatDateTime,
          onAcknowledge: () => _acknowledge(item),
          onReportConcern: () => _reportConcern(item),
          onTimeIn: () => _timeIn(item),
          onTimeOut: () => _timeOut(item),
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
    this.activeLog,
  });

  final String roId;
  final String title;
  final String programName;
  final String openingTitle;
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

  final RoTimeLog? activeLog;
  final List<RoTimeLog> logs;

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

  factory RoAssignment.fromJson(Map<String, dynamic> json) {
    return RoAssignment(
      roId: json['roId']?.toString() ?? json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Return of Obligation Notice',
      programName: json['programName']?.toString() ?? '',
      openingTitle: json['openingTitle']?.toString() ?? '',
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
      activeLog: json['activeLog'] is Map<String, dynamic>
          ? RoTimeLog.fromJson(json['activeLog'] as Map<String, dynamic>)
          : null,
      logs: (json['logs'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(RoTimeLog.fromJson)
          .toList(),
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
      validationStatus:
          json['validationStatus']?.toString() ?? 'Pending Validation',
      validatedMinutes: _toInt(json['validatedMinutes']),
      validationRemarks: json['validationRemarks']?.toString() ?? '',
      studentNote: json['studentNote']?.toString() ?? '',
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({
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
  final VoidCallback onAcknowledge;
  final VoidCallback onReportConcern;
  final VoidCallback onTimeIn;
  final VoidCallback onTimeOut;

  @override
  Widget build(BuildContext context) {
    final activeLog = item.activeLog;
    final isTimedIn = activeLog != null;
    final submittedProgress = item.submittedProgress.clamp(0, 100) / 100;
    final validatedProgress = item.validatedProgress.clamp(0, 100) / 100;

    final canAcknowledge =
        !item.isCleared && item.isAssignedOnly && !isSubmitting;

    final canReportConcern =
        !item.isCleared && !item.hasConflict && !isSubmitting;

    final canTimeIn =
        !item.isCleared &&
        item.isAcknowledged &&
        !item.hasConflict &&
        !isTimedIn &&
        !hasAnyActiveSession &&
        !isSubmitting;

    final canTimeOut = !item.isCleared && isTimedIn && !isSubmitting;

    return Card(
      elevation: 1,
      shadowColor: const Color(0x12000000),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _NoticeHeader(item: item),
            const SizedBox(height: 16),
            _NoticeDetails(item: item, formatMinutes: formatMinutes),
            const SizedBox(height: 16),
            _ProgressLine(
              label: 'Submitted',
              value: submittedProgress.toDouble(),
              percent: item.submittedProgress,
              caption:
                  '${formatMinutes(item.submittedMinutes)} submitted of ${formatMinutes(item.requiredMinutes)}',
              color: AppColors.gold,
            ),
            const SizedBox(height: 14),
            _ProgressLine(
              label: 'Validated',
              value: validatedProgress.toDouble(),
              percent: item.validatedProgress,
              caption:
                  '${formatMinutes(item.validatedMinutes)} validated of ${formatMinutes(item.requiredMinutes)}',
              color: Colors.green,
            ),
            if (item.validationRemarks.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                item.validationRemarks,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.black54,
                  fontWeight: FontWeight.w600,
                ),
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
            const SizedBox(height: 16),
            if (isTimedIn)
              _ActiveSessionBox(
                log: activeLog,
                formatElapsed: formatElapsed,
                formatDateTime: formatDateTime,
              ),
            if (isTimedIn) const SizedBox(height: 14),
            if (!item.isCleared) ...[
              if (item.isAssignedOnly) ...[
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: canAcknowledge ? onAcknowledge : null,
                    icon: const Icon(Icons.check_circle_rounded),
                    label: const Text('Acknowledge Notice'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.darkBrown,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              if (!item.hasConflict && !item.isCleared) ...[
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: canReportConcern ? onReportConcern : null,
                    icon: const Icon(Icons.feedback_rounded),
                    label: const Text('Report Concern'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: canTimeIn ? onTimeIn : null,
                      icon: const Icon(Icons.login_rounded),
                      label: const Text('Time In'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.darkBrown,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: canTimeOut ? onTimeOut : null,
                      icon: const Icon(Icons.logout_rounded),
                      label: const Text('Time Out'),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFFB3261E),
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            _LogsSection(
              logs: item.logs,
              formatMinutes: formatMinutes,
              formatDateTime: formatDateTime,
            ),
          ],
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
          child: const Icon(
            Icons.assignment_turned_in_rounded,
            color: AppColors.darkBrown,
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
                    color: Colors.black54,
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
    required this.formatElapsed,
    required this.formatDateTime,
  });

  final RoTimeLog log;
  final String Function(int seconds) formatElapsed;
  final String Function(DateTime? value) formatDateTime;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.gold.withOpacity(0.12),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withOpacity(0.45)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Currently Timed In',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(
            'Started: ${formatDateTime(log.timeInAt)}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.black54,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Elapsed: ${formatElapsed(log.elapsedSeconds)}',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
              color: AppColors.darkBrown,
            ),
          ),
          if (log.studentNote.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              log.studentNote,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.black54,
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
  });

  final List<RoTimeLog> logs;
  final String Function(int minutes) formatMinutes;
  final String Function(DateTime? value) formatDateTime;

  @override
  Widget build(BuildContext context) {
    if (logs.isEmpty) {
      return const SizedBox.shrink();
    }

    return ExpansionTile(
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
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(color: color, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 3),
                Text(
                  message,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.black54,
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
    return Container(
      constraints: const BoxConstraints(maxWidth: 120),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: color,
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
