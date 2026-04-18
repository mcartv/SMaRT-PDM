import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';

class ScholarNavChips extends StatefulWidget {
  final String selectedLabel;
  final ValueChanged<String> onTap;
  final bool hasNewPayouts;

  const ScholarNavChips({
    super.key,
    required this.selectedLabel,
    required this.onTap,
    this.hasNewPayouts = false,
  });

  @override
  State<ScholarNavChips> createState() => _ScholarNavChipsState();
}

class _ScholarNavChipsState extends State<ScholarNavChips> {
  static double _savedOffset = 0;

  late final ScrollController _scrollController;
  late final List<GlobalKey> _chipKeys;

  static const List<String> _labels = [
    'Payout Schedule',
    'Renewal Documents',
    'RO Assignment',
    'RO Completion',
  ];

  @override
  void initState() {
    super.initState();
    _chipKeys = List<GlobalKey>.generate(_labels.length, (_) => GlobalKey());
    _scrollController = ScrollController(initialScrollOffset: _savedOffset);
    _scrollController.addListener(_persistOffset);
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _alignSelectedChip(jump: true),
    );
  }

  @override
  void didUpdateWidget(covariant ScholarNavChips oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedLabel != widget.selectedLabel) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _alignSelectedChip());
    }
  }

  void _persistOffset() {
    _savedOffset = _scrollController.offset;
  }

  void _alignSelectedChip({bool jump = false}) {
    if (!mounted || !_scrollController.hasClients) return;

    final selectedIndex = _labels.indexOf(widget.selectedLabel);
    if (selectedIndex < 0) return;

    final maxExtent = _scrollController.position.maxScrollExtent;
    double targetOffset;

    if (selectedIndex == 0) {
      targetOffset = 0;
    } else if (selectedIndex == _labels.length - 1) {
      targetOffset = maxExtent;
    } else {
      final chipContext = _chipKeys[selectedIndex].currentContext;
      final scrollContext = context;
      if (chipContext == null) return;

      final chipBox = chipContext.findRenderObject() as RenderBox?;
      final scrollBox = scrollContext.findRenderObject() as RenderBox?;
      if (chipBox == null || scrollBox == null) return;

      final chipPosition = chipBox.localToGlobal(
        Offset.zero,
        ancestor: scrollBox,
      );
      final chipCenter = chipPosition.dx + (chipBox.size.width / 2);
      final viewportCenter = scrollBox.size.width / 2;
      targetOffset = _scrollController.offset + (chipCenter - viewportCenter);
    }

    final clampedOffset = targetOffset.clamp(0.0, maxExtent);
    _savedOffset = clampedOffset;

    if (jump) {
      _scrollController.jumpTo(clampedOffset);
      return;
    }

    _scrollController.animateTo(
      clampedOffset,
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
    );
  }

  Widget _buildChip(int index, String label) {
    final isSelected = widget.selectedLabel == label;
    final showPayoutBadge = label == 'Payout Schedule' && widget.hasNewPayouts;

    return Padding(
      key: _chipKeys[index],
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => widget.onTap(label),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? primaryColor : Colors.grey[200],
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? primaryColor : primaryColor.withOpacity(0.22),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 16,
                child: Icon(
                  Icons.check,
                  size: 14,
                  color: isSelected ? Colors.white : Colors.transparent,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : Colors.black,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (showPayoutBadge) ...[
                const SizedBox(width: 6),
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Colors.red,
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _scrollController.removeListener(_persistOffset);
    _savedOffset = _scrollController.hasClients
        ? _scrollController.offset
        : _savedOffset;
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      controller: _scrollController,
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List<Widget>.generate(
          _labels.length,
          (index) => _buildChip(index, _labels[index]),
        ),
      ),
    );
  }
}
