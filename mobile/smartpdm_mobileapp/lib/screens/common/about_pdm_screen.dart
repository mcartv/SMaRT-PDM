import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class AboutPdmScreen extends StatelessWidget {
  const AboutPdmScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final sections = const [
      (
        title: 'Overview',
        body:
            'SMaRT-PDM supports scholarship management, scholar tracking, and applicant document workflows for PDM/OSFA.',
      ),
      (
        title: 'What OSFA Handles',
        body:
            'OSFA coordinates scholarship openings, applicant review, scholar monitoring, renewal requirements, and communication with beneficiaries.',
      ),
      (
        title: 'Core Process',
        body:
            'Applicants complete their profile, apply to an active scholarship opening, upload the required documents, and track the review status from the app.',
      ),
      (
        title: 'Contact Flow',
        body:
            'For follow-ups, use the in-app messaging and notification features so updates stay attached to your account and application flow.',
      ),
    ];

    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('About PDM/OSFA')),
      selectedIndex: 0,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: sections.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final section = sections[index];
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    section.title,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    section.body,
                    style: const TextStyle(height: 1.45),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
