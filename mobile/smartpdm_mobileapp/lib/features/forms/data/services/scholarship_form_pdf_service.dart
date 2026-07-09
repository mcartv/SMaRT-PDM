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
    ByteData templateBytes;
    try {
      templateBytes = await rootBundle.load(
        'assets/files/scholarship_app_form.pdf',
      );
    } catch (e) {
      return _generateFallbackPdf(model);
    }

    final document = PdfDocument(
      inputBytes: templateBytes.buffer.asUint8List(),
    );

    final page = document.pages[0];

    // Blue ink – matches the "blue ink" instruction on the form.
    // The heading "OFFICE FOR SCHOLARSHIP AND FINANCIAL ASSISTANCE" renders
    // at ~9.5 pt on a 612-pt wide page, so we match that size here.
    final blueColor = PdfColor(0, 70, 180);
    final font      = PdfStandardFont(PdfFontFamily.helvetica, 9.5);
    final smallFont = PdfStandardFont(PdfFontFamily.helvetica, 8.5);
    final boldFont  = PdfStandardFont(
      PdfFontFamily.helvetica,
      9.5,
      style: PdfFontStyle.bold,
    );
    final brush = PdfSolidBrush(blueColor);

    final pageWidth  = page.size.width;
    final pageHeight = page.size.height;

    Rect r(double x, double y, double w, double h) {
      return Rect.fromLTWH(
        x * pageWidth  / _imageWidth,
        y * pageHeight / _imageHeight,
        w * pageWidth  / _imageWidth,
        h * pageHeight / _imageHeight,
      );
    }

    // Format a MM/DD/YYYY date string into spaced digits "MM DD YYYY"
    // so each character lands in its own box on the form.
    String formatDob(String raw) {
      // Strip any slashes or dashes and keep only digits
      final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
      if (digits.length != 8) return raw; // fallback if unexpected format
      // MM  DD  YYYY with a space between each digit pair group
      return '${digits[0]} ${digits[1]}  ${digits[2]} ${digits[3]}  '
             '${digits[4]} ${digits[5]} ${digits[6]} ${digits[7]}';
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
        brush: brush,
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

      PdfFont currentFont = textFont ?? smallFont;
      if (clean.length > 800) {
        currentFont = PdfStandardFont(PdfFontFamily.helvetica, 7.0);
      } else if (clean.length > 500) {
        currentFont = PdfStandardFont(PdfFontFamily.helvetica, 7.5);
      }

      page.graphics.drawString(
        clean,
        currentFont,
        brush: brush,
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
        brush: brush,
        bounds: bounds,
        format: PdfStringFormat(
          alignment: PdfTextAlignment.center,
          lineAlignment: PdfVerticalAlignment.middle,
        ),
      );
    }

    // ── I. PERSONAL DATA ──────────────────────────────────────────────
    // Labels at Y≈832. Value entry area is below labels at Y≈870.
    // Column X positions from template: LastName=99, FirstName=696, MiddleName=1343, MaidenName=1889
    drawText(model.lastName, r(99, 865, 590, 55));
    drawText(model.firstName, r(696, 865, 640, 55));
    drawText(model.middleName, r(1343, 865, 540, 55));
    drawText(model.maidenName, r(1889, 865, 520, 55));

    // Row 2: Labels at Y≈935. Value area at Y≈970.
    // Age=99, DOB=253, PlaceOfBirth=696, Citizenship=1343, CivilStatus=1606, Religion=1889, Sex=2247
    drawText(model.age, r(99, 970, 150, 55));
    // DOB: 8 individual boxes on the form (MM-DD-YYYY).
    // We strip slashes and space the digits to land one-per-box.
    drawText(formatDob(model.dateOfBirth), r(253, 970, 420, 55));
    drawText(model.placeOfBirth, r(696, 970, 640, 55));
    drawText(model.citizenship, r(1343, 970, 255, 55));
    drawText(model.civilStatus, r(1606, 970, 275, 55));
    drawText(model.religion, r(1889, 970, 350, 55));
    drawText(model.sex, r(2247, 970, 210, 55));

    // ── PERMANENT ADDRESS ────────────────────────────────────────────
    // Labels at Y≈1049. Value area at Y≈1085.
    drawText(model.houseLotBlockNo, r(99, 1085, 310, 45));
    drawText(model.phase, r(420, 1085, 270, 45));
    drawText(model.street, r(696, 1085, 255, 45), textFont: smallFont);
    drawText(model.subdivision, r(958, 1085, 380, 45), textFont: smallFont);
    drawText(model.barangay, r(1343, 1085, 255, 45), textFont: smallFont);
    drawText(model.city, r(1606, 1085, 275, 45));
    drawText(model.province, r(1889, 1085, 350, 45));
    drawText(model.zipCode, r(2247, 1085, 210, 45));

    // ── CONTACT INFORMATION ──────────────────────────────────────────
    // Labels at Y≈1138. Value area at Y≈1170.
    drawText(model.landlineNumber, r(696, 1170, 640, 45));
    drawText(model.mobileNumber, r(1343, 1170, 540, 45));
    drawText(model.email, r(1889, 1170, 520, 45), textFont: smallFont);

    // ── II. FAMILY DATA ──────────────────────────────────────────────
    // "Address of Parents/Guardian" label at Y≈1275. Content area below.
    drawMultiLine(model.parentGuardianAddress, r(99, 1310, 440, 200));

    // Family name sub-rows: label text like "Last Name___" is at the given Y.
    // The value goes AFTER the label text, so X is shifted right past the label width.
    // Father col labels at X=547, label width ~190 → values at X≈740
    // Mother col labels at X=1015, label width ~190 → values at X≈1205  
    // Sibling col labels at X=1501, label width ~190 → values at X≈1695
    // Guardian col labels at X=1989, label width ~190 → values at X≈2180
    // Row Ys: LastName=1304, FirstName=1347, MiddleName=1390, Mobile=1434
    drawText(model.fatherLastName, r(740, 1304, 270, 40), textFont: smallFont);
    drawText(model.fatherFirstName, r(740, 1347, 270, 40), textFont: smallFont);
    drawText(model.fatherMiddleName, r(740, 1390, 270, 40), textFont: smallFont);
    drawText(model.fatherMobile, r(700, 1434, 310, 40), textFont: smallFont);

    drawText(model.motherLastName, r(1205, 1304, 290, 40), textFont: smallFont);
    drawText(model.motherFirstName, r(1205, 1347, 290, 40), textFont: smallFont);
    drawText(model.motherMiddleName, r(1205, 1390, 290, 40), textFont: smallFont);
    drawText(model.motherMobile, r(1165, 1434, 330, 40), textFont: smallFont);

    drawText(model.siblingLastName, r(1695, 1304, 290, 40), textFont: smallFont);
    drawText(model.siblingFirstName, r(1695, 1347, 290, 40), textFont: smallFont);
    drawText(model.siblingMiddleName, r(1695, 1390, 290, 40), textFont: smallFont);
    drawText(model.siblingMobile, r(1655, 1434, 330, 40), textFont: smallFont);

    drawText(model.guardianLastName, r(2180, 1304, 230, 40), textFont: smallFont);
    drawText(model.guardianFirstName, r(2180, 1347, 230, 40), textFont: smallFont);
    drawText(model.guardianMiddleName, r(2180, 1390, 230, 40), textFont: smallFont);
    drawText(model.guardianMobile, r(2140, 1434, 270, 40), textFont: smallFont);

    // HIGHEST EDUCATIONAL ATTAINMENT – label at Y≈1478. Value area at Y≈1520.
    drawText(model.fatherEducationalAttainment, r(547, 1510, 460, 60), textFont: smallFont);
    drawText(model.motherEducationalAttainment, r(1015, 1510, 480, 60), textFont: smallFont);
    drawText(model.guardianEducationalAttainment, r(1989, 1510, 420, 60), textFont: smallFont);

    // OCCUPATION – label at Y≈1590. Value area at Y≈1600.
    drawText(model.fatherOccupation, r(547, 1600, 460, 55), textFont: smallFont);
    drawText(model.motherOccupation, r(1015, 1600, 480, 55), textFont: smallFont);
    drawText(model.guardianOccupation, r(1989, 1600, 420, 55), textFont: smallFont);

    // COMPANY NAME/ADDRESS – label at Y≈1669. Value area at Y≈1700.
    drawMultiLine(model.fatherCompanyNameAddress, r(547, 1700, 460, 80), textFont: smallFont);
    drawMultiLine(model.motherCompanyNameAddress, r(1015, 1700, 480, 80), textFont: smallFont);
    drawMultiLine(model.guardianCompanyNameAddress, r(1989, 1700, 420, 80), textFont: smallFont);

    // ── Native of Marilao? ───────────────────────────────────────────
    // "Yes, father only" etc. on line Y≈1736. Checkboxes inline.
    // "If NO" line at Y≈1780.
    drawCheck(model.isFatherOnlyNative, r(578, 1742, 20, 20));
    drawCheck(model.isMotherOnlyNative, r(818, 1742, 20, 20));
    drawCheck(model.isBothParentsNative, r(1058, 1742, 20, 20));
    drawCheck(model.isNotNative, r(1250, 1742, 20, 20));
    drawText(model.yearsResident, r(2100, 1736, 310, 40), textFont: smallFont);
    drawText(model.originProvince, r(2050, 1775, 360, 40), textFont: smallFont);

    // ── III. ACADEMIC INFORMATION ────────────────────────────────────
    // Header row labels at Y≈1870. Data rows below.
    // Column Xs: School=599, Address=1055, Honors=1399, Club=1866, YearGrad=2208
    // COLLEGE label at Y≈1918
    drawText(model.collegeSchool, r(420, 1918, 500, 50), textFont: smallFont);
    drawText(model.collegeAddress, r(958, 1918, 435, 50), textFont: smallFont);
    drawText(model.collegeHonors, r(1399, 1918, 460, 50), textFont: smallFont);
    drawText(model.collegeClub, r(1866, 1918, 335, 50), textFont: smallFont);
    drawText(model.collegeYearGraduated, r(2208, 1918, 250, 50), textFont: smallFont);

    // HIGH SCHOOL label at Y≈1985
    drawText(model.highSchoolSchool, r(420, 1985, 500, 50), textFont: smallFont);
    drawText(model.highSchoolAddress, r(958, 1985, 435, 50), textFont: smallFont);
    drawText(model.highSchoolHonors, r(1399, 1985, 460, 50), textFont: smallFont);
    drawText(model.highSchoolClub, r(1866, 1985, 335, 50), textFont: smallFont);
    drawText(model.highSchoolYearGraduated, r(2208, 1985, 250, 50), textFont: smallFont);

    // SENIOR HIGH SCHOOL label at Y≈2054
    drawText(model.seniorHighSchool, r(420, 2054, 500, 50), textFont: smallFont);
    drawText(model.seniorHighAddress, r(958, 2054, 435, 50), textFont: smallFont);
    drawText(model.seniorHighHonors, r(1399, 2054, 460, 50), textFont: smallFont);
    drawText(model.seniorHighClub, r(1866, 2054, 335, 50), textFont: smallFont);
    drawText(model.seniorHighYearGraduated, r(2208, 2054, 250, 50), textFont: smallFont);

    // ELEMENTARY label at Y≈2121
    drawText(model.elementarySchool, r(420, 2121, 500, 50), textFont: smallFont);
    drawText(model.elementaryAddress, r(958, 2121, 435, 50), textFont: smallFont);
    drawText(model.elementaryHonors, r(1399, 2121, 460, 50), textFont: smallFont);
    drawText(model.elementaryClub, r(1866, 2121, 335, 50), textFont: smallFont);
    drawText(model.elementaryYearGraduated, r(2208, 2121, 250, 50), textFont: smallFont);

    // ── Course/Year Level/Section row at Y≈2180 ─────────────────────
    drawText(model.currentYearSection, r(99, 2180, 335, 50), textFont: smallFont);
    drawText(model.studentNumber, r(438, 2180, 465, 50), textFont: smallFont);
    drawText(model.learnersReferenceNumber, r(907, 2180, 460, 50), textFont: smallFont);

    // Financial Support: label at X≈1372, checkboxes inline
    // "Parents" ~X=1570, "Scholarship" ~X=1730, "Loan" ~X=1920, "Other" ~X=2100
    drawCheck(model.supportParents, r(1555, 2185, 20, 20));
    drawCheck(model.supportScholarship, r(1730, 2185, 20, 20));
    drawCheck(model.supportLoan, r(1920, 2185, 20, 20));
    drawCheck(model.supportOther, r(2120, 2185, 20, 20));
    drawText(model.financialSupportOther, r(2260, 2180, 150, 50), textFont: smallFont);

    // ── Scholarship history – label row at Y≈2270 ────────────────────
    // "Yes" checkbox ~X=157, "No" ~X=305
    drawCheck(model.hadScholarship, r(157, 2318, 20, 20));
    drawCheck(model.noScholarshipHistory, r(305, 2318, 20, 20));
    drawMultiLine(model.scholarshipDetails, r(1293, 2270, 1120, 80), textFont: smallFont);

    // ── Disciplinary record – label row at Y≈2362 ───────────────────
    drawCheck(model.hasDisciplinaryRecord, r(157, 2406, 20, 20));
    drawCheck(model.noDisciplinaryRecord, r(305, 2406, 20, 20));
    drawMultiLine(model.disciplinaryDetails, r(1295, 2358, 1120, 55), textFont: smallFont);

    // ── Essays ───────────────────────────────────────────────────────
    // "Write a short essay..." label at Y≈2448. Content area below.
    drawMultiLine(model.selfDescription, r(99, 2490, 2310, 120), textFont: smallFont);
    // "State briefly..." label at Y≈2622. Content area below.
    drawMultiLine(model.aimsAndAmbitions, r(99, 2665, 2310, 130), textFont: smallFont);

    // ── Signatures ───────────────────────────────────────────────────
    // "SIGNATURE OVER PRINTED NAME" label at Y≈2949. Name goes ABOVE at ~Y=2905.
    drawText(model.applicantPrintedName, r(167, 2905, 660, 40), textFont: smallFont);
    drawText(model.printedDate, r(1027, 2905, 180, 40), textFont: smallFont);
    drawText(model.parentGuardianPrintedName, r(1286, 2905, 775, 40), textFont: smallFont);
    drawText(model.printedDate, r(2257, 2905, 150, 40), textFont: smallFont);

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

  Future<File> _generateFallbackPdf(SavedApplicationPrintModel model) async {
    final document = PdfDocument();
    final page = document.pages.add();
    final font = PdfStandardFont(PdfFontFamily.helvetica, 12);
    final boldFont = PdfStandardFont(PdfFontFamily.helvetica, 14, style: PdfFontStyle.bold);
    
    page.graphics.drawString('Scholarship Application (Fallback)', boldFont, bounds: const Rect.fromLTWH(0, 0, 500, 30));
    page.graphics.drawString('Name: ${model.firstName} ${model.lastName}\nCourse: ${model.currentCourse}\nGWA: ${model.gwa}\nStudent ID: ${model.studentNumber}\nEmail: ${model.email}\nMobile: ${model.mobileNumber}\n\nSelf Description:\n${model.selfDescription}\n\nAims and Ambitions:\n${model.aimsAndAmbitions}', font, bounds: const Rect.fromLTWH(0, 40, 500, 700), format: PdfStringFormat(wordWrap: PdfWordWrapType.word));
    
    final bytes = Uint8List.fromList(document.saveSync());
    document.dispose();

    final dir = await _resolveOutputDirectory();
    final file = File('${dir.path}/fallback_scholarship_form.pdf');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }
}
