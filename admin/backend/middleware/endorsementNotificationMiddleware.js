const db = require('../config/db');
const notificationService = require('../services/notificationService');
const socketEvents = require('../utils/socketEvents');

function normalizeVerificationStatus(value) {
    return String(value || '').trim().toLowerCase();
}

async function notifySdoForVerifiedApplication(req) {
    const applicationId = String(req.params?.id || '').trim();
    if (!applicationId) return [];

    const { rows } = await db.query(
        `
        SELECT
            es.slip_id,
            es.current_stage,
            a.verification_status,
            TRIM(CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name)) AS student_name
        FROM applications a
        JOIN endorsement_slips es
          ON es.application_id = a.application_id
        JOIN students s
          ON s.student_id = a.student_id
        WHERE a.application_id = $1
          AND LOWER(COALESCE(a.verification_status, '')) = 'verified'
          AND es.current_stage = 'pending_sdo'
        LIMIT 1
        `,
        [applicationId]
    );

    const row = rows[0];
    if (!row?.slip_id) return [];

    const [sdoTargets, adminTargets] = await Promise.all([
        notificationService.getStaffTargets({ roles: ['sdo'] }),
        notificationService.getStaffTargets({ roles: ['admin'] }),
    ]);
    if (!sdoTargets.length && !adminTargets.length) return [];

    const created = [];
    const io = req.app?.get?.('io');
    const studentName = String(row.student_name || '').trim() || 'A student';

    for (const target of sdoTargets) {
        const notification = await notificationService.createUserNotificationOnce({
            userId: target.user_id,
            type: 'Endorsement Slip',
            title: 'New endorsement awaiting review',
            message: `${studentName} is ready for disciplinary-standing assessment.`,
            referenceId: row.slip_id,
            referenceType: 'endorsement_slip',
        });

        // A null result means this exact notification already exists for the
        // SDO account, so repeated verification saves do not duplicate it.
        if (!notification) continue;

        const payload = {
            ...notification,
            target_user_id: target.user_id,
        };
        created.push(payload);

        if (io && typeof socketEvents?.notificationCreated === 'function') {
            socketEvents.notificationCreated(io, target.user_id, payload);
        }
    }

    for (const target of adminTargets) {
        const notification = await notificationService.createUserNotificationOnce({
            userId: target.user_id,
            type: 'Endorsement Update',
            title: `Endorsement started for ${studentName}`,
            message: `${studentName} is awaiting SDO review.`,
            referenceId: row.slip_id,
            referenceType: 'endorsement_slip',
        });

        if (!notification) continue;

        const payload = {
            ...notification,
            target_user_id: target.user_id,
        };
        created.push(payload);

        if (io && typeof socketEvents?.notificationCreated === 'function') {
            socketEvents.notificationCreated(io, target.user_id, payload);
        }
    }

    return created;
}

function notifySdoAfterSuccessfulVerification(req, res, next) {
    if (normalizeVerificationStatus(req.body?.verification_status) !== 'verified') {
        return next();
    }

    res.once('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;

        notifySdoForVerifiedApplication(req).catch((error) => {
            // Verification must stay successful even if a notification cannot
            // be delivered. The error is logged for operational visibility.
            console.error(
                'INITIAL SDO ENDORSEMENT NOTIFICATION ERROR:',
                error.message || error
            );
        });
    });

    return next();
}

module.exports = {
    notifySdoAfterSuccessfulVerification,
    notifySdoForVerifiedApplication,
};
