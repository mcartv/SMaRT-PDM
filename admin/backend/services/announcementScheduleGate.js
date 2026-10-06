// SMaRT-PDM: Announcements — announcement Schedule Gate (admin backend service); contains business logic and data operations.
'use strict';

// The five-second scheduler can check this clock without making an HTTP request.
// Reconcile once a minute in case a database change event was missed.
function createAnnouncementScheduleGate({ loadNextScheduledAt, now = Date.now, refreshMs = 60000,
    retryBaseMs = 30000, retryMaxMs = 300000 }) {
    let nextDueAt = Infinity;
    let refreshAt = 0;
    let generation = 0;
    let pending = null;
    let retryAt = 0;
    let retryDelayMs = retryBaseMs;

    // publicationFailed: handles publication failed for the Announcements flow.
    function publicationFailed() {
        retryAt = now() + retryDelayMs;
        retryDelayMs = Math.min(retryDelayMs * 2, retryMaxMs);
    }

    // publicationSucceeded: handles publication succeeded for the Announcements flow.
    function publicationSucceeded() {
        retryAt = 0;
        retryDelayMs = retryBaseMs;
    }

    // invalidate: handles invalidate for the Announcements flow.
    function invalidate() {
        generation += 1;
        refreshAt = 0;
    }

    // isDue: checks whether is due for the Announcements flow.
    async function isDue() {
        // Realtime cache invalidation must not bypass an outage cooldown.
        if (now() < retryAt) return false;
        if (pending) await pending;
        if (now() >= refreshAt) {
            const startedGeneration = generation;
            pending = (async () => {
                // Back off on failed reads too, so an outage cannot log every tick.
                refreshAt = now() + refreshMs;
                nextDueAt = Infinity;
                try {
                    const value = await loadNextScheduledAt();
                    const timestamp = value ? Date.parse(value) : NaN;
                    nextDueAt = Number.isFinite(timestamp) ? timestamp : Infinity;
                } finally {
                    if (generation !== startedGeneration) refreshAt = 0;
                }
            })();
            try {
                await pending;
            } finally {
                pending = null;
            }
        }
        return now() >= nextDueAt;
    }

    return { isDue, invalidate, publicationFailed, publicationSucceeded };
}

module.exports = { createAnnouncementScheduleGate };
