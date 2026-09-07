import 'dart:io';
import 'dart:ui' show Offset, Rect, Size;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show MissingPluginException, rootBundle;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';

class ScholarshipFormPdfService {
  static const double _imageWidth = 2550;
  static const double _imageHeight = 3900;
  static const String _notAvailable = 'N/A';

  static String _printableValue(String value) {
    final clean = value.trim();
    return clean.isEmpty || clean.toLowerCase() == 'n/a'
        ? _notAvailable
        : clean;
  }

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
    final brush = PdfSolidBrush(blueColor);
    final additionalDetails = <String>[];

    final pageWidth = page.size.width;
    final pageHeight = page.size.height;

    Rect r(double x, double y, double w, double h) {
      return Rect.fromLTWH(
        x * pageWidth / _imageWidth,
        (y >= 1304 && y <= 1434 ? y - 10 : y) * pageHeight / _imageHeight,
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
      final clean = _printableValue(value);
      // PDF text is omitted when even one line cannot fit vertically. Many
      // template cells are only 9–11 points tall, including family names.
      final requestedFont = textFont ?? font;
      final measured = requestedFont.measureString(clean);
      final scale = [
        1.0,
        bounds.width / measured.width,
        (bounds.height - 0.5) / measured.height,
      ].reduce((a, b) => a < b ? a : b);
      if (requestedFont.size * scale < 6 && clean != 'N/A') {
        additionalDetails.add(clean);
        final reference = 'See detail ${additionalDetails.length}';
        page.graphics.drawString(
          reference,
          PdfStandardFont(PdfFontFamily.helvetica, 6),
          brush: brush,
          bounds: bounds,
          format: PdfStringFormat(wordWrap: PdfWordWrapType.none),
        );
        return;
      }
      final fittedFont = PdfStandardFont(
        PdfFontFamily.helvetica,
        requestedFont.size * scale,
      );
      page.graphics.drawString(
        clean,
        fittedFont,
        brush: brush,
        bounds: bounds,
        format: PdfStringFormat(
          alignment: align,
          lineAlignment: PdfVerticalAlignment.middle,
          wordWrap: PdfWordWrapType.none,
        ),
      );
    }

    void drawDateDigits(String value, Rect bounds) {
      final clean = _printableValue(value);
      final digits = clean.replaceAll(RegExp(r'[^0-9]'), '');

      if (digits.length != 8) {
        drawText(
          clean,
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
      final clean = _printableValue(value);

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
      final clean = _printableValue(value);

      PdfFont currentFont = textFont ?? smallFont;
      if (clean.length > 800) {
        currentFont = PdfStandardFont(PdfFontFamily.helvetica, 7.0);
      } else if (clean.length > 500) {
        currentFont = PdfStandardFont(PdfFontFamily.helvetica, 7.5);
      }

      if (currentFont
              .measureString(
                clean,
                layoutArea: Size(bounds.width, 0),
                format: PdfStringFormat(wordWrap: PdfWordWrapType.word),
              )
              .height >
          bounds.height) {
        additionalDetails.add(clean);
        drawText(
          'See detail ${additionalDetails.length} on the attached page.',
          bounds,
          textFont: smallFont,
        );
        return;
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
      final pen = PdfPen(blueColor, width: 1.2);
      final middle = Offset(
        bounds.left + bounds.width * .4,
        bounds.bottom - 1.5,
      );
      page.graphics.drawLine(
        pen,
        Offset(bounds.left + 1.5, bounds.top + bounds.height * .5),
        middle,
      );
      page.graphics.drawLine(
        pen,
        middle,
        Offset(bounds.right - 1.5, bounds.top + 1.5),
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
    // Replace only the inline block/lot/phase entry row so values cannot
    // overlap its printed labels. The permanent-address heading stays intact.
    page.graphics.drawRectangle(
      brush: PdfBrushes.white,
      bounds: const Rect.fromLTWH(24, 261, 135, 10),
    );
    drawText(
      'Block/Lot: ${_printableValue(model.houseLotBlockNo)}  Phase: ${_printableValue(model.phase)}',
      const Rect.fromLTWH(24, 261, 135, 10),
      textFont: smallFont,
    );
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
    drawCheck(
      model.isFatherOnlyNative,
      const Rect.fromLTWH(121.75, 426.02, 12.5, 9.15),
    );
    drawCheck(
      model.isMotherOnlyNative,
      const Rect.fromLTWH(182.85, 426.12, 12.5, 9.15),
    );
    drawCheck(
      model.isBothParentsNative,
      const Rect.fromLTWH(245.55, 426.52, 12.5, 9.15),
    );
    drawCheck(
      model.isNotNative,
      const Rect.fromLTWH(288.05, 426.52, 12.5, 9.15),
    );
    drawText(
      model.yearsResident,
      const Rect.fromLTWH(509, 416, 70, 9),
      textFont: smallFont,
    );
    drawText(
      model.originProvince,
      const Rect.fromLTWH(491, 426, 88, 9),
      textFont: smallFont,
    );

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
    drawCheck(
      model.supportParents,
      const Rect.fromLTWH(407.8, 532.54, 12.5, 9.15),
    );
    drawCheck(
      model.supportScholarship,
      const Rect.fromLTWH(450.75, 532.94, 12.5, 9.15),
    );
    drawCheck(
      model.supportLoan,
      const Rect.fromLTWH(485.2, 532.94, 12.5, 9.15),
    );
    drawFittingText(
      model.supportOther ? model.financialSupportOther : '',
      r(2205, 2230, 250, 55),
      textFont: smallFont,
      minFontSize: 6.0,
    );

    // ── Scholarship history ──────────────────────────────────────────
    // Yes / No plus the four printed scholarship-level checkboxes.
    drawCheck(
      model.hadScholarship,
      const Rect.fromLTWH(26.25, 555.19, 13.75, 8.1),
    );
    drawCheck(
      model.noScholarshipHistory,
      const Rect.fromLTWH(66.95, 555.19, 12.5, 8.1),
    );
    drawCheck(
      model.scholarshipElementary,
      const Rect.fromLTWH(140.8, 555.19, 13.75, 8.1),
    );
    drawCheck(
      model.scholarshipHighSchool,
      const Rect.fromLTWH(183.25, 555.09, 12.5, 8.7),
    );
    drawCheck(
      model.scholarshipCollege,
      const Rect.fromLTWH(222.1, 555.09, 12.5, 8.7),
    );
    drawCheck(
      model.scholarshipOthers,
      const Rect.fromLTWH(255.35, 555.19, 12.5, 8.1),
    );

    final scholarshipHistoryDetails = [
      if (model.scholarshipOthers &&
          model.scholarshipOthersSpecify.trim().isNotEmpty)
        'Other: ${model.scholarshipOthersSpecify.trim()}',
      if (model.scholarshipDetails.trim().isNotEmpty)
        model.scholarshipDetails.trim(),
    ].join(' | ');

    drawFittingText(
      scholarshipHistoryDetails,
      const Rect.fromLTWH(510, 555, 69, 9),
      textFont: smallFont,
      minFontSize: 6.0,
    );

    // ── Disciplinary record ──────────────────────────────────────────
    drawCheck(
      model.hasDisciplinaryRecord,
      const Rect.fromLTWH(29.95, 575.72, 13.75, 8.1),
    );
    drawCheck(
      model.noDisciplinaryRecord,
      const Rect.fromLTWH(66.8, 575.72, 13.75, 8.1),
    );
    drawFittingText(
      model.disciplinaryDetails,
      const Rect.fromLTWH(300, 577, 279, 9),
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

    if (additionalDetails.isNotEmpty) {
      final extraPage = document.pages.add();
      final detailsText = additionalDetails.asMap().entries
          .map((entry) => 'Detail ${entry.key + 1}\n${entry.value}').join('\n\n');
      PdfTextElement(
        text:
            'APPLICATION FORM - ADDITIONAL DETAILS\n${model.applicantPrintedName}\n\n$detailsText',
        font: PdfStandardFont(PdfFontFamily.helvetica, 10),
        brush: brush,
      ).draw(
        page: extraPage,
        bounds: Rect.fromLTWH(
          24,
          24,
          extraPage.size.width - 48,
          extraPage.size.height - 48,
        ),
        format: PdfLayoutFormat(layoutType: PdfLayoutType.paginate),
      );
    }
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
    final applicantName = [
      model.firstName.trim(),
      model.middleName.trim(),
      model.lastName.trim(),
    ].where((part) => part.isNotEmpty).join(' ');

    page.graphics.drawString(
      'Scholarship Application (Fallback)',
      boldFont,
      bounds: const Rect.fromLTWH(0, 0, 500, 30),
    );
    page.graphics.drawString(
      'Name: ${_printableValue(applicantName)}\nCourse: ${_printableValue(model.currentCourse)}\nGWA: ${_printableValue(model.gwa)}\nStudent ID: ${_printableValue(model.studentNumber)}\nEmail: ${_printableValue(model.email)}\nMobile: ${_printableValue(model.mobileNumber)}\n\nSelf Description:\n${_printableValue(model.selfDescription)}\n\nAims and Ambitions:\n${_printableValue(model.aimsAndAmbitions)}',
      font,
      bounds: const Rect.fromLTWH(0, 40, 500, 700),
      format: PdfStringFormat(wordWrap: PdfWordWrapType.word),
    );

    final bytes = Uint8List.fromList(document.saveSync());
    document.dispose();
    return bytes;
  }
}
