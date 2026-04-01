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
  late final TextEditingController provinceController;
  late final TextEditingController barangayController;
  late final TextEditingController cityController;
  late final TextEditingController zipCodeController;
  late final TextEditingController landlineController;
  late final TextEditingController mobileController;
  late final TextEditingController emailController;

  final List<String> sexOptions = ['Male', 'Female', 'Other'];
  final List<String> civilStatusOptions = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'];

  // Nested map for Province -> City/Municipality -> Barangay
  final Map<String, Map<String, List<String>>> locationData = {
    'Abra': {}, 'Agusan del Norte': {}, 'Agusan del Sur': {}, 'Aklan': {}, 'Albay': {}, 'Antique': {}, 'Apayao': {}, 'Aurora': {}, 'Basilan': {}, 'Bataan': {}, 'Batanes': {}, 'Batangas': {}, 'Benguet': {}, 'Biliran': {}, 'Bohol': {}, 'Bukidnon': {},
    'Bulacan': {
      'Marilao': ['Abangan Norte', 'Abangan Sur', 'Ibayo', 'Lias', 'Loma de Gato', 'Nagbalon', 'Patubig', 'Poblacion I', 'Poblacion II', 'Prenza I', 'Prenza II', 'Santa Rosa I', 'Santa Rosa II', 'Saog', 'Tabing Ilog'],
      'Meycauayan': ['Bancal', 'Lawa', 'Malhacan', 'Perez', 'Saluysoy', 'Tugatog'],
      'Obando': ['Bugarin', 'Catanghalan', 'Lawang Bato', 'Pagalangang', 'Paco'],
      'Bocaue': ['Antipona', 'Bagumbayan', 'Bambang', 'Batia', 'Biñang 1st', 'Biñang 2nd', 'Bolacan', 'Bundukan', 'Bunlo', 'Caingin', 'Duhat', 'Igulot', 'Lolomboy', 'Poblacion', 'Sulucan', 'Taal', 'Tambobong', 'Turo', 'Wakas'],
      'Santa Maria': ['Bagbaguin', 'Balasing', 'Buenavista', 'Bulac', 'Camangyanan', 'Catmon', 'Cay Pombo', 'Caysio', 'Guyong', 'Lalakhan', 'Mag-asawang Sapa', 'Mahabang Parang', 'Manggahan', 'Parada', 'Poblacion', 'Pulong Buhangin', 'San Gabriel', 'San Jose Patag', 'San Vicente', 'Santa Clara', 'Santa Cruz', 'Silangan', 'Tabing Bakod', 'Tumana'],
      'San Jose del Monte': ['Assumption', 'Bagong Buhay', 'Ciudad Real', 'Dulong Bayan', 'Fatima', 'Gaya-Gaya', 'Graceville', 'Gumaoc', 'Kaypian', 'Maharlika', 'Minuyan', 'Muzon', 'Poblacion', 'San Isidro', 'San Manuel', 'San Martin', 'San Pedro', 'San Rafael', 'San Roque', 'Santo Cristo', 'Santo Niño', 'Tungkong Mangga'],
    },
    'Cagayan': {}, 'Camarines Norte': {}, 'Camarines Sur': {}, 'Camiguin': {}, 'Capiz': {}, 'Catanduanes': {}, 'Cavite': {}, 'Cebu': {}, 'Cotabato': {}, 'Davao de Oro': {}, 'Davao del Norte': {}, 'Davao del Sur': {}, 'Davao Occidental': {}, 'Davao Oriental': {}, 'Dinagat Islands': {}, 'Eastern Samar': {}, 'Guimaras': {}, 'Ifugao': {}, 'Ilocos Norte': {}, 'Ilocos Sur': {}, 'Iloilo': {}, 'Isabela': {}, 'Kalinga': {}, 'La Union': {}, 'Laguna': {}, 'Lanao del Norte': {}, 'Lanao del Sur': {}, 'Leyte': {}, 'Maguindanao del Norte': {}, 'Maguindanao del Sur': {}, 'Marinduque': {}, 'Masbate': {},
    'Metro Manila': {
        'Valenzuela': ['Bignay', 'Biling', 'Canumay', 'Dalandanan', 'Gen. T. de Leon', 'Karuhatan', 'Lingunan', 'Malanday', 'Malinta', 'Mapulang Lupa', 'Marulas', 'Maysan', 'Pariancillo Villa', 'Paso de Blas', 'Pasolo', 'Poblacion', 'Polo', 'Punturin', 'Rincon', 'Tagalag', 'Ugong', 'Viente Reales'],
        'Quezon City': ['Bagong Pag-asa', 'Diliman', 'Commonwealth', 'Batasan Hills', 'Fairview', 'Novaliches'],
        'Manila': ['Ermita', 'Malate', 'Sampaloc', 'Tondo', 'Binondo', 'Intramuros'],
        'Caloocan': ['Bagong Barrio', 'Bagong Silang', 'Camarin', 'Grace Park', 'Tala'],
    },
    'Misamis Occidental': {}, 'Misamis Oriental': {}, 'Mountain Province': {}, 'Negros Occidental': {}, 'Negros Oriental': {}, 'Northern Samar': {}, 'Nueva Ecija': {}, 'Nueva Vizcaya': {}, 'Occidental Mindoro': {}, 'Oriental Mindoro': {}, 'Palawan': {}, 'Pampanga': {}, 'Pangasinan': {}, 'Quezon': {}, 'Quirino': {}, 'Rizal': {}, 'Romblon': {}, 'Samar': {}, 'Sarangani': {}, 'Siquijor': {}, 'Sorsogon': {}, 'South Cotabato': {}, 'Southern Leyte': {}, 'Sultan Kudarat': {}, 'Sulu': {}, 'Surigao del Norte': {}, 'Surigao del Sur': {}, 'Tarlac': {}, 'Tawi-Tawi': {}, 'Zambales': {}, 'Zamboanga del Norte': {}, 'Zamboanga del Sur': {}, 'Zamboanga Sibugay': {},
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
    zipCodeController = TextEditingController(text: widget.data.zipCode);
    landlineController = TextEditingController(text: widget.data.landline);
    mobileController = TextEditingController(text: widget.data.mobileNumber);
    emailController = TextEditingController(text: widget.data.email);

    selectedSex = widget.data.sex.isNotEmpty ? widget.data.sex : sexOptions.first;
    selectedCivilStatus = widget.data.civilStatus.isNotEmpty ? widget.data.civilStatus : civilStatusOptions.first;

    final p = widget.data.province;
    selectedProvince = locationData.containsKey(p) ? p : null;
    provinceController = TextEditingController(text: selectedProvince ?? '');

    if (selectedProvince != null) {
      final c = widget.data.city;
      selectedCity = (locationData[selectedProvince!]?.containsKey(c) ?? false) ? c : null;
    } else {
      selectedCity = null;
    }
    cityController = TextEditingController(text: selectedCity ?? '');

    if (selectedProvince != null && selectedCity != null) {
      final b = widget.data.barangay;
      selectedBarangay = (locationData[selectedProvince!]![selectedCity!]?.contains(b) ?? false) ? b : null;
    } else {
      selectedBarangay = null;
    }
    barangayController = TextEditingController(text: selectedBarangay ?? '');
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
    _bindListener(provinceController, (value) => widget.data.province = value);
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
    provinceController.dispose();
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
        const SizedBox(height: 8),
        child,
      ],
    );
  }

  InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      );

  Widget _row(List<Widget> items) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 600) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: items.asMap().entries.map((entry) => Padding(
              padding: EdgeInsets.only(bottom: entry.key < items.length - 1 ? 16.0 : 0),
              child: entry.value,
            )).toList(),
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: items
              .asMap()
              .entries
              .map((entry) => Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(right: entry.key < items.length - 1 ? 16.0 : 0),
                      child: entry.value,
                    ),
                  ))
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
          const Text('I. PERSONAL DATA', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.brown)),
          const Divider(color: Colors.orange, thickness: 2),
        const SizedBox(height: 20),
        _row([
          _field(label: 'Last Name', child: TextFormField(controller: lastNameController, decoration: _dec('Last Name'))),
          _field(label: 'First Name', child: TextFormField(controller: firstNameController, decoration: _dec('First Name'))),
        ]),
        const SizedBox(height: 20),
        _row([
          _field(label: 'Middle Name', child: TextFormField(controller: middleNameController, decoration: _dec('Middle Name'))),
          _field(label: 'Maiden Name (if married)', child: TextFormField(controller: maidenNameController, decoration: _dec('Maiden Name (if married)'))),
        ]),
        const SizedBox(height: 20),
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
              initialValue: selectedSex,
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
        const SizedBox(height: 20),
        _row([
          _field(label: 'Place of Birth', child: TextFormField(controller: placeOfBirthController, decoration: _dec('Place of Birth'))),
          _field(label: 'Citizenship', child: TextFormField(controller: citizenshipController, decoration: _dec('Filipino'))),
        ]),
        const SizedBox(height: 20),
        _row([
          _field(
            label: 'Civil Status',
            child: DropdownButtonFormField<String>(
              initialValue: selectedCivilStatus,
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
        const SizedBox(height: 32),
        const Text('PERMANENT ADDRESS',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.brown)),
        const SizedBox(height: 20),
        _row([
          _field(label: 'Block', child: TextFormField(controller: blockController, decoration: _dec('Block'))),
          _field(label: 'Lot', child: TextFormField(controller: lotController, decoration: _dec('Lot'))),
          _field(label: 'Phase', child: TextFormField(controller: phaseController, decoration: _dec('Phase'))),
        ]),
        const SizedBox(height: 20),
        _row([
          _field(label: 'Street', child: TextFormField(controller: streetController, decoration: _dec('Street'))),
          _field(label: 'Subdivision', child: TextFormField(controller: subdivisionController, decoration: _dec('Subdivision'))),
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
                  .map((p) => DropdownMenuItem(value: p, child: Text(p)))
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
              items: (selectedProvince != null ? locationData[selectedProvince!]!.keys : <String>[])
                  .map((c) => DropdownMenuItem(value: c, child: Text(c)))
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

                  final updatedZip = cityZipMapping[value] ?? '';
                  zipCodeController.text = updatedZip;
                  widget.data.zipCode = updatedZip;
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
              items: (selectedProvince != null && selectedCity != null
                      ? locationData[selectedProvince!]![selectedCity!] ?? <String>[]
                      : <String>[])
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
        const SizedBox(height: 32),
        const Text('CONTACT INFORMATION',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.brown)),
        const SizedBox(height: 20),
        _row([
          _field(label: 'Landline', child: TextFormField(controller: landlineController, keyboardType: TextInputType.phone, decoration: _dec('(044) XXX-XXXX'))),
          _field(label: 'Mobile Number', child: TextFormField(controller: mobileController, keyboardType: TextInputType.phone, decoration: _dec('09XX-XXX-XXXX'))),
          _field(label: 'Email Address', child: TextFormField(controller: emailController, keyboardType: TextInputType.emailAddress, decoration: _dec('Email Address'))),
        ]),
      ],
      ),
    );
  }
}
