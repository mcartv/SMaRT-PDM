import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';

class ScholarNavChips extends StatefulWidget {
  final String selectedLabel;
  final ValueChanged<String> onTap;

  const ScholarNavChips({
    super.key,
    required this.selectedLabel,
    required this.onTap,
  });

  @override
  State<ScholarNavChips> createState() => _ScholarNavChipsState();
}

class _ScholarNavChipsState extends State<ScholarNavChips> {
  static double _savedOffset = 0;

  late final ScrollController _scrollController;

  static const List<String> _labels = [
    'Payout Schedule',
    'Renewal Documents',
    'RO Assignment',
    'RO Completion',
  ];

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController(initialScrollOffset: _savedOffset);
    _scrollController.addListener(_persistOffset);
  }

  void _persistOffset() {
    _savedOffset = _scrollController.offset;
  }

  @override
  void dispose() {
    _scrollController.removeListener(_persistOffset);
    _savedOffset = _scrollController.hasClients ? _scrollController.offset : _savedOffset;
    _scrollController.dispose();
    super.dispose();
  }

  Widget _buildChip(String label) {
    final isSelected = widget.selectedLabel == label;

    return Padding(
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
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      controller: _scrollController,
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _labels.map(_buildChip).toList(),
      ),
    );
  }
}
