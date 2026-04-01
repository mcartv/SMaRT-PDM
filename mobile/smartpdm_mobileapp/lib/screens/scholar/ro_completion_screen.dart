import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'dart:io';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class ROCompletionScreen extends StatefulWidget {
  final Map<String, dynamic>? assignment;

  const ROCompletionScreen({super.key, this.assignment});

  @override
  State<ROCompletionScreen> createState() => _ROCompletionScreenState();
}

class _ROCompletionScreenState extends State<ROCompletionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _hoursCompletedController = TextEditingController();
  final _descriptionController = TextEditingController();
  // ignore: unused_field
  String _supervisorApproval = '';
  bool _isSubmitting = false;

  // New fields for enhanced completion report
  TimeOfDay? _timeIn;
  TimeOfDay? _timeOut;
  File? _completionImage;
  final ImagePicker _picker = ImagePicker();
  String _qrCodeData = '';

  @override
  void initState() {
    super.initState();
    _generateQRCode();
  }

  @override
  void dispose() {
    _hoursCompletedController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  void _generateQRCode() {
    // Generate QR code data with completion details
    final timestamp = DateTime.now().toIso8601String();
    final completionId = 'RO-${DateTime.now().millisecondsSinceEpoch}';
    _qrCodeData = 'SMaRT-PDM-RO-Completion:$completionId:$timestamp';
  }

  Future<void> _selectTimeIn() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _timeIn ?? TimeOfDay.now(),
    );
    if (picked != null && picked != _timeIn) {
      setState(() {
        _timeIn = picked;
      });
    }
  }

  Future<void> _selectTimeOut() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _timeOut ?? TimeOfDay.now(),
    );
    if (picked != null && picked != _timeOut) {
      setState(() {
        _timeOut = picked;
      });
    }
  }

  Future<void> _pickImage() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.camera);
    if (image != null) {
      setState(() {
        _completionImage = File(image.path);
      });
    }
  }

  Future<void> _submitCompletion() async {
    if (_formKey.currentState!.validate()) {
      if (_timeIn == null || _timeOut == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please select both Time In and Time Out'),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }

      if (_completionImage == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please take a completion photo'),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }

      setState(() => _isSubmitting = true);

      // Prepare completion data for API submission
      // In a real app, this would be sent to backend:
      // final completionData = {
      //   'hoursCompleted': int.tryParse(_hoursCompletedController.text) ?? 0,
      //   'supervisorApproval': _supervisorApproval,
      //   'workSummary': _descriptionController.text,
      //   'timeIn': _timeIn?.format(context),
      //   'timeOut': _timeOut?.format(context),
      //   'completionImage': _completionImage,
      //   'qrCodeData': _qrCodeData,
      // };

      // Simulate API call
      await Future.delayed(const Duration(seconds: 2));

      if (mounted) {
        setState(() => _isSubmitting = false);
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Success'),
            content: const Text(
              'Your RO completion report has been submitted successfully. Your supervisor will review it shortly.',
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.pop(context);
                },
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final assignment =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Submit RO Completion'),
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
      ),
      selectedIndex: 0,
      showDrawer: true,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Assignment Info (if available)
            if (assignment != null) ...[
              Card(
                color: primaryColor.withValues(alpha: 0.1),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        assignment['title'] ?? 'RO Assignment',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Supervisor: ${assignment['supervisor'] ?? 'N/A'}',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Form Title
            const Text(
              'Completion Report',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),

            // Form
            Form(
              key: _formKey,
              child: Column(
                children: [
                  // Hours Completed
                  TextFormField(
                    controller: _hoursCompletedController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Hours Completed',
                      hintText: 'e.g., 40',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      prefixIcon: const Icon(Icons.schedule),
                    ),
                    validator: (value) {
                      if (value?.isEmpty ?? true) {
                        return 'Hours completed is required';
                      }
                      if (int.tryParse(value!) == null) {
                        return 'Please enter a valid number';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Supervisor Approval
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey[300]!),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: DropdownButtonFormField<String>(
                      decoration: const InputDecoration(
                        labelText: 'Supervisor Approval',
                        border: InputBorder.none,
                      ),
                      items: ['Approved', 'Pending', 'Needs Revision']
                          .map(
                            (status) => DropdownMenuItem(
                              value: status,
                              child: Text(status),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        setState(() => _supervisorApproval = value ?? '');
                      },
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please select supervisor approval status';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Time In & Time Out
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: _selectTimeIn,
                          child: InputDecorator(
                            decoration: InputDecoration(
                              labelText: 'Time In',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                              prefixIcon: const Icon(Icons.access_time),
                            ),
                            child: Text(
                              _timeIn?.format(context) ?? 'Select time',
                              style: TextStyle(
                                color: _timeIn != null
                                    ? Colors.black
                                    : Colors.grey,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: InkWell(
                          onTap: _selectTimeOut,
                          child: InputDecorator(
                            decoration: InputDecoration(
                              labelText: 'Time Out',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                              prefixIcon: const Icon(Icons.access_time),
                            ),
                            child: Text(
                              _timeOut?.format(context) ?? 'Select time',
                              style: TextStyle(
                                color: _timeOut != null
                                    ? Colors.black
                                    : Colors.grey,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Picture Upload
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey[300]!),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      children: [
                        ListTile(
                          leading: const Icon(
                            Icons.camera_alt,
                            color: primaryColor,
                          ),
                          title: const Text('Completion Photo'),
                          subtitle: const Text(
                            'Take a photo of your completed work',
                          ),
                          trailing: _completionImage != null
                              ? const Icon(
                                  Icons.check_circle,
                                  color: Colors.green,
                                )
                              : const Icon(Icons.add_a_photo),
                          onTap: _pickImage,
                        ),
                        if (_completionImage != null) ...[
                          Container(
                            height: 200,
                            width: double.infinity,
                            margin: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              image: DecorationImage(
                                image: FileImage(_completionImage!),
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: TextButton.icon(
                              onPressed: _pickImage,
                              icon: const Icon(Icons.refresh),
                              label: const Text('Retake Photo'),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // QR Code Verification
                  Card(
                    color: Colors.green[50],
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          const Text(
                            'Verification QR Code',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Scan this QR code to verify completion',
                            style: TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: QrImageView(
                              data: _qrCodeData,
                              version: QrVersions.auto,
                              size: 150.0,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'ID: ${_qrCodeData.split(':')[1]}',
                            style: const TextStyle(
                              fontSize: 10,
                              color: Colors.grey,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Description
                  TextFormField(
                    controller: _descriptionController,
                    maxLines: 5,
                    decoration: InputDecoration(
                      labelText: 'Work Summary & Accomplishments',
                      hintText: 'Describe the work you completed...',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      alignLabelWithHint: true,
                    ),
                    validator: (value) {
                      if (value?.isEmpty ?? true) {
                        return 'Work summary is required';
                      }
                      if (value!.length < 20) {
                        return 'Please provide more details (at least 20 characters)';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),

                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _isSubmitting ? null : _submitCompletion,
                      icon: _isSubmitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Colors.white,
                                ),
                              ),
                            )
                          : const Icon(Icons.send),
                      label: Text(
                        _isSubmitting ? 'Submitting...' : 'Submit Completion Report',
                        maxLines: 1,
                        overflow: TextOverflow.visible,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          fontSize: 13,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryColor,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Cancel Button
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                      ),
                      child: const Text('Cancel'),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Info Card
            Card(
              color: Colors.blue[50],
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.info, color: Colors.blue),
                        SizedBox(width: 8),
                        Text(
                          'Important',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Please ensure your supervisor has approved your work before submitting. All information must be accurate and complete.',
                      style: TextStyle(fontSize: 12, height: 1.5),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
