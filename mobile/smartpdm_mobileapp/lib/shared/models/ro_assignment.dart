class RoAssignment {
  const RoAssignment({
    required this.id,
    required this.scholarId,
    required this.studentId,
    required this.title,
    required this.department,
    required this.supervisor,
    required this.startDate,
    required this.endDate,
    required this.requiredHours,
    required this.hoursLogged,
    required this.status,
    required this.description,
    required this.proofUrl,
    required this.submittedAt,
    required this.verifiedAt,
    required this.rejectionReason,
    required this.isCarryOver,
    required this.previousSemester,
    required this.studentName,
    required this.studentNumber,
    required this.programName,
    required this.avatarUrl,
  });

  final String id;
  final String scholarId;
  final String studentId;
  final String title;
  final String department;
  final String supervisor;
  final String startDate;
  final String endDate;
  final int requiredHours;
  final int hoursLogged;
  final String status;
  final String description;
  final String proofUrl;
  final String submittedAt;
  final String verifiedAt;
  final String rejectionReason;
  final bool isCarryOver;
  final String previousSemester;
  final String studentName;
  final String studentNumber;
  final String programName;
  final String avatarUrl;

  bool get isVerified => status.toLowerCase() == 'verified';
  bool get isRejected => status.toLowerCase() == 'rejected';
  bool get isOverdue => status.toLowerCase() == 'overdue';
  bool get hasProof => proofUrl.trim().isNotEmpty;

  factory RoAssignment.fromJson(Map<String, dynamic> json) {
    final student = (json['student'] as Map?)?.cast<String, dynamic>() ?? const {};

    return RoAssignment(
      id: json['id']?.toString() ?? '',
      scholarId: json['scholarId']?.toString() ?? '',
      studentId: json['studentId']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Research Opportunity Assignment',
      department: json['department']?.toString() ?? 'Unassigned',
      supervisor: json['supervisor']?.toString() ?? 'OSFA / Scholarship Office',
      startDate: json['startDate']?.toString() ?? '',
      endDate: json['endDate']?.toString() ?? '',
      requiredHours: int.tryParse('${json['requiredHours'] ?? 0}') ?? 0,
      hoursLogged: int.tryParse('${json['hoursLogged'] ?? 0}') ?? 0,
      status: json['status']?.toString() ?? 'Pending',
      description: json['description']?.toString() ?? '',
      proofUrl: json['proofUrl']?.toString() ?? '',
      submittedAt: json['submittedAt']?.toString() ?? '',
      verifiedAt: json['verifiedAt']?.toString() ?? '',
      rejectionReason: json['rejectionReason']?.toString() ?? '',
      isCarryOver: json['isCarryOver'] == true,
      previousSemester: json['previousSemester']?.toString() ?? '',
      studentName: student['name']?.toString() ?? '',
      studentNumber: student['studentNumber']?.toString() ?? '',
      programName: student['program']?.toString() ?? '',
      avatarUrl: student['avatarUrl']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toRouteArgs() {
    return {
      'id': id,
      'scholarId': scholarId,
      'studentId': studentId,
      'title': title,
      'department': department,
      'supervisor': supervisor,
      'startDate': startDate,
      'endDate': endDate,
      'requiredHours': requiredHours,
      'hoursLogged': hoursLogged,
      'status': status,
      'description': description,
      'proofUrl': proofUrl,
      'submittedAt': submittedAt,
      'verifiedAt': verifiedAt,
      'rejectionReason': rejectionReason,
      'isCarryOver': isCarryOver,
      'previousSemester': previousSemester,
      'student': {
        'name': studentName,
        'studentNumber': studentNumber,
        'program': programName,
        'avatarUrl': avatarUrl,
      },
    };
  }
}

class RoSettingSummary {
  const RoSettingSummary({
    required this.requiredHours,
    required this.allowCarryOver,
    required this.termLabel,
    required this.remarks,
  });

  final int requiredHours;
  final bool allowCarryOver;
  final String termLabel;
  final String remarks;

  factory RoSettingSummary.fromJson(Map<String, dynamic> json) {
    final academicYear = (json['academic_years'] as Map?)?.cast<String, dynamic>();
    final academicPeriod = (json['academic_period'] as Map?)?.cast<String, dynamic>();

    final yearLabel =
        academicYear?['label']?.toString() ??
        [
          academicYear?['start_year']?.toString(),
          academicYear?['end_year']?.toString(),
        ].where((part) => part != null && part.isNotEmpty).join('-');

    final term = academicPeriod?['term']?.toString() ?? '';
    final termLabel = [term, yearLabel].where((part) => part.isNotEmpty).join(' · ');

    return RoSettingSummary(
      requiredHours: int.tryParse('${json['required_hours'] ?? 20}') ?? 20,
      allowCarryOver: json['allow_carry_over'] != false,
      termLabel: termLabel.isNotEmpty ? termLabel : 'Active RO Requirement',
      remarks: json['remarks']?.toString() ?? '',
    );
  }
}

class RoAssignmentsPackage {
  const RoAssignmentsPackage({
    required this.setting,
    required this.items,
  });

  final RoSettingSummary setting;
  final List<RoAssignment> items;

  factory RoAssignmentsPackage.fromJson(Map<String, dynamic> json) {
    final rawItems = (json['items'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((item) => RoAssignment.fromJson(Map<String, dynamic>.from(item)))
        .toList();

    final rawSetting = json['setting'] is Map<String, dynamic>
        ? json['setting'] as Map<String, dynamic>
        : Map<String, dynamic>.from(json['setting'] as Map? ?? const {});

    return RoAssignmentsPackage(
      setting: RoSettingSummary.fromJson(rawSetting),
      items: rawItems,
    );
  }
}
