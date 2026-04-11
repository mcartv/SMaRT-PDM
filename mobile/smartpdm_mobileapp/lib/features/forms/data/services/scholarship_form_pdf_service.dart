import 'dart:io';
import 'dart:ui' show Rect;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show MissingPluginException, rootBundle;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';

class ScholarshipFormPdfService {
  static const double _imageWidth = 2550;
  static const double _imageHeight = 3900;

  Future<Directory> _resolveOutputDirectory() async {
    try {
      return await getTemporaryDirectory();
    } on MissingPluginException {
      return Directory.systemTemp.createTemp('smartpdm_pdf_');
    }
  }

  Future<File> generateFromSavedApplication(
    SavedApplicationPrintModel model,
  ) async {
    final templateBytes = await rootBundle.load(
      'assets/files/scholarship_app_form.pdf',
    );

    final document = PdfDocument(
      inputBytes: templateBytes.buffer.asUint8List(),
    );

    final page = document.pages[0];
    final font = PdfStandardFont(PdfFontFamily.helvetica, 8);
    final smallFont = PdfStandardFont(PdfFontFamily.helvetica, 7);
    final boldFont = PdfStandardFont(
      PdfFontFamily.helvetica,
      8,
      style: PdfFontStyle.bold,
    );

    final pageWidth = page.size.width;
    final pageHeight = page.size.height;

    Rect r(double x, double y, double w, double h) {
      return Rect.fromLTWH(
        x * pageWidth / _imageWidth,
        y * pageHeight / _imageHeight,
        w * pageWidth / _imageWidth,
        h * pageHeight / _imageHeight,
      );
    }

    void drawText(
      String value,
      Rect bounds, {
      PdfFont? textFont,
      PdfTextAlignment align = PdfTextAlignment.left,
    }) {
      final clean = value.trim();
      if (clean.isEmpty) return;
      page.graphics.drawString(
        clean,
        textFont ?? font,
        bounds: bounds,
        format: PdfStringFormat(
          alignment: align,
          lineAlignment: PdfVerticalAlignment.middle,
        ),
      );
    }

    void drawMultiLine(String value, Rect bounds, {PdfFont? textFont}) {
      final clean = value.trim();
      if (clean.isEmpty) return;
      page.graphics.drawString(
        clean,
        textFont ?? smallFont,
        bounds: bounds,
        format: PdfStringFormat(
          lineAlignment: PdfVerticalAlignment.top,
          wordWrap: PdfWordWrapType.word,
        ),
      );
    }

    void drawCheck(bool checked, Rect bounds) {
      if (!checked) return;
      page.graphics.drawString(
        'X',
        boldFont,
        bounds: bounds,
        format: PdfStringFormat(
          alignment: PdfTextAlignment.center,
          lineAlignment: PdfVerticalAlignment.middle,
        ),
      );
    }

    drawText(model.lastName, r(85, 705, 350, 65));
    drawText(model.firstName, r(445, 705, 560, 65));
    drawText(model.middleName, r(1045, 705, 500, 65));
    drawText(model.maidenName, r(1575, 705, 450, 65));

    drawText(model.age, r(85, 800, 140, 55));
    drawText(model.dateOfBirth, r(245, 800, 340, 55));
    drawText(model.placeOfBirth, r(605, 800, 620, 55));
    drawText(model.citizenship, r(1245, 800, 250, 55));
    drawText(model.religion, r(1505, 800, 410, 55));
    drawText(model.civilStatus, r(1930, 800, 235, 55));
    drawText(model.sex, r(2180, 800, 225, 55));

    drawText(model.houseLotBlockNo, r(85, 895, 235, 55));
    drawText(model.phase, r(330, 895, 160, 55));
    drawText(model.street, r(500, 895, 395, 55), textFont: smallFont);
    drawText(model.subdivision, r(905, 895, 350, 55), textFont: smallFont);
    drawText(model.barangay, r(1265, 895, 330, 55), textFont: smallFont);
    drawText(model.city, r(1605, 895, 305, 55));
    drawText(model.province, r(1920, 895, 290, 55));
    drawText(model.zipCode, r(2220, 895, 185, 55));

    drawText(model.landlineNumber, r(820, 990, 360, 55));
    drawText(model.mobileNumber, r(1190, 990, 520, 55));
    drawText(model.email, r(1725, 990, 690, 55), textFont: smallFont);

    drawMultiLine(model.parentGuardianAddress, r(85, 1128, 395, 240));

    drawText(model.fatherLastName, r(505, 1140, 440, 42), textFont: smallFont);
    drawText(model.fatherFirstName, r(505, 1182, 440, 42), textFont: smallFont);
    drawText(
      model.fatherMiddleName,
      r(505, 1224, 440, 42),
      textFont: smallFont,
    );
    drawText(model.fatherMobile, r(505, 1266, 440, 42), textFont: smallFont);

    drawText(model.motherLastName, r(960, 1140, 440, 42), textFont: smallFont);
    drawText(model.motherFirstName, r(960, 1182, 440, 42), textFont: smallFont);
    drawText(
      model.motherMiddleName,
      r(960, 1224, 440, 42),
      textFont: smallFont,
    );
    drawText(model.motherMobile, r(960, 1266, 440, 42), textFont: smallFont);

    drawText(
      model.siblingLastName,
      r(1415, 1140, 440, 42),
      textFont: smallFont,
    );
    drawText(
      model.siblingFirstName,
      r(1415, 1182, 440, 42),
      textFont: smallFont,
    );
    drawText(
      model.siblingMiddleName,
      r(1415, 1224, 440, 42),
      textFont: smallFont,
    );
    drawText(model.siblingMobile, r(1415, 1266, 440, 42), textFont: smallFont);

    drawText(
      model.guardianLastName,
      r(1870, 1140, 500, 42),
      textFont: smallFont,
    );
    drawText(
      model.guardianFirstName,
      r(1870, 1182, 500, 42),
      textFont: smallFont,
    );
    drawText(
      model.guardianMiddleName,
      r(1870, 1224, 500, 42),
      textFont: smallFont,
    );
    drawText(model.guardianMobile, r(1870, 1266, 500, 42), textFont: smallFont);

    drawText(
      model.fatherEducationalAttainment,
      r(505, 1368, 440, 60),
      textFont: smallFont,
    );
    drawText(
      model.motherEducationalAttainment,
      r(960, 1368, 440, 60),
      textFont: smallFont,
    );
    drawText(
      model.guardianEducationalAttainment,
      r(1870, 1368, 500, 60),
      textFont: smallFont,
    );

    drawText(
      model.fatherOccupation,
      r(505, 1460, 440, 60),
      textFont: smallFont,
    );
    drawText(
      model.motherOccupation,
      r(960, 1460, 440, 60),
      textFont: smallFont,
    );
    drawText(
      model.guardianOccupation,
      r(1870, 1460, 500, 60),
      textFont: smallFont,
    );

    drawMultiLine(
      model.fatherCompanyNameAddress,
      r(505, 1548, 440, 95),
      textFont: smallFont,
    );
    drawMultiLine(
      model.motherCompanyNameAddress,
      r(960, 1548, 440, 95),
      textFont: smallFont,
    );
    drawMultiLine(
      model.guardianCompanyNameAddress,
      r(1870, 1548, 500, 95),
      textFont: smallFont,
    );

    drawCheck(model.isFatherOnlyNative, r(1040, 1668, 24, 24));
    drawCheck(model.isMotherOnlyNative, r(1255, 1668, 24, 24));
    drawCheck(model.isBothParentsNative, r(1440, 1668, 24, 24));
    drawCheck(model.isNotNative, r(1728, 1668, 24, 24));
    drawText(model.yearsResident, r(1880, 1656, 355, 36), textFont: smallFont);
    drawText(model.originProvince, r(1760, 1694, 655, 36), textFont: smallFont);

    drawText(model.collegeSchool, r(170, 1818, 505, 58), textFont: smallFont);
    drawText(model.collegeAddress, r(680, 1818, 520, 58), textFont: smallFont);
    drawText(model.collegeHonors, r(1205, 1818, 470, 58), textFont: smallFont);
    drawText(model.collegeClub, r(1680, 1818, 445, 58), textFont: smallFont);
    drawText(
      model.collegeYearGraduated,
      r(2130, 1818, 250, 58),
      textFont: smallFont,
    );

    drawText(
      model.highSchoolSchool,
      r(170, 1888, 505, 58),
      textFont: smallFont,
    );
    drawText(
      model.highSchoolAddress,
      r(680, 1888, 520, 58),
      textFont: smallFont,
    );
    drawText(
      model.highSchoolHonors,
      r(1205, 1888, 470, 58),
      textFont: smallFont,
    );
    drawText(model.highSchoolClub, r(1680, 1888, 445, 58), textFont: smallFont);
    drawText(
      model.highSchoolYearGraduated,
      r(2130, 1888, 250, 58),
      textFont: smallFont,
    );

    drawText(
      model.seniorHighSchool,
      r(170, 1958, 505, 58),
      textFont: smallFont,
    );
    drawText(
      model.seniorHighAddress,
      r(680, 1958, 520, 58),
      textFont: smallFont,
    );
    drawText(
      model.seniorHighHonors,
      r(1205, 1958, 470, 58),
      textFont: smallFont,
    );
    drawText(model.seniorHighClub, r(1680, 1958, 445, 58), textFont: smallFont);
    drawText(
      model.seniorHighYearGraduated,
      r(2130, 1958, 250, 58),
      textFont: smallFont,
    );

    drawText(
      model.elementarySchool,
      r(170, 2028, 505, 58),
      textFont: smallFont,
    );
    drawText(
      model.elementaryAddress,
      r(680, 2028, 520, 58),
      textFont: smallFont,
    );
    drawText(
      model.elementaryHonors,
      r(1205, 2028, 470, 58),
      textFont: smallFont,
    );
    drawText(model.elementaryClub, r(1680, 2028, 445, 58), textFont: smallFont);
    drawText(
      model.elementaryYearGraduated,
      r(2130, 2028, 250, 58),
      textFont: smallFont,
    );

    drawText(
      model.currentYearSection,
      r(170, 2104, 330, 55),
      textFont: smallFont,
    );
    drawText(model.studentNumber, r(505, 2104, 330, 55), textFont: smallFont);
    drawText(
      model.learnersReferenceNumber,
      r(840, 2104, 430, 55),
      textFont: smallFont,
    );
    drawText(model.currentCourse, r(1275, 2104, 320, 55), textFont: smallFont);

    drawCheck(model.supportParents, r(1695, 2110, 20, 20));
    drawCheck(model.supportScholarship, r(1880, 2110, 20, 20));
    drawCheck(model.supportLoan, r(2055, 2110, 20, 20));
    drawCheck(model.supportOther, r(2215, 2110, 20, 20));
    drawText(
      model.financialSupportOther,
      r(2260, 2104, 155, 55),
      textFont: smallFont,
    );

    drawCheck(model.hadScholarship, r(220, 2185, 20, 20));
    drawCheck(model.noScholarshipHistory, r(360, 2185, 20, 20));
    drawMultiLine(
      model.scholarshipDetails,
      r(1290, 2168, 1120, 58),
      textFont: smallFont,
    );

    drawCheck(model.hasDisciplinaryRecord, r(220, 2248, 20, 20));
    drawCheck(model.noDisciplinaryRecord, r(360, 2248, 20, 20));
    drawMultiLine(
      model.disciplinaryDetails,
      r(1290, 2232, 1120, 58),
      textFont: smallFont,
    );

    drawMultiLine(
      model.selfDescription,
      r(90, 2328, 2320, 180),
      textFont: smallFont,
    );
    drawMultiLine(
      model.aimsAndAmbitions,
      r(90, 2550, 2320, 170),
      textFont: smallFont,
    );

    drawText(
      model.applicantPrintedName,
      r(225, 2915, 600, 55),
      textFont: smallFont,
    );
    drawText(model.printedDate, r(1085, 2915, 160, 55), textFont: smallFont);
    drawText(
      model.parentGuardianPrintedName,
      r(1365, 2915, 700, 55),
      textFont: smallFont,
    );
    drawText(model.printedDate, r(2310, 2915, 120, 55), textFont: smallFont);

    final bytes = Uint8List.fromList(document.saveSync());
    document.dispose();

    final dir = await _resolveOutputDirectory();
    final file = File('${dir.path}/filled_scholarship_form.pdf');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  Future<void> openGeneratedPdf(File file) async {
    if (kIsWeb) {
      throw Exception(
        'Printable PDF download is not available in the web build.',
      );
    }

    try {
      final result = await OpenFilex.open(file.path);
      if (result.type != ResultType.done) {
        throw Exception(
          'Printable PDF was created, but your device could not open it automatically.',
        );
      }
    } on MissingPluginException {
      throw Exception(
        'Printable PDF was created at ${file.path}, but automatic opening is not available on this device.',
      );
    }
  }
}
