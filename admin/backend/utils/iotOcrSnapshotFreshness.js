'use strict';

function toTimestamp(value) {
    if (!value) return null;

    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
}

function isRequestBoundSnapshotFresh({
    request = null,
    ocrRow = null,
} = {}) {
    if (!request || !ocrRow) return false;

    const status = String(request.status || '').trim().toLowerCase();
    if (status !== 'completed') return false;

    const requestCreatedAt = toTimestamp(request.created_at);
    const snapshotUpdatedAt = toTimestamp(
        ocrRow.updated_at || ocrRow.scanned_at
    );

    if (requestCreatedAt === null || snapshotUpdatedAt === null) {
        return false;
    }

    return snapshotUpdatedAt >= requestCreatedAt;
}

module.exports = {
    isRequestBoundSnapshotFresh,
    toTimestamp,
};
