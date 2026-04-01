import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class ScholarshipListScreen extends StatefulWidget {
  const ScholarshipListScreen({super.key});

  @override
  State<ScholarshipListScreen> createState() => _ScholarshipListScreenState();
}

class _ScholarshipListScreenState extends State<ScholarshipListScreen> {
  String _selectedFilter = 'All';

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      selectedIndex: 1,
      child: Column(
        children: [
          const Text(
            'Available Scholarships',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'ACADEMIC YEAR 2025-2026',
            style: TextStyle(
              fontSize: 11,
              color: Colors.grey,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            children: [
              _filterChip(label: 'All'),
              _filterChip(label: 'Government'),
              _filterChip(label: 'Private'),
              _filterChip(label: 'TES'),
              _filterChip(label: 'TDP'),
            ],
          ),
          const SizedBox(height: 14),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                ScholarshipCard(
                  title: 'Tertiary Education Subsidy (TES)',
                  provider: 'CHED-UNIFAST',
                  amount: '₱40,000/yr',
                  deadline: 'Oct 30',
                  badgeText: 'OPEN',
                  badgeColor: Colors.green,
                  applyText: 'APPLY NOW',
                ),
                const SizedBox(height: 12),
                ScholarshipCard(
                  title: 'Tulong Dunong Program',
                  provider: 'CHED',
                  amount: '₱10,000/sem',
                  deadline: 'Nov 15',
                  badgeText: null,
                  badgeColor: Colors.grey,
                  applyText: 'APPLY',
                ),
                const SizedBox(height: 12),
                ScholarshipCard(
                  title: 'BC Packaging Grant',
                  provider: 'Private',
                  amount: 'Full Tuition',
                  deadline: 'Dec 1',
                  badgeText: 'NEW',
                  badgeColor: primaryColor,
                  applyText: 'APPLY',
                ),
                const SizedBox(height: 12),
                ScholarshipCard(
                  title: 'Kaizen',
                  provider: 'Private',
                  amount: 'Partial',
                  deadline: 'Dec 15',
                  badgeText: null,
                  badgeColor: Colors.grey,
                  applyText: 'APPLY',
                ),
                const SizedBox(height: 6),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip({required String label}) {
    final bool selected = _selectedFilter == label;
    return FilterChip(
      label: Text(
        label,
        style: TextStyle(
          fontWeight: FontWeight.w800,
          color: selected ? Colors.white : Colors.grey.shade700,
        ),
      ),
      selected: selected,
      selectedColor: primaryColor,
      backgroundColor: Colors.white,
      onSelected: (_) {
        setState(() {
          _selectedFilter = label;
        });
      },
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
    required this.badgeText,
    required this.badgeColor,
    required this.applyText,
  });

  final String title;
  final String provider;
  final String amount;
  final String deadline;
  final String? badgeText;
  final Color badgeColor;
  final String applyText;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, '/application'),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (badgeText != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: badgeColor,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        badgeText!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
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
                      color: Colors.grey.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'EST. VALUE',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                provider,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey.shade700,
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Text(
                    amount,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      color: primaryColor,
                    ),
                  ),
                  const Spacer(),
                  Row(
                    children: [
                      const Icon(Icons.calendar_today, size: 16, color: Colors.orange),
                      const SizedBox(width: 6),
                      Text(
                        'DEADLINE: $deadline',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          color: Colors.orange.shade900,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  applyText,
                  style: TextStyle(
                    color: primaryColor,
                    fontWeight: FontWeight.w900,
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
