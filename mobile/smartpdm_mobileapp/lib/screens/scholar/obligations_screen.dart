import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class ObligationsScreen extends StatefulWidget {
  const ObligationsScreen({super.key});

  @override
  State<ObligationsScreen> createState() => _ObligationsScreenState();
}

class _ObligationsScreenState extends State<ObligationsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      selectedIndex: 3,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'My Obligations',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(4.0),
            decoration: BoxDecoration(
              color: Colors.grey.withOpacity(0.12),
              borderRadius: BorderRadius.circular(borderRadius),
            ),
            child: TabBar(
              controller: _tabController,
              indicator: BoxDecoration(
                color: primaryColor,
                borderRadius: BorderRadius.circular(borderRadius),
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              tabs: const [
                Tab(text: 'Active'),
                Tab(text: 'Completed'),
              ],
              labelColor: Colors.white,
              unselectedLabelColor: Colors.grey.shade700,
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildActiveTab(),
                _buildCompletedTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveTab() {
    return ListView(
      children: const [
        ObligationCard(
          title: 'Community Service - Library',
          hours: '10 hrs',
          deadline: 'Dec 15',
          status: 'IN PROGRESS',
          progress: 0.4,
          progressText: '4/10 hrs',
          actionText: 'UPLOAD PROOF',
        ),
        ObligationCard(
          title: 'University Event Participation',
          hours: '',
          deadline: 'Nov 30',
          status: 'PENDING',
          progress: 0.0,
          progressText: '',
          actionText: 'UPLOAD PROOF',
        ),
        ObligationCard(
          title: 'Department Service',
          hours: '',
          deadline: 'Dec 20',
          status: 'NOT STARTED',
          progress: 0.0,
          progressText: '',
          actionText: 'VIEW DETAILS',
        ),
      ],
    );
  }

  Widget _buildCompletedTab() {
    return ListView(
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.green, size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Community Service - Completed Dec 1',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      SizedBox(height: 6),
                      Text(
                        'Verified by Dept Head',
                        style: TextStyle(
                          color: Colors.grey,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class ObligationCard extends StatelessWidget {
  const ObligationCard({
    super.key,
    required this.title,
    required this.hours,
    required this.deadline,
    required this.status,
    required this.progress,
    required this.progressText,
    required this.actionText,
  });

  final String title;
  final String hours;
  final String deadline;
  final String status;
  final double progress;
  final String progressText;
  final String actionText;

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    switch (status) {
      case 'IN PROGRESS':
        statusColor = accentColor;
        break;
      case 'PENDING':
        statusColor = Colors.orange;
        break;
      case 'NOT STARTED':
        statusColor = Colors.grey;
        break;
      default:
        statusColor = Colors.grey;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 16.0),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 4),
            if (hours.isNotEmpty) Text(hours),
            Text(deadline),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                status,
                style: TextStyle(
                  color: statusColor,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            if (progress > 0) ...[
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: progress,
                backgroundColor: Colors.grey[300],
                valueColor: AlwaysStoppedAnimation<Color>(statusColor),
              ),
              const SizedBox(height: 4),
              Text(progressText),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {},
                child: Text(actionText),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
