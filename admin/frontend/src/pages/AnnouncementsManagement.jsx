import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus, Edit, Trash2, Send, Eye, Calendar, Users, X, Loader2,
  AlertTriangle, FileText, Megaphone, Clock3, CheckCircle2,
  Sparkles,
} from 'lucide-react';

// ─── Shared Admin Palette ───────────────────────────────────────
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
  white: '#FFFFFF',
};

const STATUS = {
  Published: { bg: C.greenSoft, color: C.green },
  Draft: { bg: '#f4f4f5', color: '#71717a' },
  Scheduled: { bg: C.amberSoft, color: C.amber },
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
      <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: s.color }} />
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
  ).toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onRequestClose} />

      <Card className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden border-stone-200 shadow-xl bg-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/70">
          <div>
            <h3 className="text-base font-semibold text-stone-800">
              {isEditing ? 'Edit Announcement' : 'Compose Announcement'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {isEditing
                ? 'Update an existing announcement'
                : 'Create a post for students, applicants, or scholars'}
            </p>
          </div>

          <button
            onClick={onRequestClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(92vh-73px)] p-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <p className="text-xs font-medium text-stone-700">Start from a template</p>
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
                    Apply Template
                  </Button>
                </div>

                <p className="text-xs text-stone-500 mt-3">
                  Templates prefill the fields, but you can still edit everything before posting.
                </p>
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
                  rows={8}
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
                    Target Audience
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
                    Schedule (Optional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={schedDate}
                    min={minScheduleDateTime}
                    onChange={(e) => {
                      const value = e.target.value;

                      if (value && value < minScheduleDateTime) {
                        return;
                      }

                      setSchedDate(value);
                    }}
                    className="h-10 rounded-lg bg-white border-stone-200 text-sm"
                  />
                  <p className="text-[11px] text-stone-400">
                    Only current or future schedule times are allowed.
                  </p>
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
                    <SelectItem value="false" className="text-sm">Regular Announcement</SelectItem>
                    <SelectItem value="true" className="text-sm">RO Voluntary Announcement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-stone-700">Publishing rules</p>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Publishing requires both a subject and content. Saving to draft allows incomplete content.
                      If a schedule is set, the announcement will be saved as scheduled.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                Mobile Preview
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

          <div className="mt-8 pt-6 border-t border-stone-100 flex flex-col sm:flex-row justify-end gap-3">
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
                  Save to Draft
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
                    ? (scheduled ? 'Update Scheduled Announcement' : 'Update Announcement')
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

      <Card className="relative w-full max-w-md border-stone-200 shadow-xl bg-white overflow-hidden">
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

      <Card className="relative w-full max-w-md border-stone-200 shadow-xl bg-white overflow-hidden">
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
  const [validationErrors, setValidationErrors] = useState({});
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        setLoading(true);

        const token = localStorage.getItem('adminToken');

        const res = await fetch('http://localhost:5000/api/announcements', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await res.json().catch(() => ([]));

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load announcements');
        }

        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('LOAD ANNOUNCEMENTS ERROR:', err);
        alert(err.message || 'Failed to load announcements');
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncements();
  }, []);

  const totalViews = items.reduce((sum, item) => sum + Number(item.views || 0), 0);

  const hasUnsavedChanges = useMemo(() => {
    return (
      title.trim() !== '' ||
      content.trim() !== '' ||
      audience !== 'all' ||
      schedDate !== '' ||
      isRoVoluntary !== 'false'
    );
  }, [title, content, audience, schedDate, isRoVoluntary]);

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
    setValidationErrors({});
    setSelectedTemplate('blank');
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
    setAudience(announcement.audienceKey || 'all');
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

    if (!title.trim()) {
      errors.title = 'Announcement subject is required.';
    }

    if (!content.trim()) {
      errors.content = 'Announcement content is required.';
    }

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
    if (selectedTemplate === 'blank') {
      if (hasUnsavedChanges) {
        setShowTemplateConfirmModal(true);
        return;
      }
      applyTemplateNow();
      return;
    }

    if (title.trim() || content.trim()) {
      setShowTemplateConfirmModal(true);
      return;
    }

    applyTemplateNow();
  };

  const saveAnnouncementRequest = async ({ forceDraft = false }) => {
    const token = localStorage.getItem('adminToken');
    const isEditing = !!editingAnnouncementId;

    const url = isEditing
      ? `http://localhost:5000/api/announcements/${editingAnnouncementId}`
      : 'http://localhost:5000/api/announcements';

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

      const successMessage = editingAnnouncementId
        ? 'Announcement updated successfully.'
        : 'Announcement saved successfully.';

      resetForm();
      setShowForm(false);
      setShowDiscardModal(false);
      alert(successMessage);
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

      const res = await fetch(`http://localhost:5000/api/announcements/${id}/archive`, {
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

      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('ARCHIVE ANNOUNCEMENT ERROR:', err);
      alert(err.message || 'Failed to archive announcement');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePublish = async (id) => {
    try {
      setPublishingId(id);

      const token = localStorage.getItem('adminToken');

      const res = await fetch(`http://localhost:5000/api/announcements/${id}/publish`, {
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
    <div className="space-y-5 py-2" style={{ background: C.bg }}>
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

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Announcements
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            Broadcast management and public information posts
          </p>
        </div>

        <Button
          onClick={handleOpenModal}
          size="sm"
          className="rounded-lg text-white text-xs border-none"
          style={{ background: C.brownMid }}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Announcement
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Posts', value: String(items.length), icon: Megaphone, accent: C.brown, soft: C.amberSoft },
          { label: 'Published', value: String(items.filter(i => i.status === 'Published').length), icon: CheckCircle2, accent: C.green, soft: C.greenSoft },
          { label: 'Drafts', value: String(items.filter(i => i.status === 'Draft').length), icon: FileText, accent: C.muted, soft: '#f5f5f4' },
          { label: 'Scheduled', value: String(items.filter(i => i.status === 'Scheduled').length), icon: Clock3, accent: C.amber, soft: C.amberSoft },
        ].map((s) => (
          <Card key={s.label} className="border-stone-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: s.soft }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold" style={{ color: C.text }}>
                {s.value}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-stone-200 shadow-none overflow-hidden">
        <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
          <CardTitle className="text-sm font-semibold text-stone-800">Archive & Active Posts</CardTitle>
          <CardDescription className="text-xs">
            Review drafts, scheduled announcements, and published records
          </CardDescription>
        </CardHeader>

        <div className="divide-y divide-stone-100">
          {items.map((a) => (
            <div
              key={a.id}
              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-stone-50/50 transition-colors"
            >
              <div className="flex gap-4 min-w-0">
                <div
                  className="w-1 rounded-full shrink-0"
                  style={{ background: STATUS[a.status]?.color || '#cbd5e1' }}
                />

                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm font-semibold text-stone-900 truncate">{a.title}</p>
                    <StatusPill status={a.status} />
                  </div>

                  <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                    {a.content}
                  </p>

                  <div className="flex items-center gap-4 text-[10px] font-medium text-stone-400 uppercase tracking-wide flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      {a.date
                        ? new Date(a.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                        : 'TBD'}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <Users size={12} />
                      {a.audience}
                    </span>

                    {a.status === 'Published' && (
                      <span className="flex items-center gap-1.5 text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                        <Eye size={12} /> {a.views}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(a)}
                  className="h-8 rounded-lg text-[11px] border-stone-200 text-stone-600"
                >
                  <Edit className="w-3.5 h-3.5 mr-1.5" />
                  Edit
                </Button>

                {a.status === 'Draft' && (
                  <Button
                    onClick={() => handlePublish(a.id)}
                    disabled={publishingId === a.id}
                    size="sm"
                    className="h-8 rounded-lg text-[11px] bg-green-600 text-white hover:bg-green-700 border-none shadow-none disabled:opacity-60"
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
                  onClick={() => handleArchive(a.id)}
                  disabled={deletingId === a.id}
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-red-100 text-red-500 hover:bg-red-50 disabled:opacity-60"
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
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="p-10 text-center text-sm text-stone-400">
              No announcements found.
            </div>
          )}
        </div>
      </Card>

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · Broadcast Management Layer
        </p>
      </footer>
    </div>
  );
}