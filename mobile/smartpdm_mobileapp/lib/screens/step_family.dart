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

  late final TextEditingController motherLastNameController;
  late final TextEditingController motherFirstNameController;
  late final TextEditingController motherMiddleNameController;
  late final TextEditingController motherMobileController;

  late final TextEditingController siblingLastNameController;
  late final TextEditingController siblingFirstNameController;
  late final TextEditingController siblingMiddleNameController;
  late final TextEditingController siblingMobileController;

  late final TextEditingController guardianLastNameController;
  late final TextEditingController guardianFirstNameController;
  late final TextEditingController guardianMiddleNameController;
  late final TextEditingController guardianMobileController;

  late final TextEditingController occupationController;
  late final TextEditingController companyController;

  final List<String> educationalOptions = [
    'None',
    'Primary',
    'Secondary',
    'Vocational',
    'College',
    'Graduate',
  ];

  late String selectedEducation;
  final List<String> parentNativeOptions = [
    'Father only',
    'Mother only',
    'Both parents',
    'No',
  ];

  late String selectedParentNative;

  InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      );

  Widget _field(String label, Widget child) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          const SizedBox(height: 4),
          child,
        ],
      );

  Widget _row(List<Widget> fields) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: fields
            .asMap()
            .entries
            .map((entry) => Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(right: entry.key < fields.length - 1 ? 10 : 0),
                    child: entry.value,
                  ),
                ))
            .toList(),
      );

  void _bind(TextEditingController controller, void Function(String) setter) {
    controller.addListener(() {
      setter(controller.text);
      widget.onChanged();
    });
  }

  @override
  void initState() {
    super.initState();

    parentAddressController = TextEditingController(text: widget.data.parentGuardianAddress);

    fatherLastNameController = TextEditingController(text: widget.data.fatherLastName);
    fatherFirstNameController = TextEditingController(text: widget.data.fatherFirstName);
    fatherMiddleNameController = TextEditingController(text: widget.data.fatherMiddleName);
    fatherMobileController = TextEditingController(text: widget.data.fatherMobile);

    motherLastNameController = TextEditingController(text: widget.data.motherLastName);
    motherFirstNameController = TextEditingController(text: widget.data.motherFirstName);
    motherMiddleNameController = TextEditingController(text: widget.data.motherMiddleName);
    motherMobileController = TextEditingController(text: widget.data.motherMobile);

    siblingLastNameController = TextEditingController(text: widget.data.siblingLastName);
    siblingFirstNameController = TextEditingController(text: widget.data.siblingFirstName);
    siblingMiddleNameController = TextEditingController(text: widget.data.siblingMiddleName);
    siblingMobileController = TextEditingController(text: widget.data.siblingMobile);

    guardianLastNameController = TextEditingController(text: widget.data.guardianLastName);
    guardianFirstNameController = TextEditingController(text: widget.data.guardianFirstName);
    guardianMiddleNameController = TextEditingController(text: widget.data.guardianMiddleName);
    guardianMobileController = TextEditingController(text: widget.data.guardianMobile);

    occupationController = TextEditingController(text: widget.data.occupation);
    companyController = TextEditingController(text: widget.data.companyNameAndAddress);

    selectedEducation = widget.data.educationalAttainment.isNotEmpty ? widget.data.educationalAttainment : educationalOptions[0];
    selectedParentNative = widget.data.parentNativeStatus.isNotEmpty ? widget.data.parentNativeStatus : parentNativeOptions[0];

    _bind(parentAddressController, (value) => widget.data.parentGuardianAddress = value);

    _bind(fatherLastNameController, (value) => widget.data.fatherLastName = value);
    _bind(fatherFirstNameController, (value) => widget.data.fatherFirstName = value);
    _bind(fatherMiddleNameController, (value) => widget.data.fatherMiddleName = value);
    _bind(fatherMobileController, (value) => widget.data.fatherMobile = value);

    _bind(motherLastNameController, (value) => widget.data.motherLastName = value);
    _bind(motherFirstNameController, (value) => widget.data.motherFirstName = value);
    _bind(motherMiddleNameController, (value) => widget.data.motherMiddleName = value);
    _bind(motherMobileController, (value) => widget.data.motherMobile = value);

    _bind(siblingLastNameController, (value) => widget.data.siblingLastName = value);
    _bind(siblingFirstNameController, (value) => widget.data.siblingFirstName = value);
    _bind(siblingMiddleNameController, (value) => widget.data.siblingMiddleName = value);
    _bind(siblingMobileController, (value) => widget.data.siblingMobile = value);

    _bind(guardianLastNameController, (value) => widget.data.guardianLastName = value);
    _bind(guardianFirstNameController, (value) => widget.data.guardianFirstName = value);
    _bind(guardianMiddleNameController, (value) => widget.data.guardianMiddleName = value);
    _bind(guardianMobileController, (value) => widget.data.guardianMobile = value);

    _bind(occupationController, (value) => widget.data.occupation = value);
    _bind(companyController, (value) => widget.data.companyNameAndAddress = value);
  }

  @override
  void dispose() {
    parentAddressController.dispose();

    fatherLastNameController.dispose();
    fatherFirstNameController.dispose();
    fatherMiddleNameController.dispose();
    fatherMobileController.dispose();

    motherLastNameController.dispose();
    motherFirstNameController.dispose();
    motherMiddleNameController.dispose();
    motherMobileController.dispose();

    siblingLastNameController.dispose();
    siblingFirstNameController.dispose();
    siblingMiddleNameController.dispose();
    siblingMobileController.dispose();

    guardianLastNameController.dispose();
    guardianFirstNameController.dispose();
    guardianMiddleNameController.dispose();
    guardianMobileController.dispose();

    occupationController.dispose();
    companyController.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('ADDRESS OF PARENTS / GUARDIAN', style: sectionTitle),
          const SizedBox(height: 6),
          TextFormField(controller: parentAddressController, decoration: _dec('Address')),
          const SizedBox(height: 14),

          Text('FATHER\'S NAME', style: sectionTitle),
          const SizedBox(height: 6),
          _row([
            _field('Last Name', TextFormField(controller: fatherLastNameController, decoration: _dec('Last Name'))),
            _field('First Name', TextFormField(controller: fatherFirstNameController, decoration: _dec('First Name'))),
          ]),
          const SizedBox(height: 8),
          _row([
            _field('Middle Name', TextFormField(controller: fatherMiddleNameController, decoration: _dec('Middle Name'))),
            _field('Mobile No.', TextFormField(controller: fatherMobileController, keyboardType: TextInputType.phone, decoration: _dec('09XX-XXX-XXXX'))),
          ]),
          const SizedBox(height: 14),

          Text('MOTHER\'S MAIDEN NAME', style: sectionTitle),
          const SizedBox(height: 6),
          _row([
            _field('Last Name', TextFormField(controller: motherLastNameController, decoration: _dec('Last Name'))),
            _field('First Name', TextFormField(controller: motherFirstNameController, decoration: _dec('First Name'))),
          ]),
          const SizedBox(height: 8),
          _row([
            _field('Middle Name', TextFormField(controller: motherMiddleNameController, decoration: _dec('Middle Name'))),
            _field('Mobile No.', TextFormField(controller: motherMobileController, keyboardType: TextInputType.phone, decoration: _dec('09XX-XXX-XXXX'))),
          ]),
          const SizedBox(height: 14),

          Text('SIBLING\'S NAME', style: sectionTitle),
          const SizedBox(height: 6),
          _row([
            _field('Last Name', TextFormField(controller: siblingLastNameController, decoration: _dec('Last Name'))),
            _field('First Name', TextFormField(controller: siblingFirstNameController, decoration: _dec('First Name'))),
          ]),
          const SizedBox(height: 8),
          _row([
            _field('Middle Name', TextFormField(controller: siblingMiddleNameController, decoration: _dec('Middle Name'))),
            _field('Mobile No.', TextFormField(controller: siblingMobileController, keyboardType: TextInputType.phone, decoration: _dec('09XX-XXX-XXXX'))),
          ]),
          const SizedBox(height: 14),

          Text('GUARDIAN\'S NAME', style: sectionTitle),
          const SizedBox(height: 6),
          _row([
            _field('Last Name', TextFormField(controller: guardianLastNameController, decoration: _dec('Last Name'))),
            _field('First Name', TextFormField(controller: guardianFirstNameController, decoration: _dec('First Name'))),
          ]),
          const SizedBox(height: 8),
          _row([
            _field('Middle Name', TextFormField(controller: guardianMiddleNameController, decoration: _dec('Middle Name'))),
            _field('Mobile No.', TextFormField(controller: guardianMobileController, keyboardType: TextInputType.phone, decoration: _dec('09XX-XXX-XXXX'))),
          ]),
          const SizedBox(height: 14),

          Text('HIGHEST EDUCATIONAL ATTAINMENT', style: sectionTitle),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: selectedEducation,
            decoration: _dec('Select'),
            items: educationalOptions
                .map((value) => DropdownMenuItem(value: value, child: Text(value)))
                .toList(),
            onChanged: (value) {
              if (value == null) return;
              setState(() => selectedEducation = value);
              widget.data.educationalAttainment = value;
              widget.onChanged();
            },
          ),
          const SizedBox(height: 12),

          Text('OCCUPATION', style: sectionTitle),
          const SizedBox(height: 6),
          TextFormField(controller: occupationController, decoration: _dec('Occupation')),
          const SizedBox(height: 12),

          Text('COMPANY NAME / ADDRESS', style: sectionTitle),
          const SizedBox(height: 6),
          TextFormField(controller: companyController, decoration: _dec('Company name / address')),
          const SizedBox(height: 14),

          Text('ARE YOUR PARENTS A NATIVE OF MARILAO?', style: sectionTitle),
          const SizedBox(height: 6),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: parentNativeOptions
                .map(
                  (option) => RadioListTile<String>(
                    title: Text(option),
                    value: option,
                    groupValue: selectedParentNative,
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        selectedParentNative = value;
                        widget.data.parentNativeStatus = value;
                      });
                      widget.onChanged();
                    },
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}

const TextStyle sectionTitle = TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.brown);
