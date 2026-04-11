import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/models/program_opening.dart';
import 'package:smartpdm_mobileapp/navigation/app_routes.dart';
import 'package:smartpdm_mobileapp/screens/applicant/opening_indigency_apply_screen.dart';
import 'package:smartpdm_mobileapp/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class ScholarshipOpeningsScreen extends StatefulWidget {
  const ScholarshipOpeningsScreen({super.key});

  @override
  State<ScholarshipOpeningsScreen> createState() =>
      _ScholarshipOpeningsScreenState();
}

class _ScholarshipOpeningsScreenState extends State<ScholarshipOpeningsScreen> {
  final ProgramOpeningService _programOpeningService = ProgramOpeningService();

  bool _isLoading = true;
  bool _hasBaseApplicationProfile = false;
  String? _error;
  List<ProgramOpening> _openings = const [];

  @override
  void initState() {
    super.initState();
    _loadOpenings();
  }

  Future<void> _loadOpenings() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await _programOpeningService.fetchAvailableOpenings();
      if (!mounted) return;

      setState(() {
        _hasBaseApplicationProfile = result.hasBaseApplicationProfile;
        _openings = result.items;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String _formatDateRange(ProgramOpening opening) {
    String format(String value) {
      if (value.isEmpty) return 'TBA';
      final parsed = DateTime.tryParse(value);
      if (parsed == null) return value;
      return DateFormat('MMM d, yyyy').format(parsed);
    }

    return '${format(opening.applicationStart)} - ${format(opening.applicationEnd)}';
  }

  Future<void> _handleApply(ProgramOpening opening) async {
    if (!_hasBaseApplicationProfile) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Please complete your application form first before applying to an opening.',
          ),
        ),
      );
      Navigator.pushNamed(context, AppRoutes.newApplicant);
      return;
    }

    if (opening.hasApplied &&
        opening.applyLabel == 'Upload Requirements' &&
        (opening.existingApplicationId?.isNotEmpty ?? false)) {
      await Navigator.pushNamed(
        context,
        AppRoutes.documents,
        arguments: <String, dynamic>{
          'initialTitle': opening.openingTitle,
          'initialProgramName': opening.programName,
        },
      );

      if (!mounted) return;
      await _loadOpenings();
      return;
    }

    if (!opening.canApply) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You already applied to this scholarship opening.'),
        ),
      );
      return;
    }

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => OpeningIndigencyApplyScreen(opening: opening),
      ),
    );

    if (!mounted) return;
    await _loadOpenings();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.black54;
    final cardColor = isDark ? const Color(0xFF2D1E12) : Colors.white;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;

    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Scholarship Openings')),
      selectedIndex: 0,
      showDrawer: false,
      child: RefreshIndicator(
        onRefresh: _loadOpenings,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: cardColor,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: accentColor.withOpacity(0.14)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Available Scholarship Openings',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: titleColor,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Choose an opening when you are ready to apply, but you can upload scholarship requirements separately after completing your base application form.',
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.45,
                      color: subtitleColor,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (!_hasBaseApplicationProfile)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Complete your base application form first',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'You can browse openings now, but Apply Now will ask you to finish the application form before submitting to an opening.',
                      style: TextStyle(color: subtitleColor, height: 1.4),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () =>
                          Navigator.pushNamed(context, AppRoutes.newApplicant),
                      child: const Text('Complete Application Form'),
                    ),
                  ],
                ),
              ),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 32),
                child: Column(
                  children: [
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: subtitleColor),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _loadOpenings,
                      child: const Text('Try Again'),
                    ),
                  ],
                ),
              )
            else if (_openings.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 32),
                child: Text(
                  'No scholarship openings are currently available.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: subtitleColor),
                ),
              )
            else
              ..._openings.map((opening) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: cardColor,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x12000000),
                        blurRadius: 10,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
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
                                    opening.openingTitle,
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: titleColor,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    opening.programName,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: accentColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (opening.isTes)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: accentColor.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  'TES',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: accentColor,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Application period: ${_formatDateRange(opening)}',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: titleColor,
                          ),
                        ),
                        if (opening.announcementText.trim().isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Text(
                            opening.announcementText,
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.4,
                              color: subtitleColor,
                            ),
                          ),
                        ],
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: opening.canApply
                                ? () => _handleApply(opening)
                                : null,
                            child: Text(opening.applyLabel),
                          ),
                        ),
                      ],
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
