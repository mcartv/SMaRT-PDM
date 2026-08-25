import 'dart:io';
import 'dart:typed_data';
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

  Future<Uint8List> generateBytesFromSavedApplication(
    SavedApplicationPrintModel model,
  ) async {
    ByteData templateBytes;
    try {
      templateBytes = await rootBundle.load(
        'assets/files/scholarship_app_form.pdf',
      );
    } catch (e) {
      return _generateFallbackPdfBytes(model);
    }

    final document = PdfDocument(
      inputBytes: templateBytes.buffer.asUint8List(),
    );

    final page = document.pages[0];

    // Blue ink – matches the "blue ink" instruction on the form.
    // The heading "OFFICE FOR SCHOLARSHIP AND FINANCIAL ASSISTANCE" renders
    // at ~9.5 pt on a 612-pt wide page, so we match that size here.
    final blueColor = PdfColor(0, 70, 180);
    final font = PdfStandardFont(PdfFontFamily.helvetica, 9.5);
    final smallFont = PdfStandardFont(PdfFontFamily.helvetica, 8.5);
    final boldFont = PdfStandardFont(
      PdfFontFamily.helvetica,
      9.5,
      style: PdfFontStyle.bold,
    );
    final brush = PdfSolidBrush(blueColor);

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
        brush: brush,
        bounds: bounds,
        format: PdfStringFormat(
          alignment: align,
          lineAlignment: PdfVerticalAlignment.middle,
        ),
      );
    }

    void drawDateDigits(String value, Rect bounds) {
      final digits = value.replaceAll(RegExp(r'[^0-9]'), '');

      if (digits.length != 8) {
        drawText(
          value,
          bounds,
          textFont: smallFont,
          align: PdfTextAlignment.center,
        );
        return;
      }

      final cellWidth = bounds.width / 8;

      for (var index = 0; index < digits.length; index += 1) {
        drawText(
          digits[index],
          Rect.fromLTWH(
            bounds.left + (cellWidth * index),
            bounds.top,
            cellWidth,
            bounds.height,
          ),
          textFont: smallFont,
          align: PdfTextAlignment.center,
        );
      }
    }

    void drawFittingText(
      String value,
      Rect bounds, {
      PdfFont? textFont,
      PdfTextAlignment align = PdfTextAlignment.left,
      double minFontSize = 6.5,
    }) {
      final clean = value.trim();
      if (clean.isEmpty) return;

      PdfFont currentFont = textFont ?? font;
      if (currentFont.measureString(clean).width <= bounds.width) {
        drawText(clean, bounds, textFont: currentFont, align: align);
        return;
      }

      final family = currentFont is PdfStandardFont
          ? currentFont.fontFamily
          : PdfFontFamily.helvetica;
      final style = currentFont is PdfStandardFont
          ? currentFont.style
          : PdfFontStyle.regular;

      for (var size = currentFont.size; size >= minFontSize; size -= 0.5) {
        final candidate = PdfStandardFont(family, size, style: style);
        if (candidate.measureString(clean).width <= bounds.width) {
          drawText(clean, bounds, textFont: candidate, align: align);
          return;
        }
      }

      drawText(
        clean,
        bounds,
        textFont: PdfStandardFont(family, minFontSize, style: style),
        align: align,
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
    // DOB: draw one digit per printed box instead of relying on spaces.
    drawDateDigits(model.dateOfBirth, r(253, 970, 420, 55));
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
    drawMultiLine(model.parentGuardianAddress, r(99, 1310, 410, 190));

    // Family name sub-rows: label text like "Last Name___" is at the given Y.
    // The value goes AFTER the label text, so X is shifted right past the label width.
    // Father col labels at X=547, label width ~190 → values at X≈740
    // Mother col labels at X=1015, label width ~190 → values at X≈1205
    // Sibling col labels at X=1501, label width ~190 → values at X≈1695
    // Guardian col labels at X=1989, label width ~190 → values at X≈2180
    // Row Ys: LastName=1304, FirstName=1347, MiddleName=1390, Mobile=1434
    drawFittingText(
      model.fatherLastName,
      r(740, 1304, 270, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.fatherFirstName,
      r(740, 1347, 270, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.fatherMiddleName,
      r(740, 1390, 270, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.fatherMobile,
      r(700, 1434, 310, 40),
      textFont: smallFont,
    );

    drawFittingText(
      model.motherLastName,
      r(1205, 1304, 290, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.motherFirstName,
      r(1205, 1347, 290, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.motherMiddleName,
      r(1205, 1390, 290, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.motherMobile,
      r(1165, 1434, 330, 40),
      textFont: smallFont,
    );

    drawFittingText(
      model.siblingLastName,
      r(1695, 1304, 290, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.siblingFirstName,
      r(1695, 1347, 290, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.siblingMiddleName,
      r(1695, 1390, 290, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.siblingMobile,
      r(1655, 1434, 330, 40),
      textFont: smallFont,
    );

    drawFittingText(
      model.guardianLastName,
      r(2180, 1304, 230, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.guardianFirstName,
      r(2180, 1347, 230, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.guardianMiddleName,
      r(2180, 1390, 230, 40),
      textFont: smallFont,
    );
    drawFittingText(
      model.guardianMobile,
      r(2140, 1434, 270, 40),
      textFont: smallFont,
    );

    // HIGHEST EDUCATIONAL ATTAINMENT – label at Y≈1478. Value area at Y≈1520.
    drawText(
      model.fatherEducationalAttainment,
      r(547, 1510, 460, 60),
      textFont: smallFont,
    );
    drawText(
      model.motherEducationalAttainment,
      r(1015, 1510, 480, 60),
      textFont: smallFont,
    );
    drawText(
      model.siblingEducationalAttainment,
      r(1501, 1510, 480, 60),
      textFont: smallFont,
    );
    drawText(
      model.guardianEducationalAttainment,
      r(1989, 1510, 420, 60),
      textFont: smallFont,
    );

    // OCCUPATION – label at Y≈1590. Value area at Y≈1600.
    drawText(
      model.fatherOccupation,
      r(547, 1600, 460, 55),
      textFont: smallFont,
    );
    drawText(
      model.motherOccupation,
      r(1015, 1600, 480, 55),
      textFont: smallFont,
    );
    drawText(
      model.siblingOccupation,
      r(1501, 1600, 480, 55),
      textFont: smallFont,
    );
    drawText(
      model.guardianOccupation,
      r(1989, 1600, 420, 55),
      textFont: smallFont,
    );

    // COMPANY NAME/ADDRESS – label at Y≈1669. Value area at Y≈1700.
    drawMultiLine(
      model.fatherCompanyNameAddress,
      r(547, 1700, 460, 80),
      textFont: smallFont,
    );
    drawMultiLine(
      model.motherCompanyNameAddress,
      r(1015, 1700, 480, 80),
      textFont: smallFont,
    );
    drawMultiLine(
      model.siblingCompanyNameAddress,
      r(1501, 1700, 480, 80),
      textFont: smallFont,
    );
    drawMultiLine(
      model.guardianCompanyNameAddress,
      r(1989, 1700, 420, 80),
      textFont: smallFont,
    );

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
    drawFittingText(
      model.collegeSchool,
      r(420, 1918, 455, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.collegeAddress,
      r(895, 1918, 445, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.collegeHonors,
      r(1360, 1918, 455, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.collegeClub,
      r(1835, 1918, 350, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.collegeYearGraduated,
      r(2205, 1918, 220, 50),
      textFont: smallFont,
      align: PdfTextAlignment.center,
    );

    // HIGH SCHOOL label at Y≈1985
    drawFittingText(
      model.highSchoolSchool,
      r(420, 1985, 455, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.highSchoolAddress,
      r(895, 1985, 445, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.highSchoolHonors,
      r(1360, 1985, 455, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.highSchoolClub,
      r(1835, 1985, 350, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.highSchoolYearGraduated,
      r(2205, 1985, 220, 50),
      textFont: smallFont,
      align: PdfTextAlignment.center,
    );

    // SENIOR HIGH SCHOOL label at Y≈2054
    drawFittingText(
      model.seniorHighSchool,
      r(420, 2054, 455, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.seniorHighAddress,
      r(895, 2054, 445, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.seniorHighHonors,
      r(1360, 2054, 455, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.seniorHighClub,
      r(1835, 2054, 350, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.seniorHighYearGraduated,
      r(2205, 2054, 220, 50),
      textFont: smallFont,
      align: PdfTextAlignment.center,
    );

    // ELEMENTARY label at Y≈2121
    drawFittingText(
      model.elementarySchool,
      r(420, 2121, 455, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.elementaryAddress,
      r(895, 2121, 445, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.elementaryHonors,
      r(1360, 2121, 455, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.elementaryClub,
      r(1835, 2121, 350, 50),
      textFont: smallFont,
    );
    drawFittingText(
      model.elementaryYearGraduated,
      r(2205, 2121, 220, 50),
      textFont: smallFont,
      align: PdfTextAlignment.center,
    );

    // ── Current enrollment / support row ─────────────────────────────
    // The printed row has three compact academic cells followed by the
    // Financial Support options. Keep values below the printed labels.
    final currentEnrollment = [
      model.currentCourse.trim(),
      model.currentYearSection.trim(),
    ].where((value) => value.isNotEmpty).join(' / ');

    drawFittingText(
      currentEnrollment,
      r(80, 2230, 325, 55),
      textFont: smallFont,
      align: PdfTextAlignment.center,
      minFontSize: 6.0,
    );
    drawFittingText(
      model.studentNumber,
      r(420, 2230, 445, 55),
      textFont: smallFont,
      align: PdfTextAlignment.center,
      minFontSize: 6.0,
    );
    drawFittingText(
      model.learnersReferenceNumber,
      r(890, 2230, 445, 55),
      textFont: smallFont,
      align: PdfTextAlignment.center,
      minFontSize: 6.0,
    );

    // Financial Support checkboxes are aligned to the printed Parents,
    // Scholarship and Loan boxes. "Other, specify" is an underline, not
    // a separate checkbox on the template.
    drawCheck(model.supportParents, r(1755, 2238, 28, 28));
    drawCheck(model.supportScholarship, r(1938, 2238, 28, 28));
    drawCheck(model.supportLoan, r(2085, 2238, 28, 28));
    drawFittingText(
      model.supportOther ? model.financialSupportOther : '',
      r(2205, 2230, 250, 55),
      textFont: smallFont,
      minFontSize: 6.0,
    );

    // ── Scholarship history ──────────────────────────────────────────
    // Yes / No plus the four printed scholarship-level checkboxes.
    drawCheck(model.hadScholarship, r(157, 2342, 24, 24));
    drawCheck(model.noScholarshipHistory, r(305, 2342, 24, 24));
    drawCheck(model.scholarshipElementary, r(610, 2342, 24, 24));
    drawCheck(model.scholarshipHighSchool, r(795, 2342, 24, 24));
    drawCheck(model.scholarshipCollege, r(960, 2342, 24, 24));
    drawCheck(model.scholarshipOthers, r(1110, 2342, 24, 24));

    final scholarshipHistoryDetails = [
      if (model.scholarshipOthers &&
          model.scholarshipOthersSpecify.trim().isNotEmpty)
        'Other: ${model.scholarshipOthersSpecify.trim()}',
      if (model.scholarshipDetails.trim().isNotEmpty)
        model.scholarshipDetails.trim(),
    ].join(' | ');

    drawFittingText(
      scholarshipHistoryDetails,
      r(1300, 2360, 1090, 32),
      textFont: smallFont,
      minFontSize: 6.0,
    );

    // ── Disciplinary record ──────────────────────────────────────────
    drawCheck(model.hasDisciplinaryRecord, r(157, 2435, 24, 24));
    drawCheck(model.noDisciplinaryRecord, r(305, 2435, 24, 24));
    drawFittingText(
      model.disciplinaryDetails,
      r(1340, 2450, 1050, 32),
      textFont: smallFont,
      minFontSize: 6.0,
    );

    // ── Essays ───────────────────────────────────────────────────────
    // "Write a short essay..." label at Y≈2448. Content area below.
    drawMultiLine(
      model.selfDescription,
      r(99, 2490, 2310, 120),
      textFont: smallFont,
    );
    // "State briefly..." label at Y≈2622. Content area below.
    drawMultiLine(
      model.aimsAndAmbitions,
      r(99, 2665, 2310, 130),
      textFont: smallFont,
    );

    // ── Signatures ───────────────────────────────────────────────────
    // Printed names/dates stay inside the signature row and shrink if needed.
    drawFittingText(
      model.applicantPrintedName,
      r(90, 2905, 800, 45),
      textFont: smallFont,
      align: PdfTextAlignment.center,
      minFontSize: 6.0,
    );
    drawFittingText(
      model.printedDate,
      r(960, 2905, 260, 45),
      textFont: smallFont,
      align: PdfTextAlignment.center,
    );
    drawFittingText(
      model.parentGuardianPrintedName,
      r(1250, 2905, 930, 45),
      textFont: smallFont,
      align: PdfTextAlignment.center,
      minFontSize: 6.0,
    );
    drawFittingText(
      model.printedDate,
      r(2220, 2905, 260, 45),
      textFont: smallFont,
      align: PdfTextAlignment.center,
    );

    final bytes = Uint8List.fromList(document.saveSync());
    document.dispose();
    return bytes;
  }

  Future<File> generateFromSavedApplication(
    SavedApplicationPrintModel model,
  ) async {
    final bytes = await generateBytesFromSavedApplication(model);
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

  Future<Uint8List> _generateFallbackPdfBytes(
    SavedApplicationPrintModel model,
  ) async {
    final document = PdfDocument();
    final page = document.pages.add();
    final font = PdfStandardFont(PdfFontFamily.helvetica, 12);
    final boldFont = PdfStandardFont(
      PdfFontFamily.helvetica,
      14,
      style: PdfFontStyle.bold,
    );

    page.graphics.drawString(
      'Scholarship Application (Fallback)',
      boldFont,
      bounds: const Rect.fromLTWH(0, 0, 500, 30),
    );
    page.graphics.drawString(
      'Name: ${model.firstName} ${model.lastName}\nCourse: ${model.currentCourse}\nGWA: ${model.gwa}\nStudent ID: ${model.studentNumber}\nEmail: ${model.email}\nMobile: ${model.mobileNumber}\n\nSelf Description:\n${model.selfDescription}\n\nAims and Ambitions:\n${model.aimsAndAmbitions}',
      font,
      bounds: const Rect.fromLTWH(0, 40, 500, 700),
      format: PdfStringFormat(wordWrap: PdfWordWrapType.word),
    );

    final bytes = Uint8List.fromList(document.saveSync());
    document.dispose();
    return bytes;
  }

  Future<File> _generateFallbackPdf(SavedApplicationPrintModel model) async {
    final bytes = await _generateFallbackPdfBytes(model);
    final dir = await _resolveOutputDirectory();
    final file = File('${dir.path}/fallback_scholarship_form.pdf');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }
}
