import 'package:flutter/material.dart';
import '../constants.dart';

class ScholarshipListScreen extends StatelessWidget {
  const ScholarshipListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Available Scholarships'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: const Text('All'),
                  selected: true,
                  onSelected: (bool value) {},
                ),
                FilterChip(
                  label: const Text('Government'),
                  selected: false,
                  onSelected: (bool value) {},
                ),
                FilterChip(
                  label: const Text('Private'),
                  selected: false,
                  onSelected: (bool value) {},
                ),
                FilterChip(
                  label: const Text('TES'),
                  selected: false,
                  onSelected: (bool value) {},
                ),
                FilterChip(
                  label: const Text('TDP'),
                  selected: false,
                  onSelected: (bool value) {},
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16.0),
              children: const [
                ScholarshipCard(
                  title: 'Tertiary Education Subsidy (TES)',
                  provider: 'CHED-UNIFAST',
                  amount: '₱40,000/yr',
                  deadline: 'Oct 30',
                  status: 'OPEN',
                  isNew: false,
                ),
                ScholarshipCard(
                  title: 'Tulong Dunong Program',
                  provider: 'CHED',
                  amount: '₱10,000/sem',
                  deadline: 'Nov 15',
                  status: null,
                  isNew: false,
                ),
                ScholarshipCard(
                  title: 'BC Packaging Grant',
                  provider: 'Private',
                  amount: 'Full Tuition',
                  deadline: 'Dec 1',
                  status: null,
                  isNew: true,
                ),
                ScholarshipCard(
                  title: 'Kaizen',
                  provider: 'Private',
                  amount: '',
                  deadline: 'Dec 15',
                  status: null,
                  isNew: false,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ScholarshipCard extends StatelessWidget {
  const ScholarshipCard({
    super.key,
    required this.title,
    required this.provider,
    required this.amount,
    required this.deadline,
    this.status,
    required this.isNew,
  });

  final String title;
  final String provider;
  final String amount;
  final String deadline;
  final String? status;
  final bool isNew;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16.0),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, '/application'),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  if (status != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.green,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        status!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  if (isNew)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.blue,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'NEW',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(provider, style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(amount, style: const TextStyle(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  Text('Deadline: $deadline'),
                ],
              ),
              const SizedBox(height: 8),
              const Align(
                alignment: Alignment.centerRight,
                child: Text(
                  'APPLY NOW',
                  style: TextStyle(
                    color: primaryColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}