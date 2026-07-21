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
    required this.canJoinWaitingList,
    required this.applyLabel,
    required this.uploadedDocumentCount,
    required this.requiredDocumentCount,
    required this.allocatedSlots,
    required this.filledSlots,
    required this.availableSlots,
    required this.waitingListEnabled,
    required this.waitingListLimit,
    required this.waitingListCount,
    required this.selectionStatus,
    this.existingSelectionStatus,
    this.queuePosition,
    this.waitlistPosition,
    this.benefactorName,
    this.existingApplicationId,
  });

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
  final bool canJoinWaitingList;
  final String applyLabel;
  final int uploadedDocumentCount;
  final int requiredDocumentCount;
  final int allocatedSlots;
  final int filledSlots;
  final int availableSlots;
  final bool waitingListEnabled;
  final int waitingListLimit;
  final int waitingListCount;
  final String selectionStatus;
  final String? existingSelectionStatus;
  final int? queuePosition;
  final int? waitlistPosition;
  final String? benefactorName;
  final String? existingApplicationId;

  bool get regularSlotsFull => allocatedSlots > 0 && availableSlots <= 0;

  factory ProgramOpening.fromJson(Map<String, dynamic> json) {
    return ProgramOpening(
      openingId: json['opening_id']?.toString() ?? '',
      programId: json['program_id']?.toString() ?? '',
      openingTitle: json['opening_title']?.toString() ?? 'Scholarship',
      programName: json['program_name']?.toString() ?? 'Scholarship Program',
      applicationStart: json['application_start']?.toString() ?? '',
      applicationEnd: json['application_end']?.toString() ?? '',
      postingStatus: json['posting_status']?.toString() ?? '',
      announcementText: json['announcement_text']?.toString() ?? '',
      isTes: json['is_tes'] == true,
      hasApplied: json['has_applied'] == true,
      canReapply: json['can_reapply'] == true,
      canApply: json['can_apply'] == true,
      canJoinWaitingList: json['can_join_waiting_list'] == true,
      applyLabel: json['apply_label']?.toString() ?? 'Apply for Scholarship',
      uploadedDocumentCount:
          (json['uploaded_document_count'] as num?)?.toInt() ?? 0,
      requiredDocumentCount:
          (json['required_document_count'] as num?)?.toInt() ?? 0,
      allocatedSlots: (json['allocated_slots'] as num?)?.toInt() ?? 0,
      filledSlots: (json['filled_slots'] as num?)?.toInt() ?? 0,
      availableSlots: (json['available_slots'] as num?)?.toInt() ?? 0,
      waitingListEnabled: json['waiting_list_enabled'] == true,
      waitingListLimit: (json['waiting_list_limit'] as num?)?.toInt() ?? 0,
      waitingListCount: (json['waiting_list_count'] as num?)?.toInt() ?? 0,
      selectionStatus: json['selection_status']?.toString() ?? 'Not Started',
      existingSelectionStatus:
          json['existing_selection_status']?.toString(),
      queuePosition: (json['queue_position'] as num?)?.toInt(),
      waitlistPosition: (json['waitlist_position'] as num?)?.toInt(),
      benefactorName: json['benefactor_name']?.toString(),
      existingApplicationId: json['existing_application_id']?.toString(),
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
