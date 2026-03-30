import 'package:flutter/foundation.dart';

import 'package:flutter/material.dart';


class NewScholarProvider extends ChangeNotifier {
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

  // Getters
  int get currentStep => _currentStep;
  bool get isLoading => _isLoading;
  String? get submissionError => _submissionError;

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
    // TODO: Clear any saved form data here
    notifyListeners();
  }

  // Submission Method
  Future<bool> submitApplication() async {
    _isLoading = true;
    _submissionError = null;
    notifyListeners();

    try {
      // Simulate network request / API call
      await Future.delayed(const Duration(seconds: 2));
      
      _isLoading = false;
      notifyListeners();
      return true; // Return true on success
    } catch (e) {
      _isLoading = false;
      _submissionError = 'Failed to submit application. Please check your connection and try again.';
      notifyListeners();
      return false; // Return false on error
    }
  }
}