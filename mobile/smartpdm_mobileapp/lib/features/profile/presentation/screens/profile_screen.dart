import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/profile/data/services/profile_service.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_settings_sheet.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ProfileScreen extends StatefulWidget {
  final bool showBottomNav;

  const ProfileScreen({super.key, this.showBottomNav = true});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ProfileService _profileService = ProfileService();
  final SessionService _sessionService = const SessionService();

  String _userName = 'Institutional Scholar';
  String? _imagePath;
  String? _avatarReviewStatus;
  String _avatarRejectionReason = '';
  bool _cachedScholarAccess = false;

  bool _isProfileLoading = true;
  bool _isUploading = false;
  bool _isEditing = false;
  bool _isSaving = false;
  bool _isEmailInvalid = false;
  bool _isProfileIncomplete = false;

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

  String _buildDisplayName({
    required String firstName,
    required String lastName,
  }) {
    final fullName = [
      firstName.trim(),
      lastName.trim(),
    ].where((value) => value.isNotEmpty).join(' ');

    return fullName.isNotEmpty ? fullName : 'Institutional Scholar';
  }

  bool _computeProfileIncomplete({
    required String firstName,
    required String lastName,
    required String email,
    required String course,
  }) {
    return firstName.trim().isEmpty ||
        lastName.trim().isEmpty ||
        email.trim().isEmpty ||
        course.trim().isEmpty;
  }

  void _applyProfileValues({
    required String firstName,
    required String lastName,
    required String email,
    required String course,
    required String section,
    required String phone,
    required String address,
    required String studentId,
    required String? imagePath,
    required bool hasScholarAccess,
    String? avatarReviewStatus,
    String avatarRejectionReason = '',
  }) {
    final isIncomplete = _computeProfileIncomplete(
      firstName: firstName,
      lastName: lastName,
      email: email,
      course: course,
    );

    setState(() {
      _imagePath = imagePath != null && imagePath.isNotEmpty ? imagePath : null;
      _avatarReviewStatus =
          avatarReviewStatus != null && avatarReviewStatus.isNotEmpty
          ? avatarReviewStatus
          : null;
      _avatarRejectionReason = avatarRejectionReason;
      _firstNameController.text = firstName;
      _lastNameController.text = lastName;
      _emailController.text = email;
      _courseController.text = course;
      _sectionController.text = section;
      _phoneController.text = phone;
      _addressController.text = address;
      _studentIdController.text = studentId;
      _userName = _buildDisplayName(firstName: firstName, lastName: lastName);
      _cachedScholarAccess = hasScholarAccess;
      _isEmailInvalid = email.isNotEmpty && _isInvalidEmail(email);
      _isProfileIncomplete = isIncomplete;
      _isEditing = isIncomplete;
    });
  }

  String _composeAddress(Map<String, dynamic> profile) {
    final values = [
      profile['street_address']?.toString().trim(),
      profile['subdivision']?.toString().trim(),
      profile['city']?.toString().trim(),
      profile['province']?.toString().trim(),
    ];

    return values
        .where((value) => value != null && value.isNotEmpty)
        .cast<String>()
        .join(', ');
  }

  Future<void> _loadUserData({bool refreshRemote = true}) async {
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
    final hasScholarAccess = prefs.getBool('user_has_scholar_access') ?? false;

    if (!mounted) return;

    _applyProfileValues(
      firstName: firstName,
      lastName: lastName,
      email: email,
      course: course,
      section: section,
      phone: phone,
      address: address,
      studentId: studentId,
      imagePath: imagePath,
      hasScholarAccess: hasScholarAccess,
      avatarReviewStatus: null,
      avatarRejectionReason: '',
    );

    if (!refreshRemote) {
      if (mounted) {
        setState(() => _isProfileLoading = false);
      }
      return;
    }

    try {
      final session = await _sessionService.getCurrentUser();
      if (session.token.isEmpty) return;

      final profile = await _profileService.fetchMyProfile();
      final latestPrefs = await SharedPreferences.getInstance();
      final cachedSection = latestPrefs.getString('user_section') ?? section;
      final latestScholarAccess =
          latestPrefs.getBool('user_has_scholar_access') ?? hasScholarAccess;

      if (!mounted) return;

      _applyProfileValues(
        firstName: profile['first_name']?.toString() ?? '',
        lastName: profile['last_name']?.toString() ?? '',
        email: profile['email']?.toString() ?? '',
        course: profile['course_code']?.toString() ?? '',
        section: cachedSection,
        phone: profile['phone_number']?.toString() ?? '',
        address: _composeAddress(profile),
        studentId: profile['student_id']?.toString() ?? studentId,
        imagePath: profile['avatar_url']?.toString(),
        hasScholarAccess: latestScholarAccess,
        avatarReviewStatus: profile['avatar_review_status']?.toString(),
        avatarRejectionReason:
            profile['avatar_rejection_reason']?.toString() ?? '',
      );
    } catch (_) {
      // keep cached values
    } finally {
      if (mounted) {
        setState(() => _isProfileLoading = false);
      }
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile == null) return;

    setState(() => _isUploading = true);

    try {
      if (kIsWeb) {
        final bytes = await pickedFile.readAsBytes();
        await _profileService.uploadAvatar(
          bytes: bytes,
          fileName: pickedFile.name,
        );
      } else {
        await _profileService.uploadAvatar(filePath: pickedFile.path);
      }

      final profile = await _profileService.fetchMyProfile();
      final prefs = await SharedPreferences.getInstance();
      final hasScholarAccess =
          prefs.getBool('user_has_scholar_access') ?? false;

      if (!mounted) return;

      _applyProfileValues(
        firstName:
            profile['first_name']?.toString() ?? _firstNameController.text,
        lastName: profile['last_name']?.toString() ?? _lastNameController.text,
        email: profile['email']?.toString() ?? _emailController.text,
        course: profile['course_code']?.toString() ?? _courseController.text,
        section: _sectionController.text,
        phone: profile['phone_number']?.toString() ?? _phoneController.text,
        address: _composeAddress(profile),
        studentId:
            profile['student_id']?.toString() ?? _studentIdController.text,
        imagePath: profile['avatar_url']?.toString(),
        hasScholarAccess: hasScholarAccess,
        avatarReviewStatus: profile['avatar_review_status']?.toString(),
        avatarRejectionReason:
            profile['avatar_rejection_reason']?.toString() ?? '',
      );

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile photo submitted for review.')),
      );
    } on ApiException catch (e) {
      debugPrint('Avatar upload/profile refresh error: $e');
      if (!mounted) return;
      final isPendingConflict =
          e.statusCode == 409 ||
          e.message.toLowerCase().contains('pending review');
      final message = isPendingConflict
          ? 'You already have a profile picture pending review.'
          : e.message;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } catch (e) {
      debugPrint('Avatar upload/profile refresh error: $e');
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
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final email = _emailController.text.trim();
    final course = _courseController.text.trim();
    final phone = _phoneController.text.trim();
    final address = _addressController.text.trim();

    if (firstName.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('First name is required')));
      return;
    }

    if (lastName.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Last name is required')));
      return;
    }

    if (_isInvalidEmail(email)) {
      setState(() => _isEmailInvalid = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid email address')),
      );
      return;
    }

    if (course.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Please select a course')));
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

      await prefs.setString('user_section', _sectionController.text.trim());

      if (!mounted) return;

      _applyProfileValues(
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
        imagePath: profile['avatar_url']?.toString() ?? _imagePath,
        hasScholarAccess: prefs.getBool('user_has_scholar_access') ?? false,
        avatarReviewStatus: profile['avatar_review_status']?.toString(),
        avatarRejectionReason:
            profile['avatar_rejection_reason']?.toString() ?? '',
      );

      setState(() => _isEditing = false);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile updated successfully'),
          backgroundColor: Colors.green,
        ),
      );

      if (wasIncomplete) {
        Navigator.pushReplacementNamed(context, AppRoutes.home);
      }
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

  Future<void> _handleLogout(BuildContext context) async {
    await _sessionService.clearSession();

    if (mounted) {
      Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
    }
  }

  Future<void> _confirmLogout(BuildContext context) {
    return showDialog<void>(
      context: context,
      builder: (BuildContext dialogContext) {
        final isDark = Theme.of(dialogContext).brightness == Brightness.dark;
        final titleColor = isDark ? Colors.white : AppColors.darkBrown;
        final bodyColor = isDark ? Colors.white70 : Colors.black87;
        final cancelColor = isDark ? Colors.white70 : AppColors.brown;
        final confirmColor = isDark ? const Color(0xFFFF8A80) : Colors.red;

        return AlertDialog(
          title: Text('Confirm Logout', style: TextStyle(color: titleColor)),
          content: Text(
            'Are you sure you want to terminate your session?',
            style: TextStyle(color: bodyColor),
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text('CANCEL', style: TextStyle(color: cancelColor)),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                _handleLogout(context);
              },
              child: Text(
                'LOG OUT',
                style: TextStyle(
                  color: confirmColor,
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
    return SmartPdmPageScaffold(
      selectedIndex: 2,
      showBottomNav: widget.showBottomNav,
      showDrawer: false,
      child: _isProfileLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildProfileHeader(),
                  if (_isEditing) ...[
                    const SizedBox(height: 12),
                    _buildEditSection(),
                  ] else ...[
                    const SizedBox(height: 14),
                    _buildScholarSection(),
                    const SizedBox(height: 14),
                    _buildAccountSection(),
                  ],
                  const SizedBox(height: 8),
                ],
              ),
            ),
    );
  }

  Widget _buildProfileHeader() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasScholarAccess =
        context.watch<NotificationProvider>().hasScholarAccess ||
        _cachedScholarAccess;
    final cardColor = isDark ? const Color(0xFF241A11) : Colors.white;
    final borderColor = isDark
        ? const Color(0xFF4B3B2D)
        : const Color(0xFFEDE6DB);
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? const Color(0xFFFFE082) : primaryColor;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;
    final displayId = _studentIdController.text.trim().isNotEmpty
        ? _studentIdController.text.trim()
        : _userName;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              InkWell(
                onTap: _pickImage,
                customBorder: const CircleBorder(),
                child: Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.gold, width: 1.5),
                  ),
                  child: ClipOval(
                    child: Container(
                      color: isDark
                          ? const Color(0xFF3A2718)
                          : primaryColor.withOpacity(0.06),
                      child: _imagePath != null
                          ? (_imagePath!.startsWith('http')
                                ? Image.network(_imagePath!, fit: BoxFit.cover)
                                : Image.file(
                                    File(_imagePath!),
                                    fit: BoxFit.cover,
                                  ))
                          : Center(
                              child: Icon(
                                Icons.person,
                                size: 26,
                                color: accentColor,
                              ),
                            ),
                    ),
                  ),
                ),
              ),
              Positioned(
                bottom: -2,
                right: -2,
                child: Container(
                  width: 21,
                  height: 21,
                  decoration: BoxDecoration(
                    color: accentColor,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isDark ? const Color(0xFF24180F) : Colors.white,
                      width: 2,
                    ),
                  ),
                  child: _isUploading
                      ? const Padding(
                          padding: EdgeInsets.all(4),
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Icon(
                          hasScholarAccess
                              ? Icons.verified_rounded
                              : Icons.camera_alt_rounded,
                          size: 11,
                          color: isDark ? AppColors.darkBrown : Colors.white,
                        ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayId,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: titleColor,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 5),
                Row(
                  children: [
                    Icon(
                      hasScholarAccess
                          ? Icons.check_circle_rounded
                          : Icons.schedule_rounded,
                      color: subtitleColor,
                      size: 14,
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        hasScholarAccess
                            ? 'Approved Scholar'
                            : 'Pending Applicant',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(
                              color: subtitleColor,
                              fontWeight: FontWeight.w700,
                              height: 1.1,
                            ),
                      ),
                    ),
                  ],
                ),
                if (_avatarReviewStatus == 'pending' ||
                    _avatarReviewStatus == 'rejected') ...[
                  const SizedBox(height: 7),
                  _buildAvatarReviewNotice(),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarReviewNotice() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isRejected = _avatarReviewStatus == 'rejected';
    final backgroundColor = isRejected
        ? Colors.red.withOpacity(isDark ? 0.18 : 0.08)
        : AppColors.gold.withOpacity(isDark ? 0.22 : 0.14);
    final foregroundColor = isRejected
        ? (isDark ? const Color(0xFFFFCDD2) : Colors.red.shade700)
        : (isDark ? const Color(0xFFFFE082) : AppColors.darkBrown);
    final message = isRejected
        ? (_avatarRejectionReason.isNotEmpty
              ? 'Photo rejected: $_avatarRejectionReason'
              : 'Profile photo was rejected.')
        : 'New photo is pending review.';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isRejected ? Icons.error_outline : Icons.hourglass_top_rounded,
            size: 16,
            color: foregroundColor,
          ),
          const SizedBox(width: 7),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: foregroundColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(String label) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 0, 4, 7),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          fontSize: 10,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.8,
          color: isDark ? Colors.white60 : const Color(0xFF8A6E4F),
        ),
      ),
    );
  }

  Widget _buildScholarSection() {
    final hasScholarAccess =
        context.watch<NotificationProvider>().hasScholarAccess ||
        _cachedScholarAccess;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionLabel(hasScholarAccess ? 'SCHOLAR' : 'APPLICANT'),
        if (hasScholarAccess) ...[
          _profileRowCard(
            icon: Icons.event_note_rounded,
            title: 'Payout Schedule',
            subtitle: 'View release dates and payout details',
            onTap: () => Navigator.pushNamed(context, AppRoutes.payouts),
          ),
          _profileRowCard(
            icon: Icons.upload_file_rounded,
            title: 'Submit RO Completion',
            subtitle: 'Upload proof and completion details',
            onTap: () => Navigator.pushNamed(context, AppRoutes.roCompletion),
          ),
          _profileRowCard(
            icon: Icons.support_agent_rounded,
            title: 'Support Ticket',
            subtitle: 'Report concerns and get assistance',
            onTap: () => Navigator.pushNamed(context, AppRoutes.tickets),
          ),
        ] else ...[
          _profileRowCard(
            icon: Icons.assignment_rounded,
            title: 'Apply for Scholarship',
            subtitle: 'Browse and apply for openings',
            onTap: () =>
                Navigator.pushNamed(context, AppRoutes.scholarshipOpenings),
          ),
          _profileRowCard(
            icon: Icons.fact_check_rounded,
            title: 'Application Status',
            subtitle: 'Track your application progress',
            onTap: () => Navigator.pushNamed(context, AppRoutes.status),
          ),
          _profileRowCard(
            icon: Icons.help_outline_rounded,
            title: 'FAQs',
            subtitle: 'Get answers to common questions',
            onTap: () => Navigator.pushNamed(context, AppRoutes.faqs),
          ),
        ],
      ],
    );
  }

  Widget _buildAccountSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionLabel('ACCOUNT'),
        _profileRowCard(
          icon: Icons.person_rounded,
          title: 'Profile',
          subtitle: 'View and edit your profile',
          onTap: () => setState(() => _isEditing = true),
        ),
        _profileRowCard(
          icon: Icons.settings_rounded,
          title: 'App Settings',
          subtitle: 'Customize your app experience',
          onTap: () => showAppSettingsSheet(context),
        ),
        _profileRowCard(
          icon: Icons.alternate_email_rounded,
          title: 'Change Email',
          subtitle: 'Update your registered email',
          onTap: () => Navigator.pushNamed(context, AppRoutes.changeEmail),
        ),
        _profileRowCard(
          icon: Icons.lock_rounded,
          title: 'Change Password',
          subtitle: 'Update your password securely',
          onTap: () => Navigator.pushNamed(context, AppRoutes.forgotPassword),
        ),
        _profileRowCard(
          icon: Icons.logout_rounded,
          title: 'Log Out',
          subtitle: 'Sign out from your account',
          onTap: () => _confirmLogout(context),
          destructive: true,
        ),
      ],
    );
  }

  Widget _buildEditSection() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF241A11) : Colors.white;
    final borderColor = isDark
        ? const Color(0xFF4B3B2D)
        : const Color(0xFFEDE6DB);
    final titleColor = isDark ? Colors.white : textColor;
    final shadowColor = isDark
        ? Colors.black.withValues(alpha: 0.18)
        : AppColors.darkBrown.withValues(alpha: 0.06);

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: borderColor),
            boxShadow: [
              BoxShadow(
                color: shadowColor,
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _isProfileIncomplete
                          ? 'Complete Your Profile'
                          : 'Edit Profile Information',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: titleColor,
                        height: 1.12,
                      ),
                    ),
                  ),
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: AppColors.gold.withValues(
                        alpha: isDark ? 0.22 : 0.14,
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.edit_rounded,
                      color: isDark ? const Color(0xFFFFD54F) : AppColors.gold,
                      size: 18,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _profileInputRow(
                icon: Icons.person_rounded,
                label: 'First Name',
                controller: _firstNameController,
              ),
              _profileInputRow(
                icon: Icons.person_outline_rounded,
                label: 'Last Name',
                controller: _lastNameController,
              ),
              _profileInputRow(
                icon: Icons.badge_outlined,
                label: 'Student ID',
                controller: _studentIdController,
                enabled: false,
              ),
              _profileInputRow(
                icon: Icons.groups_outlined,
                label: 'Section',
                controller: _sectionController,
              ),
              _profileInputRow(
                icon: Icons.phone_rounded,
                label: 'Phone Number',
                controller: _phoneController,
                multiLineValue: true,
              ),
              _profileInputRow(
                icon: Icons.location_on_rounded,
                label: 'Address',
                controller: _addressController,
                multiLineValue: true,
                isLast: true,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        _loadUserData(refreshRemote: false);
                        setState(() => _isEditing = false);
                      },
                      icon: const Icon(Icons.close_rounded, size: 18),
                      label: const Text('Cancel'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: titleColor,
                        backgroundColor: isDark
                            ? Colors.white.withValues(alpha: 0.06)
                            : const Color(0xFFF8F7F5),
                        side: BorderSide(
                          color: isDark ? Colors.white10 : Colors.transparent,
                        ),
                        textStyle: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                            ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      onPressed: _isSaving ? null : _saveProfile,
                      icon: _isSaving
                          ? const SizedBox(
                              height: 16,
                              width: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Colors.white,
                                ),
                              ),
                            )
                          : const Icon(Icons.save_rounded, size: 18),
                      label: Text(_isSaving ? 'Saving...' : 'Save Changes'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.gold,
                        foregroundColor: AppColors.black,
                        elevation: 0,
                        textStyle: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                            ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (_isEmailInvalid) ...[
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Please enter a valid email address',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Colors.red,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _profileInputRow({
    required IconData icon,
    required String label,
    required TextEditingController controller,
    TextInputType? keyboardType,
    ValueChanged<String>? onChanged,
    bool enabled = true,
    bool isError = false,
    bool multiLineValue = false,
    bool isLast = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor = isError
        ? Colors.red
        : isDark
        ? const Color(0xFF4B3B2D)
        : const Color(0xFFEDE7DD);
    final labelColor = isDark ? Colors.white70 : const Color(0xFF6F675C);
    final valueColor = enabled
        ? (isDark ? Colors.white : AppColors.black)
        : (isDark ? Colors.white54 : const Color(0xFF7C766F));

    return Container(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 14),
      decoration: BoxDecoration(
        border: Border(
          bottom: isLast ? BorderSide.none : BorderSide(color: borderColor),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.only(top: isLast ? 8 : 0),
        child: Row(
          crossAxisAlignment: multiLineValue
              ? CrossAxisAlignment.start
              : CrossAxisAlignment.center,
          children: [
            _profileRowIcon(icon),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontSize: 15,
                      color: labelColor,
                      fontWeight: FontWeight.w700,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  TextField(
                    controller: controller,
                    enabled: enabled,
                    keyboardType: keyboardType,
                    onChanged: onChanged,
                    minLines: multiLineValue ? 1 : 1,
                    maxLines: multiLineValue ? 3 : 1,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontSize: 19,
                      color: valueColor,
                      fontWeight: FontWeight.w900,
                      height: 1.18,
                    ),
                    decoration: InputDecoration(
                      isDense: true,
                      border: InputBorder.none,
                      hintText: '-',
                      hintStyle: TextStyle(
                        color: valueColor.withValues(alpha: 0.6),
                      ),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _profileRowIcon(IconData icon) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.gold.withValues(alpha: 0.14)
            : const Color(0xFFFFF7E3),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(
        icon,
        color: isDark ? const Color(0xFFFFD54F) : AppColors.gold,
        size: 22,
      ),
    );
  }

  Widget _profileRowCard({
    required IconData icon,
    required String title,
    String? subtitle,
    VoidCallback? onTap,
    bool destructive = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = destructive
        ? const Color(0xFFFF3B3B)
        : (isDark ? Colors.white : AppColors.darkBrown);
    final subtitleColor = isDark ? Colors.white60 : const Color(0xFF77706A);
    final iconAccent = destructive
        ? const Color(0xFFFF3B3B)
        : (isDark ? const Color(0xFFFFD54F) : primaryColor);
    final tileColor = destructive
        ? (isDark
              ? const Color(0xFF3A1E16).withValues(alpha: 0.78)
              : const Color(0xFFFFF7F7))
        : (isDark ? const Color(0xFF2A1D13) : Colors.white);
    final borderColor = destructive
        ? (isDark ? const Color(0xFF714033) : const Color(0xFFFFDDDD))
        : (isDark ? Colors.white12 : const Color(0xFFEDE6DB));
    final trailingColor = destructive
        ? const Color(0xFFFF3B3B)
        : (isDark ? Colors.white54 : AppColors.brown);
    final iconBackgroundColor = destructive
        ? (isDark
              ? const Color(0xFFFF3B3B).withValues(alpha: 0.12)
              : Colors.white)
        : (isDark ? const Color(0xFF4A2F1C) : const Color(0xFFFFF7E3));

    return Container(
      decoration: BoxDecoration(
        color: tileColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderColor),
      ),
      margin: const EdgeInsets.only(bottom: 6),
      child: ListTile(
        onTap: onTap,
        dense: true,
        minLeadingWidth: 0,
        horizontalTitleGap: 10,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        leading: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: iconBackgroundColor,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: iconAccent, size: 19),
        ),
        title: Text(
          title,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            fontSize: 12.5,
            fontWeight: FontWeight.w800,
            color: titleColor,
            height: 1.1,
          ),
        ),
        subtitle: subtitle == null
            ? null
            : Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontSize: 9.5,
                    color: subtitleColor,
                    height: 1.15,
                  ),
                ),
              ),
        trailing: Icon(Icons.chevron_right, color: trailingColor, size: 20),
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
