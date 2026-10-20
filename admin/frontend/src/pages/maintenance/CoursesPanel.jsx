// SMaRT-PDM: Courses — Courses Panel (admin frontend page); loads data, handles page actions, and renders the admin view.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    BookOpen,
    Plus,
    Edit,
    RefreshCw,
    Archive,
    ArchiveRestore,
    Search,
    Loader2,
    Save,
} from 'lucide-react';
import {
    C,
    EmptyState,
} from './components/MaintenanceShared';
import {
    MAINTENANCE_CARD_SUBTITLE_CLASS,
    MAINTENANCE_CARD_TITLE_CLASS,
} from './components/maintenanceTypography';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableChoice, TransferConfirmation } from './components/InstitutionalControls';
import { useRbacPermissions } from '@/context/RbacPermissionContext';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { confirmArchive } from '@/utils/confirmArchive';
import { toast } from 'sonner';

function CourseModal({ open, mode, form, setForm, onClose, onSave, saving, offices }) {
    const options = offices.filter(office => office.is_active || office.office_id === form.office_id).map(office => ({ value: office.office_id, label: office.office_name + (office.is_active ? '' : ' (Archived)'), disabled: !office.is_active }));
    return <Dialog open={open} onOpenChange={value => { if (!value && !saving) onClose(); }}><DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader className="shrink-0 border-b border-stone-100 bg-stone-50 px-4 py-3 pr-12"><DialogTitle className="text-sm font-semibold">{mode === 'edit' ? 'Update Academic Course' : 'Add Academic Course'}</DialogTitle><DialogDescription className="sr-only">Academic course details and supervising office.</DialogDescription></DialogHeader>
        <form className="flex min-h-0 flex-col" onSubmit={event => { event.preventDefault(); onSave(); }}>
            <div className="min-h-0 space-y-3 p-4" style={{ overflowY: 'auto' }}>
                <div className="space-y-1.5"><label htmlFor="course-code" className="text-xs font-medium text-muted-foreground">Course Code</label><Input id="course-code" autoFocus required maxLength={50} disabled={saving} value={form.course_code} onChange={event => setForm(previous => ({ ...previous, course_code: event.target.value.toUpperCase() }))} placeholder="e.g. BSIT" className="h-9 text-sm" /></div>
                <div className="space-y-1.5"><label htmlFor="course-name" className="text-xs font-medium text-muted-foreground">Course Name</label><Input id="course-name" required maxLength={255} disabled={saving} value={form.course_name} onChange={event => setForm(previous => ({ ...previous, course_name: event.target.value }))} placeholder="e.g. Bachelor of Science in Information Technology" className="h-9 text-sm" /></div>
                <SearchableChoice id="course-office" label="Supervising Office / Department" value={form.office_id} options={options} onChange={value => setForm(previous => ({ ...previous, office_id: value }))} disabled={saving} emptyLabel="Unassigned" />
            </div>
            <DialogFooter className="m-0 shrink-0 flex-row flex-wrap rounded-none border-stone-100 bg-stone-50 px-4 py-3"><Button type="button" variant="outline" disabled={saving} onClick={onClose} className="h-8 rounded-lg text-xs">Cancel</Button><Button type="submit" disabled={saving || !form.course_code.trim() || !form.course_name.trim()} className="h-8 rounded-lg text-xs text-white" style={{ background: C.brownMid }}>{saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{mode === 'edit' ? 'Save Changes' : 'Create Course'}</Button></DialogFooter>
        </form>
    </DialogContent></Dialog>;
}
function showNotice({ title, message }) { toast.error(title, { description: message }); }

const NEW_COURSE_DAYS = 30;

// courseCreatedTime: handles course created time for the Courses flow.
function courseCreatedTime(course) {
    const value = Date.parse(course?.created_at || '');
    return Number.isFinite(value) ? value : 0;
}

// isNewCourse: checks whether is new course for the Courses flow.
function isNewCourse(course) {
    const created = courseCreatedTime(course);
    if (!created) return false;
    const age = Date.now() - created;
    return age >= 0 && age <= NEW_COURSE_DAYS * 24 * 60 * 60 * 1000;
}

export default function CoursesPanel() {
    const { hasPermission } = useRbacPermissions();
    const canManage = hasPermission('courses.manage');
    const saveLock = useRef(false);
    const [offices, setOffices] = useState([]);
    const [transfer, setTransfer] = useState(null);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const [search, setSearch] = useState('');
    const [pageTab, setPageTab] = useState('current');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingCourseId, setEditingCourseId] = useState(null);

    const emptyForm = {
        course_code: '',
        course_name: '',
        office_id: '',
        previous_office_id: null,
    };

    const [form, setForm] = useState(emptyForm);

    const fetchCourses = useCallback(async () => {
        const res = await fetch(buildApiUrl('/api/courses'), {
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await res.json().catch(() => []);

        if (!res.ok) {
            throw new Error(data.error || data.message || 'Failed to load courses');
        }

        setCourses(Array.isArray(data) ? data : []);
    }, []);

    const loadAll = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(buildApiUrl('/api/offices/options'), { headers: { Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` }, cache: 'no-store' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to load supervising offices.');
            setOffices(result.offices || []);
            await fetchCourses();
        } catch (err) {
            console.error('COURSES FETCH ERROR:', err);
            showNotice({ title: 'Unable to load courses', message: err.message || 'Failed to load courses.' });
        } finally {
            setLoading(false);
        }
    }, [fetchCourses]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    useSocketEvent(
        'maintenance:updated',
        (payload = {}) => {
            if (!payload?.module || ['courses', 'offices'].includes(payload.module)) {
                loadAll();
            }
        },
        [loadAll]
    );

    const currentCount = useMemo(
        () => courses.filter((course) => course.is_archived !== true).length,
        [courses]
    );

    const archivedCount = useMemo(
        () => courses.filter((course) => course.is_archived === true).length,
        [courses]
    );

    const filteredCourses = useMemo(() => {
        const q = search.trim().toLowerCase();

        return courses
            .filter((course) => {
                const isArchived = course.is_archived === true;

                if (pageTab === 'current' && isArchived) return false;
                if (pageTab === 'archived' && !isArchived) return false;

                if (!q) return true;

                return (
                    String(course.course_code || '').toLowerCase().includes(q) ||
                    String(course.course_name || '').toLowerCase().includes(q) ||
                    String(course.office_name || '').toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                if ((a.is_archived ? 1 : 0) !== (b.is_archived ? 1 : 0)) {
                    return (a.is_archived ? 1 : 0) - (b.is_archived ? 1 : 0);
                }

                return courseCreatedTime(b) - courseCreatedTime(a)
                    || String(a.course_code || '').localeCompare(String(b.course_code || ''));
            });
    }, [courses, search, pageTab]);

    // resetModal: resets reset modal for the Courses flow.
    const resetModal = () => {
        setModalOpen(false);
        setModalMode('create');
        setEditingCourseId(null);
        setForm(emptyForm);
    };

    // openCreateModal: handles open create modal for the Courses flow.
    const openCreateModal = () => {
        setModalMode('create');
        setEditingCourseId(null);
        setForm(emptyForm);
        setModalOpen(true);
    };

    // openEditModal: handles open edit modal for the Courses flow.
    const openEditModal = (course) => {
        setModalMode('edit');
        setEditingCourseId(course.course_id);
        setForm({
            course_code: course.course_code || '',
            course_name: course.course_name || '',
            office_id: course.office_id || '',
            previous_office_id: course.office_id || null,
        });
        setModalOpen(true);
    };

    // handleSave: handles handle save for the Courses flow.
    const handleSave = async (confirmed = false) => {
        if (!canManage || saveLock.current) return;
        saveLock.current = true;
        try {
            setSaving(true);

            const payload = {
                course_code: form.course_code.trim().toUpperCase(),
                course_name: form.course_name.trim(),
                office_id: form.office_id || null,
                previous_office_id: form.previous_office_id || null,
                confirm_office_change: confirmed === true,
            };

            if (!payload.course_code) {
                throw new Error('Course code is required');
            }

            if (!payload.course_name) {
                throw new Error('Course name is required');
            }

            const duplicate = courses.find((course) =>
                String(course.course_code || '').trim().toUpperCase() === payload.course_code
                && String(course.course_id) !== String(editingCourseId || '')
            );
            if (duplicate) {
                showNotice({
                    title: duplicate.is_archived ? 'Course is in Archived' : 'Course already exists',
                    message: duplicate.is_archived
                        ? `${payload.course_code} already exists in Archived. Restore that course instead of creating a duplicate.`
                        : `${payload.course_code} is already in the current course list.`,
                });
                return;
            }

            const isEdit = modalMode === 'edit' && editingCourseId;
            if (isEdit && form.previous_office_id && form.previous_office_id !== payload.office_id && confirmed !== true) {
                setTransfer({ items: [{ course_id: editingCourseId, course_code: payload.course_code, from_name: offices.find(office => office.office_id === form.previous_office_id)?.office_name, to_name: offices.find(office => office.office_id === payload.office_id)?.office_name || 'Unassigned' }] });
                return;
            }
            const url = isEdit
                ? buildApiUrl(`/api/courses/${editingCourseId}`)
                : buildApiUrl('/api/courses');

            const method = isEdit ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to save course');
            }

            setTransfer(null); resetModal();
            toast.success(isEdit ? 'Course updated' : 'Course created');
            await fetchCourses();
            setPageTab('current');
        } catch (err) {
            console.error('SAVE COURSE ERROR:', err);
            showNotice({ title: 'Unable to save course', message: err.message || 'Failed to save course.' });
        } finally {
            saveLock.current = false; setSaving(false);
        }
    };

    // handleArchive: handles handle archive for the Courses flow.
    const handleArchive = async (course) => {
        const courseName = course.course_name || course.course_code || 'this course';
        if (!(await confirmArchive({ itemName: courseName }))) return;

        try {
            setActionLoadingId(course.course_id);

            const res = await fetch(
                buildApiUrl(`/api/courses/${course.course_id}/archive`),
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to archive course');
            }

            await fetchCourses();
            toast.success('Course archived', {
                description: `${course.course_code || courseName} was moved to Archived.`,
            });
        } catch (err) {
            console.error('ARCHIVE COURSE ERROR:', err);
            showNotice({ title: 'Unable to archive course', message: err.message || 'Failed to archive course.' });
        } finally {
            setActionLoadingId(null);
        }
    };

    // handleRestore: handles handle restore for the Courses flow.
    const handleRestore = async (course) => {
        try {
            setActionLoadingId(course.course_id);

            const res = await fetch(
                buildApiUrl(`/api/courses/${course.course_id}/restore`),
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to restore course');
            }

            await fetchCourses();
            setPageTab('current');
            toast.success('Course restored', {
                description: `${course.course_code || course.course_name || 'The course'} is available in the current course list.`,
            });
        } catch (err) {
            console.error('RESTORE COURSE ERROR:', err);
            showNotice({ title: 'Unable to restore course', message: err.message || 'Failed to restore course.' });
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div className="space-y-3">
            <CourseModal
                open={modalOpen}
                mode={modalMode}
                form={form}
                setForm={setForm}
                onClose={resetModal}
                onSave={handleSave}
                saving={saving}
                offices={offices}
            />
            <TransferConfirmation transfer={transfer} busy={saving} onCancel={() => setTransfer(null)} onConfirm={() => handleSave(true)} />

            <div className="rounded-xl border border-stone-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className={MAINTENANCE_CARD_TITLE_CLASS}>
                                Course Management
                            </h2>
                            <p className={MAINTENANCE_CARD_SUBTITLE_CLASS}>
                                Manage academic courses, supervising offices, and existing Program Director assignments.
                            </p>
                        </div>

                        <div className="relative w-full md:w-[320px]">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                            <Input
                                placeholder="Search course..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 rounded-lg border-stone-200 bg-white pl-9 text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-stone-100 pt-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPageTab('current')}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${pageTab === 'current'
                                    ? 'bg-[var(--portal-base)] text-white'
                                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                    }`}
                            >
                                Current ({currentCount})
                            </button>

                            <button
                                type="button"
                                onClick={() => setPageTab('archived')}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${pageTab === 'archived'
                                    ? 'bg-[var(--portal-base)] text-white'
                                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                    }`}
                            >
                                Archived ({archivedCount})
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={loadAll}
                                className="h-8 rounded-lg border-stone-200 text-xs text-stone-600"
                            >
                                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                                Refresh
                            </Button>

                            <Button
                                size="sm"
                                className="h-8 rounded-lg border-none text-xs text-white"
                                style={{ background: C.brownMid }}
                                disabled={!canManage}
                                onClick={openCreateModal}
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                {loading ? (
                    <div className="flex h-[220px] items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                    </div>
                ) : filteredCourses.length === 0 ? (
                    <div className="p-4">
                        <EmptyState
                            icon={BookOpen}
                            title={
                                pageTab === 'archived'
                                    ? 'No archived courses found'
                                    : 'No courses found'
                            }
                            subtitle={
                                pageTab === 'archived'
                                    ? 'Archived courses will appear here.'
                                    : 'Add a course to start.'
                            }
                        />
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredCourses.map((course) => {
                            const isArchived = course.is_archived === true;
                            const isBusy = actionLoadingId === course.course_id;

                            return (
                                <div
                                    key={course.course_id}
                                    className={`flex flex-col gap-3 px-4 py-3 transition md:flex-row md:items-center md:justify-between ${isArchived ? 'bg-stone-50' : 'hover:bg-stone-50'
                                        }`}
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-sm font-semibold text-stone-900">
                                                {course.course_code}
                                            </h3>

                                            {isArchived ? (
                                                <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] text-red-700">
                                                    Archived
                                                </span>
                                            ) : (
                                                <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] text-green-700">
                                                    Active
                                                </span>
                                            )}
                                            {!isArchived && isNewCourse(course) ? (
                                                <span className="rounded-full bg-[var(--portal-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--portal-base)]">
                                                    New
                                                </span>
                                            ) : null}
                                        </div>

                                        <p className="mt-1 break-words text-xs text-stone-500">
                                            {course.course_name}
                                        </p>
                                        <p className="mt-1 break-words text-xs text-stone-600">Office / Department: {course.office_name || 'Unassigned'}</p>
                                        {!isArchived ? (
                                            <p className={`mt-1 text-xs font-medium ${course.assigned_pd ? 'text-violet-700' : 'text-amber-700'}`}>
                                                {course.assigned_pd
                                                    ? `Program Director: ${course.assigned_pd.name || course.assigned_pd.email}`
                                                    : `Program Director: Unassigned${course.pending_pd_count ? ` · ${course.pending_pd_count} pending applicant${course.pending_pd_count === 1 ? '' : 's'}` : ''}`}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                        {isArchived ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 rounded-lg border-green-200 px-2 text-xs text-green-700 hover:bg-green-50"
                                                onClick={() => handleRestore(course)}
                                                disabled={isBusy || !canManage}
                                            >
                                                {isBusy ? (
                                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                                                )}
                                                Restore
                                            </Button>
                                        ) : (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 rounded-lg border-stone-200 px-2 text-xs"
                                                    onClick={() => openEditModal(course)}
                                                    disabled={isBusy}
                                                >
                                                    <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                    Edit
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 rounded-lg border-red-200 px-2 text-xs text-red-700 hover:bg-red-50"
                                                    onClick={() => handleArchive(course)}
                                                    disabled={isBusy}
                                                >
                                                    {isBusy ? (
                                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Archive className="mr-1.5 h-3.5 w-3.5" />
                                                    )}
                                                    Archive
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
