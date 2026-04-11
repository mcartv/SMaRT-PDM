import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/models/support_ticket.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/support_ticket_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ReportTicketScreen extends StatefulWidget {
  const ReportTicketScreen({super.key});

  @override
  State<ReportTicketScreen> createState() => _ReportTicketScreenState();
}

class _ReportTicketScreenState extends State<ReportTicketScreen> {
  static const List<String> _categories = [
    'Account Issue',
    'OCR Error',
    'Document Issue',
    'Payment Concern',
    'Technical Problem',
    'Scholarship Question',
    'General Inquiry',
    'Other',
  ];

  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final SupportTicketService _ticketService = SupportTicketService();

  String _selectedCategory = _categories.first;
  bool _isSubmitting = false;
  bool _isLoadingTickets = true;
  String _loadError = '';
  List<SupportTicket> _tickets = const [];

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadTickets() async {
    setState(() {
      _isLoadingTickets = true;
      _loadError = '';
    });

    try {
      final tickets = await _ticketService.fetchMyTickets();
      if (!mounted) return;

      setState(() {
        _tickets = tickets;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadError = 'Failed to load your support tickets.';
      });
    } finally {
      if (!mounted) return;
      setState(() {
        _isLoadingTickets = false;
      });
    }
  }

  Future<void> _submitTicket() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final createdTicket = await _ticketService.createTicket(
        issueCategory: _selectedCategory,
        description: _descriptionController.text,
      );

      if (!mounted) return;

      setState(() {
        _tickets = [createdTicket, ..._tickets];
        _descriptionController.clear();
        _selectedCategory = _categories.first;
      });

      showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Ticket Submitted'),
          content: Text(
            'Your support ticket has been submitted successfully.\n\n'
            'Ticket ID: ${createdTicket.ticketId}\n\n'
            'You can monitor the latest status below.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      _showErrorSnackBar(error.message);
    } catch (_) {
      if (!mounted) return;
      _showErrorSnackBar('Failed to submit the support ticket.');
    } finally {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
    }
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String _formatDate(DateTime? value) {
    if (value == null) return 'N/A';

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    final local = value.toLocal();
    return '${months[local.month - 1]} ${local.day}, ${local.year}';
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Resolved':
        return Colors.green;
      case 'Closed':
        return Colors.blueGrey;
      case 'In Progress':
        return Colors.orange;
      case 'Open':
      default:
        return primaryColor;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Support Ticket'),
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
      ),
      selectedIndex: 0,
      showDrawer: false,
      child: RefreshIndicator(
        onRefresh: _loadTickets,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: Colors.blue[50],
              child: const Padding(
                padding: EdgeInsets.all(12),
                child: Row(
                  children: [
                    Icon(Icons.support_agent, color: Colors.blue),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Submit concerns directly to OSFA. Ticket status and handling will follow the live support_tickets table.',
                        style: TextStyle(fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Create a Ticket',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        initialValue: _selectedCategory,
                        decoration: InputDecoration(
                          labelText: 'Issue Category',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        items: _categories
                            .map(
                              (category) => DropdownMenuItem(
                                value: category,
                                child: Text(category),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          setState(() {
                            _selectedCategory = value ?? _categories.first;
                          });
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _descriptionController,
                        maxLines: 6,
                        decoration: InputDecoration(
                          labelText: 'Description',
                          hintText:
                              'Describe the issue clearly so staff can review it.',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          alignLabelWithHint: true,
                        ),
                        validator: (value) {
                          final text = value?.trim() ?? '';
                          if (text.isEmpty) {
                            return 'Description is required';
                          }
                          if (text.length < 10) {
                            return 'Please provide at least 10 characters.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _isSubmitting ? null : _submitTicket,
                          icon: _isSubmitting
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      Colors.white,
                                    ),
                                  ),
                                )
                              : const Icon(Icons.send),
                          label: Text(
                            _isSubmitting ? 'Submitting...' : 'Submit Ticket',
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: primaryColor,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'My Tickets',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                TextButton.icon(
                  onPressed: _isLoadingTickets ? null : _loadTickets,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Refresh'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_isLoadingTickets)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_loadError.isNotEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Failed to load tickets',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      Text(_loadError),
                    ],
                  ),
                ),
              )
            else if (_tickets.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: const [
                      Icon(Icons.inbox_outlined, size: 36, color: Colors.grey),
                      SizedBox(height: 12),
                      Text(
                        'No support tickets yet.',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Submit a ticket above if you need help from OSFA.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              )
            else
              ..._tickets.map((ticket) {
                final statusColor = _statusColor(ticket.status);

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      ticket.issueCategory,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 15,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      ticket.ticketId,
                                      style: const TextStyle(
                                        color: Colors.grey,
                                        fontSize: 12,
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
                                  color: statusColor.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  ticket.status,
                                  style: TextStyle(
                                    color: statusColor,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            ticket.description,
                            style: const TextStyle(height: 1.4),
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 12,
                            runSpacing: 8,
                            children: [
                              _InfoChip(
                                icon: Icons.event_outlined,
                                label:
                                    'Created ${_formatDate(ticket.createdAt)}',
                              ),
                              if (ticket.resolvedAt != null)
                                _InfoChip(
                                  icon: Icons.check_circle_outline,
                                  label:
                                      'Resolved ${_formatDate(ticket.resolvedAt)}',
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: Colors.grey.shade700),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}
