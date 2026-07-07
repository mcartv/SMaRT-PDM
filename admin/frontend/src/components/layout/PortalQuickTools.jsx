import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock3, FileText } from 'lucide-react';

function formatDateParts(now) {
  return {
    dayName: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(now),
    dateLabel: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(now),
    timeLabel: new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(now),
  };
}

export default function PortalQuickTools({
  storageKey,
  noteTitle = 'Quick Notes',
  accentClassName = 'hover:bg-stone-100',
}) {
  const [now, setNow] = useState(() => new Date());
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const notesRef = useRef(null);

  useEffect(() => {
    const savedNote = localStorage.getItem(storageKey);
    if (typeof savedNote === 'string') {
      setNoteValue(savedNote);
    }

    const savedTimestamp = localStorage.getItem(`${storageKey}:savedAt`);
    if (savedTimestamp) {
      setSavedAt(savedTimestamp);
    }
  }, [storageKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notesRef.current && !notesRef.current.contains(event.target)) {
        setNotesOpen(false);
      }
    }

    if (notesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notesOpen]);

  const { dayName, dateLabel, timeLabel } = formatDateParts(now);

  const handleNoteChange = (event) => {
    const nextValue = event.target.value;
    const nextSavedAt = new Date().toISOString();

    setNoteValue(nextValue);
    setSavedAt(nextSavedAt);
    localStorage.setItem(storageKey, nextValue);
    localStorage.setItem(`${storageKey}:savedAt`, nextSavedAt);
  };

  const handleClear = () => {
    setNoteValue('');
    setSavedAt(null);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}:savedAt`);
  };

  const savedLabel = savedAt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(savedAt))
    : 'Nothing saved yet';

  return (
    <>
      <div className="relative" ref={notesRef}>
        <button
          type="button"
          onClick={() => setNotesOpen((current) => !current)}
          className={`rounded-full border border-stone-200 bg-white p-2 transition-colors ${accentClassName}`}
          title="Quick notes"
        >
          <FileText className="h-4 w-4 text-stone-600" />
        </button>

        {notesOpen && (
          <div className="absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
            <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-3">
              <p className="text-xs font-semibold text-stone-800">{noteTitle}</p>
              <p className="mt-0.5 text-[11px] text-stone-500">Saved locally for this portal.</p>
            </div>

            <div className="space-y-3 p-4">
              <textarea
                value={noteValue}
                onChange={handleNoteChange}
                rows={8}
                placeholder="Write follow-ups, reminders, or quick notes here."
                className="w-full resize-none rounded-2xl border border-stone-200 bg-stone-50/70 px-3 py-3 text-sm text-stone-700 outline-none transition focus:border-stone-300 focus:bg-white"
              />

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-stone-500">Last saved: {savedLabel}</p>
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-full border border-stone-200 px-3 py-1.5 text-[11px] font-medium text-stone-600 transition hover:bg-stone-100"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="hidden items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-2 shadow-sm lg:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
          <CalendarDays className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {dayName}
          </p>
          <p className="truncate text-xs font-semibold text-stone-800">{dateLabel}</p>
        </div>

        <div className="h-8 w-px bg-stone-200" />

        <div className="min-w-0">
          <div className="flex items-center gap-1 text-stone-500">
            <Clock3 className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Live</span>
          </div>
          <p className="text-sm font-semibold text-stone-800 tabular-nums">{timeLabel}</p>
        </div>
      </div>
    </>
  );
}
