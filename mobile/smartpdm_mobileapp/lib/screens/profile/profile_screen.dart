import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/navigation/app_routes.dart';
import 'package:smartpdm_mobileapp/services/profile_service.dart';
import 'package:smartpdm_mobileapp/services/session_service.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class ProfileScreen extends StatefulWidget {
  final bool showBottomNav;

  const ProfileScreen({super.key, this.showBottomNav = true});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ProfileService _profileService = ProfileService();
  final SessionService _sessionService = const SessionService();
  static const List<String> _courseOptions = [
    'BSTM',
    'BSOAD',
    'BECED',
    'BSCS',
    'BSIT',
    'BSHM',
    'BTLED',
  ];

  String _userName = 'SCHOLAR';
  String? _imagePath;
  bool _isUploading = false;
  bool _isEditing = false;
  bool _isSaving = false;
  bool _isEmailInvalid = false;

  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _emailController;
  late TextEditingController _courseController;
  late TextEditingController _sectionController;
  late TextEditingController _phoneController;
  late TextEditingController _addressController;
  late TextEditingController _studentIdController;

  @override
  void initState() {
    super.initState();
    _firstNameController = TextEditingController();
    _lastNameController = TextEditingController();
    _emailController = TextEditingController();
    _courseController = TextEditingController();
    _sectionController = TextEditingController();
    _phoneController = TextEditingController();
    _addressController = TextEditingController();
    _studentIdController = TextEditingController();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final prefs = await SharedPreferences.getInstance();
    final firstName = prefs.getString('user_first_name') ?? '';
    final lastName = prefs.getString('user_last_name') ?? '';
    final email = prefs.getString('user_email') ?? '';
    final course = prefs.getString('user_course') ?? '';
    final section = prefs.getString('user_section') ?? '';
    final phone = prefs.getString('user_phone') ?? '';
    final address = prefs.getString('user_address') ?? '';
    final studentId = prefs.getString('user_student_id') ?? '';
    final imagePath = prefs.getString('user_profile_image');

    if (!mounted) return;

    setState(() {
      _imagePath = imagePath;
      _firstNameController.text = firstName;
      _lastNameController.text = lastName;
      _emailController.text = email;
      _courseController.text = course;
      _sectionController.text = section;
      _phoneController.text = phone;
      _addressController.text = address;
      _studentIdController.text = studentId;
    });

    if (firstName.isNotEmpty && lastName.isNotEmpty) {
      setState(() {
        _userName = '${firstName.toUpperCase()} ${lastName.toUpperCase()}';
      });
      return;
    }

    if (email.isNotEmpty) {
      String name = email.split('@').first.replaceAll('.', ' ');
      name = name.split(' ').map((word) => word.toUpperCase()).join(' ');
      setState(() {
        _userName = name;
      });
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile == null) return;

    setState(() => _isUploading = true);

    try {
      final session = await _sessionService.getCurrentUser();
      final newImageUrl = await _profileService.uploadAvatar(
        email: session.email,
        filePath: pickedFile.path,
      );

      if (!mounted) return;

      setState(() => _imagePath = newImageUrl);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Profile photo updated!')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() => _isUploading = false);
      }
    }
  }

  Future<void> _saveProfile() async {
    final email = _emailController.text.trim();

    if (_firstNameController.text.isEmpty || _lastNameController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('First name and last name are required')),
      );
      return;
    }

    if (_isInvalidEmail(email)) {
      setState(() => _isEmailInvalid = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid email address')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_first_name', _firstNameController.text);
      await prefs.setString('user_last_name', _lastNameController.text);
      await prefs.setString('user_email', email);
      await prefs.setString('user_course', _courseController.text.trim());
      await prefs.setString('user_section', _sectionController.text.trim());
      await prefs.setString('user_phone', _phoneController.text);
      await prefs.setString('user_address', _addressController.text);

      if (!mounted) return;

      setState(() {
        _userName =
            '${_firstNameController.text.toUpperCase()} ${_lastNameController.text.toUpperCase()}';
        _isEditing = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile updated successfully'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error saving profile: $e')));
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  bool _isInvalidEmail(String email) {
    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    return email.isEmpty || !emailRegex.hasMatch(email);
  }

  String _getDisplayCourseName(String courseCode) {
    switch (courseCode) {
      case 'BSTM':
        return 'BS Tourism Management';
      case 'BSOAD':
        return 'BS Office Administration';
      case 'BECED':
        return 'Bachelor of Early Childhood Education';
      case 'BSCS':
        return 'BS Computer Science';
      case 'BSIT':
        return 'BS Information Technology';
      case 'BSHM':
        return 'BS Hospitality Management';
      case 'BTLED':
        return 'Bachelor of Technology and Livelihood Education';
      default:
        return courseCode.isEmpty ? 'BS Computer Science' : courseCode;
    }
  }

  Future<void> _handleLogout(BuildContext context) async {
    await _sessionService.clearSession();

    if (context.mounted) {
      Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
    }
  }

  Future<void> _confirmLogout(BuildContext context) async {
    showDialog(
      context: context,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          title: const Text('Confirm Logout'),
          content: const Text(
            'Are you sure you want to terminate your session?',
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('CANCEL'),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                _handleLogout(context);
              },
              child: const Text(
                'LOG OUT',
                style: TextStyle(
                  color: Colors.red,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        elevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
      ),
      selectedIndex: 3,
      showBottomNav: widget.showBottomNav,
      showDrawer: true,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildProfileHeader(),
            const SizedBox(height: 24),
            _buildSectionLabel('Account'),
            if (_isEditing) _buildEditSection() else _buildOverviewSection(),
            const SizedBox(height: 24),
            _buildSectionLabel('Account Links'),
            _profileRowCard(
              icon: Icons.alternate_email,
              title: 'Change Email',
              subtitle: 'Send a link to update your email address',
              onTap: () => Navigator.pushNamed(context, AppRoutes.changeEmail),
            ),
            _profileRowCard(
              icon: Icons.lock_outline,
              title: 'Change Password',
              subtitle: 'Manage your sign-in credentials',
              onTap: () =>
                  Navigator.pushNamed(context, AppRoutes.forgotPassword),
            ),
            _profileRowCard(
              icon: Icons.help_outline,
              title: 'FAQs',
              subtitle: 'View common scholarship questions',
              onTap: () => Navigator.pushNamed(context, AppRoutes.faqs),
            ),
            _profileRowCard(
              icon: Icons.logout,
              title: 'Log out',
              subtitle: 'End your current session on this device',
              onTap: () => _confirmLogout(context),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileHeader() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.grey;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;

    return Container(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        children: [
          Row(
            children: [
              Stack(
                children: [
                  Container(
                    width: 76,
                    height: 76,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.gold, width: 2.5),
                    ),
                    child: ClipOval(
                      child: Container(
                        color: isDark
                            ? const Color(0xFF3A2718)
                            : primaryColor.withOpacity(0.06),
                        child: _imagePath != null
                            ? (_imagePath!.startsWith('http')
                                  ? Image.network(
                                      _imagePath!,
                                      fit: BoxFit.cover,
                                    )
                                  : Image.file(
                                      File(_imagePath!),
                                      fit: BoxFit.cover,
                                    ))
                            : Center(
                                child: Icon(
                                  Icons.person,
                                  size: 34,
                                  color: accentColor,
                                ),
                              ),
                      ),
                    ),
                  ),
                  if (_isUploading)
                    Positioned.fill(
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Colors.black38,
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.2,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: InkWell(
                      onTap: _pickImage,
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: accentColor,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isDark
                                ? const Color(0xFF24180F)
                                : Colors.white,
                            width: 2,
                          ),
                        ),
                        child: Icon(
                          Icons.camera_alt,
                          size: 14,
                          color: isDark ? AppColors.darkBrown : Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _userName,
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Institutional Scholar',
                      style: TextStyle(
                        fontSize: 13,
                        color: subtitleColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.gold.withOpacity(0.14),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        _studentIdController.text.isNotEmpty
                            ? _studentIdController.text
                            : 'Scholar account',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.darkBrown,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeaderStat(
                  'Course',
                  _getDisplayCourseName(_courseController.text),
                ),
                const SizedBox(height: 14),
                _buildHeaderStat(
                  'Email',
                  _emailController.text.isNotEmpty
                      ? _emailController.text
                      : 'Not set',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderStat(String label, String value) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              letterSpacing: 1,
              color: isDark ? Colors.white60 : AppColors.brown.withOpacity(0.6),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13,
              color: isDark ? Colors.white : AppColors.darkBrown,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(String label) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          letterSpacing: 1.2,
          color: isDark ? Colors.white60 : AppColors.brown.withOpacity(0.65),
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildOverviewSection() {
    return Column(
      children: [
        _profileRowCard(
          icon: Icons.edit_outlined,
          title: 'Edit profile',
          subtitle: 'Update your personal information',
          onTap: () => setState(() => _isEditing = true),
        ),
      ],
    );
  }

  Widget _buildEditSection() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFF332216)
            : Colors.white.withOpacity(0.92),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.gold.withOpacity(0.2)),
        boxShadow: [
          BoxShadow(
            color: AppColors.darkBrown.withOpacity(0.06),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Edit Profile Information',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : AppColors.darkBrown,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _firstNameController,
                  enabled: false,
                  enableInteractiveSelection: false,
                  decoration: _fieldDecoration(
                    label: 'First Name',
                    icon: Icons.person,
                    enabled: false,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _lastNameController,
                  enabled: false,
                  enableInteractiveSelection: false,
                  decoration: _fieldDecoration(
                    label: 'Last Name',
                    icon: Icons.person_outline,
                    enabled: false,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _studentIdController,
            enabled: false,
            enableInteractiveSelection: false,
            decoration: _fieldDecoration(
              label: 'Student ID',
              icon: Icons.badge,
              enabled: false,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            onChanged: (value) {
              setState(() {
                _isEmailInvalid = _isInvalidEmail(value.trim());
              });
            },
            decoration: _fieldDecoration(
              label: 'Email',
              icon: Icons.email,
              isError: _isEmailInvalid,
              errorText: _isEmailInvalid
                  ? 'Please enter a valid email address'
                  : null,
            ),
            style: TextStyle(color: _isEmailInvalid ? Colors.red : null),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _courseOptions.contains(_courseController.text)
                      ? _courseController.text
                      : null,
                  items: _courseOptions
                      .map(
                        (course) => DropdownMenuItem<String>(
                          value: course,
                          child: Text(course),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() {
                      _courseController.text = value ?? '';
                    });
                  },
                  decoration: _fieldDecoration(
                    label: 'Course',
                    icon: Icons.school_outlined,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _sectionController,
                  decoration: _fieldDecoration(
                    label: 'Section',
                    icon: Icons.groups_outlined,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phoneController,
            decoration: _fieldDecoration(
              label: 'Phone Number',
              icon: Icons.phone,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _addressController,
            decoration: _fieldDecoration(
              label: 'Address',
              icon: Icons.location_on,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    _loadUserData();
                    setState(() => _isEditing = false);
                  },
                  icon: const Icon(Icons.close),
                  label: const Text('Cancel'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.darkBrown,
                    side: BorderSide(color: AppColors.gold.withOpacity(0.35)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _isSaving ? null : _saveProfile,
                  icon: _isSaving
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        )
                      : const Icon(Icons.save),
                  label: Text(_isSaving ? 'Saving...' : 'Save'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  InputDecoration _fieldDecoration({
    required String label,
    required IconData icon,
    bool enabled = true,
    bool isError = false,
    String? errorText,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;

    return InputDecoration(
      labelText: label,
      errorText: errorText,
      labelStyle: TextStyle(color: isDark ? Colors.white70 : null),
      prefixIcon: Icon(icon, color: isError ? Colors.red : accentColor),
      filled: true,
      fillColor: isDark ? const Color(0xFF2D1E12) : Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(
          color: isError
              ? Colors.red
              : enabled
              ? AppColors.gold.withOpacity(0.3)
              : AppColors.gold.withOpacity(0.24),
        ),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: AppColors.gold.withOpacity(0.24)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(
          color: isError ? Colors.red : accentColor,
          width: 1.5,
        ),
      ),
    );
  }

  Widget _profileRowCard({
    required IconData icon,
    required String title,
    String? subtitle,
    VoidCallback? onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.grey;
    final iconAccent = isDark ? const Color(0xFFFFD54F) : AppColors.darkBrown;

    return Container(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: AppColors.gold.withOpacity(0.16)),
        ),
      ),
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFF3A2718)
                : AppColors.gold.withOpacity(0.12),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: iconAccent),
        ),
        title: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 14,
            color: titleColor,
          ),
        ),
        subtitle: subtitle == null
            ? null
            : Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  subtitle,
                  style: TextStyle(fontSize: 12, color: subtitleColor),
                ),
              ),
        trailing: Icon(
          Icons.chevron_right,
          color: isDark ? Colors.white54 : AppColors.brown.withOpacity(0.55),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _courseController.dispose();
    _sectionController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _studentIdController.dispose();
    super.dispose();
  }
}
