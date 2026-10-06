// SMaRT-PDM: Maintenance — system Maintenance Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const systemMaintenanceService = require('../services/systemMaintenanceService');
const { getSafeStatusCode } = require('../utils/httpStatus');

// getPublicState: reads and returns get public state for the Maintenance flow.
async function getPublicState(_req, res) {
  try {
    return res.status(200).json(await systemMaintenanceService.getPublicState());
  } catch (error) {
    console.error('PUBLIC MAINTENANCE STATUS ERROR:', error.message);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load maintenance status.',
    });
  }
}

module.exports = { getPublicState };
