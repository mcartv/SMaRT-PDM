'use strict';

const applicationRegistryService = require('../services/applicationRegistryService');

function readOptions(query = {}) {
    return {
        page: query.page,
        limit: query.limit,
        search: query.search || '',
        academicYear: query.academicYear || query.academic_year || 'all',
        applicationStatus:
            query.applicationStatus || query.application_status || 'all',
        documentStatus:
            query.documentStatus || query.document_status || 'all',
    };
}

exports.getApplications = async (req, res) => {
    const startedAt = process.hrtime.bigint();

    try {
        const view = String(req.query?.view || '').trim().toLowerCase();

        // Keep the original array response for older callers that do not opt in
        // to the new structured pagination contract.
        if (!view) {
            const applications =
                await applicationRegistryService.fetchRegistryApplications();

            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
            res.setHeader('Server-Timing', `applications;dur=${durationMs.toFixed(1)}`);
            res.setHeader('Cache-Control', 'private, no-store, max-age=0');
            return res.status(200).json(applications);
        }

        const options = readOptions(req.query || {});
        const includeSummary = ['1', 'true', 'yes'].includes(
            String(req.query?.includeSummary || '').trim().toLowerCase()
        );
        let payload;

        if (view === 'registry') {
            const registry = await applicationRegistryService.fetchRegistryPage(options);
            payload = { ...registry };

            if (includeSummary) {
                payload.opening_summaries =
                    await applicationRegistryService.fetchOpeningSummaries();
            }
        } else if (view === 'readiness') {
            const readiness =
                await applicationRegistryService.fetchReadinessApplications(options);
            payload = { ...readiness };

            if (includeSummary) {
                payload.opening_summaries =
                    await applicationRegistryService.fetchOpeningSummaries();
            }
        } else if (view === 'summary') {
            payload = {
                items: [],
                pagination: {
                    page: 1,
                    limit: 0,
                    total: 0,
                    totalPages: 1,
                },
                opening_summaries:
                    await applicationRegistryService.fetchOpeningSummaries(),
            };
        } else {
            return res.status(400).json({
                message: 'Invalid Applications view.',
                error: 'view must be registry, readiness, or summary',
            });
        }

        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        res.setHeader('Server-Timing', `applications;dur=${durationMs.toFixed(1)}`);
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        return res.status(200).json(payload);
    } catch (error) {
        console.error(
            'GET APPLICATIONS REGISTRY CONTROLLER ERROR:',
            error.message
        );
        return res.status(500).json({
            message: 'Failed to fetch applications',
            error: error.message || 'Unknown backend error',
        });
    }
};
