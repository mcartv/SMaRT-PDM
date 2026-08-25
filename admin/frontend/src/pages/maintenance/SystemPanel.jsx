import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Activity,
    Cpu,
    Database,
    HardDrive,
    Loader2,
    RefreshCw,
    Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/api';
import { GroupCard, Toggle } from './components/MaintenanceShared';
import {
    MAINTENANCE_CARD_SUBTITLE_CLASS,
    MAINTENANCE_CARD_TITLE_CLASS,
} from './components/maintenanceTypography';

const DEFAULT_STATUS = {
    maintenance: {
        maintenance_mode: false,
        maintenance_message:
            'SMaRT-PDM is temporarily unavailable while system maintenance is in progress. Please try again later.',
    },
    ocr: {
        primary: 'Tesseract + OpenCV',
        review: 'Gemini V2',
        gemini_model: 'gemini-3.6-flash',
        gemini_configured: false,
        jobs: {
            completed: 0,
            review_required: 0,
            failed: 0,
            total: 0,
        },
    },
    database: {
        pretty: 'Loading...',
        postgres_version: '',
    },
    object_storage: {
        pretty: 'Loading...',
    },
    backup: {
        pg_dump_available: false,
        pg_dump_version: '',
        fallback_available: true,
    },
};

function responseMessage(payload, fallback) {
    return payload?.error || payload?.message || fallback;
}

function fileNameFromDisposition(value) {
    const header = String(value || '');
    const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (encodedMatch?.[1]) {
        try {
            return decodeURIComponent(encodedMatch[1]);
        } catch {
            return encodedMatch[1];
        }
    }

    const basicMatch = /filename="?([^";]+)"?/i.exec(header);
    return basicMatch?.[1] || `smart-pdm-postgresql-backup-${Date.now()}.sql`;
}

export default function SystemPanel({ embedded = false, editing = true }) {
    const [status, setStatus] = useState(DEFAULT_STATUS);
    const [loading, setLoading] = useState(true);
    const [savingMaintenance, setSavingMaintenance] = useState(false);
    const [creatingBackup, setCreatingBackup] = useState(false);

    const loadStatus = useCallback(async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true);
            const token = sessionStorage.getItem('adminToken') || '';
            const response = await fetch(buildApiUrl('/api/system-maintenance/status'), {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(responseMessage(payload, 'Failed to load system status.'));
            }

            setStatus((current) => ({
                ...current,
                ...payload,
                maintenance: {
                    ...current.maintenance,
                    ...(payload.maintenance || {}),
                },
                ocr: {
                    ...current.ocr,
                    ...(payload.ocr || {}),
                    jobs: {
                        ...current.ocr.jobs,
                        ...(payload.ocr?.jobs || {}),
                    },
                },
                database: {
                    ...current.database,
                    ...(payload.database || {}),
                },
                object_storage: {
                    ...current.object_storage,
                    ...(payload.object_storage || {}),
                },
                backup: {
                    ...current.backup,
                    ...(payload.backup || {}),
                },
            }));
        } catch (error) {
            if (!silent) {
                toast.error('System status unavailable', {
                    description: error.message || 'Failed to load system status.',
                });
            }
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStatus();
        const timer = window.setInterval(() => loadStatus({ silent: true }), 30000);
        return () => window.clearInterval(timer);
    }, [loadStatus]);

    const handleMaintenanceToggle = async (nextValue) => {
        if (!editing) {
            toast.info('Editing is locked', {
                description: 'Turn on Edit mode before changing Maintenance Mode.',
            });
            return;
        }

        try {
            setSavingMaintenance(true);
            const token = sessionStorage.getItem('adminToken') || '';
            const response = await fetch(buildApiUrl('/api/system-maintenance'), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    maintenance_mode: nextValue,
                    maintenance_message: status.maintenance.maintenance_message,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(responseMessage(payload, 'Failed to update maintenance mode.'));
            }

            setStatus((current) => ({
                ...current,
                maintenance: {
                    ...current.maintenance,
                    ...payload,
                },
            }));

            toast.success(
                payload.maintenance_mode ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
                {
                    description: payload.maintenance_mode
                        ? 'The student mobile app will show a maintenance notice and block app access.'
                        : 'Student mobile app access is available again.',
                }
            );
        } catch (error) {
            toast.error('Maintenance mode update failed', {
                description: error.message || 'Failed to update maintenance mode.',
            });
        } finally {
            setSavingMaintenance(false);
        }
    };

    const handleDatabaseBackup = async () => {
        try {
            setCreatingBackup(true);
            const token = sessionStorage.getItem('adminToken') || '';
            const response = await fetch(buildApiUrl('/api/system-maintenance/backup'), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(responseMessage(payload, 'Failed to create database backup.'));
            }

            const blob = await response.blob();
            const fileName = fileNameFromDisposition(
                response.headers.get('content-disposition')
            );
            const backupMode = response.headers.get('x-smart-pdm-backup-mode') || '';
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(objectUrl);

            toast.success('Database backup downloaded', {
                description: backupMode === 'pg_dump'
                    ? 'Full PostgreSQL public-schema SQL dump created with pg_dump.'
                    : 'SQL data backup downloaded. Project migrations remain the source of truth for schema restoration.',
            });
        } catch (error) {
            toast.error('Database backup failed', {
                description: error.message || 'Failed to create database backup.',
            });
        } finally {
            setCreatingBackup(false);
        }
    };

    const jobs = status.ocr?.jobs || DEFAULT_STATUS.ocr.jobs;
    const geminiSubtitle = status.ocr?.gemini_configured
        ? 'Tesseract + OpenCV · Gemini ready'
        : 'Tesseract + OpenCV · Gemini not configured';
    const backupDescription = status.backup?.pg_dump_available
        ? status.backup?.pg_dump_version || 'Full PostgreSQL pg_dump available'
        : 'pg_dump unavailable · SQL data fallback ready';

    return (
        <div className="min-w-0 space-y-4">
            {!embedded ? (
                <div>
                    <h2 className={MAINTENANCE_CARD_TITLE_CLASS}>System Efficiency & OCR</h2>
                    <p className={MAINTENANCE_CARD_SUBTITLE_CLASS}>Live service information and maintenance controls</p>
                </div>
            ) : null}

            <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="flex min-h-28 min-w-0 flex-row items-center gap-3 border-stone-200 px-5 py-4 text-left shadow-none">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100">
                        <Cpu className="h-5 w-5 text-stone-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="break-words text-base font-semibold leading-tight text-stone-900">OCR Processing</p>
                        <p className="mt-1 break-words text-xs font-medium text-stone-500">{geminiSubtitle}</p>
                    </div>
                </Card>

                <Card className="flex min-h-28 min-w-0 flex-row items-center gap-3 border-stone-200 px-5 py-4 text-left shadow-none">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                        <Activity className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-base font-semibold leading-tight text-stone-900">
                            {loading ? 'Loading...' : `${jobs.completed || 0} completed`}
                        </p>
                        <p className="mt-1 break-words text-xs font-medium text-stone-500">
                            {jobs.review_required || 0} review · {jobs.failed || 0} failed
                        </p>
                    </div>
                </Card>

                <Card className="flex min-h-28 min-w-0 flex-row items-center gap-3 border-stone-200 px-5 py-4 text-left shadow-none">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                        <Database className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-base font-semibold leading-tight text-stone-900">{status.database?.pretty || 'Unavailable'}</p>
                        <p className="mt-1 break-words text-xs font-medium text-stone-500">
                            PostgreSQL DB{status.database?.postgres_version ? ` · v${status.database.postgres_version}` : ''}
                        </p>
                    </div>
                </Card>

                <Card className="flex min-h-28 min-w-0 flex-row items-center gap-3 border-stone-200 px-5 py-4 text-left shadow-none">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                        <HardDrive className="h-5 w-5 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-base font-semibold leading-tight text-stone-900">{status.object_storage?.pretty || 'Unavailable'}</p>
                        <p className="mt-1 text-xs font-medium text-stone-500">Supabase object storage</p>
                    </div>
                </Card>
            </div>

            <GroupCard title="Manual Overrides" icon={Settings}>
                <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="flex min-h-16 min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-stone-900">Maintenance Mode</p>
                            <p className="mt-0.5 break-words text-xs text-stone-500">
                                Blocks the student mobile app and shows a temporary maintenance notice.
                            </p>
                        </div>
                        <div className={savingMaintenance ? 'pointer-events-none opacity-60' : ''}>
                            {savingMaintenance ? (
                                <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving
                                </div>
                            ) : (
                                <Toggle
                                    value={status.maintenance?.maintenance_mode === true}
                                    onChange={handleMaintenanceToggle}
                                    labels={['Maintenance', 'Online']}
                                />
                            )}
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleDatabaseBackup}
                        disabled={creatingBackup}
                        className="min-h-16 h-auto min-w-0 justify-start rounded-xl border-stone-200 bg-white px-4 py-3 text-left text-sm font-semibold text-stone-700 hover:bg-stone-50"
                    >
                        {creatingBackup ? (
                            <Loader2 className="mr-3 h-4 w-4 shrink-0 animate-spin text-stone-500" />
                        ) : (
                            <RefreshCw className="mr-3 h-4 w-4 shrink-0 text-stone-500" />
                        )}
                        <span className="min-w-0">
                            <span className="block">{creatingBackup ? 'Creating SQL Backup...' : 'Download PostgreSQL SQL Backup'}</span>
                            <span className="mt-0.5 block break-words text-xs font-normal text-stone-500">
                                {backupDescription}
                            </span>
                        </span>
                    </Button>
                </div>
            </GroupCard>
        </div>
    );
}
