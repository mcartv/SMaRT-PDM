'use strict';
const router = require('express').Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
const offices = require('../services/officeService');
const community = require('../services/institutionalCommunityService');
const events = require('../utils/socketEvents');
const cache = require('../config/appCache');

router.use(protect, authorizeRoles('admin'));
const view = [requirePermission('settings.view'), requirePermission('accounts.view'), requirePermission('courses.view')];
const manage = [requirePermission('settings.manage'), requirePermission('accounts.update'), requirePermission('courses.manage')];
const safe = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
        console.error('[Offices]', error.message);
        res.status(error.statusCode || (error.code === '23505' ? 409 : 500)).json({ error: error.statusCode ? error.message : error.code === '23505' ? 'An office with this name or code already exists.' : 'Unable to save or load offices. Please try again.', code: error.code, conflicts: error.conflicts });
    }
};
async function changed(req, action, office) {
    cache.invalidateNamespaces(['courses', 'accounts', 'dashboard']);
    events.maintenanceUpdated(req.app.get('io'), { module: 'offices', action, office_id: office.office_id });
}
const actorId = req => req.user?.user_id || req.user?.userId || req.user?.id || null;
router.get('/community-links', requirePermission('ro.view'), safe(async (_req, res) => {
    res.set('Cache-Control', 'no-store'); res.json(await community.getLinks());
}));
router.put('/community-links/:departmentId', requirePermission('ro.settings_manage'), safe(async (req, res) => {
    const link = await community.setLink(req.params.departmentId, req.body?.office_id, req.body?.expected_office_id, undefined, actorId(req));
    await changed(req, 'community-link', link);
    events.roUpdated(req.app.get('io'), { action: 'area-linked', department_id: link.department_id });
    res.json({ link });
}));
router.get('/options', requirePermission('courses.view'), safe(async (_req, res) => { res.set('Cache-Control', 'no-store'); res.json({ offices: await offices.options() }); }));
router.get('/:id/community-area/personnel', requirePermission('ro.settings_manage'), safe(async (req,res) => {
    res.set('Cache-Control','no-store');res.json({candidates:await require('../services/roPersonnelService').candidates(undefined,req.params.id)});
}));
router.post('/:id/community-area', requirePermission('settings.manage'), requirePermission('ro.settings_manage'), safe(async (req,res) => {
    const link = await community.createOfficeArea(req.params.id,req.body || {},actorId(req));
    await changed(req,'community-link',link);
    events.roUpdated(req.app.get('io'), { action:'area-linked', department_id:link.department_id });
    res.json({ link });
}));
router.get('/', view, safe(async (_req, res) => { res.set('Cache-Control', 'no-store'); res.json(await offices.listOffices()); }));
router.get('/:id/history', view, requirePermission('audit.view'), safe(async (req, res) => { res.set('Cache-Control', 'no-store'); res.json(await offices.history(req.params.id, req.query.page)); }));
router.post('/', manage, safe(async (req, res) => {
    const office = await offices.saveOffice(null, req.body, undefined, actorId(req));
    await changed(req, 'create', office);
    res.status(201).json({ office });
}));
router.patch('/:id', manage, safe(async (req, res) => {
    const office = await offices.saveOffice(req.params.id, req.body, undefined, actorId(req));
    await changed(req, 'update', office);
    res.json({ office });
}));
router.patch('/:id/status', requirePermission('settings.manage'), safe(async (req, res) => {
    const office = await offices.setOfficeStatus(req.params.id, req.body?.is_active, undefined, actorId(req));
    await changed(req, office.is_active ? 'restore' : 'deactivate', office);
    res.json({ office });
}));
module.exports = router;
