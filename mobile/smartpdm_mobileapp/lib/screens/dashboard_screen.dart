import 'package:flutter/material.dart';
import '../constants.dart';
import '../widgets/smart_pdm_page_scaffold.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      selectedIndex: 0,
      child: const DashboardContent(),
    );
  }
}

class DashboardContent extends StatelessWidget {
  const DashboardContent({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const CircleAvatar(
                radius: 20,
                backgroundColor: primaryColor,
                child: Icon(Icons.person, color: Colors.white),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Hello, Maria Santos!',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.notifications_none),
                color: primaryColor,
                onPressed: () {},
              ),
            ],
          ),
          const SizedBox(height: 16),

          TextField(
            decoration: InputDecoration(
              hintText: 'Search for scholarships...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(borderRadius),
              ),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
          const SizedBox(height: 16),

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
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: accentColor,
                          borderRadius: BorderRadius.circular(borderRadius),
                        ),
                        child: const Text(
                          'TES 2025',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.green.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(borderRadius),
                        ),
                        child: const Text(
                          'ACTIVE',
                          style: TextStyle(
                            color: Colors.green,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: LinearProgressIndicator(
                          value: 0.6,
                          backgroundColor: Colors.grey[300],
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            accentColor,
                          ),
                          minHeight: 8,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        '60%',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Documents Pending',
                    style: TextStyle(
                      color: Colors.grey,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),

                  const SizedBox(height: 12),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.orange.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(borderRadius),
                      border: Border.all(
                        color: Colors.orange.withOpacity(0.35),
                      ),
                    ),
                    padding: const EdgeInsets.all(12.0),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: Colors.orange),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'REQUESTS ACTION: DOCUMENT INCOMPLETE',
                            style: TextStyle(
                              color: Colors.orange.shade900,
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          Card(
            color: primaryColor,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'INSTITUTIONAL DEADLINES',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _deadlineRow(
                    icon: Icons.calendar_month,
                    title: 'TES Scholarship',
                    subtitle: 'Application Period',
                    dateText: 'OCT 30',
                  ),
                  const SizedBox(height: 10),
                  _deadlineRow(
                    icon: Icons.calendar_month,
                    title: 'TDP Program',
                    subtitle: 'Renewal Deadline',
                    dateText: 'NOV 15',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          const Text(
            'MAIN SERVICES',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: Colors.grey,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              _quickAction(
                label: 'APPLY',
                icon: Icons.assignment,
                onTap: () => Navigator.pushNamed(context, '/application'),
              ),
              const SizedBox(width: 10),
              _quickAction(
                label: 'UPLOAD',
                icon: Icons.upload_file,
                onTap: () => Navigator.pushNamed(context, '/documents'),
              ),
              const SizedBox(width: 10),
              _quickAction(
                label: 'TRACKING',
                icon: Icons.search,
                onTap: () => Navigator.pushNamed(context, '/status'),
              ),
              const SizedBox(width: 10),
              _quickAction(
                label: 'OBLIGS',
                icon: Icons.checklist,
                onTap: () => Navigator.pushNamed(context, '/obligations'),
              ),
            ],
          ),

          const SizedBox(height: 18),

          Row(
            children: [
              const Expanded(
                child: Text(
                  'OFFICE UPDATES',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Colors.grey,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
              TextButton(
                onPressed: () {},
                child: const Text(
                  'VIEW FEED',
                  style: TextStyle(
                    color: accentColor,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          _officeUpdate(
            title: 'BC Packaging Grant',
            subtitle: 'New local government grant available for Maria residents.',
            timeAgo: '2h ago',
          ),
          const SizedBox(height: 10),
          _officeUpdate(
            title: 'Grade Submission Reminder',
            subtitle: 'Ensure your 1st Semester GWA is uploaded.',
            timeAgo: '5h ago',
          ),
        ],
      ),
    );
  }
}

Widget _quickAction({
  required String label,
  required IconData icon,
  required VoidCallback onTap,
}) {
  return Expanded(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(borderRadius),
      child: Card(
        margin: EdgeInsets.zero,
        elevation: 1,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: primaryColor),
              const SizedBox(height: 8),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

Widget _officeUpdate({
  required String title,
  required String subtitle,
  required String timeAgo,
}) {
  return Card(
    child: Padding(
      padding: const EdgeInsets.all(16.0),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: accentColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.notifications, color: accentColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.grey.shade700,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Text(
            timeAgo,
            style: TextStyle(
              color: Colors.grey.shade600,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    ),
  );
}

Widget _deadlineRow({
  required IconData icon,
  required String title,
  required String subtitle,
  required String dateText,
}) {
  return Row(
    children: [
      Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.10),
          borderRadius: BorderRadius.circular(borderRadius),
        ),
        child: Icon(icon, color: Colors.white),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                color: Colors.white.withOpacity(0.85),
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.amber,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          dateText,
          style: const TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.w900,
            fontSize: 12,
          ),
        ),
      ),
    ],
  );
}