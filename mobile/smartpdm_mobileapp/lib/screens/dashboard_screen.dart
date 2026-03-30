import 'dart:io';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';
import '../widgets/smart_pdm_page_scaffold.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SmartPdmPageScaffold(
      selectedIndex: 0,
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
  String? _imagePath;
  bool _isApproved = false; // Mocking approval status based on backend verification

  @override
  void initState() {
    super.initState();
    _loadAndDisplayUserData();
  }

  Future<void> _loadAndDisplayUserData() async {
    final prefs = await SharedPreferences.getInstance();
    final studentId = prefs.getString('user_student_id') ?? 'Scholar';
    final imagePath = prefs.getString('user_avatar_url');
    final isVerified = prefs.getBool('user_is_verified') ?? false;
    
    if (mounted) {
      setState(() {
        _userName = studentId;
        _imagePath = imagePath;
        _isApproved = isVerified;
      }); // Fix: Added missing closing parenthesis and semicolon
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: primaryColor,
                  backgroundImage: _imagePath != null
                      ? (_imagePath!.startsWith('http')
                          ? NetworkImage(_imagePath!) as ImageProvider
                          : FileImage(File(_imagePath!)))
                      : null,
                  child: _imagePath == null 
                      ? const Icon(Icons.person, color: Colors.white) 
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Hello, $_userName!',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            TextField(
              decoration: InputDecoration(
                hintText: 'Search scholarships...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(borderRadius),
                ),
                filled: true,
                fillColor: Colors.white,
              ),
            ),
            const SizedBox(height: 20),
            Card(
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
              const Text('Scholarship Application', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),
              ListTile(
                leading: const Icon(Icons.person_add, color: primaryColor),
                title: const Text('Apply for New Scholarship'),
                subtitle: const Text('Start your application as a new scholar'),
                onTap: () {
                  Navigator.pushNamed(context, '/new_applicant');
                },
              ),
              ListTile(
                leading: const Icon(Icons.edit_note, color: primaryColor),
                title: const Text('Update Personal Data (Existing Scholar)'),
                subtitle: const Text('Update your profile if you are an existing scholar'),
                onTap: () {
                  Navigator.pushNamed(context, '/existing_scholar_update');
                },
              ),
              const SizedBox(height: 20),
              const Text('General Information', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),
              ListTile(
                leading: const Icon(Icons.info_outline, color: primaryColor),
                title: const Text('About PDM/OSFA'),
                subtitle: const Text('History, Vision, Mission, Contacts'),
                onTap: () => Navigator.pushNamed(context, '/about'),
              ),
              ListTile(
                leading: const Icon(Icons.question_answer, color: primaryColor),
                title: const Text('FAQs'),
                subtitle: const Text('Frequently asked questions'),
                onTap: () => Navigator.pushNamed(context, '/faqs'),
              ),
            ] else ...[
              // --- APPROVED SCHOLAR SECTION ---
              const Text('Scholar Portal', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),
              ListTile(
                leading: const Icon(Icons.message, color: primaryColor),
                title: const Text('Messaging'),
                subtitle: const Text('Chat with OSFA & Agencies'),
                onTap: () => Navigator.pushNamed(context, '/messaging'),
              ),
              ListTile(
                leading: const Icon(Icons.payment, color: primaryColor),
                title: const Text('Specific Payout Schedule'),
                subtitle: const Text('View your personalized schedule'),
                onTap: () => Navigator.pushNamed(context, '/payouts'),
              ),
              ListTile(
                leading: const Icon(Icons.support_agent, color: primaryColor),
                title: const Text('Submit Ticket'),
                subtitle: const Text('Get help regarding your scholarship'),
                onTap: () => Navigator.pushNamed(context, '/tickets'),
              ),
            ],
            const SizedBox(height: 20),
            const Text(
              'Announcements',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
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
    );
  }
}