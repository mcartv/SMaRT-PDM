import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/intake_form_ui.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

class StepAcademic extends StatefulWidget {
  const StepAcademic({
    super.key,
    required this.data,
    required this.onChanged,
    this.showErrors = false,
  });

  final ApplicationData data;
  final VoidCallback onChanged;
  final bool showErrors;

  @override
  State<StepAcademic> createState() => _StepAcademicState();
}

class _StepAcademicState extends State<StepAcademic> {
  late final TextEditingController collegeSchoolController;
  late final TextEditingController collegeAddressController;
  late final TextEditingController collegeHonorsController;
  late final TextEditingController collegeClubController;
  late final TextEditingController collegeYearController;
  late final TextEditingController highSchoolSchoolController;
  late final TextEditingController highSchoolAddressController;
  late final TextEditingController highSchoolHonorsController;
  late final TextEditingController highSchoolClubController;
  late final TextEditingController highSchoolYearController;
  late final TextEditingController seniorHighSchoolController;
  late final TextEditingController seniorHighAddressController;
  late final TextEditingController seniorHighHonorsController;
  late final TextEditingController seniorHighClubController;
  late final TextEditingController seniorHighYearController;
  late final TextEditingController elementarySchoolController;
  late final TextEditingController elementaryAddressController;
  late final TextEditingController elementaryHonorsController;
  late final TextEditingController elementaryClubController;
  late final TextEditingController elementaryYearController;
  late final TextEditingController studentNumberController;
  late final TextEditingController scholarshipDetailsController;
  late final TextEditingController scholarshipOthersSpecifyController;
  late final TextEditingController disciplinaryExplanationController;

  final List<String> supportOptions = [
    'Parents',
    'Scholarship',
    'Loan',
    'Other',
  ];
  static const List<String> _defaultCourseOptions = [
    'BSTM',
    'BSOAD',
    'BECED',
    'BSCS',
    'BSIT',
    'BSHM',
    'BTLED',
  ];

  late final List<String> courseOptions;
  static const List<String> _defaultSectionOptions = [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
  ];
  static const List<String> _yearLevelOptions = ['1', '2', '3', '4'];

  String selectedFinancialSupport = 'Parents';
  String? selectedCourse;
  String? selectedYearLevel;
  late final List<String> sectionOptions;
  String? selectedSection;
  bool scholarshipHistory = false;
  bool scholarshipElementary = false;
  bool scholarshipHighSchool = false;
  bool scholarshipCollege = false;
  bool scholarshipOthers = false;
  bool disciplinaryAction = false;

  String _normalizeCourseValue(String value) {
    final raw = value.trim();
    if (raw.isEmpty) return '';

    final normalized = raw
        .toUpperCase()
        .replaceAll(RegExp(r'[^A-Z0-9]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    const aliases = <String, String>{
      'BACHELOR OF SCIENCE IN TOURISM MANAGEMENT': 'BSTM',
      'TOURISM MANAGEMENT': 'BSTM',
      'BACHELOR OF SCIENCE IN OFFICE ADMINISTRATION': 'BSOAD',
      'OFFICE ADMINISTRATION': 'BSOAD',
      'BACHELOR OF EARLY CHILDHOOD EDUCATION': 'BECED',
      'EARLY CHILDHOOD EDUCATION': 'BECED',
      'BACHELOR OF SCIENCE IN COMPUTER SCIENCE': 'BSCS',
      'COMPUTER SCIENCE': 'BSCS',
      'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY': 'BSIT',
      'INFORMATION TECHNOLOGY': 'BSIT',
      'BACHELOR OF SCIENCE IN HOSPITALITY MANAGEMENT': 'BSHM',
      'HOSPITALITY MANAGEMENT': 'BSHM',
      'BACHELOR OF TECHNOLOGY AND LIVELIHOOD EDUCATION': 'BTLED',
      'TECHNOLOGY AND LIVELIHOOD EDUCATION': 'BTLED',
    };

    if (_defaultCourseOptions.contains(normalized)) {
      return normalized;
    }

    return aliases[normalized] ?? raw;
  }

  @override
  void initState() {
    super.initState();

    collegeSchoolController = TextEditingController(
      text: widget.data.collegeSchool,
    );
    collegeAddressController = TextEditingController(
      text: widget.data.collegeAddress,
    );
    collegeHonorsController = TextEditingController(
      text: widget.data.collegeHonors,
    );
    collegeClubController = TextEditingController(
      text: widget.data.collegeClub,
    );
    collegeYearController = TextEditingController(
      text: widget.data.collegeYearGraduated,
    );
    highSchoolSchoolController = TextEditingController(
      text: widget.data.highSchoolSchool,
    );
    highSchoolAddressController = TextEditingController(
      text: widget.data.highSchoolAddress,
    );
    highSchoolHonorsController = TextEditingController(
      text: widget.data.highSchoolHonors,
    );
    highSchoolClubController = TextEditingController(
      text: widget.data.highSchoolClub,
    );
    highSchoolYearController = TextEditingController(
      text: widget.data.highSchoolYearGraduated,
    );
    seniorHighSchoolController = TextEditingController(
      text: widget.data.seniorHighSchool,
    );
    seniorHighAddressController = TextEditingController(
      text: widget.data.seniorHighAddress,
    );
    seniorHighHonorsController = TextEditingController(
      text: widget.data.seniorHighHonors,
    );
    seniorHighClubController = TextEditingController(
      text: widget.data.seniorHighClub,
    );
    seniorHighYearController = TextEditingController(
      text: widget.data.seniorHighYearGraduated,
    );
    elementarySchoolController = TextEditingController(
      text: widget.data.elementarySchool,
    );
    elementaryAddressController = TextEditingController(
      text: widget.data.elementaryAddress,
    );
    elementaryHonorsController = TextEditingController(
      text: widget.data.elementaryHonors,
    );
    elementaryClubController = TextEditingController(
      text: widget.data.elementaryClub,
    );
    elementaryYearController = TextEditingController(
      text: widget.data.elementaryYearGraduated,
    );
    studentNumberController = TextEditingController(
      text: widget.data.studentNumber.isNotEmpty
          ? widget.data.studentNumber
          : widget.data.accountStudentId,
    );
    scholarshipDetailsController = TextEditingController(
      text: widget.data.scholarshipDetails,
    );
    scholarshipOthersSpecifyController = TextEditingController(
      text: widget.data.scholarshipOthersSpecify,
    );
    disciplinaryExplanationController = TextEditingController(
      text: widget.data.disciplinaryExplanation,
    );

    final normalizedCourse = _normalizeCourseValue(widget.data.currentCourse);
    final uniqueCourses = <String>{
      ..._defaultCourseOptions,
      if (normalizedCourse.isNotEmpty) normalizedCourse,
    };
    courseOptions = uniqueCourses.toList();

    selectedCourse = normalizedCourse.isNotEmpty ? normalizedCourse : null;

    if (selectedCourse != null &&
        widget.data.currentCourse != selectedCourse) {
      widget.data.currentCourse = selectedCourse!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.onChanged();
      });
    }
    selectedYearLevel = _yearLevelOptions.contains(widget.data.currentYearLevel)
        ? widget.data.currentYearLevel
        : null;
    final normalizedSection = widget.data.currentSection.trim();
    final uniqueSections = <String>{
      ..._defaultSectionOptions,
      if (normalizedSection.isNotEmpty) normalizedSection,
    };
    sectionOptions = uniqueSections.toList()..sort();
    selectedSection = sectionOptions.contains(normalizedSection)
        ? normalizedSection
        : null;
    selectedFinancialSupport = widget.data.financialSupport.isNotEmpty
        ? widget.data.financialSupport
        : supportOptions.first;
    scholarshipHistory = widget.data.scholarshipHistory;
    scholarshipElementary = widget.data.scholarshipElementary;
    scholarshipHighSchool = widget.data.scholarshipHighSchool;
    scholarshipCollege = widget.data.scholarshipCollege;
    scholarshipOthers = widget.data.scholarshipOthers;
    disciplinaryAction = widget.data.disciplinaryAction;

    _bind(
      collegeSchoolController,
      (value) => widget.data.collegeSchool = value,
    );
    _bind(
      collegeAddressController,
      (value) => widget.data.collegeAddress = value,
    );
    _bind(
      collegeHonorsController,
      (value) => widget.data.collegeHonors = value,
    );
    _bind(collegeClubController, (value) => widget.data.collegeClub = value);
    _bind(
      collegeYearController,
      (value) => widget.data.collegeYearGraduated = value,
    );
    _bind(
      highSchoolSchoolController,
      (value) => widget.data.highSchoolSchool = value,
    );
    _bind(
      highSchoolAddressController,
      (value) => widget.data.highSchoolAddress = value,
    );
    _bind(
      highSchoolHonorsController,
      (value) => widget.data.highSchoolHonors = value,
    );
    _bind(
      highSchoolClubController,
      (value) => widget.data.highSchoolClub = value,
    );
    _bind(
      highSchoolYearController,
      (value) => widget.data.highSchoolYearGraduated = value,
    );
    _bind(
      seniorHighSchoolController,
      (value) => widget.data.seniorHighSchool = value,
    );
    _bind(
      seniorHighAddressController,
      (value) => widget.data.seniorHighAddress = value,
    );
    _bind(
      seniorHighHonorsController,
      (value) => widget.data.seniorHighHonors = value,
    );
    _bind(
      seniorHighClubController,
      (value) => widget.data.seniorHighClub = value,
    );
    _bind(
      seniorHighYearController,
      (value) => widget.data.seniorHighYearGraduated = value,
    );
    _bind(
      elementarySchoolController,
      (value) => widget.data.elementarySchool = value,
    );
    _bind(
      elementaryAddressController,
      (value) => widget.data.elementaryAddress = value,
    );
    _bind(
      elementaryHonorsController,
      (value) => widget.data.elementaryHonors = value,
    );
    _bind(
      elementaryClubController,
      (value) => widget.data.elementaryClub = value,
    );
    _bind(
      elementaryYearController,
      (value) => widget.data.elementaryYearGraduated = value,
    );
    _bind(
      studentNumberController,
      (value) => widget.data.studentNumber = value,
    );
    _bind(
      scholarshipDetailsController,
      (value) => widget.data.scholarshipDetails = value,
    );
    _bind(
      scholarshipOthersSpecifyController,
      (value) => widget.data.scholarshipOthersSpecify = value,
    );
    _bind(
      disciplinaryExplanationController,
      (value) => widget.data.disciplinaryExplanation = value,
    );
  }

  void _bind(TextEditingController controller, void Function(String) setter) {
    controller.addListener(() {
      setter(controller.text);
      widget.onChanged();
    });
  }

  InputDecoration _dec(String hint, {String? errorText, Widget? suffixIcon}) {
    return intakeInputDecoration(
      hint: hint,
      errorText: errorText,
      suffixIcon: suffixIcon,
    );
  }

  Widget _field(String label, Widget child) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [intakeFieldLabel(context, label), child],
    );
  }

  Widget _flexRow(List<Widget> children, {required List<int> flexes}) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 520) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: children
                .asMap()
                .entries
                .map(
                  (entry) => Padding(
                    padding: EdgeInsets.only(
                      bottom: entry.key < children.length - 1 ? 16 : 0,
                    ),
                    child: entry.value,
                  ),
                )
                .toList(),
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: children.asMap().entries.map((entry) {
            final index = entry.key;
            return Expanded(
              flex: flexes[index],
              child: Padding(
                padding: EdgeInsets.only(
                  right: index < children.length - 1 ? 16 : 0,
                ),
                child: entry.value,
              ),
            );
          }).toList(),
        );
      },
    );
  }

  String? _courseError() {
    if (!widget.showErrors) return null;
    return (selectedCourse ?? '').trim().isEmpty ? 'Course is required.' : null;
  }

  String? _yearLevelError() {
    if (!widget.showErrors) return null;
    final value = (selectedYearLevel ?? '').trim();
    if (value.isEmpty) return 'Year level is required.';
    return _yearLevelOptions.contains(value)
        ? null
        : 'Year level must be 1, 2, 3, or 4.';
  }

  String? _studentNumberError() {
    if (!widget.showErrors) return null;
    final studentNumber = studentNumberController.text.trim();
    if (studentNumber.isEmpty) return 'Student number is required.';
    if (widget.data.accountStudentId.isNotEmpty &&
        studentNumber != widget.data.accountStudentId) {
      return 'Student number must match your logged-in account.';
    }
    return null;
  }

  String? _otherSupportError() {
    if (!widget.showErrors || selectedFinancialSupport != 'Other') return null;
    return scholarshipOthersSpecifyController.text.trim().isEmpty
        ? 'Please specify the other financial support.'
        : null;
  }

  String? _scholarshipHistoryError() {
    if (!widget.showErrors || !scholarshipHistory) return null;
    final hasSelection =
        scholarshipElementary ||
        scholarshipHighSchool ||
        scholarshipCollege ||
        scholarshipOthers;
    return hasSelection
        ? null
        : 'Select at least one scholarship history option.';
  }

  Widget _educationCard({
    required String title,
    required TextEditingController school,
    required TextEditingController address,
    required TextEditingController honors,
    required TextEditingController club,
    required TextEditingController year,
  }) {
    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: IntakePalette.text,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 16),
          _field(
            'School',
            TextFormField(
              controller: school,
              decoration: _dec(
                'School',
                suffixIcon: intakeCompletionIcon(school.text),
              ),
            ),
          ),
          const SizedBox(height: 16),
          _field(
            'Address',
            TextFormField(
              controller: address,
              decoration: _dec(
                'Address',
                suffixIcon: intakeCompletionIcon(address.text),
              ),
            ),
          ),
          const SizedBox(height: 16),
          _flexRow(
            [
              _field(
                'Honors / Awards',
                TextFormField(
                  controller: honors,
                  decoration: _dec(
                    'Honors / Awards',
                    suffixIcon: intakeCompletionIcon(honors.text),
                  ),
                ),
              ),
              _field(
                'Club / Org',
                TextFormField(
                  controller: club,
                  decoration: _dec(
                    'Club / Org',
                    suffixIcon: intakeCompletionIcon(club.text),
                  ),
                ),
              ),
              _field(
                title == 'College'
                    ? 'Year Graduated (if completed)'
                    : 'Year Graduated',
                TextFormField(
                  controller: year,
                  keyboardType: TextInputType.number,
                  decoration: _dec(
                    title == 'College' ? 'Optional' : 'YYYY',
                    suffixIcon: intakeCompletionIcon(year.text),
                  ),
                ),
              ),
            ],
            flexes: const [3, 3, 2],
          ),
        ],
      ),
    );
  }

  Widget _supportChoice(String option) {
    final selected = selectedFinancialSupport == option;
    return InkWell(
      onTap: () {
        setState(() {
          selectedFinancialSupport = option;
          widget.data.financialSupport = option;
          if (option != 'Other') {
            scholarshipOthersSpecifyController.clear();
            widget.data.scholarshipOthersSpecify = '';
          }
        });
        widget.onChanged();
      },
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Checkbox(value: selected, onChanged: (_) {}),
            Text(
              option,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: IntakePalette.text,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _binaryQuestion({
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: IntakePalette.text,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 10),
        SegmentedButton<bool>(
          segments: const [
            ButtonSegment<bool>(value: true, label: Text('Yes')),
            ButtonSegment<bool>(value: false, label: Text('No')),
          ],
          selected: {value},
          onSelectionChanged: (selection) => onChanged(selection.first),
        ),
      ],
    );
  }

  @override
  void dispose() {
    collegeSchoolController.dispose();
    collegeAddressController.dispose();
    collegeHonorsController.dispose();
    collegeClubController.dispose();
    collegeYearController.dispose();
    highSchoolSchoolController.dispose();
    highSchoolAddressController.dispose();
    highSchoolHonorsController.dispose();
    highSchoolClubController.dispose();
    highSchoolYearController.dispose();
    seniorHighSchoolController.dispose();
    seniorHighAddressController.dispose();
    seniorHighHonorsController.dispose();
    seniorHighClubController.dispose();
    seniorHighYearController.dispose();
    elementarySchoolController.dispose();
    elementaryAddressController.dispose();
    elementaryHonorsController.dispose();
    elementaryClubController.dispose();
    elementaryYearController.dispose();
    studentNumberController.dispose();
    scholarshipDetailsController.dispose();
    scholarshipOthersSpecifyController.dispose();
    disciplinaryExplanationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isOtherSupport = selectedFinancialSupport == 'Other';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IntakeSectionHeader(
          title: 'ACADEMIC BACKGROUND',
          icon: Icons.school,
        ),
        _educationCard(
          title: 'College',
          school: collegeSchoolController,
          address: collegeAddressController,
          honors: collegeHonorsController,
          club: collegeClubController,
          year: collegeYearController,
        ),
        _educationCard(
          title: 'High School',
          school: highSchoolSchoolController,
          address: highSchoolAddressController,
          honors: highSchoolHonorsController,
          club: highSchoolClubController,
          year: highSchoolYearController,
        ),
        _educationCard(
          title: 'Senior High School',
          school: seniorHighSchoolController,
          address: seniorHighAddressController,
          honors: seniorHighHonorsController,
          club: seniorHighClubController,
          year: seniorHighYearController,
        ),
        _educationCard(
          title: 'Elementary',
          school: elementarySchoolController,
          address: elementaryAddressController,
          honors: elementaryHonorsController,
          club: elementaryClubController,
          year: elementaryYearController,
        ),
        IntakeCard(
          margin: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Current Enrollment',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: IntakePalette.text,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 16),
              _field(
                'Course *',
                DropdownButtonFormField<String>(
                  initialValue: selectedCourse,
                  decoration: _dec('Course', errorText: _courseError()),
                  items: courseOptions
                      .map(
                        (item) =>
                            DropdownMenuItem(value: item, child: Text(item)),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() => selectedCourse = value);
                    widget.data.currentCourse = value ?? '';
                    widget.onChanged();
                  },
                ),
              ),
              const SizedBox(height: 16),
              _flexRow(
                [
                  _field(
                    'Year Level *',
                    DropdownButtonFormField<String>(
                      initialValue: selectedYearLevel,
                      decoration: _dec(
                        'Year Level',
                        errorText: _yearLevelError(),
                      ),
                      items: _yearLevelOptions
                          .map(
                            (item) => DropdownMenuItem(
                              value: item,
                              child: Text(item),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        setState(() => selectedYearLevel = value);
                        widget.data.currentYearLevel = value ?? '';
                        widget.onChanged();
                      },
                    ),
                  ),
                  _field(
                    'Section',
                    DropdownButtonFormField<String>(
                      initialValue: selectedSection,
                      decoration: _dec('Section'),
                      items: sectionOptions
                          .map(
                            (item) => DropdownMenuItem(
                              value: item,
                              child: Text(item),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        setState(() => selectedSection = value);
                        widget.data.currentSection = value ?? '';
                        widget.onChanged();
                      },
                    ),
                  ),
                  _field(
                    'Student Number *',
                    TextFormField(
                      controller: studentNumberController,
                      readOnly: true,
                      decoration: _dec(
                        'Student Number',
                        errorText: _studentNumberError(),
                        suffixIcon: intakeCompletionIcon(
                          studentNumberController.text,
                        ),
                      ),
                    ),
                  ),
                ],
                flexes: const [2, 2, 3],
              ),
            ],
          ),
        ),
        IntakeCard(
          margin: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Financial Support *',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: IntakePalette.text,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              ...supportOptions.map(_supportChoice),
              if (isOtherSupport) ...[
                const SizedBox(height: 8),
                _field(
                  'Specify',
                  TextFormField(
                    controller: scholarshipOthersSpecifyController,
                    decoration: _dec(
                      'Specify other financial support',
                      errorText: _otherSupportError(),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        IntakeCard(
          margin: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Scholarship History *',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: IntakePalette.text,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              _binaryQuestion(
                title: 'Have you ever been a scholar?',
                value: scholarshipHistory,
                onChanged: (value) {
                  setState(() {
                    scholarshipHistory = value;
                    widget.data.scholarshipHistory = value;
                    if (!value) {
                      scholarshipElementary = false;
                      scholarshipHighSchool = false;
                      scholarshipCollege = false;
                      scholarshipOthers = false;
                      scholarshipDetailsController.clear();
                      scholarshipOthersSpecifyController.clear();
                    }
                  });
                  widget.onChanged();
                },
              ),
              if (scholarshipHistory) ...[
                const SizedBox(height: 12),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Elementary'),
                  value: scholarshipElementary,
                  onChanged: (value) {
                    setState(() {
                      scholarshipElementary = value ?? false;
                      widget.data.scholarshipElementary = value ?? false;
                    });
                    widget.onChanged();
                  },
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('High School'),
                  value: scholarshipHighSchool,
                  onChanged: (value) {
                    setState(() {
                      scholarshipHighSchool = value ?? false;
                      widget.data.scholarshipHighSchool = value ?? false;
                    });
                    widget.onChanged();
                  },
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('College'),
                  value: scholarshipCollege,
                  onChanged: (value) {
                    setState(() {
                      scholarshipCollege = value ?? false;
                      widget.data.scholarshipCollege = value ?? false;
                    });
                    widget.onChanged();
                  },
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Others'),
                  value: scholarshipOthers,
                  onChanged: (value) {
                    setState(() {
                      scholarshipOthers = value ?? false;
                      widget.data.scholarshipOthers = value ?? false;
                      if (!(value ?? false)) {
                        scholarshipOthersSpecifyController.clear();
                        widget.data.scholarshipOthersSpecify = '';
                      }
                    });
                    widget.onChanged();
                  },
                ),
                if (scholarshipOthers) ...[
                  const SizedBox(height: 8),
                  _field(
                    'If Other, specify',
                    TextFormField(
                      controller: scholarshipOthersSpecifyController,
                      decoration: _dec('Specify'),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                _field(
                  'Please indicate details of scholarship such as name of school, course, year level, inclusive semester/s and school year/s and amount granted.',
                  TextFormField(
                    controller: scholarshipDetailsController,
                    maxLines: 4,
                    decoration: _dec('School, course, school year, amount'),
                  ),
                ),
                if (_scholarshipHistoryError() != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _scholarshipHistoryError()!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.redAccent,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ],
          ),
        ),
        IntakeCard(
          margin: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Disciplinary Action *',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: IntakePalette.text,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              _binaryQuestion(
                title:
                    'Have you ever been subject to disciplinary action from any school or institution attended?',
                value: disciplinaryAction,
                onChanged: (value) {
                  setState(() {
                    disciplinaryAction = value;
                    widget.data.disciplinaryAction = value;
                    if (!value) {
                      disciplinaryExplanationController.clear();
                      widget.data.disciplinaryExplanation = '';
                    }
                  });
                  widget.onChanged();
                },
              ),
              if (disciplinaryAction) ...[
                const SizedBox(height: 12),
                _field(
                  'Please explain briefly',
                  TextFormField(
                    controller: disciplinaryExplanationController,
                    maxLines: 4,
                    decoration: _dec('Explain the disciplinary action'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
