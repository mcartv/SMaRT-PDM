import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_signing_service.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/intake_form_ui.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/signature_pad.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

class SigningState extends ChangeNotifier {
  String? sessionId;
  String? _formFingerprint;
  final SignaturePadController studentPad = SignaturePadController();
  final SignaturePadController guardianPad = SignaturePadController();
  Uint8List? guardianId;
  String guardianIdName = '';
  bool consent = false;
  bool uploading = false;
  int _uploadGeneration = 0;
  String? error;
  bool studentSigned = false;
  bool guardianSigned = false;
  bool _requiresReconfirmation = false;
  String? _reconfirmationMessage;

  bool get isReady =>
      sessionId != null &&
      !_requiresReconfirmation &&
      studentSigned &&
      guardianSigned &&
      guardianId != null &&
      consent;
  String? get validationMessage {
    if (_requiresReconfirmation) {
      return _reconfirmationMessage ??
          'Application details changed. Reconfirm and upload the signing evidence again.';
    }
    if (!studentSigned) {
      return 'Student signature is required.';
    }
    if (!guardianSigned) {
      return 'Parent or guardian signature is required.';
    }
    if (guardianId == null) {
      return 'A parent or guardian ID is required.';
    }
    if (!consent) {
      return 'Consent acknowledgment is required.';
    }
    if (sessionId == null) {
      return 'Upload the signing evidence before submitting.';
    }
    return null;
  }

  void invalidateIfFormChanged(Map<String, dynamic> payload) {
    final fingerprint = _canonicalJson(payload);
    if (_formFingerprint != null &&
        _formFingerprint != fingerprint &&
        sessionId != null) {
      sessionId = null;
      _requiresReconfirmation = true;
      _reconfirmationMessage =
          'Application details changed. Reconfirm and upload the signing evidence again.';
      error = _reconfirmationMessage;
      notifyListeners();
    }
    _formFingerprint = fingerprint;
  }

  void markUploaded(String uploadedSessionId, Map<String, dynamic> payload) {
    sessionId = uploadedSessionId;
    studentSigned = !studentPad.isEmpty;
    guardianSigned = !guardianPad.isEmpty;
    _formFingerprint = _canonicalJson(payload);
    _requiresReconfirmation = false;
    _reconfirmationMessage = null;
    error = null;
    notifyListeners();
  }

  int? beginUpload() {
    if (uploading) return null;
    uploading = true;
    error = null;
    _uploadGeneration += 1;
    notifyListeners();
    return _uploadGeneration;
  }

  bool isCurrentUpload(int generation) =>
      uploading && _uploadGeneration == generation;

  void finishUpload(int generation) {
    if (_uploadGeneration != generation) return;
    uploading = false;
    notifyListeners();
  }

  void clearStudentSignature() {
    studentPad.clear();
    studentSigned = false;
    _invalidateEvidence(
      'Student signature was cleared. Upload signing evidence again.',
    );
  }

  void clearGuardianSignature() {
    guardianPad.clear();
    guardianSigned = false;
    _invalidateEvidence(
      'Parent or guardian signature was cleared. Upload signing evidence again.',
    );
  }

  void _invalidateEvidence(String message) {
    sessionId = null;
    _requiresReconfirmation = false;
    _reconfirmationMessage = null;
    error = message;
    notifyListeners();
  }

  void markExpired() {
    sessionId = null;
    _requiresReconfirmation = true;
    _reconfirmationMessage =
        'Your signing session expired. Reconfirm and upload the signing evidence again.';
    error = _reconfirmationMessage;
    notifyListeners();
  }

  void markFormHashMismatch() {
    sessionId = null;
    _requiresReconfirmation = true;
    _reconfirmationMessage =
        'Application details changed after signing. Reconfirm and upload the signing evidence again.';
    error = _reconfirmationMessage;
    notifyListeners();
  }

  @override
  void dispose() {
    studentPad.dispose();
    guardianPad.dispose();
    super.dispose();
  }
}

String _canonicalJson(Object? value) => jsonEncode(_canonicalJsonValue(value));

Object? _canonicalJsonValue(Object? value) {
  if (value is Map) {
    final keys = value.keys.map((key) => key.toString()).toList()..sort();
    return <String, Object?>{
      for (final key in keys) key: _canonicalJsonValue(value[key]),
    };
  }
  if (value is Iterable) {
    return value.map(_canonicalJsonValue).toList(growable: false);
  }
  return value;
}

class StepSigning extends StatefulWidget {
  const StepSigning({
    super.key,
    required this.data,
    required this.state,
    required this.onChanged,
    this.showErrors = false,
  });
  final ApplicationData data;
  final SigningState state;
  final VoidCallback onChanged;
  final bool showErrors;
  @override
  State<StepSigning> createState() => _StepSigningState();
}

class _StepSigningState extends State<StepSigning> {
  final _service = ApplicationSigningService();
  final _picker = ImagePicker();
  late final TextEditingController _guardianName;
  late final TextEditingController _relationship;

  @override
  void initState() {
    super.initState();
    _guardianName = TextEditingController(text: _suggestedGuardianName());
    _relationship = TextEditingController(
      text: widget.data.guardianOnly ? 'Guardian' : 'Parent/Guardian',
    );
  }

  String _suggestedGuardianName() {
    final guardian = [
      widget.data.guardianFirstName,
      widget.data.guardianMiddleName,
      widget.data.guardianLastName,
    ].where((value) => value.trim().isNotEmpty).join(' ');
    if (guardian.isNotEmpty) return guardian;
    return [
      widget.data.fatherFirstName,
      widget.data.fatherLastName,
    ].where((value) => value.trim().isNotEmpty).join(' ');
  }

  @override
  void dispose() {
    _guardianName.dispose();
    _relationship.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    final file = await _picker.pickImage(
      source: source,
      imageQuality: 88,
      maxWidth: 2200,
    );
    if (file == null) return;
    final bytes = await file.readAsBytes();
    if (bytes.isEmpty || bytes.length > 8 * 1024 * 1024) {
      setState(
        () =>
            widget.state.error = 'Use a readable JPG or PNG smaller than 8 MB.',
      );
      return;
    }
    setState(() {
      widget.state.guardianId = bytes;
      widget.state.guardianIdName = file.name.isEmpty
          ? 'guardian-id.jpg'
          : file.name;
      widget.state.error = null;
    });
    widget.onChanged();
  }

  Future<void> _upload() async {
    final uploadGeneration = widget.state.beginUpload();
    if (uploadGeneration == null) return;
    if (widget.state.studentPad.isEmpty ||
        widget.state.guardianPad.isEmpty ||
        widget.state.guardianId == null ||
        !widget.state.consent ||
        _guardianName.text.trim().isEmpty ||
        _relationship.text.trim().isEmpty) {
      widget.state.error =
          'Complete both signatures, guardian details, ID, and consent first.';
      widget.state.finishUpload(uploadGeneration);
      widget.onChanged();
      return;
    }
    try {
      final form = widget.data.toSubmissionPayload();
      final session = await _service.createSession(
        applicationForm: form,
        guardianName: _guardianName.text,
        guardianRelationship: _relationship.text,
        consentAcknowledged: true,
      );
      final student = await exportSignaturePng(widget.state.studentPad);
      final guardian = await exportSignaturePng(widget.state.guardianPad);
      var uploaded = await _service.uploadBytes(
        sessionId: session.id,
        documentType: 'student_signature',
        bytes: student,
        fileName: 'student-signature.png',
      );
      uploaded = await _service.uploadBytes(
        sessionId: uploaded.id,
        documentType: 'guardian_signature',
        bytes: guardian,
        fileName: 'guardian-signature.png',
      );
      uploaded = await _service.uploadBytes(
        sessionId: uploaded.id,
        documentType: 'guardian_id',
        bytes: widget.state.guardianId!,
        fileName: widget.state.guardianIdName,
      );
      if (!uploaded.complete) {
        throw StateError(
          'The signing session is incomplete. Retry the upload.',
        );
      }
      if (widget.state.isCurrentUpload(uploadGeneration)) {
        widget.state.markUploaded(uploaded.id, form);
      }
    } catch (error) {
      if (error.toString().toLowerCase().contains('expired')) {
        widget.state.markExpired();
      }
      if (widget.state.isCurrentUpload(uploadGeneration)) {
        widget.state.error = error.toString().replaceFirst('Exception: ', '');
      }
    } finally {
      widget.state.finishUpload(uploadGeneration);
    }
    widget.onChanged();
  }

  Widget _signatureBlock(
    String title,
    SignaturePadController controller,
    VoidCallback onClear,
  ) => IntakeCard(
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.all(14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        SignaturePad(controller: controller, label: title),
        const SizedBox(height: 8),
        Row(
          children: [
            TextButton.icon(
              onPressed: onClear,
              icon: const Icon(Icons.clear),
              label: const Text('Clear / Retry'),
            ),
            const SizedBox(width: 8),
            Text(
              controller.isEmpty
                  ? 'Draw your signature above.'
                  : 'Signature ready for preview and upload.',
            ),
          ],
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IntakeSectionHeader(title: 'V. APPLICATION SIGNING'),
        Text(
          'Signatures are attached to this exact application form. Changing the form requires signing again.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 16),
        _signatureBlock(
          'Student signature',
          widget.state.studentPad,
          widget.state.clearStudentSignature,
        ),
        _signatureBlock(
          'Parent or guardian signature',
          widget.state.guardianPad,
          widget.state.clearGuardianSignature,
        ),
        IntakeCard(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(14),
          child: Column(
            children: [
              TextField(
                controller: _guardianName,
                decoration: const InputDecoration(
                  labelText: 'Parent / guardian full name',
                ),
              ),
              TextField(
                controller: _relationship,
                decoration: const InputDecoration(
                  labelText: 'Relationship to applicant',
                ),
              ),
              const SizedBox(height: 12),
              if (widget.state.guardianId != null)
                Image.memory(
                  widget.state.guardianId!,
                  height: 130,
                  fit: BoxFit.contain,
                )
              else
                const Text('Upload a clear photo of a parent or guardian ID.'),
              Wrap(
                spacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: () => _pick(ImageSource.camera),
                    icon: const Icon(Icons.camera_alt_outlined),
                    label: const Text('Camera'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => _pick(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('Gallery'),
                  ),
                ],
              ),
            ],
          ),
        ),
        CheckboxListTile(
          value: widget.state.consent,
          onChanged: (value) {
            setState(() => widget.state.consent = value ?? false);
            widget.onChanged();
          },
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          title: const Text(
            'I confirm that the parent or guardian personally provided this signature and consented to its use for this scholarship application.',
          ),
        ),
        if (widget.state.error != null)
          Text(
            widget.state.error!,
            style: TextStyle(
              color: Theme.of(context).colorScheme.error,
              fontWeight: FontWeight.w700,
            ),
          ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: widget.state.uploading ? null : _upload,
            icon: widget.state.uploading
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.cloud_upload_outlined),
            label: Text(
              widget.state.sessionId == null
                  ? 'Upload signing evidence'
                  : 'Upload again',
            ),
          ),
        ),
        if (widget.showErrors && widget.state.validationMessage != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              widget.state.validationMessage!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
      ],
    );
  }
}
