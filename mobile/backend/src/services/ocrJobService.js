function notImplemented() {
  throw new Error('Not implemented yet');
}

function createJob() {
  return notImplemented();
}

function listJobs() {
  return notImplemented();
}

function getNextPendingJob() {
  return notImplemented();
}

function saveJobResult() {
  return notImplemented();
}

module.exports = {
  createJob,
  listJobs,
  getNextPendingJob,
  saveJobResult,
};
