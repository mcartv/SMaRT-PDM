// Extracted document normalization/status helpers
function normalizeLookupValue(value) {
  return (value ?? '')
    .toString()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTesProgramName(programName = '') {
  const normalized = normalizeLookupValue(programName);
  return normalized === 'tes' || normalized.includes('tertiary education subsidy');
}

function isActiveApplicationRecord(application = {}) {
  if (application.is_disqualified === true) {
    return false;
  }

  return ACTIVE_APPLICATION_STATUSES.has(
    normalizeLookupValue(application.application_status)
  );
}

function inferDocumentKey(document = {}) {
  const candidates = [document.document_type, document.file_name]
    .filter(Boolean)
    .map((value) => normalizeLookupValue(value));

  for (const definition of APPLICATION_DOCUMENT_DEFINITIONS) {
    if (
      candidates.some((candidate) =>
        definition.aliases.some((alias) => candidate.includes(alias))
      )
    ) {
      return definition.id;
    }
  }

  return normalizeLookupValue(
    document.document_type || document.file_name || 'document'
  ).replace(/\s+/g, '_');
}

function deriveDocumentReviewStatus(document = {}, review = null) {
  const preferredStatus = normalizeLookupValue(review?.review_status);

  if (preferredStatus === 'verified') return 'verified';
  if (preferredStatus === 'rejected' || preferredStatus === 're upload') {
    return 'rejected';
  }
  if (preferredStatus === 'flagged') return 'flagged';
  if (document.is_submitted && document.file_url) return 'uploaded';
  return 'pending';
}

function deriveApplicationDocumentStatus(documents = []) {
  const uploadedCount = documents.filter(
    (document) => document.is_submitted || !!document.file_url
  ).length;
  const verifiedCount = documents.filter(
    (document) => deriveDocumentReviewStatus(document) === 'verified'
  ).length;
  const needsReview = documents.some((document) => {
    const status = deriveDocumentReviewStatus(document);
    return status === 'rejected' || status === 'flagged' || status === 'uploaded';
  });

  if (uploadedCount === 0) {
    return 'Missing Docs';
  }

  if (needsReview || uploadedCount < documents.length) {
    return 'Under Review';
  }

  if (verifiedCount > 0 && verifiedCount === documents.length) {
    return 'Documents Ready';
  }

  return 'Under Review';
}

function ensureDocumentCoverage(normalizedDocuments = []) {
  const documentMap = new Map(
    normalizedDocuments.map((document) => [document.id, document])
  );

  return APPLICATION_DOCUMENT_DEFINITIONS.map((definition) =>
    documentMap.get(definition.id) || {
      id: definition.id,
      document_key: definition.id,
      document_type: definition.name,
      name: definition.name,
      file_name: null,
      url: null,
      file_url: null,
      status: 'pending',
      is_submitted: false,
      admin_comment: '',
      remarks: null,
      uploaded_at: null,
      reviewed_at: null,
    }
  );
}

function resolveApplicationDocumentDefinition(documentKey = '') {
  const normalizedKey = normalizeLookupValue(documentKey);

  return APPLICATION_DOCUMENT_DEFINITIONS.find((definition) => {
    if (definition.id === normalizedKey.replace(/\s+/g, '_')) {
      return true;
    }

    return definition.aliases.some((alias) => alias === normalizedKey);
  }) || null;
}

async function listApplicationDocuments({ applicationId, uploadedBy }) {
  const { data, error } = await supabase
    .from('application_documents')
    .select('*')
    .eq('uploaded_by', uploadedBy)
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

async function ensureApplicationDocumentPlaceholders(applicationId, uploadedBy) {
  const existingDocuments = await listApplicationDocuments({
    applicationId,
    uploadedBy,
  });
  const existingTypes = new Set(
    existingDocuments
      .map((document) => document.document_type)
      .filter(Boolean)
  );

  const missingDocuments = APPLICATION_DOCUMENT_DEFINITIONS
    .filter((documentDefinition) => !existingTypes.has(documentDefinition.name))
    .map((documentDefinition) => ({
      application_id: applicationId,
      uploaded_by: uploadedBy,
      document_type: documentDefinition.name,
      is_submitted: false,
      file_url: null,
      submitted_at: null,
      remarks: null,
    }));

  if (missingDocuments.length === 0) {
    return existingDocuments;
  }

  const { error } = await supabase
    .from('application_documents')
    .insert(missingDocuments);

  if (error) {
    throw error;
  }

  return listApplicationDocuments({ applicationId, uploadedBy });
}

async function refreshApplicationDocumentStatus(applicationId, uploadedBy) {
  const savedDocuments = await listApplicationDocuments({
    applicationId,
    uploadedBy,
  });
  const nextDocumentStatus = deriveApplicationDocumentStatus(savedDocuments || []);
  const { error: applicationStatusError } = await supabase
    .from('applications')
    .update({ document_status: nextDocumentStatus })
    .eq('application_id', applicationId);

  if (applicationStatusError) {
    throw applicationStatusError;
  }

  return nextDocumentStatus;
}
