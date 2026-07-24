import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Clock3,
  FileText,
  LoaderCircle,
  Plus,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';

const MAX_NOTE_LENGTH = 2000;
const MAX_EVENTS = 30;
const WEATHER_REFRESH_INTERVAL = 15 * 60 * 1000;
const MARILAO_WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=14.7574&longitude=120.9483&current=temperature_2m,weather_code,is_day&temperature_unit=celsius&timezone=Asia%2FManila';

function getWeatherMeta(code, isDay) {
  if (code === 0) {
    return { label: 'Clear', Icon: isDay ? Sun : CloudSun };
  }
  if ([1, 2].includes(code)) {
    return { label: 'Partly cloudy', Icon: CloudSun };
  }
  if (code === 3) {
    return { label: 'Cloudy', Icon: Cloud };
  }
  if ([45, 48].includes(code)) {
    return { label: 'Foggy', Icon: CloudFog };
  }
  if ([95, 96, 99].includes(code)) {
    return { label: 'Thunderstorm', Icon: CloudLightning };
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: 'Rainy', Icon: CloudRain };
  }
  return { label: 'Cloudy', Icon: Cloud };
}

function toLocalDateInput(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDateParts(now) {
  const timeParts = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(now);
  const hour = timeParts.find((part) => part.type === 'hour')?.value || '';
  const minute = timeParts.find((part) => part.type === 'minute')?.value || '';
  const dayPeriod = timeParts.find((part) => part.type === 'dayPeriod')?.value || '';

  return {
    dayName: new Intl.DateTimeFormat('en-PH', { weekday: 'short' })
      .format(now)
      .toUpperCase(),
    dayNameLong: new Intl.DateTimeFormat('en-PH', { weekday: 'long' }).format(now),
    dayNumber: new Intl.DateTimeFormat('en-PH', { day: '2-digit' }).format(now),
    monthShort: new Intl.DateTimeFormat('en-PH', { month: 'short' })
      .format(now)
      .toUpperCase(),
    monthLong: new Intl.DateTimeFormat('en-PH', { month: 'long' }).format(now),
    year: new Intl.DateTimeFormat('en-PH', { year: 'numeric' }).format(now),
    timeLabel: `${hour}:${minute}`,
    dayPeriod,
    seconds: String(now.getSeconds()).padStart(2, '0'),
  };
}

function formatEventDate(value) {
  if (!value) return 'No date';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatEventTime(value) {
  if (!value) return 'All day';
  const [hour, minute] = String(value).split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDayOffset = new Date(year, month, 1).getDay();

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index - firstDayOffset + 1);
    return {
      date,
      dateKey: toLocalDateInput(date),
      isCurrentMonth: date.getMonth() === month,
    };
  });
}

async function requestPersonalTools(path, tokenStorageKey, options = {}) {
  const token = sessionStorage.getItem(tokenStorageKey);
  if (!token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(buildApiUrl(`/api/personal-tools${path}`), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Your private workspace could not be updated.');
  }

  return payload;
}

export default function PortalQuickTools({
  tokenStorageKey,
  noteTitle = 'Quick Notes',
  notificationOpen = false,
  onToolOpen,
  accentClassName = 'hover:bg-stone-100',
}) {
  const [now, setNow] = useState(() => new Date());
  const [notesOpen, setNotesOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [events, setEvents] = useState([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState('');
  const [noteSaveState, setNoteSaveState] = useState('idle');
  const [eventSaving, setEventSaving] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(() => toLocalDateInput());
  const [eventTime, setEventTime] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateInput());
  const [plannerTargetEventId, setPlannerTargetEventId] = useState('');
  const [weather, setWeather] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const notesRef = useRef(null);
  const calendarRef = useRef(null);
  const noteSaveTimerRef = useRef(null);
  const currentNoteRef = useRef('');

  useEffect(() => {
    let active = true;
    let controller = new AbortController();

    const loadWeather = async () => {
      controller.abort();
      controller = new AbortController();

      try {
        const response = await fetch(MARILAO_WEATHER_URL, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = await response.json();
        const current = payload?.current;
        if (!active || !Number.isFinite(current?.temperature_2m)) return;

        setWeather({
          temperature: Math.round(current.temperature_2m),
          code: Number(current.weather_code),
          isDay: Number(current.is_day) === 1,
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          // Weather is supplementary, so a failed request should not affect portal tools.
          setWeather(null);
        }
      }
    };

    loadWeather();
    const interval = window.setInterval(loadWeather, WEATHER_REFRESH_INTERVAL);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!notificationOpen) return;
    setNotesOpen(false);
    setCalendarOpen(false);
  }, [notificationOpen]);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setWorkspaceLoading(true);
      setWorkspaceError('');

      try {
        const workspace = await requestPersonalTools('', tokenStorageKey);
        if (!active) return;

        const nextNote = String(workspace.note || '');
        currentNoteRef.current = nextNote;
        setNoteValue(nextNote);
        setSavedAt(workspace.note_updated_at || null);
        setEvents(Array.isArray(workspace.events) ? workspace.events : []);
        setNoteSaveState('idle');
      } catch (error) {
        if (active) setWorkspaceError(error.message);
      } finally {
        if (active) setWorkspaceLoading(false);
      }
    }

    loadWorkspace();

    return () => {
      active = false;
      if (noteSaveTimerRef.current) {
        window.clearTimeout(noteSaveTimerRef.current);
      }
    };
  }, [tokenStorageKey]);

  useSocketEvent('personal-tools:updated', (payload = {}) => {
    const workspace = payload.workspace || {};
    setEvents(Array.isArray(workspace.events) ? workspace.events : []);

    if (payload.action !== 'note_updated' || !noteSaveTimerRef.current) {
      const nextNote = String(workspace.note || '');
      currentNoteRef.current = nextNote;
      setNoteValue(nextNote);
      setSavedAt(workspace.note_updated_at || null);
      setNoteSaveState('saved');
    }
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notesRef.current && !notesRef.current.contains(event.target)) {
        setNotesOpen(false);
      }
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setCalendarOpen(false);
        setEventFormOpen(false);
      }
    }

    if (notesOpen || calendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [calendarOpen, notesOpen]);

  useEffect(() => {
    function openPlanner(event) {
      setPlannerTargetEventId(String(event.detail?.eventId || ''));
      setCalendarOpen(true);
      setNotesOpen(false);
    }

    window.addEventListener('personal-planner:open', openPlanner);
    return () => window.removeEventListener('personal-planner:open', openPlanner);
  }, []);

  useEffect(() => {
    if (!plannerTargetEventId || !events.length) return;
    const reminder = events.find(
      (event) => String(event?.id || '') === plannerTargetEventId
    );
    if (!reminder?.date) return;

    const reminderDate = new Date(`${reminder.date}T00:00:00`);
    setSelectedDate(reminder.date);
    setEventDate(reminder.date);
    setVisibleMonth(
      new Date(reminderDate.getFullYear(), reminderDate.getMonth(), 1)
    );
    setPlannerTargetEventId('');
  }, [events, plannerTargetEventId]);

  const {
    dayName,
    dayNameLong,
    dayNumber,
    monthShort,
    monthLong,
    year,
    timeLabel,
    dayPeriod,
    seconds,
  } = formatDateParts(now);
  const today = toLocalDateInput(now);
  const weatherMeta = weather
    ? getWeatherMeta(weather.code, weather.isDay)
    : null;

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const selectedEvents = useMemo(
    () =>
      [...events]
        .filter((event) => event.date === selectedDate)
        .sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59')),
    [events, selectedDate]
  );
  const dueTodayCount = events.filter(
    (event) => event.date === today
  ).length;
  const plannerMonthLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
  }).format(visibleMonth);
  const selectedDateLabel = new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${selectedDate}T00:00:00`));

  const persistNote = async (nextValue) => {
    setNoteSaveState('saving');
    setWorkspaceError('');

    try {
      const workspace = await requestPersonalTools('/note', tokenStorageKey, {
        method: 'PATCH',
        body: JSON.stringify({ note: nextValue }),
      });

      if (currentNoteRef.current === nextValue) {
        setSavedAt(workspace.note_updated_at || new Date().toISOString());
        setNoteSaveState('saved');
      }
    } catch (error) {
      setNoteSaveState('error');
      setWorkspaceError(error.message);
    }
  };

  const handleNoteChange = (event) => {
    const nextValue = event.target.value.slice(0, MAX_NOTE_LENGTH);
    currentNoteRef.current = nextValue;
    setNoteValue(nextValue);
    setNoteSaveState('saving');

    if (noteSaveTimerRef.current) {
      window.clearTimeout(noteSaveTimerRef.current);
    }
    noteSaveTimerRef.current = window.setTimeout(() => {
      noteSaveTimerRef.current = null;
      persistNote(nextValue);
    }, 700);
  };

  const handleClear = () => {
    currentNoteRef.current = '';
    setNoteValue('');
    if (noteSaveTimerRef.current) {
      window.clearTimeout(noteSaveTimerRef.current);
      noteSaveTimerRef.current = null;
    }
    persistNote('');
  };

  const handleAddEvent = async (event) => {
    event.preventDefault();
    const title = eventTitle.trim();
    if (!title || !eventDate) return;

    setEventSaving(true);
    setWorkspaceError('');
    try {
      const workspace = await requestPersonalTools('/events', tokenStorageKey, {
        method: 'POST',
        body: JSON.stringify({ title, date: eventDate, time: eventTime }),
      });
      setEvents(Array.isArray(workspace.events) ? workspace.events : []);
      setEventTitle('');
      setEventDate(selectedDate);
      setEventTime('');
      setEventFormOpen(false);
    } catch (error) {
      setWorkspaceError(error.message);
    } finally {
      setEventSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    setEventSaving(true);
    setWorkspaceError('');
    try {
      const workspace = await requestPersonalTools(
        `/events/${encodeURIComponent(eventId)}`,
        tokenStorageKey,
        { method: 'DELETE' }
      );
      setEvents(Array.isArray(workspace.events) ? workspace.events : []);
    } catch (error) {
      setWorkspaceError(error.message);
    } finally {
      setEventSaving(false);
    }
  };

  const savedLabel = savedAt
    ? new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(savedAt))
    : 'Ready for a new note';

  return (
    <>
      <div className="relative" ref={notesRef}>
        <button
          type="button"
          onClick={() => {
            setNotesOpen((current) => !current);
            setCalendarOpen(false);
            onToolOpen?.();
          }}
          className={`relative rounded-xl border border-stone-200 bg-white p-2.5 text-stone-600 shadow-sm transition-colors ${accentClassName}`}
          style={
            notesOpen
              ? {
                  borderColor: 'var(--portal-border)',
                  color: 'var(--portal-base)',
                  background: 'var(--portal-accent-soft)',
                }
              : { color: 'var(--portal-base)' }
          }
          title="Open quick notes"
          aria-label="Open quick notes"
          aria-expanded={notesOpen}
        >
          <FileText className="h-4 w-4" />
          {noteValue.trim() ? (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--portal-accent)]" />
          ) : null}
        </button>

        {notesOpen && (
          <div className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/80 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: 'var(--portal-border)',
                    background: 'var(--portal-accent-soft)',
                    color: 'var(--portal-base)',
                  }}
                >
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">{noteTitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label="Close notes"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <textarea
                value={noteValue}
                onChange={handleNoteChange}
                disabled={workspaceLoading}
                rows={7}
                maxLength={MAX_NOTE_LENGTH}
                autoFocus
                placeholder={
                  workspaceLoading
                    ? 'Loading note...'
                    : 'Write follow-ups, reminders, or a short task list...'
                }
                className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-3 text-sm leading-6 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[var(--portal-base)] focus:bg-white focus:ring-4 focus:ring-[var(--portal-accent-soft)]"
              />

              {workspaceError ? (
                <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] leading-4 text-red-700">
                  {workspaceError}
                </p>
              ) : null}

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={`flex items-center gap-1.5 text-[11px] font-medium ${
                      noteSaveState === 'error' ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {workspaceLoading || noteSaveState === 'saving' ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {workspaceLoading
                      ? 'Loading'
                      : noteSaveState === 'saving'
                        ? 'Saving'
                        : noteSaveState === 'error'
                          ? 'Not saved'
                          : 'Autosaved'}
                  </p>
                  <p className="truncate text-[10px] text-stone-400">{savedLabel}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] tabular-nums text-stone-400">
                    {noteValue.length}/{MAX_NOTE_LENGTH}
                  </span>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={!noteValue || workspaceLoading || noteSaveState === 'saving'}
                    className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-[11px] font-medium text-stone-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear note
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="relative hidden xl:block" ref={calendarRef}>
        <button
          type="button"
          onClick={() => {
            setCalendarOpen((current) => !current);
            setNotesOpen(false);
            onToolOpen?.();
          }}
          className="group flex h-14 min-w-[336px] cursor-pointer items-center rounded-[20px] border border-stone-200 bg-white px-3 shadow-[0_2px_7px_rgba(28,25,23,0.08)] transition-colors duration-200 hover:border-[var(--portal-border)] hover:bg-[var(--portal-accent-soft)] active:brightness-[0.98] focus:outline-none focus:ring-4 focus:ring-[var(--portal-accent-soft)]"
          title="Open personal planner"
          aria-label={`${dayName}, ${monthShort} ${dayNumber}, ${year}. ${timeLabel}:${seconds} ${dayPeriod}. Open calendar and reminders.`}
          aria-expanded={calendarOpen}
        >
          <div
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors group-hover:brightness-95"
            style={{
              borderColor: 'var(--portal-border)',
              background: 'var(--portal-accent-soft)',
              color: 'var(--portal-base)',
            }}
          >
            <CalendarDays className="h-4 w-4" />
            {dueTodayCount ? (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[9px] font-bold text-white">
                {dueTodayCount}
              </span>
            ) : null}
          </div>

          <div className="min-w-[145px] px-2.5 text-left">
            <div className="flex items-center gap-2">
              <p className="truncate text-[10px] font-semibold uppercase leading-3 tracking-[0.14em] text-stone-500">
                {dayNameLong}
              </p>
              {weather && weatherMeta ? (
                <span
                  className="flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums text-stone-700"
                  title={`${weatherMeta.label} in Marilao, Bulacan`}
                >
                  <weatherMeta.Icon
                    className={`h-3.5 w-3.5 ${
                      weather.code === 0 ? 'text-amber-500' : 'text-[var(--portal-base)]'
                    }`}
                  />
                  {weather.temperature}&deg;C
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm font-semibold leading-4 text-stone-900">
              {monthLong} {dayNumber}, {year}
            </p>
          </div>

          <div className="h-9 w-px bg-stone-200" />

          <div className="min-w-[132px] pl-2.5 text-left">
            <p className="flex items-center gap-1.5 whitespace-nowrap text-[9px] font-semibold uppercase leading-3 tracking-[0.14em] text-stone-500">
              <Clock3 className="h-3 w-3 text-[var(--portal-base)]" />
              Philippine Time
            </p>
            <p className="mt-1 whitespace-nowrap text-sm font-semibold leading-4 tabular-nums tracking-tight text-stone-900">
              {timeLabel}:{seconds} {dayPeriod}
            </p>
          </div>

          <div className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 transition-colors group-hover:border-stone-300 group-hover:text-stone-700">
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                calendarOpen ? 'rotate-180' : ''
              }`}
            />
          </div>

        </button>

        {calendarOpen && (
          <div className="absolute right-0 z-50 mt-2 w-[660px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 bg-white px-4 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: 'var(--portal-border)',
                    background: 'var(--portal-accent-soft)',
                    color: 'var(--portal-base)',
                  }}
                >
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-base font-semibold text-stone-900">Personal Planner</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(today);
                    setEventDate(today);
                    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                  className="h-9 rounded-lg border bg-white px-3 text-[11px] font-semibold transition hover:bg-[var(--portal-accent-soft)]"
                  style={{
                    borderColor: 'var(--portal-border)',
                    color: 'var(--portal-base)',
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEventDate(selectedDate);
                    setEventFormOpen((current) => !current);
                  }}
                  disabled={
                    workspaceLoading ||
                    eventSaving ||
                    events.length >= MAX_EVENTS ||
                    selectedDate < today
                  }
                  title={
                    selectedDate < today
                      ? 'Select today or a future date to add a reminder.'
                      : 'Add a reminder for the selected date.'
                  }
                  className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    eventFormOpen
                      ? 'border border-[var(--portal-border)] bg-[var(--portal-accent-soft)] text-[var(--portal-base)] hover:brightness-95'
                      : 'bg-[var(--portal-base)] text-white hover:opacity-90'
                  }`}
                >
                  {eventFormOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {eventFormOpen ? 'Close' : 'Add reminder'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[354px_1fr]">
              <section className="border-r border-stone-200 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleMonth(
                        (current) =>
                          new Date(current.getFullYear(), current.getMonth() - 1, 1)
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-[var(--portal-accent-soft)]"
                    style={{
                      borderColor: 'var(--portal-border)',
                      color: 'var(--portal-base)',
                    }}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className="text-sm font-semibold text-stone-900">{plannerMonthLabel}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleMonth(
                        (current) =>
                          new Date(current.getFullYear(), current.getMonth() + 1, 1)
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-[var(--portal-accent-soft)]"
                    style={{
                      borderColor: 'var(--portal-border)',
                      color: 'var(--portal-base)',
                    }}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
                    <div
                      key={`${label}-${index}`}
                      className="flex h-7 items-center justify-center text-[10px] font-semibold text-stone-400"
                    >
                      {label}
                    </div>
                  ))}
                  {calendarDays.map((day) => {
                    const isSelected = day.dateKey === selectedDate;
                    const isToday = day.dateKey === today;
                    const eventCount = events.filter(
                      (event) => event.date === day.dateKey
                    ).length;

                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        onClick={() => {
                          setSelectedDate(day.dateKey);
                          setEventDate(day.dateKey);
                          if (!day.isCurrentMonth) {
                            setVisibleMonth(
                              new Date(day.date.getFullYear(), day.date.getMonth(), 1)
                            );
                          }
                        }}
                        className={`relative flex h-10 items-center justify-center rounded-lg text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-[var(--portal-base)] text-white shadow-sm'
                            : day.isCurrentMonth
                              ? 'text-stone-700 hover:bg-stone-100'
                              : 'text-stone-300 hover:bg-stone-50'
                        }`}
                        aria-label={`Select ${formatEventDate(day.dateKey)}`}
                      >
                        {day.date.getDate()}
                        {eventCount > 0 ? (
                          <span
                            className={`absolute bottom-1 h-1 w-1 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-[var(--portal-accent)]'
                            }`}
                          />
                        ) : null}
                        {isToday && !isSelected ? (
                          <span className="absolute inset-0 rounded-lg border border-[var(--portal-base)]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="min-w-0 bg-stone-50/40">
            {eventFormOpen ? (
              <form onSubmit={handleAddEvent} className="border-b border-stone-200 bg-white p-4">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-stone-900">New reminder</p>
                  <p className="mt-0.5 text-[10px] text-stone-500">
                    Add a task or important review date.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="personal-reminder-title"
                    className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-500"
                  >
                    Title
                  </label>
                  <input
                    id="personal-reminder-title"
                    value={eventTitle}
                    onChange={(event) => setEventTitle(event.target.value)}
                    maxLength={100}
                    placeholder="Example: Review pending endorsements"
                    className="mt-1.5 h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[var(--portal-base)] focus:ring-4 focus:ring-[var(--portal-accent-soft)]"
                    autoFocus
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                      Date
                    </span>
                    <input
                      type="date"
                      value={eventDate}
                      min={today}
                      onChange={(event) => {
                        const nextDate = event.target.value;
                        setEventDate(nextDate);
                        setSelectedDate(nextDate);
                        const parsedDate = new Date(`${nextDate}T00:00:00`);
                        if (!Number.isNaN(parsedDate.getTime())) {
                          setVisibleMonth(
                            new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1)
                          );
                        }
                      }}
                      className="mt-1.5 h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-700 outline-none transition focus:border-[var(--portal-base)] focus:ring-4 focus:ring-[var(--portal-accent-soft)]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                      Time <span className="normal-case tracking-normal text-stone-400">(optional)</span>
                    </span>
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(event) => setEventTime(event.target.value)}
                      className="mt-1.5 h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-700 outline-none transition focus:border-[var(--portal-base)] focus:ring-4 focus:ring-[var(--portal-accent-soft)]"
                    />
                  </label>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-stone-200 pt-3">
                  <button
                    type="button"
                    onClick={() => setEventFormOpen(false)}
                    className="h-9 rounded-lg border border-[var(--portal-border)] bg-white px-3 text-[11px] font-semibold text-[var(--portal-base)] transition hover:bg-[var(--portal-accent-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      !eventTitle.trim() ||
                      !eventDate ||
                      eventSaving ||
                      events.length >= MAX_EVENTS
                    }
                    className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--portal-base)] px-4 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {eventSaving ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CalendarPlus className="h-3.5 w-3.5" />
                    )}
                    {eventSaving ? 'Saving...' : 'Save reminder'}
                  </button>
                </div>
              </form>
            ) : null}

            {!eventFormOpen ? (
            <div className="max-h-[260px] overflow-y-auto p-4">
              {workspaceLoading ? (
                <div className="flex items-center justify-center gap-2 px-5 py-10 text-xs font-medium text-stone-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading your reminders...
                </div>
              ) : selectedEvents.length ? (
                <div>
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-stone-800">
                      {selectedDateLabel}
                    </p>
                    <p className="mt-0.5 text-[10px] text-stone-500">
                      {selectedEvents.length} {selectedEvents.length === 1 ? 'reminder' : 'reminders'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {selectedEvents.map((event) => (
                      <div
                        key={event.id}
                        className="group/event flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5 transition hover:bg-stone-50/70"
                      >
                        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-stone-200 bg-stone-50">
                          <span className="text-[9px] font-semibold uppercase text-stone-400">
                            {formatEventDate(event.date).split(' ')[1] || ''}
                          </span>
                          <span className="text-sm font-bold text-stone-800">
                            {new Date(`${event.date}T00:00:00`).getDate()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-stone-800">
                            {event.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-stone-500">
                            {formatEventDate(event.date)}
                            {` / ${formatEventTime(event.time)}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={eventSaving}
                          className="rounded-lg p-2 text-stone-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover/event:opacity-100 focus:opacity-100"
                          aria-label={`Delete ${event.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-3 py-9 text-center">
                  <CalendarPlus className="mx-auto h-7 w-7 text-stone-300" />
                  <p className="mt-3 text-xs font-semibold text-stone-700">
                    No reminders for this day
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-stone-400">
                    Select Add reminder to schedule something for {selectedDateLabel}.
                  </p>
                </div>
              )}
            </div>
            ) : null}
              </section>
            </div>

            {workspaceError ? (
              <div className="border-t border-red-100 bg-red-50 px-4 py-2.5">
                <p className="mt-1 text-[10px] font-medium text-red-600">{workspaceError}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
