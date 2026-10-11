const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
    const state = { student: { student_number: 'PDM-2023-000001' }, cases: [], caseError: null, user: null, writes: 0, mail: 0, numbers: [] };
    const supabase = { from(table) {
        const query = {
            select() { return this; }, eq(key, value) {
                if (table === 'sdo_student_records') assert.equal(value, false);
                return this;
            },
            in(key, values) { state.numbers = values; return this; },
            then(resolve, reject) { return Promise.resolve({ data: state.cases, error: state.caseError }).then(resolve, reject); },
            maybeSingle() { return Promise.resolve({ data: state.user, error: null }); },
            insert() { state.writes++; throw new Error('Unexpected account write'); },
        };
        return query;
    } };
    const dependencies = {
        '../config/supabase': supabase,
        bcrypt: { hash: async () => 'hash' },
        '../config/mailer': { mailFrom: 'test', transporter: { sendMail: async () => { state.mail++; } } },
        '../middleware/authMiddleware': { buildAuthToken: () => 'token' },
        '../utils/emailValidation': { validateEmail: email => ({ valid: true, email }) },
        './studentAccountService': {
            normalizeStudentNumber: value => String(value || '').trim().toUpperCase(),
            resolveRegistrarStudentByStudentNumber: async () => state.student,
            resolveStudentByUserId: async () => null,
            ensureStudentFromMasterRecord: async () => { state.writes++; },
        },
    };
    const context = { module: { exports: {} }, require: name => {
        assert.ok(name in dependencies, name); return dependencies[name];
    }, console, process: { env: {} } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/authService.js'), 'utf8'), context);
    return { state, service: context.module.exports };
}

const registration = { student_id: 'PDM-2023-000001', email: 'student@example.com', password: 'password123' };
const blocked = error => error.statusCode === 403 && /cannot sign up.*major disciplinary offense.*Student ID.*SDO/.test(error.message);

test('major SDO cases block lookup and direct signup before OTP or account creation', async () => {
    for (const offense of ['Major', ' Major Offense ', 'MAJOR_OFFENSE', 'Major Disciplinary Offense']) {
        const { service, state } = harness();
        state.cases = [{ record_id: 1, offense_type: offense }];
        await assert.rejects(service.checkStudentId(registration), blocked);
        await assert.rejects(service.register(registration), blocked);
        assert.equal(state.mail, 0);
        assert.equal(state.writes, 0);
        assert.equal(service.pendingRegistrationStore.size, 0);
    }
});

test('legacy master major offense also blocks signup', async () => {
    const { service, state } = harness();
    state.student.has_disciplinary_action = true;
    state.student.offense_type = 'Major Offense';
    await assert.rejects(service.register(registration), blocked);
    assert.equal(state.mail, 0);
});

test('clear students can proceed and both registry identifiers are checked', async () => {
    const { service, state } = harness();
    state.student.pdm_id = 'PDM-2024-000002';
    assert.equal((await service.checkStudentId(registration)).exists, true);
    await service.register(registration);
    assert.equal(state.mail, 1);
    assert.ok(state.numbers.includes(state.student.pdm_id));
    assert.equal(state.writes, 0);
});

test('case imported after OTP issuance blocks resend and final verification', async () => {
    const { service, state } = harness();
    await service.register(registration);
    const otp = service.otpStore.get(registration.email).otp;
    state.cases = [{ record_id: 2, offense_type: 'Major Offense' }];
    await assert.rejects(service.resendOtp({ email: registration.email }), blocked);
    await assert.rejects(service.verifyOtp({ email: registration.email, otp }), blocked);
    assert.equal(state.mail, 1);
    assert.equal(state.writes, 0);
    assert.equal(service.pendingRegistrationStore.size, 0);
});

test('SDO lookup failure prevents registration rather than granting clearance', async () => {
    const { service, state } = harness();
    state.caseError = { code: 'PGRST205' };
    await assert.rejects(service.register(registration), error => error.statusCode === 503);
    assert.equal(state.mail, 0);
});

test('existing accounts still reach login instead of being treated as new registrations', async () => {
    const { service, state } = harness();
    state.user = { user_id: 42 };
    state.student.has_disciplinary_action = true;
    assert.equal((await service.checkStudentId(registration)).hasAccount, true);
});

test('minor offenses and a disciplinary flag without a major classification allow signup', async () => {
    for (const offense of ['Minor Offense', 'minor', null]) {
        const { service, state } = harness();
        state.student.has_disciplinary_action = true;
        state.student.offense_type = offense;
        state.cases = [{ offense_type: 'Minor Offense' }];
        assert.equal((await service.checkStudentId(registration)).exists, true);
        await service.register(registration);
        assert.equal(state.mail, 1);
    }
});

test('a minor record does not hide another major record for the same student', async () => {
    const { service, state } = harness();
    state.student.offense_type = 'Minor';
    state.cases = [{ offense_type: 'Minor' }, { offense_type: 'Major' }];
    await assert.rejects(service.register(registration), blocked);
    assert.equal(state.mail, 0);
});
