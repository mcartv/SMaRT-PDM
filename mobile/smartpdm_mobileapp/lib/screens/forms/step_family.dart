import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';

class StepFamily extends StatefulWidget {
  final ApplicationData data;
  final VoidCallback onChanged;

  const StepFamily({super.key, required this.data, required this.onChanged});

  @override
  State<StepFamily> createState() => _StepFamilyState();
}

class _StepFamilyState extends State<StepFamily> {
  late final TextEditingController parentAddressController;

  late final TextEditingController fatherLastNameController;
  late final TextEditingController fatherFirstNameController;
  late final TextEditingController fatherMiddleNameController;
  late final TextEditingController fatherMobileController;
  late final TextEditingController fatherOccupationController;
  late final TextEditingController fatherCompanyController;
  late String selectedFatherEducation;

  late final TextEditingController motherLastNameController;
  late final TextEditingController motherFirstNameController;
  late final TextEditingController motherMiddleNameController;
  late final TextEditingController motherMobileController;
  late final TextEditingController motherOccupationController;
  late final TextEditingController motherCompanyController;
  late String selectedMotherEducation;

  late final TextEditingController siblingLastNameController;
  late final TextEditingController siblingFirstNameController;
  late final TextEditingController siblingMiddleNameController;
  late final TextEditingController siblingMobileController;

  late final TextEditingController guardianLastNameController;
  late final TextEditingController guardianFirstNameController;
  late final TextEditingController guardianMiddleNameController;
  late final TextEditingController guardianMobileController;
  late final TextEditingController guardianOccupationController;
  late final TextEditingController guardianCompanyController;
  late String selectedGuardianEducation;

  late final TextEditingController parentMarilaoResidencyDurationController;
  late final TextEditingController parentPreviousTownProvinceController;

  final List<String> educationalOptions = [
    'None',
    'Elementary',
    'High School',
    'Senior High School',
    'Vocational',
    'College',
    'Post-Graduate',
  ];

  final List<String> parentNativeOptions = [
    'Yes, father only',
    'Yes, mother only',
    'Yes, both parents',
    'No',
  ];

  late String selectedParentNative;

  InputDecoration _dec(String hint) => InputDecoration(
    hintText: hint,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
  );

  Widget _field(String label, Widget child) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
      ),
      const SizedBox(height: 8),
      child,
    ],
  );

  Widget _row(List<Widget> fields) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 600) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: fields
                .asMap()
                .entries
                .map(
                  (entry) => Padding(
                    padding: EdgeInsets.only(
                      bottom: entry.key < fields.length - 1 ? 16.0 : 0,
                    ),
                    child: entry.value,
                  ),
                )
                .toList(),
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: fields
              .asMap()
              .entries
              .map(
                (entry) => Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      right: entry.key < fields.length - 1 ? 16.0 : 0,
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

  void _bind(TextEditingController controller, void Function(String) setter) {
    controller.addListener(() {
      setter(controller.text);
      widget.onChanged();
    });
  }

  @override
  void initState() {
    super.initState();

    parentAddressController = TextEditingController(
      text: widget.data.parentGuardianAddress,
    );

    fatherLastNameController = TextEditingController(
      text: widget.data.fatherLastName,
    );
    fatherFirstNameController = TextEditingController(
      text: widget.data.fatherFirstName,
    );
    fatherMiddleNameController = TextEditingController(
      text: widget.data.fatherMiddleName,
    );
    fatherMobileController = TextEditingController(
      text: widget.data.fatherMobile,
    );
    fatherOccupationController = TextEditingController(
      text: widget.data.fatherOccupation,
    );
    fatherCompanyController = TextEditingController(
      text: widget.data.fatherCompanyNameAndAddress,
    );
    selectedFatherEducation = widget.data.fatherEducationalAttainment.isNotEmpty
        ? widget.data.fatherEducationalAttainment
        : educationalOptions[0];

    motherLastNameController = TextEditingController(
      text: widget.data.motherLastName,
    );
    motherFirstNameController = TextEditingController(
      text: widget.data.motherFirstName,
    );
    motherMiddleNameController = TextEditingController(
      text: widget.data.motherMiddleName,
    );
    motherMobileController = TextEditingController(
      text: widget.data.motherMobile,
    );
    motherOccupationController = TextEditingController(
      text: widget.data.motherOccupation,
    );
    motherCompanyController = TextEditingController(
      text: widget.data.motherCompanyNameAndAddress,
    );
    selectedMotherEducation = widget.data.motherEducationalAttainment.isNotEmpty
        ? widget.data.motherEducationalAttainment
        : educationalOptions[0];

    siblingLastNameController = TextEditingController(
      text: widget.data.siblingLastName,
    );
    siblingFirstNameController = TextEditingController(
      text: widget.data.siblingFirstName,
    );
    siblingMiddleNameController = TextEditingController(
      text: widget.data.siblingMiddleName,
    );
    siblingMobileController = TextEditingController(
      text: widget.data.siblingMobile,
    );

    guardianLastNameController = TextEditingController(
      text: widget.data.guardianLastName,
    );
    guardianFirstNameController = TextEditingController(
      text: widget.data.guardianFirstName,
    );
    guardianMiddleNameController = TextEditingController(
      text: widget.data.guardianMiddleName,
    );
    guardianMobileController = TextEditingController(
      text: widget.data.guardianMobile,
    );
    guardianOccupationController = TextEditingController(
      text: widget.data.guardianOccupation,
    );
    guardianCompanyController = TextEditingController(
      text: widget.data.guardianCompanyNameAndAddress,
    );
    selectedGuardianEducation =
        widget.data.guardianEducationalAttainment.isNotEmpty
        ? widget.data.guardianEducationalAttainment
        : educationalOptions[0];

    String initialParentNativeStatus = widget.data.parentNativeStatus;
    if (initialParentNativeStatus == 'Father only') {
      initialParentNativeStatus = 'Yes, father only';
    }
    if (initialParentNativeStatus == 'Mother only') {
      initialParentNativeStatus = 'Yes, mother only';
    }
    if (initialParentNativeStatus == 'Both parents') {
      initialParentNativeStatus = 'Yes, both parents';
    }

    selectedParentNative =
        parentNativeOptions.contains(initialParentNativeStatus)
        ? initialParentNativeStatus
        : parentNativeOptions[0];
    widget.data.parentNativeStatus = selectedParentNative;

    parentMarilaoResidencyDurationController = TextEditingController(
      text: widget.data.parentMarilaoResidencyDuration,
    );
    parentPreviousTownProvinceController = TextEditingController(
      text: widget.data.parentPreviousTownProvince,
    );

    _bind(
      parentAddressController,
      (value) => widget.data.parentGuardianAddress = value,
    );

    _bind(
      fatherLastNameController,
      (value) => widget.data.fatherLastName = value,
    );
    _bind(
      fatherFirstNameController,
      (value) => widget.data.fatherFirstName = value,
    );
    _bind(
      fatherMiddleNameController,
      (value) => widget.data.fatherMiddleName = value,
    );
    _bind(fatherMobileController, (value) => widget.data.fatherMobile = value);
    _bind(
      fatherOccupationController,
      (value) => widget.data.fatherOccupation = value,
    );
    _bind(
      fatherCompanyController,
      (value) => widget.data.fatherCompanyNameAndAddress = value,
    );

    _bind(
      motherLastNameController,
      (value) => widget.data.motherLastName = value,
    );
    _bind(
      motherFirstNameController,
      (value) => widget.data.motherFirstName = value,
    );
    _bind(
      motherMiddleNameController,
      (value) => widget.data.motherMiddleName = value,
    );
    _bind(motherMobileController, (value) => widget.data.motherMobile = value);
    _bind(
      motherOccupationController,
      (value) => widget.data.motherOccupation = value,
    );
    _bind(
      motherCompanyController,
      (value) => widget.data.motherCompanyNameAndAddress = value,
    );

    _bind(
      siblingLastNameController,
      (value) => widget.data.siblingLastName = value,
    );
    _bind(
      siblingFirstNameController,
      (value) => widget.data.siblingFirstName = value,
    );
    _bind(
      siblingMiddleNameController,
      (value) => widget.data.siblingMiddleName = value,
    );
    _bind(
      siblingMobileController,
      (value) => widget.data.siblingMobile = value,
    );

    _bind(
      guardianLastNameController,
      (value) => widget.data.guardianLastName = value,
    );
    _bind(
      guardianFirstNameController,
      (value) => widget.data.guardianFirstName = value,
    );
    _bind(
      guardianMiddleNameController,
      (value) => widget.data.guardianMiddleName = value,
    );
    _bind(
      guardianMobileController,
      (value) => widget.data.guardianMobile = value,
    );
    _bind(
      guardianOccupationController,
      (value) => widget.data.guardianOccupation = value,
    );
    _bind(
      guardianCompanyController,
      (value) => widget.data.guardianCompanyNameAndAddress = value,
    );
    _bind(
      parentMarilaoResidencyDurationController,
      (value) => widget.data.parentMarilaoResidencyDuration = value,
    );
    _bind(
      parentPreviousTownProvinceController,
      (value) => widget.data.parentPreviousTownProvince = value,
    );
  }

  @override
  void dispose() {
    parentAddressController.dispose();

    fatherLastNameController.dispose();
    fatherFirstNameController.dispose();
    fatherMiddleNameController.dispose();
    fatherMobileController.dispose();
    fatherOccupationController.dispose();
    fatherCompanyController.dispose();

    motherLastNameController.dispose();
    motherFirstNameController.dispose();
    motherMiddleNameController.dispose();
    motherMobileController.dispose();
    motherOccupationController.dispose();
    motherCompanyController.dispose();

    siblingLastNameController.dispose();
    siblingFirstNameController.dispose();
    siblingMiddleNameController.dispose();
    siblingMobileController.dispose();

    guardianLastNameController.dispose();
    guardianFirstNameController.dispose();
    guardianMiddleNameController.dispose();
    guardianMobileController.dispose();
    guardianOccupationController.dispose();
    guardianCompanyController.dispose();
    parentMarilaoResidencyDurationController.dispose();
    parentPreviousTownProvinceController.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('II. FAMILY DATA', style: sectionTitle),
          const Divider(color: Colors.orange, thickness: 2),
          const SizedBox(height: 24),
          Text('ADDRESS OF PARENTS / GUARDIAN', style: sectionTitle),
          const SizedBox(height: 12),
          TextFormField(
            controller: parentAddressController,
            decoration: _dec('Address'),
          ),
          const SizedBox(height: 24),

          Text('FATHER\'S NAME', style: sectionTitle),
          const SizedBox(height: 12),
          _row([
            _field(
              'Last Name',
              TextFormField(
                controller: fatherLastNameController,
                decoration: _dec('Last Name'),
              ),
            ),
            _field(
              'First Name',
              TextFormField(
                controller: fatherFirstNameController,
                decoration: _dec('First Name'),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _row([
            _field(
              'Middle Name',
              TextFormField(
                controller: fatherMiddleNameController,
                decoration: _dec('Middle Name'),
              ),
            ),
            _field(
              'Mobile No.',
              TextFormField(
                controller: fatherMobileController,
                keyboardType: TextInputType.phone,
                decoration: _dec('09XX-XXX-XXXX'),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _field(
            'Highest Educational Attainment',
            DropdownButtonFormField<String>(
              initialValue: selectedFatherEducation,
              decoration: _dec('Select'),
              items: educationalOptions
                  .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                  .toList(),
              onChanged: (val) {
                if (val == null) return;
                setState(() => selectedFatherEducation = val);
                widget.data.fatherEducationalAttainment = val;
                widget.onChanged();
              },
            ),
          ),
          const SizedBox(height: 16),
          _row([
            _field(
              'Occupation',
              TextFormField(
                controller: fatherOccupationController,
                decoration: _dec('Occupation'),
              ),
            ),
            _field(
              'Company Name / Address',
              TextFormField(
                controller: fatherCompanyController,
                decoration: _dec('Company Name / Address'),
              ),
            ),
          ]),
          const SizedBox(height: 24),

          Text('MOTHER\'S MAIDEN NAME', style: sectionTitle),
          const SizedBox(height: 12),
          _row([
            _field(
              'Last Name',
              TextFormField(
                controller: motherLastNameController,
                decoration: _dec('Last Name'),
              ),
            ),
            _field(
              'First Name',
              TextFormField(
                controller: motherFirstNameController,
                decoration: _dec('First Name'),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _row([
            _field(
              'Middle Name',
              TextFormField(
                controller: motherMiddleNameController,
                decoration: _dec('Middle Name'),
              ),
            ),
            _field(
              'Mobile No.',
              TextFormField(
                controller: motherMobileController,
                keyboardType: TextInputType.phone,
                decoration: _dec('09XX-XXX-XXXX'),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _field(
            'Highest Educational Attainment',
            DropdownButtonFormField<String>(
              initialValue: selectedMotherEducation,
              decoration: _dec('Select'),
              items: educationalOptions
                  .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                  .toList(),
              onChanged: (val) {
                if (val == null) return;
                setState(() => selectedMotherEducation = val);
                widget.data.motherEducationalAttainment = val;
                widget.onChanged();
              },
            ),
          ),
          const SizedBox(height: 16),
          _row([
            _field(
              'Occupation',
              TextFormField(
                controller: motherOccupationController,
                decoration: _dec('Occupation'),
              ),
            ),
            _field(
              'Company Name / Address',
              TextFormField(
                controller: motherCompanyController,
                decoration: _dec('Company Name / Address'),
              ),
            ),
          ]),
          const SizedBox(height: 24),

          Text('SIBLING\'S NAME', style: sectionTitle),
          const SizedBox(height: 12),
          _row([
            _field(
              'Last Name',
              TextFormField(
                controller: siblingLastNameController,
                decoration: _dec('Last Name'),
              ),
            ),
            _field(
              'First Name',
              TextFormField(
                controller: siblingFirstNameController,
                decoration: _dec('First Name'),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _row([
            _field(
              'Middle Name',
              TextFormField(
                controller: siblingMiddleNameController,
                decoration: _dec('Middle Name'),
              ),
            ),
            _field(
              'Mobile No.',
              TextFormField(
                controller: siblingMobileController,
                keyboardType: TextInputType.phone,
                decoration: _dec('09XX-XXX-XXXX'),
              ),
            ),
          ]),
          const SizedBox(height: 24),

          Text('GUARDIAN\'S NAME', style: sectionTitle),
          const SizedBox(height: 12),
          _row([
            _field(
              'Last Name',
              TextFormField(
                controller: guardianLastNameController,
                decoration: _dec('Last Name'),
              ),
            ),
            _field(
              'First Name',
              TextFormField(
                controller: guardianFirstNameController,
                decoration: _dec('First Name'),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _row([
            _field(
              'Middle Name',
              TextFormField(
                controller: guardianMiddleNameController,
                decoration: _dec('Middle Name'),
              ),
            ),
            _field(
              'Mobile No.',
              TextFormField(
                controller: guardianMobileController,
                keyboardType: TextInputType.phone,
                decoration: _dec('09XX-XXX-XXXX'),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _field(
            'Highest Educational Attainment',
            DropdownButtonFormField<String>(
              initialValue: selectedGuardianEducation,
              decoration: _dec('Select'),
              items: educationalOptions
                  .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                  .toList(),
              onChanged: (val) {
                if (val == null) return;
                setState(() => selectedGuardianEducation = val);
                widget.data.guardianEducationalAttainment = val;
                widget.onChanged();
              },
            ),
          ),
          const SizedBox(height: 16),
          _row([
            _field(
              'Occupation',
              TextFormField(
                controller: guardianOccupationController,
                decoration: _dec('Occupation'),
              ),
            ),
            _field(
              'Company Name / Address',
              TextFormField(
                controller: guardianCompanyController,
                decoration: _dec('Company Name / Address'),
              ),
            ),
          ]),
          const SizedBox(height: 24),

          Text('ARE YOUR PARENTS A NATIVE OF MARILAO?', style: sectionTitle),
          const SizedBox(height: 4),
          Wrap(
            spacing: 0,
            runSpacing: 0,
            children: parentNativeOptions.map((option) {
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Radio<String>(
                    value: option,
                    groupValue: selectedParentNative,
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        selectedParentNative = value;
                        widget.data.parentNativeStatus = value;
                        // Clear other field when switching
                        if (value != 'No') {
                          parentPreviousTownProvinceController.clear();
                          widget.data.parentPreviousTownProvince = '';
                        } else {
                          parentMarilaoResidencyDurationController.clear();
                          widget.data.parentMarilaoResidencyDuration = '';
                        }
                      });
                      widget.onChanged();
                    },
                  ),
                  Text(option, style: const TextStyle(fontSize: 13)),
                ],
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          if (selectedParentNative != 'No')
            _field(
              'If YES, how long they have been residents of Marilao?',
              TextFormField(
                controller: parentMarilaoResidencyDurationController,
                decoration: _dec('e.g., 20 years'),
              ),
            ),
          if (selectedParentNative == 'No')
            _field(
              'If NO, what town or provinces did they come from?',
              TextFormField(
                controller: parentPreviousTownProvinceController,
                decoration: _dec('e.g., Pampanga'),
              ),
            ),
        ],
      ),
    );
  }
}

const TextStyle sectionTitle = TextStyle(
  fontSize: 15,
  fontWeight: FontWeight.bold,
  color: Colors.brown,
);
