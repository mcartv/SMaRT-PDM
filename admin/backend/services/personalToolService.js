const crypto = require('crypto');
const db = require('../config/db');

const MAX_NOTE_LENGTH = 2000;
const MAX_EVENT_TITLE_LENGTH = 100;
const MAX_EVENTS = 30;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeUserId(userId) {
  const normalized = String(userId || '').trim();
  if (!normalized) {
    throw createHttpError(401, 'Authenticated account is required.');
  }
  return normalized;
}

function normalizeWorkspace(row = {}) {
  return {
    note: String(row.note_content || ''),
    note_updated_at: row.note_updated_at || null,
    events: Array.isArray(row.calendar_events) ? row.calendar_events : [],
    updated_at: row.updated_at || null,
  };
}

function handleDatabaseError(error) {
  if (error?.code === '42P01') {
    throw createHttpError(
      503,
      'Personal notes storage is not installed. Run staff_personal_tools_schema.sql first.'
    );
  }
  throw error;
}

async function ensureWorkspace(client, userId) {
  await client.query(
    `
      INSERT INTO public.staff_personal_tools (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );
}

async function getWorkspace(userId) {
  const ownerId = normalizeUserId(userId);

  try {
    const result = await db.query(
      `
        SELECT note_content, note_updated_at, calendar_events, updated_at
        FROM public.staff_personal_tools
        WHERE user_id = $1
        LIMIT 1
      `,
      [ownerId]
    );

    return result.rows[0]
      ? normalizeWorkspace(result.rows[0])
      : normalizeWorkspace();
  } catch (error) {
    return handleDatabaseError(error);
  }
}

async function updateNote(userId, note) {
  const ownerId = normalizeUserId(userId);
  const normalizedNote = String(note ?? '').slice(0, MAX_NOTE_LENGTH);

  try {
    const result = await db.query(
      `
        INSERT INTO public.staff_personal_tools (
          user_id,
          note_content,
          note_updated_at,
          updated_at
        )
        VALUES ($1, $2, now(), now())
        ON CONFLICT (user_id)
        DO UPDATE SET
          note_content = EXCLUDED.note_content,
          note_updated_at = now(),
          updated_at = now()
        RETURNING note_content, note_updated_at, calendar_events, updated_at
      `,
      [ownerId, normalizedNote]
    );

    return normalizeWorkspace(result.rows[0]);
  } catch (error) {
    return handleDatabaseError(error);
  }
}

function normalizeEventInput(input = {}) {
  const title = String(input.title || '').trim().slice(0, MAX_EVENT_TITLE_LENGTH);
  const date = String(input.date || '').trim();
  const time = String(input.time || '').trim();

  if (!title) {
    throw createHttpError(400, 'Reminder title is required.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createHttpError(400, 'A valid reminder date is required.');
  }
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw createHttpError(400, 'Reminder time must use HH:mm format.');
  }

  return {
    id: crypto.randomUUID(),
    title,
    date,
    time,
    notified_at: null,
    created_at: new Date().toISOString(),
  };
}

async function addEvent(userId, input) {
  const ownerId = normalizeUserId(userId);
  const reminder = normalizeEventInput(input);
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await ensureWorkspace(client, ownerId);

    const locked = await client.query(
      `
        SELECT calendar_events
        FROM public.staff_personal_tools
        WHERE user_id = $1
        FOR UPDATE
      `,
      [ownerId]
    );
    const currentEvents = Array.isArray(locked.rows[0]?.calendar_events)
      ? locked.rows[0].calendar_events
      : [];

    if (currentEvents.length >= MAX_EVENTS) {
      throw createHttpError(
        400,
        `You can keep up to ${MAX_EVENTS} reminders. Remove one before adding another.`
      );
    }

    const result = await client.query(
      `
        UPDATE public.staff_personal_tools
        SET calendar_events = $2::jsonb, updated_at = now()
        WHERE user_id = $1
        RETURNING note_content, note_updated_at, calendar_events, updated_at
      `,
      [ownerId, JSON.stringify([...currentEvents, reminder])]
    );

    await client.query('COMMIT');
    return normalizeWorkspace(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    return handleDatabaseError(error);
  } finally {
    client.release();
  }
}

async function deleteEvent(userId, eventId) {
  const ownerId = normalizeUserId(userId);
  const normalizedEventId = String(eventId || '').trim();
  if (!normalizedEventId) {
    throw createHttpError(400, 'Reminder ID is required.');
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await ensureWorkspace(client, ownerId);

    const locked = await client.query(
      `
        SELECT calendar_events
        FROM public.staff_personal_tools
        WHERE user_id = $1
        FOR UPDATE
      `,
      [ownerId]
    );
    const currentEvents = Array.isArray(locked.rows[0]?.calendar_events)
      ? locked.rows[0].calendar_events
      : [];
    const nextEvents = currentEvents.filter(
      (event) => String(event?.id || '') !== normalizedEventId
    );

    if (nextEvents.length === currentEvents.length) {
      throw createHttpError(404, 'Reminder not found.');
    }

    const result = await client.query(
      `
        UPDATE public.staff_personal_tools
        SET calendar_events = $2::jsonb, updated_at = now()
        WHERE user_id = $1
        RETURNING note_content, note_updated_at, calendar_events, updated_at
      `,
      [ownerId, JSON.stringify(nextEvents)]
    );

    await client.query('COMMIT');
    return normalizeWorkspace(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    return handleDatabaseError(error);
  } finally {
    client.release();
  }
}

function getPhilippineDateTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const getPart = (type) => parts.find((part) => part.type === type)?.value || '';

  return {
    date: `${getPart('year')}-${getPart('month')}-${getPart('day')}`,
    time: `${getPart('hour')}:${getPart('minute')}`,
  };
}

function isReminderDue(event, philippineNow) {
  if (!event || event.notified_at) return false;
  const date = String(event.date || '');
  if (!date || date > philippineNow.date) return false;
  if (date < philippineNow.date) return true;
  return String(event.time || '08:00') <= philippineNow.time;
}

let lastDueReminderCheckAt = 0;

async function processDueReminders() {
  const nowMs = Date.now();
  if (nowMs - lastDueReminderCheckAt < 30000) return [];
  lastDueReminderCheckAt = nowMs;

  const philippineNow = getPhilippineDateTime();
  const delivered = [];

  try {
    const workspaces = await db.query(
      `
        SELECT user_id
        FROM public.staff_personal_tools
        WHERE jsonb_array_length(calendar_events) > 0
      `
    );

    for (const workspace of workspaces.rows) {
      const client = await db.connect();

      try {
        await client.query('BEGIN');
        const locked = await client.query(
          `
            SELECT calendar_events
            FROM public.staff_personal_tools
            WHERE user_id = $1
            FOR UPDATE
          `,
          [workspace.user_id]
        );
        const events = Array.isArray(locked.rows[0]?.calendar_events)
          ? locked.rows[0].calendar_events
          : [];
        let changed = false;

        for (let index = 0; index < events.length; index += 1) {
          const event = events[index];
          if (!isReminderDue(event, philippineNow)) continue;

          const claim = await client.query(
            `
              INSERT INTO public.staff_reminder_deliveries (user_id, event_id)
              VALUES ($1, $2)
              ON CONFLICT (user_id, event_id) DO NOTHING
              RETURNING event_id
            `,
            [workspace.user_id, event.id]
          );
          const notifiedAt = new Date().toISOString();

          if (!claim.rowCount) {
            events[index] = { ...event, notified_at: notifiedAt };
            changed = true;
            continue;
          }

          const dueLabel =
            event.date === philippineNow.date
              ? event.time
                ? `today at ${event.time}`
                : 'today'
              : `on ${event.date}${event.time ? ` at ${event.time}` : ''}`;
          const notificationResult = await client.query(
            `
              INSERT INTO public.notifications (
                user_id,
                type,
                title,
                message,
                reference_id,
                reference_type,
                is_read,
                push_sent,
                created_at
              )
              VALUES ($1, 'Reminder', $2, $3, $4, 'personal_reminder', false, false, now())
              RETURNING *
            `,
            [
              workspace.user_id,
              `Reminder due: ${event.title}`,
              `Your personal reminder is due ${dueLabel}. Open your planner to review or complete it.`,
              event.id,
            ]
          );
          const notification = notificationResult.rows[0];

          await client.query(
            `
              UPDATE public.staff_reminder_deliveries
              SET notification_id = $3, delivered_at = now()
              WHERE user_id = $1 AND event_id = $2
            `,
            [workspace.user_id, event.id, notification.notification_id]
          );

          events[index] = { ...event, notified_at: notifiedAt };
          changed = true;
          delivered.push({
            userId: workspace.user_id,
            notification,
          });
        }

        if (changed) {
          await client.query(
            `
              UPDATE public.staff_personal_tools
              SET calendar_events = $2::jsonb, updated_at = now()
              WHERE user_id = $1
            `,
            [workspace.user_id, JSON.stringify(events)]
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    return delivered;
  } catch (error) {
    return handleDatabaseError(error);
  }
}

module.exports = {
  getWorkspace,
  updateNote,
  addEvent,
  deleteEvent,
  processDueReminders,
};
