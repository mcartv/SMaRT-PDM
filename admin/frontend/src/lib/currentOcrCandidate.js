export function currentOcrCandidate(candidate, request, documentKey) {
  if (!candidate || candidate.document_key !== documentKey) return null;
  if (request?.request_id && request.request_id !== candidate.request_id) return null;
  if (request?.status === 'failed' && candidate.status !== 'failed') return null;
  return candidate;
}
