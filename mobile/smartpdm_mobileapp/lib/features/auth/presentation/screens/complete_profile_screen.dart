import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/auth/data/services/auth_service.dart';

class CompleteProfileScreen extends StatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  State<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends State<CompleteProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final AuthService _authService = AuthService();

  final _firstNameController = TextEditingController();
  final _middleNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _barangayController = TextEditingController();
  final _phoneNumberController = TextEditingController();

  bool _isLoading = false;
  bool _isLoadingCourses = true;

  List<CourseOption> _courses = const [];
  CourseOption? _selectedCourse;
  int? _selectedYearLevel;

  static const List<int> _yearLevels = [1, 2, 3, 4, 5];

  @override
  void initState() {
    super.initState();
    _loadCourses();
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _middleNameController.dispose();
    _lastNameController.dispose();
    _barangayController.dispose();
    _phoneNumberController.dispose();
    super.dispose();
  }

  Future<void> _loadCourses() async {
    try {
      final courses = await _authService.fetchCourses();

      if (!mounted) return;

      setState(() {
        _courses = courses;
        _isLoadingCourses = false;
      });

      debugPrint('COURSES LOADED: ${courses.length}');
      for (final course in courses) {
        debugPrint('COURSE: ${course.label}');
      }
    } catch (e) {
      debugPrint('COURSE LOAD ERROR: $e');

      if (!mounted) return;

      setState(() {
        _courses = [];
        _isLoadingCourses = false;
      });

      _showMessage('Failed to load courses: $e', isError: true);
    }
  }

  void _showMessage(String text, {bool isError = false}) {
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text),
        backgroundColor: isError ? Colors.red : null,
      ),
    );
  }

  String? _requiredValidator(String? value, String field) {
    if (value == null || value.trim().isEmpty) {
      return '$field is required';
    }
    return null;
  }

  String? _nameValidator(String? value, String field) {
    if (value == null || value.trim().isEmpty) {
      return '$field is required';
    }

    final text = value.trim();
    if (text.length < 2) {
      return '$field is too short';
    }

    if (!RegExp(r"^[a-zA-ZñÑ\s.'-]+$").hasMatch(text)) {
      return 'Enter a valid $field';
    }

    return null;
  }

  String? _phoneValidator(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Phone number is required';
    }

    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10 || digits.length > 13) {
      return 'Enter a valid phone number';
    }

    return null;
  }

  Future<void> _saveProfile() async {
    FocusScope.of(context).unfocus();

    if (!_formKey.currentState!.validate()) {
      _showMessage('Please complete all required fields.', isError: true);
      return;
    }

    if (_selectedCourse == null) {
      _showMessage('Please select your course.', isError: true);
      return;
    }

    if (_selectedYearLevel == null) {
      _showMessage('Please select your year level.', isError: true);
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      await _authService.setupProfile(
        firstName: _firstNameController.text.trim(),
        middleName: _middleNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        courseCode: _selectedCourse!.courseCode,
        yearLevel: _selectedYearLevel!,
        barangay: _barangayController.text.trim(),
        phoneNumber: _phoneNumberController.text.trim(),
      );

      if (!mounted) return;

      _showMessage('Profile completed successfully.');

      Navigator.of(context).pushNamedAndRemoveUntil(
        AppRoutes.home,
        (route) => false,
      );
    } catch (e) {
      _showMessage(e.toString(), isError: true);
    } finally {
      if (!mounted) return;

      setState(() {
        _isLoading = false;
      });
    }
  }

  InputDecoration _inputDecoration(String label, {String? hintText}) {
    return InputDecoration(
      labelText: label,
      hintText: hintText,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(borderRadius),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(borderRadius),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(borderRadius),
        borderSide: BorderSide(color: accentColor, width: 1.6),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(borderRadius),
        borderSide: const BorderSide(color: Colors.red),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(borderRadius),
        borderSide: const BorderSide(color: Colors.red, width: 1.4),
      ),
    );
  }

  Widget _buildTextField({
    required String label,
    required TextEditingController controller,
    required String? Function(String?) validator,
    TextInputType? keyboardType,
    String? hintText,
    List<TextInputFormatter>? inputFormatters,
    TextCapitalization textCapitalization = TextCapitalization.words,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: controller,
        validator: validator,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        textCapitalization: textCapitalization,
        decoration: _inputDecoration(label, hintText: hintText),
      ),
    );
  }

  Widget _buildCourseDropdown() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: DropdownButtonFormField<CourseOption>(
        initialValue: _selectedCourse,
        isExpanded: true,
        decoration: _inputDecoration(
          'Course',
          hintText: _isLoadingCourses
              ? 'Loading courses...'
              : (_courses.isEmpty ? 'No courses available' : 'Select your course'),
        ),
        items: _courses
            .map(
              (course) => DropdownMenuItem<CourseOption>(
                value: course,
                child: Text(
                  course.label,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            )
            .toList(),
        onChanged: (_isLoadingCourses || _courses.isEmpty)
            ? null
            : (value) {
                setState(() {
                  _selectedCourse = value;
                });
              },
        validator: (value) => value == null ? 'Course is required' : null,
      ),
    );
  }

  Widget _buildYearLevelDropdown() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: DropdownButtonFormField<int>(
        initialValue: _selectedYearLevel,
        decoration: _inputDecoration(
          'Year Level',
          hintText: 'Select your year level',
        ),
        items: _yearLevels
            .map(
              (year) => DropdownMenuItem<int>(
                value: year,
                child: Text('Year $year'),
              ),
            )
            .toList(),
        onChanged: (value) {
          setState(() {
            _selectedYearLevel = value;
          });
        },
        validator: (value) => value == null ? 'Year level is required' : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.black,
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(borderRadius * 1.4),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      CircleAvatar(
                        radius: 28,
                        backgroundColor: accentColor.withOpacity(0.12),
                        child: Icon(
                          Icons.person_rounded,
                          color: accentColor,
                          size: 30,
                        ),
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        'Complete Your Profile',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Set up your basic profile before continuing to the applicant dashboard.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey.shade600,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 28),
                      _buildTextField(
                        label: 'First Name',
                        controller: _firstNameController,
                        validator: (v) => _nameValidator(v, 'First name'),
                      ),
                      _buildTextField(
                        label: 'Middle Name',
                        controller: _middleNameController,
                        validator: (_) => null,
                        hintText: 'Optional',
                      ),
                      _buildTextField(
                        label: 'Last Name',
                        controller: _lastNameController,
                        validator: (v) => _nameValidator(v, 'Last name'),
                      ),
                      _buildCourseDropdown(),
                      _buildYearLevelDropdown(),
                      _buildTextField(
                        label: 'Barangay',
                        controller: _barangayController,
                        validator: (v) => _requiredValidator(v, 'Barangay'),
                      ),
                      _buildTextField(
                        label: 'Phone Number',
                        controller: _phoneNumberController,
                        validator: _phoneValidator,
                        keyboardType: TextInputType.phone,
                        textCapitalization: TextCapitalization.none,
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                            RegExp(r'[0-9+\- ]'),
                          ),
                          LengthLimitingTextInputFormatter(16),
                        ],
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          onPressed: (_isLoading || _isLoadingCourses)
                              ? null
                              : _saveProfile,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: accentColor,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: Colors.grey.shade300,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(borderRadius),
                            ),
                          ),
                          child: _isLoading
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2.2,
                                  ),
                                )
                              : Text(
                                  _isLoadingCourses
                                      ? 'LOADING COURSES...'
                                      : 'SAVE PROFILE',
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}