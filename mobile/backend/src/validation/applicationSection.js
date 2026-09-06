'use strict';

const SECTION_OPTIONS = new Set(['A', 'B', 'C', 'D']);

function normalizeSection(value) {
  const section = String(value ?? '').trim().toUpperCase();
  return SECTION_OPTIONS.has(section) ? section : '';
}

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
