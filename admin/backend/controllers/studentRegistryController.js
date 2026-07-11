const studentRegistryService = require('../services/studentRegistryService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

exports.getRegistry = async (req, res) => {
  try {
    const limit = req.query.limit;
    const offset = req.query.offset;

    const data = await studentRegistryService.listStudentRegistry({
      limit,
      offset,
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
  await auditLogService.logAudit({
    req,
    actionTaken: 'IMPORT_STUDENT_REGISTRY',
    module: 'Student Registry',
    entityType: 'student_registry_import',
    entityId: result?.import_batch_id || null,
    description: `Imported registrar file with ${result?.imported || 0} successful records.`,
    metadata: {
      imported: result?.imported || 0,
      total: result?.total || 0,
      failed_rows: result?.failed_rows || 0,
    },
  });

  try {
    const result = await studentRegistryService.importStudentRegistryFile({
      file: req.file,
      adminId: req.user?.admin_id || req.user?.adminId || null,
    });

    const io = req.app.get('io');
    socketEvents.maintenanceUpdated(io, {
      module: 'student_registry',
      action: 'import',
      updated_at: new Date().toISOString(),
      imported_count: result?.insertedCount ?? result?.updatedCount ?? null,
    });

    res.status(200).json({
      message: 'Registrar file imported successfully',
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
