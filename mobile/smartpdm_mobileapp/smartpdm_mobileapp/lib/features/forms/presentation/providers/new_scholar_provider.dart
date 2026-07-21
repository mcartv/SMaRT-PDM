import 'dart:async';

import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

class NewScholarProvider extends ChangeNotifier {
  final ApplicationService _applicationService = ApplicationService();

  String? _scholarName;
  String? _email;
  String? _phone;

  String? get scholarName => _scholarName;
  String? get email => _email;
  String? get phone => _phone;

  int _currentStep = 0;
  bool _isLoading = false;
  String? _submissionError;
  String? _successMessage;
  Map<String, dynamic>? _lastSubmissionResponse;

  int get currentStep => _currentStep;
  bool get isLoading => _isLoading;
  String? get submissionError => _submissionError;
  String? get successMessage => _successMessage;
  Map<String, dynamic>? get lastSubmissionResponse => _lastSubmissionResponse;

  void setScholarName(String name) {
    _scholarName = name;
    notifyListeners();
  }

  void setEmail(String emailAddress) {
    _email = emailAddress;
    notifyListeners();
  }

  void setPhone(String phoneNumber) {
    _phone = phoneNumber;
    notifyListeners();
  }

  void clearProvider() {
    _scholarName = null;
    _email = null;
    _phone = null;
    notifyListeners();
  }

  void goToNextStep() {
    if (_currentStep < 4) {
      _currentStep++;
      notifyListeners();
    }
  }

  void goToPreviousStep() {
    if (_currentStep > 0) {
      _currentStep--;
      notifyListeners();
    }
  }

  void resetApplication() {
    _currentStep = 0;
    _isLoading = false;
    _submissionError = null;
    _successMessage = null;
    _lastSubmissionResponse = null;
    notifyListeners();
  }

  Future<bool> submitApplication(
    ApplicationData applicationData, {
    required String openingId,
  }) async {
    _isLoading = true;
    _submissionError = null;
    _successMessage = null;
    _lastSubmissionResponse = null;
    notifyListeners();

    try {
      if (applicationData.openingId.trim().isEmpty) {
        applicationData.openingId = openingId.trim();
      }

      final response = await _applicationService.submitApplication(
        applicationData,
      );

      _lastSubmissionResponse = response;
      _successMessage =
          response['message']?.toString() ?? 'Application submitted.';

      _isLoading = false;
      notifyListeners();
      return true;
    } on TimeoutException {
      _submissionError =
          'Submission timed out. Please check your connection and try again.';
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (error) {
      _submissionError = error
          .toString()
          .replaceFirst('Exception: ', '')
          .trim();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }
}
