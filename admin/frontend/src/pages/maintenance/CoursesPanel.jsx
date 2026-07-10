import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
    X,
} from 'lucide-react';
import { C, EmptyState, FieldLabel } from './components/MaintenanceShared';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';

function CourseModal({
    open,
    mode,
    form,
    setForm,
    onClose,
    onSave,
    saving,
}) {
    if (!open) return null;

    const isEdit = mode === 'edit';

    const canSubmit =
        String(form.course_code || '').trim() &&
        String(form.course_name || '').trim();

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-2xl overflow-hidden border-stone-200 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3">
                    <div>
                        <h3 className="text-sm font-semibold text-stone-800">
                            {isEdit ? 'Edit Academic Course' : 'Add Academic Course'}
                        </h3>
                        <p className="mt-0.5 text-xs text-stone-500">
                            Manage the course code and course name used in student records.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                        disabled={saving}
                    >
                        <X size={14} />
                    </button>
                </div>

                <CardContent className="space-y-3 p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <FieldLabel>Course Code</FieldLabel>
                            <Input
                                value={form.course_code}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        course_code: e.target.value.toUpperCase(),
                                    }))
                                }
                                placeholder="e.g. BSIT"
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <FieldLabel>Course Name</FieldLabel>
                            <Input
                                value={form.course_name}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        course_name: e.target.value,
                                    }))
                                }
                                placeholder="e.g. Bachelor of Science in Information Technology"
                                className="h-9 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>
                    </div>
                </CardContent>

                <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="h-8 rounded-lg border-stone-200 text-xs"
                        disabled={saving}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={onSave}
                        disabled={saving || !canSubmit}
                        className="h-8 rounded-lg border-none text-xs text-white disabled:opacity-50"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {isEdit ? 'Save Changes' : 'Create Course'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export default function CoursesPanel() {
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
            await fetchCourses();
        } catch (err) {
            console.error('COURSES FETCH ERROR:', err);
            alert(err.message || 'Failed to load courses');
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
            if (!payload?.module || payload.module === 'courses') {
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
                    String(course.course_name || '').toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                if ((a.is_archived ? 1 : 0) !== (b.is_archived ? 1 : 0)) {
                    return (a.is_archived ? 1 : 0) - (b.is_archived ? 1 : 0);
                }

                return String(a.course_code || '').localeCompare(
                    String(b.course_code || '')
                );
            });
    }, [courses, search, pageTab]);

    const resetModal = () => {
        setModalOpen(false);
        setModalMode('create');
        setEditingCourseId(null);
        setForm(emptyForm);
    };

    const openCreateModal = () => {
        setModalMode('create');
        setEditingCourseId(null);
        setForm(emptyForm);
        setModalOpen(true);
    };

    const openEditModal = (course) => {
        setModalMode('edit');
        setEditingCourseId(course.course_id);
        setForm({
            course_code: course.course_code || '',
            course_name: course.course_name || '',
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const payload = {
                course_code: form.course_code.trim().toUpperCase(),
                course_name: form.course_name.trim(),
            };

            if (!payload.course_code) {
                throw new Error('Course code is required');
            }

            if (!payload.course_name) {
                throw new Error('Course name is required');
            }

            const isEdit = modalMode === 'edit' && editingCourseId;
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

            resetModal();
            await fetchCourses();
            setPageTab('current');
        } catch (err) {
            console.error('SAVE COURSE ERROR:', err);
            alert(err.message || 'Failed to save course');
        } finally {
            setSaving(false);
        }
    };

    const handleArchive = async (course) => {
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
        } catch (err) {
            console.error('ARCHIVE COURSE ERROR:', err);
            alert(err.message || 'Failed to archive course');
        } finally {
            setActionLoadingId(null);
        }
    };

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
        } catch (err) {
            console.error('RESTORE COURSE ERROR:', err);
            alert(err.message || 'Failed to restore course');
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
            />

            <div className="rounded-xl border border-stone-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                Course Records
                            </p>
                            <p className="mt-1 text-sm font-semibold text-stone-900">
                                {currentCount} active · {archivedCount} archived
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
                                        ? 'bg-[#7c4a2e] text-white'
                                        : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                    }`}
                            >
                                Current ({currentCount})
                            </button>

                            <button
                                type="button"
                                onClick={() => setPageTab('archived')}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${pageTab === 'archived'
                                        ? 'bg-[#7c4a2e] text-white'
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
                                        </div>

                                        <p className="mt-1 truncate text-xs text-stone-500">
                                            {course.course_name}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                        {isArchived ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 rounded-lg border-green-200 px-2 text-xs text-green-700 hover:bg-green-50"
                                                onClick={() => handleRestore(course)}
                                                disabled={isBusy}
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