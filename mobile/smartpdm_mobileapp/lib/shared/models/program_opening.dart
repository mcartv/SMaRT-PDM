class ProgramOpening {
  const ProgramOpening({
    required this.openingId,
    required this.programId,
    required this.openingTitle,
    required this.programName,
    required this.applicationStart,
    required this.applicationEnd,
    required this.postingStatus,
    required this.announcementText,
    required this.isTes,
    required this.hasApplied,
    required this.canReapply,
    required this.canApply,
    required this.applyLabel,
    required this.uploadedDocumentCount,
    required this.requiredDocumentCount,
    this.benefactorName,
    this.benefactorDescription,
    this.programDescription = '',
    this.targetAudience = '',
    this.renewalCycle = '',
    this.gwaThreshold,
    this.existingApplicationId,
    this.allocatedSlots = 0,
    this.filledSlots = 0,
    this.availableSlots = 0,
    this.waitingListEnabled = false,
    this.waitingListLimit = 0,
    this.waitingListCount = 0,
    this.canJoinWaitingList = false,
    this.selectionStatus = 'Unranked',
  });

  static const int applicationUploadRequirementCount = 4;

  final String openingId;
  final String programId;
  final String openingTitle;
  final String programName;
  final String applicationStart;
  final String applicationEnd;
  final String postingStatus;
  final String announcementText;
  final bool isTes;
  final bool hasApplied;
  final bool canReapply;
  final bool canApply;
  final String applyLabel;
  final int uploadedDocumentCount;
  final int requiredDocumentCount;
  final String? benefactorName;
  final String? benefactorDescription;
  final String programDescription;
  final String targetAudience;
  final String renewalCycle;
  final double? gwaThreshold;
  final String? existingApplicationId;

  final int allocatedSlots;
  final int filledSlots;
  final int availableSlots;
  final bool waitingListEnabled;
  final int waitingListLimit;
  final int waitingListCount;
  final bool canJoinWaitingList;
  final String selectionStatus;

  factory ProgramOpening.fromJson(Map<String, dynamic> json) {
    final rawRequiredCount =
        (json['required_document_count'] as num?)?.toInt() ??
        applicationUploadRequirementCount;
    final requiredCount = rawRequiredCount <= 0 ||
            rawRequiredCount > applicationUploadRequirementCount
        ? applicationUploadRequirementCount
        : rawRequiredCount;

    final rawUploadedCount =
        (json['uploaded_document_count'] as num?)?.toInt() ?? 0;
    final uploadedCount = rawUploadedCount.clamp(0, requiredCount).toInt();

    return ProgramOpening(
      openingId: json['opening_id']?.toString() ?? '',
      programId: json['program_id']?.toString() ?? '',
      openingTitle: json['opening_title']?.toString() ?? 'Scholarship',
      programName: json['program_name']?.toString() ?? 'Unknown Program',
      applicationStart: json['application_start']?.toString() ?? '',
      applicationEnd: json['application_end']?.toString() ?? '',
      postingStatus: json['posting_status']?.toString() ?? '',
      announcementText: json['announcement_text']?.toString() ?? '',
      isTes: json['is_tes'] == true,
      hasApplied: json['has_applied'] == true,
      canReapply: json['can_reapply'] == true,
      canApply: json['can_apply'] == true,
      applyLabel: json['apply_label']?.toString() ?? 'Apply for Scholarship',
      uploadedDocumentCount: uploadedCount,
      requiredDocumentCount: requiredCount,
      benefactorName: json['benefactor_name']?.toString(),
      benefactorDescription: json['benefactor_description']?.toString(),
      programDescription: json['program_description']?.toString() ?? '',
      targetAudience: json['target_audience']?.toString() ?? '',
      renewalCycle: json['renewal_cycle']?.toString() ?? '',
      gwaThreshold: (json['gwa_threshold'] as num?)?.toDouble(),
      existingApplicationId: json['existing_application_id']?.toString(),
      allocatedSlots: (json['allocated_slots'] as num?)?.toInt() ?? 0,
      filledSlots: (json['filled_slots'] as num?)?.toInt() ?? 0,
      availableSlots: (json['available_slots'] as num?)?.toInt() ?? 0,
      waitingListEnabled: json['waiting_list_enabled'] == true,
      waitingListLimit: (json['waiting_list_limit'] as num?)?.toInt() ?? 0,
      waitingListCount: (json['waiting_list_count'] as num?)?.toInt() ?? 0,
      canJoinWaitingList: json['can_join_waiting_list'] == true,
      selectionStatus:
          json['existing_selection_status']?.toString().trim().isNotEmpty == true
              ? json['existing_selection_status'].toString()
              : json['selection_status']?.toString() ?? 'Unranked',
    );
  }
}

class ProgramOpeningsResult {
  const ProgramOpeningsResult({
    required this.hasSavedDraft,
    required this.draftOpeningId,
    required this.draftOpeningTitle,
    required this.draftProgramName,
    required this.activeApplicationId,
    required this.activeOpeningId,
    required this.isApprovedScholar,
    required this.items,
  });

  final bool hasSavedDraft;
  final String draftOpeningId;
  final String draftOpeningTitle;
  final String draftProgramName;
  final String activeApplicationId;
  final String activeOpeningId;
  final bool isApprovedScholar;
  final List<ProgramOpening> items;
}
