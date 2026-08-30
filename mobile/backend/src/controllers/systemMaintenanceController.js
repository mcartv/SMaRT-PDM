const systemMaintenanceService = require('../services/systemMaintenanceService');
const { getSafeStatusCode } = require('../utils/httpStatus');

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
