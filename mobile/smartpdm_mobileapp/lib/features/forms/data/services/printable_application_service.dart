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

  Future<File> generateFromApplicationId(String applicationId) async {
    final payload = await _applicationService.fetchApplicationDetails(
      applicationId,
    );
    final model = SavedApplicationPrintModel.fromApi(payload);
    return _pdfService.generateFromSavedApplication(model);
  }

  Future<void> generateOpenFromApplicationId(String applicationId) async {
    final file = await generateFromApplicationId(applicationId);
    await _pdfService.openGeneratedPdf(file);
  }
}
