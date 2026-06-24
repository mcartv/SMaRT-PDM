import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/ro_service.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_nav_chips.dart';
import 'package:smartpdm_mobileapp/shared/models/ro_assignment.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ROCompletionScreen extends StatefulWidget {
  const ROCompletionScreen({super.key});

  @override
  State<ROCompletionScreen> createState() => _ROCompletionScreenState();
}

class _ROCompletionScreenState extends State<ROCompletionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _hoursController = TextEditingController();
  final ImagePicker _picker = ImagePicker();
  final RoService _roService = RoService();

  NotificationProvider? _notificationProvider;
  int _lastRoRevision = 0;

  RoAssignment? _assignment;
  bool _isSubmitting = false;
  bool _isLoadingAssignment = false;
  String? _errorMessage;

  TimeOfDay? _timeIn;
  TimeOfDay? _timeOut;
  File? _completionImage;
  Uint8List? _completionImageBytes;
  String? _completionImageName;
  String _qrCodeData = '';

  @override
  void initState() {
    super.initState();
    _generateQRCode();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (_notificationProvider != provider) {
      _notificationProvider?.removeListener(_handleRealtimeRo);
      _notificationProvider = provider;
      _lastRoRevision = provider.roRevision;
      _notificationProvider?.addListener(_handleRealtimeRo);
    }

    final routeArgs = ModalRoute.of(context)?.settings.arguments;
    if (_assignment == null && routeArgs is Map) {
      final mapped = routeArgs.map(
        (key, value) => MapEntry(key.toString(), value),
      );
      _assignment = RoAssignment.fromJson(mapped);
      _hoursController.text =
          (_assignment!.hoursLogged > 0
                  ? _assignment!.hoursLogged
                  : _assignment!.requiredHours)
              .toString();
    }

    if (_assignment == null && !_isLoadingAssignment) {
      _loadFallbackAssignment();
    }
  }

  void _generateQRCode() {
    final timestamp = DateTime.now().toIso8601String();
    final completionId = 'RO-${DateTime.now().millisecondsSinceEpoch}';
    _qrCodeData = 'SMaRT-PDM-RO-Completion:$completionId:$timestamp';
  }

  void _handleRealtimeRo() {
    final provider = _notificationProvider;
    if (provider == null) return;
    if (provider.roRevision == _lastRoRevision) return;

    _lastRoRevision = provider.roRevision;
    if (mounted) {
      _loadFallbackAssignment(refreshCurrent: true);
    }
  }

  Future<void> _loadFallbackAssignment({bool refreshCurrent = false}) async {
    setState(() {
      _isLoadingAssignment = true;
      _errorMessage = null;
    });

    try {
      final payload = await _roService.fetchMyAssignments();
      if (!mounted) return;

      RoAssignment? nextAssignment;
      if (_assignment != null) {
        for (final item in payload.items) {
          if (item.id == _assignment!.id) {
            nextAssignment = item;
            break;
          }
        }
      }

      if (nextAssignment == null) {
        final openItems = payload.items.where((item) => !item.isVerified).toList();
        nextAssignment =
            openItems.isNotEmpty
                ? openItems.first
                : (payload.items.isNotEmpty ? payload.items.first : null);
      }

      setState(() {
        _assignment = nextAssignment;
        if (_assignment != null &&
            (_hoursController.text.trim().isEmpty || refreshCurrent)) {
          _hoursController.text =
              (_assignment!.hoursLogged > 0
                      ? _assignment!.hoursLogged
                      : _assignment!.requiredHours)
                  .toString();
        }
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = error.toString().replaceFirst('Exception: ', '').trim();
      });
    } finally {
      if (mounted) {
        setState(() => _isLoadingAssignment = false);
      }
    }
  }

  Future<void> _selectTimeIn() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _timeIn ?? TimeOfDay.now(),
    );
    if (picked != null) {
      setState(() => _timeIn = picked);
    }
  }

  Future<void> _selectTimeOut() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _timeOut ?? TimeOfDay.now(),
    );
    if (picked != null) {
      setState(() => _timeOut = picked);
    }
  }

  Future<void> _pickImage() async {
    final image = await _picker.pickImage(source: ImageSource.camera);
    if (image == null) return;

    Uint8List? bytes;
    if (kIsWeb) {
      bytes = await image.readAsBytes();
    }

    setState(() {
      _completionImage = kIsWeb ? null : File(image.path);
      _completionImageBytes = bytes;
      _completionImageName = image.name;
    });
  }

  Future<void> _submitCompletion() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_assignment == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No RO assignment selected.')),
      );
      return;
    }

    if (_timeIn == null || _timeOut == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select both Time In and Time Out.')),
      );
      return;
    }

    if (_completionImage == null && _completionImageBytes == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please attach a completion photo.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final renderedHours =
          int.tryParse(_hoursController.text.trim()) ?? _assignment!.requiredHours;

      await _roService.submitCompletion(
        roId: _assignment!.id,
        fileName: _completionImageName ?? 'ro-completion.jpg',
        renderedHours: renderedHours,
        filePath: _completionImage?.path,
        fileBytes: _completionImageBytes,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('RO completion submitted successfully.'),
        ),
      );

      Navigator.pop(context);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error.toString().replaceFirst('Exception: ', '').trim(),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  void _handleScholarChipTap(String label) {
    switch (label) {
      case 'Payout Schedule':
        AppNavigator.goToTopLevel(context, AppRoutes.payouts);
        break;
      case 'Renewal Documents':
        Navigator.pushNamed(context, AppRoutes.renewalDocuments);
        break;
      case 'RO Assignment':
        Navigator.pushNamed(context, AppRoutes.roAssignment);
        break;
      case 'RO Completion':
        break;
    }
  }

  @override
  void dispose() {
    _notificationProvider?.removeListener(_handleRealtimeRo);
    _descriptionController.dispose();
    _hoursController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.grey;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Submit RO Completion'),
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
      ),
      selectedIndex: 1,
      showDrawer: false,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ScholarNavChips(
            selectedLabel: 'RO Completion',
            onTap: _handleScholarChipTap,
          ),
          const SizedBox(height: 20),
          if (_isLoadingAssignment)
            const Center(child: CircularProgressIndicator())
          else if (_assignment == null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'No active RO assignment found',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 8),
                      Text(_errorMessage!),
                    ],
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _loadFallbackAssignment,
                      child: const Text('Refresh'),
                    ),
                  ],
                ),
              ),
            )
          else ...[
            Card(
              color:
                  isDark
                      ? const Color(0xFF3A2718)
                      : primaryColor.withValues(alpha: 0.10),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _assignment!.title,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Department: ${_assignment!.department}',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: subtitleColor,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Required Hours: ${_assignment!.requiredHours}',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: subtitleColor,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Completion Report',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: titleColor,
              ),
            ),
            const SizedBox(height: 20),
            Form(
              key: _formKey,
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: _selectTimeIn,
                          child: InputDecorator(
                            decoration: InputDecoration(
                              labelText: 'Time In',
                              filled: true,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            child: Text(
                              _timeIn?.format(context) ?? 'Select time',
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: InkWell(
                          onTap: _selectTimeOut,
                          child: InputDecorator(
                            decoration: InputDecoration(
                              labelText: 'Time Out',
                              filled: true,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            child: Text(
                              _timeOut?.format(context) ?? 'Select time',
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _hoursController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Rendered Hours',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    validator: (value) {
                      final parsed = int.tryParse(value?.trim() ?? '');
                      if (parsed == null || parsed < 0) {
                        return 'Enter a valid rendered hour count.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: isDark ? Colors.white12 : Colors.grey[300]!,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      children: [
                        ListTile(
                          leading: Icon(Icons.camera_alt, color: accentColor),
                          title: const Text('Completion Photo'),
                          subtitle: const Text(
                            'Attach a photo as proof of completion',
                          ),
                          trailing:
                              (_completionImage != null ||
                                      _completionImageBytes != null)
                                  ? const Icon(
                                    Icons.check_circle,
                                    color: Colors.green,
                                  )
                                  : const Icon(Icons.add_a_photo),
                          onTap: _pickImage,
                        ),
                        if (_completionImage != null)
                          Container(
                            height: 180,
                            margin: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              image: DecorationImage(
                                image: FileImage(_completionImage!),
                                fit: BoxFit.cover,
                              ),
                            ),
                          )
                        else if (_completionImageBytes != null)
                          Container(
                            height: 180,
                            margin: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              image: DecorationImage(
                                image: MemoryImage(_completionImageBytes!),
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    color:
                        isDark ? const Color(0xFF3A2718) : Colors.green[50],
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          Text(
                            'Verification QR Code',
                            style: Theme.of(context).textTheme.bodyLarge
                                ?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: titleColor,
                                ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Keep this reference for your submitted completion.',
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(color: subtitleColor),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: QrImageView(
                              data: _qrCodeData,
                              version: QrVersions.auto,
                              size: 150,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _descriptionController,
                    maxLines: 5,
                    decoration: InputDecoration(
                      labelText: 'Work Summary',
                      hintText:
                          'Describe what you completed. This stays on your device as a summary reference.',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    validator: (value) {
                      if ((value ?? '').trim().length < 10) {
                        return 'Please provide a short work summary.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _isSubmitting ? null : _submitCompletion,
                      icon:
                          _isSubmitting
                              ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Colors.white,
                                  ),
                                ),
                              )
                              : const Icon(Icons.send),
                      label: Text(
                        _isSubmitting
                            ? 'Submitting...'
                            : 'Submit Completion Report',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
