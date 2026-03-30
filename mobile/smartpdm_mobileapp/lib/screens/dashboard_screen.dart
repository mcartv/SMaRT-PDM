import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';
import '../widgets/smart_pdm_page_scaffold.dart';
import '../widgets/app_theme.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SmartPdmPageScaffold(
      selectedIndex: 0,
      applyPadding: false,
      child: DashboardContent(),
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
  bool _isApproved = false; // Mocking approval status based on backend verification

  @override
  void initState() {
    super.initState();
    _loadAndDisplayUserData();
  }

  Future<void> _loadAndDisplayUserData() async {
    final prefs = await SharedPreferences.getInstance();
    final studentId = prefs.getString('user_student_id') ?? 'Scholar';
    final isVerified = prefs.getBool('user_is_verified') ?? false;

    if (mounted) {
      setState(() {
        _userName = studentId;
        _isApproved = isVerified;
      });
    }
  }

  Widget _buildTopicChip(String label) {
    return Padding(
      padding: const EdgeInsets.only(right: 8.0),
      child: ActionChip(
        label: Text(label, style: const TextStyle(color: AppColors.darkBrown, fontWeight: FontWeight.w600)),
        backgroundColor: AppColors.yellow,
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Selected $label')));
        },
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
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), color: Colors.black.withOpacity(0.35)),
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
                    child: Image.asset('assets/images/school_logo.png', width: 42, height: 42),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Pambayang Dalubhasaan ng Marilao',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      const SizedBox(height: 2),
                      Text('Hello, $_userName!', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    ],
                  ),
                ),
                TextButton.icon(
                  style: TextButton.styleFrom(foregroundColor: AppColors.yellow),
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back),
                  label: const Text('Back Home'),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const Text('Academics', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Colors.white)),
            const SizedBox(height: 4),
            const Text('Forge your future to academic excellence.', style: TextStyle(fontSize: 14, color: Colors.white70)),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 8,
              children: ['Academics', 'Admission', 'Financial Aid', 'Student Life', 'Scholarships']
                  .map((label) => Chip(
                        label: Text(label, style: const TextStyle(color: AppColors.darkBrown, fontWeight: FontWeight.bold)),
                        backgroundColor: AppColors.yellow,
                      ))
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureCards() {
    final cards = [
      {'title': 'Find Your Program', 'subtitle': 'Explore available courses', 'icon': Icons.search},
      {'title': 'Arts & Sciences', 'subtitle': 'Humanities and research', 'icon': Icons.palette},
      {'title': 'Business', 'subtitle': 'Management and finance', 'icon': Icons.business_center},
      {'title': 'Engineering', 'subtitle': 'Technology and innovation', 'icon': Icons.engineering},
      {'title': 'Nursing', 'subtitle': 'Health professions', 'icon': Icons.local_hospital},
      {'title': 'Graduate Studies', 'subtitle': 'Master’s and PhD', 'icon': Icons.school},
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 900 ? 3 : constraints.maxWidth > 600 ? 2 : 1;
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
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: InkWell(
                onTap: () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Selected ${cardData['title']}'))),
                borderRadius: BorderRadius.circular(14),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      Icon(cardData['icon'] as IconData, color: AppColors.darkBrown),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(cardData['title'] as String, style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.darkBrown)),
                            const SizedBox(height: 3),
                            Text(cardData['subtitle'] as String, style: const TextStyle(fontSize: 12, color: AppColors.brown)),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward, color: AppColors.darkBrown),
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
                _buildFeatureCards(),
                const SizedBox(height: 20),
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xF2FFFFFF),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.gold, width: 1.5),
                    boxShadow: [
                      const BoxShadow(color: Color(0x1A000000), blurRadius: 8, offset: Offset(0, 4)),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Explore Academics', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold, color: AppColors.darkBrown)),
                        const SizedBox(height: 8),
                        const Text(
                          'Grounded in purpose, we radiate possibility. Learn, connect, and take the next step in your scholarship journey.',
                          style: TextStyle(fontSize: 14, color: AppColors.brown),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => Navigator.pushNamed(context, '/new_applicant'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.gold,
                              foregroundColor: AppColors.darkBrown,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: const Text('APPLY NOW', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pushNamed(context, '/faqs'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.darkBrown,
                              side: const BorderSide(color: AppColors.darkBrown),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: const Text('REQUEST INFO'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _buildTopicChip('Academics'),
                  _buildTopicChip('Admission'),
                  _buildTopicChip('Financial Aid'),
                  _buildTopicChip('Student Life'),
                  _buildTopicChip('Graduate Studies'),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(borderRadius)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Application Status',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text('TES 2025'),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: 0.6,
                      backgroundColor: Colors.grey[300],
                      valueColor: const AlwaysStoppedAnimation<Color>(primaryColor),
                    ),
                    const SizedBox(height: 4),
                    const Text('Documents Pending'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Deadlines',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.red[100],
                        borderRadius: BorderRadius.circular(borderRadius),
                      ),
                      child: const Icon(Icons.calendar_today, color: Colors.red),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('TES Oct 30'),
                          Text('Deadline approaching'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.orange[100],
                        borderRadius: BorderRadius.circular(borderRadius),
                      ),
                      child: const Icon(Icons.calendar_today, color: Colors.orange),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('TDP Nov 15'),
                          Text('Upcoming deadline'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Quick Actions',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Card(
                    child: InkWell(
                      onTap: () => Navigator.pushNamed(context, '/application'),
                      child: const Padding(
                        padding: EdgeInsets.all(16.0),
                        child: Column(
                          children: [
                            Icon(Icons.add, color: primaryColor),
                            SizedBox(height: 8),
                            Text('Apply'),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Card(
                    child: InkWell(
                      onTap: () => Navigator.pushNamed(context, '/documents'),
                      child: const Padding(
                        padding: EdgeInsets.all(16.0),
                        child: Column(
                          children: [
                            Icon(Icons.upload_file, color: primaryColor),
                            SizedBox(height: 8),
                            Text('Documents'),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Card(
                    child: InkWell(
                      onTap: () => Navigator.pushNamed(context, '/status'),
                      child: const Padding(
                        padding: EdgeInsets.all(16.0),
                        child: Column(
                          children: [
                            Icon(Icons.track_changes, color: primaryColor),
                            SizedBox(height: 8),
                            Text('Status'),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (!_isApproved) ...[
              // --- NOT VERIFIED YET SECTION ---
              const Text('Scholarship Application', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 10),
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(borderRadius)),
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.person_add, color: primaryColor),
                      title: const Text('Apply for New Scholarship'),
                      subtitle: const Text('Start your application as a new scholar'),
                      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                      onTap: () {
                        Navigator.pushNamed(context, '/new_applicant');
                      },
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.edit_note, color: primaryColor),
                      title: const Text('Update Personal Data (Existing Scholar)'),
                      subtitle: const Text('Update your profile if you are an existing scholar'),
                      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                      onTap: () {
                        Navigator.pushNamed(context, '/existing_scholar_update');
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text('General Information', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 10),
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(borderRadius)),
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.info_outline, color: primaryColor),
                      title: const Text('About PDM/OSFA'),
                      subtitle: const Text('History, Vision, Mission, Contacts'),
                      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                      onTap: () => Navigator.pushNamed(context, '/about'),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.question_answer, color: primaryColor),
                      title: const Text('FAQs'),
                      subtitle: const Text('Frequently asked questions'),
                      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                      onTap: () => Navigator.pushNamed(context, '/faqs'),
                    ),
                  ],
                ),
              ),
            ] else ...[
              // --- APPROVED SCHOLAR SECTION ---
              const Text('Scholar Portal', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 10),
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(borderRadius)),
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.message, color: primaryColor),
                      title: const Text('Messaging'),
                      subtitle: const Text('Chat with OSFA & Agencies'),
                      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                      onTap: () => Navigator.pushNamed(context, '/messaging'),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.payment, color: primaryColor),
                      title: const Text('Specific Payout Schedule'),
                      subtitle: const Text('View your personalized schedule'),
                      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                      onTap: () => Navigator.pushNamed(context, '/payouts'),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.support_agent, color: primaryColor),
                      title: const Text('Submit Ticket'),
                      subtitle: const Text('Get help regarding your scholarship'),
                      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                      onTap: () => Navigator.pushNamed(context, '/tickets'),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            const Text(
              'Announcements',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 10),
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: Text('BC Packaging Grant - New scholarship opportunity available!'),
              ),
            ),
            const SizedBox(height: 10),
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: Text('Grade Reminder - Submit your latest grades for TES application.'),
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
