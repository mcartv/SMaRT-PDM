import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ApplicationFormScreen extends StatefulWidget {
  const ApplicationFormScreen({super.key});

  @override
  State<ApplicationFormScreen> createState() => _ApplicationFormScreenState();
}

class _ApplicationFormScreenState extends State<ApplicationFormScreen> {
  final _formKey = GlobalKey<FormState>();

  final _fullNameController = TextEditingController();
  final _studentIdController = TextEditingController();
  final _birthdateController = TextEditingController();
  final _contactController = TextEditingController();
  final _emailController = TextEditingController();

  String? _selectedCourse;
  String? _selectedYearLevel;

  bool _hasTypedSomething() {
    return _fullNameController.text.trim().isNotEmpty ||
        _studentIdController.text.trim().isNotEmpty ||
        _birthdateController.text.trim().isNotEmpty ||
        _contactController.text.trim().isNotEmpty ||
        _emailController.text.trim().isNotEmpty ||
        (_selectedCourse ?? '').isNotEmpty ||
        (_selectedYearLevel ?? '').isNotEmpty;
  }

  Future<bool> _confirmLeave() async {
    if (!_hasTypedSomething()) return true;

    final shouldLeave = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Leave application form?'),
          content: const Text(
            'Your application will stay as a draft. You can return later to continue editing before submitting.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Stay'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
              ),
              child: const Text('Leave as Draft'),
            ),
          ],
        );
      },
    );

    return shouldLeave == true;
  }

  Future<void> _handleBack() async {
    final canLeave = await _confirmLeave();
    if (!mounted || !canLeave) return;

    Navigator.pushNamedAndRemoveUntil(
      context,
      AppRoutes.home,
      (route) => false,
    );
  }

  Future<void> _pickBirthdate() async {
    final now = DateTime.now();

    final pickedDate = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 18, now.month, now.day),
      firstDate: DateTime(1900),
      lastDate: now,
    );

    if (pickedDate == null) return;

    final month = pickedDate.month.toString().padLeft(2, '0');
    final day = pickedDate.day.toString().padLeft(2, '0');
    final year = pickedDate.year.toString();

    setState(() {
      _birthdateController.text = '$month/$day/$year';
    });
  }

  void _goNext() {
    if (!_formKey.currentState!.validate()) return;

    Navigator.pushNamed(context, AppRoutes.documents);
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _studentIdController.dispose();
    _birthdateController.dispose();
    _contactController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  InputDecoration _inputDecoration(String label, {Widget? suffixIcon}) {
    return InputDecoration(
      labelText: label,
      suffixIcon: suffixIcon,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: Colors.black.withOpacity(0.10)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: primaryColor, width: 1.4),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        await _handleBack();
      },
      child: SmartPdmPageScaffold(
        selectedIndex: 2,
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _HeaderCard(onBack: _handleBack),
                const SizedBox(height: 18),
                _InfoNotice(),
                const SizedBox(height: 20),
                const Text(
                  'Personal Information',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: AppColors.darkBrown,
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _fullNameController,
                  decoration: _inputDecoration('Full Name'),
                  textInputAction: TextInputAction.next,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter your full name.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _studentIdController,
                  decoration: _inputDecoration('Student Number'),
                  textInputAction: TextInputAction.next,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter your student number.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: _selectedCourse,
                  decoration: _inputDecoration('Course'),
                  items: const [
                    DropdownMenuItem(
                      value: 'BSIT',
                      child: Text('BSIT - Information Technology'),
                    ),
                    DropdownMenuItem(
                      value: 'BSCS',
                      child: Text('BSCS - Computer Science'),
                    ),
                    DropdownMenuItem(
                      value: 'BSHM',
                      child: Text('BSHM - Hospitality Management'),
                    ),
                    DropdownMenuItem(
                      value: 'BSTM',
                      child: Text('BSTM - Tourism Management'),
                    ),
                    DropdownMenuItem(
                      value: 'BSOAD',
                      child: Text('BSOAD - Office Administration'),
                    ),
                    DropdownMenuItem(
                      value: 'BECED',
                      child: Text('BECED - Early Childhood Education'),
                    ),
                    DropdownMenuItem(
                      value: 'BTLED',
                      child: Text(
                        'BTLED - Technology and Livelihood Education',
                      ),
                    ),
                  ],
                  onChanged: (value) {
                    setState(() => _selectedCourse = value);
                  },
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please select a course.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: _selectedYearLevel,
                  decoration: _inputDecoration('Year Level'),
                  items: const [
                    DropdownMenuItem(value: '1', child: Text('1st Year')),
                    DropdownMenuItem(value: '2', child: Text('2nd Year')),
                    DropdownMenuItem(value: '3', child: Text('3rd Year')),
                    DropdownMenuItem(value: '4', child: Text('4th Year')),
                  ],
                  onChanged: (value) {
                    setState(() => _selectedYearLevel = value);
                  },
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please select a year level.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _birthdateController,
                  readOnly: true,
                  decoration: _inputDecoration(
                    'Birthdate',
                    suffixIcon: const Icon(Icons.calendar_month),
                  ),
                  onTap: _pickBirthdate,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please select your birthdate.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _contactController,
                  decoration: _inputDecoration('Contact Number'),
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter your contact number.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _emailController,
                  decoration: _inputDecoration('Email Address'),
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) return 'Please enter your email.';
                    if (!text.contains('@'))
                      return 'Please enter a valid email.';
                    return null;
                  },
                ),
                const SizedBox(height: 26),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _goNext,
                    icon: const Icon(Icons.arrow_forward),
                    label: const Text('Continue to Documents'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: primaryColor.withOpacity(0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: primaryColor.withOpacity(0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconButton.filledTonal(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back),
            tooltip: 'Back to dashboard',
          ),
          const SizedBox(height: 8),
          const Text(
            'Scholarship Application',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: AppColors.darkBrown,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Complete your details carefully. If you leave, your progress is treated as a draft.',
            style: TextStyle(fontSize: 13, color: Colors.black54, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _InfoNotice extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7E8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.orange.withOpacity(0.22)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline, color: Colors.orange),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'You can review and edit your application before final submission. Uploaded requirements are handled on the Documents page.',
              style: TextStyle(
                fontSize: 13,
                color: Colors.black54,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
