function notImplemented(_req, res) {
  return res.status(501).json({ message: 'Not implemented yet' });
}

function getNextOcrJob(req, res) {
  return notImplemented(req, res);
}

function submitOcrJobResult(req, res) {
  return notImplemented(req, res);
}

module.exports = {
  getNextOcrJob,
  submitOcrJobResult,
};
