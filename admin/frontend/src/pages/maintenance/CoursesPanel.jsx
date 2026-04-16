import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Building2,
    BookOpen,
    Plus,
    Edit,
    RefreshCw,
    Archive,
    Search,
    Loader2,
    Save,
    X,
} from 'lucide-react';
import { C, EmptyState, FieldLabel, Toggle } from './components/MaintenanceShared';

function CourseModal({
    open,
    mode,
    form,
    setForm,
    onClose,
    onSave,
    saving,
    departments = [],
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
                <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">
                            {isEdit ? 'Edit Academic Course' : 'Add Academic Course'}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Maintain course codes, names, and department assignments
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <CardContent className="p-5 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                className="h-10 rounded-lg border-stone-200 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Department</FieldLabel>
                            <Select
                                value={form.department_id}
                                onValueChange={(value) =>
                                    setForm((prev) => ({ ...prev, department_id: value }))
                                }
                            >
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>

                                <SelectContent>
                                    {departments.length === 0 ? (
                                        <SelectItem value="NO_DEPARTMENT" disabled>
                                            No departments available
                                        </SelectItem>
                                    ) : (
                                        departments.map((dept) => (
                                            <SelectItem
                                                key={dept.department_id}
                                                value={dept.department_id}
                                            >
                                                {dept.department_code}
                                                {dept.department_name
                                                    ? ` - ${dept.department_name}`
                                                    : ''}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
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
                                className="h-10 rounded-lg border-stone-200 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Archive Status</FieldLabel>
                            <div className="h-10 px-3 rounded-lg border border-stone-200 flex items-center bg-white">
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

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="h-9 rounded-lg border-stone-200 text-xs"
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={onSave}
                            disabled={
                                saving ||
                                !form.course_code ||
                                !form.course_name ||
                                !form.department_id
                            }
                            className="h-9 rounded-lg text-white text-xs border-none disabled:opacity-50"
                            style={{ background: C.brownMid }}
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            {isEdit ? 'Save Changes' : 'Create Course'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function DepartmentModal({
    open,
    code,
    setCode,
    name,
    setName,
    onClose,
    onSave,
    saving,
}) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-md border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">Add Department</h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Create a new department option for academic courses
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <CardContent className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <FieldLabel>Department Code</FieldLabel>
                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="e.g. CCS"
                            className="h-10 rounded-lg border-stone-200 text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <FieldLabel>Department Full Name</FieldLabel>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. College of Computer Studies"
                            className="h-10 rounded-lg border-stone-200 text-sm"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="h-9 rounded-lg border-stone-200 text-xs"
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={onSave}
                            disabled={saving || !code.trim()}
                            className="h-9 rounded-lg text-white text-xs border-none disabled:opacity-50"
                            style={{ background: C.brownMid }}
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Add Department
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function CoursesPanel() {
    const [courses, setCourses] = useState([]);
    const [departments, setDepartments] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [departmentSaving, setDepartmentSaving] = useState(false);

    const [search, setSearch] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [archiveFilter, setArchiveFilter] = useState('Active');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingCourseId, setEditingCourseId] = useState(null);

    const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
    const [newDepartmentCode, setNewDepartmentCode] = useState('');
    const [newDepartmentName, setNewDepartmentName] = useState('');

    const emptyForm = {
        course_code: '',
        course_name: '',
        department_id: '',
        is_archived: false,
    };

    const [form, setForm] = useState(emptyForm);

    const fetchDepartments = async () => {
        const res = await fetch('http://localhost:5000/api/departments', {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json',
            },
        });

        if (!res.ok) {
            throw new Error('Failed to load departments');
        }

        const data = await res.json();
        setDepartments(Array.isArray(data) ? data.filter((d) => !d.is_archived) : []);
    };

    const fetchCourses = async () => {
        const res = await fetch('http://localhost:5000/api/courses', {
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
            await Promise.all([fetchCourses(), fetchDepartments()]);
        } catch (err) {
            console.error('COURSES/DEPARTMENTS FETCH ERROR:', err);
            alert(err.message || 'Failed to load maintenance data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    const stats = useMemo(() => {
        return {
            total: courses.length,
            active: courses.filter((c) => !c.is_archived).length,
            archived: courses.filter((c) => !!c.is_archived).length,
            departments: new Set(courses.map((c) => c.department_id).filter(Boolean)).size,
        };
    }, [courses]);

    const filteredCourses = useMemo(() => {
        const q = search.trim().toLowerCase();

        return courses.filter((c) => {
            const badgeLabel = c.department
                ? `${c.department}${c.department_name ? ` - ${c.department_name}` : ''}`
                : '';

            const matchSearch =
                !q ||
                (c.course_code || '').toLowerCase().includes(q) ||
                (c.course_name || '').toLowerCase().includes(q) ||
                badgeLabel.toLowerCase().includes(q) ||
                (c.department || '').toLowerCase().includes(q) ||
                (c.department_name || '').toLowerCase().includes(q);

            const matchDepartment =
                departmentFilter === 'All' ||
                c.department_id === departmentFilter ||
                c.department === departmentFilter;

            const matchArchive =
                archiveFilter === 'All' ||
                (archiveFilter === 'Active' && !c.is_archived) ||
                (archiveFilter === 'Archived' && !!c.is_archived);

            return matchSearch && matchDepartment && matchArchive;
        });
    }, [courses, search, departmentFilter, archiveFilter]);

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
            department_id: course.department_id || '',
            is_archived: !!course.is_archived,
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const payload = {
                course_code: form.course_code.trim().toUpperCase(),
                course_name: form.course_name.trim(),
                department_id: form.department_id,
                is_archived: !!form.is_archived,
            };

            if (!payload.course_code) {
                throw new Error('Course code is required');
            }

            if (!payload.course_name) {
                throw new Error('Course name is required');
            }

            if (!payload.department_id) {
                throw new Error('Department is required');
            }

            const isEdit = modalMode === 'edit' && editingCourseId;
            const url = isEdit
                ? `http://localhost:5000/api/courses/${editingCourseId}`
                : 'http://localhost:5000/api/courses';

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

    const handleAddDepartment = async () => {
        try {
            setDepartmentSaving(true);

            const payload = {
                department_code: newDepartmentCode.trim().toUpperCase(),
                department_name: newDepartmentName.trim() || null,
            };

            if (!payload.department_code) {
                throw new Error('Department code is required');
            }

            const res = await fetch('http://localhost:5000/api/departments', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to add department');
            }

            setDepartmentModalOpen(false);
            setNewDepartmentCode('');
            setNewDepartmentName('');
            await fetchDepartments();
        } catch (err) {
            console.error('ADD DEPARTMENT ERROR:', err);
            alert(err.message || 'Failed to add department');
        } finally {
            setDepartmentSaving(false);
        }
    };

    const handleArchiveToggle = async (course) => {
        try {
            const res = await fetch(`http://localhost:5000/api/courses/${course.course_id}`, {
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
        <div className="space-y-5">
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
                departments={departments}
            />

            <DepartmentModal
                open={departmentModalOpen}
                code={newDepartmentCode}
                setCode={setNewDepartmentCode}
                name={newDepartmentName}
                setName={setNewDepartmentName}
                onClose={() => {
                    setDepartmentModalOpen(false);
                    setNewDepartmentCode('');
                    setNewDepartmentName('');
                }}
                onSave={handleAddDepartment}
                saving={departmentSaving}
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-stone-900">Academic Courses</h2>
                    <p className="text-sm text-stone-500">
                        Manage academic course registry used across student and scholar records
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={loadAll}
                        className="rounded-lg text-xs border-stone-200 text-stone-600"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Refresh
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg text-xs border-stone-200 text-stone-600"
                        onClick={() => setDepartmentModalOpen(true)}
                    >
                        <Building2 className="w-3.5 h-3.5 mr-1.5" />
                        Add Department
                    </Button>

                    <Button
                        size="sm"
                        className="rounded-lg text-white text-xs border-none"
                        style={{ background: C.brownMid }}
                        onClick={openCreateModal}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Add Course
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: C.amberSoft }}
                        >
                            <BookOpen className="w-4 h-4 text-amber-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.total}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Total Courses</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: C.greenSoft }}
                        >
                            <BookOpen className="w-4 h-4 text-green-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.active}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Active</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: C.blueSoft }}
                        >
                            <Building2 className="w-4 h-4 text-blue-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.departments}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Departments Used</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-stone-100">
                            <Archive className="w-4 h-4 text-stone-600" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.archived}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Archived</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[260px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
                    <Input
                        placeholder="Search course code, course name, or department..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
                    />
                </div>

                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[220px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Departments</SelectItem>
                        {departments.map((dept) => (
                            <SelectItem key={dept.department_id} value={dept.department_id}>
                                {dept.department_code}
                                {dept.department_name ? ` - ${dept.department_name}` : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={archiveFilter} onValueChange={setArchiveFilter}>
                    <SelectTrigger className="w-[145px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Records</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                    </SelectContent>
                </Select>

                {(search || departmentFilter !== 'All' || archiveFilter !== 'Active') && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSearch('');
                            setDepartmentFilter('All');
                            setArchiveFilter('Active');
                        }}
                        className="h-9 rounded-lg text-xs border-stone-200"
                    >
                        Reset
                    </Button>
                )}
            </div>

            <Card className="border-stone-200 shadow-none overflow-hidden">
                <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
                    <div>
                        <CardTitle className="text-sm font-semibold text-stone-800">
                            Course Registry
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Academic course records linked to departments
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[240px] gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
                            <p className="text-xs text-stone-400 uppercase tracking-widest">
                                Loading courses...
                            </p>
                        </div>
                    ) : filteredCourses.length === 0 ? (
                        <EmptyState
                            icon={BookOpen}
                            title="No courses found"
                            subtitle="Click the add button above to create a course."
                        />
                    ) : (
                        <div className="space-y-3">
                            {filteredCourses.map((c) => {
                                const departmentLabel = c.department
                                    ? `${c.department}${c.department_name ? ` - ${c.department_name}` : ''}`
                                    : 'No department';

                                return (
                                    <div
                                        key={c.course_id}
                                        className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition-colors"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm font-semibold text-stone-900">
                                                        {c.course_code}
                                                    </h3>

                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] border-stone-200 bg-white text-stone-600"
                                                    >
                                                        {departmentLabel}
                                                    </Badge>

                                                    {c.is_archived && (
                                                        <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                                                            Archived
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                                                    {c.course_name || 'No course name available.'}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 px-3 rounded-lg border-stone-200 text-stone-600 hover:bg-stone-50 text-xs shadow-none"
                                                    onClick={() => openEditModal(c)}
                                                >
                                                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                                                    Edit
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className={`h-8 px-3 rounded-lg text-xs shadow-none ${c.is_archived
                                                        ? 'border-green-200 text-green-700 hover:bg-green-50'
                                                        : 'border-red-200 text-red-700 hover:bg-red-50'
                                                        }`}
                                                    onClick={() => handleArchiveToggle(c)}
                                                >
                                                    {c.is_archived ? (
                                                        <>
                                                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                                            Restore
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Archive className="w-3.5 h-3.5 mr-1.5" />
                                                            Archive
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}