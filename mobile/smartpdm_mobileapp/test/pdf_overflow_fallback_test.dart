import 'dart:io';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/scholarship_form_pdf_service.dart';
import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final dummyModel = SavedApplicationPrintModel(
    lastName: 'Doe',
    firstName: 'John',
    middleName: 'A.',
    maidenName: '',
    age: '20',
    dateOfBirth: '01/01/2006',
    placeOfBirth: 'City',
    citizenship: 'Filipino',
    religion: 'Catholic',
    civilStatus: 'Single',
    sex: 'Male',
    houseLotBlockNo: '1',
    phase: '2',
    street: 'Main St',
    subdivision: 'Subd',
    barangay: 'Brgy',
    city: 'City',
    province: 'Province',
    zipCode: '1000',
    landlineNumber: '1234567',
    mobileNumber: '09123456789',
    email: 'john.doe@email.com',
    parentGuardianAddress: 'Address',
    fatherLastName: 'Doe',
    fatherFirstName: 'Papa',
    fatherMiddleName: 'B',
    fatherMobile: '099999999',
    fatherEducationalAttainment: 'College',
    fatherOccupation: 'Driver',
    fatherCompanyNameAddress: 'Company A',
    motherLastName: 'Doe',
    motherFirstName: 'Mama',
    motherMiddleName: 'C',
    motherMobile: '088888888',
    motherEducationalAttainment: 'High School',
    motherOccupation: 'Housewife',
    motherCompanyNameAddress: 'Home',
    siblingLastName: 'Doe',
    siblingFirstName: 'Bro',
    siblingMiddleName: 'D',
    siblingMobile: '07777777',
    guardianLastName: 'Doe',
    guardianFirstName: 'Guard',
    guardianMiddleName: 'E',
    guardianMobile: '06666666',
    guardianEducationalAttainment: 'College',
    guardianOccupation: 'Teacher',
    guardianCompanyNameAddress: 'School',
    isFatherOnlyNative: false,
    isMotherOnlyNative: false,
    isBothParentsNative: true,
    isNotNative: false,
    yearsResident: '10',
    originProvince: 'Bulacan',
    collegeSchool: 'College A',
    collegeAddress: 'Address A',
    collegeHonors: 'Cum Laude',
    collegeClub: 'Club A',
    collegeYearGraduated: '2025',
    highSchoolSchool: 'HS A',
    highSchoolAddress: 'Address B',
    highSchoolHonors: 'Valedictorian',
    highSchoolClub: 'Club B',
    highSchoolYearGraduated: '2021',
    seniorHighSchool: 'SHS A',
    seniorHighAddress: 'Address C',
    seniorHighHonors: 'With Honors',
    seniorHighClub: 'Club C',
    seniorHighYearGraduated: '2023',
    elementarySchool: 'Elem A',
    elementaryAddress: 'Address D',
    elementaryHonors: 'First Honors',
    elementaryClub: 'Club D',
    elementaryYearGraduated: '2017',
    currentYearSection: '3 / A',
    studentNumber: '2023-0001',
    learnersReferenceNumber: '123456789012',
    currentCourse: 'BSCS',
    gwa: '1.25',
    financialSupport: 'Parents',
    financialSupportOther: '',
    supportParents: true,
    supportScholarship: false,
    supportLoan: false,
    supportOther: false,
    hadScholarship: false,
    noScholarshipHistory: true,
    scholarshipDetails: '',
    hasDisciplinaryRecord: false,
    noDisciplinaryRecord: true,
    disciplinaryDetails: '',
    selfDescription: 'A' * 900, // Very long text to trigger font scaling
    aimsAndAmbitions: 'B' * 600, // Long text to trigger font scaling
    applicantPrintedName: 'John Doe',
    parentGuardianPrintedName: 'Papa Doe',
    printedDate: '07/08/2026',
  );

  test('generates fallback pdf when template is missing', () async {
    // We simulate missing template by running this in an environment where assets are not loaded
    // or we can test the fallback directly if we intercept rootBundle.
    final service = ScholarshipFormPdfService();
    
    // In test environment, rootBundle doesn't have the assets loaded unless we set them up.
    // This will naturally trigger the fallback.
    final file = await service.generateFromSavedApplication(dummyModel);
    
    // We verify the file was successfully generated (either from template or fallback)
    expect(file.existsSync(), true);
    expect(await file.length() > 0, true);
  });
}
