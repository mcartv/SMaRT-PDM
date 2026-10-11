// SMaRT-PDM: Student Registry — student Registry Controller (admin backend controller); handles HTTP input/output and delegates business logic.
const studentRegistryService = require('../services/studentRegistryService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

exports.getDisciplinaryRecords = async (req, res) => {
  try {
    res.json(await studentRegistryService.listSdoStudentRegistry(req.query));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.updateDisciplinaryRecord = async (req, res) => {
  try {
    const record = await studentRegistryService.updateSdoDisciplinaryRecord({
      recordId: req.params.recordId, values: req.body || {},
      actorId: req.user?.user_id || req.user?.userId || req.user?.sub || null,
    });
    await auditLogService.logAudit({
      req, actionTaken: 'UPDATE_DISCIPLINARY_CASE', module: 'Disciplinary Cases',
      entityType: 'sdo_student_records', entityId: record.record_id,
      description: `Updated disciplinary record for ${record.student_number}.`,
    }).catch(error => console.error('SDO UPDATE AUDIT ERROR:', error.message));
    socketEvents.scholarUpdated(req.app.get('io'), { student_number: record.student_number });
    res.json(record);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.previewDisciplinaryImport = async (req, res) => {
  try {
    res.json(await studentRegistryService.previewSdoDisciplinaryRecordsFile({ file: req.file }));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.importDisciplinaryRecords = async (req, res) => {
  try {
    const result = await studentRegistryService.importSdoDisciplinaryRecordsFile({
      file: req.file,
      actorId: req.user?.user_id || req.user?.userId || req.user?.sub || null,
    });
    await auditLogService.logAudit({
      req, actionTaken: 'IMPORT_DISCIPLINARY_CASES', module: 'Disciplinary Cases',
      entityType: 'sdo_student_records',
      description: `Processed ${result.imported} disciplinary cases: ${result.added} added, ${result.updated} updated.`,
      metadata: { imported: result.imported, added: result.added, updated: result.updated, total: result.total, duplicates: result.duplicate_rows },
    }).catch(error => console.error('SDO IMPORT AUDIT ERROR:', error.message));
    socketEvents.scholarUpdated(req.app.get('io'), { action: 'disciplinary_import' });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.getRegistry = async (req, res) => {
  try {
    const limit = req.query.limit;
    const offset = req.query.offset;

    const data = await studentRegistryService.listStudentRegistry({
      limit,
      offset,
      search: req.query.search,
      course: req.query.course,
      year: req.query.year,
      sex: req.query.sex,
    });

    res.json(data);
  } catch (err) {
    console.error('STUDENT REGISTRY LIST ERROR:', err.message);
    res.status(err.statusCode || 500).json({
      message: 'Failed to load registrar records',
      error: err.message,
    });
  }
};

exports.importRegistry = async (req, res) => {
  try {
    const actorId = req.user?.admin_id || req.user?.adminId || req.user?.userId || null;
    const result = await studentRegistryService.importStudentRegistryFile({ file: req.file, adminId: actorId });

    await auditLogService.logAudit({
      req,
      actionTaken: 'IMPORT_STUDENT_REGISTRY',
      module: 'Student Registry',
      entityType: 'student_registry_import',
      entityId: result?.import_batch_id || null,
      description: `Processed registrar file: ${result?.added || 0} added, ${result?.updated || 0} updated, and ${result?.failed_rows || 0} failed.`,
      metadata: {
        imported: result?.imported || 0,
        total: result?.total || 0,
        failed_rows: result?.failed_rows || 0,
        added: result?.added || 0,
        updated: result?.updated || 0,
      },
    }).catch((auditError) => {
      console.error('STUDENT REGISTRY IMPORT AUDIT ERROR:', auditError.message);
    });

    const io = req.app.get('io');
    socketEvents.maintenanceUpdated(io, {
      module: 'student_registry',
      action: 'import',
      updated_at: new Date().toISOString(),
      imported_count: result?.imported ?? null,
    });
    res.status(200).json({
      message: result?.failed_rows
        ? 'Registrar file imported with issues'
        : 'Registrar file imported successfully',
      ...result,
    });
  } catch (err) {
    console.error('STUDENT REGISTRY IMPORT ERROR:', err);
    res.status(err.statusCode || 500).json({
      message: 'Failed to import registrar file',
      error: err.message,
      details: err.details || err.hint || null,
    });
  }
};
