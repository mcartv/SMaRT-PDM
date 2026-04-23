function notImplemented(_req, res) {
  return res.status(501).json({ message: 'Not implemented yet' });
}

function createOcrJob(req, res) {
  return notImplemented(req, res);
}

function getOcrJobs(req, res) {
  return notImplemented(req, res);
}

module.exports = {
  createOcrJob,
  getOcrJobs,
};
