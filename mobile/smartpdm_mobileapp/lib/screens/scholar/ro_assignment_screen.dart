import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class ROAssignmentScreen extends StatefulWidget {
  const ROAssignmentScreen({super.key});

  @override
  State<ROAssignmentScreen> createState() => _ROAssignmentScreenState();
}

class _ROAssignmentScreenState extends State<ROAssignmentScreen> {
  final List<Map<String, dynamic>> assignments = [
    {
      'id': 'RO-2025-001',
      'title': 'Student Support Services',
      'department': 'Office of Student Affairs',
      'supervisor': 'Ms. Rachel Johnson',
      'startDate': 'January 15, 2025',
      'endDate': 'April 30, 2025',
      'hoursPerWeek': 10,
      'status': 'Active',
      'description':
          'Assist in organizing student events and support programs. Handle administrative tasks and student inquiries.',
    },
    {
      'id': 'RO-2025-002',
      'title': 'Library Research Assistant',
      'department': 'University Library',
      'supervisor': 'Mr. Mark Torres',
      'startDate': 'Pending Assignment',
      'endDate': 'Pending',
      'hoursPerWeek': 8,
      'status': 'Assigned',
      'description':
          'Assist in library cataloging and research support. Help students locate academic resources.',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('RO Assignment'),
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
      ),
      selectedIndex: 1,
      showDrawer: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            const Text(
              'Research Opportunity Assignments',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'As a scholar, you are required to complete research opportunities',
              style: TextStyle(color: Colors.grey, fontSize: 13),
            ),
            const SizedBox(height: 20),

            // Assignments
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: assignments.length,
              itemBuilder: (context, index) {
                final assignment = assignments[index];
                final isActive = assignment['status'] == 'Active';

                return Card(
                  margin: const EdgeInsets.only(bottom: 16),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title and Status
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    assignment['title'],
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    assignment['id'],
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: isActive
                                    ? Colors.green.withOpacity(0.1)
                                    : Colors.blue.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                assignment['status'],
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: isActive ? Colors.green : Colors.blue,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Department and Supervisor
                        _buildInfoRow(
                          icon: Icons.business,
                          label: 'Department',
                          value: assignment['department'],
                        ),
                        const SizedBox(height: 8),
                        _buildInfoRow(
                          icon: Icons.person,
                          label: 'Supervisor',
                          value: assignment['supervisor'],
                        ),
                        const SizedBox(height: 12),

                        // Duration
                        if (isActive)
                          Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: _buildDurationBox(
                                      'Start Date',
                                      assignment['startDate'],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: _buildDurationBox(
                                      'End Date',
                                      assignment['endDate'],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                            ],
                          ),

                        // Hours per week
                        _buildInfoRow(
                          icon: Icons.schedule,
                          label: 'Hours/Week',
                          value: '${assignment['hoursPerWeek']} hours',
                        ),
                        const SizedBox(height: 12),

                        // Description
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.grey[100],
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Description',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                assignment['description'],
                                style: const TextStyle(
                                  fontSize: 13,
                                  height: 1.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Action Button
                        if (isActive)
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () {
                                Navigator.pushNamed(
                                  context,
                                  '/ro-completion',
                                  arguments: assignment,
                                );
                              },
                              icon: const Icon(Icons.done_all),
                              label: const Text(
                                'Submit Completion',
                                maxLines: 1,
                                overflow: TextOverflow.visible,
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: primaryColor,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 12,
                                ),
                              ),
                            ),
                          )
                        else
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'You will be notified when assigned to this RO',
                                    ),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.info),
                              label: const Text(
                                'Awaiting Confirmation',
                                maxLines: 1,
                                overflow: TextOverflow.visible,
                              ),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 12,
                                ),
                              ),
                            ),
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

  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      children: [
        Icon(icon, color: primaryColor, size: 18),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: Colors.grey,
            fontWeight: FontWeight.w500,
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  Widget _buildDurationBox(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: Colors.grey,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
