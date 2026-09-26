'use strict';

const roController = require('./roController');
const roPaginationService = require('../services/roPaginationService');

exports.getROScholars = async (req, res) => {
  const view = String(req.query?.view || '').trim().toLowerCase();

  // Backward compatibility:
  // Existing callers such as Area Requests -> Assign Scholars keep using the
  // original full-array contract unless they explicitly request pagination.
  if (view !== 'paginated') {
    return roController.getROScholars(req, res);
  }

  try {
    const data = await roPaginationService.getROScholarsPage(
      req.query || {}
    );

    return res.status(200).json(data);
  } catch (err) {
    console.error(
      'GET PAGINATED RO SCHOLARS ERROR:',
      err.message
    );

    const statusCode = Number(
      err.statusCode || err.status || 500
    );

    return res
      .status(
        Number.isFinite(statusCode) &&
        statusCode >= 400 &&
        statusCode <= 599
          ? statusCode
          : 500
      )
      .json({
        error:
          err.message ||
          'Failed to load paginated RO scholars.',
      });
  }
};
