// Extracted first-pass mobile response builders
async function buildSavedFormDataForMobile(userId) {
  const context = await loadStudentProfileContextByUserId(userId);

  if (!context) {
    return {
      has_saved_form: false,
      account: {},
      personal: {},
      address: {},
      contact: {},
      family: {},
      academic: {},
      support: {},
      discipline: {},
      essays: {},
    };
  }

  const user = context.user || {};
  const student = context.student || {};
  const profile = context.student_profile || {};
  const course = context.course || {};

  return {
    has_saved_form: true,
    account: {
      user_id: user.user_id || '',
      student_id: student.pdm_id || user.username || '',
    },
    personal: {
      first_name: student.first_name || '',
      middle_name: student.middle_name || '',
      last_name: student.last_name || '',
      maiden_name: profile.maiden_name || '',
      age: '',
      date_of_birth: profile.date_of_birth || '',
      sex: profile.sex || '',
      place_of_birth: profile.place_of_birth || '',
      citizenship: profile.citizenship || '',
      civil_status: profile.civil_status || '',
      religion: profile.religion || '',
    },
    address: {
      street: profile.street_address || '',
      subdivision: profile.subdivision || '',
      city_municipality: profile.city || '',
      province: profile.province || '',
      zip_code: profile.zip_code || '',
    },
    contact: {
      landline: profile.landline_number || '',
      mobile_number: user.phone_number || '',
      email: user.email || '',
    },
    family: {
      father: {},
      mother: {},
      sibling: {},
      guardian: {},
    },
    academic: {
      current_course: course.course_code || '',
      current_course_code: course.course_code || '',
      student_number: student.pdm_id || '',
      lrn: profile.learners_reference_number || '',
    },
    support: {},
    discipline: {},
    essays: {},
  };
}

async function buildCurrentRenewalForMobile(userId) {
  const studentRecord = await resolveStudentByUserId(userId);

  if (!studentRecord?.student_id) {
    return {
      renewal: {
        renewal_id: '',
        scholar_id: '',
        student_id: '',
        program_id: '',
        semester_label: '',
        school_year_label: '',
        renewal_status: 'Pending Submission',
        document_status: 'Missing Docs',
        admin_comment: null,
        submitted_at: null,
        reviewed_at: null,
      },
      documents: [],
      scholar: {
        program_name: 'Scholarship',
        benefactor_name: null,
      },
      student: {
        name: 'Scholar',
        pdm_id: '',
      },
      cycle: {
        semester_label: '',
        school_year_label: '',
      },
    };
  }

  const { data: scholarRecord, error: scholarError } = await supabase
    .from('scholars')
    .select(`
      scholar_id,
      program_id,
      scholarship_program (
        program_name,
        benefactor_id
      )
    `)
    .eq('student_id', studentRecord.student_id)
    .maybeSingle();

  if (scholarError) {
    throw scholarError;
  }

  let benefactorName = null;
  const benefactorId = scholarRecord?.scholarship_program?.benefactor_id;
  if (benefactorId) {
    const { data: benefactorRow, error: benefactorError } = await supabase
      .from('benefactors')
      .select('benefactor_name')
      .eq('benefactor_id', benefactorId)
      .maybeSingle();

    if (benefactorError) {
      throw benefactorError;
    }

    benefactorName = benefactorRow?.benefactor_name || null;
  }

  const now = new Date();
  const semesterLabel = now.getMonth() < 6 ? 'Second Semester' : 'First Semester';
  const schoolYearLabel =
    now.getMonth() < 6
      ? `${now.getFullYear() - 1}-${now.getFullYear()}`
      : `${now.getFullYear()}-${now.getFullYear() + 1}`;

  return {
    renewal: {
      renewal_id: '',
      scholar_id: scholarRecord?.scholar_id || '',
      student_id: studentRecord.student_id || '',
      program_id: scholarRecord?.program_id || '',
      semester_label: semesterLabel,
      school_year_label: schoolYearLabel,
      renewal_status: 'Pending Submission',
      document_status: 'Missing Docs',
      admin_comment: null,
      submitted_at: null,
      reviewed_at: null,
    },
    documents: [],
    scholar: {
      program_name: scholarRecord?.scholarship_program?.program_name || 'Scholarship',
      benefactor_name: benefactorName,
    },
    student: {
      name: `${studentRecord.first_name || ''} ${studentRecord.last_name || ''}`.trim() || 'Scholar',
      pdm_id: studentRecord.pdm_id || '',
    },
    cycle: {
      semester_label: semesterLabel,
      school_year_label: schoolYearLabel,
    },
  };
}

async function fetchMyPayoutSchedules(userId) {
  const studentRecord = await resolveStudentByUserId(userId);

  if (!studentRecord?.student_id) {
    return { items: [] };
  }

  const { data: scholarRecord, error: scholarError } = await supabase
    .from('scholars')
    .select('scholar_id')
    .eq('student_id', studentRecord.student_id)
    .maybeSingle();

  if (scholarError) {
    throw scholarError;
  }

  if (!scholarRecord?.scholar_id) {
    return { items: [] };
  }

  const { data, error } = await supabase
    .from('payout_batch_scholars')
    .select(`
      payout_entry_id,
      amount_received,
      release_status,
      payout_batches!fk_payout_batch_scholars_batch (
        payout_batch_id,
        payout_title,
        payout_date,
        payment_mode,
        batch_status,
        program_id
      )
    `)
    .eq('scholar_id', scholarRecord.scholar_id);

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  const programIds = rows
    .map((row) => row?.payout_batches?.program_id)
    .filter(Boolean);

  let programMap = {};
  if (programIds.length > 0) {
    const { data: programs, error: programError } = await supabase
      .from('scholarship_program')
      .select('program_id, program_name, benefactor_id')
      .in('program_id', programIds);

    if (programError) {
      throw programError;
    }

    const benefactorIds = (programs || [])
      .map((item) => item.benefactor_id)
      .filter(Boolean);

    let benefactorMap = {};
    if (benefactorIds.length > 0) {
      const { data: benefactors, error: benefactorError } = await supabase
        .from('benefactors')
        .select('benefactor_id, benefactor_name')
        .in('benefactor_id', benefactorIds);

      if (benefactorError) {
        throw benefactorError;
      }

      benefactorMap = Object.fromEntries(
        (benefactors || []).map((item) => [item.benefactor_id, item.benefactor_name])
      );
    }

    programMap = Object.fromEntries(
      (programs || []).map((item) => [
        item.program_id,
        {
          program_name: item.program_name,
          benefactor_name: benefactorMap[item.benefactor_id] || null,
        },
      ])
    );
  }

  const items = rows
    .map((row) => {
      const batch = row.payout_batches || {};
      const programInfo = programMap[batch.program_id] || {};

      return {
        payout_entry_id: row.payout_entry_id,
        payout_batch_id: batch.payout_batch_id || '',
        title: batch.payout_title || 'Scholarship Payout',
        amount: row.amount_received || 0,
        status: row.release_status || 'Pending',
        payout_date: batch.payout_date || '',
        semester: batch.semester || '',
        school_year: batch.school_year || '',
        payment_mode: batch.payment_mode || '',
        batch_status: batch.batch_status || '',
        program_name: programInfo.program_name || 'Scholarship Program',
        benefactor_name: programInfo.benefactor_name || null,
        reference: batch.payout_batch_id || '',
      };
    })
    .sort((a, b) => {
      const aDate = a.payout_date || '';
      const bDate = b.payout_date || '';
      return bDate.localeCompare(aDate);
    });

  return { items };
}

