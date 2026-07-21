import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/core/constants/module_guidance_content.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/profile/data/services/profile_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';
import 'package:smartpdm_mobileapp/shared/widgets/module_guidance_card.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    this.showBottomNav = false,
  });

  final bool showBottomNav;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ProfileService _profileService = ProfileService();
  final SessionService _sessionService = const SessionService();

  late final TextEditingController _firstNameController;
  late final TextEditingController _lastNameController;
  late final TextEditingController _emailController;
  late final TextEditingController _courseController;
  late final TextEditingController _sectionController;
  late final TextEditingController _phoneController;
  late final TextEditingController _addressController;
  late final TextEditingController _studentIdController;

  bool _isLoading = true;
  bool _isEditing = false;
  bool _isSaving = false;
  bool _isUploading = false;
  bool _isProfileIncomplete = false;
  bool _hasScholarAccess = false;

  String _displayName = 'SMaRT-PDM User';
  String? _avatarUrl;
  String? _avatarReviewStatus;
  String _avatarRejectionReason = '';

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

    _loadProfile();
  }

  Future<void> _loadProfile({bool refreshRemote = true}) async {
    if (mounted) {
      setState(() => _isLoading = true);
    }

    final session = await _sessionService.getCurrentUser();
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;

    _applyValues(
      firstName: session.firstName,
      lastName: session.lastName,
      email: session.email,
      course: prefs.getString('user_course') ?? '',
      section: prefs.getString('user_section') ?? '',
      phone: prefs.getString('user_phone') ?? '',
      address: prefs.getString('user_address') ?? '',
      studentId: session.studentId,
      avatarUrl: session.avatarUrl,
      hasScholarAccess: session.hasScholarAccess,
    );

    if (refreshRemote && session.token.isNotEmpty) {
      try {
        final profile = await _profileService.fetchMyProfile();
        if (!mounted) return;

        _applyValues(
          firstName: profile['first_name']?.toString() ?? session.firstName,
          lastName: profile['last_name']?.toString() ?? session.lastName,
          email: profile['email']?.toString() ?? session.email,
          course: profile['course_code']?.toString() ?? '',
          section: profile['section']?.toString() ??
              prefs.getString('user_section') ??
              '',
          phone: profile['phone_number']?.toString() ?? '',
          address: _composeAddress(profile),
          studentId: profile['student_id']?.toString() ?? session.studentId,
          avatarUrl: profile['avatar_url']?.toString(),
          hasScholarAccess:
              profile['has_scholar_access'] == true || session.hasScholarAccess,
          avatarReviewStatus: profile['avatar_review_status']?.toString(),
          avatarRejectionReason:
              profile['avatar_rejection_reason']?.toString() ?? '',
        );
      } catch (_) {
        // Cached profile remains visible.
      }
    }

    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  void _applyValues({
    required String firstName,
    required String lastName,
    required String email,
    required String course,
    required String section,
    required String phone,
    required String address,
    required String studentId,
    required String? avatarUrl,
    required bool hasScholarAccess,
    String? avatarReviewStatus,
    String avatarRejectionReason = '',
  }) {
    final fullName = <String>[
      firstName.trim(),
      lastName.trim(),
    ].where((part) => part.isNotEmpty).join(' ');

    final incomplete = firstName.trim().isEmpty ||
        lastName.trim().isEmpty ||
        email.trim().isEmpty ||
        course.trim().isEmpty;

    setState(() {
      _firstNameController.text = firstName;
      _lastNameController.text = lastName;
      _emailController.text = email;
      _courseController.text = course;
      _sectionController.text = section;
      _phoneController.text = phone;
      _addressController.text = address;
      _studentIdController.text = studentId;

      _displayName = fullName.isEmpty ? 'SMaRT-PDM User' : fullName;
      _avatarUrl = avatarUrl?.trim().isNotEmpty == true ? avatarUrl!.trim() : null;
      _hasScholarAccess = hasScholarAccess;
      _avatarReviewStatus = avatarReviewStatus?.trim().isNotEmpty == true
          ? avatarReviewStatus!.trim().toLowerCase()
          : null;
      _avatarRejectionReason = avatarRejectionReason.trim();
      _isProfileIncomplete = incomplete;
      _isEditing = incomplete;
    });
  }

  String _composeAddress(Map<String, dynamic> profile) {
    final parts = <String?>[
      profile['street_address']?.toString().trim(),
      profile['subdivision']?.toString().trim(),
      profile['city']?.toString().trim(),
      profile['province']?.toString().trim(),
    ];

    return parts
        .where((part) => part != null && part.isNotEmpty)
        .cast<String>()
        .join(', ');
  }

  Future<void> _pickAvatar() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
      maxWidth: 1600,
    );

    if (picked == null) return;

    setState(() => _isUploading = true);

    try {
      if (kIsWeb) {
        final bytes = await picked.readAsBytes();
        await _profileService.uploadAvatar(
          bytes: bytes,
          fileName: picked.name,
        );
      } else {
        await _profileService.uploadAvatar(filePath: picked.path);
      }

      await _loadProfile(refreshRemote: true);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile photo submitted for review.'),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;

      final pending = error.statusCode == 409 ||
          error.message.toLowerCase().contains('pending review');

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            pending
                ? 'A profile photo is already pending review.'
                : error.message,
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to upload photo: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _isUploading = false);
      }
    }
  }

  Future<void> _saveProfile() async {
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final email = _emailController.text.trim();
    final course = _courseController.text.trim();
    final phone = _phoneController.text.trim();
    final address = _addressController.text.trim();

    if (firstName.isEmpty || lastName.isEmpty) {
      _showMessage('First name and last name are required.');
      return;
    }

    if (!_isValidEmail(email)) {
      _showMessage('Enter a valid email address.');
      return;
    }

    if (course.isEmpty) {
      _showMessage('Course is required.');
      return;
    }

    final wasIncomplete = _isProfileIncomplete;
    setState(() => _isSaving = true);

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_section', _sectionController.text.trim());

      final profile = await _profileService.updateMyProfile(
        payload: {
          'first_name': firstName,
          'last_name': lastName,
          'email': email,
          'phone_number': phone,
          'course_code': course,
          'street_address': address,
        },
      );

      if (!mounted) return;

      _applyValues(
        firstName: profile['first_name']?.toString() ?? firstName,
        lastName: profile['last_name']?.toString() ?? lastName,
        email: profile['email']?.toString() ?? email,
        course: profile['course_code']?.toString() ?? course,
        section: _sectionController.text.trim(),
        phone: profile['phone_number']?.toString() ?? phone,
        address: _composeAddress(profile).isNotEmpty
            ? _composeAddress(profile)
            : address,
        studentId:
            profile['student_id']?.toString() ?? _studentIdController.text,
        avatarUrl: profile['avatar_url']?.toString() ?? _avatarUrl,
        hasScholarAccess: _hasScholarAccess,
        avatarReviewStatus: profile['avatar_review_status']?.toString(),
        avatarRejectionReason:
            profile['avatar_rejection_reason']?.toString() ?? '',
      );

      setState(() => _isEditing = false);
      _showMessage('Profile updated successfully.');

      if (wasIncomplete && mounted) {
        Navigator.of(context).pushNamedAndRemoveUntil(
          AppRoutes.home,
          (route) => false,
        );
      }
    } catch (error) {
      _showMessage('Unable to update profile: $error');
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  bool _isValidEmail(String value) {
    return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value);
  }

  void _showMessage(String value) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(value)),
    );
  }

  void _handleBack() {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
      return;
    }

    AppNavigator.goToTopLevel(context, AppRoutes.menu);
  }

  Widget _buildAvatar() {
    final avatar = _avatarUrl;

    if (avatar == null || avatar.isEmpty) {
      return const Icon(
        Icons.person_rounded,
        size: 48,
        color: AppColors.gold,
      );
    }

    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return Image.network(
        avatar,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => const Icon(
          Icons.person_rounded,
          size: 48,
          color: AppColors.gold,
        ),
      );
    }

    if (!kIsWeb) {
      return Image.file(
        File(avatar),
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => const Icon(
          Icons.person_rounded,
          size: 48,
          color: AppColors.gold,
        ),
      );
    }

    return const Icon(
      Icons.person_rounded,
      size: 48,
      color: AppColors.gold,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back to Menu',
          onPressed: _handleBack,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: const Text('Profile and Account'),
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
      ),
      selectedIndex: 4,
      showDrawer: false,
      showBottomNav: widget.showBottomNav,
      applyPadding: false,
      child: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              color: AppColors.gold,
              onRefresh: _loadProfile,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 34),
                children: [
                  _buildProfileHeader(),
                  const SizedBox(height: 12),
                  const ModuleGuidanceCard(
                    title: ModuleGuidanceContent.profileTitle,
                    message: ModuleGuidanceContent.profileBody,
                  ),
                  if (_avatarReviewStatus == 'pending' ||
                      _avatarReviewStatus == 'rejected') ...[
                    const SizedBox(height: 12),
                    _buildAvatarNotice(),
                  ],
                  const SizedBox(height: 18),
                  if (_isEditing)
                    _buildEditForm()
                  else ...[
                    _buildOverviewCard(
                      title: 'Personal Information',
                      icon: Icons.person_outline_rounded,
                      children: [
                        _InfoRow(
                          label: 'Full Name',
                          value: _displayName,
                        ),
                        _InfoRow(
                          label: 'Student ID',
                          value: _studentIdController.text,
                        ),
                        _InfoRow(
                          label: 'Account Type',
                          value: _hasScholarAccess ? 'Scholar' : 'Applicant',
                          isLast: true,
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    _buildOverviewCard(
                      title: 'Academic Information',
                      icon: Icons.school_outlined,
                      children: [
                        _InfoRow(
                          label: 'Course',
                          value: _courseController.text,
                        ),
                        _InfoRow(
                          label: 'Section',
                          value: _sectionController.text,
                          isLast: true,
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    _buildOverviewCard(
                      title: 'Contact Information',
                      icon: Icons.contact_phone_outlined,
                      children: [
                        _InfoRow(
                          label: 'Registered Email',
                          value: _emailController.text,
                        ),
                        _InfoRow(
                          label: 'Phone Number',
                          value: _phoneController.text,
                        ),
                        _InfoRow(
                          label: 'Address',
                          value: _addressController.text,
                          isLast: true,
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    FilledButton.icon(
                      onPressed: () => setState(() => _isEditing = true),
                      icon: const Icon(Icons.edit_rounded),
                      label: const Text('Edit Profile'),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(52),
                        backgroundColor: AppColors.gold,
                        foregroundColor: AppColors.darkBrown,
                        textStyle: const TextStyle(fontWeight: FontWeight.w900),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildProfileHeader() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2E1600), Color(0xFF4A2600)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: AppColors.darkBrown.withValues(alpha: 0.20),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 82,
                height: 82,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF332216) : Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.gold, width: 2),
                ),
                child: ClipOval(
                  child: ColoredBox(
                    color: isDark
                        ? const Color(0xFF332216)
                        : const Color(0xFFFFF7E3),
                    child: _buildAvatar(),
                  ),
                ),
              ),
              Positioned(
                right: -2,
                bottom: -2,
                child: Material(
                  color: AppColors.gold,
                  shape: const CircleBorder(),
                  child: InkWell(
                    onTap: _isUploading ? null : _pickAvatar,
                    customBorder: const CircleBorder(),
                    child: SizedBox(
                      width: 30,
                      height: 30,
                      child: _isUploading
                          ? const Padding(
                              padding: EdgeInsets.all(7),
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.darkBrown,
                              ),
                            )
                          : const Icon(
                              Icons.camera_alt_rounded,
                              size: 16,
                              color: AppColors.darkBrown,
                            ),
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
                  _displayName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        height: 1.08,
                      ),
                ),
                const SizedBox(height: 6),
                Text(
                  _studentIdController.text.isEmpty
                      ? 'Student Account'
                      : _studentIdController.text,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white70,
                      ),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.gold,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    _hasScholarAccess ? 'SCHOLAR' : 'APPLICANT',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.darkBrown,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.7,
                        ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarNotice() {
    final rejected = _avatarReviewStatus == 'rejected';
    final color = rejected ? Colors.redAccent : AppColors.gold;
    final message = rejected
        ? (_avatarRejectionReason.isEmpty
            ? 'Your profile photo was rejected. Upload a new clear photo.'
            : 'Photo rejected: $_avatarRejectionReason')
        : 'Your new profile photo is pending review.';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.24)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            rejected ? Icons.error_outline_rounded : Icons.hourglass_top_rounded,
            color: color,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    height: 1.4,
                  ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverviewCard({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2B1D13) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : AppColors.brown.withValues(alpha: 0.09),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: AppColors.gold, size: 21),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: isDark ? Colors.white : AppColors.darkBrown,
                        fontWeight: FontWeight.w900,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _buildEditForm() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2B1D13) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : AppColors.brown.withValues(alpha: 0.09),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _isProfileIncomplete ? 'Complete Your Profile' : 'Edit Profile',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: isDark ? Colors.white : AppColors.darkBrown,
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 16),
          _ProfileField(
            label: 'First Name',
            icon: Icons.person_rounded,
            controller: _firstNameController,
          ),
          _ProfileField(
            label: 'Last Name',
            icon: Icons.person_outline_rounded,
            controller: _lastNameController,
          ),
          _ProfileField(
            label: 'Student ID',
            icon: Icons.badge_outlined,
            controller: _studentIdController,
            enabled: false,
          ),
          _ProfileField(
            label: 'Registered Email',
            icon: Icons.alternate_email_rounded,
            controller: _emailController,
            enabled: false,
            helperText: 'Use Update Registered Email from Menu to change this.',
          ),
          _ProfileField(
            label: 'Course',
            icon: Icons.school_outlined,
            controller: _courseController,
          ),
          _ProfileField(
            label: 'Section',
            icon: Icons.groups_outlined,
            controller: _sectionController,
          ),
          _ProfileField(
            label: 'Phone Number',
            icon: Icons.phone_outlined,
            controller: _phoneController,
            keyboardType: TextInputType.phone,
          ),
          _ProfileField(
            label: 'Address',
            icon: Icons.location_on_outlined,
            controller: _addressController,
            maxLines: 3,
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _isSaving
                      ? null
                      : () {
                          if (_isProfileIncomplete) {
                            _showMessage('Complete the required profile fields first.');
                            return;
                          }
                          setState(() => _isEditing = false);
                          _loadProfile(refreshRemote: false);
                        },
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: FilledButton.icon(
                  onPressed: _isSaving ? null : _saveProfile,
                  icon: _isSaving
                      ? const SizedBox(
                          width: 17,
                          height: 17,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.darkBrown,
                          ),
                        )
                      : const Icon(Icons.save_rounded),
                  label: Text(_isSaving ? 'Saving...' : 'Save Changes'),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    backgroundColor: AppColors.gold,
                    foregroundColor: AppColors.darkBrown,
                    textStyle: const TextStyle(fontWeight: FontWeight.w900),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
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

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 11),
      decoration: BoxDecoration(
        border: Border(
          bottom: isLast
              ? BorderSide.none
              : BorderSide(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.07)
                      : AppColors.brown.withValues(alpha: 0.08),
                ),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? Colors.white60
                        : AppColors.brown.withValues(alpha: 0.66),
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              value.trim().isEmpty ? 'Not provided' : value.trim(),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isDark ? Colors.white : AppColors.darkBrown,
                    fontWeight: FontWeight.w800,
                    height: 1.35,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileField extends StatelessWidget {
  const _ProfileField({
    required this.label,
    required this.icon,
    required this.controller,
    this.enabled = true,
    this.keyboardType,
    this.maxLines = 1,
    this.helperText,
  });

  final String label;
  final IconData icon;
  final TextEditingController controller;
  final bool enabled;
  final TextInputType? keyboardType;
  final int maxLines;
  final String? helperText;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextField(
        controller: controller,
        enabled: enabled,
        keyboardType: keyboardType,
        maxLines: maxLines,
        textCapitalization: TextCapitalization.words,
        decoration: InputDecoration(
          labelText: label,
          helperText: helperText,
          prefixIcon: Icon(icon),
          filled: true,
          fillColor: enabled
              ? (isDark
                  ? Colors.white.withValues(alpha: 0.05)
                  : const Color(0xFFFAF7F2))
              : (isDark
                  ? Colors.white.withValues(alpha: 0.03)
                  : const Color(0xFFF1EEE9)),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.08)
                  : AppColors.brown.withValues(alpha: 0.09),
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: AppColors.gold, width: 1.5),
          ),
        ),
      ),
    );
  }
}
