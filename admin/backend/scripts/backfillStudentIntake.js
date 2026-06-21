const path = require('path');
const ExcelJS = require('exceljs');
const supabase = require('../config/supabase');

const DEFAULT_WORKBOOK_PATH =
    'C:\\Users\\Admin\\Downloads\\PDM_Student_Records_2026_Final.xlsx';
const PROFILE_TABLE = 'student_profiles';
const FAMILY_TABLE = 'student_family';
const EDUCATION_TABLE = 'student_education';

function safeText(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object' && value.text) return String(value.text).trim();
    if (typeof value === 'object' && value.result) return String(value.result).trim();
    return String(value).trim();
}

function normalizeKey(value) {
    return safeText(value).toLowerCase();
}

function normalizeStudentNumber(value) {
    return safeText(value).toUpperCase();
}

function normalizeBoolean(value) {
    const text = safeText(value).toLowerCase();
    if (text === 'yes' || text === 'true' || text === '1') return true;
    if (text === 'no' || text === 'false' || text === '0') return false;
    return null;
}

function normalizePhone(value) {
    return safeText(value).replace(/\s+/g, '').replace(/-/g, '');
}

function normalizeEducationAttainment(value) {
    const text = safeText(value);
    const normalized = text.toLowerCase();

    if (!normalized) return '';
    if (normalized.includes('post')) return 'Post-Graduate';
    if (normalized.includes('college')) return 'College';
    if (normalized.includes('senior high')) return 'Senior High School';
    if (normalized.includes('high school') || normalized.includes('secondary')) {
        return 'High School';
    }
    if (normalized.includes('voc')) return 'Vocational';
    if (normalized.includes('elementary')) return 'Elementary';
    if (normalized === 'none' || normalized.includes('no formal')) return 'None';

    return text;
}

function normalizeAddressForCompare(value) {
    return safeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function parseDateValue(value) {
    if (!value) return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    const text = safeText(value);
    if (!text) return null;

    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const month = slashMatch[1].padStart(2, '0');
        const day = slashMatch[2].padStart(2, '0');
        return `${slashMatch[3]}-${month}-${day}`;
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toISOString().slice(0, 10);
}

function splitFullName(fullName) {
    const tokens = safeText(fullName).split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
        return {
            first_name: '',
            middle_name: '',
            last_name: '',
        };
    }

    if (tokens.length === 1) {
        return {
            first_name: tokens[0],
            middle_name: '',
            last_name: '',
        };
    }

    if (tokens.length === 2) {
        return {
            first_name: tokens[0],
            middle_name: '',
            last_name: tokens[1],
        };
    }

    return {
        first_name: tokens[0],
        middle_name: tokens.slice(1, -1).join(' '),
        last_name: tokens[tokens.length - 1],
    };
}

function parseAddress(value, zipCode = '') {
    const raw = safeText(value);
    const parsed = {
        street_address: raw,
        subdivision: '',
        barangay: '',
        city: '',
        province: '',
        zip_code: safeText(zipCode),
    };

    if (!raw) return parsed;

    const parts = raw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length >= 5) {
        parsed.street_address = parts.slice(0, parts.length - 4).join(', ');
        parsed.subdivision = parts[parts.length - 4];
        parsed.barangay = parts[parts.length - 3];
        parsed.city = parts[parts.length - 2];
        parsed.province = parts[parts.length - 1];
        return parsed;
    }

    if (parts.length === 4) {
        parsed.street_address = parts[0];
        parsed.barangay = parts[1];
        parsed.city = parts[2];
        parsed.province = parts[3];
        return parsed;
    }

    if (parts.length === 3) {
        parsed.street_address = parts[0];

        if (/brgy\.?|barangay/i.test(parts[1])) {
            parsed.barangay = parts[1];
            parsed.city = parts[2];
        } else {
            parsed.city = parts[1];
            parsed.province = parts[2];
        }
    }

    return parsed;
}

function chooseText(existingValue, incomingValue) {
    const existing = safeText(existingValue);
    if (existing) return existing;

    const incoming = safeText(incomingValue);
    return incoming || null;
}

function chooseBool(existingValue, incomingValue) {
    if (existingValue === true || existingValue === false) return existingValue;
    if (incomingValue === true || incomingValue === false) return incomingValue;
    return null;
}

function buildHeaderMap(worksheet) {
    const headers = worksheet.getRow(1).values.slice(1);
    const map = new Map();

    headers.forEach((header, index) => {
        map.set(safeText(header), index + 1);
    });

    return map;
}

function getCellValue(row, headerMap, header) {
    const columnIndex = headerMap.get(header);
    if (!columnIndex) return null;
    return row.getCell(columnIndex).value;
}

function getCellText(row, headerMap, header) {
    return safeText(getCellValue(row, headerMap, header));
}

function parseFinancialSupport(row, headerMap) {
    const supportFlags = [
        ['Parents', 'Financial Support - Parents'],
        ['Scholarship', 'Financial Support - Scholarship'],
        ['Loan', 'Financial Support - Loan'],
        ['Other', 'Financial Support - Other'],
    ].filter(([, header]) => normalizeBoolean(getCellValue(row, headerMap, header)) === true);

    if (supportFlags.length === 0) {
        return {
            financial_support_type: null,
            financial_support_other: null,
        };
    }

    if (supportFlags.length === 1) {
        return {
            financial_support_type: supportFlags[0][0],
            financial_support_other: null,
        };
    }

    return {
        financial_support_type: 'Other',
        financial_support_other: supportFlags.map(([label]) => label).join(', '),
    };
}

function parseWorkbookRecord(row, headerMap) {
    const studentNumber = normalizeStudentNumber(
        getCellValue(row, headerMap, 'Student Number')
    );

    if (!studentNumber) return null;

    const applicantAddress = parseAddress(
        getCellText(row, headerMap, 'Permanent Address') ||
            getCellText(row, headerMap, 'Present Address'),
        getCellText(row, headerMap, 'Permanent ZIP Code') ||
            getCellText(row, headerMap, 'Present ZIP Code')
    );

    const fatherName = splitFullName(getCellText(row, headerMap, 'Father Name'));
    const motherName = splitFullName(getCellText(row, headerMap, 'Mother Name'));
    const parentGuardianAddress =
        getCellText(row, headerMap, 'Emergency Address') ||
        getCellText(row, headerMap, 'Father Address') ||
        getCellText(row, headerMap, 'Mother Address');

    const support = parseFinancialSupport(row, headerMap);

    return {
        student_number: studentNumber,
        profile: {
            date_of_birth: parseDateValue(
                getCellValue(row, headerMap, 'Date of Birth')
            ),
            place_of_birth: getCellText(row, headerMap, 'Place of Birth'),
            civil_status: getCellText(row, headerMap, 'Civil Status'),
            religion: getCellText(row, headerMap, 'Religion'),
            citizenship: getCellText(row, headerMap, 'Nationality'),
            ...applicantAddress,
            parent_guardian_address: parentGuardianAddress,
            same_address_as_applicant:
                normalizeAddressForCompare(parentGuardianAddress) !== '' &&
                normalizeAddressForCompare(parentGuardianAddress) ===
                    normalizeAddressForCompare(
                        getCellText(row, headerMap, 'Permanent Address') ||
                            getCellText(row, headerMap, 'Present Address')
                    ),
            father_present: Boolean(
                safeText(fatherName.first_name) || safeText(fatherName.last_name)
            ),
            mother_present: Boolean(
                safeText(motherName.first_name) || safeText(motherName.last_name)
            ),
            guardian_only: false,
            financial_support_type: support.financial_support_type,
            financial_support_other: support.financial_support_other,
            has_prior_scholarship: normalizeBoolean(
                getCellValue(row, headerMap, 'Have you been a scholar?')
            ),
            has_disciplinary_record: normalizeBoolean(
                getCellValue(
                    row,
                    headerMap,
                    'Have you ever been subject to disciplinary action from any school or institution attended?'
                )
            ),
        },
        family: [
            {
                relation: 'Father',
                ...fatherName,
                mobile_number: normalizePhone(
                    getCellValue(row, headerMap, 'Father Contact')
                ),
                address: getCellText(row, headerMap, 'Father Address'),
                highest_educational_attainment: normalizeEducationAttainment(
                    getCellValue(row, headerMap, 'Father Educational Attainment')
                ),
                occupation: getCellText(row, headerMap, 'Father Occupation'),
                company_name_address: '',
            },
            {
                relation: 'Mother',
                ...motherName,
                mobile_number: normalizePhone(
                    getCellValue(row, headerMap, 'Mother Contact')
                ),
                address: getCellText(row, headerMap, 'Mother Address'),
                highest_educational_attainment: normalizeEducationAttainment(
                    getCellValue(row, headerMap, 'Mother Educational Attainment')
                ),
                occupation: getCellText(row, headerMap, 'Mother Occupation'),
                company_name_address: '',
            },
            {
                relation: 'Sibling',
                last_name: getCellText(row, headerMap, 'Sibling Last Name'),
                first_name: getCellText(row, headerMap, 'Sibling First Name'),
                middle_name: getCellText(row, headerMap, 'Sibling Middle Name'),
                mobile_number: normalizePhone(
                    getCellValue(row, headerMap, 'Sibling Mobile No.')
                ),
                address: '',
                highest_educational_attainment: '',
                occupation: '',
                company_name_address: '',
            },
        ],
        education: [
            {
                education_level: 'Elementary',
                school_name: getCellText(row, headerMap, 'Elem School'),
                school_address: getCellText(row, headerMap, 'Elem Address'),
                year_graduated: getCellText(row, headerMap, 'Elem Inclusive Year'),
            },
            {
                education_level: 'High School',
                school_name:
                    getCellText(row, headerMap, 'Grade 7-10 School') ||
                    getCellText(row, headerMap, 'HS Old Curriculum School'),
                school_address:
                    getCellText(row, headerMap, 'Grade 7-10 Address') ||
                    getCellText(row, headerMap, 'HS Old Curriculum Address'),
                year_graduated:
                    getCellText(row, headerMap, 'Grade 7-10 Year') ||
                    getCellText(row, headerMap, 'HS Old Curriculum Year'),
            },
            {
                education_level: 'Senior High School',
                school_name: getCellText(row, headerMap, 'Grade 11-12 School'),
                school_address: getCellText(row, headerMap, 'Grade 11-12 Address'),
                year_graduated: getCellText(row, headerMap, 'Grade 11-12 Year'),
            },
            {
                education_level: 'College',
                school_name: getCellText(row, headerMap, 'Previous College'),
                school_address: getCellText(row, headerMap, 'Previous Address'),
                year_graduated: getCellText(
                    row,
                    headerMap,
                    'Previous Inclusive Year'
                ),
            },
        ],
    };
}

async function readWorkbook(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        throw new Error('The workbook does not contain a worksheet.');
    }

    const headerMap = buildHeaderMap(worksheet);
    const records = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        const record = parseWorkbookRecord(row, headerMap);
        if (!record) continue;
        record.row_number = rowNumber;
        records.push(record);
    }

    return records;
}

async function fetchAllStudents() {
    const { data, error } = await supabase
        .from('students')
        .select('student_id, pdm_id, registrar_student_number, master_student_id');

    if (error) throw error;
    return data || [];
}

async function fetchMasters() {
    const { data, error } = await supabase
        .from('student_master_records')
        .select('master_student_id, student_number, pdm_id');

    if (error) throw error;
    return data || [];
}

function buildStudentMatcher(students, masterMap) {
    const matcher = new Map();

    for (const student of students) {
        [
            student.pdm_id,
            student.registrar_student_number,
            masterMap.get(student.master_student_id)?.student_number,
        ]
            .map(normalizeStudentNumber)
            .filter(Boolean)
            .forEach((key) => matcher.set(key, student));
    }

    return matcher;
}

async function fetchByStudentIds(table, studentIds) {
    const rows = [];

    for (let index = 0; index < studentIds.length; index += 200) {
        const batch = studentIds.slice(index, index + 200);
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .in('student_id', batch);

        if (error) throw error;
        rows.push(...(data || []));
    }

    return rows;
}

function profileHasData(profile) {
    return [
        'date_of_birth',
        'place_of_birth',
        'civil_status',
        'religion',
        'citizenship',
        'street_address',
        'subdivision',
        'barangay',
        'city',
        'province',
        'zip_code',
        'parent_guardian_address',
        'financial_support_type',
        'financial_support_other',
    ].some((key) => safeText(profile[key])) ||
        profile.same_address_as_applicant === true ||
        profile.father_present === true ||
        profile.mother_present === true ||
        profile.guardian_only === true ||
        profile.has_prior_scholarship === true ||
        profile.has_disciplinary_record === true;
}

function familyHasData(row) {
    return [
        'first_name',
        'middle_name',
        'last_name',
        'mobile_number',
        'address',
        'highest_educational_attainment',
        'occupation',
        'company_name_address',
    ].some((key) => safeText(row[key]));
}

function educationHasData(row) {
    return ['school_name', 'school_address', 'year_graduated'].some((key) =>
        safeText(row[key])
    );
}

function buildExistingMaps(profiles, familyRows, educationRows) {
    return {
        profiles: new Map(profiles.map((row) => [row.student_id, row])),
        family: new Map(
            familyRows.map((row) => [`${row.student_id}:${row.relation}`, row])
        ),
        education: new Map(
            educationRows.map(
                (row) => [`${row.student_id}:${row.education_level}`, row]
            )
        ),
    };
}

function mergeProfile(studentId, source, existing = null) {
    const merged = {
        student_id: studentId,
        date_of_birth: chooseText(existing?.date_of_birth, source.date_of_birth),
        place_of_birth: chooseText(existing?.place_of_birth, source.place_of_birth),
        civil_status: chooseText(existing?.civil_status, source.civil_status),
        religion: chooseText(existing?.religion, source.religion),
        citizenship: chooseText(existing?.citizenship, source.citizenship),
        street_address: chooseText(existing?.street_address, source.street_address),
        subdivision: chooseText(existing?.subdivision, source.subdivision),
        barangay: chooseText(existing?.barangay, source.barangay),
        city: chooseText(existing?.city, source.city),
        province: chooseText(existing?.province, source.province),
        zip_code: chooseText(existing?.zip_code, source.zip_code),
        parent_guardian_address: chooseText(
            existing?.parent_guardian_address,
            source.parent_guardian_address
        ),
        same_address_as_applicant: chooseBool(
            existing?.same_address_as_applicant,
            source.same_address_as_applicant
        ),
        father_present: chooseBool(existing?.father_present, source.father_present),
        mother_present: chooseBool(existing?.mother_present, source.mother_present),
        guardian_only: chooseBool(existing?.guardian_only, source.guardian_only),
        financial_support_type: chooseText(
            existing?.financial_support_type,
            source.financial_support_type
        ),
        financial_support_other: chooseText(
            existing?.financial_support_other,
            source.financial_support_other
        ),
        has_prior_scholarship: chooseBool(
            existing?.has_prior_scholarship,
            source.has_prior_scholarship
        ),
        has_disciplinary_record: chooseBool(
            existing?.has_disciplinary_record,
            source.has_disciplinary_record
        ),
    };

    return merged;
}

function mergeFamily(studentId, source, existing = null) {
    return {
        student_id: studentId,
        relation: source.relation,
        first_name: chooseText(existing?.first_name, source.first_name),
        middle_name: chooseText(existing?.middle_name, source.middle_name),
        last_name: chooseText(existing?.last_name, source.last_name),
        mobile_number: chooseText(existing?.mobile_number, source.mobile_number),
        address: chooseText(existing?.address, source.address),
        highest_educational_attainment: chooseText(
            existing?.highest_educational_attainment,
            source.highest_educational_attainment
        ),
        occupation: chooseText(existing?.occupation, source.occupation),
        company_name_address: chooseText(
            existing?.company_name_address,
            source.company_name_address
        ),
    };
}

function mergeEducation(studentId, source, existing = null) {
    return {
        student_id: studentId,
        education_level: source.education_level,
        school_name: chooseText(existing?.school_name, source.school_name),
        school_address: chooseText(existing?.school_address, source.school_address),
        honors_awards: chooseText(existing?.honors_awards, source.honors_awards),
        club_organization: chooseText(
            existing?.club_organization,
            source.club_organization
        ),
        year_graduated: chooseText(
            existing?.year_graduated,
            source.year_graduated
        ),
    };
}

function summarizeChange(existing, merged, keys) {
    if (!existing) return 'created';

    const changed = keys.some((key) => {
        const before = existing[key] ?? null;
        const after = merged[key] ?? null;
        return before !== after;
    });

    return changed ? 'updated' : 'unchanged';
}

async function upsertInChunks(table, rows, conflict) {
    for (let index = 0; index < rows.length; index += 200) {
        const batch = rows.slice(index, index + 200).map((row) => ({
            ...row,
            updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from(table)
            .upsert(batch, { onConflict: conflict });

        if (error) throw error;
    }
}

function parseArgs(argv) {
    const args = {
        apply: false,
        file: DEFAULT_WORKBOOK_PATH,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--apply') {
            args.apply = true;
        } else if (arg === '--file' && argv[index + 1]) {
            args.file = argv[index + 1];
            index += 1;
        }
    }

    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const workbookPath = path.resolve(args.file);

    console.log(
        `[backfill] Mode: ${args.apply ? 'apply' : 'dry-run'} | Workbook: ${workbookPath}`
    );

    const workbookRecords = await readWorkbook(workbookPath);
    const students = await fetchAllStudents();
    const masterRows = await fetchMasters();
    const masterMap = new Map(
        masterRows.map((row) => [row.master_student_id, row])
    );
    const masterNumberSet = new Set(
        masterRows
            .flatMap((row) => [row.student_number, row.pdm_id])
            .map(normalizeStudentNumber)
            .filter(Boolean)
    );
    const matcher = buildStudentMatcher(students, masterMap);

    const matched = [];
    const masterOnly = [];
    const unmatched = [];

    for (const record of workbookRecords) {
        const student = matcher.get(record.student_number);

        if (!student?.student_id) {
            if (masterNumberSet.has(record.student_number)) {
                masterOnly.push({
                    row_number: record.row_number,
                    student_number: record.student_number,
                });
                continue;
            }

            unmatched.push({
                row_number: record.row_number,
                student_number: record.student_number,
            });
            continue;
        }

        matched.push({
            student,
            source: record,
        });
    }

    const studentIds = [...new Set(matched.map((entry) => entry.student.student_id))];
    const [profiles, familyRows, educationRows] = await Promise.all([
        fetchByStudentIds(PROFILE_TABLE, studentIds),
        fetchByStudentIds(FAMILY_TABLE, studentIds),
        fetchByStudentIds(EDUCATION_TABLE, studentIds),
    ]);

    const existing = buildExistingMaps(profiles, familyRows, educationRows);
    const profileUpserts = [];
    const familyUpserts = [];
    const educationUpserts = [];
    const summary = {
        workbook_rows: workbookRecords.length,
        matched_students: matched.length,
        master_only_rows: masterOnly.length,
        unmatched_students: unmatched.length,
        profile: { created: 0, updated: 0, unchanged: 0, skipped: 0 },
        family: { created: 0, updated: 0, unchanged: 0, skipped: 0 },
        education: { created: 0, updated: 0, unchanged: 0, skipped: 0 },
    };

    for (const entry of matched) {
        const studentId = entry.student.student_id;
        const mergedProfile = mergeProfile(
            studentId,
            entry.source.profile,
            existing.profiles.get(studentId)
        );

        if (profileHasData(mergedProfile)) {
            const status = summarizeChange(existing.profiles.get(studentId), mergedProfile, [
                'date_of_birth',
                'place_of_birth',
                'civil_status',
                'religion',
                'citizenship',
                'street_address',
                'subdivision',
                'barangay',
                'city',
                'province',
                'zip_code',
                'parent_guardian_address',
                'same_address_as_applicant',
                'father_present',
                'mother_present',
                'guardian_only',
                'financial_support_type',
                'financial_support_other',
                'has_prior_scholarship',
                'has_disciplinary_record',
            ]);

            summary.profile[status] += 1;
            if (status !== 'unchanged') profileUpserts.push(mergedProfile);
        } else {
            summary.profile.skipped += 1;
        }

        for (const familySource of entry.source.family) {
            const familyKey = `${studentId}:${familySource.relation}`;
            const mergedFamily = mergeFamily(
                studentId,
                familySource,
                existing.family.get(familyKey)
            );

            if (familyHasData(mergedFamily)) {
                const status = summarizeChange(existing.family.get(familyKey), mergedFamily, [
                    'first_name',
                    'middle_name',
                    'last_name',
                    'mobile_number',
                    'address',
                    'highest_educational_attainment',
                    'occupation',
                    'company_name_address',
                ]);

                summary.family[status] += 1;
                if (status !== 'unchanged') familyUpserts.push(mergedFamily);
            } else {
                summary.family.skipped += 1;
            }
        }

        for (const educationSource of entry.source.education) {
            const educationKey = `${studentId}:${educationSource.education_level}`;
            const mergedEducation = mergeEducation(
                studentId,
                educationSource,
                existing.education.get(educationKey)
            );

            if (educationHasData(mergedEducation)) {
                const status = summarizeChange(
                    existing.education.get(educationKey),
                    mergedEducation,
                    [
                        'school_name',
                        'school_address',
                        'honors_awards',
                        'club_organization',
                        'year_graduated',
                    ]
                );

                summary.education[status] += 1;
                if (status !== 'unchanged') educationUpserts.push(mergedEducation);
            } else {
                summary.education.skipped += 1;
            }
        }
    }

    console.log('[backfill] Summary');
    console.log(JSON.stringify(summary, null, 2));

    if (masterOnly.length) {
        console.log('[backfill] Sample master-only rows (import exists, no students row)');
        console.log(JSON.stringify(masterOnly.slice(0, 15), null, 2));
    }

    if (unmatched.length) {
        console.log('[backfill] Sample unmatched rows');
        console.log(JSON.stringify(unmatched.slice(0, 15), null, 2));
    }

    if (!args.apply) {
        return;
    }

    await upsertInChunks(PROFILE_TABLE, profileUpserts, 'student_id');
    await upsertInChunks(FAMILY_TABLE, familyUpserts, 'student_id,relation');
    await upsertInChunks(
        EDUCATION_TABLE,
        educationUpserts,
        'student_id,education_level'
    );

    console.log('[backfill] Apply complete');
    console.log(
        JSON.stringify(
            {
                profiles_written: profileUpserts.length,
                family_rows_written: familyUpserts.length,
                education_rows_written: educationUpserts.length,
            },
            null,
            2
        )
    );
}

main().catch((error) => {
    console.error('[backfill] Failed');
    console.error(error);
    process.exitCode = 1;
});
