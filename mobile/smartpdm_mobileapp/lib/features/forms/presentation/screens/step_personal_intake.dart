import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/intake_form_ui.dart';
import 'package:smartpdm_mobileapp/shared/formatters/philippine_mobile_input_formatter.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/shared/validation/app_field_validators.dart';

class StepPersonal extends StatefulWidget {
  const StepPersonal({
    super.key,
    required this.data,
    required this.onChanged,
    this.showErrors = false,
  });

  final ApplicationData data;
  final VoidCallback onChanged;
  final bool showErrors;

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
  final List<String> religionOptions = [
    'Roman Catholic',
    'Christian',
    'Iglesia ni Cristo',
    'Islam',
    'Buddhist',
    'Born Again Christian',
    'Seventh-day Adventist',
    'Jehovah`s Witness',
    'None',
    'Other',
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
        'Lambakin',
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
  String? selectedReligion;
  static const String _manualLocationOption = '__manual_location__';

  String? selectedProvince;
  String? selectedCity;
  String? selectedBarangay;
  bool _manualCityEntry = false;
  bool _manualBarangayEntry = false;

  bool get _showOtherReligionField => selectedReligion == 'Other';

  @override
  void initState() {
    super.initState();
    _initControllers();
    widget.data.mobileNumber = mobileController.text;

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
    _bind(cityController, (value) => widget.data.city = value);
    _bind(zipCodeController, (value) => widget.data.zipCode = value);
    _bind(landlineController, (value) => widget.data.landline = value);
    _bind(mobileController, (value) => widget.data.mobileNumber = value);
    _bind(emailController, (value) => widget.data.email = value);
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
    mobileController = TextEditingController(
      text: AppFieldValidators.normalizePhilippineMobile(
        widget.data.mobileNumber,
      ),
    );
    emailController = TextEditingController(text: widget.data.email);

    selectedSex = widget.data.sex.isNotEmpty
        ? widget.data.sex
        : sexOptions.first;
    selectedCivilStatus = widget.data.civilStatus.isNotEmpty
        ? widget.data.civilStatus
        : civilStatusOptions.first;

    final savedReligion = widget.data.religion.trim();
    selectedReligion = religionOptions.contains(savedReligion)
        ? savedReligion
        : savedReligion.isNotEmpty
        ? 'Other'
        : null;

    final province = widget.data.province.trim();
    if (province.isNotEmpty && !locationData.containsKey(province)) {
      locationData[province] = <String, List<String>>{};
    }
    selectedProvince = province.isNotEmpty ? province : null;
    provinceController = TextEditingController(text: selectedProvince ?? '');

    final savedCity = widget.data.city.trim();
    if (selectedProvince != null) {
      final cities =
          locationData[selectedProvince!] ?? const <String, List<String>>{};
      if (cities.isEmpty) {
        _manualCityEntry = true;
      } else if (savedCity.isNotEmpty && cities.containsKey(savedCity)) {
        selectedCity = savedCity;
      } else if (savedCity.isNotEmpty) {
        _manualCityEntry = true;
      }
    }
    cityController = TextEditingController(text: savedCity);

    final savedBarangay = widget.data.barangay.trim();
    if (_manualCityEntry || selectedCity == null) {
      _manualBarangayEntry = selectedProvince != null;
    } else {
      final barangays =
          locationData[selectedProvince!]?[selectedCity!] ?? const <String>[];
      if (barangays.isEmpty) {
        _manualBarangayEntry = true;
      } else if (savedBarangay.isNotEmpty &&
          barangays.contains(savedBarangay)) {
        selectedBarangay = savedBarangay;
      } else if (savedBarangay.isNotEmpty) {
        _manualBarangayEntry = true;
      }
    }
    barangayController = TextEditingController(text: savedBarangay);
  }

  void _bind(TextEditingController controller, void Function(String) setter) {
    controller.addListener(() {
      setter(controller.text);
      widget.onChanged();
    });
  }

  void _updateAgeFromDob(String value) {
    final parsed = ApplicationData.parseInputDate(value);
    if (parsed == null) {
      ageController.text = '';
      widget.data.age = '';
      widget.onChanged();
      return;
    }

    final computedAge = ApplicationData.calculateAge(parsed);
    if (computedAge == null) return;

    ageController.text = computedAge.toString();
    widget.data.age = computedAge.toString();
    widget.onChanged();
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

  String? _nameError(
    String value,
    String label, {
    bool required = true,
    int minLength = 2,
  }) {
    if (!widget.showErrors) return null;
    return AppFieldValidators.name(
      value,
      label: label,
      required: required,
      minLength: minLength,
    );
  }

  String? _zipCodeError() {
    if (!widget.showErrors) return null;
    return AppFieldValidators.zipCode(zipCodeController.text);
  }

  String? _mobileError() {
    if (!widget.showErrors) return null;
    return AppFieldValidators.philippineMobile(mobileController.text);
  }

  String? _emailError() {
    if (!widget.showErrors) return null;
    return AppFieldValidators.email(emailController.text);
  }

  InputDecoration _dec(
    String hint, {
    String? errorText,
    Widget? suffixIcon,
    bool hasValue = false,
  }) => intakeInputDecoration(
    context,
    hint: hint,
    errorText: errorText,
    suffixIcon: suffixIcon,
    hasValue: hasValue,
  );

  Widget _field({required String label, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [intakeFieldLabel(context, label), child],
    );
  }

  Widget _row(List<Widget> items) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 500) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: items
                .asMap()
                .entries
                .map(
                  (entry) => Padding(
                    padding: EdgeInsets.only(
                      bottom: entry.key < items.length - 1 ? 16 : 0,
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
                      right: entry.key < items.length - 1 ? 16 : 0,
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

  Widget _textField({
    required TextEditingController controller,
    required String label,
    required String hint,
    String? errorText,
    bool readOnly = false,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    VoidCallback? onTap,
    Widget? suffixIcon,
  }) {
    return _field(
      label: label,
      child: TextFormField(
        controller: controller,
        readOnly: readOnly,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        onTap: onTap,
        decoration: _dec(
          hint,
          errorText: errorText,
          suffixIcon: suffixIcon ?? intakeCompletionIcon(controller.text),
          hasValue: controller.text.trim().isNotEmpty,
        ),
      ),
    );
  }

  Widget _dropdownField({
    required String label,
    required String hint,
    required String currentValue,
    required List<String> items,
    required ValueChanged<String> onChanged,
    String? errorText,
  }) {
    return _field(
      label: label,
      child: DropdownButtonFormField<String>(
        isExpanded: true,
        initialValue: currentValue.trim().isEmpty ? null : currentValue,
        decoration: _dec(
          hint,
          errorText: errorText,
          suffixIcon: intakeCompletionIcon(currentValue),
          hasValue: currentValue.trim().isNotEmpty,
        ),
        items: items
            .map(
              (item) => DropdownMenuItem(
                value: item,
                child: Text(
                  item == _manualLocationOption ? 'Other / Not Listed' : item,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            )
            .toList(),
        onChanged: (value) {
          if (value == null) return;
          onChanged(value);
        },
      ),
    );
  }

  Widget _sectionCard({required String title, required List<Widget> children}) {
    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 18),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: intakeTextColor(context),
              fontWeight: FontWeight.w900,
              fontSize: 19,
            ),
          ),
          const SizedBox(height: 18),
          ...children,
        ],
      ),
    );
  }

  Future<void> _pickBirthDate() async {
    final initialDate =
        ApplicationData.parseInputDate(widget.data.dateOfBirth) ??
        DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
    );

    if (pickedDate == null) return;

    final formatted =
        '${pickedDate.month.toString().padLeft(2, '0')}/${pickedDate.day.toString().padLeft(2, '0')}/${pickedDate.year}';
    dobController.text = formatted;
    widget.data.dateOfBirth = formatted;
    _updateAgeFromDob(formatted);
  }

  Widget _cityLocationField() {
    if (selectedProvince == null) {
      return _dropdownField(
        label: 'City / Municipality *',
        hint: 'Select province first',
        currentValue: '',
        items: const <String>[],
        onChanged: (_) {},
        errorText: _requiredError(widget.data.city, 'City / Municipality'),
      );
    }

    final cities = locationData[selectedProvince!]!.keys.toList();
    if (cities.isEmpty) {
      return _textField(
        controller: cityController,
        label: 'City / Municipality *',
        hint: 'Enter city / municipality',
        errorText: _requiredError(widget.data.city, 'City / Municipality'),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _dropdownField(
          label: 'City / Municipality *',
          hint: 'Select city / municipality',
          currentValue: _manualCityEntry
              ? _manualLocationOption
              : selectedCity ?? '',
          items: [...cities, _manualLocationOption],
          onChanged: (value) {
            setState(() {
              if (value == _manualLocationOption) {
                _manualCityEntry = true;
                selectedCity = null;
                cityController.clear();
                widget.data.city = '';
                _manualBarangayEntry = true;
                selectedBarangay = null;
                barangayController.clear();
                widget.data.barangay = '';
                zipCodeController.clear();
                widget.data.zipCode = '';
                return;
              }

              _manualCityEntry = false;
              selectedCity = value;
              cityController.text = value;
              widget.data.city = value;
              selectedBarangay = null;
              barangayController.clear();
              widget.data.barangay = '';
              final barangays =
                  locationData[selectedProvince!]?[value] ?? const <String>[];
              _manualBarangayEntry = barangays.isEmpty;
              final zip = cityZipMapping[value] ?? '';
              zipCodeController.text = zip;
              widget.data.zipCode = zip;
            });
            widget.onChanged();
          },
          errorText: _manualCityEntry
              ? null
              : _requiredError(widget.data.city, 'City / Municipality'),
        ),
        if (_manualCityEntry) ...[
          const SizedBox(height: 10),
          _textField(
            controller: cityController,
            label: 'Enter City / Municipality *',
            hint: 'Enter city / municipality',
            errorText: _requiredError(widget.data.city, 'City / Municipality'),
          ),
        ],
      ],
    );
  }

  Widget _barangayLocationField() {
    if (selectedProvince == null) {
      return _dropdownField(
        label: 'Barangay *',
        hint: 'Select province first',
        currentValue: '',
        items: const <String>[],
        onChanged: (_) {},
        errorText: _requiredError(widget.data.barangay, 'Barangay'),
      );
    }

    if (_manualCityEntry) {
      return _textField(
        controller: barangayController,
        label: 'Barangay *',
        hint: 'Enter barangay',
        errorText: _requiredError(widget.data.barangay, 'Barangay'),
      );
    }

    if (selectedCity == null) {
      return _dropdownField(
        label: 'Barangay *',
        hint: 'Select city / municipality first',
        currentValue: '',
        items: const <String>[],
        onChanged: (_) {},
        errorText: _requiredError(widget.data.barangay, 'Barangay'),
      );
    }

    final barangays =
        locationData[selectedProvince!]?[selectedCity!] ?? const <String>[];
    if (barangays.isEmpty) {
      return _textField(
        controller: barangayController,
        label: 'Barangay *',
        hint: 'Enter barangay',
        errorText: _requiredError(widget.data.barangay, 'Barangay'),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _dropdownField(
          label: 'Barangay *',
          hint: 'Select barangay',
          currentValue: _manualBarangayEntry
              ? _manualLocationOption
              : selectedBarangay ?? '',
          items: [...barangays, _manualLocationOption],
          onChanged: (value) {
            setState(() {
              if (value == _manualLocationOption) {
                _manualBarangayEntry = true;
                selectedBarangay = null;
                barangayController.clear();
                widget.data.barangay = '';
                return;
              }

              _manualBarangayEntry = false;
              selectedBarangay = value;
              barangayController.text = value;
              widget.data.barangay = value;
            });
            widget.onChanged();
          },
          errorText: _manualBarangayEntry
              ? null
              : _requiredError(widget.data.barangay, 'Barangay'),
        ),
        if (_manualBarangayEntry) ...[
          const SizedBox(height: 10),
          _textField(
            controller: barangayController,
            label: 'Enter Barangay *',
            hint: 'Enter barangay',
            errorText: _requiredError(widget.data.barangay, 'Barangay'),
          ),
        ],
      ],
    );
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

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IntakeSectionHeader(
          title: 'I. PERSONAL DATA',
          icon: Icons.account_circle_outlined,
          bottomSpacing: 22,
        ),
        _sectionCard(
          title: 'Basic Information',
          children: [
            _row([
              _textField(
                controller: lastNameController,
                label: 'Last Name *',
                hint: 'Pascual',
                errorText: _nameError(lastNameController.text, 'Last name'),
              ),
              _textField(
                controller: firstNameController,
                label: 'First Name *',
                hint: 'Jomar Paul',
                errorText: _nameError(firstNameController.text, 'First name'),
              ),
            ]),
            const SizedBox(height: 18),
            _row([
              _textField(
                controller: middleNameController,
                label: 'Middle Name (Optional)',
                hint: 'Gutierrez',
                errorText: _nameError(
                  middleNameController.text,
                  'Middle name',
                  required: false,
                  minLength: 1,
                ),
              ),
              _textField(
                controller: maidenNameController,
                label: 'Maiden Name (if married)',
                hint: 'Enter maiden name if applicable',
                errorText: _nameError(
                  maidenNameController.text,
                  'Maiden name',
                  required: false,
                ),
              ),
            ]),
            const SizedBox(height: 18),
            _row([
              _textField(
                controller: ageController,
                label: 'Age *',
                hint: 'Auto-calculated',
                readOnly: true,
                errorText: _ageError(),
              ),
              _textField(
                controller: dobController,
                label: 'Date of Birth *',
                hint: '11/29/2007',
                readOnly: true,
                onTap: _pickBirthDate,
                errorText: _dobError(),
                suffixIcon: const Icon(
                  Icons.calendar_month_outlined,
                  color: AppColors.brown,
                ),
              ),
            ]),
            const SizedBox(height: 18),
            _row([
              _dropdownField(
                label: 'Sex *',
                hint: 'Select sex',
                currentValue: selectedSex,
                items: sexOptions,
                errorText: _requiredError(selectedSex, 'Sex'),
                onChanged: (value) {
                  setState(() => selectedSex = value);
                  widget.data.sex = value;
                  widget.onChanged();
                },
              ),
              _textField(
                controller: placeOfBirthController,
                label: 'Place of Birth *',
                hint: 'Marilao',
                errorText: _requiredError(
                  placeOfBirthController.text,
                  'Place of birth',
                ),
              ),
            ]),
            const SizedBox(height: 18),
            _row([
              _textField(
                controller: citizenshipController,
                label: 'Citizenship *',
                hint: 'Filipino',
                errorText: _requiredError(
                  citizenshipController.text,
                  'Citizenship',
                ),
              ),
              _dropdownField(
                label: 'Civil Status *',
                hint: 'Select civil status',
                currentValue: selectedCivilStatus,
                items: civilStatusOptions,
                errorText: _requiredError(selectedCivilStatus, 'Civil status'),
                onChanged: (value) {
                  setState(() => selectedCivilStatus = value);
                  widget.data.civilStatus = value;
                  widget.onChanged();
                },
              ),
            ]),
            const SizedBox(height: 18),
            _dropdownField(
              label: 'Religion *',
              hint: 'Select religion',
              currentValue: selectedReligion ?? '',
              items: religionOptions,
              errorText: _requiredError(widget.data.religion, 'Religion'),
              onChanged: (value) {
                setState(() {
                  selectedReligion = value;
                  if (value == 'Other') {
                    if (religionController.text.trim() == value) {
                      religionController.clear();
                      widget.data.religion = '';
                    }
                  } else {
                    religionController.text = value;
                    widget.data.religion = value;
                  }
                });
                widget.onChanged();
              },
            ),
            if (_showOtherReligionField) ...[
              const SizedBox(height: 16),
              _textField(
                controller: religionController,
                label: 'Specify Religion *',
                hint: 'Other',
                errorText: _requiredError(widget.data.religion, 'Religion'),
              ),
            ],
          ],
        ),
        _sectionCard(
          title: 'Permanent Address',
          children: [
            _row([
              _textField(
                controller: unitBldgNoController,
                label: 'RM/FLR/UNIT NO. BLDG NAME',
                hint: 'Unit 5, Bldg. 12',
              ),
              _textField(
                controller: houseLotBlockNoController,
                label: 'HOUSE/LOT/BLOCK NO.',
                hint: 'Lot 8, Block 3',
              ),
            ]),
            const SizedBox(height: 16),
            _row([
              _textField(
                controller: streetController,
                label: 'Street',
                hint: '288 Quezon Blvd, Brgy. Baritan',
              ),
              _textField(
                controller: subdivisionController,
                label: 'Subdivision',
                hint: 'Enter subdivision (optional)',
              ),
            ]),
            const SizedBox(height: 16),
            _row([
              _dropdownField(
                label: 'Province *',
                hint: 'Select province',
                currentValue: selectedProvince ?? '',
                items: locationData.keys.toList(),
                onChanged: (value) {
                  setState(() {
                    selectedProvince = value;
                    provinceController.text = value;
                    widget.data.province = value;
                    selectedCity = null;
                    _manualCityEntry = locationData[value]!.isEmpty;
                    cityController.clear();
                    widget.data.city = '';
                    selectedBarangay = null;
                    _manualBarangayEntry = true;
                    barangayController.clear();
                    widget.data.barangay = '';
                    zipCodeController.clear();
                    widget.data.zipCode = '';
                  });
                  widget.onChanged();
                },
                errorText: _requiredError(widget.data.province, 'Province'),
              ),
              _cityLocationField(),
            ]),
            const SizedBox(height: 16),
            _row([
              _barangayLocationField(),
              _textField(
                controller: zipCodeController,
                label: 'ZIP Code *',
                hint: '3019',
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(4),
                ],
                errorText: _zipCodeError(),
              ),
            ]),
          ],
        ),
        const IntakeSectionHeader(title: 'CONTACT INFORMATION'),
        _sectionCard(
          title: 'Contact Details',
          children: [
            _textField(
              controller: landlineController,
              label: 'Landline',
              hint: '(044) XXX-XXXX',
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 16),
            _textField(
              controller: mobileController,
              label: 'Mobile Number *',
              hint: '09123456789',
              keyboardType: TextInputType.phone,
              inputFormatters: const [PhilippineMobileInputFormatter()],
              errorText: _mobileError(),
            ),
            const SizedBox(height: 16),
            _textField(
              controller: emailController,
              label: 'Email Address *',
              hint: 'name@example.com',
              keyboardType: TextInputType.emailAddress,
              errorText: _emailError(),
            ),
          ],
        ),
        const IntakeInfoCard(
          title: 'We value your privacy',
          message:
              'Your information will be used only for scholarship processing and will not be shared with third parties.',
          icon: Icons.verified_user_outlined,
        ),
      ],
    );
  }
}
