import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class RenewalRequirementsScreen extends StatefulWidget {
  const RenewalRequirementsScreen({super.key});

  @override
  State<RenewalRequirementsScreen> createState() =>
      _RenewalRequirementsScreenState();
}

class _RenewalRequirementsScreenState extends State<RenewalRequirementsScreen> {
  final List<Map<String, dynamic>> requirements = [
    {
      'title': 'Certificate of Registration (COR)',
      'description': 'Official COR from the registrar',
      'uploaded': true,
      'status': 'Verified',
      'icon': Icons.assignment,
    },
    {
      'title': 'Grade Form / Transcript',
      'description': 'Current semester grades',
      'uploaded': true,
      'status': 'Verified',
      'icon': Icons.grade,
    },
    {
      'title': 'Enrollment Certification',
      'description': 'Current enrollment status',
      'uploaded': false,
      'status': 'Pending',
      'icon': Icons.card_membership,
    },
    {
      'title': 'Good Moral Character (GMS)',
      'description': 'Issued by your institution',
      'uploaded': false,
      'status': 'Pending',
      'icon': Icons.verified_user,
    },
    {
      'title': 'Financial Aid Status Report',
      'description': 'Current financial aid status',
      'uploaded': true,
      'status': 'Pending Review',
      'icon': Icons.attach_money,
    },
  ];

  @override
  Widget build(BuildContext context) {
    final uploadedCount = requirements.where((r) => r['uploaded']).length;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Renewal Requirements'),
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
      ),
      selectedIndex: 4,
      showDrawer: true,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Progress Card
            Card(
              color: primaryColor.withOpacity(0.1),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Renewal Progress',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '$uploadedCount/${requirements.length}',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: primaryColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: uploadedCount / requirements.length,
                        minHeight: 8,
                        backgroundColor: Colors.grey[300],
                        valueColor: AlwaysStoppedAnimation<Color>(
                          primaryColor,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${((uploadedCount / requirements.length) * 100).toStringAsFixed(0)}% Complete',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Renewal Deadline
            Card(
              color: Colors.orange[50],
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Icon(Icons.calendar_today, color: Colors.orange),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Renewal Deadline',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          Text(
                            'April 30, 2025',
                            style: TextStyle(fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Requirements List
            const Text(
              'Required Documents',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: requirements.length,
              itemBuilder: (context, index) {
                final req = requirements[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: primaryColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(req['icon'], color: primaryColor),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    req['title'],
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(
                                    req['description'],
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: req['uploaded']
                                    ? Colors.green.withOpacity(0.1)
                                    : Colors.orange.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                req['status'],
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: req['uploaded']
                                      ? Colors.green
                                      : Colors.orange,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (!req['uploaded'])
                          SizedBox(
                            width: double.infinity,
                            height: 40,
                            child: OutlinedButton.icon(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      '${req['title']} upload feature coming soon',
                                    ),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.upload_file),
                              label: const Text('Upload Document'),
                            ),
                          ),
                        if (req['uploaded'])
                          Row(
                            children: [
                              const Icon(
                                Icons.check_circle,
                                color: Colors.green,
                                size: 18,
                              ),
                              const SizedBox(width: 8),
                              const Expanded(
                                child: Text(
                                  'Document uploaded and submitted',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.green,
                                  ),
                                ),
                              ),
                              TextButton(
                                onPressed: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Opening document...'),
                                    ),
                                  );
                                },
                                child: const Text('View'),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
