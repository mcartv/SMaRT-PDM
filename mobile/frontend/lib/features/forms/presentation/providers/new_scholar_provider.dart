// SMaRT-PDM: Scholars — new scholar provider (mobile state provider); owns state and coordinates updates for the UI.
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

  // setScholarName: sets set scholar name for the Scholars flow.
  void setScholarName(String name) {
    _scholarName = name;
    notifyListeners();
  }

  // setEmail: sets set email for the Scholars flow.
  void setEmail(String emailAddress) {
    _email = emailAddress;
    notifyListeners();
  }

  // setPhone: sets set phone for the Scholars flow.
  void setPhone(String phoneNumber) {
    _phone = phoneNumber;
    notifyListeners();
  }

  // clearProvider: clears clear provider for the Scholars flow.
  void clearProvider() {
    _scholarName = null;
    _email = null;
    _phone = null;
    notifyListeners();
  }

  // goToNextStep: handles go to next step for the Scholars flow.
  void goToNextStep() {
    if (_currentStep < 4) {
      _currentStep++;
      notifyListeners();
    }
  }

  // goToPreviousStep: handles go to previous step for the Scholars flow.
  void goToPreviousStep() {
    if (_currentStep > 0) {
      _currentStep--;
      notifyListeners();
    }
  }

  // resetApplication: resets reset application for the Scholars flow.
  void resetApplication() {
    _currentStep = 0;
    _isLoading = false;
    _submissionError = null;
    _successMessage = null;
    _lastSubmissionResponse = null;
    notifyListeners();
  }

  // submitApplication: handles submit application for the Scholars flow.
  Future<bool> submitApplication(
    ApplicationData applicationData, {
    required String openingId,
    bool editExistingApplication = false,
  }) async {
    // Ignore a second tap while the first request is still in flight. The
    // backend is idempotent as well, but avoiding duplicate requests keeps the
    // form state and success navigation deterministic.
    if (_isLoading) return false;

    _isLoading = true;
    _submissionError = null;
    _successMessage = null;
    _lastSubmissionResponse = null;
    notifyListeners();

    try {
      if (applicationData.openingId.trim().isEmpty) {
        applicationData.openingId = openingId.trim();
      }

      final response = editExistingApplication
          ? await _applicationService.updateSubmittedApplication(
              applicationData,
            )
          : await _applicationService.submitApplication(applicationData);

      _lastSubmissionResponse = response;
      _successMessage =
          response['message']?.toString() ??
          (editExistingApplication
              ? 'Application updated.'
              : 'Application submitted.');

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
