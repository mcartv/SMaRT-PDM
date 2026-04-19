import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
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
      className="border-none text-[10px] font-medium uppercase tracking-wide px-2.5 py-1"
      style={{ background: s.bg, color: s.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onRequestClose} />

      <Card className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden border-stone-200 shadow-xl bg-white rounded-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/70">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">
              {isEditing ? 'Edit Announcement' : 'Compose Announcement'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {isEditing
                ? 'Update announcement details before saving'
                : 'Create a new announcement for students or scholars'}
            </p>
          </div>

          <button
            onClick={onRequestClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(92vh-73px)] p-5">
          <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="space-y-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <p className="text-xs font-medium text-stone-700">
                    Template
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
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
                  className={`h-10 rounded-lg bg-white border-stone-200 text-sm ${validationErrors.title ? 'border-red-300 ring-1 ring-red-200' : ''
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
                  className={`rounded-lg bg-white border-stone-200 resize-none text-sm ${validationErrors.content ? 'border-red-300 ring-1 ring-red-200' : ''
                    }`}
                />
                {validationErrors.content && (
                  <p className="text-xs text-red-500">{validationErrors.content}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="h-10 rounded-lg bg-white border-stone-200 text-sm"
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

              <div className="rounded-3xl border-[6px] border-stone-800 bg-stone-100 shadow-xl p-4 min-h-[390px]">
                <div className="w-16 h-1 bg-stone-800 rounded-full mx-auto mb-4" />

                <Card className="border-stone-200 shadow-none rounded-2xl overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Badge
                        className="text-[10px] border-none"
                        style={{
                          background: scheduled ? STATUS.Scheduled.bg : STATUS.Draft.bg,
                          color: scheduled ? STATUS.Scheduled.color : STATUS.Draft.color,
                        }}
                      >
                        {scheduled ? 'Scheduled Preview' : 'Draft Preview'}
                      </Badge>

                      <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">
                        {AUDIENCE_LABEL[audience]}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-stone-900 leading-tight">
                      {title || 'Announcement subject'}
                    </h3>

                    <div className="flex items-center gap-2 text-[10px] font-medium text-stone-400 uppercase">
                      <Calendar size={12} />
                      {scheduled ? 'Scheduled' : 'Just now'}
                      <Users size={12} className="ml-2" />
                      Audience
                    </div>

                    <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">
                      {content || 'Draft content will appear here...'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-stone-100 flex flex-col sm:flex-row justify-end gap-3">
            <Button
              variant="outline"
              onClick={onRequestClose}
              className="rounded-lg font-medium px-5 border-stone-200"
            >
              Close
            </Button>

            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={draftSaving || posting}
              className="rounded-lg font-medium px-5 border-stone-200"
            >
              {draftSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving Draft...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Save Draft
                </>
              )}
            </Button>

            <Button
              onClick={onPublish}
              disabled={posting || draftSaving}
              className="rounded-lg font-medium px-6 text-white border-none disabled:opacity-60"
              style={{ background: C.brownMid }}
            >
              {posting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {isEditing
                    ? (scheduled ? 'Update Scheduled' : 'Update Announcement')
                    : (scheduled ? 'Schedule Announcement' : 'Post Announcement')}
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onKeepEditing} />

      <Card className="relative w-full max-w-md border-stone-200 shadow-xl bg-white overflow-hidden rounded-2xl">
        <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/70">
          <h3 className="text-sm font-semibold text-stone-800">Unsaved announcement</h3>
          <p className="text-xs text-stone-500 mt-1">
            You have unsaved changes. Choose what to do with this announcement.
          </p>
        </div>

        <CardContent className="p-5 space-y-3">
          <Button
            variant="outline"
            onClick={onKeepEditing}
            className="w-full justify-start rounded-lg h-11 border-stone-200"
          >
            Keep Editing
          </Button>

          <Button
            variant="outline"
            onClick={onSaveDraft}
            disabled={draftSaving}
            className="w-full justify-start rounded-lg h-11 border-stone-200"
          >
            {draftSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving Draft...
              </>
            ) : (
              'Save to Draft'
            )}
          </Button>

          <Button
            onClick={onCancelAnnouncement}
            className="w-full justify-start rounded-lg h-11 bg-red-600 hover:bg-red-700 text-white border-none"
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onCancel} />

      <Card className="relative w-full max-w-md border-stone-200 shadow-xl bg-white overflow-hidden rounded-2xl">
        <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/70">
          <h3 className="text-sm font-semibold text-stone-800">Apply template</h3>
          <p className="text-xs text-stone-500 mt-1">
            Applying a template will replace your current subject and content.
          </p>
        </div>

        <CardContent className="p-5 flex flex-col gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full rounded-lg h-11 border-stone-200"
          >
            Keep Current Content
          </Button>

          <Button
            onClick={onConfirm}
            className="w-full rounded-lg h-11 text-white border-none"
            style={{ background: C.brownMid }}
          >
            Apply Template
          </Button>
        </CardContent>
      </Card>
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

  useEffect(() => {
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">Loading announcements...</p>
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

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-900">Announcements</h1>

        {tab === 'active' && (
          <Button
            onClick={handleOpenModal}
            size="sm"
            className="rounded-lg text-white text-xs border-none"
            style={{ background: C.brownMid }}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New
          </Button>
        )}
      </div>

      <div className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 p-1">
        <button
          onClick={() => setTab('active')}
          className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${tab === 'active'
            ? 'bg-white text-stone-900 shadow-sm'
            : 'text-stone-500 hover:text-stone-700'
            }`}
        >
          Active
        </button>

        <button
          onClick={() => setTab('archived')}
          className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${tab === 'archived'
            ? 'bg-white text-stone-900 shadow-sm'
            : 'text-stone-500 hover:text-stone-700'
            }`}
        >
          Archived
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
          <Input
            placeholder={`Search ${tab === 'archived' ? 'archived' : 'active'} announcements...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white border-stone-200"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm border-stone-200">
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
            className="h-9 text-xs border-stone-200"
          >
            Reset
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-stone-200 bg-white divide-y overflow-hidden">
        {filteredItems.map((a) => {
          const effectiveStatus =
            a.is_archived || a.status === 'Archived' ? 'Archived' : a.status;

          return (
            <div
              key={a.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-stone-50/40 transition"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-stone-900 truncate">
                    {a.title}
                  </p>
                  <StatusPill status={effectiveStatus} />
                </div>

                <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                  {a.content}
                </p>

                <div className="flex flex-wrap gap-3 text-[10px] text-stone-400 uppercase tracking-wide">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {a.date
                      ? new Date(a.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                      : 'No date'}
                  </span>

                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {AUDIENCE_LABEL[a.audienceKey || a.audience] || a.audience || 'Audience'}
                  </span>

                  {effectiveStatus === 'Published' && (
                    <span className="flex items-center gap-1 text-stone-700">
                      <Eye size={12} />
                      {a.views}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-1 shrink-0 self-end md:self-auto">
                {tab === 'active' ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(a)}
                      className="h-8 text-[11px] border-stone-200"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </Button>

                    {a.status === 'Draft' && (
                      <Button
                        size="sm"
                        onClick={() => handlePublish(a.id)}
                        disabled={publishingId === a.id}
                        className="h-8 text-[11px] bg-green-600 text-white hover:bg-green-700 border-none disabled:opacity-60"
                      >
                        {publishingId === a.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Publishing
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5 mr-1.5" />
                            Publish
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchive(a.id)}
                      disabled={deletingId === a.id}
                      className="h-8 text-[11px] text-red-500 border-red-200 disabled:opacity-60"
                    >
                      {deletingId === a.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Archive
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(a.id)}
                    disabled={restoringId === a.id}
                    className="h-8 text-[11px] border-stone-200"
                  >
                    {restoringId === a.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Restoring
                      </>
                    ) : (
                      <>
                        <ArchiveRestore className="w-3.5 h-3.5 mr-1.5" />
                        Restore
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="p-8 text-center text-sm text-stone-400">
            {tab === 'archived' ? 'No archived announcements found' : 'No announcements found'}
          </div>
        )}
      </div>
    </div>
  );
}
