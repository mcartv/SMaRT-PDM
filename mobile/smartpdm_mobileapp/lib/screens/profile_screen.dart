import 'package:flutter/material.dart';
import '../constants.dart';
import '../widgets/smart_pdm_page_scaffold.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      selectedIndex: 4,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    Container(
                      width: 92,
                      height: 92,
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: accentColor,
                          width: 4,
                        ),
                        borderRadius: BorderRadius.circular(28),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: Container(
                          color: primaryColor.withOpacity(0.1),
                          child: const Center(
                            child: Icon(
                              Icons.person,
                              size: 44,
                              color: primaryColor,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'MARIA SANTOS',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.4,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'INSTITUTIONAL SCHOLAR',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.grey.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(borderRadius),
                      ),
                      child: const Text(
                        '2021-0452 | BS Computer Science',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            _profileRowCard(
              icon: Icons.school,
              title: 'ACADEMIC PERFORMANCE',
              trailing: const Icon(Icons.chevron_right),
            ),
            const SizedBox(height: 10),
            _profileRowCard(
              icon: Icons.verified_user,
              title: 'IDENTITY VERIFICATION',
              subtitle: 'Verified ✓',
              trailing: const Icon(Icons.chevron_right),
            ),
            const SizedBox(height: 10),
            _profileRowCard(
              icon: Icons.lock,
              title: 'SECURITY & ACCESS',
              subtitle: 'PDM MFA Enabled',
              trailing: const Icon(Icons.chevron_right),
            ),
            const SizedBox(height: 14),
            Card(
              color: Colors.red.withOpacity(0.08),
              shape: RoundedRectangleBorder(
                side: BorderSide(color: Colors.red.shade300),
                borderRadius: BorderRadius.circular(borderRadius),
              ),
              child: InkWell(
                onTap: () {},
                borderRadius: BorderRadius.circular(borderRadius),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.logout,
                        color: Colors.red,
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Text(
                          'TERMINATE SESSION',
                          style: TextStyle(
                            color: Colors.red,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                      const Icon(Icons.error_outline, color: Colors.red),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _profileRowCard({
    required IconData icon,
    required String title,
    String? subtitle,
    required Widget trailing,
  }) {
    return Card(
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(borderRadius),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: primaryColor.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: primaryColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        letterSpacing: 0.2,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade700,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              trailing,
            ],
          ),
        ),
      ),
    );
  }
}

