// SMaRT-PDM: Applications — application form preview screen (mobile screen); loads state, handles user actions, and renders the screen.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/core/files/downloaded_file_handler.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/printable_application_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';

class ApplicationFormPreviewScreen extends StatefulWidget {
  const ApplicationFormPreviewScreen({super.key});

  @override
  // createState: creates create state for the Applications flow.
  State<ApplicationFormPreviewScreen> createState() =>
      _ApplicationFormPreviewScreenState();
}

class _ApplicationFormPreviewScreenState
    extends State<ApplicationFormPreviewScreen> {
  final ApplicationService _service = ApplicationService();
  final PrintableApplicationService _pdfService = PrintableApplicationService();

  ApplicationData? _data;
  Map<String, dynamic> _application = const {};
  bool _canEdit = false;
  bool _correctionRequested = false;
  bool _awaitingVerification = false;
  bool _verifiedRequirementLocked = false;
  bool _loading = true;
  bool _isExportingPdf = false;
  String? _pdfError;
  String? _correctionComment;
  String? _editabilityReason;
  String? _error;

  final Set<String> _expandedLongFields = <String>{};
  final Set<String> _expandedSections = <String>{'personal'};

  NotificationProvider? _notificationProvider;
  int _lastApplicationRevision = 0;
  bool _pendingRealtimeReload = false;
  Timer? _liveSyncTimer;
  bool _fetchInProgress = false;

  @override
  // initState: handles init state for the Applications flow.
  void initState() {
    super.initState();
    _load();
    _liveSyncTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
      if (_loading) {
        _pendingRealtimeReload = true;
        return;
      }
      _load(silent: true);
    });
  }

  @override
  // didChangeDependencies: handles did change dependencies for the Applications flow.
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (identical(_notificationProvider, provider)) return;

    _notificationProvider?.removeListener(_handleRealtimeApplicationUpdate);
    _notificationProvider = provider;
    _lastApplicationRevision = provider.applicationRevision;
    provider.addListener(_handleRealtimeApplicationUpdate);
  }

  // _handleRealtimeApplicationUpdate: handles handle realtime application update for the Applications flow.
  void _handleRealtimeApplicationUpdate() {
    final provider = _notificationProvider;
    if (provider == null ||
        provider.applicationRevision == _lastApplicationRevision) {
      return;
    }

    _lastApplicationRevision = provider.applicationRevision;
    _pendingRealtimeReload = true;

    if (mounted && !_loading) {
      _pendingRealtimeReload = false;
      _load(silent: true);
    }
  }

  // _load: handles load for the Applications flow.
  Future<void> _load({bool silent = false}) async {
    if (_fetchInProgress) {
      _pendingRealtimeReload = true;
      return;
    }
    _fetchInProgress = true;

    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final response = await _service.fetchMySubmittedApplicationForm();
      final hasApplication = response['has_application'] == true;

      if (!hasApplication) {
        if (!mounted) return;
        setState(() {
          _data = null;
          _application = const {};
          _canEdit = false;
          _correctionRequested = false;
          _awaitingVerification = false;
          _verifiedRequirementLocked = false;
          _correctionComment = null;
          _editabilityReason = null;
          _error = 'No submitted application is available yet.';
          _loading = false;
        });
        return;
      }

      final rawForm = Map<String, dynamic>.from(
        response['form_data'] as Map? ?? const {},
      );
      final rawApplication = Map<String, dynamic>.from(
        response['application'] as Map? ?? const {},
      );
      final editability = Map<String, dynamic>.from(
        response['editability'] as Map? ?? const {},
      );

      final data = ApplicationData()..applySavedForm(rawForm);

      if (!mounted) return;
      setState(() {
        _data = data;
        _application = rawApplication;
        _canEdit = editability['can_edit'] == true;
        _correctionRequested = editability['correction_requested'] == true;
        _awaitingVerification = editability['awaiting_verification'] == true;
        _verifiedRequirementLocked =
            editability['verified_requirement_locked'] == true;
        _correctionComment = _optional(editability['correction_comment']);
        _editabilityReason = _optional(editability['reason']);
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      if (!silent || _data == null) {
        setState(() {
          _error = error.toString().replaceFirst('Exception: ', '').trim();
          _loading = false;
        });
      }
    } finally {
      _fetchInProgress = false;
      if (mounted && !_loading && _pendingRealtimeReload) {
        _pendingRealtimeReload = false;
        scheduleMicrotask(() => _load(silent: true));
      }
    }
  }

  // _openEditor: handles open editor for the Applications flow.
  Future<void> _openEditor() async {
    final data = _data;
    if (data == null || !_canEdit) return;

    final updated = await Navigator.pushNamed(
      context,
      AppRoutes.newApplicant,
      arguments: {
        'openingId': data.openingId,
        'openingTitle': data.openingTitle,
        'programName': data.openingProgramName,
        'editExistingApplication': true,
      },
    );

    if (!mounted) return;

    if (updated == true) {
      // Keep the action disabled immediately after an update while the
      // authoritative review state is refreshed from the server.
      // SMART_PDM_APPLICATION_FORM_IMMEDIATE_DISABLE_V4
      setState(() {
        _canEdit = false;
        _correctionRequested = false;
        _awaitingVerification = true;
        _verifiedRequirementLocked = false;
        _editabilityReason = null;
      });

      await _load();
    }
  }

  // _exportPdf: handles export pdf for the Applications flow.
  Future<void> _exportPdf() async {
    if (_isExportingPdf) return;

    final data = _data;
    if (data == null) {
      setState(() {
        _pdfError = 'Application PDF is not available yet.';
      });
      return;
    }

    setState(() {
      _isExportingPdf = true;
      _pdfError = null;
    });

    try {
      final bytes = await _pdfService
          .generateBytesFromMySubmittedApplicationForm();

      if (!mounted) return;

      final message = await saveAndOpenDownloadedFile(
        bytes: bytes,
        fileName: 'SMaRT-PDM_Application_Form.pdf',
        contentType: 'application/pdf',
      );

      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _pdfError = error.toString().replaceFirst('Exception: ', '').trim();
      });
    } finally {
      if (mounted) {
        setState(() {
          _isExportingPdf = false;
        });
      }
    }
  }

  // _optional: handles optional for the Applications flow.
  String? _optional(dynamic value) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? null : text;
  }

  // _editabilityLabel: handles editability label for the Applications flow.
  String _editabilityLabel() {
    if (_awaitingVerification) return 'Under Review';
    if (_correctionRequested) return 'Correction Needed';
    if (_canEdit) return 'Editing Available';
    if (_verifiedRequirementLocked) return 'Form Locked';
    return 'Editing Closed';
  }

  // _editabilityIcon: handles editability icon for the Applications flow.
  IconData _editabilityIcon() {
    if (_awaitingVerification) return Icons.hourglass_top_rounded;
    if (_correctionRequested) return Icons.edit_note_outlined;
    if (_canEdit) return Icons.edit_outlined;
    return Icons.lock_outline_rounded;
  }

  // _editabilityMessage: handles editability message for the Applications flow.
  String _editabilityMessage() {
    if (_awaitingVerification) {
      return 'Your updated application is being reviewed. You can edit it again if OSFA requests another correction.';
    }

    if (_correctionRequested) {
      if (_correctionComment == null) {
        return 'OSFA requested a correction. Open Edit Form and update the requested information.';
      }
      return 'OSFA requested a correction. Note: $_correctionComment';
    }

    if (_verifiedRequirementLocked) {
      return 'One of your submitted requirements has already been verified, so your Application Form is now locked. You can still review or export it. If OSFA asks for a correction, editing will reopen.';
    }

    if (_canEdit) {
      return 'You can update this application while editing is available.';
    }

    if (_editabilityReason != null) {
      return _editabilityReason!;
    }

    return 'Editing is no longer available for this Application Form. You can still review or export it.';
  }

  // _text: handles text for the Applications flow.
  String _text(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty || trimmed.toUpperCase() == 'N/A') {
      return 'Not provided';
    }
    return trimmed;
  }

  // _yesNo: handles yes no for the Applications flow.
  String _yesNo(bool value) => value ? 'Yes' : 'No';

  // _answerLabel: handles answer label for the Applications flow.
  String _answerLabel(bool answered, bool value) {
    if (!answered) return 'Not answered';
    return value ? 'Yes' : 'No';
  }

  // _residencyDurationLabel: handles residency duration label for the Applications flow.
  String _residencyDurationLabel(String value) {
    final raw = value.trim();
    final years = int.tryParse(raw);

    if (raw.toLowerCase() == 'less than a year' || years == 0) {
      return 'Less than a year';
    }
    if (raw.toLowerCase() == '1-5 years' ||
        (years != null && years >= 1 && years <= 5)) {
      return '1-5 years';
    }
    if (raw.toLowerCase() == '6-10 years' ||
        (years != null && years >= 6 && years <= 10)) {
      return '6-10 years';
    }
    if (raw.toLowerCase() == 'more than 10 years' ||
        (years != null && years > 10)) {
      return 'More than 10 years';
    }

    return _text(raw);
  }

  // _scholarshipLevels: handles scholarship levels for the Applications flow.
  String _scholarshipLevels(ApplicationData data) {
    final levels = <String>[
      if (data.scholarshipElementary) 'Elementary',
      if (data.scholarshipHighSchool) 'Junior High School',
      if (data.scholarshipCollege) 'College',
      if (data.scholarshipOthers)
        data.scholarshipOthersSpecify.trim().isEmpty
            ? 'Others'
            : 'Others: ${data.scholarshipOthersSpecify.trim()}',
    ];

    return levels.isEmpty ? 'Not provided' : levels.join(', ');
  }

  // _field: handles field for the Applications flow.
  Widget _field(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w700,
              letterSpacing: 0.45,
              color: AppSurfacePalette.mutedText(context),
            ),
          ),
          const SizedBox(height: 4),
          SelectableText(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
              height: 1.4,
              color: AppSurfacePalette.text(context),
            ),
          ),
        ],
      ),
    );
  }

  // _expandableField: handles expandable field for the Applications flow.
  Widget _expandableField(String label, String value) {
    final displayValue = _text(value);

    return LayoutBuilder(
      builder: (context, constraints) {
        final textStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w600,
          height: 1.4,
          color: AppSurfacePalette.text(context),
        );

        final painter = TextPainter(
          text: TextSpan(text: displayValue, style: textStyle),
          maxLines: 3,
          textDirection: Directionality.of(context),
        )..layout(maxWidth: constraints.maxWidth);

        final isLong = painter.didExceedMaxLines;
        final expanded = _expandedLongFields.contains(label);

        return Padding(
          padding: const EdgeInsets.only(bottom: 13),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.45,
                  color: AppSurfacePalette.mutedText(context),
                ),
              ),
              const SizedBox(height: 4),
              SelectableText(
                displayValue,
                maxLines: expanded ? null : 3,
                style: textStyle,
              ),
              if (isLong || expanded) ...[
                const SizedBox(height: 3),
                TextButton(
                  onPressed: () {
                    setState(() {
                      if (expanded) {
                        _expandedLongFields.remove(label);
                      } else {
                        _expandedLongFields.add(label);
                      }
                    });
                  },
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 0,
                      vertical: 4,
                    ),
                    minimumSize: const Size(0, 32),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    foregroundColor: AppColors.gold,
                  ),
                  child: Text(
                    expanded ? 'Show less' : 'Read more',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  // _section: handles section for the Applications flow.
  Widget _section({
    required String sectionKey,
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    final expanded = _expandedSections.contains(sectionKey);

    return AppSurfaceCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          InkWell(
            onTap: () {
              setState(() {
                if (expanded) {
                  _expandedSections.remove(sectionKey);
                } else {
                  _expandedSections.add(sectionKey);
                }
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Row(
                children: [
                  AppIconTile(icon: icon),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: AppSurfacePalette.text(context),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 160),
                    child: Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: AppSurfacePalette.mutedText(context),
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            child: expanded
                ? Column(
                    children: [
                      Divider(
                        height: 1,
                        color: AppSurfacePalette.outline(context),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.lg,
                          AppSpacing.lg,
                          AppSpacing.xs,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: children,
                        ),
                      ),
                    ],
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  // _subsection: handles subsection for the Applications flow.
  Widget _subsection(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 2, bottom: 12),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
          color: AppColors.gold,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }

  // _divider: handles divider for the Applications flow.
  Widget _divider() => const Divider(height: 26);

  // _familyMember: handles family member for the Applications flow.
  Widget _familyMember({
    required String title,
    required bool present,
    required String first,
    required String middle,
    required String last,
    required String mobile,
    required String education,
    required String occupation,
    required String company,
  }) {
    if (!present) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _subsection(title),
          _field('Status', 'Not present / not listed'),
          _divider(),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _subsection(title),
        _field('First Name', _text(first)),
        _field('Middle Name', _text(middle)),
        _field('Last Name', _text(last)),
        _field('Mobile Number', _text(mobile)),
        _field('Highest Educational Attainment', _text(education)),
        _field('Occupation', _text(occupation)),
        _field('Company Name / Address', _text(company)),
        _divider(),
      ],
    );
  }

  // _certificationRow: handles certification row for the Applications flow.
  Widget _certificationRow({
    required String label,
    required bool confirmed,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            confirmed ? Icons.check_circle_rounded : Icons.cancel_outlined,
            size: 20,
            color: confirmed
                ? AppColors.gold
                : Theme.of(context).colorScheme.error,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // _content: handles content for the Applications flow.
  Widget _content(ApplicationData data) {
    final applicationStatus =
        _optional(_application['application_status']) ?? 'Submitted';
    final openingTitle =
        _optional(_application['opening_title']) ?? data.openingTitle;
    final programName =
        _optional(_application['program_name']) ?? data.openingProgramName;

    return RefreshIndicator(
      onRefresh: () => _load(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.xxl,
        ),
        children: [
          AppSurfaceCard(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  openingTitle.trim().isEmpty
                      ? 'Current Scholarship Application'
                      : openingTitle,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (programName.trim().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    programName,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppSurfacePalette.mutedText(context),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _pill(
                      icon: Icons.description_outlined,
                      text: applicationStatus,
                    ),
                    _pill(
                      icon: _editabilityIcon(),
                      text: _editabilityLabel(),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'This preview shows the information saved with your submitted application. Open each section to review the details you provided.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    height: 1.45,
                    color: AppSurfacePalette.mutedText(context),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.info_outline_rounded,
                      size: 18,
                      color: AppColors.gold,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _editabilityMessage(),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          height: 1.4,
                          fontWeight: FontWeight.w600,
                          color: AppSurfacePalette.mutedText(context),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _section(
            sectionKey: 'personal',
            title: 'Personal Information',
            icon: Icons.person_outline_rounded,
            children: [
              _subsection('Name'),
              _field('First Name', _text(data.firstName)),
              _field('Middle Name', _text(data.middleName)),
              _field('Last Name', _text(data.lastName)),
              _field('Maiden Name', _text(data.maidenName)),
              _divider(),
              _subsection('Personal Details'),
              _field('Date of Birth', _text(data.dateOfBirth)),
              _field('Age', _text(data.age)),
              _field('Sex', _text(data.sex)),
              _field('Place of Birth', _text(data.placeOfBirth)),
              _field('Citizenship', _text(data.citizenship)),
              _field('Civil Status', _text(data.civilStatus)),
              _field('Religion', _text(data.religion)),
              _divider(),
              _subsection('Permanent Address'),
              _field('Unit / Building No.', _text(data.unitBldgNo)),
              _field('House / Lot / Block No.', _text(data.houseLotBlockNo)),
              _field('Phase', _text(data.phase)),
              _field('Street', _text(data.street)),
              _field('Subdivision', _text(data.subdivision)),
              _field('Barangay', _text(data.barangay)),
              _field('City / Municipality', _text(data.city)),
              _field('Province', _text(data.province)),
              _field('ZIP Code', _text(data.zipCode)),
              _divider(),
              _subsection('Contact Information'),
              _field('Landline', _text(data.landline)),
              _field('Mobile Number', _text(data.mobileNumber)),
              _field('Email Address', _text(data.email)),
            ],
          ),
          _section(
            sectionKey: 'family',
            title: 'Family Information',
            icon: Icons.family_restroom_outlined,
            children: [
              _field(
                'Parent / Guardian Address',
                data.sameAddressAsApplicant
                    ? 'Same as applicant address'
                    : _text(data.parentGuardianAddress),
              ),
              _field(
                'Same Address as Applicant',
                _yesNo(data.sameAddressAsApplicant),
              ),
              _divider(),
              _familyMember(
                title: 'Father',
                present: data.fatherPresent && !data.guardianOnly,
                first: data.fatherFirstName,
                middle: data.fatherMiddleName,
                last: data.fatherLastName,
                mobile: data.fatherMobile,
                education: data.fatherEducationalAttainment,
                occupation: data.fatherOccupation,
                company: data.fatherCompanyNameAndAddress,
              ),
              _familyMember(
                title: 'Mother',
                present: data.motherPresent && !data.guardianOnly,
                first: data.motherFirstName,
                middle: data.motherMiddleName,
                last: data.motherLastName,
                mobile: data.motherMobile,
                education: data.motherEducationalAttainment,
                occupation: data.motherOccupation,
                company: data.motherCompanyNameAndAddress,
              ),
              _familyMember(
                title: 'Sibling',
                present: [
                  data.siblingFirstName,
                  data.siblingMiddleName,
                  data.siblingLastName,
                  data.siblingMobile,
                  data.siblingEducationalAttainment,
                  data.siblingOccupation,
                  data.siblingCompanyNameAndAddress,
                ].any(
                  (value) =>
                      value.trim().isNotEmpty && value.trim().toUpperCase() != 'N/A',
                ),
                first: data.siblingFirstName,
                middle: data.siblingMiddleName,
                last: data.siblingLastName,
                mobile: data.siblingMobile,
                education: data.siblingEducationalAttainment,
                occupation: data.siblingOccupation,
                company: data.siblingCompanyNameAndAddress,
              ),
              _familyMember(
                title: 'Guardian',
                present: [
                  data.guardianFirstName,
                  data.guardianMiddleName,
                  data.guardianLastName,
                  data.guardianMobile,
                  data.guardianEducationalAttainment,
                  data.guardianOccupation,
                  data.guardianCompanyNameAndAddress,
                ].any(
                  (value) =>
                      value.trim().isNotEmpty && value.trim().toUpperCase() != 'N/A',
                ),
                first: data.guardianFirstName,
                middle: data.guardianMiddleName,
                last: data.guardianLastName,
                mobile: data.guardianMobile,
                education: data.guardianEducationalAttainment,
                occupation: data.guardianOccupation,
                company: data.guardianCompanyNameAndAddress,
              ),
              _subsection('Residency'),
              _field('Native of Marilao', _text(data.parentNativeStatus)),
              if (data.parentNativeStatus.trim().toLowerCase() == 'no') ...[
                _field(
                  'Previous City / Municipality',
                  _text(data.parentPreviousTownMunicipality),
                ),
                _field(
                  'Previous Province',
                  _text(data.parentPreviousProvince),
                ),
              ] else
                _field(
                  'Years as Marilao Resident',
                  _residencyDurationLabel(data.parentMarilaoResidencyDuration),
                ),
            ],
          ),
          _section(
            sectionKey: 'academic',
            title: 'Academic Information',
            icon: Icons.school_outlined,
            children: [
              _subsection('College / Current School'),
              _field('School', _text(data.collegeSchool)),
              _field('Address', _text(data.collegeAddress)),
              _field('Honors / Awards', _text(data.collegeHonors)),
              _field('Club / Organization', _text(data.collegeClub)),
              _field('Year / Status', _text(data.collegeYearGraduated)),
              _divider(),
              _subsection('Junior High School'),
              _field('School', _text(data.highSchoolSchool)),
              _field('Address', _text(data.highSchoolAddress)),
              _field('Honors / Awards', _text(data.highSchoolHonors)),
              _field('Club / Organization', _text(data.highSchoolClub)),
              _field('Year Graduated', _text(data.highSchoolYearGraduated)),
              _divider(),
              _subsection('Senior High School'),
              _field('School', _text(data.seniorHighSchool)),
              _field('Address', _text(data.seniorHighAddress)),
              _field('Honors / Awards', _text(data.seniorHighHonors)),
              _field('Club / Organization', _text(data.seniorHighClub)),
              _field('Year Graduated', _text(data.seniorHighYearGraduated)),
              _divider(),
              _subsection('Elementary School'),
              _field('School', _text(data.elementarySchool)),
              _field('Address', _text(data.elementaryAddress)),
              _field('Honors / Awards', _text(data.elementaryHonors)),
              _field('Club / Organization', _text(data.elementaryClub)),
              _field('Year Graduated', _text(data.elementaryYearGraduated)),
              _divider(),
              _subsection('Current Academic Information'),
              _field('Course', _text(data.currentCourse)),
              _field('Year Level', _text(data.currentYearLevel)),
              _field('Section', _text(data.currentSection)),
              _field('Student Number', _text(data.studentNumber)),
              _field(
                'Learner Reference Number (LRN)',
                _text(data.learnersReferenceNumber),
              ),
              _field('GWA', _text(data.gwa)),
              _divider(),
              _subsection('Scholarship & Support'),
              _field('Financial Support', _text(data.financialSupport)),
              if (data.financialSupportOtherSpecify.trim().isNotEmpty)
                _field(
                  'Other Financial Support',
                  _text(data.financialSupportOtherSpecify),
                ),
              _field(
                'Previous Scholarship',
                _answerLabel(
                  data.scholarshipHistoryAnswered,
                  data.scholarshipHistory,
                ),
              ),
              if (data.scholarshipHistory) ...[
                _field('Scholarship Level(s)', _scholarshipLevels(data)),
                _field('Scholarship Details', _text(data.scholarshipDetails)),
              ],
              _divider(),
              _subsection('Disciplinary Information'),
              _field(
                'Disciplinary Action',
                _answerLabel(
                  data.disciplinaryActionAnswered,
                  data.disciplinaryAction,
                ),
              ),
              if (data.disciplinaryAction)
                _field(
                  'Explanation',
                  _text(data.disciplinaryExplanation),
                ),
            ],
          ),
          _section(
            sectionKey: 'statement',
            title: 'Personal Statement',
            icon: Icons.edit_note_outlined,
            children: [
              _expandableField('Describe Yourself', data.describeYourselfEssay),
              _expandableField(
                'Aims and Ambitions After Graduation',
                data.aimsAndAmbitionEssay,
              ),
            ],
          ),
          _section(
            sectionKey: 'certification',
            title: 'Certification & Agreement',
            icon: Icons.verified_user_outlined,
            children: [
              _certificationRow(
                label: 'Information confirmed',
                confirmed: data.certificationRead,
              ),
              _certificationRow(
                label: 'Terms and Privacy accepted',
                confirmed: data.agree,
              ),
            ],
          ),
        ],
      ),
    );
  }

  // _pill: handles pill for the Applications flow.
  Widget _pill({required IconData icon, required String text}) {
    final maxWidth = (MediaQuery.sizeOf(context).width - 64)
        .clamp(160.0, 420.0)
        .toDouble();

    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.gold.withValues(alpha: 0.14),
          borderRadius: AppRadii.status,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 15,
              color: AppSurfacePalette.isDark(context)
                  ? AppColors.gold
                  : AppColors.darkBrown,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                text,
                maxLines: 2,
                softWrap: true,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppSurfacePalette.isDark(context)
                      ? AppColors.gold
                      : AppColors.darkBrown,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // _bottomAction: handles bottom action for the Applications flow.
  Widget _bottomAction() {
    final canEdit = _data != null && _canEdit;
    final canExport = _data != null && !_isExportingPdf;

    // editButton: updates edit button for the Applications flow.
    Widget editButton() => OutlinedButton.icon(
      onPressed: canEdit ? _openEditor : null,
      icon: const Icon(Icons.edit_outlined, size: 19),
      label: const Text(
        'Edit Form',
        textAlign: TextAlign.center,
        maxLines: 2,
        softWrap: true,
      ),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        foregroundColor: AppColors.gold,
        disabledForegroundColor: Theme.of(
          context,
        ).colorScheme.onSurface.withValues(alpha: 0.38),
        side: BorderSide(
          color: AppSurfacePalette.outline(context),
          width: 1,
        ),
        shape: RoundedRectangleBorder(borderRadius: AppRadii.control),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    );

    // exportButton: handles export button for the Applications flow.
    Widget exportButton() => ElevatedButton.icon(
      onPressed: canExport ? _exportPdf : null,
      icon: _isExportingPdf
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.darkBrown,
              ),
            )
          : const Icon(Icons.picture_as_pdf_outlined, size: 19),
      label: Text(
        _isExportingPdf ? 'Exporting...' : 'Export PDF',
        textAlign: TextAlign.center,
        maxLines: 2,
        softWrap: true,
      ),
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        backgroundColor: AppColors.gold,
        foregroundColor: AppColors.darkBrown,
        disabledBackgroundColor: Theme.of(
          context,
        ).colorScheme.surfaceContainerHighest,
        disabledForegroundColor: Theme.of(
          context,
        ).colorScheme.onSurface.withValues(alpha: 0.48),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: AppRadii.control),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    );

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        decoration: BoxDecoration(
          color: AppSurfacePalette.surface(context),
          border: Border(
            top: BorderSide(color: AppSurfacePalette.outline(context)),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 12,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                final stack = constraints.maxWidth < 350;
                if (stack) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      editButton(),
                      const SizedBox(height: 8),
                      exportButton(),
                    ],
                  );
                }

                return Row(
                  children: [
                    Expanded(child: editButton()),
                    const SizedBox(width: 10),
                    Expanded(child: exportButton()),
                  ],
                );
              },
            ),
            if (_pdfError != null) ...[
              const SizedBox(height: 7),
              Text(
                _pdfError!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.error,
                  fontWeight: FontWeight.w700,
                  height: 1.35,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  // dispose: handles dispose for the Applications flow.
  void dispose() {
    _liveSyncTimer?.cancel();
    _notificationProvider?.removeListener(_handleRealtimeApplicationUpdate);
    super.dispose();
  }

  @override
  // build: builds build for the Applications flow.
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Preview Form'),
        backgroundColor: AppSurfacePalette.surface(context),
        foregroundColor: AppSurfacePalette.text(context),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      bottomNavigationBar: _loading || _error != null ? null : _bottomAction(),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? RefreshIndicator(
              onRefresh: () => _load(),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 100),
                  Icon(
                    Icons.description_outlined,
                    size: 48,
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.35),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ],
              ),
            )
          : _content(_data!),
    );
  }
}
