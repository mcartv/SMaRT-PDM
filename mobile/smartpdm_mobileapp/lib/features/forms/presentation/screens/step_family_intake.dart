import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/widgets/intake_form_ui.dart';
import 'package:smartpdm_mobileapp/shared/formatters/philippine_mobile_input_formatter.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/shared/validation/app_field_validators.dart';

class StepFamily extends StatefulWidget {
  const StepFamily({
    super.key,
    required this.data,
    required this.onChanged,
    this.showErrors = false,
  });

  final ApplicationData data;
  final VoidCallback onChanged;
  final bool showErrors;

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
  late final TextEditingController motherLastNameController;
  late final TextEditingController motherFirstNameController;
  late final TextEditingController motherMiddleNameController;
  late final TextEditingController motherMobileController;
  late final TextEditingController motherOccupationController;
  late final TextEditingController motherCompanyController;
  late final TextEditingController siblingLastNameController;
  late final TextEditingController siblingFirstNameController;
  late final TextEditingController siblingMiddleNameController;
  late final TextEditingController siblingMobileController;
  late final TextEditingController siblingOccupationController;
  late final TextEditingController siblingCompanyController;
  late final TextEditingController guardianLastNameController;
  late final TextEditingController guardianFirstNameController;
  late final TextEditingController guardianMiddleNameController;
  late final TextEditingController guardianMobileController;
  late final TextEditingController guardianOccupationController;
  late final TextEditingController guardianCompanyController;
  late final TextEditingController parentMarilaoResidencyDurationController;
  late final TextEditingController parentPreviousTownProvinceController;
  late final TextEditingController parentPreviousTownMunicipalityController;
  String? selectedParentPreviousProvince;

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

  static const List<String> provinceOptions = [
    'Abra',
    'Agusan del Norte',
    'Agusan del Sur',
    'Aklan',
    'Albay',
    'Antique',
    'Apayao',
    'Aurora',
    'Basilan',
    'Bataan',
    'Batanes',
    'Batangas',
    'Benguet',
    'Biliran',
    'Bohol',
    'Bukidnon',
    'Bulacan',
    'Cagayan',
    'Camarines Norte',
    'Camarines Sur',
    'Camiguin',
    'Capiz',
    'Catanduanes',
    'Cavite',
    'Cebu',
    'Cotabato',
    'Davao de Oro',
    'Davao del Norte',
    'Davao del Sur',
    'Davao Occidental',
    'Davao Oriental',
    'Dinagat Islands',
    'Eastern Samar',
    'Guimaras',
    'Ifugao',
    'Ilocos Norte',
    'Ilocos Sur',
    'Iloilo',
    'Isabela',
    'Kalinga',
    'La Union',
    'Laguna',
    'Lanao del Norte',
    'Lanao del Sur',
    'Leyte',
    'Maguindanao del Norte',
    'Maguindanao del Sur',
    'Marinduque',
    'Masbate',
    'Metro Manila',
    'Misamis Occidental',
    'Misamis Oriental',
    'Mountain Province',
    'Negros Occidental',
    'Negros Oriental',
    'Northern Samar',
    'Nueva Ecija',
    'Nueva Vizcaya',
    'Occidental Mindoro',
    'Oriental Mindoro',
    'Palawan',
    'Pampanga',
    'Pangasinan',
    'Quezon',
    'Quirino',
    'Rizal',
    'Romblon',
    'Samar',
    'Sarangani',
    'Siquijor',
    'Sorsogon',
    'South Cotabato',
    'Southern Leyte',
    'Sultan Kudarat',
    'Sulu',
    'Surigao del Norte',
    'Surigao del Sur',
    'Tarlac',
    'Tawi-Tawi',
    'Zambales',
    'Zamboanga del Norte',
    'Zamboanga del Sur',
    'Zamboanga Sibugay',
  ];

  String? selectedFatherEducation;
  String? selectedMotherEducation;
  String? selectedSiblingEducation;
  String? selectedGuardianEducation;
  late String selectedParentNative;
  bool sameAddress = false;
  bool hasFather = true;
  bool hasMother = true;
  bool guardianOnly = false;

  @override
  void initState() {
    super.initState();

    sameAddress = widget.data.sameAddressAsApplicant;
    hasFather = widget.data.fatherPresent;
    hasMother = widget.data.motherPresent;
    guardianOnly = widget.data.guardianOnly;

    if (guardianOnly) {
      hasFather = false;
      hasMother = false;
    }

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
      text: AppFieldValidators.normalizePhilippineMobile(widget.data.fatherMobile),
    );
    fatherOccupationController = TextEditingController(
      text: widget.data.fatherOccupation,
    );
    fatherCompanyController = TextEditingController(
      text: widget.data.fatherCompanyNameAndAddress,
    );
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
      text: AppFieldValidators.normalizePhilippineMobile(widget.data.motherMobile),
    );
    motherOccupationController = TextEditingController(
      text: widget.data.motherOccupation,
    );
    motherCompanyController = TextEditingController(
      text: widget.data.motherCompanyNameAndAddress,
    );
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
      text: AppFieldValidators.normalizePhilippineMobile(widget.data.siblingMobile),
    );
    siblingOccupationController = TextEditingController(
      text: widget.data.siblingOccupation,
    );
    siblingCompanyController = TextEditingController(
      text: widget.data.siblingCompanyNameAndAddress,
    );
    selectedSiblingEducation = _educationSelection(
      widget.data.siblingEducationalAttainment,
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
      text: AppFieldValidators.normalizePhilippineMobile(widget.data.guardianMobile),
    );
    widget.data.fatherMobile = fatherMobileController.text;
    widget.data.motherMobile = motherMobileController.text;
    widget.data.siblingMobile = siblingMobileController.text;
    widget.data.guardianMobile = guardianMobileController.text;
    guardianOccupationController = TextEditingController(
      text: widget.data.guardianOccupation,
    );
    guardianCompanyController = TextEditingController(
      text: widget.data.guardianCompanyNameAndAddress,
    );
    parentMarilaoResidencyDurationController = TextEditingController(
      text: widget.data.parentMarilaoResidencyDuration,
    );
    parentPreviousTownProvinceController = TextEditingController(
      text: widget.data.parentPreviousTownProvince,
    );
    parentPreviousTownMunicipalityController = TextEditingController(
      text: widget.data.parentPreviousTownMunicipality,
    );
    final previousProvince = widget.data.parentPreviousProvince.trim();
    selectedParentPreviousProvince = previousProvince.isEmpty
        ? null
        : previousProvince;

    selectedFatherEducation = _educationSelection(
      widget.data.fatherEducationalAttainment,
    );
    selectedMotherEducation = _educationSelection(
      widget.data.motherEducationalAttainment,
    );
    selectedGuardianEducation = _educationSelection(
      widget.data.guardianEducationalAttainment,
    );

    final applicantAddress = _buildApplicantAddress().toLowerCase();
    final savedParentAddress = parentAddressController.text
        .trim()
        .toLowerCase();
    if (!sameAddress &&
        applicantAddress.isNotEmpty &&
        savedParentAddress == applicantAddress) {
      sameAddress = true;
      widget.data.sameAddressAsApplicant = true;
    }

    var nativeStatus = widget.data.parentNativeStatus;
    if (nativeStatus == 'Father only') nativeStatus = 'Yes, father only';
    if (nativeStatus == 'Mother only') nativeStatus = 'Yes, mother only';
    if (nativeStatus == 'Both parents') nativeStatus = 'Yes, both parents';
    selectedParentNative = parentNativeOptions.contains(nativeStatus)
        ? nativeStatus
        : parentNativeOptions.first;
    widget.data.parentNativeStatus = selectedParentNative;

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
      siblingOccupationController,
      (value) => widget.data.siblingOccupation = value,
    );
    _bind(
      siblingCompanyController,
      (value) => widget.data.siblingCompanyNameAndAddress = value,
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
    _bind(parentPreviousTownMunicipalityController, (value) {
      widget.data.parentPreviousTownMunicipality = value;
      _syncPreviousOrigin();
    });
  }

  void _syncPreviousOrigin() {
    widget.data.parentPreviousTownProvince = [
      widget.data.parentPreviousTownMunicipality.trim(),
      widget.data.parentPreviousProvince.trim(),
    ].where((value) => value.isNotEmpty).join(', ');
    parentPreviousTownProvinceController.text =
        widget.data.parentPreviousTownProvince;
  }

  void _bind(TextEditingController controller, void Function(String) setter) {
    controller.addListener(() {
      setter(controller.text);
      widget.onChanged();
    });
  }

  String? _educationSelection(String value) {
    final canonical = ApplicationData.normalizeEducationalAttainment(value);
    if (canonical != null && educationalOptions.contains(canonical)) {
      return canonical;
    }
    return educationalOptions.contains(value.trim()) ? value.trim() : null;
  }

  InputDecoration _dec(String hint, {String? errorText, Widget? suffixIcon}) =>
      intakeInputDecoration(
      context,
        hint: hint,
        errorText: errorText,
        suffixIcon: suffixIcon,
      );

  String? _requiredError(String value, String label) {
    if (!widget.showErrors || value.trim().isNotEmpty) return null;
    return '$label is required.';
  }

  String? _parentAddressError() {
    if (!widget.showErrors || sameAddress) return null;
    return parentAddressController.text.trim().isEmpty
        ? 'Parent or guardian address is required.'
        : null;
  }

  String? _primaryCarerError() {
    if (!widget.showErrors) return null;
    final hasFatherName =
        hasFather &&
        fatherFirstNameController.text.trim().isNotEmpty &&
        fatherLastNameController.text.trim().isNotEmpty;
    final hasMotherName =
        hasMother &&
        motherFirstNameController.text.trim().isNotEmpty &&
        motherLastNameController.text.trim().isNotEmpty;
    final hasGuardianName =
        guardianFirstNameController.text.trim().isNotEmpty &&
        guardianLastNameController.text.trim().isNotEmpty;
    return (hasFatherName || hasMotherName || hasGuardianName)
        ? null
        : 'Enter the complete name of at least one parent or guardian.';
  }

  Widget _field(String label, Widget child) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [intakeFieldLabel(context, label), child],
    );
  }

  Widget _row(List<Widget> fields) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 520) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: fields
                .asMap()
                .entries
                .map(
                  (entry) => Padding(
                    padding: EdgeInsets.only(
                      bottom: entry.key < fields.length - 1 ? 16 : 0,
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
                      right: entry.key < fields.length - 1 ? 16 : 0,
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

  String _buildApplicantAddress() {
    final parts = [
      widget.data.unitBldgNo,
      widget.data.houseLotBlockNo,
      widget.data.street,
      widget.data.subdivision,
      widget.data.barangay,
      widget.data.city,
      widget.data.province,
      widget.data.zipCode,
    ].map((value) => value.trim()).where((value) => value.isNotEmpty).toList();

    return parts.join(', ');
  }

  void _applySameAddress(bool value) {
    setState(() {
      sameAddress = value;
      widget.data.sameAddressAsApplicant = value;
      if (value) {
        final address = _buildApplicantAddress();
        parentAddressController.text = address;
        widget.data.parentGuardianAddress = address;
      } else {
        parentAddressController.clear();
        widget.data.parentGuardianAddress = '';
      }
    });
    widget.onChanged();
  }

  void _setGuardianOnly(bool value) {
    setState(() {
      guardianOnly = value;
      widget.data.guardianOnly = value;
      if (value) {
        hasFather = false;
        hasMother = false;
        widget.data.fatherPresent = false;
        widget.data.motherPresent = false;
      } else {
        hasFather = true;
        hasMother = true;
        widget.data.fatherPresent = true;
        widget.data.motherPresent = true;
      }
    });
    widget.onChanged();
  }

  void _setHasFather(bool value) {
    setState(() {
      hasFather = value;
      widget.data.fatherPresent = value;
      if (hasFather || hasMother) {
        guardianOnly = false;
        widget.data.guardianOnly = false;
      } else {
        guardianOnly = true;
        widget.data.guardianOnly = true;
      }
    });
    widget.onChanged();
  }

  void _setHasMother(bool value) {
    setState(() {
      hasMother = value;
      widget.data.motherPresent = value;
      if (hasFather || hasMother) {
        guardianOnly = false;
        widget.data.guardianOnly = false;
      } else {
        guardianOnly = true;
        widget.data.guardianOnly = true;
      }
    });
    widget.onChanged();
  }

  bool get _showGuardianFields => guardianOnly || (!hasFather && !hasMother);

  bool _isValidFamilyMobile(String value) {
    return AppFieldValidators.philippineMobile(
          value,
          required: false,
        ) ==
        null &&
        value.trim().isNotEmpty;
  }

  String? _familyMobileError(String value) {
    if (!widget.showErrors) return null;
    return AppFieldValidators.philippineMobile(
      value,
      required: false,
    );
  }

  String? _familyNameError(
    String value,
    String label, {
    int minLength = 2,
  }) {
    if (!widget.showErrors) return null;
    return AppFieldValidators.name(
      value,
      label: label,
      required: false,
      minLength: minLength,
    );
  }

  List<TextInputFormatter> get _familyMobileInputFormatters => const [
    PhilippineMobileInputFormatter(),
  ];

  Widget _personSection({
    required String title,
    required TextEditingController lastNameController,
    required TextEditingController firstNameController,
    required TextEditingController middleNameController,
    required TextEditingController mobileController,
    required TextEditingController occupationController,
    required TextEditingController companyController,
    required String? selectedEducation,
    required ValueChanged<String> onEducationChanged,
  }) {
    return IntakeCard(
      margin: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: intakeTextColor(context),
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 16),
          _row([
            _field(
              'Last Name',
              TextFormField(
                controller: lastNameController,
                decoration: _dec(
                  'Last Name',
                  errorText: widget.showErrors
                      ? (_familyNameError(lastNameController.text, 'Last name') ??
                            (_primaryCarerError() != null
                                ? _requiredError(
                                    lastNameController.text,
                                    'Last name',
                                  )
                                : null))
                      : null,
                  suffixIcon: intakeCompletionIcon(lastNameController.text),
                ),
              ),
            ),
            _field(
              'First Name',
              TextFormField(
                controller: firstNameController,
                decoration: _dec(
                  'First Name',
                  errorText: widget.showErrors
                      ? (_familyNameError(firstNameController.text, 'First name') ??
                            (_primaryCarerError() != null
                                ? _requiredError(
                                    firstNameController.text,
                                    'First name',
                                  )
                                : null))
                      : null,
                  suffixIcon: intakeCompletionIcon(firstNameController.text),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _row([
            _field(
              'Middle Name',
              TextFormField(
                controller: middleNameController,
                decoration: _dec(
                  'Middle Name',
                  errorText: _familyNameError(
                    middleNameController.text,
                    'Middle name',
                    minLength: 1,
                  ),
                  suffixIcon: intakeCompletionIcon(middleNameController.text),
                ),
              ),
            ),
            _field(
              'Mobile Number',
              TextFormField(
                controller: mobileController,
                keyboardType: TextInputType.phone,
                inputFormatters: _familyMobileInputFormatters,
                decoration: _dec(
                  '09171234567',
                  errorText: widget.showErrors
                      ? _familyMobileError(mobileController.text)
                      : null,
                  suffixIcon: intakeCompletionIcon(
                    _isValidFamilyMobile(mobileController.text)
                        ? mobileController.text
                        : '',
                  ),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          _field(
            'Highest Educational Attainment',
            DropdownButtonFormField<String>(
              initialValue: selectedEducation,
              decoration: _dec(
                'Select attainment',
                suffixIcon: intakeCompletionIcon(selectedEducation ?? ''),
              ),
              items: educationalOptions
                  .map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  )
                  .toList(),
              onChanged: (value) {
                if (value == null) return;
                onEducationChanged(value);
              },
            ),
          ),
          const SizedBox(height: 16),
          _field(
            'Occupation',
            TextFormField(
              controller: occupationController,
              decoration: _dec(
                'Occupation',
                suffixIcon: intakeCompletionIcon(occupationController.text),
              ),
            ),
          ),
          const SizedBox(height: 16),
          _field(
            'Company Name / Address',
            TextFormField(
              controller: companyController,
              decoration: _dec(
                'Company Name / Address',
                suffixIcon: intakeCompletionIcon(companyController.text),
              ),
            ),
          ),
        ],
      ),
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
    siblingOccupationController.dispose();
    siblingCompanyController.dispose();
    guardianLastNameController.dispose();
    guardianFirstNameController.dispose();
    guardianMiddleNameController.dispose();
    guardianMobileController.dispose();
    guardianOccupationController.dispose();
    guardianCompanyController.dispose();
    parentMarilaoResidencyDurationController.dispose();
    parentPreviousTownProvinceController.dispose();
    parentPreviousTownMunicipalityController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IntakeSectionHeader(
          title: 'II. FAMILY INFORMATION',
          icon: Icons.family_restroom,
        ),
        if (_primaryCarerError() != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              _primaryCarerError()!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.redAccent,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        IntakeCard(
          margin: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Address of Parents / Guardian',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: intakeTextColor(context),
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 16),
              IntakeChoiceCard(
                title: 'Same as applicant',
                subtitle:
                    'Turn this on if the parent or guardian lives at the same permanent address.',
                selected: sameAddress,
                onTap: () => _applySameAddress(!sameAddress),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: parentAddressController,
                readOnly: sameAddress,
                maxLines: 2,
                decoration: _dec(
                  'Parent or guardian address',
                  errorText: _parentAddressError(),
                  suffixIcon: intakeCompletionIcon(
                    parentAddressController.text,
                  ),
                ),
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
                'Family Setup',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: intakeTextColor(context),
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 16),
              IntakeChoiceCard(
                title: 'No parents / Guardian only',
                subtitle: 'Use this if both parents are absent or unavailable.',
                selected: guardianOnly,
                onTap: () => _setGuardianOnly(true),
              ),
              const SizedBox(height: 12),
              IntakeChoiceCard(
                title: 'Father is present / listed',
                subtitle:
                    'Turn off if father was absent during growth or not listed in birth certificate.',
                selected: hasFather && !guardianOnly,
                onTap: () => _setHasFather(!hasFather),
              ),
              const SizedBox(height: 12),
              IntakeChoiceCard(
                title: 'Mother is present / listed',
                subtitle:
                    'Turn off if mother was absent during growth or not listed in birth certificate.',
                selected: hasMother && !guardianOnly,
                onTap: () => _setHasMother(!hasMother),
              ),
            ],
          ),
        ),
        if (hasFather && !guardianOnly)
          _personSection(
            title: 'Father\'s Details',
            lastNameController: fatherLastNameController,
            firstNameController: fatherFirstNameController,
            middleNameController: fatherMiddleNameController,
            mobileController: fatherMobileController,
            occupationController: fatherOccupationController,
            companyController: fatherCompanyController,
            selectedEducation: selectedFatherEducation,
            onEducationChanged: (value) {
              setState(() => selectedFatherEducation = value);
              widget.data.fatherEducationalAttainment = value;
              widget.onChanged();
            },
          ),
        if (hasMother && !guardianOnly)
          _personSection(
            title: 'Mother\'s Details',
            lastNameController: motherLastNameController,
            firstNameController: motherFirstNameController,
            middleNameController: motherMiddleNameController,
            mobileController: motherMobileController,
            occupationController: motherOccupationController,
            companyController: motherCompanyController,
            selectedEducation: selectedMotherEducation,
            onEducationChanged: (value) {
              setState(() => selectedMotherEducation = value);
              widget.data.motherEducationalAttainment = value;
              widget.onChanged();
            },
          ),
        IntakeCard(
          margin: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Sibling Contact',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: intakeTextColor(context),
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 16),
              _row([
                _field(
                  'Last Name',
                  TextFormField(
                    controller: siblingLastNameController,
                    decoration: _dec(
                      'Last Name',
                      errorText: _familyNameError(
                        siblingLastNameController.text,
                        'Last name',
                      ),
                    ),
                  ),
                ),
                _field(
                  'First Name',
                  TextFormField(
                    controller: siblingFirstNameController,
                    decoration: _dec(
                      'First Name',
                      errorText: _familyNameError(
                        siblingFirstNameController.text,
                        'First name',
                      ),
                    ),
                  ),
                ),
              ]),
              const SizedBox(height: 16),
              _row([
                _field(
                  'Middle Name',
                  TextFormField(
                    controller: siblingMiddleNameController,
                    decoration: _dec(
                      'Middle Name',
                      errorText: _familyNameError(
                        siblingMiddleNameController.text,
                        'Middle name',
                        minLength: 1,
                      ),
                    ),
                  ),
                ),
                _field(
                  'Mobile Number',
                  TextFormField(
                    controller: siblingMobileController,
                    keyboardType: TextInputType.phone,
                    inputFormatters: _familyMobileInputFormatters,
                    decoration: _dec(
                      '09171234567',
                      errorText: widget.showErrors
                          ? _familyMobileError(siblingMobileController.text)
                          : null,
                      suffixIcon: intakeCompletionIcon(
                        _isValidFamilyMobile(siblingMobileController.text)
                            ? siblingMobileController.text
                            : '',
                      ),
                    ),
                  ),
                ),
              ]),
              const SizedBox(height: 16),
              _field(
                'Highest Educational Attainment',
                DropdownButtonFormField<String>(
                  initialValue: selectedSiblingEducation,
                  decoration: _dec('Select attainment'),
                  items: educationalOptions
                      .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                      .toList(),
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() => selectedSiblingEducation = value);
                    widget.data.siblingEducationalAttainment = value;
                    widget.onChanged();
                  },
                ),
              ),
              const SizedBox(height: 16),
              _field(
                'Occupation',
                TextFormField(
                  controller: siblingOccupationController,
                  decoration: _dec('Occupation'),
                ),
              ),
              const SizedBox(height: 16),
              _field(
                'Company Name / Address',
                TextFormField(
                  controller: siblingCompanyController,
                  decoration: _dec('Company Name / Address'),
                ),
              ),
            ],
          ),
        ),
        if (_showGuardianFields)
          _personSection(
            title: 'Guardian\'s Details',
            lastNameController: guardianLastNameController,
            firstNameController: guardianFirstNameController,
            middleNameController: guardianMiddleNameController,
            mobileController: guardianMobileController,
            occupationController: guardianOccupationController,
            companyController: guardianCompanyController,
            selectedEducation: selectedGuardianEducation,
            onEducationChanged: (value) {
              setState(() => selectedGuardianEducation = value);
              widget.data.guardianEducationalAttainment = value;
              widget.onChanged();
            },
          ),
        if (!guardianOnly)
          IntakeCard(
            margin: const EdgeInsets.only(bottom: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Are your parents native of Marilao?',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: intakeTextColor(context),
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 16),
                ...parentNativeOptions.map(
                  (option) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: IntakeChoiceCard(
                      title: option,
                      subtitle:
                          'Select the option that best matches your family background.',
                      selected: selectedParentNative == option,
                      onTap: () {
                        setState(() {
                          selectedParentNative = option;
                          widget.data.parentNativeStatus = option;
                          if (option != 'No') {
                            parentPreviousTownProvinceController.clear();
                            parentPreviousTownMunicipalityController.clear();
                            selectedParentPreviousProvince = null;
                            widget.data.parentPreviousTownMunicipality = '';
                            widget.data.parentPreviousProvince = '';
                            widget.data.parentPreviousTownProvince = '';
                          } else {
                            parentMarilaoResidencyDurationController.clear();
                            widget.data.parentMarilaoResidencyDuration = '';
                          }
                        });
                        widget.onChanged();
                      },
                    ),
                  ),
                ),
                if (selectedParentNative != 'No')
                  _field(
                    'If YES, how long have they been residents of Marilao?',
                    TextFormField(
                      controller: parentMarilaoResidencyDurationController,
                      decoration: _dec('e.g., 20 years'),
                    ),
                  ),
                if (selectedParentNative == 'No') ...[
                  _field(
                    'Town / Municipality *',
                    TextFormField(
                      controller: parentPreviousTownMunicipalityController,
                      decoration: _dec('e.g., Angeles City'),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _field(
                    'Province *',
                    DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: selectedParentPreviousProvince,
                      decoration: _dec('Select province'),
                      items:
                          <String>{
                                ...provinceOptions,
                                if ((selectedParentPreviousProvince ?? '')
                                    .isNotEmpty)
                                  selectedParentPreviousProvince!,
                              }
                              .map(
                                (province) => DropdownMenuItem(
                                  value: province,
                                  child: Text(
                                    province,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                      onChanged: (value) {
                        setState(() {
                          selectedParentPreviousProvince = value;
                          widget.data.parentPreviousProvince = value ?? '';
                          _syncPreviousOrigin();
                        });
                        widget.onChanged();
                      },
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
