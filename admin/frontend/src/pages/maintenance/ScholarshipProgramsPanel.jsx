import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Archive,
  ArchiveRestore,
  Building2,
  ChevronDown,
  ChevronUp,
  Edit,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  X,
} from 'lucide-react';
import {
  C,
  EmptyState,
  FieldLabel,
  Toggle,
} from './components/MaintenanceShared';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';

const EMPTY_BENEFACTOR = {
  benefactor_name: '',
  benefactor_type: 'Public',
  description: '',
  is_archived: false,
};

const EMPTY_PROGRAM = {
  benefactor_id: '',
  program_name: '',
  description: '',
  target_audience: 'Applicants',
  gwa_threshold: null,
  renewal_cycle: 'Semester',
  visibility_status: 'Published',
  is_archived: false,
};

function ModalShell({ open, title, onClose, children, footer, maxWidth = 'max-w-4xl' }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className={`w-full ${maxWidth} overflow-hidden border-stone-200 shadow-xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <CardContent className="max-h-[calc(90vh-130px)] overflow-y-auto p-4">
          {children}
        </CardContent>

        <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3">
          {footer}
        </div>
      </Card>
    </div>
  );
}

function BenefactorFields({ form, setForm, includeArchive = true }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="space-y-1.5 md:col-span-2">
        <FieldLabel>Benefactor Name *</FieldLabel>
        <Input
          value={form.benefactor_name}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              benefactor_name: event.target.value,
            }))
          }
          placeholder="e.g. CHED / UNIFAST"
          className="h-9 rounded-lg border-stone-200 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Benefactor Type *</FieldLabel>
        <Select
          value={form.benefactor_type}
          onValueChange={(value) =>
            setForm((previous) => ({ ...previous, benefactor_type: value }))
          }
        >
          <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Public">Public</SelectItem>
            <SelectItem value="Private">Private</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {includeArchive ? (
        <div className="space-y-1.5">
          <FieldLabel>Benefactor Status</FieldLabel>
          <div className="flex h-9 items-center rounded-lg border border-stone-200 bg-white px-3">
            <Toggle
              value={!form.is_archived}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  is_archived: !value,
                }))
              }
              labels={['Active', 'Archived']}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5 md:col-span-2">
        <FieldLabel>Benefactor Description</FieldLabel>
        <Textarea
          value={form.description}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              description: event.target.value,
            }))
          }
          placeholder="Optional notes about the scholarship provider..."
          className="min-h-[88px] resize-none rounded-lg border-stone-200 text-sm"
        />
      </div>
    </div>
  );
}

function ProgramFields({ form, setForm, includeBenefactor = false, benefactors = [] }) {
  const noGwaThreshold = form.gwa_threshold === null;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {includeBenefactor ? (
        <div className="space-y-1.5 md:col-span-2">
          <FieldLabel>Benefactor *</FieldLabel>
          <Select
            value={form.benefactor_id}
            onValueChange={(value) =>
              setForm((previous) => ({ ...previous, benefactor_id: value }))
            }
          >
            <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
              <SelectValue placeholder="Select benefactor" />
            </SelectTrigger>
            <SelectContent>
              {benefactors.map((benefactor) => (
                <SelectItem
                  key={benefactor.benefactor_id}
                  value={benefactor.benefactor_id}
                >
                  {benefactor.benefactor_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5 md:col-span-2">
        <FieldLabel>Scholarship Program *</FieldLabel>
        <Input
          value={form.program_name}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              program_name: event.target.value,
            }))
          }
          placeholder="e.g. TES - Tertiary Education Subsidy"
          className="h-9 rounded-lg border-stone-200 text-sm"
        />
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <FieldLabel>Program Description</FieldLabel>
        <Textarea
          value={form.description}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              description: event.target.value,
            }))
          }
          placeholder="Program notes, eligibility details, or internal guidance..."
          className="min-h-[88px] resize-none rounded-lg border-stone-200 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Target Audience</FieldLabel>
        <Select
          value={form.target_audience}
          onValueChange={(value) =>
            setForm((previous) => ({ ...previous, target_audience: value }))
          }
        >
          <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Applicants">Applicants Only</SelectItem>
            <SelectItem value="Scholars">Scholars Only</SelectItem>
            <SelectItem value="Both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Renewal Cycle</FieldLabel>
        <Select
          value={form.renewal_cycle}
          onValueChange={(value) =>
            setForm((previous) => ({ ...previous, renewal_cycle: value }))
          }
        >
          <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Semester">Semester</SelectItem>
            <SelectItem value="Annual">Annual</SelectItem>
            <SelectItem value="None">None</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>GWA Threshold</FieldLabel>
        <div className="mb-2 flex h-9 items-center rounded-lg border border-stone-200 bg-white px-3">
          <Toggle
            value={noGwaThreshold}
            onChange={(nextNoThreshold) =>
              setForm((previous) => ({
                ...previous,
                gwa_threshold: nextNoThreshold
                  ? null
                  : previous.gwa_threshold === null
                    ? ''
                    : previous.gwa_threshold,
              }))
            }
            labels={['No Threshold', 'With Threshold']}
          />
        </div>
        <Input
          type="number"
          step="0.01"
          min="0"
          disabled={noGwaThreshold}
          value={noGwaThreshold ? '' : form.gwa_threshold}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              gwa_threshold: event.target.value,
            }))
          }
          placeholder="e.g. 2.00"
          className="h-9 rounded-lg border-stone-200 text-sm disabled:bg-stone-100 disabled:text-stone-400"
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Program Status</FieldLabel>
        <Select
          value={form.visibility_status}
          onValueChange={(value) =>
            setForm((previous) => ({
              ...previous,
              visibility_status: value,
            }))
          }
        >
          <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Published">Published</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function statusBadge(isArchived) {
  return isArchived
    ? 'border-stone-200 bg-stone-100 text-stone-600'
    : 'border-emerald-100 bg-emerald-50 text-emerald-700';
}

function ProgramRow({ program, onEdit, onArchive }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-stone-900">
            {program.program_name}
          </p>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge(
              program.is_archived
            )}`}
          >
            {program.is_archived ? 'Archived' : program.visibility_status || 'Published'}
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          {program.target_audience || 'Applicants'} ·{' '}
          {program.renewal_cycle || 'Semester'} renewal
          {program.gwa_threshold !== null && program.gwa_threshold !== undefined
            ? ` · GWA ${program.gwa_threshold}`
            : ' · No GWA threshold'}
        </p>
        {program.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">
            {program.description}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEdit(program)}
          className="h-8 rounded-lg border-stone-200 px-3 text-xs"
        >
          <Edit className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onArchive(program)}
          className="h-8 rounded-lg border-stone-200 px-3 text-xs"
        >
          {program.is_archived ? (
            <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <Archive className="mr-1.5 h-3.5 w-3.5" />
          )}
          {program.is_archived ? 'Restore' : 'Archive'}
        </Button>
      </div>
    </div>
  );
}

export default function ScholarshipProgramsPanel() {
  const [benefactors, setBenefactors] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [pageTab, setPageTab] = useState('current');
  const [expanded, setExpanded] = useState({});

  const [createOpen, setCreateOpen] = useState(false);
  const [createBenefactorForm, setCreateBenefactorForm] = useState({
    ...EMPTY_BENEFACTOR,
  });
  const [createProgramForm, setCreateProgramForm] = useState({
    ...EMPTY_PROGRAM,
  });

  const [benefactorModalOpen, setBenefactorModalOpen] = useState(false);
  const [editingBenefactorId, setEditingBenefactorId] = useState(null);
  const [benefactorForm, setBenefactorForm] = useState({
    ...EMPTY_BENEFACTOR,
  });

  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [programMode, setProgramMode] = useState('create');
  const [editingProgramId, setEditingProgramId] = useState(null);
  const [programForm, setProgramForm] = useState({ ...EMPTY_PROGRAM });

  const authHeaders = () => ({
    Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
    'Content-Type': 'application/json',
  });

  const requestJson = async (url, options = {}) => {
    const response = await fetch(buildApiUrl(url), {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const [benefactorRows, programRows] = await Promise.all([
        requestJson('/api/benefactors'),
        requestJson('/api/scholarship-program'),
      ]);

      setBenefactors(Array.isArray(benefactorRows) ? benefactorRows : []);
      setPrograms(Array.isArray(programRows) ? programRows : []);
    } catch (error) {
      console.error('SCHOLARSHIP PROGRAMS MAINTENANCE FETCH ERROR:', error);
      alert(error.message || 'Failed to load scholarship program maintenance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useSocketEvent(
    'maintenance:updated',
    () => {
      loadAll();
    },
    []
  );

  const programsByBenefactor = useMemo(() => {
    const map = new Map();

    programs.forEach((program) => {
      const key = String(program.benefactor_id || '');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(program);
    });

    map.forEach((rows) => {
      rows.sort((left, right) =>
        String(left.program_name || '').localeCompare(
          String(right.program_name || '')
        )
      );
    });

    return map;
  }, [programs]);

  const filteredBenefactors = useMemo(() => {
    const query = search.trim().toLowerCase();

    return benefactors
      .filter((benefactor) => {
        const isArchived = benefactor.is_archived === true;
        if (pageTab === 'current' && isArchived) return false;
        if (pageTab === 'archived' && !isArchived) return false;

        if (!query) return true;

        const linkedPrograms =
          programsByBenefactor.get(String(benefactor.benefactor_id)) || [];

        return (
          String(benefactor.benefactor_name || '')
            .toLowerCase()
            .includes(query) ||
          String(benefactor.benefactor_type || '')
            .toLowerCase()
            .includes(query) ||
          String(benefactor.description || '')
            .toLowerCase()
            .includes(query) ||
          linkedPrograms.some(
            (program) =>
              String(program.program_name || '')
                .toLowerCase()
                .includes(query) ||
              String(program.description || '')
                .toLowerCase()
                .includes(query)
          )
        );
      })
      .sort((left, right) =>
        String(left.benefactor_name || '').localeCompare(
          String(right.benefactor_name || '')
        )
      );
  }, [benefactors, pageTab, programsByBenefactor, search]);

  const openCombinedCreate = () => {
    setCreateBenefactorForm({ ...EMPTY_BENEFACTOR });
    setCreateProgramForm({ ...EMPTY_PROGRAM });
    setCreateOpen(true);
  };

  const handleCombinedCreate = async () => {
    try {
      setSaving(true);

      const benefactorPayload = {
        benefactor_name: createBenefactorForm.benefactor_name.trim(),
        benefactor_type: createBenefactorForm.benefactor_type,
        description: createBenefactorForm.description?.trim() || null,
        is_archived: false,
      };

      const programPayload = {
        program_name: createProgramForm.program_name.trim(),
        description: createProgramForm.description?.trim() || null,
        target_audience: createProgramForm.target_audience,
        gwa_threshold:
          createProgramForm.gwa_threshold === null ||
          createProgramForm.gwa_threshold === ''
            ? null
            : Number(createProgramForm.gwa_threshold),
        renewal_cycle: createProgramForm.renewal_cycle,
        visibility_status: createProgramForm.visibility_status,
        is_archived: false,
      };

      if (!benefactorPayload.benefactor_name) {
        throw new Error('Benefactor name is required');
      }
      if (!programPayload.program_name) {
        throw new Error('Program name is required');
      }

      const created = await requestJson('/api/benefactors/with-program', {
        method: 'POST',
        body: JSON.stringify({
          benefactor: benefactorPayload,
          program: programPayload,
        }),
      });

      setCreateOpen(false);
      await loadAll();

      const newBenefactorId = created?.benefactor?.benefactor_id;
      if (newBenefactorId) {
        setExpanded((previous) => ({
          ...previous,
          [newBenefactorId]: true,
        }));
      }
    } catch (error) {
      console.error('CREATE BENEFACTOR WITH PROGRAM ERROR:', error);
      alert(error.message || 'Failed to create benefactor and program');
    } finally {
      setSaving(false);
    }
  };

  const openBenefactorEdit = (benefactor) => {
    setEditingBenefactorId(benefactor.benefactor_id);
    setBenefactorForm({
      benefactor_name: benefactor.benefactor_name || '',
      benefactor_type: benefactor.benefactor_type || 'Public',
      description: benefactor.description || '',
      is_archived: !!benefactor.is_archived,
    });
    setBenefactorModalOpen(true);
  };

  const saveBenefactor = async () => {
    try {
      setSaving(true);
      await requestJson(`/api/benefactors/${editingBenefactorId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          benefactor_name: benefactorForm.benefactor_name.trim(),
          benefactor_type: benefactorForm.benefactor_type,
          description: benefactorForm.description?.trim() || null,
          is_archived: !!benefactorForm.is_archived,
        }),
      });

      setBenefactorModalOpen(false);
      setEditingBenefactorId(null);
      await loadAll();
    } catch (error) {
      console.error('UPDATE BENEFACTOR ERROR:', error);
      alert(error.message || 'Failed to update benefactor');
    } finally {
      setSaving(false);
    }
  };

  const toggleBenefactorArchive = async (benefactor) => {
    const nextArchived = !benefactor.is_archived;
    const verb = nextArchived ? 'archive' : 'restore';

    if (
      !window.confirm(
        `Are you sure you want to ${verb} ${benefactor.benefactor_name}?`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      await requestJson(`/api/benefactors/${benefactor.benefactor_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_archived: nextArchived }),
      });
      await loadAll();
    } catch (error) {
      console.error('ARCHIVE BENEFACTOR ERROR:', error);
      alert(error.message || `Failed to ${verb} benefactor`);
    } finally {
      setSaving(false);
    }
  };

  const openAddProgram = (benefactor) => {
    setProgramMode('create');
    setEditingProgramId(null);
    setProgramForm({
      ...EMPTY_PROGRAM,
      benefactor_id: benefactor.benefactor_id,
    });
    setProgramModalOpen(true);
  };

  const openProgramEdit = (program) => {
    setProgramMode('edit');
    setEditingProgramId(program.program_id);
    setProgramForm({
      benefactor_id: program.benefactor_id || '',
      program_name: program.program_name || '',
      description: program.description || '',
      target_audience: program.target_audience || 'Applicants',
      gwa_threshold:
        program.gwa_threshold === null || program.gwa_threshold === undefined
          ? null
          : String(program.gwa_threshold),
      renewal_cycle: program.renewal_cycle || 'Semester',
      visibility_status: program.visibility_status || 'Published',
      is_archived: !!program.is_archived,
    });
    setProgramModalOpen(true);
  };

  const saveProgram = async () => {
    try {
      setSaving(true);

      const payload = {
        benefactor_id: programForm.benefactor_id,
        program_name: programForm.program_name.trim(),
        description: programForm.description?.trim() || null,
        target_audience: programForm.target_audience,
        gwa_threshold:
          programForm.gwa_threshold === null || programForm.gwa_threshold === ''
            ? null
            : Number(programForm.gwa_threshold),
        renewal_cycle: programForm.renewal_cycle,
        visibility_status: programForm.visibility_status,
        is_archived: !!programForm.is_archived,
      };

      if (!payload.benefactor_id) throw new Error('Benefactor is required');
      if (!payload.program_name) throw new Error('Program name is required');

      const isEdit = programMode === 'edit' && editingProgramId;
      await requestJson(
        isEdit
          ? `/api/scholarship-program/${editingProgramId}`
          : '/api/scholarship-program',
        {
          method: isEdit ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        }
      );

      setProgramModalOpen(false);
      setEditingProgramId(null);
      await loadAll();
      setExpanded((previous) => ({
        ...previous,
        [payload.benefactor_id]: true,
      }));
    } catch (error) {
      console.error('SAVE PROGRAM ERROR:', error);
      alert(error.message || 'Failed to save scholarship program');
    } finally {
      setSaving(false);
    }
  };

  const toggleProgramArchive = async (program) => {
    const nextArchived = !program.is_archived;
    const verb = nextArchived ? 'archive' : 'restore';

    if (!window.confirm(`Are you sure you want to ${verb} ${program.program_name}?`)) {
      return;
    }

    try {
      setSaving(true);
      await requestJson(`/api/scholarship-program/${program.program_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_archived: nextArchived }),
      });
      await loadAll();
    } catch (error) {
      console.error('ARCHIVE PROGRAM ERROR:', error);
      alert(error.message || `Failed to ${verb} scholarship program`);
    } finally {
      setSaving(false);
    }
  };

  const activeCount = benefactors.filter((row) => !row.is_archived).length;
  const archivedCount = benefactors.filter((row) => row.is_archived).length;

  return (
    <div className="space-y-3">
      <ModalShell
        open={createOpen}
        title="Add Benefactor & First Program"
        onClose={() => !saving && setCreateOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
              className="h-8 rounded-lg border-stone-200 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCombinedCreate}
              disabled={
                saving ||
                !createBenefactorForm.benefactor_name.trim() ||
                !createProgramForm.program_name.trim()
              }
              className="h-8 rounded-lg border-none text-xs text-white disabled:opacity-50"
              style={{ background: C.brownMid }}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Create Benefactor & Program
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  background: 'var(--portal-accent-soft)',
                  color: 'var(--portal-base)',
                }}
              >
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-900">
                  Benefactor Information
                </p>
                <p className="text-xs text-stone-500">
                  Create the scholarship provider first.
                </p>
              </div>
            </div>
            <BenefactorFields
              form={createBenefactorForm}
              setForm={setCreateBenefactorForm}
              includeArchive={false}
            />
          </section>

          <div className="border-t border-stone-200" />

          <section>
            <div className="mb-3 flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  background: 'var(--portal-accent-soft)',
                  color: 'var(--portal-base)',
                }}
              >
                <GraduationCap className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-900">
                  First Program
                </p>
                <p className="text-xs text-stone-500">
                  The program will automatically belong to the new benefactor.
                </p>
              </div>
            </div>
            <ProgramFields
              form={createProgramForm}
              setForm={setCreateProgramForm}
            />
          </section>
        </div>
      </ModalShell>

      <ModalShell
        open={benefactorModalOpen}
        title="Edit Benefactor"
        onClose={() => !saving && setBenefactorModalOpen(false)}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBenefactorModalOpen(false)}
              disabled={saving}
              className="h-8 rounded-lg border-stone-200 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveBenefactor}
              disabled={saving || !benefactorForm.benefactor_name.trim()}
              className="h-8 rounded-lg border-none text-xs text-white disabled:opacity-50"
              style={{ background: C.brownMid }}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Benefactor
            </Button>
          </>
        }
      >
        <BenefactorFields
          form={benefactorForm}
          setForm={setBenefactorForm}
          includeArchive
        />
      </ModalShell>

      <ModalShell
        open={programModalOpen}
        title={programMode === 'edit' ? 'Edit Program' : 'Add Program'}
        onClose={() => !saving && setProgramModalOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProgramModalOpen(false)}
              disabled={saving}
              className="h-8 rounded-lg border-stone-200 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveProgram}
              disabled={
                saving ||
                !programForm.program_name.trim() ||
                !programForm.benefactor_id
              }
              className="h-8 rounded-lg border-none text-xs text-white disabled:opacity-50"
              style={{ background: C.brownMid }}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              {programMode === 'edit' ? 'Save Program' : 'Add Program'}
            </Button>
          </>
        }
      >
        <ProgramFields
          form={programForm}
          setForm={setProgramForm}
          includeBenefactor={programMode === 'edit'}
          benefactors={benefactors.filter((row) => !row.is_archived)}
        />
      </ModalShell>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              Scholarship Maintenance
            </p>
            <h2 className="mt-1 text-lg font-semibold text-stone-900">
              Benefactors & Programs
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              Manage each scholarship provider together with the programs it funds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadAll}
              disabled={loading}
              className="h-9 rounded-lg border-stone-200 px-3 text-xs"
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={openCombinedCreate}
              className="h-9 rounded-lg border-none px-3 text-xs text-white"
              style={{ background: C.brownMid }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Benefactor & Program
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-fit rounded-xl bg-stone-100 p-1">
            <button
              type="button"
              onClick={() => setPageTab('current')}
              className={`h-8 rounded-lg px-3 text-xs font-medium transition ${
                pageTab === 'current'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Current
            </button>
            <button
              type="button"
              onClick={() => setPageTab('archived')}
              className={`h-8 rounded-lg px-3 text-xs font-medium transition ${
                pageTab === 'archived'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Archived
            </button>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search benefactor or program..."
              className="h-9 rounded-lg border-stone-200 pl-9 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex gap-3 text-xs text-stone-500">
          <span>{activeCount} active benefactor{activeCount === 1 ? '' : 's'}</span>
          <span>·</span>
          <span>{archivedCount} archived</span>
          <span>·</span>
          <span>{programs.length} total program{programs.length === 1 ? '' : 's'}</span>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-stone-200 bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      ) : filteredBenefactors.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={
            search.trim()
              ? 'No matching scholarship programs'
              : pageTab === 'archived'
                ? 'No archived benefactors'
                : 'No benefactors yet'
          }
          description={
            search.trim()
              ? 'Try a different benefactor or program name.'
              : 'Create a benefactor together with its first scholarship program.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredBenefactors.map((benefactor) => {
            const linkedPrograms =
              programsByBenefactor.get(String(benefactor.benefactor_id)) || [];
            const isExpanded =
              expanded[benefactor.benefactor_id] !== false;

            return (
              <section
                key={benefactor.benefactor_id}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
              >
                <div className="p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            background: 'var(--portal-accent-soft)',
                            color: 'var(--portal-base)',
                          }}
                        >
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-stone-900">
                            {benefactor.benefactor_name}
                          </h3>
                          <p className="text-xs text-stone-500">
                            {benefactor.benefactor_type || 'Public'} Benefactor
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge(
                            benefactor.is_archived
                          )}`}
                        >
                          {benefactor.is_archived ? 'Archived' : 'Active'}
                        </span>
                      </div>

                      {benefactor.description ? (
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-500">
                          {benefactor.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!benefactor.is_archived ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openAddProgram(benefactor)}
                          className="h-8 rounded-lg border-none px-3 text-xs text-white"
                          style={{ background: C.brownMid }}
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Add Program
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openBenefactorEdit(benefactor)}
                        className="h-8 rounded-lg border-stone-200 px-3 text-xs"
                      >
                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                        Edit Benefactor
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => toggleBenefactorArchive(benefactor)}
                        className="h-8 rounded-lg border-stone-200 px-3 text-xs"
                      >
                        {benefactor.is_archived ? (
                          <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                        ) : (
                          <Archive className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {benefactor.is_archived ? 'Restore' : 'Archive'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-stone-100 bg-stone-50/50">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((previous) => ({
                        ...previous,
                        [benefactor.benefactor_id]:
                          previous[benefactor.benefactor_id] === false,
                      }))
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-stone-400" />
                      <span className="text-sm font-semibold text-stone-800">
                        Programs
                      </span>
                      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                        {linkedPrograms.length}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-stone-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-stone-400" />
                    )}
                  </button>

                  {isExpanded ? (
                    <div className="space-y-2 border-t border-stone-100 p-3">
                      {linkedPrograms.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-stone-200 bg-white p-4 text-center">
                          <p className="text-sm font-medium text-stone-700">
                            No programs under this benefactor.
                          </p>
                          {!benefactor.is_archived ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openAddProgram(benefactor)}
                              className="mt-3 h-8 rounded-lg border-stone-200 text-xs"
                            >
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              Add Program
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        linkedPrograms.map((program) => (
                          <ProgramRow
                            key={program.program_id}
                            program={program}
                            onEdit={openProgramEdit}
                            onArchive={toggleProgramArchive}
                          />
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
