const STUDENT_BACKEND_BASE_URL = String(
  process.env.STUDENT_BACKEND_BASE_URL || ''
).replace(/\/+$/, '');

const INTERNAL_REALTIME_SECRET = String(
  process.env.INTERNAL_REALTIME_SECRET || ''
).trim();

async function relayMessageEvent({
  event,
  payload = {},
  targetUserIds = [],
}) {
  if (!STUDENT_BACKEND_BASE_URL || !INTERNAL_REALTIME_SECRET) {
    console.warn(
      '[Student Realtime Relay] skipped direct same-environment relay: missing STUDENT_BACKEND_BASE_URL or INTERNAL_REALTIME_SECRET. Shared Supabase realtime remains available.'
    );

    return {
      success: false,
      skipped: true,
    };
  }

  try {
    const response = await fetch(
      STUDENT_BACKEND_BASE_URL + '/api/internal/realtime/message-event',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-realtime-secret':
            INTERNAL_REALTIME_SECRET,
        },
        body: JSON.stringify({
          event,
          payload,
          targetUserIds,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Student Realtime Relay] failed:', {
        event,
        status: response.status,
        data,
      });

      return {
        success: false,
        status: response.status,
        data,
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error(
      '[Student Realtime Relay] request error:',
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
}



async function relayRoEvent({
  event = 'ro:updated',
  payload = {},
  targetUserIds = [],
}) {
  if (!STUDENT_BACKEND_BASE_URL || !INTERNAL_REALTIME_SECRET) {
    console.warn(
      '[Student Realtime Relay] skipped RO relay: missing STUDENT_BACKEND_BASE_URL or INTERNAL_REALTIME_SECRET.'
    );

    return {
      success: false,
      skipped: true,
    };
  }

  try {
    const response = await fetch(
      STUDENT_BACKEND_BASE_URL + '/api/internal/realtime/ro-event',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-realtime-secret':
            INTERNAL_REALTIME_SECRET,
        },
        body: JSON.stringify({
          event,
          payload,
          targetUserIds,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Student Realtime Relay] RO relay failed:', {
        event,
        status: response.status,
        data,
      });

      return {
        success: false,
        status: response.status,
        data,
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error(
      '[Student Realtime Relay] RO relay request error:',
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
}


async function relayRenewalEvent({
  event = 'renewal:updated',
  payload = {},
}) {
  if (!STUDENT_BACKEND_BASE_URL || !INTERNAL_REALTIME_SECRET) {
    console.warn(
      '[Student Realtime Relay] skipped renewal relay: missing STUDENT_BACKEND_BASE_URL or INTERNAL_REALTIME_SECRET.'
    );

    return {
      success: false,
      skipped: true,
    };
  }

  try {
    const response = await fetch(
      STUDENT_BACKEND_BASE_URL + '/api/internal/realtime/renewal-event',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-realtime-secret':
            INTERNAL_REALTIME_SECRET,
        },
        body: JSON.stringify({
          event,
          payload,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Student Realtime Relay] renewal relay failed:', {
        event,
        status: response.status,
        data,
      });

      return {
        success: false,
        status: response.status,
        data,
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error(
      '[Student Realtime Relay] renewal relay request error:',
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
}


async function relayModuleEvent({
  event,
  payload = {},
  targetUserIds = [],
}) {
  if (!STUDENT_BACKEND_BASE_URL || !INTERNAL_REALTIME_SECRET) {
    console.warn(
      '[Student Realtime Relay] skipped module relay: missing STUDENT_BACKEND_BASE_URL or INTERNAL_REALTIME_SECRET.'
    );

    return {
      success: false,
      skipped: true,
    };
  }

  try {
    const response = await fetch(
      STUDENT_BACKEND_BASE_URL + '/api/internal/realtime/module-event',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-realtime-secret': INTERNAL_REALTIME_SECRET,
        },
        body: JSON.stringify({
          event,
          payload,
          targetUserIds,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Student Realtime Relay] module relay failed:', {
        event,
        status: response.status,
        data,
      });

      return {
        success: false,
        status: response.status,
        data,
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error(
      '[Student Realtime Relay] module relay request error:',
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  relayMessageEvent,
  relayRoEvent,
  relayRenewalEvent,
  relayModuleEvent,
};
