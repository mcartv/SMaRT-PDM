import 'dart:typed_data';

import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/shared/models/payout_proof.dart';

class MobilePayoutItem {
  const MobilePayoutItem({
    required this.payoutEntryId,
    required this.payoutBatchId,
    required this.title,
    required this.amount,
    required this.status,
    required this.payoutDate,
    required this.semester,
    required this.schoolYear,
    required this.paymentMode,
    required this.batchStatus,
    required this.programName,
    required this.reference,
    this.benefactorName,
    this.proof,
  });

  final String payoutEntryId;
  final String payoutBatchId;
  final String title;
  final double amount;
  final String status;
  final String payoutDate;
  final String semester;
  final String schoolYear;
  final String paymentMode;
  final String batchStatus;
  final String programName;
  final String reference;
  final String? benefactorName;
  final PayoutProof? proof;

  factory MobilePayoutItem.fromJson(Map<String, dynamic> json) {
    return MobilePayoutItem(
      payoutEntryId: json['payout_entry_id']?.toString() ?? '',
      payoutBatchId: json['payout_batch_id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Scholarship Payout',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      status:
          json['release_status']?.toString() ??
          json['status']?.toString() ??
          'Pending',
      payoutDate: json['payout_date']?.toString() ?? '',
      semester: json['semester']?.toString() ?? '',
      schoolYear:
          json['academic_year']?.toString() ??
          json['school_year']?.toString() ??
          '',
      paymentMode: json['payment_mode']?.toString() ?? '',
      batchStatus: json['batch_status']?.toString() ?? '',
      programName: json['program_name']?.toString() ?? 'Scholarship Program',
      benefactorName: json['benefactor_name']?.toString(),
      reference: json['reference']?.toString() ?? '',
      proof: json['proof'] is Map
          ? PayoutProof.fromJson(Map<String, dynamic>.from(json['proof'] as Map))
          : null,
    );
  }
}

class PayoutService {
  PayoutService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<List<MobilePayoutItem>> fetchMyPayouts() async {
    final response = await _apiClient.getObject('/api/payouts/me');
    final items = (response['items'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map(
          (item) => MobilePayoutItem.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList();

    return items;
  }

  Future<PayoutProof> uploadProof({
    required String payoutEntryId,
    required String fileName,
    String? filePath,
    Uint8List? fileBytes,
  }) async {
    if (payoutEntryId.trim().isEmpty) {
      throw ArgumentError('Payout entry ID is required.');
    }
    if (fileName.trim().isEmpty) {
      throw ArgumentError('File name is required.');
    }
    if (fileBytes != null && fileBytes.isEmpty) {
      throw ArgumentError('The selected file is empty.');
    }
    if (fileBytes == null && (filePath == null || filePath.trim().isEmpty)) {
      throw ArgumentError('The selected file could not be accessed.');
    }

    final path = '/api/payouts/entries/${payoutEntryId.trim()}/proof';
    final response = fileBytes != null
        ? await _apiClient.uploadBytes(
            path,
            fieldName: 'proof',
            bytes: fileBytes,
            fileName: fileName,
            timeout: const Duration(seconds: 60),
          )
        : await _apiClient.uploadFile(
            path,
            fieldName: 'proof',
            filePath: filePath!,
            timeout: const Duration(seconds: 60),
          );

    final proof = response['proof'];
    if (proof is! Map) {
      throw StateError('The server did not return the submitted payout proof.');
    }
    return PayoutProof.fromJson(Map<String, dynamic>.from(proof));
  }
}
