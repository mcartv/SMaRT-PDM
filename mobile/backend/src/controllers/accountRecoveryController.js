// SMaRT-PDM: Accounts — account Recovery Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const supabase = require('../config/supabase');
const { transporter, mailFrom } = require('../config/mailer');
const { resolveStudentByUserId } = require('../services/studentAccountService');
const { resolveAvatarUrl } = require('../services/avatarService');
const { createAccountRecoveryService } = require('../services/accountRecoveryService');
const { getSafeStatusCode } = require('../utils/httpStatus');

// createHttpError: creates create http error for the Accounts flow.
function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

const recoveryService = createAccountRecoveryService({
    supabase,
    resolveStudentByUserId,
    resolveAvatarUrl,
    createHttpError,
    transporter,
    mailFrom,
});

// handle: handles handle for the Accounts flow.
async function handle(res, action, fallbackMessage) {
    try {
        const result = await action();
        return res.status(200).json(result);
    } catch (error) {
        console.error('ACCOUNT RECOVERY ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || fallbackMessage,
        });
    }
}

// lookup: handles lookup for the Accounts flow.
async function lookup(req, res) {
    return handle(
        res,
        async () => ({
            accounts: await recoveryService.lookupAccounts(req.body?.identifier || ''),
        }),
        'Failed to look up recovery accounts.'
    );
}

// start: handles start for the Accounts flow.
async function start(req, res) {
    return handle(
        res,
        () => recoveryService.startRecovery({ userId: req.body?.user_id }),
        'Failed to start account recovery.'
    );
}

// resendCode: handles resend code for the Accounts flow.
async function resendCode(req, res) {
    return handle(
        res,
        () => recoveryService.resendRecoveryCode(req.body?.session_id),
        'Failed to resend the recovery code.'
    );
}

// verifyCode: verifies verify code for the Accounts flow.
async function verifyCode(req, res) {
    return handle(
        res,
        () =>
            recoveryService.verifyRecoveryCode({
                sessionId: req.body?.session_id,
                code: req.body?.code,
            }),
        'Failed to verify the recovery code.'
    );
}

// resetPassword: resets reset password for the Accounts flow.
async function resetPassword(req, res) {
    return handle(
        res,
        () =>
            recoveryService.resetPassword({
                resetToken: req.body?.reset_token,
                newPassword: req.body?.new_password,
            }),
        'Failed to reset the password.'
    );
}

module.exports = {
    lookup,
    start,
    resendCode,
    verifyCode,
    resetPassword,
};
