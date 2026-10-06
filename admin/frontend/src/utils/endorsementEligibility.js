// SMaRT-PDM: Endorsement — endorsement Eligibility (admin frontend); supports admin-side UI behavior.
export function canPdEndorse({ gradeUploaded = false } = {}) {
  return gradeUploaded === true;
}
