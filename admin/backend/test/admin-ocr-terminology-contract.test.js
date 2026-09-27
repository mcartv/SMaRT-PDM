const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const frontend = path.join(__dirname, '..', '..', 'frontend', 'src');
const read = (relative) => fs.readFileSync(path.join(frontend, relative), 'utf8');

test('Admin-visible OCR terminology uses Local and Enhanced OCR', () => {
    const files = [];
    const walk = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(fullPath);
            else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(fullPath);
        }
    };
    walk(frontend);
    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(source, /\bGemini\b|\bArtificial Intelligence\b|\bAI\b/i, file);
    }
    const verification = read('pages/DocumentVerification.jsx');
    assert.match(verification, /Version 1 - Local OCR/);
    assert.match(verification, /Version 2 - Enhanced OCR/);
});
