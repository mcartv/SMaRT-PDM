import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:share_plus/share_plus.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/printable_application_service.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';

class ApplicationFormPreviewScreen extends StatefulWidget {
  const ApplicationFormPreviewScreen({super.key});

  @override
  State<ApplicationFormPreviewScreen> createState() =>
      _ApplicationFormPreviewScreenState();
}

class _ApplicationFormPreviewScreenState
    extends State<ApplicationFormPreviewScreen> {
  final ApplicationService _service = ApplicationService();
  final PrintableApplicationService _pdfService = PrintableApplicationService();

  ApplicationData? _data;
  Map<String, dynamic> _application = const {};
  Map<String, dynamic> _submittedFormPayload = const {};
  bool _canEdit = false;
  bool _correctionRequested = false;
  bool _awaitingVerification = false;
  bool _loading = true;
  bool _isExportingPdf = false;
  String? _lockReason;
  String? _pdfError;
  String? _correctionComment;
  String? _error;
  final Set<String> _expandedLongFields = <String>{};
  NotificationProvider? _notificationProvider;
  int _lastApplicationRevision = 0;
  bool _pendingRealtimeReload = false;
  Timer? _liveSyncTimer;
  bool _fetchInProgress = false;

  @override
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
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (identical(_notificationProvider, provider)) return;

    _notificationProvider?.removeListener(_handleRealtimeApplicationUpdate);
    _notificationProvider = provider;
    _lastApplicationRevision = provider.applicationRevision;
    provider.addListener(_handleRealtimeApplicationUpdate);
  }

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
          _submittedFormPayload = const {};
          _canEdit = false;
          _correctionRequested = false;
          _awaitingVerification = false;
          _lockReason = null;
          _correctionComment = null;
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
        _submittedFormPayload = rawForm;
        _canEdit = editability['can_edit'] == true;
        _correctionRequested = editability['correction_requested'] == true;
        _awaitingVerification = editability['awaiting_verification'] == true;
        _lockReason = _optional(editability['reason']);
        _correctionComment = _optional(editability['correction_comment']);
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
      // SMART_PDM_APPLICATION_FORM_IMMEDIATE_DISABLE_V4
      // Disable the button immediately after a successful edit before the
      // refreshed server state arrives, so the user never sees it re-enabled
      // during the transition back to Preview Form.
      if (mounted) {
        setState(() {
          _canEdit = false;
          _correctionRequested = false;
          _awaitingVerification = true;
          _lockReason =
              'Your updated Application Form is waiting for verification. '
              'Edit Form is temporarily disabled until OSFA/Admin completes '
              'the review or requests another correction.';
        });
      }

      await _load();
    }
  }

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
      final payload = Map<String, dynamic>.from(_submittedFormPayload);
      final existingApplication = Map<String, dynamic>.from(
        payload['application'] as Map? ?? const {},
      );
      payload['application'] = {...existingApplication, ..._application};

      final bytes = await _pdfService.generateBytesFromSubmissionPayload(
        payload,
      );

      if (!mounted) return;

      await Share.shareXFiles([
        XFile.fromData(
          bytes,
          mimeType: 'application/pdf',
          name: 'SMaRT-PDM_Application_Form.pdf',
        ),
      ], text: 'SMaRT-PDM Scholarship Application');
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

  String? _optional(dynamic value) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? null : text;
  }

  // SMART_PDM_MOBILE_APPLICATION_FORM_EDIT_PREVIEW_V1
  // SMART_PDM_APPLICATION_FORM_AWAITING_VERIFICATION_LOCK_V3
  String _editabilityMessage() {
    if (_awaitingVerification) {
      return _lockReason ??
          'Your updated Application Form is waiting for verification. '
              'Edit Form is temporarily disabled until OSFA/Admin completes '
              'the review or requests another correction.';
    }

    if (!_canEdit) {
      return _lockReason ??
          'Editing is no longer available for this application.';
    }

    if (_correctionRequested) {
      if (_correctionComment == null) {
        return 'OSFA/Admin requested a correction to your application form. '
            'Edit the requested information and save the updated form.';
      }

      return 'OSFA/Admin requested a correction to your application form. '
          'Admin remark: $_correctionComment';
    }

    return 'You can still edit your Application Form while this application '
        'is eligible for changes. Saved changes will appear here in Preview Form.';
  }

  String _text(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? 'Not provided' : trimmed;
  }

  String _yesNo(bool value) => value ? 'Yes' : 'No';

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

    return raw.isEmpty ? 'Not provided' : raw;
  }

  String _fullName(String first, String middle, String last) {
    final parts = [
      first,
      middle,
      last,
    ].map((value) => value.trim()).where((value) => value.isNotEmpty).toList();
    return parts.isEmpty ? 'Not provided' : parts.join(' ');
  }

  String _address(ApplicationData data) {
    final parts = [
      data.unitBldgNo,
      data.houseLotBlockNo,
      data.street,
      data.subdivision,
      data.barangay,
      data.city,
      data.province,
      data.zipCode,
    ].map((value) => value.trim()).where((value) => value.isNotEmpty).toList();

    return parts.isEmpty ? 'Not provided' : parts.join(', ');
  }

  String _scholarshipHistory(ApplicationData data) {
    if (!data.scholarshipHistoryAnswered) return 'Not answered';
    if (!data.scholarshipHistory) return 'No';

    final levels = <String>[
      if (data.scholarshipElementary) 'Elementary',
      if (data.scholarshipHighSchool) 'Junior High School',
      if (data.scholarshipCollege) 'College',
      if (data.scholarshipOthers)
        data.scholarshipOthersSpecify.trim().isEmpty
            ? 'Others'
            : 'Others: ${data.scholarshipOthersSpecify.trim()}',
    ];

    return levels.isEmpty ? 'Yes' : 'Yes — ${levels.join(', ')}';
  }

  String _disciplinary(ApplicationData data) {
    if (!data.disciplinaryActionAnswered) return 'Not answered';
    if (!data.disciplinaryAction) return 'No';

    final explanation = data.disciplinaryExplanation.trim();
    return explanation.isEmpty ? 'Yes' : 'Yes — $explanation';
  }

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
              letterSpacing: 0.55,
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.52),
            ),
          ),
          const SizedBox(height: 4),
          SelectableText(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _expandableField(String label, String value) {
    final displayValue = _text(value);

    return LayoutBuilder(
      builder: (context, constraints) {
        final textStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w600,
          height: 1.4,
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
                  letterSpacing: 0.55,
                  color: Theme.of(
                    context,
                  ).colorScheme.onSurface.withValues(alpha: 0.52),
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

  Widget _section({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return AppSurfaceCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xs,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                AppIconTile(icon: icon),
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 17),
        ...children,
      ],
    ),
    );
  }

  Widget _familyMember({
    required String title,
    required String first,
    required String middle,
    required String last,
    required String mobile,
    required String education,
    required String occupation,
    required String company,
  }) {
    final hasAny = [
      first,
      middle,
      last,
      mobile,
      education,
      occupation,
      company,
    ].any((value) => value.trim().isNotEmpty);

    if (!hasAny) {
      return _field(title, 'Not listed');
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 10),
        _field('Name', _fullName(first, middle, last)),
        _field('Mobile Number', _text(mobile)),
        _field('Highest Educational Attainment', _text(education)),
        _field('Occupation', _text(occupation)),
        _field('Company Name / Address', _text(company)),
        const Divider(height: 22),
      ],
    );
  }

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
        padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xxl),
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
                        icon: _awaitingVerification
                            ? Icons.hourglass_top_rounded
                            : _canEdit
                                ? Icons.edit_note_outlined
                                : Icons.lock_outline_rounded,
                        text: _awaitingVerification
                            ? 'Awaiting verification'
                            : _canEdit
                                ? (_correctionRequested
                                      ? 'Correction requested'
                                      : 'Editing available')
                                : 'Editing locked',
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'This is the information currently saved with your submitted application.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      height: 1.45,
                      color: AppSurfacePalette.mutedText(context),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _section(
            title: 'Personal Information',
            icon: Icons.person_outline_rounded,
            children: [
              _field(
                'Full Name',
                _fullName(data.firstName, data.middleName, data.lastName),
              ),
              _field('Date of Birth', _text(data.dateOfBirth)),
              _field('Age', _text(data.age)),
              _field('Sex', _text(data.sex)),
              _field('Place of Birth', _text(data.placeOfBirth)),
              _field('Citizenship', _text(data.citizenship)),
              _field('Civil Status', _text(data.civilStatus)),
              _field('Religion', _text(data.religion)),
              _field('Permanent Address', _address(data)),
              _field('Mobile Number', _text(data.mobileNumber)),
              _field('Email Address', _text(data.email)),
            ],
          ),
          _section(
            title: 'Family Information',
            icon: Icons.family_restroom_outlined,
            children: [
              _field(
                'Parent / Guardian Address',
                data.sameAddressAsApplicant
                    ? 'Same as applicant address'
                    : _text(data.parentGuardianAddress),
              ),
              _familyMember(
                title: 'Father',
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
                first: data.guardianFirstName,
                middle: data.guardianMiddleName,
                last: data.guardianLastName,
                mobile: data.guardianMobile,
                education: data.guardianEducationalAttainment,
                occupation: data.guardianOccupation,
                company: data.guardianCompanyNameAndAddress,
              ),
              _field('Native of Marilao', _text(data.parentNativeStatus)),
              if (data.parentNativeStatus.trim() == 'No')
                _field(
                  'Previous City / Municipality',
                  _text(data.parentPreviousTownMunicipality),
                )
              else
                _field(
                  'Years as Marilao Resident',
                  _residencyDurationLabel(data.parentMarilaoResidencyDuration),
                ),
            ],
          ),
          _section(
            title: 'Academic Information',
            icon: Icons.school_outlined,
            children: [
              _field('College', _text(data.collegeSchool)),
              _field('College Address', _text(data.collegeAddress)),
              _field('College Year / Status', _text(data.collegeYearGraduated)),
              _field('Junior High School', _text(data.highSchoolSchool)),
              _field(
                'Junior High School Address',
                _text(data.highSchoolAddress),
              ),
              _field(
                'Junior High School Year Graduated',
                _text(data.highSchoolYearGraduated),
              ),
              _field('Senior High School', _text(data.seniorHighSchool)),
              _field(
                'Senior High School Address',
                _text(data.seniorHighAddress),
              ),
              _field(
                'Senior High School Year Graduated',
                _text(data.seniorHighYearGraduated),
              ),
              _field('Elementary School', _text(data.elementarySchool)),
              _field(
                'Elementary School Address',
                _text(data.elementaryAddress),
              ),
              _field(
                'Elementary Year Graduated',
                _text(data.elementaryYearGraduated),
              ),
              _field('Current Course', _text(data.currentCourse)),
              _field('Current Year Level', _text(data.currentYearLevel)),
              _field('Student Number', _text(data.studentNumber)),
              _field('Financial Support', _text(data.financialSupport)),
              _field('Scholarship History', _scholarshipHistory(data)),
              _field('Disciplinary Action', _disciplinary(data)),
            ],
          ),
          _section(
            title: 'Personal Statement',
            icon: Icons.edit_note_outlined,
            children: [
              _expandableField('Describe Yourself', data.describeYourselfEssay),
              _expandableField(
                'Aims and Ambition After Graduation',
                data.aimsAndAmbitionEssay,
              ),
            ],
          ),
          _section(
            title: 'Certification',
            icon: Icons.verified_user_outlined,
            children: [
              _field(
                'Certification Statement Confirmed',
                _yesNo(data.certificationRead),
              ),
              _field('Terms and Privacy Accepted', _yesNo(data.agree)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _pill({required IconData icon, required String text}) {
    return Container(
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
          Text(
            text,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: AppSurfacePalette.isDark(context)
                  ? AppColors.gold
                  : AppColors.darkBrown,
            ),
          ),
        ],
      ),
    );
  }

  Widget _bottomAction() {
    final canEdit = _data != null && _canEdit;
    final canExport = _data != null && !_isExportingPdf;

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
            if (_data != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 9,
                ),
                margin: const EdgeInsets.only(bottom: 9),
                decoration: BoxDecoration(
                  color: AppStatusColors.of(context).inProgressContainer,
                  borderRadius: AppRadii.control,
                  border: Border.all(
                    color: AppStatusColors.of(context).inProgressOutline,
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.info_outline_rounded,
                      size: 16,
                      color: AppColors.gold,
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        _editabilityMessage(),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          height: 1.35,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: canEdit ? _openEditor : null,
                    icon: const Icon(Icons.edit_outlined, size: 19),
                    label: const Text(
                      'Edit Form',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 52),
                      foregroundColor: AppColors.gold,
                      disabledForegroundColor: Theme.of(
                        context,
                      ).colorScheme.onSurface.withValues(alpha: 0.38),
                      side: BorderSide(
                        color: AppSurfacePalette.outline(context),
                        width: 1,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: AppRadii.control,
                      ),
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
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
                    label: const Text(
                      'Export PDF',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(0, 52),
                      backgroundColor: AppColors.gold,
                      foregroundColor: AppColors.darkBrown,
                      disabledBackgroundColor: Theme.of(
                        context,
                      ).colorScheme.surfaceContainerHighest,
                      disabledForegroundColor: Theme.of(
                        context,
                      ).colorScheme.onSurface.withValues(alpha: 0.48),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: AppRadii.control,
                      ),
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
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
  void dispose() {
    _liveSyncTimer?.cancel();
    _notificationProvider?.removeListener(_handleRealtimeApplicationUpdate);
    super.dispose();
  }

  @override
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
