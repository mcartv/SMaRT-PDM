const crypto = require('crypto');
const requests = require('./iotOcrRequestService');
const socketEvents = require('../utils/socketEvents');

const owner = () => `recovery:${process.pid}:${crypto.randomUUID()}`;

function staleSeconds() {
    return Math.min(3600, Math.max(30, Number.parseInt(process.env.OCR_PROCESSING_STALE_SECONDS || '180', 10) || 180));
}

async function processOne(request) {
    const services = {
        birth_certificate: require('./birthOcrV2Service'),
        student_grade_forms: require('./gradeOcrV2Service'),
        certificate_of_indigency: require('./indigencyOcrV2Service'),
    };
    const service = services[request.document_key];
    if (!service?.completeUploads || request.ocr_version !== 'v2') return;
    try {
        const result = await service.completeUploads({
            requestId: request.request_id,
            deviceId: request.claimed_by,
            diagnostic: request.ocr_processing_metadata?.diagnostic || null,
        });
        if (global._applicationIo && result?.request) {
            socketEvents.applicationOcrStatus(global._applicationIo, result.request);
        }
        console.info('OCR_RETRY_SUCCEEDED', { request_id: request.request_id.slice(0, 8), document_key: request.document_key, attempt: request.processing_attempt_count });
    } catch (error) {
        const retryScheduled = error.request?.status === 'processing';
        if (!retryScheduled) {
            const terminal = await requests.failProcessing({
                requestId: request.request_id,
                errorCode: error.code || 'OCR_ARTIFACT_OR_PROCESSING_FAILED',
                errorMessage: error.message,
            });
            if (global._applicationIo && terminal) socketEvents.applicationOcrStatus(global._applicationIo, terminal);
        }
        console.error('OCR_RETRY_PROCESSING_ERROR', { request_id: request.request_id.slice(0, 8), document_key: request.document_key, code: error.code || null });
    }
}

async function reconcileOnce() {
    const request = await requests.claimDueOrStaleProcessing({ owner: owner(), staleSeconds: staleSeconds() });
    if (!request) return false;
    console.info('OCR_RETRY_CLAIMED', { request_id: request.request_id.slice(0, 8), document_key: request.document_key, attempt: request.processing_attempt_count });
    await processOne(request);
    return true;
}

function start() {
    const interval = setInterval(() => reconcileOnce().catch((error) => console.error('OCR_RECONCILIATION_ERROR', { code: error.code || null })), 5000);
    interval.unref?.();
    return interval;
}

module.exports = { reconcileOnce, start, processOne };
