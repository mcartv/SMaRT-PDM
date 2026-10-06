// SMaRT-PDM: Applications — application Section (mobile backend); supports mobile API behavior.
'use strict';

const SECTION_OPTIONS = new Set(['A', 'B', 'C', 'D']);

// normalizeSection: normalizes normalize section for the Applications flow.
function normalizeSection(value) {
  const section = String(value ?? '').trim().toUpperCase();
  return SECTION_OPTIONS.has(section) ? section : '';
}

// validateSection: validates validate section for the Applications flow.
function validateSection(academic = {}, { required = false } = {}) {
  academic = academic || {};
  const values = [academic.current_section, academic.section]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '');
  if ((required && values.length === 0) || values.some((value) => !normalizeSection(value))) {
    const error = new Error('Section must be A, B, C, or D.');
    error.statusCode = 400;
    throw error;
  }
}

module.exports = { normalizeSection, validateSection };
