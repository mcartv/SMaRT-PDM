import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/intake_form_ui.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

class StepAcademic extends StatefulWidget {
  const StepAcademic({
    super.key,
    required this.data,
    required this.onChanged,
    this.onRepairCourse,
    this.showErrors = false,
  });

  final ApplicationData data;
  final VoidCallback onChanged;
  final Future<void> Function()? onRepairCourse;
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
  late final TextEditingController financialSupportOtherController;
  late final TextEditingController scholarshipOthersSpecifyController;
  late final TextEditingController disciplinaryExplanationController;

  final List<String> supportOptions = [
    'Parents',
    'Scholarship',
    'Loan',
    'Other',
  ];
  static const List<String> _defaultSectionOptions = ['A', 'B', 'C', 'D'];
  static const List<String> _yearLevelOptions = ['1', '2', '3', '4'];
  static const int _collegeMinimumGraduationYear = 2026;
  static const String _defaultCollegeSchool =
      'Pambayang Dalubhasaan ng Marilao';
  static const String _defaultCollegeAddress =
      'Abangan, Norte, Marilao, Bulacan';

  final Set<String> selectedFinancialSupports = <String>{};
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

  @override
  void initState() {
    super.initState();

    final initialCollegeSchool = widget.data.collegeSchool.trim();
    final initialCollegeAddress = widget.data.collegeAddress.trim();
    final shouldDefaultCollegeSchool = initialCollegeSchool.isEmpty;
    final shouldDefaultCollegeAddress = initialCollegeAddress.isEmpty;

    collegeSchoolController = TextEditingController(
      text: shouldDefaultCollegeSchool
          ? _defaultCollegeSchool
          : widget.data.collegeSchool,
    );
    collegeAddressController = TextEditingController(
      text: shouldDefaultCollegeAddress
          ? _defaultCollegeAddress
          : widget.data.collegeAddress,
    );
    if (shouldDefaultCollegeSchool) {
      widget.data.collegeSchool = _defaultCollegeSchool;
    }
    if (shouldDefaultCollegeAddress) {
      widget.data.collegeAddress = _defaultCollegeAddress;
    }

    collegeHonorsController = TextEditingController(
      text: widget.data.collegeHonors,
    );
    collegeClubController = TextEditingController(
      text: widget.data.collegeClub,
    );
    final initialCollegeYear = widget.data.collegeYearGraduated.trim();
    collegeYearController = TextEditingController(
      text: initialCollegeYear.isEmpty ? 'On Going' : initialCollegeYear,
    );
    if (initialCollegeYear.isEmpty) {
      widget.data.collegeYearGraduated = 'On Going';
    }
    if (shouldDefaultCollegeSchool ||
        shouldDefaultCollegeAddress ||
        initialCollegeYear.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        widget.onChanged();
      });
    }
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
    financialSupportOtherController = TextEditingController(
      text: widget.data.financialSupportOtherSpecify,
    );
    scholarshipOthersSpecifyController = TextEditingController(
      text: widget.data.scholarshipOthersSpecify,
    );
    disciplinaryExplanationController = TextEditingController(
      text: widget.data.disciplinaryExplanation,
    );

    final normalizedCourse = widget.data.currentCourse.trim();
    selectedCourse = normalizedCourse.isNotEmpty ? normalizedCourse : null;

    if (selectedCourse != null && widget.data.currentCourse != selectedCourse) {
      widget.data.currentCourse = selectedCourse!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.onChanged();
      });
    }
    selectedYearLevel = _yearLevelOptions.contains(widget.data.currentYearLevel)
        ? widget.data.currentYearLevel
        : null;
    final normalizedSection = widget.data.currentSection.trim().toUpperCase();
    sectionOptions = List<String>.from(_defaultSectionOptions);
    selectedSection = sectionOptions.contains(normalizedSection)
        ? normalizedSection
        : null;
    widget.data.currentSection = selectedSection ?? '';
    selectedFinancialSupports.addAll(
      widget.data.financialSupport
          .split(',')
          .map((value) => value.trim())
          .where(supportOptions.contains),
    );
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
      financialSupportOtherController,
      (value) => widget.data.financialSupportOtherSpecify = value,
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

  @override
  void didUpdateWidget(covariant StepAcademic oldWidget) {
    super.didUpdateWidget(oldWidget);
    final normalizedCourse = widget.data.currentCourse.trim();
    selectedCourse = normalizedCourse.isEmpty ? null : normalizedCourse;
  }

  InputDecoration _dec(String hint, {String? errorText, Widget? suffixIcon}) {
    return intakeInputDecoration(
      context,
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

  String? _academicTextError(TextEditingController controller, String label) {
    if (!widget.showErrors || controller.text.trim().isNotEmpty) return null;
    return '$label is required.';
  }

  List<String> _academicYearOptions(String title) {
    if (title == 'College') {
      final lastYear = DateTime.now().year + 10;
      return <String>[
        'On Going',
        for (int year = _collegeMinimumGraduationYear; year <= lastYear; year++)
          year.toString(),
      ];
    }

    return List<String>.generate(
      DateTime.now().year - 1949,
      (index) => (DateTime.now().year - index).toString(),
    );
  }

  bool _isValidAcademicYear(String title, String value) {
    final normalized = value.trim();
    if (normalized.isEmpty) return false;
    if (title != 'College') return _academicYearOptions(title).contains(normalized);
    if (normalized == 'On Going') return true;
    final year = int.tryParse(normalized);
    return year != null && year >= _collegeMinimumGraduationYear;
  }

  String? _academicYearError(String title, TextEditingController controller) {
    if (!widget.showErrors) return null;
    final value = controller.text.trim();
    if (value.isEmpty) {
      return title == 'College'
          ? 'College year graduated or status is required.'
          : 'Year graduated is required.';
    }
    if (title == 'College' && !_isValidAcademicYear(title, value)) {
      return 'Select On Going or a graduation year of 2026 or later.';
    }
    return null;
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
    if (!widget.showErrors || !selectedFinancialSupports.contains('Other'))
      return null;
    return financialSupportOtherController.text.trim().isEmpty
        ? 'Please specify the other financial support.'
        : null;
  }

  String? _scholarshipOtherError() {
    if (!widget.showErrors || !scholarshipHistory || !scholarshipOthers) {
      return null;
    }
    return scholarshipOthersSpecifyController.text.trim().isEmpty
        ? 'Please specify the other scholarship history.'
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
            '$title *',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: intakeTextColor(context),
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 16),
          _field(
            'School *',
            TextFormField(
              controller: school,
              decoration: _dec(
                'School',
                errorText: _academicTextError(school, 'School'),
                suffixIcon: intakeCompletionIcon(school.text),
              ),
            ),
          ),
          const SizedBox(height: 16),
          _field(
            'Address *',
            TextFormField(
              controller: address,
              decoration: _dec(
                'Address',
                errorText: _academicTextError(address, 'Address'),
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
                    ? 'Year Graduated / Status *'
                    : 'Year Graduated *',
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: _academicYearOptions(title).contains(
                    year.text.trim(),
                  )
                      ? year.text.trim()
                      : null,
                  decoration: _dec(
                    title == 'College'
                        ? 'Select On Going or year'
                        : 'Select year',
                    errorText: _academicYearError(title, year),
                    suffixIcon: intakeCompletionIcon(
                      _isValidAcademicYear(title, year.text) ? year.text : '',
                    ),
                  ),
                  items: _academicYearOptions(title)
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text(value),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() {
                      year.text = value ?? '';
                    });
                    widget.onChanged();
                  },
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
    final selected = selectedFinancialSupports.contains(option);
    return CheckboxListTile(
      contentPadding: EdgeInsets.zero,
      controlAffinity: ListTileControlAffinity.leading,
      title: Text(
        option,
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
          color: intakeTextColor(context),
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
        ),
      ),
      value: selected,
      onChanged: (value) {
        setState(() {
          if (value == true) {
            selectedFinancialSupports.add(option);
          } else {
            selectedFinancialSupports.remove(option);
          }
          widget.data.financialSupport = selectedFinancialSupports.join(', ');
          if (!selectedFinancialSupports.contains('Other')) {
            financialSupportOtherController.clear();
            widget.data.financialSupportOtherSpecify = '';
          }
        });
        widget.onChanged();
      },
    );
  }

  Widget _binaryQuestion({
    required String title,
    required bool value,
    required bool answered,
    required ValueChanged<bool> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: intakeTextColor(context),
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 10),
        SegmentedButton<bool>(
          segments: const [
            ButtonSegment<bool>(value: true, label: Text('Yes')),
            ButtonSegment<bool>(value: false, label: Text('No')),
          ],
          emptySelectionAllowed: true,
          selected: answered ? {value} : <bool>{},
          onSelectionChanged: (selection) {
            if (selection.isNotEmpty) onChanged(selection.first);
          },
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
    financialSupportOtherController.dispose();
    scholarshipOthersSpecifyController.dispose();
    disciplinaryExplanationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isOtherSupport = selectedFinancialSupports.contains('Other');

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
          title: 'Junior High School',
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
                  color: intakeTextColor(context),
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 16),
              _field(
                'Course *',
                TextFormField(
                  key: ValueKey(selectedCourse ?? ''),
                  initialValue: selectedCourse ?? '',
                  readOnly: true,
                  decoration: _dec('Course', errorText: _courseError()),
                ),
              ),
              if ((selectedCourse ?? '').trim().isEmpty) ...[
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: intakeIsDark(context)
                        ? AppColors.applicantDarkSurfaceMuted
                        : const Color(0xFFFFF6E5),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: intakeIsDark(context)
                          ? AppColors.applicantDarkOutline
                          : const Color(0xFFE6C978),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.info_outline,
                        size: 20,
                        color: intakeTextColor(context),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Your course comes from your account profile. Update your profile before continuing.',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: intakeTextColor(context),
                            height: 1.35,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      if (widget.onRepairCourse != null) ...[
                        const SizedBox(width: 8),
                        TextButton(
                          onPressed: () async {
                            await widget.onRepairCourse!();
                          },
                          child: const Text('Update Profile'),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
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
                  color: intakeTextColor(context),
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
                    controller: financialSupportOtherController,
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
                  color: intakeTextColor(context),
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              _binaryQuestion(
                title: 'Have you ever been a scholar?',
                value: scholarshipHistory,
                answered: widget.data.scholarshipHistoryAnswered,
                onChanged: (value) {
                  setState(() {
                    scholarshipHistory = value;
                    widget.data.scholarshipHistory = value;
                    widget.data.scholarshipHistoryAnswered = true;
                    if (!value) {
                      scholarshipElementary = false;
                      scholarshipHighSchool = false;
                      scholarshipCollege = false;
                      scholarshipOthers = false;
                      widget.data.scholarshipElementary = false;
                      widget.data.scholarshipHighSchool = false;
                      widget.data.scholarshipCollege = false;
                      widget.data.scholarshipOthers = false;
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
                  title: const Text('Junior High School'),
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
                      decoration: _dec(
                        'Specify',
                        errorText: _scholarshipOtherError(),
                      ),
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
                  color: intakeTextColor(context),
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              _binaryQuestion(
                title:
                    'Have you ever been subject to disciplinary action from any school or institution attended?',
                value: disciplinaryAction,
                answered: widget.data.disciplinaryActionAnswered,
                onChanged: (value) {
                  setState(() {
                    disciplinaryAction = value;
                    widget.data.disciplinaryAction = value;
                    widget.data.disciplinaryActionAnswered = true;
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
