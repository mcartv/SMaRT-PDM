// Extracted opening/application availability helpers
async function resolveOpeningById(openingId) {
  if (!openingId) {
    return null;
  }

  const { data, error } = await supabase
    .from('program_openings')
    .select(`
      opening_id,
      program_id,
      opening_title,
      announcement_text,
      posting_status,
      created_at,
      updated_at,
      scholarship_program (
        program_id,
        program_name
      )
    `)
    .eq('opening_id', openingId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function resolveApplicantDraftByUserId(userId) {
  try {
    const { data, error } = await supabase
      .from(APPLICATION_DRAFT_TABLE)
      .select('draft_id, user_id, opening_id, payload, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      const message = String(error.message || '').toLowerCase();
      const hint = String(error.hint || '').toLowerCase();

      if (
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        message.includes('application_form_drafts') ||
        message.includes('could not find the table') ||
        message.includes('relation') ||
        message.includes('does not exist') ||
        hint.includes('application_documents')
      ) {
        console.warn('Draft table missing, skipping applicant draft lookup.');
        return null;
      }

      throw error;
    }

    return data || null;
  } catch (error) {
    const message = String(error.message || '').toLowerCase();
    const hint = String(error.hint || '').toLowerCase();

    if (
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      message.includes('application_form_drafts') ||
      message.includes('could not find the table') ||
      message.includes('relation') ||
      message.includes('does not exist') ||
      hint.includes('application_documents')
    ) {
      console.warn('Draft table missing, skipping applicant draft lookup.');
      return null;
    }

    throw error;
  }
}

async function upsertApplicantDraftByUserId(userId, { openingId, payload }) {
  const { data, error } = await supabase
    .from(APPLICATION_DRAFT_TABLE)
    .upsert(
      {
        user_id: userId,
        opening_id: openingId,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('draft_id, user_id, opening_id, payload, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function clearApplicantDraftByUserId(userId) {
  const { error } = await supabase
    .from(APPLICATION_DRAFT_TABLE)
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

async function resolveLatestOpeningApplicationForUser(userId) {
  const studentRecord = await resolveStudentByUserId(userId);
  if (!studentRecord) {
    return null;
  }

  const { data: applicationRecords, error } = await supabase
    .from('applications')
    .select(
      'application_id, student_id, program_id, opening_id, application_status, document_status, submission_date, is_disqualified'
    )
    .eq('student_id', studentRecord.student_id)
    .not('opening_id', 'is', null)
    .order('submission_date', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const applicationRecord =
    Array.isArray(applicationRecords) && applicationRecords.length > 0
      ? applicationRecords[0]
      : null;

  if (!applicationRecord) {
    return null;
  }

  return {
    student: studentRecord,
    application: applicationRecord,
  };
}

async function resolveActiveOpeningApplicationForUser(userId) {
  const studentRecord = await resolveStudentByUserId(userId);
  if (!studentRecord) {
    return null;
  }

  const [scholarRecord, applicationResult] = await Promise.all([
    resolveScholarRecordForStudent(studentRecord.student_id),
    supabase
      .from('applications')
      .select(
        'application_id, student_id, program_id, opening_id, application_status, document_status, submission_date, is_disqualified'
      )
      .eq('student_id', studentRecord.student_id)
      .not('opening_id', 'is', null)
      .order('submission_date', { ascending: false, nullsFirst: false })
      .limit(25),
  ]);

  if (applicationResult.error) {
    throw applicationResult.error;
  }

  const activeApplication = (applicationResult.data || []).find((application) => {
    if (
      scholarRecord?.application_id &&
      scholarRecord.application_id === application.application_id
    ) {
      return false;
    }

    return isActiveApplicationRecord(application);
  });

  if (!activeApplication) {
    return null;
  }

  return {
    student: studentRecord,
    application: activeApplication,
  };
}

async function fetchVisibleProgramOpeningsForUser(userId) {
  const studentRecord = await resolveStudentByUserId(userId);
  const userRecord = await resolveUserAccountRecord(userId);
  const studentNumber =
    studentRecord?.pdm_id || userRecord?.username || '';
  const registryStudent = await resolveRegistrarStudentByStudentNumber(
    studentNumber
  );

  if (!registryStudent) {
    throw createHttpError(
      403,
      'This account is not registered in the registrar records.'
    );
  }

  const scholarRecord = studentRecord?.student_id
    ? await resolveScholarRecordForStudent(studentRecord.student_id)
    : null;

  const { data, error } = await supabase
    .from('program_openings')
    .select(`
      opening_id,
      program_id,
      opening_title,
      announcement_text,
      posting_status,
      created_at,
      updated_at,
      scholarship_program (
        program_id,
        program_name
      )
    `)
    .eq('posting_status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const visibleOpenings = (data || []).filter((opening) => {
    if (!scholarRecord) {
      return true;
    }

    return isTesProgramName(opening.scholarship_program?.program_name || '');
  });

  return {
    items: visibleOpenings,
    scholarRecord,
  };
}

function mapApplicantOpening(opening, {
  activeApplication = null,
  draft = null,
  activeApplicationDocumentSummary = null,
} = {}) {
  const isTes = isTesProgramName(opening.scholarship_program?.program_name || '');
  const isActiveOpening = activeApplication?.opening_id === opening.opening_id;
  const isDraftOpening = draft?.opening_id === opening.opening_id;

  let canApply = true;
  let applyLabel = 'Start Application';

  if (isActiveOpening) {
    applyLabel = 'Open Documents';
  } else if (activeApplication?.application_id) {
    canApply = false;
    applyLabel = 'Application In Progress';
  } else if (isDraftOpening) {
    applyLabel = 'Continue Draft';
  }

  return {
    opening_id: opening.opening_id,
    program_id: opening.program_id,
    opening_title: opening.opening_title || 'Scholarship Opening',
    program_name: opening.scholarship_program?.program_name || 'Scholarship Program',
    application_start: '',
    application_end: '',
    posting_status: opening.posting_status || 'open',
    announcement_text: opening.announcement_text || '',
    is_tes: isTes,
    has_applied: !!isActiveOpening,
    can_reapply: false,
    can_apply: canApply,
    apply_label: applyLabel,
    benefactor_name: null,
    existing_application_id: isActiveOpening
      ? activeApplication.application_id
      : null,
    uploaded_document_count: isActiveOpening
      ? activeApplicationDocumentSummary?.uploadedCount ?? 0
      : 0,
    required_document_count: isActiveOpening
      ? activeApplicationDocumentSummary?.requiredCount ??
      APPLICATION_DOCUMENT_DEFINITIONS.length
      : 0,
  };
}

async function buildApplicantOpeningsPayload(userId) {
  const [draft, activeApplicationResult, visibleOpeningsResult] = await Promise.all([
    resolveApplicantDraftByUserId(userId),
    resolveActiveOpeningApplicationForUser(userId),
    fetchVisibleProgramOpeningsForUser(userId),
  ]);
  let activeApplicationDocumentSummary = null;

  if (activeApplicationResult?.application?.application_id) {
    try {
      const documentPackage = await buildApplicantDocumentPackage({
        applicationId: activeApplicationResult.application.application_id,
      });
      const activeDocuments = documentPackage?.documents || [];

      activeApplicationDocumentSummary = {
        uploadedCount: (activeDocuments || []).filter(
          (document) => document.is_submitted || !!document.file_url
        ).length,
        requiredCount:
          activeDocuments.length || APPLICATION_DOCUMENT_DEFINITIONS.length,
      };
    } catch (error) {
      console.warn('OPENINGS DOCUMENT SUMMARY WARNING:', {
        message: error?.message || String(error),
        details: error?.details || null,
      });

      activeApplicationDocumentSummary = {
        uploadedCount: 0,
        requiredCount: APPLICATION_DOCUMENT_DEFINITIONS.length,
      };
    }
  }

  const items = [...visibleOpeningsResult.items];
  const existingIds = new Set(items.map((opening) => opening.opening_id));

  if (
    activeApplicationResult?.application?.opening_id &&
    !existingIds.has(activeApplicationResult.application.opening_id)
  ) {
    const activeOpening = await resolveOpeningById(
      activeApplicationResult.application.opening_id
    );

    if (activeOpening) {
      items.unshift(activeOpening);
    }
  }

  const mappedItems = items.map((opening) =>
    mapApplicantOpening(opening, {
      activeApplication: activeApplicationResult?.application || null,
      draft,
      activeApplicationDocumentSummary,
    })
  );

  const draftOpening = draft?.opening_id
    ? await resolveOpeningById(draft.opening_id)
    : null;

  return {
    hasSavedDraft: !!draft,
    draftOpeningId: draft?.opening_id || '',
    draftOpeningTitle: draftOpening?.opening_title || '',
    draftProgramName: draftOpening?.scholarship_program?.program_name || '',
    activeApplicationId:
      activeApplicationResult?.application?.application_id || '',
    activeOpeningId: activeApplicationResult?.application?.opening_id || '',
    isApprovedScholar: !!visibleOpeningsResult.scholarRecord,
    items: mappedItems,
  };
}

async function fetchLatestVisibleProgramOpeningForUser(userId) {
  const { items } = await fetchVisibleProgramOpeningsForUser(userId);
  const latestOpening = items.length > 0 ? items[0] : null;

  if (!latestOpening) {
    return null;
  }

  return {
    opening_id: latestOpening.opening_id,
    program_id: latestOpening.program_id,
    opening_title: latestOpening.opening_title || 'Scholarship Opening',
    announcement_text: latestOpening.announcement_text || '',
    created_at: latestOpening.created_at || null,
    program_name: latestOpening.scholarship_program?.program_name || null,
  };
}

async function fetchAvailableOpeningsForMobile(userId) {
  const context = await loadStudentProfileContextByUserId(userId);
  const latestApplication = await resolveLatestBaseApplicationForUser(userId);

  const { data, error } = await supabase
    .from('program_openings')
    .select(`
      opening_id,
      program_id,
      opening_title,
      announcement_text,
      posting_status,
      allocated_slots,
      financial_allocation,
      per_scholar_amount,
      created_at,
      scholarship_program (
        program_id,
        program_name,
        benefactor_id
      )
    `)
    .eq('posting_status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];

  const benefactorIds = rows
    .map((row) => row?.scholarship_program?.benefactor_id)
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

  const existingProgramId = latestApplication?.application?.program_id ?? null;
  const existingApplicationId = latestApplication?.application?.application_id ?? null;

  const items = rows.map((row) => {
    const program = row.scholarship_program || {};
    const hasApplied =
      existingProgramId && String(existingProgramId) === String(row.program_id);

    return {
      opening_id: row.opening_id,
      program_id: row.program_id,
      opening_title: row.opening_title || 'Scholarship Opening',
      program_name: program.program_name || 'Scholarship Program',
      posting_status: row.posting_status || '',
      announcement_text: row.announcement_text || '',
      allocated_slots: row.allocated_slots ?? 0,
      financial_allocation: row.financial_allocation ?? 0,
      per_scholar_amount: row.per_scholar_amount ?? 0,
      benefactor_name: benefactorMap[program.benefactor_id] || null,
      has_applied: !!hasApplied,
      can_reapply: false,
      can_apply: !hasApplied,
      apply_label: hasApplied ? 'Already Applied' : 'Apply Now',
      existing_application_id: hasApplied ? existingApplicationId : null,
      created_at: row.created_at || null,
    };
  });

  return {
    hasBaseApplicationProfile: !!context?.student?.student_id,
    items,
  };
}

