import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    BookOpen,
    Plus,
    Edit,
    RefreshCw,
    Archive,
    Search,
    Loader2,
    Save,
    X,
    SlidersHorizontal,
} from 'lucide-react';
import { C, EmptyState, FieldLabel, Toggle } from './components/MaintenanceShared';
import { buildApiUrl } from '@/api';

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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-2xl border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-stone-800">
                        {isEdit ? 'Edit Academic Course' : 'Add Academic Course'}
                    </h3>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Archive Status</FieldLabel>
                            <div className="h-9 px-3 rounded-lg border border-stone-200 flex items-center bg-white">
                                <Toggle
                                    value={!form.is_archived}
                                    onChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            is_archived: !value,
                                        }))
                                    }
                                    labels={['Active', 'Archived']}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>

                <div className="px-4 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="h-8 rounded-lg border-stone-200 text-xs"
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={onSave}
                        disabled={
                            saving ||
                            !form.course_code ||
                            !form.course_name
                        }
                        className="h-8 rounded-lg text-white text-xs border-none disabled:opacity-50"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                            <Save className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {isEdit ? 'Save' : 'Create'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

function CoursesFilterModal({
    open,
    onClose,
    archiveFilter,
    setArchiveFilter,
    onApply,
    onClear,
}) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-md border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-stone-800">Filter Courses</h3>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                <CardContent className="p-4 space-y-3">
                    <div className="space-y-1.5">
                        <FieldLabel>Archive Status</FieldLabel>
                        <Select value={archiveFilter} onValueChange={setArchiveFilter}>
                            <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Archived">Archived</SelectItem>
                                <SelectItem value="All">All</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>

                <div className="px-4 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={onClear}
                        className="h-8 rounded-lg border-stone-200 text-xs"
                    >
                        Clear
                    </Button>

                    <Button
                        onClick={onApply}
                        className="h-8 rounded-lg text-white text-xs border-none"
                        style={{ background: C.brownMid }}
                    >
                        Apply
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

    const [search, setSearch] = useState('');
    const [archiveFilter, setArchiveFilter] = useState('Active');

    const [draftArchiveFilter, setDraftArchiveFilter] = useState('Active');
    const [filterOpen, setFilterOpen] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingCourseId, setEditingCourseId] = useState(null);

    const emptyForm = {
        course_code: '',
        course_name: '',
        is_archived: false,
    };

    const [form, setForm] = useState(emptyForm);

    const fetchCourses = async () => {
        const res = await fetch(buildApiUrl('/api/courses'), {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json',
            },
        });

        if (!res.ok) {
            throw new Error('Failed to load courses');
        }

        const data = await res.json();
        setCourses(Array.isArray(data) ? data : []);
    };

    const loadAll = async () => {
        try {
            setLoading(true);
            await fetchCourses();
        } catch (err) {
            console.error('COURSES FETCH ERROR:', err);
            alert(err.message || 'Failed to load maintenance data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    const filteredCourses = useMemo(() => {
        const q = search.trim().toLowerCase();

        return courses.filter((c) => {
            const matchSearch =
                !q ||
                (c.course_code || '').toLowerCase().includes(q) ||
                (c.course_name || '').toLowerCase().includes(q);

            const matchArchive =
                archiveFilter === 'All' ||
                (archiveFilter === 'Active' && !c.is_archived) ||
                (archiveFilter === 'Archived' && !!c.is_archived);

            return matchSearch && matchArchive;
        });
    }, [courses, search, archiveFilter]);

    const hasActiveFilters = archiveFilter !== 'Active';

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
            is_archived: !!course.is_archived,
        });
        setModalOpen(true);
    };

    const openFilterModal = () => {
        setDraftArchiveFilter(archiveFilter);
        setFilterOpen(true);
    };

    const applyFilters = () => {
        setArchiveFilter(draftArchiveFilter);
        setFilterOpen(false);
    };

    const clearFilters = () => {
        setArchiveFilter('Active');
        setDraftArchiveFilter('Active');
        setFilterOpen(false);
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const payload = {
                course_code: form.course_code.trim().toUpperCase(),
                course_name: form.course_name.trim(),
                is_archived: !!form.is_archived,
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
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to save course');
            }

            setModalOpen(false);
            setEditingCourseId(null);
            setForm(emptyForm);
            await fetchCourses();
        } catch (err) {
            console.error('SAVE COURSE ERROR:', err);
            alert(err.message || 'Failed to save course');
        } finally {
            setSaving(false);
        }
    };

    const handleArchiveToggle = async (course) => {
        try {
            const res = await fetch(buildApiUrl(`/api/courses/${course.course_id}`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_archived: !course.is_archived,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to update course status');
            }

            await fetchCourses();
        } catch (err) {
            console.error('ARCHIVE COURSE ERROR:', err);
            alert(err.message || 'Failed to update course status');
        }
    };

    return (
        <div className="space-y-3">
            <CourseModal
                open={modalOpen}
                mode={modalMode}
                form={form}
                setForm={setForm}
                onClose={() => {
                    setModalOpen(false);
                    setEditingCourseId(null);
                }}
                onSave={handleSave}
                saving={saving}
            />

            <CoursesFilterModal
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                archiveFilter={draftArchiveFilter}
                setArchiveFilter={setDraftArchiveFilter}
                onApply={applyFilters}
                onClear={clearFilters}
            />

            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-900">Academic Courses</h2>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={loadAll}
                        className="h-8 rounded-lg text-xs border-stone-200 text-stone-600"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Refresh
                    </Button>

                    <Button
                        size="sm"
                        className="h-8 rounded-lg text-white text-xs border-none"
                        style={{ background: C.brownMid }}
                        onClick={openCreateModal}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                    <Input
                        placeholder="Search course..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 h-8 text-xs rounded-lg border-stone-200"
                    />
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={openFilterModal}
                    className="h-8 rounded-lg text-xs border-stone-200"
                >
                    <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                    Filters
                    {hasActiveFilters && (
                        <span className="ml-1 rounded-full bg-stone-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            Active
                        </span>
                    )}
                </Button>

                {(search || hasActiveFilters) && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSearch('');
                            setArchiveFilter('Active');
                            setDraftArchiveFilter('Active');
                        }}
                        className="h-8 rounded-lg text-xs border-stone-200"
                    >
                        Reset
                    </Button>
                )}
            </div>

            <div className="rounded-lg border border-stone-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-[220px]">
                        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                    </div>
                ) : filteredCourses.length === 0 ? (
                    <div className="p-4">
                        <EmptyState
                            icon={BookOpen}
                            title="No courses found"
                            subtitle="Add a course to start."
                        />
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredCourses.map((course) => (
                            <div
                                key={course.course_id}
                                className="flex items-center justify-between px-4 py-3 hover:bg-stone-50"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-medium text-stone-900">
                                            {course.course_code}
                                        </h3>

                                        {course.is_archived && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-700">
                                                Archived
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-xs text-stone-400 mt-1 truncate">
                                        {course.course_name}
                                    </p>
                                </div>

                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => openEditModal(course)}
                                    >
                                        <Edit size={12} />
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleArchiveToggle(course)}
                                    >
                                        <Archive size={12} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}