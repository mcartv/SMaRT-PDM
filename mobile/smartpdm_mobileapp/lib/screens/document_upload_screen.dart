import 'package:flutter/material.dart';
import '../constants.dart';

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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Upload Documents - TES'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                itemCount: _documents.length,
                itemBuilder: (context, index) {
                  final doc = _documents[index];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 16.0),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Item ${index + 1}: ${doc.name}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const Spacer(),
                              if (doc.status == 'UPLOADED')
                                const Icon(Icons.check_circle, color: Colors.green)
                              else if (doc.status == 'REQUIRED')
                                const Icon(Icons.warning, color: Colors.orange)
                              else
                                const Icon(Icons.info, color: Colors.grey),
                            ],
                          ),
                          const SizedBox(height: 8),
                          if (doc.status == 'UPLOADED')
                            Text(doc.fileName ?? ''),
                          if (doc.status == 'UPLOADED')
                            TextButton(
                              onPressed: () {},
                              child: const Text('REPLACE'),
                            )
                          else
                            ElevatedButton(
                              onPressed: _showUploadOptions,
                              child: const Text('+ UPLOAD'),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _allRequiredUploaded ? () {
                  Navigator.pushNamed(context, '/status');
                } : null,
                child: const Text('SUBMIT DOCUMENTS'),
              ),
            ),
          ],
        ),
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