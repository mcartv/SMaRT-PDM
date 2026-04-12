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
  final String applyLabel;
  final String? benefactorName;
  final String? existingApplicationId;

  factory ProgramOpening.fromJson(Map<String, dynamic> json) {
    return ProgramOpening(
      openingId: json['opening_id']?.toString() ?? '',
      programId: json['program_id']?.toString() ?? '',
      openingTitle: json['opening_title']?.toString() ?? 'Scholarship Opening',
      programName: json['program_name']?.toString() ?? 'Unknown Program',
      applicationStart: json['application_start']?.toString() ?? '',
      applicationEnd: json['application_end']?.toString() ?? '',
      postingStatus: json['posting_status']?.toString() ?? '',
      announcementText: json['announcement_text']?.toString() ?? '',
      isTes: json['is_tes'] == true,
      hasApplied: json['has_applied'] == true,
      canReapply: json['can_reapply'] == true,
      canApply: json['can_apply'] == true,
      applyLabel: json['apply_label']?.toString() ?? 'Apply Now',
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
