import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/models/app_data.dart';

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
  Future<bool> submitApplication(ApplicationData applicationData) async {
    _isLoading = true;
    _submissionError = null;
    notifyListeners();

    try {
      final response = await http
          .post(
            Uri.parse('$BASE_URL/api/applications'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(applicationData.toSubmissionPayload()),
          )
          .timeout(const Duration(seconds: 20));

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final responseBody = response.body.isNotEmpty
            ? jsonDecode(response.body)
            : null;
        _submissionError =
            responseBody is Map<String, dynamic> &&
                responseBody['error'] is String
            ? responseBody['error'] as String
            : 'Failed to submit application.';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      _isLoading = false;
      notifyListeners();
      return true;
    } on TimeoutException {
      _submissionError =
          'Submission timed out. Please check your connection and try again.';
      _isLoading = false;
      notifyListeners();
      return false;
    } on SocketException {
      _submissionError =
          'Network connection error. Please check your internet connection.';
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _isLoading = false;
      _submissionError =
          'Failed to submit application. Please check your connection and try again.';
      notifyListeners();
      return false;
    }
  }
}
