import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'dart:async';
import 'package:smartpdm_mobileapp/models/app_data.dart';
import 'package:smartpdm_mobileapp/services/application_service.dart';

class NewScholarProvider extends ChangeNotifier {
  final ApplicationService _applicationService = ApplicationService();
  // Add your state variables here
  String? _scholarName;
  String? _email;
  String? _phone;

  // Getters
  String? get scholarName => _scholarName;
  String? get email => _email;
  String? get phone => _phone;

  // Setters to update state and notify listeners
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

  int _currentStep = 0;
  bool _isLoading = false;
  String? _submissionError;
  String? _successMessage;
  Map<String, dynamic>? _lastSubmissionResponse;

  // Getters
  int get currentStep => _currentStep;
  bool get isLoading => _isLoading;
  String? get submissionError => _submissionError;
  String? get successMessage => _successMessage;
  Map<String, dynamic>? get lastSubmissionResponse => _lastSubmissionResponse;

  // Navigation Methods
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
    // TODO: Clear any saved form data here
    notifyListeners();
  }

  // Submission Method
  Future<bool> submitApplication(ApplicationData applicationData) async {
    _isLoading = true;
    _submissionError = null;
    _successMessage = null;
    _lastSubmissionResponse = null;
    notifyListeners();

    try {
      final response = await _applicationService.submitApplication(
        applicationData,
      );
      _lastSubmissionResponse = response;
      _successMessage = response['message']?.toString();

      _isLoading = false;
      notifyListeners();
      return true;
    } on TimeoutException {
      _submissionError =
          'Submission timed out. Please check your connection and try again.';
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _isLoading = false;
      _submissionError = e.toString();
      notifyListeners();
      return false;
    }
  }
}
