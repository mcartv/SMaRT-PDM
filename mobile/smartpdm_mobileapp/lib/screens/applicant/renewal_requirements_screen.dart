import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/navigation/app_navigator.dart';
import 'package:smartpdm_mobileapp/navigation/app_routes.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class RenewalRequirementsScreen extends StatefulWidget {
  const RenewalRequirementsScreen({super.key});

  @override
  State<RenewalRequirementsScreen> createState() =>
      _RenewalRequirementsScreenState();
}

class _RenewalRequirementsScreenState extends State<RenewalRequirementsScreen> {
  final List<_RenewalDocument> _requirements = [
    _RenewalDocument(
      title: 'Certificate of Registration',
      description: 'Official COR from the registrar for the current term',
      status: 'uploaded',
      fileName: 'COR_2ndSem_2026.pdf',
      updatedAt: 'Uploaded Apr 01',
      icon: Icons.assignment_outlined,
    ),
    _RenewalDocument(
      title: 'Grade Form / Transcript',
      description: 'Latest semester grades for renewal validation',
      status: 'uploaded',
      fileName: 'Grades_1stSem_2026.pdf',
      updatedAt: 'Uploaded Mar 28',
      icon: Icons.grade_outlined,
    ),
    _RenewalDocument(
      title: 'Enrollment Certification',
      description: 'Proof of current enrollment from your school',
      status: 'pending',
      icon: Icons.school_outlined,
    ),
    _RenewalDocument(
      title: 'Good Moral Character',
      description: 'Issued by your institution guidance office',
      status: 'pending',
      icon: Icons.verified_user_outlined,
    ),
    _RenewalDocument(
      title: 'Financial Aid Status Report',
      description: 'Current financial aid and scholarship standing',
      status: 'review',
      fileName: 'Aid_Status_Report.pdf',
      updatedAt: 'Submitted Mar 30',
      icon: Icons.request_quote_outlined,
    ),
  ];

  int get _uploadedCount =>
      _requirements.where((doc) => doc.status != 'pending').length;

  bool get _allRequiredUploaded =>
      _requirements.every((doc) => doc.status != 'pending');

  void _handleScholarChipTap(String label) {
    switch (label) {
      case 'Payout Schedule':
        AppNavigator.goToTopLevel(context, AppRoutes.payouts);
        break;
      case 'Renewal Documents':
        break;
      case 'RO Assignment':
        Navigator.pushNamed(context, AppRoutes.roAssignment);
        break;
      case 'RO Completion':
        Navigator.pushNamed(context, AppRoutes.roCompletion);
        break;
    }
  }

  void _handleDocumentAction(_RenewalDocument document) {
    if (document.status == 'pending') {
      setState(() {
        document.status = 'uploaded';
        document.fileName =
            '${document.title.replaceAll(' ', '_').toLowerCase()}.pdf';
        document.updatedAt = 'Uploaded just now';
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${document.title} uploaded successfully.')),
      );
      return;
    }

    if (document.status == 'review') {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Viewing ${document.title} submission...')),
      );
      return;
    }

    setState(() {
      document.updatedAt = 'Replaced just now';
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${document.title} replaced successfully.')),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'uploaded':
        return Colors.green;
      case 'review':
        return const Color(0xFFC76917);
      case 'pending':
      default:
        return primaryColor;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'uploaded':
        return 'Uploaded';
      case 'review':
        return 'Pending Review';
      case 'pending':
      default:
        return 'Required';
    }
  }

  String _actionLabel(String status) {
    switch (status) {
      case 'uploaded':
        return 'Replace';
      case 'review':
        return 'View';
      case 'pending':
      default:
        return 'Upload';
    }
  }

  Widget _buildScholarChip(String label, {bool selected = false}) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        showCheckmark: selected,
        checkmarkColor: Colors.white,
        backgroundColor: Colors.grey[200],
        selectedColor: primaryColor,
        labelStyle: TextStyle(
          color: selected ? Colors.white : Colors.black,
          fontWeight: FontWeight.bold,
        ),
        onSelected: (_) => _handleScholarChipTap(label),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final progress = _uploadedCount / _requirements.length;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Renewal Documents'),
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
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildScholarChip('Payout Schedule'),
                  _buildScholarChip('Renewal Documents', selected: true),
                  _buildScholarChip('RO Assignment'),
                  _buildScholarChip('RO Completion'),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: primaryColor.withOpacity(0.08),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: primaryColor.withOpacity(0.12)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Renewal Progress',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Submit all required documents to maintain your scholarship for the next release cycle.',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.black54,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        '$_uploadedCount/${_requirements.length}',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: primaryColor,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 8,
                      backgroundColor: Colors.white,
                      valueColor: const AlwaysStoppedAnimation<Color>(
                        primaryColor,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(
                        Icons.event_outlined,
                        size: 16,
                        color: Colors.orange.shade700,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Renewal deadline: April 30, 2026',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.orange.shade800,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Required Documents',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Upload each document below. You can replace files before final submission.',
              style: TextStyle(fontSize: 12, color: Colors.black54),
            ),
            const SizedBox(height: 14),
            ..._requirements.map(_buildDocumentRow),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _allRequiredUploaded
                    ? () {
                        showDialog<void>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Renewal Submitted'),
                            content: const Text(
                              'Your renewal requirements have been submitted for review.',
                            ),
                            actions: [
                              TextButton(
                                onPressed: () {
                                  Navigator.pop(context);
                                  AppNavigator.goToTopLevel(
                                    context,
                                    AppRoutes.payouts,
                                  );
                                },
                                child: const Text('OK'),
                              ),
                            ],
                          ),
                        );
                      }
                    : null,
                icon: const Icon(Icons.send),
                label: const Text('Submit Renewal Requirements'),
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
    );
  }

  Widget _buildDocumentRow(_RenewalDocument document) {
    final statusColor = _statusColor(document.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: primaryColor.withOpacity(0.10)),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: primaryColor.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(document.icon, color: primaryColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  document.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  document.description,
                  style: const TextStyle(fontSize: 12, color: Colors.black54),
                ),
                if (document.fileName != null || document.updatedAt != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    document.fileName ?? document.updatedAt!,
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade700,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (document.fileName != null && document.updatedAt != null)
                    Text(
                      document.updatedAt!,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Colors.black45,
                      ),
                    ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  _statusLabel(document.status),
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => _handleDocumentAction(document),
                child: Text(
                  _actionLabel(document.status),
                  style: const TextStyle(
                    color: primaryColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RenewalDocument {
  _RenewalDocument({
    required this.title,
    required this.description,
    required this.status,
    required this.icon,
    this.fileName,
    this.updatedAt,
  });

  final String title;
  final String description;
  String status;
  String? fileName;
  String? updatedAt;
  final IconData icon;
}
