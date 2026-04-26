import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSocketEvent } from '@/hooks/useSocket';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Edit,
  Trash2,
  Send,
  Eye,
  Calendar,
  Users,
  X,
  Loader2,
  FileText,
  Sparkles,
  Search,
  ArchiveRestore,
} from 'lucide-react';
import { buildApiUrl } from '@/api';

const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  blue: '#1E3A8A',
  blueSoft: '#EFF6FF',
  border: '#e7e5e4',
  muted: '#78716c',
  text: '#1c1917',
  bg: '#faf7f2',
};

const STATUS = {
  Published: { bg: C.greenSoft, color: C.green },
  Draft: { bg: '#f4f4f5', color: '#71717a' },
  Scheduled: { bg: C.amberSoft, color: C.amber },
  Archived: { bg: '#f5f5f4', color: '#78716c' },
};

const AUDIENCE_LABEL = {
  all: 'All Students',
  applicants: 'New Applicants',
  scholars: 'Current Scholars',
  tes: 'TES Recipients',
  tdp: 'TDP Recipients',
};

const ANNOUNCEMENT_TEMPLATES = {
  blank: {
    label: 'Blank',
    title: '',
    content: '',
    audience: 'all',
    isRoVoluntary: 'false',
  },
  document_reupload: {
    label: 'Document Re-upload Request',
    title: 'Document Re-upload Requested',
    content:
      'Please re-upload the required document for your scholarship application. Review the feedback provided in the system and submit the corrected file as soon as possible.',
    audience: 'applicants',
    isRoVoluntary: 'false',
  },
  application_update: {
    label: 'Application Update',
    title: 'Scholarship Application Update',
    content:
      'Your scholarship application is currently being reviewed. Please monitor the system regularly for status updates and additional instructions.',
    audience: 'applicants',
    isRoVoluntary: 'false',
  },
  payout_notice: {
    label: 'Payout Notice',
    title: 'Scholarship Payout Schedule',
    content:
      'Scholarship payout for the current release period is now scheduled. Please monitor your account and ensure that your records are complete and updated.',
    audience: 'scholars',
    isRoVoluntary: 'false',
  },
  ro_reminder: {
    label: 'RO Reminder',
    title: 'Return of Obligation Reminder',
    content:
      'All concerned scholars are reminded to complete their required return of obligation tasks on or before the announced deadline. Please coordinate with the office for any clarifications.',
    audience: 'scholars',
    isRoVoluntary: 'true',
  },
  general_advisory: {
    label: 'General Advisory',
    title: 'Important Scholarship Advisory',
    content:
      'Please be advised of the latest scholarship-related updates. Read this announcement carefully and follow the indicated instructions where applicable.',
    audience: 'all',
    isRoVoluntary: 'false',
  },
};

function StatusPill({ status }) {
  const s = STATUS[status] || { bg: '#f4f4f5', color: '#71717a' };

  return (
    <Badge
      variant="outline"
      className="border-none px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide"
      style={{ background: s.bg, color: s.color }}
    >
      <span
        className="mr-1.5 h-1.5 w-1.5 rounded-full"
        style={{ background: s.color }}
      />
      {status}
    </Badge>
  );
}

function ComposeAnnouncementModal({
  open,
  onRequestClose,
  onPublish,
  onSaveDraft,
  posting,
  draftSaving,
  title,
  setTitle,
  content,
  setContent,
  audience,
  setAudience,
  schedDate,
  setSchedDate,
  isRoVoluntary,
  setIsRoVoluntary,
  validationErrors,
  selectedTemplate,
  setSelectedTemplate,
  onApplyTemplate,
  isEditing,
}) {
  if (!open) return null;

  const scheduled = !!schedDate;
  const minScheduleDateTime = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onRequestClose} />

      <Card className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">
              {isEditing ? 'Edit Announcement' : 'Compose Announcement'}
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              {isEditing
                ? 'Update announcement details before saving'
                : 'Create a new announcement for students or scholars'}
            </p>
          </div>

          <button
            onClick={onRequestClose}
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-73px)] overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <p className="text-xs font-medium text-stone-700">Template</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ANNOUNCEMENT_TEMPLATES).map(([key, template]) => (
                        <SelectItem key={key} value={key} className="text-sm">
                          {template.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={onApplyTemplate}
                    className="rounded-lg border-stone-200"
                  >
                    Apply
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  Subject
                </label>
                <Input
                  placeholder="Enter announcement subject..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`h-10 rounded-lg border-stone-200 bg-white text-sm ${validationErrors.title ? 'border-red-300 ring-1 ring-red-200' : ''
                    }`}
                />
                {validationErrors.title && (
                  <p className="text-xs text-red-500">{validationErrors.title}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  Content
                </label>
                <Textarea
                  placeholder="Write the announcement details here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={9}
                  className={`resize-none rounded-lg border-stone-200 bg-white text-sm ${validationErrors.content ? 'border-red-300 ring-1 ring-red-200' : ''
                    }`}
                />
                {validationErrors.content && (
                  <p className="text-xs text-red-500">{validationErrors.content}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                    Audience
                  </label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AUDIENCE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value} className="text-sm">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                    Schedule
                  </label>
                  <Input
                    type="datetime-local"
                    value={schedDate}
                    min={minScheduleDateTime}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value && value < minScheduleDateTime) return;
                      setSchedDate(value);
                    }}
                    className="h-10 rounded-lg border-stone-200 bg-white text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  RO Category
                </label>
                <Select value={isRoVoluntary} onValueChange={setIsRoVoluntary}>
                  <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false" className="text-sm">
                      Regular Announcement
                    </SelectItem>
                    <SelectItem value="true" className="text-sm">
                      RO Voluntary Announcement
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                Preview
              </label>

              <div className="min-h-[390px] rounded-3xl border-[6px] border-stone-800 bg-stone-100 p-4 shadow-xl">
                <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-stone-800" />

                <Card className="overflow-hidden rounded-2xl border-stone-200 shadow-none">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge
                        className="border-none text-[10px]"
                        style={{
                          background: scheduled ? STATUS.Scheduled.bg : STATUS.Draft.bg,
                          color: scheduled ? STATUS.Scheduled.color : STATUS.Draft.color,
                        }}
                      >
                        {scheduled ? 'Scheduled Preview' : 'Draft Preview'}
                      </Badge>

                      <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                        {AUDIENCE_LABEL[audience]}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold leading-tight text-stone-900">
                      {title || 'Announcement subject'}
                    </h3>

                    <div className="flex items-center gap-2 text-[10px] font-medium uppercase text-stone-400">
                      <Calendar size={12} />
                      {scheduled ? 'Scheduled' : 'Just now'}
                      <Users size={12} className="ml-2" />
                      Audience
                    </div>

                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-stone-600">
                      {content || 'Draft content will appear here...'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col justify-end gap-3 border-t border-stone-100 pt-5 sm:flex-row">
            <Button
              variant="outline"
              onClick={onRequestClose}
              className="rounded-lg border-stone-200 px-5 font-medium"
            >
              Close
            </Button>

            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={draftSaving || posting}
              className="rounded-lg border-stone-200 px-5 font-medium"
            >
              {draftSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Draft...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Save Draft
                </>
              )}
            </Button>

            <Button
              onClick={onPublish}
              disabled={posting || draftSaving}
              className="rounded-lg border-none px-6 font-medium text-white disabled:opacity-60"
              style={{ background: C.brownMid }}
            >
              {posting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {isEditing
                    ? scheduled
                      ? 'Update Scheduled'
                      : 'Update Announcement'
                    : scheduled
                      ? 'Schedule Announcement'
                      : 'Post Announcement'}
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DiscardAnnouncementModal({
  open,
  onKeepEditing,
  onCancelAnnouncement,
  onSaveDraft,
  draftSaving,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onKeepEditing} />

      <Card className="relative w-full max-w-md overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <h3 className="text-sm font-semibold text-stone-800">Unsaved announcement</h3>
          <p className="mt-1 text-xs text-stone-500">
            You have unsaved changes. Choose what to do with this announcement.
          </p>
        </div>

        <CardContent className="flex flex-col gap-3 p-5">
          <Button
            variant="outline"
            onClick={onKeepEditing}
            className="h-11 w-full justify-start rounded-lg border-stone-200"
          >
            Keep Editing
          </Button>

          <Button
            variant="outline"
            onClick={onSaveDraft}
            disabled={draftSaving}
            className="h-11 w-full justify-start rounded-lg border-stone-200"
          >
            {draftSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Draft...
              </>
            ) : (
              'Save to Draft'
            )}
          </Button>

          <Button
            onClick={onCancelAnnouncement}
            className="h-11 w-full justify-start rounded-lg border-none bg-red-600 text-white hover:bg-red-700"
          >
            Cancel Announcement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfirmTemplateApplyModal({
  open,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onCancel} />

      <Card className="relative w-full max-w-md overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <h3 className="text-sm font-semibold text-stone-800">Apply template</h3>
          <p className="mt-1 text-xs text-stone-500">
            Applying a template will replace your current subject and content.
          </p>
        </div>

        <CardContent className="flex flex-col gap-3 p-5">
          <Button
            variant="outline"
            onClick={onCancel}
            className="h-11 w-full rounded-lg border-stone-200"
          >
            Keep Current Content
          </Button>

          <Button
            onClick={onConfirm}
            className="h-11 w-full rounded-lg border-none text-white"
            style={{ background: C.brownMid }}
          >
            Apply Template
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyList({ archived }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-stone-700">
        {archived ? 'No archived announcements found' : 'No announcements found'}
      </p>
      <p className="mt-1 text-xs text-stone-400">
        {archived
          ? 'Archived announcements will appear here.'
          : 'Create or search announcements to populate this list.'}
      </p>
    </div>
  );
}

function AnnouncementRow({
  announcement,
  tab,
  publishingId,
  deletingId,
  restoringId,
  onEdit,
  onPublish,
  onArchive,
  onRestore,
}) {
  const effectiveStatus =
    announcement.is_archived || announcement.status === 'Archived'
      ? 'Archived'
      : announcement.status;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 transition hover:bg-stone-50/40 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-stone-900">
            {announcement.title}
          </p>
          <StatusPill status={effectiveStatus} />
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-stone-500">
          {announcement.content}
        </p>

        <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wide text-stone-400">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {announcement.date
              ? new Date(announcement.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              : 'No date'}
          </span>

          <span className="flex items-center gap-1">
            <Users size={12} />
            {AUDIENCE_LABEL[announcement.audienceKey || announcement.audience] ||
              announcement.audience ||
              'Audience'}
          </span>

          {effectiveStatus === 'Published' && (
            <span className="flex items-center gap-1 text-stone-700">
              <Eye size={12} />
              {announcement.views}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-1 self-end md:self-auto">
        {tab === 'active' ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(announcement)}
              className="h-8 border-stone-200 text-[11px]"
            >
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>

            {announcement.status === 'Draft' && (
              <Button
                size="sm"
                onClick={() => onPublish(announcement.id)}
                disabled={publishingId === announcement.id}
                className="h-8 border-none bg-green-600 text-[11px] text-white hover:bg-green-700 disabled:opacity-60"
              >
                {publishingId === announcement.id ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Publishing
                  </>
                ) : (
                  <>
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Publish
                  </>
                )}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => onArchive(announcement.id)}
              disabled={deletingId === announcement.id}
              className="h-8 border-red-200 text-[11px] text-red-500 disabled:opacity-60"
            >
              {deletingId === announcement.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Archive
                </>
              )}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRestore(announcement.id)}
            disabled={restoringId === announcement.id}
            className="h-8 border-stone-200 text-[11px]"
          >
            {restoringId === announcement.id ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Restoring
              </>
            ) : (
              <>
                <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                Restore
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AnnouncementsManagement() {
  const location = useLocation();
  const navigate = useNavigate();

  const [tab, setTab] = useState('active');

  const [showForm, setShowForm] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showTemplateConfirmModal, setShowTemplateConfirmModal] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('all');
  const [schedDate, setSchedDate] = useState('');
  const [isRoVoluntary, setIsRoVoluntary] = useState('false');
  const [selectedTemplate, setSelectedTemplate] = useState('blank');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const loadAnnouncements = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem('adminToken');

      const [activeRes, archivedRes] = await Promise.all([
        fetch(buildApiUrl('/api/announcements'), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(buildApiUrl('/api/announcements/archived'), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      const activeData = await activeRes.json().catch(() => []);
      const archivedData = await archivedRes.json().catch(() => []);

      if (!activeRes.ok) {
        throw new Error(activeData.error || 'Failed to load active announcements');
      }

      if (!archivedRes.ok) {
        throw new Error(archivedData.error || 'Failed to load archived announcements');
      }

      const activeItems = Array.isArray(activeData) ? activeData : [];
      const archivedItems = Array.isArray(archivedData) ? archivedData : [];

      setItems([
        ...activeItems,
        ...archivedItems.map((item) => ({
          ...item,
          is_archived: true,
          status: 'Archived',
        })),
      ]);
    } catch (err) {
      console.error('LOAD ANNOUNCEMENTS ERROR:', err);
      alert(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  useSocketEvent('announcement:created', () => {
    loadAnnouncements();
  }, []);

  useSocketEvent('announcement:updated', () => {
    loadAnnouncements();
  }, []);

  useSocketEvent('announcement:deleted', () => {
    loadAnnouncements();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prefill = params.get('prefill');

    if (prefill === 'opening') {
      const openingTitle = params.get('opening_title') || 'Scholarship Opening Announcement';
      const openingText = params.get('announcement_text') || '';

      setEditingAnnouncementId(null);
      setTitle(openingTitle);
      setContent(openingText);
      setAudience('all');
      setSchedDate('');
      setIsRoVoluntary('false');
      setSelectedTemplate('blank');
      setValidationErrors({});
      setShowForm(true);

      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  const hasUnsavedChanges = useMemo(() => {
    return (
      title.trim() !== '' ||
      content.trim() !== '' ||
      audience !== 'all' ||
      schedDate !== '' ||
      isRoVoluntary !== 'false'
    );
  }, [title, content, audience, schedDate, isRoVoluntary]);

  const activeItems = useMemo(
    () => items.filter((item) => !item.is_archived && item.status !== 'Archived'),
    [items]
  );

  const archivedItems = useMemo(
    () => items.filter((item) => item.is_archived || item.status === 'Archived'),
    [items]
  );

  const currentItems = tab === 'archived' ? archivedItems : activeItems;

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return currentItems.filter((item) => {
      const matchSearch =
        !q ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.content || '').toLowerCase().includes(q) ||
        (item.audience || '').toLowerCase().includes(q);

      const effectiveStatus =
        item.is_archived || item.status === 'Archived' ? 'Archived' : item.status;

      const matchStatus = statusFilter === 'All' || effectiveStatus === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [currentItems, search, statusFilter]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setAudience('all');
    setSchedDate('');
    setIsRoVoluntary('false');
    setSelectedTemplate('blank');
    setValidationErrors({});
    setEditingAnnouncementId(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setShowForm(true);
  };

  const handleRequestCloseModal = () => {
    if (hasUnsavedChanges) {
      setShowDiscardModal(true);
      return;
    }

    resetForm();
    setShowForm(false);
  };

  const handleCancelAnnouncement = () => {
    resetForm();
    setShowDiscardModal(false);
    setShowForm(false);
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncementId(announcement.id);
    setTitle(announcement.title || '');
    setContent(announcement.content || '');
    setAudience(announcement.audienceKey || announcement.audience || 'all');
    setSchedDate(
      announcement.status === 'Scheduled' && announcement.date
        ? String(announcement.date).slice(0, 16)
        : ''
    );
    setIsRoVoluntary(announcement.isRoVoluntary ? 'true' : 'false');
    setSelectedTemplate('blank');
    setValidationErrors({});
    setShowForm(true);
  };

  const validateForPublish = () => {
    const errors = {};

    if (!title.trim()) errors.title = 'Announcement subject is required.';
    if (!content.trim()) errors.content = 'Announcement content is required.';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const applyTemplateNow = () => {
    const template = ANNOUNCEMENT_TEMPLATES[selectedTemplate];
    if (!template) return;

    setTitle(template.title);
    setContent(template.content);
    setAudience(template.audience);
    setIsRoVoluntary(template.isRoVoluntary);
    setValidationErrors({});
    setShowTemplateConfirmModal(false);
  };

  const handleApplyTemplate = () => {
    const hasContent = title.trim() || content.trim();

    if (hasContent) {
      setShowTemplateConfirmModal(true);
      return;
    }

    applyTemplateNow();
  };

  const saveAnnouncementRequest = async ({ forceDraft = false }) => {
    const token = localStorage.getItem('adminToken');
    const isEditing = !!editingAnnouncementId;

    const url = isEditing
      ? buildApiUrl(`/api/announcements/${editingAnnouncementId}`)
      : buildApiUrl('/api/announcements');

    const method = isEditing ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title.trim(),
        content: content.trim(),
        audience,
        schedDate: schedDate || null,
        isRoVoluntary: isRoVoluntary === 'true',
        forceDraft,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Failed to save announcement');
    }

    return data;
  };

  const handlePost = async () => {
    try {
      if (!validateForPublish()) return;

      setPosting(true);

      const data = await saveAnnouncementRequest({ forceDraft: false });

      if (data?.data) {
        if (editingAnnouncementId) {
          setItems((prev) => prev.map((item) => (item.id === data.data.id ? data.data : item)));
        } else {
          setItems((prev) => [data.data, ...prev]);
        }
      }

      resetForm();
      setShowForm(false);
      setShowDiscardModal(false);
      alert(editingAnnouncementId ? 'Announcement updated successfully.' : 'Announcement saved successfully.');
    } catch (err) {
      console.error('POST ANNOUNCEMENT ERROR:', err);
      alert(err.message || 'Failed to save announcement');
    } finally {
      setPosting(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      if (!title.trim() && !content.trim()) {
        handleCancelAnnouncement();
        return;
      }

      setDraftSaving(true);

      const data = await saveAnnouncementRequest({ forceDraft: true });

      if (data?.data) {
        if (editingAnnouncementId) {
          setItems((prev) => prev.map((item) => (item.id === data.data.id ? data.data : item)));
        } else {
          setItems((prev) => [data.data, ...prev]);
        }
      }

      resetForm();
      setShowForm(false);
      setShowDiscardModal(false);
      alert('Draft saved successfully.');
    } catch (err) {
      console.error('SAVE DRAFT ERROR:', err);
      alert(err.message || 'Failed to save draft');
    } finally {
      setDraftSaving(false);
    }
  };

  const handleArchive = async (id) => {
    try {
      setDeletingId(id);

      const token = localStorage.getItem('adminToken');

      const res = await fetch(buildApiUrl(`/api/announcements/${id}/archive`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to archive announcement');
      }

      setItems((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
              ...a,
              ...data.data,
              is_archived: true,
              status: 'Archived',
            }
            : a
        )
      );
    } catch (err) {
      console.error('ARCHIVE ANNOUNCEMENT ERROR:', err);
      alert(err.message || 'Failed to archive announcement');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (id) => {
    try {
      setRestoringId(id);

      const token = localStorage.getItem('adminToken');

      const res = await fetch(buildApiUrl(`/api/announcements/${id}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_archived: false,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore announcement');
      }

      setItems((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
              ...a,
              ...data.data,
              is_archived: false,
              status:
                data.data?.status && data.data.status !== 'Archived'
                  ? data.data.status
                  : 'Draft',
            }
            : a
        )
      );
    } catch (err) {
      console.error('RESTORE ANNOUNCEMENT ERROR:', err);
      alert(err.message || 'Failed to restore announcement');
    } finally {
      setRestoringId(null);
    }
  };

  const handlePublish = async (id) => {
    try {
      setPublishingId(id);

      const token = localStorage.getItem('adminToken');

      const res = await fetch(buildApiUrl(`/api/announcements/${id}/publish`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish announcement');
      }

      if (data?.data) {
        setItems((prev) => prev.map((a) => (a.id === id ? data.data : a)));
      }
    } catch (err) {
      console.error('PUBLISH ANNOUNCEMENT ERROR:', err);
      alert(err.message || 'Failed to publish announcement');
    } finally {
      setPublishingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-stone-300" />
        <p className="text-xs uppercase tracking-widest text-stone-400">
          Loading announcements...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2" style={{ background: C.bg }}>
      <ComposeAnnouncementModal
        open={showForm}
        onRequestClose={handleRequestCloseModal}
        onPublish={handlePost}
        onSaveDraft={handleSaveDraft}
        posting={posting}
        draftSaving={draftSaving}
        title={title}
        setTitle={setTitle}
        content={content}
        setContent={setContent}
        audience={audience}
        setAudience={setAudience}
        schedDate={schedDate}
        setSchedDate={setSchedDate}
        isRoVoluntary={isRoVoluntary}
        setIsRoVoluntary={setIsRoVoluntary}
        validationErrors={validationErrors}
        selectedTemplate={selectedTemplate}
        setSelectedTemplate={setSelectedTemplate}
        onApplyTemplate={handleApplyTemplate}
        isEditing={!!editingAnnouncementId}
      />

      <DiscardAnnouncementModal
        open={showDiscardModal}
        onKeepEditing={() => setShowDiscardModal(false)}
        onCancelAnnouncement={handleCancelAnnouncement}
        onSaveDraft={handleSaveDraft}
        draftSaving={draftSaving}
      />

      <ConfirmTemplateApplyModal
        open={showTemplateConfirmModal}
        onCancel={() => setShowTemplateConfirmModal(false)}
        onConfirm={applyTemplateNow}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 p-1">
          <button
            onClick={() => setTab('active')}
            className={`rounded-md px-4 py-2 text-xs font-medium transition-all ${tab === 'active'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
              }`}
          >
            Active
          </button>

          <button
            onClick={() => setTab('archived')}
            className={`rounded-md px-4 py-2 text-xs font-medium transition-all ${tab === 'archived'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
              }`}
          >
            Archived
          </button>
        </div>

        {tab === 'active' && (
          <Button
            onClick={handleOpenModal}
            size="sm"
            className="rounded-lg border-none text-xs text-white"
            style={{ background: C.brownMid }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New
          </Button>
        )}
      </div>

      <Card className="overflow-hidden rounded-2xl border-stone-200 bg-white shadow-none">
        <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-300" />
            <Input
              placeholder={`Search ${tab === 'archived' ? 'archived' : 'active'} announcements...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-stone-200 bg-white pl-9 text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[140px] border-stone-200 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {tab === 'active' ? (
                <>
                  <SelectItem value="Published">Published</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                </>
              ) : (
                <SelectItem value="Archived">Archived</SelectItem>
              )}
            </SelectContent>
          </Select>

          {(search || statusFilter !== 'All') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('All');
              }}
              className="h-9 border-stone-200 text-xs"
            >
              Reset
            </Button>
          )}
        </div>

        <div className="divide-y">
          {filteredItems.length === 0 ? (
            <div className="p-4">
              <EmptyList archived={tab === 'archived'} />
            </div>
          ) : (
            filteredItems.map((announcement) => (
              <AnnouncementRow
                key={announcement.id}
                announcement={announcement}
                tab={tab}
                publishingId={publishingId}
                deletingId={deletingId}
                restoringId={restoringId}
                onEdit={handleEdit}
                onPublish={handlePublish}
                onArchive={handleArchive}
                onRestore={handleRestore}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}