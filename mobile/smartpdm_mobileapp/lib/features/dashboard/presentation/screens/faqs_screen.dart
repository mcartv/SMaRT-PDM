import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/shared/models/faq_item.dart';
import 'package:smartpdm_mobileapp/features/dashboard/data/services/faq_service.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class FaqsScreen extends StatefulWidget {
  const FaqsScreen({super.key});

  @override
  State<FaqsScreen> createState() => _FaqsScreenState();
}

class _FaqsScreenState extends State<FaqsScreen> {
  final FaqService _faqService = FaqService();
  final TextEditingController _searchController = TextEditingController();

  bool _isLoading = true;
  String? _error;
  String _searchQuery = '';
  List<FaqItem> _faqs = const [];

  @override
  void initState() {
    super.initState();
    _loadFaqs();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadFaqs() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final items = await _faqService.fetchFaqs();
      if (!mounted) return;

      setState(() {
        _faqs = items;
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

  List<FaqItem> get _filteredFaqs {
    final query = _searchQuery.trim().toLowerCase();
    if (query.isEmpty) {
      return _faqs;
    }

    return _faqs.where((item) {
      return item.question.toLowerCase().contains(query) ||
          item.answer.toLowerCase().contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.black54;
    final surfaceColor = isDark ? const Color(0xFF332216) : Colors.white;
    final accentColor = isDark ? const Color(0xFFFFD54F) : AppColors.gold;
    final filteredFaqs = _filteredFaqs;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('FAQs'),
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
        elevation: 0,
      ),
      selectedIndex: 0,
      showDrawer: false,
      showBottomNav: false,
      child: RefreshIndicator(
        onRefresh: _loadFaqs,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(top: 12, bottom: 20),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: surfaceColor,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: accentColor.withValues(alpha: 0.18)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x12000000),
                    blurRadius: 10,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Scholarship Help Center',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: titleColor,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Browse the most common questions from applicants and scholars. Pull down to refresh any time.',
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.45,
                      color: subtitleColor,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _searchController,
                    onChanged: (value) {
                      setState(() => _searchQuery = value);
                    },
                    decoration: InputDecoration(
                      hintText: 'Search questions or answers',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _searchQuery.isEmpty
                          ? null
                          : IconButton(
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                              icon: const Icon(Icons.close),
                            ),
                      filled: true,
                      fillColor: isDark
                          ? const Color(0xFF3A2718)
                          : const Color(0xFFF7F2EB),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _searchQuery.trim().isEmpty
                        ? '${_faqs.length} questions available'
                        : '${filteredFaqs.length} matching questions',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: subtitleColor,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_isLoading && _faqs.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null && _faqs.isEmpty)
              _FaqsErrorState(message: _error!, onRetry: _loadFaqs)
            else if (filteredFaqs.isEmpty)
              _FaqsEmptyState(
                isSearching: _searchQuery.trim().isNotEmpty,
                onClearSearch: () {
                  _searchController.clear();
                  setState(() => _searchQuery = '');
                },
              )
            else
              ...filteredFaqs.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _FaqCard(item: item),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _FaqCard extends StatelessWidget {
  const _FaqCard({required this.item});

  final FaqItem item;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = isDark ? const Color(0xFF332216) : Colors.white;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final bodyColor = isDark ? Colors.white70 : Colors.black87;
    final accentColor = isDark ? const Color(0xFFFFD54F) : AppColors.gold;

    return Container(
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: accentColor.withValues(alpha: 0.18)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
          childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
          iconColor: accentColor,
          collapsedIconColor: accentColor,
          title: Text(
            item.question,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: titleColor,
              height: 1.3,
            ),
          ),
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                item.answer,
                style: TextStyle(fontSize: 14, height: 1.55, color: bodyColor),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FaqsEmptyState extends StatelessWidget {
  const _FaqsEmptyState({
    required this.isSearching,
    required this.onClearSearch,
  });

  final bool isSearching;
  final VoidCallback onClearSearch;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.45,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isSearching ? Icons.search_off : Icons.help_outline,
                size: 56,
                color: Colors.grey,
              ),
              const SizedBox(height: 14),
              Text(
                isSearching ? 'No matching FAQ found' : 'No FAQs available yet',
                style: Theme.of(context).textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                isSearching
                    ? 'Try a different keyword or clear your search to see all questions.'
                    : 'Questions published in Supabase will appear here.',
                textAlign: TextAlign.center,
              ),
              if (isSearching) ...[
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: onClearSearch,
                  child: const Text('Clear search'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _FaqsErrorState extends StatelessWidget {
  const _FaqsErrorState({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.5,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.cloud_off, size: 52, color: Colors.redAccent),
              const SizedBox(height: 12),
              Text(
                'Unable to load FAQs',
                style: Theme.of(context).textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: onRetry,
                child: const Text('Try again'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
