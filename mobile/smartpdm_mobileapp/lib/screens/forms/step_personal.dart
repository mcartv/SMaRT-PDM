import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';

class StepPersonal extends StatefulWidget {
  final ApplicationData data;
  final VoidCallback onChanged;
  final bool showErrors;
  const StepPersonal({
    super.key,
    required this.data,
    required this.onChanged,
    this.showErrors = false,
  });

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
  late final TextEditingController unitBldgNoController;
  late final TextEditingController houseLotBlockNoController;
  late final TextEditingController streetController;
  late final TextEditingController subdivisionController;
  late final TextEditingController provinceController;
  late final TextEditingController barangayController;
  late final TextEditingController cityController;
  late final TextEditingController zipCodeController;
  late final TextEditingController landlineController;
  late final TextEditingController mobileController;
  late final TextEditingController emailController;

  final List<String> sexOptions = ['Male', 'Female', 'Other'];
  final List<String> civilStatusOptions = [
    'Single',
    'Married',
    'Widowed',
    'Separated',
    'Divorced',
  ];

  final Map<String, Map<String, List<String>>> locationData = {
    'Abra': {},
    'Agusan del Norte': {},
    'Agusan del Sur': {},
    'Aklan': {},
    'Albay': {},
    'Antique': {},
    'Apayao': {},
    'Aurora': {},
    'Basilan': {},
    'Bataan': {},
    'Batanes': {},
    'Batangas': {},
    'Benguet': {},
    'Biliran': {},
    'Bohol': {},
    'Bukidnon': {},
    'Bulacan': {
      'Marilao': [
        'Abangan Norte',
        'Abangan Sur',
        'Ibayo',
        'Lias',
        'Loma de Gato',
        'Nagbalon',
        'Patubig',
        'Poblacion I',
        'Poblacion II',
        'Prenza I',
        'Prenza II',
        'Santa Rosa I',
        'Santa Rosa II',
        'Saog',
        'Tabing Ilog',
      ],
      'Meycauayan': [
        'Bancal',
        'Lawa',
        'Malhacan',
        'Perez',
        'Saluysoy',
        'Tugatog',
      ],
      'Obando': [
        'Bugarin',
        'Catanghalan',
        'Lawang Bato',
        'Pagalangang',
        'Paco',
      ],
      'Bocaue': [
        'Antipona',
        'Bagumbayan',
        'Bambang',
        'Batia',
        'Biñang 1st',
        'Biñang 2nd',
        'Bolacan',
        'Bundukan',
        'Bunlo',
        'Caingin',
        'Duhat',
        'Igulot',
        'Lolomboy',
        'Poblacion',
        'Sulucan',
        'Taal',
        'Tambobong',
        'Turo',
        'Wakas',
      ],
      'Santa Maria': [
        'Bagbaguin',
        'Balasing',
        'Buenavista',
        'Bulac',
        'Camangyanan',
        'Catmon',
        'Cay Pombo',
        'Caysio',
        'Guyong',
        'Lalakhan',
        'Mag-asawang Sapa',
        'Mahabang Parang',
        'Manggahan',
        'Parada',
        'Poblacion',
        'Pulong Buhangin',
        'San Gabriel',
        'San Jose Patag',
        'San Vicente',
        'Santa Clara',
        'Santa Cruz',
        'Silangan',
        'Tabing Bakod',
        'Tumana',
      ],
      'San Jose del Monte': [
        'Assumption',
        'Bagong Buhay',
        'Ciudad Real',
        'Dulong Bayan',
        'Fatima',
        'Gaya-Gaya',
        'Graceville',
        'Gumaoc',
        'Kaypian',
        'Maharlika',
        'Minuyan',
        'Muzon',
        'Poblacion',
        'San Isidro',
        'San Manuel',
        'San Martin',
        'San Pedro',
        'San Rafael',
        'San Roque',
        'Santo Cristo',
        'Santo Niño',
        'Tungkong Mangga',
      ],
    },
    'Cagayan': {},
    'Camarines Norte': {},
    'Camarines Sur': {},
    'Camiguin': {},
    'Capiz': {},
    'Catanduanes': {},
    'Cavite': {},
    'Cebu': {},
    'Cotabato': {},
    'Davao de Oro': {},
    'Davao del Norte': {},
    'Davao del Sur': {},
    'Davao Occidental': {},
    'Davao Oriental': {},
    'Dinagat Islands': {},
    'Eastern Samar': {},
    'Guimaras': {},
    'Ifugao': {},
    'Ilocos Norte': {},
    'Ilocos Sur': {},
    'Iloilo': {},
    'Isabela': {},
    'Kalinga': {},
    'La Union': {},
    'Laguna': {},
    'Lanao del Norte': {},
    'Lanao del Sur': {},
    'Leyte': {},
    'Maguindanao del Norte': {},
    'Maguindanao del Sur': {},
    'Marinduque': {},
    'Masbate': {},
    'Metro Manila': {
      'Valenzuela': [
        'Bignay',
        'Biling',
        'Canumay',
        'Dalandanan',
        'Gen. T. de Leon',
        'Karuhatan',
        'Lingunan',
        'Malanday',
        'Malinta',
        'Mapulang Lupa',
        'Marulas',
        'Maysan',
        'Pariancillo Villa',
        'Paso de Blas',
        'Pasolo',
        'Poblacion',
        'Polo',
        'Punturin',
        'Rincon',
        'Tagalag',
        'Ugong',
        'Viente Reales',
      ],
      'Quezon City': [
        'Bagong Pag-asa',
        'Diliman',
        'Commonwealth',
        'Batasan Hills',
        'Fairview',
        'Novaliches',
      ],
      'Manila': [
        'Ermita',
        'Malate',
        'Sampaloc',
        'Tondo',
        'Binondo',
        'Intramuros',
      ],
      'Caloocan': [
        'Bagong Barrio',
        'Bagong Silang',
        'Camarin',
        'Grace Park',
        'Tala',
      ],
    },
    'Misamis Occidental': {},
    'Misamis Oriental': {},
    'Mountain Province': {},
    'Negros Occidental': {},
    'Negros Oriental': {},
    'Northern Samar': {},
    'Nueva Ecija': {},
    'Nueva Vizcaya': {},
    'Occidental Mindoro': {},
    'Oriental Mindoro': {},
    'Palawan': {},
    'Pampanga': {},
    'Pangasinan': {},
    'Quezon': {},
    'Quirino': {},
    'Rizal': {},
    'Romblon': {},
    'Samar': {},
    'Sarangani': {},
    'Siquijor': {},
    'Sorsogon': {},
    'South Cotabato': {},
    'Southern Leyte': {},
    'Sultan Kudarat': {},
    'Sulu': {},
    'Surigao del Norte': {},
    'Surigao del Sur': {},
    'Tarlac': {},
    'Tawi-Tawi': {},
    'Zambales': {},
    'Zamboanga del Norte': {},
    'Zamboanga del Sur': {},
    'Zamboanga Sibugay': {},
  };

  final Map<String, String> cityZipMapping = {
    'Marilao': '3019',
    'Meycauayan': '3020',
    'Obando': '3016',
    'Bocaue': '3018',
    'Santa Maria': '3022',
    'San Jose del Monte': '3023',
    'Valenzuela': '1440',
    'Quezon City': '1100',
    'Manila': '1000',
    'Caloocan': '1400',
  };

  String selectedSex = 'Male';
  String selectedCivilStatus = 'Single';
  String? selectedProvince;
  String? selectedCity;
  String? selectedBarangay;

  int? get _currentAge => ApplicationData.parseAgeValue(ageController.text);

  void _setAge(int value) {
    final safeValue = value < 16 ? 16 : value;
    ageController.text = safeValue.toString();
    widget.data.age = safeValue.toString();
    widget.onChanged();
  }

  void _incrementAge() {
    final nextValue = (_currentAge ?? 15) + 1;
    _setAge(nextValue);
  }

  void _decrementAge() {
    final currentValue = _currentAge ?? 16;
    if (currentValue <= 16) {
      _setAge(16);
      return;
    }
    _setAge(currentValue - 1);
  }

  String? _requiredError(String value, String label) {
    if (!widget.showErrors) return null;
    return value.trim().isEmpty ? '$label is required.' : null;
  }

  String? _ageError() {
    if (!widget.showErrors) return null;
    final value = ageController.text.trim();
    if (value.isEmpty) return 'Age is required.';
    final age = ApplicationData.parseAgeValue(value);
    if (age == null) return 'Age must be a valid number.';
    if (age < 16) return 'Age must be at least 16.';
    final birthDate = ApplicationData.parseInputDate(dobController.text);
    final computedAge = ApplicationData.calculateAge(birthDate);
    if (birthDate != null && computedAge != null && computedAge != age) {
      return 'Age must match the selected date of birth.';
    }
    return null;
  }

  String? _dobError() {
    if (!widget.showErrors) return null;
    final value = dobController.text.trim();
    if (value.isEmpty) return 'Date of birth is required.';
    final birthDate = ApplicationData.parseInputDate(value);
    if (birthDate == null || birthDate.isAfter(DateTime.now())) {
      return 'Date of birth must be a valid past date.';
    }
    final age = ApplicationData.parseAgeValue(ageController.text);
    final computedAge = ApplicationData.calculateAge(birthDate);
    if (age != null && computedAge != null && computedAge != age) {
      return 'Date of birth must match the selected age.';
    }
    return null;
  }

  String? _mobileError() {
    if (!widget.showErrors) return null;
    final rawMobile = mobileController.text.trim();
    final normalizedMobile = ApplicationData.normalizeMobileNumber(rawMobile);
    if (normalizedMobile.isEmpty) return 'Mobile number is required.';
    if (!RegExp(
      r'^\+?\d+$',
    ).hasMatch(rawMobile.replaceAll(RegExp(r'[\s-]+'), ''))) {
      return 'Mobile number must contain digits only.';
    }
    if (!normalizedMobile.startsWith('09')) {
      return 'Mobile number must start with 09 or +639.';
    }
    if (normalizedMobile.length < 11) return 'Mobile number is too short.';
    if (normalizedMobile.length > 11) return 'Mobile number is too long.';
    return null;
  }

  String? _emailError() {
    if (!widget.showErrors || emailController.text.trim().isEmpty) return null;
    final email = emailController.text.trim();
    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    return emailRegex.hasMatch(email) ? null : 'Please enter a valid email.';
  }

  void _initControllers() {
    firstNameController = TextEditingController(text: widget.data.firstName);
    middleNameController = TextEditingController(text: widget.data.middleName);
    lastNameController = TextEditingController(text: widget.data.lastName);
    maidenNameController = TextEditingController(text: widget.data.maidenName);
    ageController = TextEditingController(text: widget.data.age);
    dobController = TextEditingController(text: widget.data.dateOfBirth);
    placeOfBirthController = TextEditingController(
      text: widget.data.placeOfBirth,
    );
    citizenshipController = TextEditingController(
      text: widget.data.citizenship,
    );
    religionController = TextEditingController(text: widget.data.religion);
    unitBldgNoController = TextEditingController(text: widget.data.unitBldgNo);
    houseLotBlockNoController = TextEditingController(
      text: widget.data.houseLotBlockNo,
    );
    streetController = TextEditingController(text: widget.data.street);
    subdivisionController = TextEditingController(
      text: widget.data.subdivision,
    );
    zipCodeController = TextEditingController(text: widget.data.zipCode);
    landlineController = TextEditingController(text: widget.data.landline);
    mobileController = TextEditingController(text: widget.data.mobileNumber);
    emailController = TextEditingController(text: widget.data.email);

    selectedSex = widget.data.sex.isNotEmpty
        ? widget.data.sex
        : sexOptions.first;
    selectedCivilStatus = widget.data.civilStatus.isNotEmpty
        ? widget.data.civilStatus
        : civilStatusOptions.first;

    final province = widget.data.province;
    selectedProvince = locationData.containsKey(province) ? province : null;
    provinceController = TextEditingController(text: selectedProvince ?? '');

    if (selectedProvince != null) {
      final city = widget.data.city;
      selectedCity =
          (locationData[selectedProvince!]?.containsKey(city) ?? false)
          ? city
          : null;
    }
    cityController = TextEditingController(text: selectedCity ?? '');

    if (selectedProvince != null && selectedCity != null) {
      final barangay = widget.data.barangay;
      selectedBarangay =
          (locationData[selectedProvince!]![selectedCity!]?.contains(
                barangay,
              ) ??
              false)
          ? barangay
          : null;
    }
    barangayController = TextEditingController(text: selectedBarangay ?? '');
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
    _initControllers();

    _bind(firstNameController, (value) => widget.data.firstName = value);
    _bind(middleNameController, (value) => widget.data.middleName = value);
    _bind(lastNameController, (value) => widget.data.lastName = value);
    _bind(maidenNameController, (value) => widget.data.maidenName = value);
    _bind(ageController, (value) => widget.data.age = value);
    _bind(dobController, (value) => widget.data.dateOfBirth = value);
    _bind(placeOfBirthController, (value) => widget.data.placeOfBirth = value);
    _bind(citizenshipController, (value) => widget.data.citizenship = value);
    _bind(religionController, (value) => widget.data.religion = value);
    _bind(unitBldgNoController, (value) => widget.data.unitBldgNo = value);
    _bind(
      houseLotBlockNoController,
      (value) => widget.data.houseLotBlockNo = value,
    );
    _bind(streetController, (value) => widget.data.street = value);
    _bind(subdivisionController, (value) => widget.data.subdivision = value);
    _bind(provinceController, (value) => widget.data.province = value);
    _bind(barangayController, (value) => widget.data.barangay = value);
    _bind(zipCodeController, (value) => widget.data.zipCode = value);
    _bind(landlineController, (value) => widget.data.landline = value);
    _bind(mobileController, (value) => widget.data.mobileNumber = value);
    _bind(emailController, (value) => widget.data.email = value);
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
    unitBldgNoController.dispose();
    houseLotBlockNoController.dispose();
    streetController.dispose();
    subdivisionController.dispose();
    provinceController.dispose();
    barangayController.dispose();
    cityController.dispose();
    zipCodeController.dispose();
    landlineController.dispose();
    mobileController.dispose();
    emailController.dispose();
    super.dispose();
  }

  InputDecoration _dec(String hint) => InputDecoration(
    hintText: hint,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
  );

  Widget _field({required String label, required Widget child}) {
    return Column(
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
  }

  Widget _row(List<Widget> items) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 600) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: items
                .asMap()
                .entries
                .map(
                  (entry) => Padding(
                    padding: EdgeInsets.only(
                      bottom: entry.key < items.length - 1 ? 16.0 : 0,
                    ),
                    child: entry.value,
                  ),
                )
                .toList(),
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: items
              .asMap()
              .entries
              .map(
                (entry) => Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      right: entry.key < items.length - 1 ? 16.0 : 0,
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

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'I. PERSONAL DATA',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.brown,
            ),
          ),
          const Divider(color: Colors.orange, thickness: 2),
          const SizedBox(height: 20),
          _row([
            _field(
              label: 'Last Name *',
              child: TextFormField(
                controller: lastNameController,
                decoration: _dec('Last Name').copyWith(
                  errorText: _requiredError(
                    lastNameController.text,
                    'Last name',
                  ),
                ),
              ),
            ),
            _field(
              label: 'First Name *',
              child: TextFormField(
                controller: firstNameController,
                decoration: _dec('First Name').copyWith(
                  errorText: _requiredError(
                    firstNameController.text,
                    'First name',
                  ),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 20),
          _row([
            _field(
              label: 'Middle Name',
              child: TextFormField(
                controller: middleNameController,
                decoration: _dec('Middle Name'),
              ),
            ),
            _field(
              label: 'Maiden Name (if married)',
              child: TextFormField(
                controller: maidenNameController,
                decoration: _dec('Maiden Name'),
              ),
            ),
          ]),
          const SizedBox(height: 20),
          _row([
            _field(
              label: 'Age *',
              child: InputDecorator(
                decoration: _dec('Age').copyWith(errorText: _ageError()),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        (_currentAge ?? 16).toString(),
                        style: const TextStyle(fontSize: 16),
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          height: 28,
                          width: 28,
                          child: IconButton(
                            padding: EdgeInsets.zero,
                            iconSize: 18,
                            onPressed: _incrementAge,
                            icon: const Icon(Icons.keyboard_arrow_up),
                          ),
                        ),
                        SizedBox(
                          height: 28,
                          width: 28,
                          child: IconButton(
                            padding: EdgeInsets.zero,
                            iconSize: 18,
                            onPressed: _decrementAge,
                            icon: const Icon(Icons.keyboard_arrow_down),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            _field(
              label: 'Date of Birth *',
              child: TextFormField(
                controller: dobController,
                readOnly: true,
                decoration: _dec('mm/dd/yyyy').copyWith(
                  suffixIcon: const Icon(Icons.calendar_month),
                  errorText: _dobError(),
                ),
                onTap: () async {
                  final initialDate =
                      ApplicationData.parseInputDate(widget.data.dateOfBirth) ??
                      DateTime.now();
                  final pickedDate = await showDatePicker(
                    context: context,
                    initialDate: initialDate,
                    firstDate: DateTime(1900),
                    lastDate: DateTime.now(),
                  );

                  if (pickedDate != null) {
                    final formatted =
                        '${pickedDate.month.toString().padLeft(2, '0')}/${pickedDate.day.toString().padLeft(2, '0')}/${pickedDate.year}';
                    dobController.text = formatted;
                    widget.data.dateOfBirth = formatted;
                    widget.onChanged();
                  }
                },
              ),
            ),
            _field(
              label: 'Sex *',
              child: DropdownButtonFormField<String>(
                initialValue: selectedSex,
                decoration: _dec(
                  'Sex',
                ).copyWith(errorText: _requiredError(selectedSex, 'Sex')),
                items: sexOptions
                    .map(
                      (option) =>
                          DropdownMenuItem(value: option, child: Text(option)),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() => selectedSex = value);
                  widget.data.sex = value;
                  widget.onChanged();
                },
              ),
            ),
          ]),
          const SizedBox(height: 20),
          _row([
            _field(
              label: 'Place of Birth *',
              child: TextFormField(
                controller: placeOfBirthController,
                decoration: _dec('Place of Birth').copyWith(
                  errorText: _requiredError(
                    placeOfBirthController.text,
                    'Place of birth',
                  ),
                ),
              ),
            ),
            _field(
              label: 'Citizenship *',
              child: TextFormField(
                controller: citizenshipController,
                decoration: _dec('Citizenship').copyWith(
                  errorText: _requiredError(
                    citizenshipController.text,
                    'Citizenship',
                  ),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 20),
          _row([
            _field(
              label: 'Civil Status *',
              child: DropdownButtonFormField<String>(
                initialValue: selectedCivilStatus,
                decoration: _dec('Civil Status').copyWith(
                  errorText: _requiredError(
                    selectedCivilStatus,
                    'Civil status',
                  ),
                ),
                items: civilStatusOptions
                    .map(
                      (status) =>
                          DropdownMenuItem(value: status, child: Text(status)),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() => selectedCivilStatus = value);
                  widget.data.civilStatus = value;
                  widget.onChanged();
                },
              ),
            ),
            _field(
              label: 'Religion *',
              child: TextFormField(
                controller: religionController,
                decoration: _dec('Religion').copyWith(
                  errorText: _requiredError(
                    religionController.text,
                    'Religion',
                  ),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 32),
          const Text(
            'PERMANENT ADDRESS',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.brown,
            ),
          ),
          const SizedBox(height: 20),
          _row([
            _field(
              label: 'RM/FLR/UNIT NO. BLDG NAME',
              child: TextFormField(
                controller: unitBldgNoController,
                decoration: _dec('RM/FLR/UNIT NO. BLDG NAME'),
              ),
            ),
            _field(
              label: 'HOUSE/LOT/BLOCK NO.',
              child: TextFormField(
                controller: houseLotBlockNoController,
                decoration: _dec('HOUSE/LOT/BLOCK NO.'),
              ),
            ),
          ]),
          const SizedBox(height: 20),
          _row([
            _field(
              label: 'Street',
              child: TextFormField(
                controller: streetController,
                decoration: _dec('Street'),
              ),
            ),
            _field(
              label: 'Subdivision',
              child: TextFormField(
                controller: subdivisionController,
                decoration: _dec('Subdivision'),
              ),
            ),
          ]),
          const SizedBox(height: 20),
          _row([
            _field(
              label: 'Province',
              child: DropdownButtonFormField<String>(
                initialValue: selectedProvince,
                hint: const Text('Select...'),
                decoration: _dec('Province'),
                items: locationData.keys
                    .map(
                      (province) => DropdownMenuItem(
                        value: province,
                        child: Text(province),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() {
                    selectedProvince = value;
                    widget.data.province = value;
                    provinceController.text = value;
                    selectedCity = null;
                    widget.data.city = '';
                    cityController.text = '';
                    selectedBarangay = null;
                    widget.data.barangay = '';
                    barangayController.text = '';
                    zipCodeController.text = '';
                    widget.data.zipCode = '';
                  });
                  widget.onChanged();
                },
              ),
            ),
            _field(
              label: 'City / Municipality',
              child: DropdownButtonFormField<String>(
                initialValue: selectedCity,
                hint: const Text('Select...'),
                decoration: _dec('City / Municipality'),
                items:
                    (selectedProvince != null
                            ? locationData[selectedProvince!]!.keys
                            : <String>[])
                        .map(
                          (city) =>
                              DropdownMenuItem(value: city, child: Text(city)),
                        )
                        .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() {
                    selectedCity = value;
                    widget.data.city = value;
                    cityController.text = value;
                    selectedBarangay = null;
                    widget.data.barangay = '';
                    barangayController.text = '';
                    final zip = cityZipMapping[value] ?? '';
                    zipCodeController.text = zip;
                    widget.data.zipCode = zip;
                  });
                  widget.onChanged();
                },
              ),
            ),
          ]),
          const SizedBox(height: 20),
          _row([
            _field(
              label: 'Barangay',
              child: DropdownButtonFormField<String>(
                initialValue: selectedBarangay,
                hint: const Text('Select...'),
                decoration: _dec('Barangay'),
                items:
                    (selectedProvince != null && selectedCity != null
                            ? locationData[selectedProvince!]![selectedCity!] ??
                                  <String>[]
                            : <String>[])
                        .map(
                          (barangay) => DropdownMenuItem(
                            value: barangay,
                            child: Text(barangay),
                          ),
                        )
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
            _field(
              label: 'ZIP Code',
              child: TextFormField(
                controller: zipCodeController,
                keyboardType: TextInputType.number,
                decoration: _dec('3019'),
              ),
            ),
          ]),
          const SizedBox(height: 32),
          const Text(
            'CONTACT INFORMATION',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.brown,
            ),
          ),
          const SizedBox(height: 20),
          _row([
            _field(
              label: 'Landline',
              child: TextFormField(
                controller: landlineController,
                keyboardType: TextInputType.phone,
                decoration: _dec('(044) XXX-XXXX'),
              ),
            ),
            _field(
              label: 'Mobile Number *',
              child: TextFormField(
                controller: mobileController,
                keyboardType: TextInputType.phone,
                decoration: _dec(
                  '09XXXXXXXXX',
                ).copyWith(errorText: _mobileError()),
              ),
            ),
            _field(
              label: 'Email Address',
              child: TextFormField(
                controller: emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: _dec(
                  'Email Address',
                ).copyWith(errorText: _emailError()),
              ),
            ),
          ]),
        ],
      ),
    );
  }
}
