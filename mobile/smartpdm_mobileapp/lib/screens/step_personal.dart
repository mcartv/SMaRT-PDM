import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';

class StepPersonal extends StatefulWidget {
  final ApplicationData data;
  final VoidCallback onChanged;
  const StepPersonal({super.key, required this.data, required this.onChanged});

  @override
  State<StepPersonal> createState() => _StepPersonalState();
}

class _StepPersonalState extends State<StepPersonal> {
  late final TextEditingController firstNameController;
  late final TextEditingController middleNameController;
  late final TextEditingController lastNameController;
  late final TextEditingController maidenNameController;
  late final TextEditingController ageController;
  late final TextEditingController dobController;
  late final TextEditingController placeOfBirthController;
  late final TextEditingController citizenshipController;
  late final TextEditingController religionController;
  late final TextEditingController blockController;
  late final TextEditingController lotController;
  late final TextEditingController phaseController;
  late final TextEditingController streetController;
  late final TextEditingController subdivisionController;
  late final TextEditingController barangayController;
  late final TextEditingController cityController;
  late final TextEditingController zipCodeController;
  late final TextEditingController landlineController;
  late final TextEditingController mobileController;
  late final TextEditingController emailController;

  final List<String> sexOptions = ['Male', 'Female', 'Other'];
  final List<String> civilStatusOptions = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'];

  final List<String> cityOptions = ['Marilao', 'Meycauayan', 'Obando'];
  final Map<String, List<String>> cityBarangayMapping = {
    'Marilao': ['Barasat', 'Ibayo', 'Laligan', 'Poblacion'],
    'Meycauayan': ['Market Area', 'Santa Cruz', 'Tibag'],
    'Obando': ['Bugarin', 'Meycauayan City Potot', 'Obando Poblacion'],
  };
  final Map<String, String> cityZipMapping = {
    'Marilao': '3019',
    'Meycauayan': '3020',
    'Obando': '3016',
  };

  String selectedSex = 'Male';
  String selectedCivilStatus = 'Single';
  String selectedCity = 'Marilao';
  String selectedBarangay = 'Barasat';

  void _initControllers() {
    firstNameController = TextEditingController(text: widget.data.firstName);
    middleNameController = TextEditingController(text: widget.data.middleName);
    lastNameController = TextEditingController(text: widget.data.lastName);
    maidenNameController = TextEditingController(text: widget.data.maidenName);
    ageController = TextEditingController(text: widget.data.age);
    dobController = TextEditingController(text: widget.data.dateOfBirth);
    placeOfBirthController = TextEditingController(text: widget.data.placeOfBirth);
    citizenshipController = TextEditingController(text: widget.data.citizenship);
    religionController = TextEditingController(text: widget.data.religion);
    blockController = TextEditingController(text: widget.data.block);
    lotController = TextEditingController(text: widget.data.lot);
    phaseController = TextEditingController(text: widget.data.phase);
    streetController = TextEditingController(text: widget.data.street);
    subdivisionController = TextEditingController(text: widget.data.subdivision);
    barangayController = TextEditingController(text: widget.data.barangay);
    zipCodeController = TextEditingController(text: widget.data.zipCode);
    landlineController = TextEditingController(text: widget.data.landline);
    mobileController = TextEditingController(text: widget.data.mobileNumber);
    emailController = TextEditingController(text: widget.data.email);

    selectedSex = widget.data.sex.isNotEmpty ? widget.data.sex : sexOptions.first;
    selectedCivilStatus = widget.data.civilStatus.isNotEmpty ? widget.data.civilStatus : civilStatusOptions.first;

    selectedCity = cityOptions.contains(widget.data.city) ? widget.data.city : cityOptions.first;
    final cityBarangays = cityBarangayMapping[selectedCity] ?? [];
    selectedBarangay = cityBarangays.contains(widget.data.barangay) ? widget.data.barangay : (cityBarangays.isNotEmpty ? cityBarangays.first : '');

    final defaultZip = cityZipMapping[selectedCity] ?? '';

    cityController = TextEditingController(text: selectedCity);
    barangayController.text = selectedBarangay;
    zipCodeController.text = widget.data.zipCode.isNotEmpty ? widget.data.zipCode : defaultZip;

    widget.data.city = selectedCity;
    widget.data.barangay = selectedBarangay;
    widget.data.zipCode = zipCodeController.text;
  }

  void _bindListener(TextEditingController ctrl, void Function(String) setter) {
    ctrl.addListener(() {
      setter(ctrl.text);
      widget.onChanged();
    });
  }

  @override
  void initState() {
    super.initState();
    _initControllers();

    _bindListener(firstNameController, (value) => widget.data.firstName = value);
    _bindListener(middleNameController, (value) => widget.data.middleName = value);
    _bindListener(lastNameController, (value) => widget.data.lastName = value);
    _bindListener(maidenNameController, (value) => widget.data.maidenName = value);
    _bindListener(ageController, (value) => widget.data.age = value);
    _bindListener(dobController, (value) => widget.data.dateOfBirth = value);
    _bindListener(placeOfBirthController, (value) => widget.data.placeOfBirth = value);
    _bindListener(citizenshipController, (value) => widget.data.citizenship = value);
    _bindListener(religionController, (value) => widget.data.religion = value);
    _bindListener(blockController, (value) => widget.data.block = value);
    _bindListener(lotController, (value) => widget.data.lot = value);
    _bindListener(phaseController, (value) => widget.data.phase = value);
    _bindListener(streetController, (value) => widget.data.street = value);
    _bindListener(subdivisionController, (value) => widget.data.subdivision = value);
    _bindListener(barangayController, (value) => widget.data.barangay = value);
    _bindListener(zipCodeController, (value) => widget.data.zipCode = value);
    _bindListener(landlineController, (value) => widget.data.landline = value);
    _bindListener(mobileController, (value) => widget.data.mobileNumber = value);
    _bindListener(emailController, (value) => widget.data.email = value);
  }

  @override
  void dispose() {
    firstNameController.dispose();
    middleNameController.dispose();
    lastNameController.dispose();
    maidenNameController.dispose();
    ageController.dispose();
    dobController.dispose();
    placeOfBirthController.dispose();
    citizenshipController.dispose();
    religionController.dispose();
    blockController.dispose();
    lotController.dispose();
    phaseController.dispose();
    streetController.dispose();
    subdivisionController.dispose();
    barangayController.dispose();
    cityController.dispose();
    zipCodeController.dispose();
    landlineController.dispose();
    mobileController.dispose();
    emailController.dispose();
    super.dispose();
  }

  Widget _field({required String label, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
        const SizedBox(height: 6),
        child,
      ],
    );
  }

  InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      );

  Widget _row(List<Widget> items) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: items
            .asMap()
            .entries
            .map((entry) => Expanded(
                  flex: 1,
                  child: Padding(
                    padding: EdgeInsets.only(right: entry.key < items.length - 1 ? 10 : 0),
                    child: entry.value,
                  ),
                ))
            .toList(),
      );

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('I. PERSONAL DATA',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.brown)),
        const SizedBox(height: 12),
        _row([
          _field(label: 'Last Name', child: TextFormField(controller: lastNameController, decoration: _dec('Last Name'))),
          _field(label: 'First Name', child: TextFormField(controller: firstNameController, decoration: _dec('First Name'))),
        ]),
        const SizedBox(height: 12),
        _row([
          _field(label: 'Middle Name', child: TextFormField(controller: middleNameController, decoration: _dec('Middle Name'))),
          _field(label: 'Maiden Name (if married)', child: TextFormField(controller: maidenNameController, decoration: _dec('Maiden Name (if married)'))),
        ]),
        const SizedBox(height: 12),
        _row([
          _field(label: 'Age', child: TextFormField(controller: ageController, keyboardType: TextInputType.number, decoration: _dec('Age'))),
          _field(
              label: 'Date of Birth',
              child: TextFormField(
                controller: dobController,
                readOnly: true,
                decoration: _dec('mm/dd/yyyy').copyWith(suffixIcon: const Icon(Icons.calendar_month)),
                onTap: () async {
                  final date = await showDatePicker(
                    context: context,
                    initialDate: widget.data.dateOfBirth.isNotEmpty
                        ? DateTime.tryParse(widget.data.dateOfBirth) ?? DateTime.now()
                        : DateTime.now(),
                    firstDate: DateTime(1900),
                    lastDate: DateTime.now(),
                  );
                  if (date != null) {
                    final formatted = '${date.month.toString().padLeft(2, '0')}/${date.day.toString().padLeft(2, '0')}/${date.year}';
                    dobController.text = formatted;
                    widget.data.dateOfBirth = formatted;
                    widget.onChanged();
                  }
                },
              )),
          _field(
            label: 'Sex',
            child: DropdownButtonFormField<String>(
              value: selectedSex,
              decoration: _dec('Sex'),
              items: sexOptions.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() => selectedSex = value);
                widget.data.sex = value;
                widget.onChanged();
              },
            ),
          ),
        ]),
        const SizedBox(height: 12),
        _row([
          _field(label: 'Place of Birth', child: TextFormField(controller: placeOfBirthController, decoration: _dec('Place of Birth'))),
          _field(label: 'Citizenship', child: TextFormField(controller: citizenshipController, decoration: _dec('Filipino'))),
        ]),
        const SizedBox(height: 12),
        _row([
          _field(
            label: 'Civil Status',
            child: DropdownButtonFormField<String>(
              value: selectedCivilStatus,
              decoration: _dec('Civil Status'),
              items: civilStatusOptions.map((status) => DropdownMenuItem(value: status, child: Text(status))).toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() => selectedCivilStatus = value);
                widget.data.civilStatus = value;
                widget.onChanged();
              },
            ),
          ),
          _field(label: 'Religion', child: TextFormField(controller: religionController, decoration: _dec('Religion'))),
        ]),
        const SizedBox(height: 24),
        const Text('PERMANENT ADDRESS',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.brown)),
        const SizedBox(height: 12),
        _row([
          _field(label: 'Block', child: TextFormField(controller: blockController, decoration: _dec('Block'))),
          _field(label: 'Lot', child: TextFormField(controller: lotController, decoration: _dec('Lot'))),
          _field(label: 'Phase', child: TextFormField(controller: phaseController, decoration: _dec('Phase'))),
        ]),
        const SizedBox(height: 12),
        _row([
          _field(label: 'Street', child: TextFormField(controller: streetController, decoration: _dec('Street'))),
          _field(label: 'Subdivision', child: TextFormField(controller: subdivisionController, decoration: _dec('Subdivision'))),
        ]),
        const SizedBox(height: 12),
        _row([
          _field(
            label: 'City / Municipality',
            child: DropdownButtonFormField<String>(
              value: selectedCity,
              decoration: _dec('City / Municipality'),
              items: cityOptions.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() {
                  selectedCity = value;
                  widget.data.city = value;
                  cityController.text = value;

                  final nextBarangayList = cityBarangayMapping[value] ?? <String>[];
                  selectedBarangay = nextBarangayList.isNotEmpty ? nextBarangayList.first : '';
                  barangayController.text = selectedBarangay;
                  widget.data.barangay = selectedBarangay;

                  final updatedZip = cityZipMapping[value] ?? '';
                  zipCodeController.text = updatedZip;
                  widget.data.zipCode = updatedZip;
                });
                widget.onChanged();
              },
            ),
          ),
          _field(
            label: 'Barangay',
            child: DropdownButtonFormField<String>(
              value: selectedBarangay,
              decoration: _dec('Barangay'),
              items: (cityBarangayMapping[selectedCity] ?? <String>[])
                  .map((b) => DropdownMenuItem(value: b, child: Text(b)))
                  .toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() {
                  selectedBarangay = value;
                  barangayController.text = value;
                  widget.data.barangay = value;
                });
                widget.onChanged();
              },
            ),
          ),
          _field(label: 'ZIP Code', child: TextFormField(controller: zipCodeController, keyboardType: TextInputType.number, decoration: _dec('3019'))),
        ]),
        const SizedBox(height: 24),
        const Text('CONTACT INFORMATION',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.brown)),
        const SizedBox(height: 12),
        _row([
          _field(label: 'Landline', child: TextFormField(controller: landlineController, keyboardType: TextInputType.phone, decoration: _dec('(044) XXX-XXXX'))),
          _field(label: 'Mobile Number', child: TextFormField(controller: mobileController, keyboardType: TextInputType.phone, decoration: _dec('09XX-XXX-XXXX'))),
          _field(label: 'Email Address', child: TextFormField(controller: emailController, keyboardType: TextInputType.emailAddress, decoration: _dec('Email Address'))),
        ]),
      ],
    );
  }
}
