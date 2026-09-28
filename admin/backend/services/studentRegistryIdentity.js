'use strict';

function normalizeIdentityValue(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeDate(value) {
  return String(value ?? '').trim();
}

function editDistance(left, right) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function reasonablyMatchesNamePart(left, right) {
  if (!left || !right) return false;
  if (left === right || left.startsWith(right) || right.startsWith(left)) {
    return true;
  }
  const longest = Math.max(left.length, right.length);
  const allowedDistance = longest >= 8 ? 2 : 1;
  return editDistance(left, right) <= allowedDistance;
}

function evaluateRegistryIdentity(existing = {}, incoming = {}) {
  const existingLrn = normalizeIdentityValue(
    existing.learners_reference_number
  );
  const incomingLrn = normalizeIdentityValue(
    incoming.learners_reference_number
  );
  const bothHaveLrn = Boolean(existingLrn && incomingLrn);

  const existingFirst = normalizeIdentityValue(existing.first_name);
  const incomingFirst = normalizeIdentityValue(incoming.given_name);
  const existingLast = normalizeIdentityValue(existing.last_name);
  const incomingLast = normalizeIdentityValue(incoming.last_name);
  const firstComparable = Boolean(existingFirst && incomingFirst);
  const lastComparable = Boolean(existingLast && incomingLast);
  const firstMatches = firstComparable && existingFirst === incomingFirst;
  const lastMatches = lastComparable && existingLast === incomingLast;
  const firstReasonablyMatches =
    firstComparable && reasonablyMatchesNamePart(existingFirst, incomingFirst);
  const lastReasonablyMatches =
    lastComparable && reasonablyMatchesNamePart(existingLast, incomingLast);

  const existingDob = normalizeDate(existing.date_of_birth);
  const incomingDob = normalizeDate(incoming.date_of_birth);
  const birthdayMatches = Boolean(
    existingDob && incomingDob && existingDob === incomingDob
  );

  if (bothHaveLrn) {
    if (existingLrn === incomingLrn) {
      return { conflict: false, birthdayMatches, basis: 'matching_lrn' };
    }

    return {
      conflict: true,
      birthdayMatches,
      basis: 'different_lrn',
      reason: birthdayMatches
        ? 'Identity conflict: This PDM ID is already assigned to another student, and the uploaded LRN does not match the existing registry record. A matching birthday alone is not sufficient to confirm the same student. The existing identity was preserved.'
        : 'Identity conflict: This PDM ID is already assigned to another student, and the uploaded LRN does not match the existing registry record. The existing identity was preserved.',
    };
  }

  const nameHasStrongSupport =
    firstMatches ||
    lastMatches ||
    (birthdayMatches && firstReasonablyMatches && lastReasonablyMatches);
  const completelyDifferentName =
    firstComparable && lastComparable && !nameHasStrongSupport;

  if (completelyDifferentName) {
    return {
      conflict: true,
      birthdayMatches,
      basis: 'different_name_without_lrn',
      reason: birthdayMatches
        ? 'Identity conflict: This PDM ID is already assigned to another student. The uploaded name does not sufficiently match the existing registry record, and a matching birthday alone is not sufficient to confirm the same student. The existing identity was preserved.'
        : 'Identity conflict: This PDM ID is already assigned to another student. The uploaded identity information does not sufficiently match the existing registry record, so this row was not imported. The existing identity was preserved.',
    };
  }

  return {
    conflict: false,
    birthdayMatches,
    basis: nameHasStrongSupport
      ? 'supporting_name_match'
      : 'insufficient_existing_identity',
  };
}

module.exports = {
  evaluateRegistryIdentity,
  normalizeIdentityValue,
};
