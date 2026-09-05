import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/shared/models/support_ticket.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/support_ticket_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';
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
  NotificationProvider? _notificationProvider;
  int _lastTicketRevision = 0;

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
  void didChangeDependencies() {
    super.didChangeDependencies();
    final provider = context.read<NotificationProvider>();
    if (_notificationProvider == provider) {
      return;
    }

    _notificationProvider?.removeListener(_handleRealtimeTickets);
    _notificationProvider = provider;
    _lastTicketRevision = provider.ticketRevision;
    _notificationProvider?.addListener(_handleRealtimeTickets);
  }

  @override
  void dispose() {
    _notificationProvider?.removeListener(_handleRealtimeTickets);
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

  void _handleRealtimeTickets() {
    final provider = _notificationProvider;
    if (provider == null) {
      return;
    }

    if (provider.ticketRevision == _lastTicketRevision) {
      return;
    }

    _lastTicketRevision = provider.ticketRevision;

    if (mounted) {
      _loadTickets();
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
          title: Text('Ticket Submitted'),
          content: Text(
            'Your support ticket has been submitted successfully.\n\n'
            'Ticket ID: ${createdTicket.ticketId}\n\n'
            'You can monitor the latest status below.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('OK'),
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

  AppStatusTone _statusTone(String status) {
    switch (status.trim().toLowerCase()) {
      case 'resolved':
        return AppStatusTone.success;
      case 'closed':
        return AppStatusTone.neutral;
      case 'in progress':
        return AppStatusTone.actionRequired;
      case 'open':
      default:
        return AppStatusTone.inProgress;
    }
  }

  @override
  Widget build(BuildContext context) {
    final titleColor = AppSurfacePalette.text(context);
    final subtitleColor = AppSurfacePalette.mutedText(context);

    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Support Ticket')),
      selectedIndex: 0,
      child: RefreshIndicator(
        onRefresh: _loadTickets,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            AppSurfaceCard(
              backgroundColor: AppSurfacePalette.surfaceMuted(context),
              child: Row(
                children: [
                  const AppIconTile(icon: Icons.support_agent_rounded),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Text(
                      'Submit concerns directly to OSFA and monitor each ticket until it is resolved.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: subtitleColor,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            AppSurfaceCard(
              child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Create a Ticket',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: titleColor,
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
                              'Describe the issue clearly so the appropriate office can review it.',
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
                                      AppColors.darkBrown,
                                    ),
                                  ),
                                )
                              : const Icon(Icons.send),
                          label: Text(
                            _isSubmitting ? 'Submitting...' : 'Submit Ticket',
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: primaryColor,
                            foregroundColor: AppColors.darkBrown,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ),
            const SizedBox(height: AppSpacing.xl),
            AppSectionHeading(
              title: 'My Tickets',
              subtitle: 'Review status changes and previously submitted concerns.',
              actionLabel: 'Refresh',
              onAction: _isLoadingTickets ? null : _loadTickets,
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
              AppSurfaceCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppIconTile(
                      icon: Icons.cloud_off_rounded,
                      accent: Theme.of(context).colorScheme.error,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Failed to load tickets',
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: titleColor,
                                ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            _loadError,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: subtitleColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              )
            else if (_tickets.isEmpty)
              AppSurfaceCard(
                child: Column(
                  children: [
                    const AppIconTile(icon: Icons.inbox_outlined),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'No support tickets yet.',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Submit a ticket above if you need help from OSFA.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: subtitleColor,
                      ),
                    ),
                  ],
                ),
              )
            else
              ..._tickets.map((ticket) {
                return AppSurfaceCard(
                  margin: const EdgeInsets.only(bottom: AppSpacing.md),
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
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyLarge
                                          ?.copyWith(
                                            fontWeight: FontWeight.bold,
                                            color: titleColor,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      ticket.ticketId,
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelMedium
                                          ?.copyWith(color: subtitleColor),
                                    ),
                                  ],
                                ),
                              ),
                              AppStatusCapsule(
                                label: ticket.status,
                                tone: _statusTone(ticket.status),
                                compact: true,
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            ticket.description,
                            style: TextStyle(height: 1.4, color: titleColor),
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
    final chipColor = AppSurfacePalette.surfaceMuted(context);
    final chipIconColor = AppSurfacePalette.mutedText(context);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: chipColor,
        borderRadius: AppRadii.status,
        border: Border.all(color: AppSurfacePalette.outline(context)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: chipIconColor),
          const SizedBox(width: 6),
          Text(label, style: Theme.of(context).textTheme.labelMedium),
        ],
      ),
    );
  }
}
