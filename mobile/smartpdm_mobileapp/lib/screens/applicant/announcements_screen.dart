import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  String _selectedFilter = 'All';

  final List<Map<String, String>> announcements = [
    {
      'title': 'BC Packaging Grant - New Scholarship Opportunity',
      'date': 'March 28, 2025',
      'category': 'Scholarship',
      'description':
          'The British Columbia Packaging Grant is now open for applications. This scholarship is for students pursuing degrees in engineering and technology. Apply by April 30, 2025.',
      'priority': 'high',
    },
    {
      'title': 'Grade Reminder - Submit Latest Grades for TES Application',
      'date': 'March 25, 2025',
      'category': 'Deadline',
      'description':
          'Please submit your latest grades to support your TES scholarship application. Ensure all documents are clear and legible. Deadline: April 15, 2025.',
      'priority': 'high',
    },
    {
      'title': 'Interview Preparation Webinar',
      'date': 'March 22, 2025',
      'category': 'Event',
      'description':
          'Join us for a free webinar on scholarship interview preparation. Learn tips and tricks from successful scholars. Register now!',
      'priority': 'medium',
    },
    {
      'title': 'System Maintenance Notice',
      'date': 'March 20, 2025',
      'category': 'System',
      'description':
          'The SMaRT-PDM system will undergo maintenance on March 25-26, 2025. Services may be unavailable during this period. We apologize for any inconvenience.',
      'priority': 'low',
    },
    {
      'title': 'New Scholarship Programs Available',
      'date': 'March 18, 2025',
      'category': 'Scholarship',
      'description':
          'Three new scholarship programs have been added to the platform. Check out the updated scholarship list to learn more about eligibility requirements.',
      'priority': 'medium',
    },
  ];

  List<Map<String, String>> _getFilteredAnnouncements() {
    if (_selectedFilter == 'All') {
      return announcements;
    }
    return announcements
        .where((a) => a['category'] == _selectedFilter)
        .toList();
  }

  Color _getCategoryColor(String category) {
    switch (category) {
      case 'Scholarship':
        return Colors.blue;
      case 'Deadline':
        return Colors.red;
      case 'Event':
        return Colors.green;
      case 'System':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  Color _getPriorityColor(String priority) {
    switch (priority) {
      case 'high':
        return Colors.red;
      case 'medium':
        return Colors.orange;
      case 'low':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _getFilteredAnnouncements();

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Announcements'),
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
      ),
      selectedIndex: 1,
      showDrawer: true,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Filters
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('All'),
                  _buildFilterChip('Scholarship'),
                  _buildFilterChip('Deadline'),
                  _buildFilterChip('Event'),
                  _buildFilterChip('System'),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Announcements Count
            Text(
              'Showing ${filtered.length} announcements',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
            const SizedBox(height: 12),

            // Announcements List
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filtered.length,
              itemBuilder: (context, index) {
                final announcement = filtered[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: InkWell(
                    onTap: () {
                      showModalBottomSheet(
                        context: context,
                        builder: (context) =>
                            _buildAnnouncementDetail(announcement),
                      );
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Title and Priority
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  announcement['title']!,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: _getPriorityColor(
                                    announcement['priority']!,
                                  ).withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  announcement['priority']!.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: _getPriorityColor(
                                      announcement['priority']!,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),

                          // Category and Date
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: _getCategoryColor(
                                    announcement['category']!,
                                  ).withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  announcement['category']!,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: _getCategoryColor(
                                      announcement['category']!,
                                    ),
                                  ),
                                ),
                              ),
                              const Spacer(),
                              Text(
                                announcement['date']!,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),

                          // Description (truncated)
                          Text(
                            announcement['description']!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              color: Colors.grey,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Read More
                          Text(
                            'Tap to read more →',
                            style: TextStyle(
                              fontSize: 12,
                              color: primaryColor,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    final isSelected = _selectedFilter == label;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (selected) {
          setState(() {
            _selectedFilter = label;
          });
        },
        backgroundColor: Colors.grey[200],
        selectedColor: primaryColor,
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : Colors.black,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildAnnouncementDetail(Map<String, String> announcement) {
    return DraggableScrollableSheet(
      expand: false,
      builder: (context, scrollController) => SingleChildScrollView(
        controller: scrollController,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      announcement['title']!,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _getCategoryColor(
                        announcement['category']!,
                      ).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      announcement['category']!,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: _getCategoryColor(announcement['category']!),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                announcement['date']!,
                style: const TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 20),
              Text(
                announcement['description']!,
                style: const TextStyle(fontSize: 14, height: 1.6),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                  ),
                  child: const Text(
                    'Close',
                    style: TextStyle(color: Colors.white),
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
