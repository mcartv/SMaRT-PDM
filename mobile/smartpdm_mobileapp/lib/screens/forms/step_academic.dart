import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';

class StepAcademic extends StatefulWidget {
  final ApplicationData data;
  final VoidCallback onChanged;
  final bool showErrors;
  const StepAcademic({
    super.key,
    required this.data,
    required this.onChanged,
    this.showErrors = false,
  });

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

  late final TextEditingController currentYearLevelController;
  late final TextEditingController currentSectionController;
  late final TextEditingController studentNumberController;
  late final TextEditingController lrnController;

  final List<String> supportOptions = [
    'Parents',
    'Scholarship',
    'Loan',
    'Other',
  ];
  final List<String> courseOptions = [
    'BSTM',
    'BSOAD',
    'BECED',
    'BSCS',
    'BSIT',
    'BSHM',
    'BTLED',
  ];

  String selectedFinancialSupport = 'Parents';
  String? selectedCourse;

  bool scholarshipHistory = false;
  bool scholarshipElementary = false;
  bool scholarshipHighSchool = false;
  bool scholarshipCollege = false;
  bool scholarshipOthers = false;

  late final TextEditingController scholarshipDetailsController;
  late final TextEditingController scholarshipOthersSpecifyController;
  bool disciplinaryAction = false;
  late final TextEditingController disciplinaryExplanationController;

  InputDecoration _dec(String placeholder) => InputDecoration(
    hintText: placeholder,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
  );

  Widget _field(String label, Widget child) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      ),
      const SizedBox(height: 8),
      child,
    ],
  );

  Widget _row(List<Widget> children) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 600) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: children
                .asMap()
                .entries
                .map(
                  (entry) => Padding(
                    padding: EdgeInsets.only(
                      bottom: entry.key < children.length - 1 ? 16.0 : 0,
                    ),
                    child: entry.value,
                  ),
                )
                .toList(),
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: children
              .asMap()
              .entries
              .map(
                (entry) => Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      right: entry.key < children.length - 1 ? 16.0 : 0,
                    ),
                    child: entry.value,
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }

  void _bind(TextEditingController c, void Function(String) setter) {
    c.addListener(() {
      setter(c.text);
      widget.onChanged();
    });
  }

  String? _yearLevelError() {
    if (!widget.showErrors) return null;
    final value = currentYearLevelController.text.trim();
    if (value.isEmpty) return 'Year level is required.';
    final parsed = int.tryParse(value);
    if (parsed == null) return 'Year level must be a valid number.';
    if (parsed < 1) return 'Year level must be at least 1.';
    if (parsed > 6) return 'Year level cannot be above 6.';
    return null;
  }

  String? _courseError() {
    if (!widget.showErrors) return null;
    if ((selectedCourse ?? '').trim().isEmpty) return 'Course is required.';
    return null;
  }

  String? _sectionError() {
    if (!widget.showErrors) return null;
    if (currentSectionController.text.trim().isEmpty) {
      return 'Section is required.';
    }
    return null;
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
    if (!widget.showErrors) return null;
    if (selectedFinancialSupport != 'Other') return null;
    if (scholarshipOthersSpecifyController.text.trim().isEmpty) {
      return 'Please specify the other financial support.';
    }
    return null;
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

    currentYearLevelController = TextEditingController(
      text: widget.data.currentYearLevel,
    );
    currentSectionController = TextEditingController(
      text: widget.data.currentSection,
    );
    studentNumberController = TextEditingController(
      text: widget.data.studentNumber.isNotEmpty
          ? widget.data.studentNumber
          : widget.data.accountStudentId,
    );
    lrnController = TextEditingController(text: widget.data.lrn);

    selectedCourse = courseOptions.contains(widget.data.currentCourse)
        ? widget.data.currentCourse
        : null;
    selectedFinancialSupport = widget.data.financialSupport.isNotEmpty
        ? widget.data.financialSupport
        : supportOptions[0];
    scholarshipHistory = widget.data.scholarshipHistory;
    scholarshipElementary = widget.data.scholarshipElementary;
    scholarshipHighSchool = widget.data.scholarshipHighSchool;
    scholarshipCollege = widget.data.scholarshipCollege;
    scholarshipOthers = widget.data.scholarshipOthers;

    scholarshipDetailsController = TextEditingController(
      text: widget.data.scholarshipDetails,
    );
    scholarshipOthersSpecifyController = TextEditingController(
      text: widget.data.scholarshipOthersSpecify,
    );
    disciplinaryAction = widget.data.disciplinaryAction;
    disciplinaryExplanationController = TextEditingController(
      text: widget.data.disciplinaryExplanation,
    );

    _bind(collegeSchoolController, (v) => widget.data.collegeSchool = v);
    _bind(collegeAddressController, (v) => widget.data.collegeAddress = v);
    _bind(collegeHonorsController, (v) => widget.data.collegeHonors = v);
    _bind(collegeClubController, (v) => widget.data.collegeClub = v);
    _bind(collegeYearController, (v) => widget.data.collegeYearGraduated = v);

    _bind(highSchoolSchoolController, (v) => widget.data.highSchoolSchool = v);
    _bind(
      highSchoolAddressController,
      (v) => widget.data.highSchoolAddress = v,
    );
    _bind(highSchoolHonorsController, (v) => widget.data.highSchoolHonors = v);
    _bind(highSchoolClubController, (v) => widget.data.highSchoolClub = v);
    _bind(
      highSchoolYearController,
      (v) => widget.data.highSchoolYearGraduated = v,
    );

    _bind(seniorHighSchoolController, (v) => widget.data.seniorHighSchool = v);
    _bind(
      seniorHighAddressController,
      (v) => widget.data.seniorHighAddress = v,
    );
    _bind(seniorHighHonorsController, (v) => widget.data.seniorHighHonors = v);
    _bind(seniorHighClubController, (v) => widget.data.seniorHighClub = v);
    _bind(
      seniorHighYearController,
      (v) => widget.data.seniorHighYearGraduated = v,
    );

    _bind(elementarySchoolController, (v) => widget.data.elementarySchool = v);
    _bind(
      elementaryAddressController,
      (v) => widget.data.elementaryAddress = v,
    );
    _bind(elementaryHonorsController, (v) => widget.data.elementaryHonors = v);
    _bind(elementaryClubController, (v) => widget.data.elementaryClub = v);
    _bind(
      elementaryYearController,
      (v) => widget.data.elementaryYearGraduated = v,
    );

    _bind(currentYearLevelController, (v) => widget.data.currentYearLevel = v);
    _bind(currentSectionController, (v) => widget.data.currentSection = v);
    _bind(studentNumberController, (v) => widget.data.studentNumber = v);
    _bind(lrnController, (v) => widget.data.lrn = v);
    _bind(
      scholarshipDetailsController,
      (v) => widget.data.scholarshipDetails = v,
    );
    _bind(
      scholarshipOthersSpecifyController,
      (v) => widget.data.scholarshipOthersSpecify = v,
    );
    _bind(
      disciplinaryExplanationController,
      (v) => widget.data.disciplinaryExplanation = v,
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
    currentYearLevelController.dispose();
    currentSectionController.dispose();
    studentNumberController.dispose();
    lrnController.dispose();
    scholarshipDetailsController.dispose();
    scholarshipOthersSpecifyController.dispose();
    disciplinaryExplanationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isOtherSupport = selectedFinancialSupport == 'Other';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('III. ACADEMIC INFORMATION', style: sectionTitle),
          const Divider(color: Colors.orange, thickness: 2),
          const SizedBox(height: 24),
          _section(
            'COLLEGE',
            collegeSchoolController,
            collegeAddressController,
            collegeHonorsController,
            collegeClubController,
            collegeYearController,
          ),
          _section(
            'HIGH SCHOOL',
            highSchoolSchoolController,
            highSchoolAddressController,
            highSchoolHonorsController,
            highSchoolClubController,
            highSchoolYearController,
          ),
          _section(
            'SENIOR HIGH SCHOOL',
            seniorHighSchoolController,
            seniorHighAddressController,
            seniorHighHonorsController,
            seniorHighClubController,
            seniorHighYearController,
          ),
          _section(
            'ELEMENTARY',
            elementarySchoolController,
            elementaryAddressController,
            elementaryHonorsController,
            elementaryClubController,
            elementaryYearController,
          ),
          const SizedBox(height: 8),
          const Text('CURRENT ENROLLMENT', style: sectionTitle),
          const SizedBox(height: 16),
          _row([
            _field(
              'Course',
              DropdownButtonFormField<String>(
                value: selectedCourse,
                decoration: _dec('Course').copyWith(errorText: _courseError()),
                items: courseOptions
                    .map(
                      (course) => DropdownMenuItem<String>(
                        value: course,
                        child: Text(course),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  setState(() => selectedCourse = value);
                  widget.data.currentCourse = value ?? '';
                  widget.onChanged();
                },
              ),
            ),
            _field(
              'Year Level',
              TextFormField(
                controller: currentYearLevelController,
                keyboardType: TextInputType.number,
                decoration: _dec(
                  'Year Level',
                ).copyWith(errorText: _yearLevelError()),
              ),
            ),
            _field(
              'Section',
              TextFormField(
                controller: currentSectionController,
                decoration: _dec(
                  'Section',
                ).copyWith(errorText: _sectionError()),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _row([
            _field(
              'Student Number',
              TextFormField(
                controller: studentNumberController,
                readOnly: widget.data.accountStudentId.isNotEmpty,
                decoration: _dec(
                  'Student Number',
                ).copyWith(errorText: _studentNumberError()),
              ),
            ),
            _field(
              'LRN',
              TextFormField(controller: lrnController, decoration: _dec('LRN')),
            ),
          ]),
          const SizedBox(height: 24),
          const Text('FINANCIAL SUPPORT', style: sectionTitle),
          const SizedBox(height: 8),
          ...supportOptions.map(
            (option) => CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: selectedFinancialSupport == option,
              title: Text(option),
              controlAffinity: ListTileControlAffinity.leading,
              onChanged: (checked) {
                setState(() {
                  if (checked ?? false) {
                    selectedFinancialSupport = option;
                    widget.data.financialSupport = option;
                  } else if (selectedFinancialSupport == option) {
                    selectedFinancialSupport = '';
                    widget.data.financialSupport = '';
                  }

                  if (option != 'Other' &&
                      selectedFinancialSupport != 'Other') {
                    scholarshipOthersSpecifyController.clear();
                    widget.data.scholarshipOthersSpecify = '';
                  }
                });
                widget.onChanged();
              },
            ),
          ),
          if (isOtherSupport) ...[
            const SizedBox(height: 12),
            _field(
              'Specify:',
              TextFormField(
                controller: scholarshipOthersSpecifyController,
                decoration: _dec(
                  'Specify...',
                ).copyWith(errorText: _otherSupportError()),
              ),
            ),
          ],
          const SizedBox(height: 24),
          const Text('SCHOLARSHIP HISTORY', style: sectionTitle),
          buildBooleanRow('Have you ever been a scholar?', scholarshipHistory, (
            val,
          ) {
            setState(() {
              scholarshipHistory = val;
              widget.data.scholarshipHistory = val;
              if (!val) {
                scholarshipElementary = false;
                widget.data.scholarshipElementary = false;
                scholarshipHighSchool = false;
                widget.data.scholarshipHighSchool = false;
                scholarshipCollege = false;
                widget.data.scholarshipCollege = false;
                scholarshipOthers = false;
                widget.data.scholarshipOthers = false;
                scholarshipOthersSpecifyController.clear();
                widget.data.scholarshipOthersSpecify = '';
                scholarshipDetailsController.clear();
                widget.data.scholarshipDetails = '';
              }
            });
            widget.onChanged();
          }),
          if (scholarshipHistory) ...[
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              children: [
                _buildCheck(
                  'Elementary',
                  scholarshipElementary,
                  (v) => setState(() {
                    scholarshipElementary = v;
                    widget.data.scholarshipElementary = v;
                    widget.onChanged();
                  }),
                ),
                _buildCheck(
                  'High School',
                  scholarshipHighSchool,
                  (v) => setState(() {
                    scholarshipHighSchool = v;
                    widget.data.scholarshipHighSchool = v;
                    widget.onChanged();
                  }),
                ),
                _buildCheck(
                  'College',
                  scholarshipCollege,
                  (v) => setState(() {
                    scholarshipCollege = v;
                    widget.data.scholarshipCollege = v;
                    widget.onChanged();
                  }),
                ),
                _buildCheck(
                  'Others',
                  scholarshipOthers,
                  (v) => setState(() {
                    scholarshipOthers = v;
                    widget.data.scholarshipOthers = v;
                    if (!v) {
                      scholarshipOthersSpecifyController.clear();
                      widget.data.scholarshipOthersSpecify = '';
                    }
                    widget.onChanged();
                  }),
                ),
              ],
            ),
            if (scholarshipOthers) ...[
              const SizedBox(height: 16),
              _field(
                'If Other, specify:',
                TextFormField(
                  controller: scholarshipOthersSpecifyController,
                  decoration: _dec('Specify...'),
                ),
              ),
            ],
            const SizedBox(height: 16),
            TextFormField(
              controller: scholarshipDetailsController,
              maxLines: 4,
              decoration: _dec('Details (School, Course, SY, Amount)'),
            ),
          ],
          const SizedBox(height: 24),
          const Text('DISCIPLINARY ACTION', style: sectionTitle),
          const SizedBox(height: 16),
          buildBooleanRow(
            'Have you ever been subject to disciplinary action from any school or institution attended?',
            disciplinaryAction,
            (val) {
              setState(() {
                disciplinaryAction = val;
                widget.data.disciplinaryAction = val;
                if (!val) {
                  disciplinaryExplanationController.clear();
                  widget.data.disciplinaryExplanation = '';
                }
              });
              widget.onChanged();
            },
          ),
          if (disciplinaryAction) ...[
            const SizedBox(height: 16),
            TextFormField(
              controller: disciplinaryExplanationController,
              maxLines: 4,
              decoration: _dec('Please explain briefly'),
            ),
          ],
        ],
      ),
    );
  }

  Widget buildBooleanRow(
    String label,
    bool value,
    ValueChanged<bool> onChanged,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
        ),
        Row(
          children: [
            Radio<bool>(
              value: true,
              groupValue: value,
              onChanged: (v) => onChanged(v ?? false),
            ),
            const SizedBox(width: 4),
            const Text('Yes'),
            const SizedBox(width: 16),
            Radio<bool>(
              value: false,
              groupValue: value,
              onChanged: (v) => onChanged(v ?? false),
            ),
            const SizedBox(width: 4),
            const Text('No'),
          ],
        ),
      ],
    );
  }

  Widget _buildCheck(String label, bool value, ValueChanged<bool> onChanged) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Checkbox(value: value, onChanged: (v) => onChanged(v ?? false)),
        Text(label),
      ],
    );
  }

  Widget _section(
    String title,
    TextEditingController school,
    TextEditingController address,
    TextEditingController honors,
    TextEditingController club,
    TextEditingController year,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: sectionTitle),
        const SizedBox(height: 16),
        _row([
          _field(
            'School',
            TextFormField(controller: school, decoration: _dec('School')),
          ),
          _field(
            'Address',
            TextFormField(controller: address, decoration: _dec('Address')),
          ),
        ]),
        const SizedBox(height: 16),
        _row([
          _field(
            'Honors / Awards',
            TextFormField(
              controller: honors,
              decoration: _dec('Honors / Awards'),
            ),
          ),
          _field(
            'Club / Org',
            TextFormField(controller: club, decoration: _dec('Club / Org')),
          ),
          _field(
            'Year Graduated',
            TextFormField(
              controller: year,
              keyboardType: TextInputType.number,
              decoration: _dec('YYYY'),
            ),
          ),
        ]),
        const SizedBox(height: 24),
      ],
    );
  }
}

const TextStyle sectionTitle = TextStyle(
  fontSize: 15,
  fontWeight: FontWeight.bold,
  color: Colors.brown,
);
