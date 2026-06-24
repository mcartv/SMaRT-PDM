const studentRegistryService = require('../services/studentRegistryService');
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
