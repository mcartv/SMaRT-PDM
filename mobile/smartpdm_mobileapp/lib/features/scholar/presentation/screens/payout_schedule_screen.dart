import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/payout_service.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_nav_chips.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class PayoutScheduleScreen extends StatefulWidget {
  final bool showBottomNav;

  const PayoutScheduleScreen({super.key, this.showBottomNav = true});

  @override
  State<PayoutScheduleScreen> createState() => _PayoutScheduleScreenState();
}

class _PayoutScheduleScreenState extends State<PayoutScheduleScreen> {
  final PayoutService _payoutService = PayoutService();

  String _selectedScholarView = 'Payout Schedule';
  bool _loading = true;
  String? _error;
  List<MobilePayoutItem> _payouts = [];

  @override
  void initState() {
    super.initState();
    _loadPayouts();
  }

  Future<void> _loadPayouts() async {
    try {
      setState(() {
        _loading = true;
        _error = null;
      });

      final items = await _payoutService.fetchMyPayouts();

      if (!mounted) return;
      setState(() {
        _payouts = items;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
    }
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'released':
      case 'paid':
      case 'completed':
        return Colors.green;
      case 'approved':
        return Colors.blue;
      case 'processing':
      case 'on hold':
        return Colors.orange;
      case 'absent':
        return Colors.red;
      case 'pending':
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'released':
      case 'paid':
      case 'completed':
        return Icons.check_circle;
      case 'approved':
        return Icons.verified;
      case 'processing':
      case 'on hold':
        return Icons.schedule;
      case 'absent':
        return Icons.cancel;
      case 'pending':
      default:
        return Icons.schedule;
    }
  }

  String _formatAmount(double value) {
    return 'PHP ${value.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF332216) : Colors.white;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.grey;

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
      child: RefreshIndicator(
        onRefresh: _loadPayouts,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
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

              if (_loading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_error != null)
                Card(
                  color: cardColor,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        Text(
                          'Failed to load payout schedule.',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: titleColor,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 12, color: subtitleColor),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: _loadPayouts,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              else if (_payouts.isEmpty)
                Card(
                  color: cardColor,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'No payout schedule available yet.',
                      style: TextStyle(color: subtitleColor),
                    ),
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _payouts.length,
                  itemBuilder: (context, index) {
                    final payout = _payouts[index];
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
                                    color: _getStatusColor(payout.status).withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Icon(
                                    _getStatusIcon(payout.status),
                                    color: _getStatusColor(payout.status),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        payout.title,
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: titleColor,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        payout.programName,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: subtitleColor,
                                        ),
                                      ),
                                      if ((payout.benefactorName ?? '').isNotEmpty) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          payout.benefactorName!,
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: subtitleColor,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      _formatAmount(payout.amount),
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
                                        color: _getStatusColor(payout.status).withOpacity(0.2),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        payout.status,
                                        style: TextStyle(
                                          color: _getStatusColor(payout.status),
                                          fontWeight: FontWeight.w600,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            Divider(color: Colors.grey.withOpacity(0.2)),
                            const SizedBox(height: 10),
                            _infoRow('Payout Date', payout.payoutDate.isEmpty ? 'TBA' : payout.payoutDate, subtitleColor),
                            _infoRow('Semester', payout.semester.isEmpty ? '-' : payout.semester, subtitleColor),
                            _infoRow('School Year', payout.schoolYear.isEmpty ? '-' : payout.schoolYear, subtitleColor),
                            _infoRow('Payment Mode', payout.paymentMode.isEmpty ? '-' : payout.paymentMode, subtitleColor),
                            _infoRow('Batch Status', payout.batchStatus.isEmpty ? '-' : payout.batchStatus, subtitleColor),
                            _infoRow('Reference', payout.reference.isEmpty ? '-' : payout.reference, subtitleColor),
                          ],
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              '$label:',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(fontSize: 12, color: color),
            ),
          ),
        ],
      ),
    );
  }
}