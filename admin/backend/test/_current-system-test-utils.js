'use strict';

const fs = require('node:fs');
const path = require('node:path');

const adminRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(adminRoot, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(adminRoot, relativePath));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  adminRoot,
  read,
  exists,
  escapeRegex,
};
