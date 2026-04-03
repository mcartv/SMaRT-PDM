import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/navigation/app_navigator.dart';
import 'package:smartpdm_mobileapp/navigation/app_routes.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';
import 'package:smartpdm_mobileapp/widgets/app_settings_sheet.dart';
import 'package:smartpdm_mobileapp/screens/providers/messaging_provider.dart';

class DashboardScreen extends StatelessWidget {
  final bool showBottomNav;

  const DashboardScreen({
    super.key,
    this.showBottomNav = true,
  });

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('SMaRT-PDM Dashboard'),
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        actions: [
          Consumer<MessagingProvider>(
            builder: (context, messagingProvider, child) {
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Badge(
                  isLabelVisible: messagingProvider.unreadCount > 0,
                  label: Text('${messagingProvider.unreadCount}'),
                  backgroundColor: Colors.red,
                  child: IconButton(
                    onPressed: () {
                      messagingProvider.clearUnread();
                      Navigator.pushNamed(context, AppRoutes.messaging);
                    },
                    tooltip: 'Open Messaging',
                    icon: const Icon(Icons.chat_bubble_outline),
                  ),
                ),
              );
            },
          ),
        ],
      ),
      selectedIndex: 0,
      showDrawer: false,
      showBottomNav: showBottomNav,
      applyPadding: false,
      child: const DashboardContent(),
    );
  }
}

class DashboardContent extends StatefulWidget {
  const DashboardContent({super.key});

  @override
  State<DashboardContent> createState() => _DashboardContentState();
}

class _DashboardContentState extends State<DashboardContent> {
  String _userName = 'Scholar';
  bool _isApproved =
      false; // Mocking approval status based on backend verification

  @override
  void initState() {
    super.initState();
    _loadAndDisplayUserData();
  }

  Future<void> _loadAndDisplayUserData() async {
    final prefs = await SharedPreferences.getInstance();
    final studentId = prefs.getString('user_student_id') ?? 'Scholar';
    final isVerified = prefs.getBool('user_is_verified') ?? false;

    // Initialize the real-time chat connection and load history
    if (mounted) {
      context.read<MessagingProvider>().initializeChat();
    }

    if (mounted) {
      setState(() {
        _userName = studentId;
        _isApproved = isVerified;
      });
    }
  }

  Widget _buildAnnouncementCard({
    required String title,
    required String subtitle,
    required String timeAgo,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [
          BoxShadow(
            color: Color(0x16000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: const Color(0xFFF5F7FB),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(
                Icons.notifications_none_rounded,
                color: Color(0xFF7C9AD8),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0E318B),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.35,
                      color: AppColors.brown,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              timeAgo,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF9A9A9A),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeaturedArticleCard() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8F3ED),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold, width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.gold.withOpacity(0.18),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    'FEATURED ARTICLE',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.darkBrown,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () =>
                      AppNavigator.goToTopLevel(context, AppRoutes.notifications),
                  child: const Text(
                    'READ MORE',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            const Text(
              'Scholarship opportunities from agencies and private benefactors',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: AppColors.darkBrown,
                height: 1.15,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Stay updated on CHED, UNIFAST, TES, TDP, and private grant support including BC Packaging, Food Crafters, Genmart, Kaizen, and Pusong Mapagkalinga.',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.brown,
                height: 1.45,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOngoingObligationsCard() {
    const progressValue = 0.6;
    const progressPercentage = 60;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8F3ED),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold, width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: InkWell(
        onTap: () => AppNavigator.goToTopLevel(context, AppRoutes.payouts),
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ONGOING OBLIGATIONS',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.1,
                            color: AppColors.brown,
                          ),
                        ),
                        SizedBox(height: 10),
                        Text(
                          'RO COMPLIANCE',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            color: AppColors.darkBrown,
                            height: 1.05,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.yellow,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'ACTIVE',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: AppColors.darkBrown,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.gold, width: 1),
                        ),
                        child: IconButton(
                          onPressed: () =>
                              AppNavigator.goToTopLevel(context, AppRoutes.payouts),
                          icon: const Icon(
                            Icons.arrow_forward_ios_rounded,
                            size: 18,
                            color: AppColors.brown,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: const [
                  Expanded(
                    child: Text(
                      'Completion Progress',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.brown,
                      ),
                    ),
                  ),
                  Text(
                    '$progressPercentage%',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      color: AppColors.darkBrown,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: progressValue,
                  minHeight: 7,
                  backgroundColor: AppColors.lightGray,
                  valueColor: const AlwaysStoppedAnimation<Color>(primaryColor),
                ),
              ),
              const SizedBox(height: 18),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.gold.withOpacity(0.5)),
                ),
                child: const Row(
                  children: [
                    Icon(
                      Icons.error_outline_rounded,
                      size: 18,
                      color: AppColors.orange,
                    ),
                    SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'REQUIRES ACTION',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                              color: AppColors.orange,
                            ),
                          ),
                          SizedBox(height: 3),
                          Text(
                            'SUBMIT RO COMPLETION',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: AppColors.darkBrown,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCampusHero() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        image: const DecorationImage(
          image: AssetImage('assets/images/school_logo.png'),
          fit: BoxFit.cover,
          opacity: 0.2,
        ),
        gradient: const LinearGradient(
          colors: [Color(0xFF3B2B11), Color(0xFFE5C059)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: Colors.black.withOpacity(0.35),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.all(6),
                    child: Image.asset(
                      'assets/images/school_logo.png',
                      width: 42,
                      height: 42,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Pambayang Dalubhasaan ng Marilao',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Hello, $_userName!',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const Text(
              '"WHERE QUALITY EDUCATION IS A RIGHT, NOT A PRIVILEGE"',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w900,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureCards() {
    final cards = [
      {
        'title': 'Find Your Program',
        'subtitle': 'Explore available courses',
        'icon': Icons.search,
      },
      {
        'title': 'Arts & Sciences',
        'subtitle': 'Humanities and research',
        'icon': Icons.palette,
      },
      {
        'title': 'Business',
        'subtitle': 'Management and finance',
        'icon': Icons.business_center,
      },
      {
        'title': 'Engineering',
        'subtitle': 'Technology and innovation',
        'icon': Icons.engineering,
      },
      {
        'title': 'Nursing',
        'subtitle': 'Health professions',
        'icon': Icons.local_hospital,
      },
      {
        'title': 'Graduate Studies',
        'subtitle': 'Master’s and PhD',
        'icon': Icons.school,
      },
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 900
            ? 3
            : constraints.maxWidth > 600
            ? 2
            : 1;
        return GridView.count(
          shrinkWrap: true,
          crossAxisCount: crossAxisCount,
          childAspectRatio: 3.6,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          physics: const NeverScrollableScrollPhysics(),
          children: cards.map((cardData) {
            return Card(
              color: AppColors.lightGray,
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              child: InkWell(
                onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Selected ${cardData['title']}')),
                ),
                borderRadius: BorderRadius.circular(14),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        cardData['icon'] as IconData,
                        color: AppColors.darkBrown,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              cardData['title'] as String,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppColors.darkBrown,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              cardData['subtitle'] as String,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.brown,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.arrow_forward,
                        color: AppColors.darkBrown,
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }

  Widget _buildQuickActionTile({
    required BuildContext context,
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    final isCompact = MediaQuery.of(context).size.width < 360;

    return Card(
      color: const Color(0xFFF8F3ED),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: isCompact ? 10 : 12,
            vertical: isCompact ? 12 : 16,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                color: primaryColor,
                size: isCompact ? 18 : 20,
              ),
              SizedBox(width: isCompact ? 8 : 10),
              Flexible(
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: isCompact ? 13 : 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.darkBrown,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.darkBrown, AppColors.brown, AppColors.gold],
            stops: [0.0, 0.6, 1.0],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildCampusHero(),
                const SizedBox(height: 12),
                _buildFeaturedArticleCard(),
                const SizedBox(height: 20),
                if (_isApproved) ...[
                  _buildOngoingObligationsCard(),
                  const SizedBox(height: 20),
                ],
                const Text(
                  'Quick Actions',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 10),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final isCompact = constraints.maxWidth < 340;
                    final itemWidth = isCompact
                        ? constraints.maxWidth
                        : (constraints.maxWidth - 20) / 3;

                    return Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        SizedBox(
                          width: itemWidth,
                          child: _buildQuickActionTile(
                            context: context,
                            icon: Icons.upload_file,
                            label: 'Upload',
                            onTap: () =>
                                Navigator.pushNamed(context, AppRoutes.documents),
                          ),
                        ),
                        SizedBox(
                          width: itemWidth,
                          child: _buildQuickActionTile(
                            context: context,
                            icon: Icons.campaign_outlined,
                            label: 'Announcements',
                            onTap: () => AppNavigator.goToTopLevel(
                              context,
                              AppRoutes.notifications,
                            ),
                          ),
                        ),
                        SizedBox(
                          width: itemWidth,
                          child: _buildQuickActionTile(
                            context: context,
                            icon: Icons.assignment_turned_in,
                            label: 'Obligs',
                            onTap: () => AppNavigator.goToTopLevel(
                              context,
                              AppRoutes.payouts,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 20),
                if (!_isApproved) ...[
                  // --- NOT VERIFIED YET SECTION ---
                  const Text(
                    'Scholarship Application',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Card(
                    elevation: 2,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(borderRadius),
                    ),
                    child: Column(
                      children: [
                        ListTile(
                          leading: const Icon(
                            Icons.person_add,
                            color: primaryColor,
                          ),
                          title: const Text('Apply for New Scholarship'),
                          subtitle: const Text(
                            'Start your application as a new scholar',
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () {
                            Navigator.pushNamed(
                              context,
                              AppRoutes.newApplicant,
                            );
                          },
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(
                            Icons.settings_outlined,
                            color: primaryColor,
                          ),
                          title: const Text('App Settings'),
                          subtitle: const Text(
                            'Manage preferences, privacy, and account options',
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () => showAppSettingsSheet(context),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'General Information',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Card(
                    elevation: 2,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(borderRadius),
                    ),
                    child: Column(
                      children: [
                        ListTile(
                          leading: const Icon(
                            Icons.info_outline,
                            color: primaryColor,
                          ),
                          title: const Text('About PDM/OSFA'),
                          subtitle: const Text(
                            'History, Vision, Mission, Contacts',
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () =>
                              Navigator.pushNamed(context, AppRoutes.about),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(
                            Icons.question_answer,
                            color: primaryColor,
                          ),
                          title: const Text('FAQs'),
                          subtitle: const Text('Frequently asked questions'),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () =>
                              Navigator.pushNamed(context, AppRoutes.faqs),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(
                            Icons.notifications,
                            color: primaryColor,
                          ),
                          title: const Text('View Notifications'),
                          subtitle: const Text(
                            'Check your notifications and updates',
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () =>
                              AppNavigator.goToTopLevel(
                                context,
                                AppRoutes.notifications,
                              ),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(
                            Icons.announcement,
                            color: primaryColor,
                          ),
                          title: const Text('View Announcements'),
                          subtitle: const Text('Latest news and announcements'),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () =>
                              AppNavigator.goToTopLevel(
                                context,
                                AppRoutes.notifications,
                              ),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(
                            Icons.calendar_today,
                            color: primaryColor,
                          ),
                          title: const Text('View Interview Schedule'),
                          subtitle: const Text(
                            'Check your scheduled interviews',
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () => Navigator.pushNamed(
                            context,
                            AppRoutes.interviewSchedule,
                          ),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(
                            Icons.file_upload,
                            color: primaryColor,
                          ),
                          title: const Text('Upload Renewal Requirements'),
                          subtitle: const Text(
                            'Submit required documents for renewal',
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () =>
                              Navigator.pushNamed(context, AppRoutes.documents),
                        ),
                      ],
                    ),
                  ),
                ] else ...[
                  // --- APPROVED SCHOLAR SECTION ---
                  const Text(
                    'Return Obligations',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 10),
                  // Quick RO Access Card
                  Card(
                    color: const Color(0xFFF5F5F5),
                    elevation: 4,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(borderRadius),
                      side: BorderSide(
                        color: AppColors.gold.withOpacity(0.35),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: AppColors.gold.withOpacity(0.14),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(
                                Icons.assignment_turned_in,
                                  color: AppColors.darkBrown,
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: 12),
                              const Expanded(
                                child: Text(
                                  'Research Opportunity (RO) Management',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.darkBrown,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Access your RO assignments, submit completions, and track your progress.',
                            style: TextStyle(
                              fontSize: 14,
                              color: AppColors.brown.withOpacity(0.88),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: () => Navigator.pushNamed(
                                    context,
                                    AppRoutes.roAssignment,
                                  ),
                                  icon: const Icon(Icons.visibility),
                                  label: const Text('View Assignments'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: primaryColor,
                                    foregroundColor: Colors.white,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () => Navigator.pushNamed(
                                    context,
                                    AppRoutes.roCompletion,
                                  ),
                                  icon: const Icon(Icons.done_all),
                                  label: const Text('Submit RO'),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppColors.darkBrown,
                                    side: BorderSide(
                                      color: AppColors.gold.withOpacity(0.8),
                                    ),
                                    backgroundColor: AppColors.gold.withOpacity(
                                      0.10,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Card(
                    elevation: 2,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(borderRadius),
                    ),
                    child: Column(
                      children: [
                        ListTile(
                          leading: const Icon(
                            Icons.message,
                            color: primaryColor,
                          ),
                          title: const Text('Messaging'),
                          subtitle: const Text('Chat with OSFA & Agencies'),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () =>
                              Navigator.pushNamed(context, AppRoutes.messaging),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(
                            Icons.payment,
                            color: primaryColor,
                          ),
                          title: const Text('Payout Schedule'),
                          subtitle: const Text(
                            'View your personalized schedule',
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () => AppNavigator.goToTopLevel(
                            context,
                            AppRoutes.payouts,
                          ),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(
                            Icons.assignment,
                            color: primaryColor,
                          ),
                          title: const Text('RO Assignment'),
                          subtitle: const Text(
                            'View your research opportunity assignment',
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () =>
                              Navigator.pushNamed(
                                context,
                                AppRoutes.roAssignment,
                              ),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(
                            Icons.done_all,
                            color: primaryColor,
                          ),
                          title: const Text('Submit RO Completion'),
                          subtitle: const Text(
                            'Submit your completed research opportunity',
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () =>
                              Navigator.pushNamed(
                                context,
                                AppRoutes.roCompletion,
                              ),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: const Icon(
                            Icons.support_agent,
                            color: primaryColor,
                          ),
                          title: const Text('Submit Support Ticket'),
                          subtitle: const Text(
                            'Get help regarding your scholarship',
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: Colors.grey,
                          ),
                          onTap: () =>
                              Navigator.pushNamed(context, AppRoutes.tickets),
                        ),
                      ],
                    ),
                  ),
                ],
                // Developer option to test scholar features
                const SizedBox(height: 20),
                if (!_isApproved) ...[
                  Card(
                    color: Colors.yellow[100],
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Developer Testing',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.orange,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Click below to test scholar features (RO Assignment, Payouts, etc.)',
                            style: TextStyle(fontSize: 12),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton.icon(
                            onPressed: () async {
                              final prefs =
                                  await SharedPreferences.getInstance();
                              await prefs.setBool('user_is_verified', true);
                              await prefs.setString(
                                'user_student_id',
                                'TEST2025001',
                              );
                              setState(() {
                                _isApproved = true;
                                _userName = 'TEST2025001';
                              });
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    '✅ Set as verified scholar! Refresh the page to see scholar features.',
                                  ),
                                  backgroundColor: Colors.green,
                                ),
                              );
                            },
                            icon: const Icon(Icons.verified_user),
                            label: const Text('Enable Scholar Mode'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              foregroundColor: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
