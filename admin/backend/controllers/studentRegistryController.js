const studentRegistryService = require('../services/studentRegistryService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

exports.getRegistry = async (req, res) => {
  try {
    const limit = req.query.limit;
    const offset = req.query.offset;

    const data = req.user?.role === 'sdo'
      ? await studentRegistryService.listSdoStudentRegistry({ limit, offset })
      : await studentRegistryService.listStudentRegistry({ limit, offset });

    res.json(data);
  } catch (err) {
    console.error('STUDENT REGISTRY LIST ERROR:', err.message);
    res.status(err.statusCode || 500).json({
      message: req.user?.role === 'sdo' ? 'Failed to load SDO disciplinary records' : 'Failed to load registrar records',
      error: err.message,
    });
  }
};

exports.importRegistry = async (req, res) => {
  try {
    const isSdo = req.user?.role === 'sdo';
    const actorId = req.user?.admin_id || req.user?.adminId || req.user?.userId || null;
    const result = isSdo
      ? await studentRegistryService.importSdoDisciplinaryRecordsFile({ file: req.file, actorId })
      : await studentRegistryService.importStudentRegistryFile({ file: req.file, adminId: actorId });

    await auditLogService.logAudit({
      req,
      actionTaken: isSdo ? 'IMPORT_SDO_DISCIPLINARY_RECORDS' : 'IMPORT_STUDENT_REGISTRY',
      module: isSdo ? 'SDO Records' : 'Student Registry',
      entityType: isSdo ? 'sdo_record_import' : 'student_registry_import',
      entityId: result?.import_batch_id || null,
      description: isSdo
        ? `Imported SDO file with ${result?.imported || 0} disciplinary records.`
        : `Imported registrar file with ${result?.imported || 0} successful records.`,
      metadata: {
        imported: result?.imported || 0,
        total: result?.total || 0,
        failed_rows: result?.failed_rows || 0,
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
    if (isSdo) {
      socketEvents.sdoRecordsUpdated(io, {
        action: 'import',
        updated_at: new Date().toISOString(),
        imported_count: result?.imported ?? 0,
        total_rows: result?.total ?? 0,
      });
    }

    res.status(200).json({
      message: isSdo ? 'SDO disciplinary records imported successfully' : 'Registrar file imported successfully',
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

exports.previewSdoImport = async (req, res) => {
  try {
    const result = await studentRegistryService.previewSdoDisciplinaryRecordsFile({
      file: req.file,
    });
    res.json(result);
  } catch (err) {
    console.error('SDO RECORD IMPORT PREVIEW ERROR:', err);
    res.status(err.statusCode || 500).json({
      message: 'Failed to preview disciplinary records',
      error: err.message,
      details: err.details || null,
    });
  }
};

exports.getSdoStudentsWithRecords = async (req, res) => {
  try {
    const data = await studentRegistryService.listSdoStudentsWithRecords({
      limit: req.query.limit,
      offset: req.query.offset,
      search: req.query.search,
      course: req.query.course,
      offense: req.query.offense,
    });
    res.json(data);
  } catch (err) {
    console.error('SDO STUDENTS WITH RECORDS ERROR:', err);
    res.status(err.statusCode || 500).json({
      message: 'Failed to load students with disciplinary records',
      error: err.message,
    });
  }
};

exports.getSdoStudentRecordHistory = async (req, res) => {
  try {
    const data = await studentRegistryService.getSdoStudentRecordHistory(
      req.params.studentNumber
    );
    res.json(data);
  } catch (err) {
    console.error('SDO STUDENT RECORD HISTORY ERROR:', err);
    res.status(err.statusCode || 500).json({
      message: 'Failed to load disciplinary record history',
      error: err.message,
    });
  }
};

exports.getSdoRecordsSummary = async (req, res) => {
  try {
    const data = await studentRegistryService.getSdoRecordsSummary();
    res.json(data);
  } catch (err) {
    console.error('SDO RECORDS SUMMARY ERROR:', err);
    res.status(err.statusCode || 500).json({
      message: 'Failed to load disciplinary records summary',
      error: err.message,
    });
  }
};
