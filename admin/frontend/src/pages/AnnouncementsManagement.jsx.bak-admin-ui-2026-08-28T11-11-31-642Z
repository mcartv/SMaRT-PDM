import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSocketEvent } from '@/hooks/useSocket';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';
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
  Archive,
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
  Megaphone,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { showAppToast } from '@/utils/appToast';

const C = {
  brown: 'var(--portal-base)',
  brownMid: 'var(--portal-base)',
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
  bg: 'var(--portal-main-bg, #faf7f2)',
};

const STATUS = {
  Published: { bg: C.greenSoft, color: C.green },
  Draft: { bg: '#f4f4f5', color: '#71717a' },
  Scheduled: { bg: C.amberSoft, color: C.amber },
  Archived: { bg: '#f5f5f4', color: '#78716c' },
};

const GENERAL_AUDIENCE_LABEL = {
  all: 'All Students',
  applicants: 'New Applicants',
  scholars: 'Current Scholars',
};

const LEGACY_AUDIENCE_LABEL = {
  tes: 'TES Recipients (Legacy)',
  tdp: 'TDP Recipients (Legacy)',
};

function programAudienceValue(programId) {
  return programId ? `program:${programId}` : '';
}

function parseAudienceSelection(value) {
  const raw = String(value || '').trim();
  if (raw.startsWith('program:')) {
    return {
      audience: 'program',
      programId: raw.slice('program:'.length) || null,
    };
  }

  return {
    audience: raw || 'all',
    programId: null,
  };
}

function buildAudienceOptions(programs = [], currentValue = '') {
  const options = Object.entries(GENERAL_AUDIENCE_LABEL).map(([value, label]) => ({
    value,
    label,
    disabled: false,
  }));

  const activePrograms = programs
    .filter(
      (program) =>
        program?.is_archived !== true &&
        String(program?.visibility_status || 'Published') === 'Published'
    )
    .sort((a, b) =>
      String(a?.program_name || '').localeCompare(String(b?.program_name || ''))
    );

  activePrograms.forEach((program) => {
    options.push({
      value: programAudienceValue(program.program_id),
      label: `${program.program_name} Recipients`,
      disabled: false,
    });
  });

  if (currentValue.startsWith('program:')) {
    const currentProgramId = currentValue.slice('program:'.length);
    const alreadyIncluded = activePrograms.some(
      (program) => String(program.program_id) === String(currentProgramId)
    );
    const historicalProgram = programs.find(
      (program) => String(program.program_id) === String(currentProgramId)
    );

    if (!alreadyIncluded && historicalProgram) {
      options.push({
        value: currentValue,
        label: `${historicalProgram.program_name} Recipients (Inactive)`,
        disabled: true,
      });
    }
  }

  if (LEGACY_AUDIENCE_LABEL[currentValue]) {
    options.push({
      value: currentValue,
      label: LEGACY_AUDIENCE_LABEL[currentValue],
      disabled: false,
    });
  }

  return options;
}

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

function resolveAnnouncementTemplate(announcement = {}) {
  const savedTemplateKey = String(
    announcement.templateKey || announcement.template_key || ''
  ).trim();

  if (savedTemplateKey && ANNOUNCEMENT_TEMPLATES[savedTemplateKey]) {
    return savedTemplateKey;
  }

  const announcementTitle = String(announcement.title || '').trim();
  const announcementContent = String(announcement.content || '').trim();

  const matchedTemplate = Object.entries(ANNOUNCEMENT_TEMPLATES).find(
    ([key, template]) =>
      key !== 'blank' &&
      ((announcementTitle && announcementTitle === template.title) ||
        (announcementContent && announcementContent === template.content))
  );

  return matchedTemplate?.[0] || 'blank';
}

function toUtcIsoFromLocalInput(value) {
  if (!value) return null;

  return new Date(value).toISOString();
}

function toLocalDateTimeInputValue(value) {
  if (!value) return '';

  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function nextSchedulableLocalDateTimeInputValue(baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + 1);

  return toLocalDateTimeInputValue(date);
}

function getLocalScheduleParts(value = '') {
  const [date = '', time = ''] = String(value || '').split('T');
  const [hour = '', minute = ''] = time.split(':');

  return {
    date,
    hour,
    minute,
  };
}

function formatScheduleHour(hourValue) {
  const hour = Number(hourValue);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${String(displayHour).padStart(2, '0')}:00 ${period}`;
}

function formatScheduleMinute(minuteValue) {
  return String(minuteValue).padStart(2, '0');
}

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
  audienceOptions,
  schedDate,
  setSchedDate,
  minScheduleDateTime,
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
                      {audienceOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          disabled={option.disabled}
                          className="text-sm"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                      Schedule
                    </label>

                    {schedDate && (
                      <button
                        type="button"
                        onClick={() => setSchedDate('')}
                        className="text-[10px] font-medium text-stone-400 transition hover:text-stone-700"
                      >
                        Clear schedule
                      </button>
                    )}
                  </div>

                  {(() => {
                    const selected = getLocalScheduleParts(schedDate);
                    const minimum = getLocalScheduleParts(minScheduleDateTime);

                    const selectedDate = selected.date;
                    const selectedHour = selected.hour;
                    const selectedMinute = selected.minute;

                    const minimumDate = minimum.date;
                    const minimumHour = minimum.hour;
                    const minimumMinute = minimum.minute;

                    const minimumHourNumber = Number(minimumHour || 0);
                    const selectedHourNumber = Number(selectedHour || 0);

                    const availableHours = Array.from(
                      { length: 24 },
                      (_, index) => index
                    ).filter((hour) => {
                      if (!selectedDate || selectedDate !== minimumDate) return true;
                      return hour >= minimumHourNumber;
                    });

                    const availableMinutes = Array.from(
                      { length: 60 },
                      (_, index) => index
                    ).filter((minute) => {
                      if (
                        !selectedDate ||
                        selectedDate !== minimumDate ||
                        selectedHourNumber !== minimumHourNumber
                      ) {
                        return true;
                      }

                      return minute >= Number(minimumMinute || 0);
                    });

                    const handleDateChange = (event) => {
                      const nextDate = event.target.value;

                      if (!nextDate) {
                        setSchedDate('');
                        return;
                      }

                      if (minimumDate && nextDate < minimumDate) {
                        return;
                      }

                      const isMinimumDate = nextDate === minimumDate;

                      let nextHour = selectedHour
                        ? Number(selectedHour)
                        : isMinimumDate
                          ? minimumHourNumber
                          : 0;

                      if (isMinimumDate && nextHour < minimumHourNumber) {
                        nextHour = minimumHourNumber;
                      }

                      let nextMinute = selectedMinute
                        ? Number(selectedMinute)
                        : isMinimumDate && nextHour === minimumHourNumber
                          ? Number(minimumMinute || 0)
                          : 0;

                      if (
                        isMinimumDate &&
                        nextHour === minimumHourNumber &&
                        nextMinute < Number(minimumMinute || 0)
                      ) {
                        nextMinute = Number(minimumMinute || 0);
                      }

                      setSchedDate(
                        `${nextDate}T${String(nextHour).padStart(2, '0')}:${String(
                          nextMinute
                        ).padStart(2, '0')}`
                      );
                    };

                    const handleHourChange = (value) => {
                      if (!selectedDate) return;

                      const nextHour = Number(value);
                      let nextMinute = selectedMinute
                        ? Number(selectedMinute)
                        : 0;

                      if (
                        selectedDate === minimumDate &&
                        nextHour === minimumHourNumber &&
                        nextMinute < Number(minimumMinute || 0)
                      ) {
                        nextMinute = Number(minimumMinute || 0);
                      }

                      setSchedDate(
                        `${selectedDate}T${String(nextHour).padStart(2, '0')}:${String(
                          nextMinute
                        ).padStart(2, '0')}`
                      );
                    };

                    const handleMinuteChange = (value) => {
                      if (!selectedDate || selectedHour === '') return;

                      setSchedDate(
                        `${selectedDate}T${selectedHour}:${String(value).padStart(
                          2,
                          '0'
                        )}`
                      );
                    };

                    return (
                      <div className="space-y-2">
                        <Input
                          type="date"
                          value={selectedDate}
                          min={minimumDate}
                          onChange={handleDateChange}
                          className={`h-10 rounded-lg border-stone-200 bg-white text-sm ${
                            validationErrors.schedule
                              ? 'border-red-300 ring-1 ring-red-200'
                              : ''
                          }`}
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={selectedHour}
                            onChange={(event) => handleHourChange(event.target.value)}
                            disabled={!selectedDate}
                            className={`h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-300 focus:ring-2 focus:ring-stone-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 ${
                              validationErrors.schedule
                                ? 'border-red-300 ring-1 ring-red-200'
                                : ''
                            }`}
                            aria-label="Schedule hour"
                          >
                            <option value="" disabled>
                              Hour
                            </option>
                            {availableHours.map((hour) => {
                              const hourValue = String(hour).padStart(2, '0');

                              return (
                                <option key={hourValue} value={hourValue}>
                                  {formatScheduleHour(hourValue)}
                                </option>
                              );
                            })}
                          </select>

                          <select
                            value={selectedMinute}
                            onChange={(event) => handleMinuteChange(event.target.value)}
                            disabled={!selectedDate || selectedHour === ''}
                            className={`h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-300 focus:ring-2 focus:ring-stone-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 ${
                              validationErrors.schedule
                                ? 'border-red-300 ring-1 ring-red-200'
                                : ''
                            }`}
                            aria-label="Schedule minute"
                          >
                            <option value="" disabled>
                              Minute
                            </option>
                            {availableMinutes.map((minute) => {
                              const minuteValue = String(minute).padStart(2, '0');

                              return (
                                <option key={minuteValue} value={minuteValue}>
                                  :{formatScheduleMinute(minuteValue)}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <p className="text-[10px] leading-4 text-stone-400">
                          Past dates cannot be selected. Past hours and minutes are removed from
                          the native time dropdowns. The earliest schedule is the next minute.
                        </p>

                        {validationErrors.schedule && (
                          <p className="text-xs text-red-500">
                            {validationErrors.schedule}
                          </p>
                        )}
                      </div>
                    );
                  })()}
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
                        {audienceOptions.find((option) => option.value === audience)?.label || 'Audience'}
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
  selectedTemplate,
}) {
  if (!open) return null;

  const isBlankTemplate = selectedTemplate === 'blank';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onCancel} />

      <Card className="relative w-full max-w-md overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <h3 className="text-sm font-semibold text-stone-800">
            {isBlankTemplate ? 'Clear announcement?' : 'Apply template'}
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            {isBlankTemplate
              ? 'This will clear the current subject, content, audience, schedule, and RO category.'
              : 'Applying a template will replace your current subject and content.'}
          </p>
        </div>

        <CardContent className="flex flex-col gap-3 p-5">
          <Button
            variant="outline"
            onClick={onCancel}
            className="h-11 w-full rounded-lg border-stone-200"
          >
            {isBlankTemplate ? 'Keep Current Announcement' : 'Keep Current Content'}
          </Button>

          <Button
            onClick={onConfirm}
            className="h-11 w-full rounded-lg border-none text-white"
            style={{ background: C.brownMid }}
          >
            {isBlankTemplate ? 'Clear Form' : 'Apply Template'}
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
  archivingId,
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
    <article className="group overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-sm">
      <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div
            className="announcement-icon mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ background: 'var(--portal-accent-soft)', color: 'var(--portal-base)' }}
            aria-hidden="true"
          >
            <Megaphone className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="min-w-0 truncate text-sm font-semibold text-stone-900 sm:text-base">
                {announcement.title}
              </h3>
              <StatusPill status={effectiveStatus} />
            </div>

            <p className="mt-1.5 truncate text-sm leading-5 text-stone-600" title={announcement.content}>
              {announcement.content}
            </p>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-stone-500">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <Calendar size={13} />
                {announcement.date
                  ? new Date(announcement.date).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                  : 'No date'}
              </span>

              <span className="flex min-w-0 items-center gap-1.5">
                <Users size={13} className="shrink-0" />
                <span className="truncate">{announcement.audience || 'Audience'}</span>
              </span>

              {effectiveStatus === 'Published' && (
                <span className="flex items-center gap-1.5 whitespace-nowrap text-stone-600">
                  <Eye size={13} />
                  {announcement.views} views
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 pt-3 lg:pl-4 lg:pt-0">
          {tab === 'active' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(announcement)}
                className="h-9 rounded-lg border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>

              {announcement.status === 'Draft' && (
                <Button
                  size="sm"
                  onClick={() => onPublish(announcement.id)}
                  disabled={publishingId === announcement.id}
                  className="h-9 rounded-lg border-none bg-green-600 px-3 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
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
                disabled={archivingId === announcement.id}
                className="h-9 rounded-lg border-red-200 bg-white px-3 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {archivingId === announcement.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Archive className="mr-1.5 h-3.5 w-3.5" />
                    Archive
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => onRestore(announcement.id)}
              disabled={restoringId === announcement.id}
              className="h-9 rounded-lg border-none px-3 text-xs font-medium text-white hover:opacity-90"
              style={{ background: C.brownMid }}
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
    </article>
  );
}

function normalizePrefillAudience(value) {
  const raw = String(value || '').trim().toLowerCase();

  if (!raw) return 'all';

  if (raw === 'all' || raw === 'all students') return 'all';

  if (
    raw === 'applicant' ||
    raw === 'applicants' ||
    raw === 'new applicants' ||
    raw === 'new_applicants'
  ) {
    return 'applicants';
  }

  if (
    raw === 'scholar' ||
    raw === 'scholars' ||
    raw === 'current scholars' ||
    raw === 'current_scholars'
  ) {
    return 'scholars';
  }

  if (raw === 'tes' || raw.includes('tertiary education subsidy')) return 'tes';
  if (raw === 'tdp') return 'tdp';

  return 'all';
}

function buildOpeningPrefillContent(params) {
  const openingTitle = params.get('opening_title') || 'Scholarship Opening';
  const openingText = params.get('announcement_text') || '';
  const academicYear = params.get('academic_year') || '';
  const postingStatus = params.get('posting_status') || '';

  const lines = [
    openingText || `A scholarship opening for ${openingTitle} is now available.`,
    academicYear ? `\nAcademic Year: ${academicYear}` : '',
    postingStatus ? `Status: ${postingStatus}` : '',
    '\nPlease check the scholarship system for complete details and requirements.',
  ];

  return lines.filter(Boolean).join('\n');
}

function buildPayoutPrefillContent(params) {
  const payoutTitle = params.get('title') || params.get('subject') || 'Scholarship Payout Announcement';
  const content = params.get('content');

  if (content) return content;

  const payoutDate = params.get('payout_date') || '';
  const paymentMode = params.get('payment_mode') || '';
  const amountPerScholar = params.get('amount_per_scholar') || '';
  const academicYear = params.get('academic_year') || '';
  const semester = params.get('semester') || '';

  return [
    'Good day, scholars.',
    '',
    `Please be informed that ${payoutTitle} has been created.`,
    '',
    payoutDate ? `Payout Date: ${payoutDate}` : '',
    paymentMode ? `Payment Mode: ${paymentMode}` : '',
    amountPerScholar ? `Amount per Scholar: ${amountPerScholar}` : '',
    academicYear ? `Academic Year: ${academicYear}` : '',
    semester ? `Semester: ${semester}` : '',
    '',
    'Please wait for further instructions from OSFA regarding the release process.',
  ]
    .filter((line) => line !== '')
    .join('\n');
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
  const [minScheduleDateTime, setMinScheduleDateTime] = useState('');
  const [isRoVoluntary, setIsRoVoluntary] = useState('false');
  const [selectedTemplate, setSelectedTemplate] = useState('blank');

  const [items, setItems] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const loadPrograms = useCallback(async () => {
    try {
      setProgramsLoading(true);
      const token = sessionStorage.getItem('adminToken');
      const response = await fetch(buildApiUrl('/api/scholarship-program'), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to load scholarship programs');
      }

      setPrograms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('LOAD ANNOUNCEMENT PROGRAMS ERROR:', error);
      setPrograms([]);
    } finally {
      setProgramsLoading(false);
    }
  }, []);

  const loadAnnouncements = useCallback(async (options = {}) => {
    const silent = options.silent === true;

    try {
      if (!silent) {
        setLoading(true);
      }

      const token = sessionStorage.getItem('adminToken');

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

      if (!silent) {
        showAppToast(
          'error',
          'Failed to load announcements',
          err.message || 'Failed to load announcements'
        );
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
    loadPrograms();
  }, [loadAnnouncements, loadPrograms]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadAnnouncements({ silent: true });
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadAnnouncements]);

  useEffect(() => {
    if (!showForm) return undefined;

    const refreshMinimumSchedule = () => {
      setMinScheduleDateTime(nextSchedulableLocalDateTimeInputValue());
    };

    refreshMinimumSchedule();

    const intervalId = window.setInterval(refreshMinimumSchedule, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [showForm]);

  useSocketEvent('maintenance:updated', () => {
    loadPrograms();
  }, [loadPrograms]);

  useSocketEvent('announcement:created', () => {
    console.log('[Socket] announcement:created received');
    loadAnnouncements({ silent: true });
  }, [loadAnnouncements]);

  useSocketEvent('announcement:updated', () => {
    console.log('[Socket] announcement:updated received');
    loadAnnouncements({ silent: true });
  }, [loadAnnouncements]);

  useSocketEvent('announcement:published', () => {
    console.log('[Socket] announcement:published received');
    loadAnnouncements({ silent: true });
  }, [loadAnnouncements]);

  useSocketEvent('announcement:archived', () => {
    console.log('[Socket] announcement:archived received');
    loadAnnouncements({ silent: true });
  }, [loadAnnouncements]);

  useSocketEvent('announcement:restored', () => {
    console.log('[Socket] announcement:restored received');
    loadAnnouncements({ silent: true });
  }, [loadAnnouncements]);

  useSocketEvent('announcement:refresh', () => {
    console.log('[Socket] announcement:refresh received');
    loadAnnouncements({ silent: true });
  }, [loadAnnouncements]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prefill = String(params.get('prefill') || '').toLowerCase();

    if (!prefill) return;

    if (prefill === 'opening') {
      const openingTitle =
        params.get('opening_title') ||
        params.get('title') ||
        params.get('subject') ||
        'Scholarship Opening Announcement';

      const targetAudience =
        params.get('target_audience') ||
        params.get('audience') ||
        'all';

      setEditingAnnouncementId(null);
      setTitle(openingTitle);
      setContent(buildOpeningPrefillContent(params));
      setAudience(normalizePrefillAudience(targetAudience));
      setSchedDate('');
      setMinScheduleDateTime(nextSchedulableLocalDateTimeInputValue());
      setIsRoVoluntary('false');
      setSelectedTemplate('blank');
      setValidationErrors({});
      setSearch('');
      setStatusFilter('All');
      setTab('active');
      setShowForm(true);

      navigate(location.pathname, { replace: true });
      return;
    }

    if (prefill === 'payout') {
      const payoutTitle =
        params.get('title') ||
        params.get('subject') ||
        'Scholarship Payout Announcement';

      const targetAudience =
        params.get('target_audience') ||
        params.get('audience') ||
        'scholars';

      const payoutProgramId = params.get('program_id') || '';
      const payoutProgram = programs.find(
        (program) =>
          String(program.program_id) === String(payoutProgramId) &&
          program.is_archived !== true &&
          String(program.visibility_status || 'Published') === 'Published'
      );

      if (payoutProgramId && programsLoading) return;

      setEditingAnnouncementId(null);
      setTitle(payoutTitle);
      setContent(buildPayoutPrefillContent(params));
      setAudience(
        payoutProgram
          ? programAudienceValue(payoutProgram.program_id)
          : normalizePrefillAudience(targetAudience)
      );
      setSchedDate('');
      setMinScheduleDateTime(nextSchedulableLocalDateTimeInputValue());
      setIsRoVoluntary('false');
      setSelectedTemplate('payout_notice');
      setValidationErrors({});
      setSearch('');
      setStatusFilter('All');
      setTab('active');
      setShowForm(true);

      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate, programs, programsLoading]);

  const hasUnsavedChanges = useMemo(() => {
    return (
      title.trim() !== '' ||
      content.trim() !== '' ||
      audience !== 'all' ||
      schedDate !== '' ||
      isRoVoluntary !== 'false'
    );
  }, [title, content, audience, schedDate, isRoVoluntary]);

  const audienceOptions = useMemo(
    () => buildAudienceOptions(programs, audience),
    [programs, audience]
  );

  useEffect(() => {
    if (!validationErrors.schedule || !schedDate) return;

    const freshMinimumSchedule =
      nextSchedulableLocalDateTimeInputValue();

    if (schedDate >= freshMinimumSchedule) {
      setValidationErrors((previous) => {
        const next = { ...previous };
        delete next.schedule;
        return next;
      });
    }
  }, [schedDate, validationErrors.schedule]);

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
    setMinScheduleDateTime(nextSchedulableLocalDateTimeInputValue());
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
    setAudience(
      announcement.audienceKey === 'program' && announcement.targetProgramId
        ? programAudienceValue(announcement.targetProgramId)
        : announcement.audienceKey || 'all'
    );
    setSchedDate(
      announcement.status === 'Scheduled' && announcement.date
        ? toLocalDateTimeInputValue(announcement.date)
        : ''
    );
    setMinScheduleDateTime(nextSchedulableLocalDateTimeInputValue());
    setIsRoVoluntary(announcement.isRoVoluntary ? 'true' : 'false');
    setSelectedTemplate(resolveAnnouncementTemplate(announcement));
    setValidationErrors({});
    setShowForm(true);
  };

  const validateForPublish = () => {
    const errors = {};

    if (!title.trim()) errors.title = 'Announcement subject is required.';
    if (!content.trim()) errors.content = 'Announcement content is required.';

    if (schedDate) {
      const freshMinimumSchedule =
        nextSchedulableLocalDateTimeInputValue();

      setMinScheduleDateTime(freshMinimumSchedule);

      if (schedDate < freshMinimumSchedule) {
        errors.schedule =
          'Choose a future schedule. The earliest available time is the next minute.';
      }
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

    if (selectedTemplate === 'blank') {
      setSchedDate('');
    }

    setValidationErrors({});
    setShowTemplateConfirmModal(false);
  };

  const handleApplyTemplate = () => {
    const hasCurrentFormValues =
      title.trim() ||
      content.trim() ||
      audience !== 'all' ||
      schedDate !== '' ||
      isRoVoluntary !== 'false';

    if (hasCurrentFormValues) {
      setShowTemplateConfirmModal(true);
      return;
    }

    applyTemplateNow();
  };

  const saveAnnouncementRequest = async ({ forceDraft = false }) => {
    const token = sessionStorage.getItem('adminToken');
    const isEditing = !!editingAnnouncementId;

    const url = isEditing
      ? buildApiUrl(`/api/announcements/${editingAnnouncementId}`)
      : buildApiUrl('/api/announcements');

    const method = isEditing ? 'PATCH' : 'POST';
    const audienceTarget = parseAudienceSelection(audience);

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title.trim(),
        content: content.trim(),
        templateKey: selectedTemplate,
        audience: audienceTarget.audience,
        programId: audienceTarget.programId,
        schedDate: schedDate ? toUtcIsoFromLocalInput(schedDate) : null,
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
    await loadAnnouncements({ silent: true });

    try {
      if (!validateForPublish()) return;

      const wasEditing = !!editingAnnouncementId;

      setPosting(true);

      const data = await saveAnnouncementRequest({ forceDraft: false });

      if (data?.data) {
        if (editingAnnouncementId) {
          setItems((prev) =>
            prev.map((item) => (item.id === data.data.id ? data.data : item))
          );
        } else {
          setItems((prev) => [data.data, ...prev]);
        }
      }

      resetForm();
      setShowForm(false);
      setShowDiscardModal(false);

      showAppToast(
        'success',
        wasEditing ? 'Announcement updated' : 'Announcement saved',
        wasEditing
          ? 'The announcement was updated successfully.'
          : 'The announcement was saved successfully.'
      );
    } catch (err) {
      console.error('POST ANNOUNCEMENT ERROR:', err);

      showAppToast(
        'error',
        'Save failed',
        err.message || 'Failed to save announcement'
      );
    } finally {
      setPosting(false);
    }
  };

  const handleSaveDraft = async () => {
    await loadAnnouncements({ silent: true });

    try {
      if (!title.trim() && !content.trim()) {
        handleCancelAnnouncement();
        return;
      }

      if (schedDate) {
        const freshMinimumSchedule =
          nextSchedulableLocalDateTimeInputValue();

        setMinScheduleDateTime(freshMinimumSchedule);

        if (schedDate < freshMinimumSchedule) {
          setValidationErrors((previous) => ({
            ...previous,
            schedule:
              'Choose a future schedule. The earliest available time is the next minute.',
          }));
          return;
        }
      }

      setDraftSaving(true);

      const data = await saveAnnouncementRequest({ forceDraft: true });

      if (data?.data) {
        if (editingAnnouncementId) {
          setItems((prev) =>
            prev.map((item) => (item.id === data.data.id ? data.data : item))
          );
        } else {
          setItems((prev) => [data.data, ...prev]);
        }
      }

      resetForm();
      setShowForm(false);
      setShowDiscardModal(false);

      showAppToast(
        'success',
        'Draft saved',
        'The announcement draft was saved successfully.'
      );
    } catch (err) {
      console.error('SAVE DRAFT ERROR:', err);

      showAppToast(
        'error',
        'Draft save failed',
        err.message || 'Failed to save draft'
      );
    } finally {
      setDraftSaving(false);
    }
  };

  const handleArchive = async (id) => {
    await loadAnnouncements({ silent: true });

    try {
      setArchivingId(id);

      const token = sessionStorage.getItem('adminToken');

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
      showAppToast(
        'success',
        'Announcement archived',
        'The announcement was moved to Archived.'
      );
    } catch (err) {
      console.error('ARCHIVE ANNOUNCEMENT ERROR:', err);
      showAppToast(
        'error',
        'Archive failed',
        err.message || 'Failed to archive announcement'
      );
    } finally {
      setArchivingId(null);
    }
  };

  const handleRestore = async (id) => {
    await loadAnnouncements({ silent: true });

    try {
      setRestoringId(id);

      const token = sessionStorage.getItem('adminToken');

      const res = await fetch(buildApiUrl(`/api/announcements/${id}/restore`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore announcement');
      }

      await loadAnnouncements({ silent: true });
      const publishedOnRestore = data?.data?.publishedNow === true;
      showAppToast(
        'success',
        publishedOnRestore ? 'Announcement restored and published' : 'Announcement restored',
        publishedOnRestore
          ? 'Its scheduled time already passed, so the announcement is now published.'
          : 'The announcement was restored successfully.'
      );
    } catch (err) {
      console.error('RESTORE ANNOUNCEMENT ERROR:', err);
      showAppToast(
        'error',
        'Restore failed',
        err.message || 'Failed to restore announcement'
      );
    } finally {
      setRestoringId(null);
    }
  };

  const handlePublish = async (id) => {
    await loadAnnouncements({ silent: true });

    try {
      setPublishingId(id);

      const token = sessionStorage.getItem('adminToken');

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
      showAppToast(
        'success',
        'Announcement published',
        'The announcement is now visible to its intended audience.'
      );
    } catch (err) {
      console.error('PUBLISH ANNOUNCEMENT ERROR:', err);
      showAppToast(
        'error',
        'Publish failed',
        err.message || 'Failed to publish announcement'
      );
    } finally {
      setPublishingId(null);
    }
  };

  if (loading) {
    return <PageLoadingSkeleton label="Loading announcements" variant="cards" />;
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
        audienceOptions={audienceOptions}
        schedDate={schedDate}
        setSchedDate={setSchedDate}
        minScheduleDateTime={minScheduleDateTime}
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
        selectedTemplate={selectedTemplate}
      />



      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 p-1">
          <button
            onClick={() => setTab('active')}
            className={`h-9 rounded-lg px-4 text-sm font-medium transition ${tab === 'active'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
              }`}
          >
            Active
          </button>

          <button
            onClick={() => setTab('archived')}
            className={`h-9 rounded-lg px-4 text-sm font-medium transition ${tab === 'archived'
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
              }`}
          >
            Archived
          </button>
        </div>

        {tab === 'active' && (
          <Button
            onClick={handleOpenModal}
            size="sm"
            className="h-9 rounded-lg border-none px-3 text-sm font-medium text-white"
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
              className="h-9 rounded-lg border-stone-200 px-3 text-sm text-stone-700"
            >
              Reset
            </Button>
          )}
        </div>

        <div className="space-y-2.5 p-4">
          {filteredItems.length === 0 ? (
            <EmptyList archived={tab === 'archived'} />
          ) : (
            filteredItems.map((announcement) => (
              <AnnouncementRow
                key={announcement.id}
                announcement={announcement}
                tab={tab}
                publishingId={publishingId}
                archivingId={archivingId}
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
