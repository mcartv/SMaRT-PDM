#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MODEL_PATCHES = [{"label": "print model scholarship history constructor fields", "old": "    required this.hadScholarship,\n    required this.noScholarshipHistory,\n    required this.scholarshipDetails,", "new": "    required this.hadScholarship,\n    required this.noScholarshipHistory,\n    this.scholarshipElementary = false,\n    this.scholarshipHighSchool = false,\n    this.scholarshipCollege = false,\n    this.scholarshipOthers = false,\n    this.scholarshipOthersSpecify = '',\n    required this.scholarshipDetails,"}, {"label": "print model scholarship history field declarations", "old": "  final bool hadScholarship;\n  final bool noScholarshipHistory;\n  final String scholarshipDetails;", "new": "  final bool hadScholarship;\n  final bool noScholarshipHistory;\n  final bool scholarshipElementary;\n  final bool scholarshipHighSchool;\n  final bool scholarshipCollege;\n  final bool scholarshipOthers;\n  final String scholarshipOthersSpecify;\n  final String scholarshipDetails;"}, {"label": "API scholarship level mapping", "old": "      hadScholarship: profile['has_prior_scholarship'] == true,\n      noScholarshipHistory: profile['has_prior_scholarship'] != true,\n      scholarshipDetails: _string(profile['prior_scholarship_details']),", "new": "      hadScholarship: profile['has_prior_scholarship'] == true,\n      noScholarshipHistory: profile['has_prior_scholarship'] != true,\n      scholarshipElementary: _boolValue(\n        profile['scholarship_elementary'],\n      ),\n      scholarshipHighSchool: _boolValue(\n        profile['scholarship_high_school'],\n      ),\n      scholarshipCollege: _boolValue(\n        profile['scholarship_college'],\n      ),\n      scholarshipOthers: _boolValue(\n        profile['scholarship_others'],\n      ),\n      scholarshipOthersSpecify: _string(\n        profile['scholarship_others_specify'],\n      ),\n      scholarshipDetails: _string(profile['prior_scholarship_details']),"}, {"label": "saved form financial support other mapping", "old": "      financialSupportOther: _firstNonEmpty([\n        _string(support['financial_support_other']),\n        _string(support['scholarship_others_specify']),\n      ]),", "new": "      financialSupportOther: _firstNonEmpty([\n        _string(support['financial_support_other']),\n        financialSupport.toLowerCase() == 'other'\n            ? _string(support['scholarship_others_specify'])\n            : '',\n      ]),"}, {"label": "saved form scholarship level mapping", "old": "      hadScholarship: hasPriorScholarship,\n      noScholarshipHistory: !hasPriorScholarship,\n      scholarshipDetails: _firstNonEmpty([", "new": "      hadScholarship: hasPriorScholarship,\n      noScholarshipHistory: !hasPriorScholarship,\n      scholarshipElementary: _boolValue(\n        support['scholarship_elementary'],\n      ),\n      scholarshipHighSchool: _boolValue(\n        support['scholarship_high_school'],\n      ),\n      scholarshipCollege: _boolValue(\n        support['scholarship_college'],\n      ),\n      scholarshipOthers: _boolValue(\n        support['scholarship_others'],\n      ),\n      scholarshipOthersSpecify: _string(\n        support['scholarship_others_specify'],\n      ),\n      scholarshipDetails: _firstNonEmpty(["}];
const PDF_PATCHES = [{"label": "parent/guardian address bounds", "old": "    drawMultiLine(model.parentGuardianAddress, r(99, 1310, 440, 200));", "new": "    drawMultiLine(model.parentGuardianAddress, r(99, 1310, 410, 190));"}, {"label": "college school fitting", "old": "    drawText(model.collegeSchool, r(420, 1918, 500, 50), textFont: smallFont);", "new": "    drawFittingText(\n      model.collegeSchool,\n      r(420, 1918, 455, 50),\n      textFont: smallFont,\n    );"}, {"label": "college address fitting", "old": "    drawText(model.collegeAddress, r(958, 1918, 435, 50), textFont: smallFont);", "new": "    drawFittingText(\n      model.collegeAddress,\n      r(895, 1918, 445, 50),\n      textFont: smallFont,\n    );"}, {"label": "college honors fitting", "old": "    drawText(model.collegeHonors, r(1399, 1918, 460, 50), textFont: smallFont);", "new": "    drawFittingText(\n      model.collegeHonors,\n      r(1360, 1918, 455, 50),\n      textFont: smallFont,\n    );"}, {"label": "college club fitting", "old": "    drawText(model.collegeClub, r(1866, 1918, 335, 50), textFont: smallFont);", "new": "    drawFittingText(\n      model.collegeClub,\n      r(1835, 1918, 350, 50),\n      textFont: smallFont,\n    );"}, {"label": "college year fitting", "old": "    drawText(\n      model.collegeYearGraduated,\n      r(2208, 1918, 250, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.collegeYearGraduated,\n      r(2205, 1918, 220, 50),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n    );"}, {"label": "high school school fitting", "old": "    drawText(\n      model.highSchoolSchool,\n      r(420, 1985, 500, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.highSchoolSchool,\n      r(420, 1985, 455, 50),\n      textFont: smallFont,\n    );"}, {"label": "high school address fitting", "old": "    drawText(\n      model.highSchoolAddress,\n      r(958, 1985, 435, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.highSchoolAddress,\n      r(895, 1985, 445, 50),\n      textFont: smallFont,\n    );"}, {"label": "high school honors fitting", "old": "    drawText(\n      model.highSchoolHonors,\n      r(1399, 1985, 460, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.highSchoolHonors,\n      r(1360, 1985, 455, 50),\n      textFont: smallFont,\n    );"}, {"label": "high school club fitting", "old": "    drawText(model.highSchoolClub, r(1866, 1985, 335, 50), textFont: smallFont);", "new": "    drawFittingText(\n      model.highSchoolClub,\n      r(1835, 1985, 350, 50),\n      textFont: smallFont,\n    );"}, {"label": "high school year fitting", "old": "    drawText(\n      model.highSchoolYearGraduated,\n      r(2208, 1985, 250, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.highSchoolYearGraduated,\n      r(2205, 1985, 220, 50),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n    );"}, {"label": "senior high school fitting", "old": "    drawText(\n      model.seniorHighSchool,\n      r(420, 2054, 500, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.seniorHighSchool,\n      r(420, 2054, 455, 50),\n      textFont: smallFont,\n    );"}, {"label": "senior high address fitting", "old": "    drawText(\n      model.seniorHighAddress,\n      r(958, 2054, 435, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.seniorHighAddress,\n      r(895, 2054, 445, 50),\n      textFont: smallFont,\n    );"}, {"label": "senior high honors fitting", "old": "    drawText(\n      model.seniorHighHonors,\n      r(1399, 2054, 460, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.seniorHighHonors,\n      r(1360, 2054, 455, 50),\n      textFont: smallFont,\n    );"}, {"label": "senior high club fitting", "old": "    drawText(model.seniorHighClub, r(1866, 2054, 335, 50), textFont: smallFont);", "new": "    drawFittingText(\n      model.seniorHighClub,\n      r(1835, 2054, 350, 50),\n      textFont: smallFont,\n    );"}, {"label": "senior high year fitting", "old": "    drawText(\n      model.seniorHighYearGraduated,\n      r(2208, 2054, 250, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.seniorHighYearGraduated,\n      r(2205, 2054, 220, 50),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n    );"}, {"label": "elementary school fitting", "old": "    drawText(\n      model.elementarySchool,\n      r(420, 2121, 500, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.elementarySchool,\n      r(420, 2121, 455, 50),\n      textFont: smallFont,\n    );"}, {"label": "elementary address fitting", "old": "    drawText(\n      model.elementaryAddress,\n      r(958, 2121, 435, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.elementaryAddress,\n      r(895, 2121, 445, 50),\n      textFont: smallFont,\n    );"}, {"label": "elementary honors fitting", "old": "    drawText(\n      model.elementaryHonors,\n      r(1399, 2121, 460, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.elementaryHonors,\n      r(1360, 2121, 455, 50),\n      textFont: smallFont,\n    );"}, {"label": "elementary club fitting", "old": "    drawText(model.elementaryClub, r(1866, 2121, 335, 50), textFont: smallFont);", "new": "    drawFittingText(\n      model.elementaryClub,\n      r(1835, 2121, 350, 50),\n      textFont: smallFont,\n    );"}, {"label": "elementary year fitting", "old": "    drawText(\n      model.elementaryYearGraduated,\n      r(2208, 2121, 250, 50),\n      textFont: smallFont,\n    );", "new": "    drawFittingText(\n      model.elementaryYearGraduated,\n      r(2205, 2121, 220, 50),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n    );"}];
const OLD_ENROLLMENT_BLOCK = "    // \u2500\u2500 Course/Year Level/Section row at Y\u22482180 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    drawFittingText(\n      model.currentCourse,\n      r(99, 2180, 250, 50),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n    );\n    drawFittingText(\n      model.currentYearSection,\n      r(355, 2180, 360, 50),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n    );\n    drawFittingText(\n      model.studentNumber,\n      r(721, 2180, 300, 50),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n    );\n    drawFittingText(\n      model.learnersReferenceNumber,\n      r(1027, 2180, 340, 50),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n    );\n\n    // Financial Support: label at X\u22481372, checkboxes inline\n    // \"Parents\" ~X=1570, \"Scholarship\" ~X=1730, \"Loan\" ~X=1920, \"Other\" ~X=2100\n    drawCheck(model.supportParents, r(1555, 2185, 20, 20));\n    drawCheck(model.supportScholarship, r(1730, 2185, 20, 20));\n    drawCheck(model.supportLoan, r(1920, 2185, 20, 20));\n    drawCheck(model.supportOther, r(2120, 2185, 20, 20));\n    drawText(\n      model.financialSupportOther,\n      r(2260, 2180, 150, 50),\n      textFont: smallFont,\n    );";
const NEW_ENROLLMENT_BLOCK = "    // \u2500\u2500 Current enrollment / support row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    // The printed row has three compact academic cells followed by the\n    // Financial Support options. Keep values below the printed labels.\n    final currentEnrollment = [\n      model.currentCourse.trim(),\n      model.currentYearSection.trim(),\n    ].where((value) => value.isNotEmpty).join(' / ');\n\n    drawFittingText(\n      currentEnrollment,\n      r(80, 2230, 325, 55),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n      minFontSize: 6.0,\n    );\n    drawFittingText(\n      model.studentNumber,\n      r(420, 2230, 445, 55),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n      minFontSize: 6.0,\n    );\n    drawFittingText(\n      model.learnersReferenceNumber,\n      r(890, 2230, 445, 55),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n      minFontSize: 6.0,\n    );\n\n    // Financial Support checkboxes are aligned to the printed Parents,\n    // Scholarship and Loan boxes. \"Other, specify\" is an underline, not\n    // a separate checkbox on the template.\n    drawCheck(model.supportParents, r(1755, 2238, 28, 28));\n    drawCheck(model.supportScholarship, r(1938, 2238, 28, 28));\n    drawCheck(model.supportLoan, r(2085, 2238, 28, 28));\n    drawFittingText(\n      model.supportOther ? model.financialSupportOther : '',\n      r(2205, 2230, 250, 55),\n      textFont: smallFont,\n      minFontSize: 6.0,\n    );";
const OLD_HISTORY_BLOCK = "    // \u2500\u2500 Scholarship history \u2013 label row at Y\u22482270 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    // \"Yes\" checkbox ~X=157, \"No\" ~X=305\n    drawCheck(model.hadScholarship, r(157, 2318, 20, 20));\n    drawCheck(model.noScholarshipHistory, r(305, 2318, 20, 20));\n    drawMultiLine(\n      model.scholarshipDetails,\n      r(1293, 2270, 1120, 80),\n      textFont: smallFont,\n    );\n\n    // \u2500\u2500 Disciplinary record \u2013 label row at Y\u22482362 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    drawCheck(model.hasDisciplinaryRecord, r(157, 2406, 20, 20));\n    drawCheck(model.noDisciplinaryRecord, r(305, 2406, 20, 20));\n    drawMultiLine(\n      model.disciplinaryDetails,\n      r(1295, 2362, 1120, 70),\n      textFont: smallFont,\n    );";
const NEW_HISTORY_BLOCK = "    // \u2500\u2500 Scholarship history \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    // Yes / No plus the four printed scholarship-level checkboxes.\n    drawCheck(model.hadScholarship, r(157, 2342, 24, 24));\n    drawCheck(model.noScholarshipHistory, r(305, 2342, 24, 24));\n    drawCheck(model.scholarshipElementary, r(610, 2342, 24, 24));\n    drawCheck(model.scholarshipHighSchool, r(795, 2342, 24, 24));\n    drawCheck(model.scholarshipCollege, r(960, 2342, 24, 24));\n    drawCheck(model.scholarshipOthers, r(1110, 2342, 24, 24));\n\n    final scholarshipHistoryDetails = [\n      if (model.scholarshipOthers &&\n          model.scholarshipOthersSpecify.trim().isNotEmpty)\n        'Other: ${model.scholarshipOthersSpecify.trim()}',\n      if (model.scholarshipDetails.trim().isNotEmpty)\n        model.scholarshipDetails.trim(),\n    ].join(' | ');\n\n    drawFittingText(\n      scholarshipHistoryDetails,\n      r(1300, 2360, 1090, 32),\n      textFont: smallFont,\n      minFontSize: 6.0,\n    );\n\n    // \u2500\u2500 Disciplinary record \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    drawCheck(model.hasDisciplinaryRecord, r(157, 2435, 24, 24));\n    drawCheck(model.noDisciplinaryRecord, r(305, 2435, 24, 24));\n    drawFittingText(\n      model.disciplinaryDetails,\n      r(1340, 2450, 1050, 32),\n      textFont: smallFont,\n      minFontSize: 6.0,\n    );";
const OLD_SIGNATURE_BLOCK = "    // \u2500\u2500 Signatures \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    // \"SIGNATURE OVER PRINTED NAME\" label at Y\u22482949. Name goes ABOVE at ~Y=2905.\n    drawText(\n      model.applicantPrintedName,\n      r(167, 2905, 660, 40),\n      textFont: smallFont,\n    );\n    drawText(model.printedDate, r(1027, 2905, 180, 40), textFont: smallFont);\n    drawText(\n      model.parentGuardianPrintedName,\n      r(1286, 2905, 775, 40),\n      textFont: smallFont,\n    );\n    drawText(model.printedDate, r(2257, 2905, 150, 40), textFont: smallFont);";
const NEW_SIGNATURE_BLOCK = "    // \u2500\u2500 Signatures \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    // Printed names/dates stay inside the signature row and shrink if needed.\n    drawFittingText(\n      model.applicantPrintedName,\n      r(90, 2905, 800, 45),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n      minFontSize: 6.0,\n    );\n    drawFittingText(\n      model.printedDate,\n      r(960, 2905, 260, 45),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n    );\n    drawFittingText(\n      model.parentGuardianPrintedName,\n      r(1250, 2905, 930, 45),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n      minFontSize: 6.0,\n    );\n    drawFittingText(\n      model.printedDate,\n      r(2220, 2905, 260, 45),\n      textFont: smallFont,\n      align: PdfTextAlignment.center,\n    );";
const NEW_GENERATE_FILE_WRAPPER = "  Future<File> generateFromSavedApplication(\n    SavedApplicationPrintModel model,\n  ) async {\n    final bytes = await generateBytesFromSavedApplication(model);\n    final dir = await _resolveOutputDirectory();\n    final file = File('${dir.path}/filled_scholarship_form.pdf');\n    await file.writeAsBytes(bytes, flush: true);\n    return file;\n  }\n\n";
const NEW_FALLBACK_WRAPPER = "  Future<File> _generateFallbackPdf(SavedApplicationPrintModel model) async {\n    final bytes = await _generateFallbackPdfBytes(model);\n    final dir = await _resolveOutputDirectory();\n    final file = File('${dir.path}/fallback_scholarship_form.pdf');\n    await file.writeAsBytes(bytes, flush: true);\n    return file;\n  }\n";
const LAYOUT_TEST = "import 'dart:io';\n\nimport 'package:flutter_test/flutter_test.dart';\nimport 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';\n\nvoid main() {\n  test('scholarship-level selections are retained for PDF rendering', () {\n    final model = SavedApplicationPrintModel.fromSavedFormData({\n      'support': {\n        'financial_support': 'Parents',\n        'scholarship_history': true,\n        'scholarship_elementary': true,\n        'scholarship_high_school': true,\n        'scholarship_college': false,\n        'scholarship_others': true,\n        'scholarship_others_specify': 'Private foundation',\n        'scholarship_details': 'Previous scholarship details',\n      },\n    });\n\n    expect(model.hadScholarship, true);\n    expect(model.scholarshipElementary, true);\n    expect(model.scholarshipHighSchool, true);\n    expect(model.scholarshipCollege, false);\n    expect(model.scholarshipOthers, true);\n    expect(model.scholarshipOthersSpecify, 'Private foundation');\n  });\n\n  test('PDF template uses calibrated academic/support coordinates', () {\n    final source = File(\n      'lib/features/forms/data/services/scholarship_form_pdf_service.dart',\n    ).readAsStringSync();\n\n    expect(source, contains('final currentEnrollment = ['));\n    expect(source, contains('r(80, 2230, 325, 55)'));\n    expect(source, contains('r(420, 2230, 445, 55)'));\n    expect(source, contains('r(890, 2230, 445, 55)'));\n\n    expect(source, contains('r(1755, 2238, 28, 28)'));\n    expect(source, contains('r(1938, 2238, 28, 28)'));\n    expect(source, contains('r(2085, 2238, 28, 28)'));\n    expect(source, isNot(contains('drawCheck(model.supportOther')));\n\n    expect(source, contains('drawCheck(model.scholarshipElementary'));\n    expect(source, contains('drawCheck(model.scholarshipHighSchool'));\n    expect(source, contains('drawCheck(model.scholarshipCollege'));\n    expect(source, contains('drawCheck(model.scholarshipOthers'));\n\n    expect(\n      'III. ACADEMIC INFORMATION'.allMatches(source).length,\n      1,\n      reason: 'The template renderer should have one coordinate source of truth.',\n    );\n  });\n\n  test('file export reuses the byte renderer', () {\n    final source = File(\n      'lib/features/forms/data/services/scholarship_form_pdf_service.dart',\n    ).readAsStringSync();\n\n    final fileMethod = source.indexOf(\n      'Future<File> generateFromSavedApplication(',\n    );\n    final openMethod = source.indexOf(\n      'Future<void> openGeneratedPdf(',\n    );\n\n    expect(fileMethod, greaterThanOrEqualTo(0));\n    expect(openMethod, greaterThan(fileMethod));\n\n    final body = source.substring(fileMethod, openMethod);\n    expect(body, contains('generateBytesFromSavedApplication(model)'));\n    expect(body, isNot(contains('PdfDocument(')));\n  });\n}\n";

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);

  while (true) {
    const required = [
      path.join(
        dir,
        'mobile',
        'frontend',
        'lib',
        'features',
        'forms',
        'data',
        'services',
        'scholarship_form_pdf_service.dart'
      ),
      path.join(
        dir,
        'mobile',
        'frontend',
        'lib',
        'shared',
        'models',
        'saved_application_print_model.dart'
      ),
    ];

    if (required.every((file) => fs.existsSync(file))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not find SMaRT-PDM repository root. Run this from D:\\projects\\SMaRT-PDM.'
  );
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

function restoreLineEndings(text, useCrlf) {
  return useCrlf ? text.replace(/\n/g, '\r\n') : text;
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  return text.split(needle).length - 1;
}

function replaceExact(source, oldText, newText, label) {
  if (source.includes(newText)) return source;

  const count = countOccurrences(source, oldText);

  if (count !== 1) {
    throw new Error(
      `Preflight failed for ${label}: expected exactly one source match, found ${count}. No project files were written.`
    );
  }

  return source.replace(oldText, newText);
}

function applyPatchList(source, patches) {
  let next = source;
  for (const patch of patches) {
    next = replaceExact(next, patch.old, patch.new, patch.label);
  }
  return next;
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;

  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}.`);
  }
}

function writeFilePreservingEol(file, text, useCrlf) {
  fs.writeFileSync(
    file,
    restoreLineEndings(text, useCrlf),
    'utf8'
  );
}

function collectBackupFiles(root) {
  const excludedDirs = new Set([
    '.git',
    'node_modules',
    '.dart_tool',
    'build',
    'dist',
    '.idea',
  ]);

  const matchesBackupName = (name) => {
    const lower = name.toLowerCase();

    return (
      lower.includes('.bak-') ||
      lower.includes('.backup-') ||
      lower.includes('.before-') ||
      lower.endsWith('.bak') ||
      lower.endsWith('.backup')
    );
  };

  const found = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && excludedDirs.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && matchesBackupName(entry.name)) {
        found.push(fullPath);
      }
    }
  }

  walk(root);
  return found.sort();
}

const repo = findRepoRoot(process.cwd());
const frontend = path.join(repo, 'mobile', 'frontend');

const files = {
  model: path.join(
    frontend,
    'lib',
    'shared',
    'models',
    'saved_application_print_model.dart'
  ),
  pdf: path.join(
    frontend,
    'lib',
    'features',
    'forms',
    'data',
    'services',
    'scholarship_form_pdf_service.dart'
  ),
  exportTest: path.join(
    frontend,
    'test',
    'pdf_export_mapping_regression_test.dart'
  ),
  layoutTest: path.join(
    frontend,
    'test',
    'pdf_layout_calibration_regression_test.dart'
  ),
  overflowTest: path.join(
    frontend,
    'test',
    'pdf_overflow_fallback_test.dart'
  ),
};

for (const [label, file] of Object.entries(files)) {
  if (label === 'layoutTest') continue;

  if (!fs.existsSync(file)) {
    throw new Error(`Preflight failed: ${label} not found: ${file}`);
  }
}

const rawModel = fs.readFileSync(files.model, 'utf8');
const rawPdf = fs.readFileSync(files.pdf, 'utf8');
const rawExportTest = fs.readFileSync(files.exportTest, 'utf8');

const modelCrlf = rawModel.includes('\r\n');
const pdfCrlf = rawPdf.includes('\r\n');
const exportTestCrlf = rawExportTest.includes('\r\n');

let model = normalize(rawModel);
let pdf = normalize(rawPdf);
let exportTest = normalize(rawExportTest);

/*
 * Audit/preflight markers: these deliberately cover both retrieval and layout.
 * If local code has drifted in a way we did not inspect, stop before writing.
 */
const preflight = [
  [model, 'factory SavedApplicationPrintModel.fromSavedFormData(', 'saved form print mapping'],
  [model, "final support = _map(payload['support']);", 'support payload mapping'],
  [pdf, 'Future<Uint8List> generateBytesFromSavedApplication(', 'byte PDF renderer'],
  [pdf, 'Future<File> generateFromSavedApplication(', 'file PDF renderer'],
  [pdf, '// ── III. ACADEMIC INFORMATION', 'academic coordinate section'],
  [pdf, 'drawCheck(model.supportParents', 'financial support renderer'],
  [pdf, 'drawCheck(model.hadScholarship', 'scholarship history renderer'],
  [pdf, 'drawDateDigits(model.dateOfBirth', 'DOB box renderer'],
];

for (const [source, marker, label] of preflight) {
  if (!source.includes(marker)) {
    throw new Error(
      `Preflight failed: ${label} marker not found. No project files were written.`
    );
  }
}

model = applyPatchList(model, MODEL_PATCHES);

/*
 * Refactor duplicated renderer FIRST. Current source had the whole coordinate
 * renderer twice: once for byte export and once for File export. Keeping only
 * the byte renderer prevents future coordinate fixes from drifting apart.
 */
const fileMethodStart = pdf.indexOf(
  '  Future<File> generateFromSavedApplication('
);
const openMethodStart = pdf.indexOf(
  '  Future<void> openGeneratedPdf('
);

if (fileMethodStart < 0 || openMethodStart <= fileMethodStart) {
  throw new Error(
    'Preflight failed: could not isolate generateFromSavedApplication(). No project files were written.'
  );
}

const currentFileMethod = pdf.slice(fileMethodStart, openMethodStart);

if (currentFileMethod.includes('PdfDocument(')) {
  pdf =
    pdf.slice(0, fileMethodStart) +
    NEW_GENERATE_FILE_WRAPPER +
    pdf.slice(openMethodStart);
} else if (
  !currentFileMethod.includes(
    'generateBytesFromSavedApplication(model)'
  )
) {
  throw new Error(
    'Preflight failed: generateFromSavedApplication() is neither the audited duplicate renderer nor the expected wrapper. No project files were written.'
  );
}

/* Refactor duplicated fallback renderer if it is still present. */
const fallbackStart = pdf.indexOf(
  '  Future<File> _generateFallbackPdf('
);

if (fallbackStart >= 0) {
  const classEnd = pdf.lastIndexOf('\n}');

  if (classEnd <= fallbackStart) {
    throw new Error(
      'Preflight failed: could not isolate _generateFallbackPdf(). No project files were written.'
    );
  }

  const fallbackMethod = pdf.slice(fallbackStart, classEnd);

  if (fallbackMethod.includes('PdfDocument(')) {
    pdf =
      pdf.slice(0, fallbackStart) +
      NEW_FALLBACK_WRAPPER +
      pdf.slice(classEnd);
  } else if (
    !fallbackMethod.includes('_generateFallbackPdfBytes(model)')
  ) {
    throw new Error(
      'Preflight failed: fallback renderer is not in an audited state. No project files were written.'
    );
  }
}

pdf = applyPatchList(pdf, PDF_PATCHES);
pdf = replaceExact(
  pdf,
  OLD_ENROLLMENT_BLOCK,
  NEW_ENROLLMENT_BLOCK,
  'current enrollment and Financial Support block'
);
pdf = replaceExact(
  pdf,
  OLD_HISTORY_BLOCK,
  NEW_HISTORY_BLOCK,
  'scholarship and disciplinary block'
);
pdf = replaceExact(
  pdf,
  OLD_SIGNATURE_BLOCK,
  NEW_SIGNATURE_BLOCK,
  'signature row fitting'
);

/* Update only the known stale PDF-export assertion when still present. */
const staleExportAssertion =
  "    expect(source, contains('generateFromApplicationId(applicationId)'));";
const currentExportAssertion =
  "    expect(source, contains('generateBytesFromSubmissionPayload('));\\n" +
  "    expect(source, contains('XFile.fromData('));";

if (exportTest.includes(staleExportAssertion)) {
  exportTest = exportTest.replace(
    staleExportAssertion,
    currentExportAssertion
  );
}

/*
 * v2: update the old fixed-coordinate regression assertion so the existing
 * test checks the newly calibrated Student Number / LRN cells instead of
 * deliberately requiring the obsolete v1 coordinates.
 */
const oldStudentNumberExpectation =
  "    expect(\\n" +
  "      source,\\n" +
  "      contains(\\n" +
  "        'model.studentNumber,\\\\n'\\n" +
  "        '      r(721, 2180, 300, 50),\\\\n'\\n" +
  "        '      textFont: smallFont,\\\\n'\\n" +
  "        '      align: PdfTextAlignment.center,',\\n" +
  "      ),\\n" +
  "    );";

const calibratedStudentNumberExpectation =
  "    expect(source, contains('model.studentNumber,'));\\n" +
  "    expect(source, contains('r(420, 2230, 445, 55)'));\\n" +
  "    expect(source, contains('model.learnersReferenceNumber,'));\\n" +
  "    expect(source, contains('r(890, 2230, 445, 55)'));";

if (exportTest.includes(oldStudentNumberExpectation)) {
  exportTest = exportTest.replace(
    oldStudentNumberExpectation,
    calibratedStudentNumberExpectation
  );
} else if (
  exportTest.includes("r(721, 2180, 300, 50)") &&
  !exportTest.includes("r(420, 2230, 445, 55)")
) {
  throw new Error(
    'Preflight failed: pdf_export_mapping_regression_test.dart still contains the obsolete Student Number coordinate, but its assertion shape differs from the audited test. No project files were written.'
  );
}

/*
 * Semantic validation BEFORE any file write.
 */
if (
  exportTest.includes("r(721, 2180, 300, 50)") &&
  !exportTest.includes("r(420, 2230, 445, 55)")
) {
  throw new Error(
    'Validation failed before writing: stale PDF regression coordinates remain. No project files were written.'
  );
}

const validations = [
  [
    countOccurrences(
      pdf,
      '// ── III. ACADEMIC INFORMATION'
    ) === 1,
    'single PDF coordinate source of truth',
  ],
  [
    pdf.includes('final currentEnrollment = [') &&
      pdf.includes('r(80, 2230, 325, 55)') &&
      pdf.includes('r(420, 2230, 445, 55)') &&
      pdf.includes('r(890, 2230, 445, 55)'),
    'current enrollment cell calibration',
  ],
  [
    pdf.includes('r(1755, 2238, 28, 28)') &&
      pdf.includes('r(1938, 2238, 28, 28)') &&
      pdf.includes('r(2085, 2238, 28, 28)') &&
      !pdf.includes('drawCheck(model.supportOther'),
    'Financial Support calibration',
  ],
  [
    model.includes('final bool scholarshipElementary;') &&
      model.includes('final bool scholarshipHighSchool;') &&
      model.includes('final bool scholarshipCollege;') &&
      model.includes('final bool scholarshipOthers;'),
    'scholarship-level print model',
  ],
  [
    pdf.includes('drawCheck(model.scholarshipElementary') &&
      pdf.includes('drawCheck(model.scholarshipHighSchool') &&
      pdf.includes('drawCheck(model.scholarshipCollege') &&
      pdf.includes('drawCheck(model.scholarshipOthers'),
    'scholarship-level PDF checkboxes',
  ],
  [
    currentFileMethod.includes('PdfDocument(') ||
      pdf.includes('generateBytesFromSavedApplication(model)'),
    'file export compatibility',
  ],
];

const failed = validations
  .filter(([ok]) => !ok)
  .map(([, label]) => label);

if (failed.length > 0) {
  throw new Error(
    `Validation failed before writing: ${failed.join(', ')}. No project files were written.`
  );
}

/* Inventory backup files now, but DO NOT delete until tests pass. */
const backupFiles = collectBackupFiles(repo);

console.log(`\nBackup cleanup inventory: ${backupFiles.length} file(s)`);
for (const file of backupFiles) {
  console.log(`  ${path.relative(repo, file)}`);
}

/*
 * Transactional rollback: old source is copied outside the repo so we don't
 * create another .bak-* file that then needs cleanup.
 */
const rollbackDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'smartpdm-pdf-calibration-')
);

const rollback = new Map();

function stageRollback(file) {
  const relative = path.relative(repo, file);
  const copyPath = path.join(rollbackDir, relative);

  fs.mkdirSync(path.dirname(copyPath), { recursive: true });

  if (fs.existsSync(file)) {
    fs.copyFileSync(file, copyPath);
    rollback.set(file, { existed: true, copyPath });
  } else {
    rollback.set(file, { existed: false, copyPath });
  }
}

function restoreAll() {
  for (const [file, info] of rollback.entries()) {
    if (info.existed) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.copyFileSync(info.copyPath, file);
    } else if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

for (const file of [
  files.model,
  files.pdf,
  files.exportTest,
  files.layoutTest,
]) {
  stageRollback(file);
}

try {
  writeFilePreservingEol(files.model, model, modelCrlf);
  writeFilePreservingEol(files.pdf, pdf, pdfCrlf);
  writeFilePreservingEol(
    files.exportTest,
    exportTest,
    exportTestCrlf
  );
  fs.writeFileSync(files.layoutTest, LAYOUT_TEST, 'utf8');

  run(
    'dart',
    [
      'format',
      files.model,
      files.pdf,
      files.exportTest,
      files.layoutTest,
    ],
    frontend
  );

  run(
    'flutter',
    [
      'test',
      'test/pdf_layout_calibration_regression_test.dart',
      'test/pdf_export_mapping_regression_test.dart',
      'test/pdf_overflow_fallback_test.dart',
    ],
    frontend
  );
} catch (error) {
  console.error('\nPDF calibration test failed. Restoring modified source files...');
  restoreAll();
  console.error(`Rollback completed from: ${rollbackDir}`);
  throw error;
}

/*
 * Only after successful tests do we remove the old backup code files.
 */
let deletedBackups = 0;
const cleanupErrors = [];

for (const file of backupFiles) {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      deletedBackups += 1;
    }
  } catch (error) {
    cleanupErrors.push({
      file,
      message: error?.message || String(error),
    });
  }
}

try {
  fs.rmSync(rollbackDir, { recursive: true, force: true });
} catch (_) {
  // Source already passed tests. A temp-directory cleanup failure is non-fatal.
}

console.log(`\nDeleted backup code files: ${deletedBackups}`);

if (cleanupErrors.length > 0) {
  console.warn('\nSome backup files could not be deleted:');
  for (const item of cleanupErrors) {
    console.warn(
      `  ${path.relative(repo, item.file)} -> ${item.message}`
    );
  }
}

console.log('\nCurrent git status:');
const gitStatus = spawnSync(
  'git',
  ['status', '--short'],
  {
    cwd: repo,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }
);

if (gitStatus.stdout?.trim()) {
  console.log(gitStatus.stdout.trimEnd());
} else {
  console.log('  (clean or git status unavailable)');
}

if (cleanupErrors.length > 0) {
  throw new Error(
    `PDF tests passed, but ${cleanupErrors.length} backup file(s) could not be removed.`
  );
}

console.log(
  '\nPASS: PDF layout calibration tests passed and backup cleanup completed.'
);
console.log(
  '\nNext: run the app and export one real Application Form PDF for visual confirmation.'
);
