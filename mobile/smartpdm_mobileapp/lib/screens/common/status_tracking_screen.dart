import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class StatusTrackingScreen extends StatelessWidget {
  const StatusTrackingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      selectedIndex: 2,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Application Status - TES-2025-0123',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 10),
            Card(
              color: Colors.orange[50],
              child: const Padding(
                padding: EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Icon(Icons.access_time, color: Colors.orange),
                    SizedBox(width: 12),
                    Text(
                      'Under Review',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.orange,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Timeline',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            const TimelineItem(
              step: 1,
              title: 'Application Submitted',
              date: 'Oct 20',
              status: 'completed',
              details: '',
            ),
            const TimelineItem(
              step: 2,
              title: 'Document Verification',
              date: '',
              status: 'in_progress',
              details: 'COR ✓, Grade Form ⏳, Indigency ✓',
            ),
            const TimelineItem(
              step: 3,
              title: 'Admin Review',
              date: '',
              status: 'in_progress',
              details: 'Est Nov 5',
            ),
            const TimelineItem(
              step: 4,
              title: 'Approval',
              date: '',
              status: 'in_progress',
              details: '',
            ),
            const SizedBox(height: 20),
            Card(
              color: Colors.red[50],
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.warning, color: Colors.red),
                        SizedBox(width: 12),
                        Text(
                          'Action Required: Grade Form unclear. Re-upload',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.red,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {},
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red,
                        ),
                        child: const Text('UPLOAD NOW'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TimelineItem extends StatelessWidget {
  const TimelineItem({
    super.key,
    required this.step,
    required this.title,
    required this.date,
    required this.status,
    required this.details,
  });

  final int step;
  final String title;
  final String date;
  final String status;
  final String details;

  @override
  Widget build(BuildContext context) {
    IconData icon;
    Color color;

    switch (status) {
      case 'completed':
        icon = Icons.check_circle;
        color = Colors.green;
        break;
      case 'in_progress':
        icon = Icons.access_time;
        color = Colors.orange;
        break;
      default:
        icon = Icons.hourglass_empty;
        color = Colors.orange.withOpacity(0.65);
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Icon(icon, color: color),
            if (step < 4)
              Container(
                width: 2,
                height: 60,
                color: Colors.grey[300],
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Step $step: $title',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (date.isNotEmpty) Text(date),
              if (details.isNotEmpty) Text(details),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ],
    );
  }
}
