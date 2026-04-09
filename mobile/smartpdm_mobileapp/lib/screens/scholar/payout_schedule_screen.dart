import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/navigation/app_navigator.dart';
import 'package:smartpdm_mobileapp/navigation/app_routes.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';
import 'package:smartpdm_mobileapp/widgets/scholar_nav_chips.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class PayoutScheduleScreen extends StatefulWidget {
  final bool showBottomNav;

  const PayoutScheduleScreen({super.key, this.showBottomNav = true});

  @override
  State<PayoutScheduleScreen> createState() => _PayoutScheduleScreenState();
}

class _PayoutScheduleScreenState extends State<PayoutScheduleScreen> {
  String _selectedScholarView = 'Payout Schedule';

  final List<Map<String, dynamic>> payouts = [
    {
      'month': 'August 2025',
      'amount': 'PHP 15,000',
      'status': 'Paid',
      'date': 'August 15, 2025',
      'reference': 'REF-2025-0801',
    },
    {
      'month': 'September 2025',
      'amount': 'PHP 15,000',
      'status': 'Approved',
      'date': 'Expected Sep 15, 2025',
      'reference': 'REF-2025-0902',
    },
    {
      'month': 'October 2025',
      'amount': 'PHP 15,000',
      'status': 'Processing',
      'date': 'Expected Oct 15, 2025',
      'reference': 'REF-2025-1003',
    },
    {
      'month': 'November 2025',
      'amount': 'PHP 15,000',
      'status': 'Pending',
      'date': 'Expected Nov 15, 2025',
      'reference': '-',
    },
  ];

  Color _getStatusColor(String status) {
    switch (status) {
      case 'Paid':
        return Colors.green;
      case 'Approved':
        return Colors.blue;
      case 'Processing':
        return Colors.orange;
      case 'Pending':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'Paid':
        return Icons.check_circle;
      case 'Approved':
        return Icons.verified;
      case 'Processing':
        return Icons.schedule;
      case 'Pending':
        return Icons.schedule;
      default:
        return Icons.help;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF332216) : Colors.white;
    final sectionCardColor = isDark
        ? const Color(0xFF2D1E12)
        : Colors.blue[50]!;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.grey;
    final iconAccent = isDark ? const Color(0xFFFFD54F) : AppColors.darkBrown;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Payout Schedule'),
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
        elevation: 0,
        automaticallyImplyLeading: false,
      ),
      selectedIndex: 1,
      showBottomNav: widget.showBottomNav,
      showDrawer: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ScholarNavChips(
              selectedLabel: _selectedScholarView,
              onTap: (label) {
                setState(() {
                  _selectedScholarView = label;
                });

                switch (label) {
                  case 'Payout Schedule':
                    AppNavigator.goToTopLevel(context, AppRoutes.payouts);
                    break;
                  case 'Renewal Documents':
                    Navigator.pushNamed(context, AppRoutes.renewalDocuments);
                    break;
                  case 'RO Assignment':
                    Navigator.pushNamed(context, AppRoutes.roAssignment);
                    break;
                  case 'RO Completion':
                    Navigator.pushNamed(context, AppRoutes.roCompletion);
                    break;
                }
              },
            ),
            const SizedBox(height: 20),
            Text(
              'Payment Schedule',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: titleColor,
              ),
            ),
            const SizedBox(height: 12),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: payouts.length,
              itemBuilder: (context, index) {
                final payout = payouts[index];
                return Card(
                  color: cardColor,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: _getStatusColor(
                                  payout['status'],
                                ).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(
                                _getStatusIcon(payout['status']),
                                color: _getStatusColor(payout['status']),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    payout['month'],
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                      color: titleColor,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    payout['date'],
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: subtitleColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  payout['amount'],
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                    color: titleColor,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _getStatusColor(
                                      payout['status'],
                                    ).withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    payout['status'],
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: _getStatusColor(payout['status']),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (payout['reference'] != '-')
                          Text(
                            'Reference: ${payout['reference']}',
                            style: TextStyle(
                              fontSize: 11,
                              color: subtitleColor,
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 20),
            Card(
              color: sectionCardColor,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.account_balance, color: iconAccent),
                        const SizedBox(width: 8),
                        Text(
                          'Bank Details',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: titleColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Bank: BDO Unibank',
                      style: TextStyle(fontSize: 13, color: titleColor),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Account Name: John Doe',
                      style: TextStyle(fontSize: 13, color: titleColor),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Account Number: ****5678',
                      style: TextStyle(fontSize: 13, color: titleColor),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Update bank details feature'),
                          ),
                        );
                      },
                      child: Text(
                        'Update Bank Details',
                        style: TextStyle(color: iconAccent),
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
