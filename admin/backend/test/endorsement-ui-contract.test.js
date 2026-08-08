const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const queuePath = path.resolve(__dirname, '../../frontend/src/pages/EndorsementQueue.jsx');
const queueSource = fs.readFileSync(queuePath, 'utf8');

test('Phase 3 endorsement UI exposes only official SDO choices', () => {
    assert.match(queueSource, /No Disciplinary Offense/);
    assert.match(queueSource, /With Minor Offense\/s/);
    assert.match(queueSource, /With Major Offense\/s/);
    assert.doesNotMatch(queueSource, /offenseType|incidentDate|caseReferenceNumber/);
    assert.match(queueSource, /<SelectItem value="no_offense">/);
    assert.match(queueSource, /<SelectItem value="minor_offense">/);
    assert.match(queueSource, /<SelectItem value="major_offense">/);
});

test('Phase 3 Guidance UI only exposes Good Moral Standing', () => {
    assert.match(queueSource, /Confirm Good Moral Standing/);
    assert.doesNotMatch(queueSource, /Counsel \/ Hold|Confirm Rejection|onSubmit\(row, 'reject'\)/);
});

test('Phase 3 PD UI uses explicit scholastic standing and no approve-reject action', () => {
    assert.match(queueSource, /Good Scholastic Standing/);
    assert.match(queueSource, /Average Scholastic Standing/);
    assert.doesNotMatch(queueSource, /onSubmit\(row, 'approve'\)|onSubmit\(row, 'reject'\)/);
});
