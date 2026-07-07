import 'dart:io';

import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/scholarship_form_pdf_service.dart';

class PrintableApplicationService {
  PrintableApplicationService({
    ApplicationService? applicationService,
    ScholarshipFormPdfService? pdfService,
  }) : _applicationService = applicationService ?? ApplicationService(),
       _pdfService = pdfService ?? ScholarshipFormPdfService();

  final ApplicationService _applicationService;
  final ScholarshipFormPdfService _pdfService;

  Future<File> generateFromMySavedFormData() async {
    final payload = await _applicationService.fetchMySavedFormData();
    final model = SavedApplicationPrintModel.fromSavedFormData(payload);
    return _pdfService.generateFromSavedApplication(model);
  }

  Future<void> generateOpenFromMySavedFormData() async {
    final file = await generateFromMySavedFormData();
    await _pdfService.openGeneratedPdf(file);
  }

  Future<File> generateFromApplicationId(String applicationId) async {
    final payload = await _applicationService.fetchApplicationPrintData(
      applicationId,
    );
    final application = payload['application'] is Map
        ? Map<String, dynamic>.from(payload['application'] as Map)
        : <String, dynamic>{};
    final printData = application['print_data'] is Map
        ? Map<String, dynamic>.from(application['print_data'] as Map)
        : payload;
    final model = SavedApplicationPrintModel.fromApi(printData);
    return _pdfService.generateFromSavedApplication(model);
  }

  Future<void> generateOpenFromApplicationId(String applicationId) async {
    final file = await generateFromApplicationId(applicationId);
    await _pdfService.openGeneratedPdf(file);
  }
}
