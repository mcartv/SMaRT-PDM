import 'package:flutter/material.dart';
import '../constants.dart';
import '../widgets/smart_pdm_page_scaffold.dart';

class DocumentUploadScreen extends StatefulWidget {
  const DocumentUploadScreen({super.key});

  @override
  State<DocumentUploadScreen> createState() => _DocumentUploadScreenState();
}

class _DocumentUploadScreenState extends State<DocumentUploadScreen> {
  bool _allRequiredUploaded = false;

  final List<DocumentItem> _documents = [
    DocumentItem(name: 'COR', status: 'UPLOADED', fileName: 'COR_2025.pdf', isRequired: true),
    DocumentItem(name: 'Grade Form', status: 'REQUIRED', isRequired: true),
    DocumentItem(name: 'Certificate of Indigency', status: 'OPTIONAL', isRequired: false),
    DocumentItem(name: 'Valid ID', status: 'UPLOADED', fileName: 'ID.jpg', isRequired: true),
  ];

  @override
  void initState() {
    super.initState();
    _checkAllRequired();
  }

  void _checkAllRequired() {
    _allRequiredUploaded = _documents.where((doc) => doc.isRequired).every((doc) => doc.status == 'UPLOADED');
    setState(() {});
  }

  void _showUploadOptions() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Upload Document',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),
            ListTile(
              leading: const Icon(Icons.camera),
              title: const Text('Camera'),
              onTap: () {
                Navigator.pop(context);
                // Implement camera upload
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo),
              title: const Text('Gallery'),
              onTap: () {
                Navigator.pop(context);
                // Implement gallery upload
              },
            ),
            ListTile(
              leading: const Icon(Icons.file_present),
              title: const Text('Files'),
              onTap: () {
                Navigator.pop(context);
                // Implement file picker
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      selectedIndex: 2,
      child: Column(
        children: [
          const Text(
            'Upload Documents - TES',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 14),
          Expanded(
            child: ListView.builder(
              itemCount: _documents.length,
              itemBuilder: (context, index) {
                final doc = _documents[index];
                final bool uploaded = doc.status == 'UPLOADED';
                final bool required = doc.status == 'REQUIRED';
                final bool optional = doc.status == 'OPTIONAL';

                final String statusLabel = uploaded
                    ? (doc.name == 'COR' ? 'UPLOADED ✓' : 'UPLOADED')
                    : required
                        ? 'REQUIRED'
                        : optional
                            ? 'OPTIONAL'
                            : doc.status;

                final Color statusColor = uploaded
                    ? Colors.green
                    : required
                        ? Colors.orange
                        : Colors.grey;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                doc.name,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: statusColor.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                statusLabel,
                                style: TextStyle(
                                  color: statusColor,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        if (uploaded) ...[
                          Text(
                            doc.fileName ?? '',
                            style: TextStyle(
                              color: Colors.grey.shade800,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: () {},
                            child: Text(
                              '[REPLACE]',
                              style: TextStyle(
                                color: primaryColor,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        ] else ...[
                          ElevatedButton(
                            onPressed: _showUploadOptions,
                            child: const Text('+ UPLOAD'),
                          ),
                        ],
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _allRequiredUploaded
                  ? () {
                      Navigator.pushNamed(context, '/status');
                    }
                  : null,
              child: const Text('SUBMIT DOCUMENTS'),
            ),
          ),
        ],
      ),
    );
  }
}

class DocumentItem {
  String name;
  String status;
  String? fileName;
  bool isRequired;

  DocumentItem({
    required this.name,
    required this.status,
    this.fileName,
    required this.isRequired,
  });
}