#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepo(start) {
  let dir = path.resolve(start);

  while (true) {
    const required = [
      path.join(dir, 'mobile', 'backend', 'src', 'config', 'socket.js'),
      path.join(dir, 'mobile', 'backend', 'src', 'services', 'realtimeBridgeService.js'),
      path.join(dir, 'mobile', 'backend', 'src', 'services', 'adminRealtimeRelayService.js'),
      path.join(dir, 'admin', 'backend', 'services', 'studentRealtimeRelayService.js'),
      path.join(dir, 'mobile', 'frontend', 'test', 'messaging_provider_test.dart'),
    ];

    if (required.every(fs.existsSync)) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not find the SMaRT-PDM repo root. Run this from D:\\projects\\SMaRT-PDM.'
  );
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

function restoreEol(text, useCrlf) {
  return useCrlf ? text.replace(/\n/g, '\r\n') : text;
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;

  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}.`);
  }
}

function replaceOnce(text, oldText, newText, label) {
  if (text.includes(newText)) return text;

  const count = text.split(oldText).length - 1;

  if (count !== 1) {
    throw new Error(
      `Preflight failed for ${label}: expected exactly one match, found ${count}. No project files were written.`
    );
  }

  return text.replace(oldText, newText);
}

const repo = findRepo(process.cwd());
const mobileBackend = path.join(repo, 'mobile', 'backend');
const adminBackend = path.join(repo, 'admin', 'backend');
const mobileFrontend = path.join(repo, 'mobile', 'frontend');

const files = {
  mobileSocket: path.join(
    mobileBackend,
    'src',
    'config',
    'socket.js'
  ),
  mobileBridge: path.join(
    mobileBackend,
    'src',
    'services',
    'realtimeBridgeService.js'
  ),
  mobileRelay: path.join(
    mobileBackend,
    'src',
    'services',
    'adminRealtimeRelayService.js'
  ),
  adminRelay: path.join(
    adminBackend,
    'services',
    'studentRealtimeRelayService.js'
  ),
  mobileTest: path.join(
    mobileBackend,
    'test',
    'cross-environment-realtime-v2.test.js'
  ),
  adminTest: path.join(
    adminBackend,
    'test',
    'cross-environment-realtime-v2.test.js'
  ),
};

const originals = {};
const crlf = {};

for (const key of ['mobileSocket', 'mobileBridge', 'mobileRelay', 'adminRelay']) {
  originals[key] = fs.readFileSync(files[key], 'utf8');
  crlf[key] = originals[key].includes('\r\n');
}

let mobileBridge = normalize(originals.mobileBridge);

/* -------------------------------------------------------------------------- */
/* MOBILE SOCKET CORS: allow Flutter Web's random localhost port.             */
/* -------------------------------------------------------------------------- */

const mobileSocket = `const { Server } = require('socket.io');
const { authenticateSocket } = require('../middleware/authMiddleware');

const configuredOrigins = () =>
    new Set(
        String(
            process.env.MOBILE_SOCKET_ORIGINS ||
            process.env.FRONTEND_ORIGINS ||
            ''
        )
            .split(',')
            .map((value) => String(value || '').trim().replace(/\\/+$/, ''))
            .filter(Boolean)
    );

const configuredOriginSuffixes = () => [
    ...new Set([
        '.vercel.app',
        '.onrender.com',
        ...String(process.env.MOBILE_SOCKET_ORIGIN_SUFFIXES || '')
            .split(',')
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean),
    ]),
];

function isPrivateIpv4(hostname) {
    const parts = String(hostname || '')
        .split('.')
        .map((part) => Number(part));

    if (
        parts.length !== 4 ||
        parts.some(
            (part) =>
                !Number.isInteger(part) ||
                part < 0 ||
                part > 255
        )
    ) {
        return false;
    }

    if (parts[0] === 10) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (
        parts[0] === 172 &&
        parts[1] >= 16 &&
        parts[1] <= 31
    ) {
        return true;
    }

    return false;
}

function isAllowedSocketOrigin(origin) {
    // Native Flutter clients and trusted server-to-server clients may omit
    // the browser Origin header.
    if (!origin) return true;

    const normalized = String(origin)
        .trim()
        .replace(/\\/+$/, '');

    if (configuredOrigins().has(normalized)) {
        return true;
    }

    try {
        const parsed = new URL(normalized);
        const hostname = parsed.hostname.toLowerCase();

        if (
            parsed.protocol !== 'http:' &&
            parsed.protocol !== 'https:'
        ) {
            return false;
        }

        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname === '::1' ||
            isPrivateIpv4(hostname)
        ) {
            // Important for flutter run -d edge, which commonly chooses a
            // random localhost port.
            return true;
        }

        return configuredOriginSuffixes().some(
            (suffix) => hostname.endsWith(suffix)
        );
    } catch (_) {
        return false;
    }
}

function configureSocket(server) {
    const io = new Server(server, {
        cors: {
            origin(origin, callback) {
                if (isAllowedSocketOrigin(origin)) {
                    return callback(null, true);
                }

                console.error(
                    '[Socket.IO] CORS blocked origin:',
                    origin
                );

                return callback(
                    new Error(
                        \`Socket.IO CORS blocked origin: \${origin}\`
                    )
                );
            },
            methods: [
                'GET',
                'POST',
                'PUT',
                'PATCH',
                'DELETE',
                'OPTIONS',
            ],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    io.engine.on('connection_error', (err) => {
        console.log('Socket.IO connection error:', {
            message: err.message,
            code: err.code,
            context: err.context,
        });
    });

    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        console.log('Socket connected:', socket.id);

        const userId =
            socket.user?.user_id ||
            socket.user?.userId ||
            socket.user?.id ||
            null;

        if (userId) {
            socket.join(\`user:\${userId}\`);
            console.log(
                \`Socket joined user room: user:\${userId}\`
            );
        }

        socket.on('disconnect', (reason) => {
            console.log(
                'Socket disconnected:',
                socket.id,
                reason
            );
        });
    });

    return io;
}

module.exports = {
    configureSocket,
    isAllowedSocketOrigin,
};
`;

/* -------------------------------------------------------------------------- */
/* MOBILE SUPABASE BRIDGE: recover if its channel dies.                       */
/* -------------------------------------------------------------------------- */

if (!mobileBridge.includes('const REALTIME_BRIDGE_RETRY_MS = 3000;')) {
  mobileBridge = replaceOnce(
    mobileBridge,
    `let realtimeChannel = null;
`,
    `let realtimeChannel = null;
let realtimeRetryTimer = null;
const REALTIME_BRIDGE_RETRY_MS = 3000;

function clearRealtimeRetry() {
  if (!realtimeRetryTimer) return;

  clearTimeout(realtimeRetryTimer);
  realtimeRetryTimer = null;
}

function scheduleRealtimeBridgeRestart({
  io,
  supabase,
  reason,
}) {
  if (realtimeRetryTimer) return;

  console.warn(
    '[Realtime Bridge] scheduling reconnect:',
    {
      reason: String(reason || 'unknown'),
      retry_in_ms: REALTIME_BRIDGE_RETRY_MS,
    }
  );

  realtimeRetryTimer = setTimeout(() => {
    realtimeRetryTimer = null;

    try {
      configureRealtimeBridge({ io, supabase });
    } catch (error) {
      console.error(
        '[Realtime Bridge] reconnect failed:',
        error?.message || error
      );

      scheduleRealtimeBridgeRestart({
        io,
        supabase,
        reason:
          error?.message ||
          'restart_failed',
      });
    }
  }, REALTIME_BRIDGE_RETRY_MS);

  if (typeof realtimeRetryTimer.unref === 'function') {
    realtimeRetryTimer.unref();
  }
}

`,
    'mobile realtime recovery state'
  );
}

const oldSubscribe = `    .subscribe((status, error) => {
      if (error) {
        console.error('[Realtime Bridge] subscription error:', error);
        return;
      }

      console.log('Realtime bridge status:', status);
    });`;

const newSubscribe = `    .subscribe((status, error) => {
      const normalizedStatus = String(status || '')
        .trim()
        .toUpperCase();

      if (error) {
        console.error(
          '[Realtime Bridge] subscription error:',
          error
        );

        scheduleRealtimeBridgeRestart({
          io,
          supabase,
          reason:
            error?.message ||
            normalizedStatus ||
            'subscription_error',
        });
        return;
      }

      console.log(
        'Realtime bridge status:',
        normalizedStatus || status
      );

      if (normalizedStatus === 'SUBSCRIBED') {
        clearRealtimeRetry();
        return;
      }

      if (
        normalizedStatus === 'CHANNEL_ERROR' ||
        normalizedStatus === 'TIMED_OUT'
      ) {
        scheduleRealtimeBridgeRestart({
          io,
          supabase,
          reason: normalizedStatus,
        });
      }
    });`;

if (!mobileBridge.includes(newSubscribe)) {
  mobileBridge = replaceOnce(
    mobileBridge,
    oldSubscribe,
    newSubscribe,
    'mobile realtime channel retry'
  );
}

/* -------------------------------------------------------------------------- */
/* ENVIRONMENT-ISOLATED DIRECT RELAYS.                                        */
/*                                                                            */
/* Local and deployed INTERNAL_REALTIME_SECRET values SHOULD stay different.  */
/* Cross-environment delivery comes from shared Supabase messages changes.    */
/* -------------------------------------------------------------------------- */

const mobileRelay = `const ADMIN_BACKEND_URL = String(
    process.env.ADMIN_BACKEND_URL || ''
).replace(/\\/+$/, '');

const INTERNAL_REALTIME_SECRET = String(
    process.env.INTERNAL_REALTIME_SECRET || ''
).trim();

async function postToAdminBackend(path, payload = {}) {
    if (!ADMIN_BACKEND_URL || !INTERNAL_REALTIME_SECRET) {
        console.warn(
            '[Admin Realtime Relay] skipped direct same-environment relay: missing ADMIN_BACKEND_URL or INTERNAL_REALTIME_SECRET. Shared Supabase realtime remains the cross-environment path.'
        );

        return {
            success: false,
            skipped: true,
            reason: 'missing_config',
        };
    }

    const url = \`\${ADMIN_BACKEND_URL}\${path}\`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-realtime-secret':
                    INTERNAL_REALTIME_SECRET,
            },
            body: JSON.stringify(payload),
        });

        const data = await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
            console.error(
                '[Admin Realtime Relay] failed:',
                {
                    url,
                    status: response.status,
                    data,
                }
            );

            return {
                success: false,
                status: response.status,
                data,
            };
        }

        console.log(
            '[Admin Realtime Relay] sent:',
            {
                url,
                action: payload.action,
                ro_id:
                    payload.ro_id ||
                    payload.roId ||
                    null,
                student_id:
                    payload.student_id ||
                    payload.studentId ||
                    null,
            }
        );

        return {
            success: true,
            data,
        };
    } catch (error) {
        console.error(
            '[Admin Realtime Relay] request error:',
            error.message
        );

        return {
            success: false,
            error: error.message,
        };
    }
}

async function relayRoUpdated(payload = {}) {
    return postToAdminBackend(
        '/api/internal/realtime/ro-updated',
        {
            source: 'mobile-backend',
            updated_at: new Date().toISOString(),
            ...payload,
        }
    );
}

async function relayMessageCreated(payload = {}) {
    return postToAdminBackend(
        '/api/internal/realtime/message-created',
        payload
    );
}

async function relayMessageEvent(
    event,
    payload = {},
    targetUserIds = []
) {
    return postToAdminBackend(
        '/api/internal/realtime/message-event',
        {
            event,
            payload,
            targetUserIds,
        }
    );
}

async function relayNotificationCreated(payload = {}) {
    return postToAdminBackend(
        '/api/internal/realtime/notification-created',
        payload
    );
}

module.exports = {
    relayRoUpdated,
    relayMessageCreated,
    relayMessageEvent,
    relayNotificationCreated,
};
`;

const adminRelay = `const STUDENT_BACKEND_BASE_URL = String(
  process.env.STUDENT_BACKEND_BASE_URL || ''
).replace(/\\/+$/, '');

const INTERNAL_REALTIME_SECRET = String(
  process.env.INTERNAL_REALTIME_SECRET || ''
).trim();

async function relayMessageEvent({
  event,
  payload = {},
  targetUserIds = [],
}) {
  if (
    !STUDENT_BACKEND_BASE_URL ||
    !INTERNAL_REALTIME_SECRET
  ) {
    console.warn(
      '[Student Realtime Relay] skipped direct same-environment relay: missing STUDENT_BACKEND_BASE_URL or INTERNAL_REALTIME_SECRET. Shared Supabase realtime remains the cross-environment path.'
    );

    return {
      success: false,
      skipped: true,
    };
  }

  try {
    const response = await fetch(
      \`\${STUDENT_BACKEND_BASE_URL}/api/internal/realtime/message-event\`,
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

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      console.error(
        '[Student Realtime Relay] failed:',
        {
          event,
          status: response.status,
          data,
        }
      );

      return {
        success: false,
        status: response.status,
        data,
      };
    }

    return {
      success: true,
      data,
    };
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

module.exports = {
  relayMessageEvent,
};
`;

/* -------------------------------------------------------------------------- */
/* VALIDATE BEFORE WRITING.                                                   */
/* -------------------------------------------------------------------------- */

const checks = [
  [
    mobileSocket.includes('isAllowedSocketOrigin') &&
      mobileSocket.includes("hostname === 'localhost'") &&
      mobileSocket.includes('isPrivateIpv4(hostname)'),
    'dynamic Flutter Web Socket.IO origins',
  ],
  [
    mobileBridge.includes("table: 'messages'") &&
      mobileBridge.includes(
        'scheduleRealtimeBridgeRestart'
      ) &&
      mobileBridge.includes('CHANNEL_ERROR') &&
      mobileBridge.includes('TIMED_OUT'),
    'recovering mobile Supabase messages bridge',
  ],
  [
    !mobileRelay.includes('DEPLOYED_INTERNAL_REALTIME_SECRET') &&
      !mobileRelay.includes(
        'https://smart-pdm.onrender.com'
      ) &&
      mobileRelay.includes(
        'process.env.INTERNAL_REALTIME_SECRET'
      ),
    'mobile relay keeps environment secret isolated',
  ],
  [
    !adminRelay.includes('DEPLOYED_INTERNAL_REALTIME_SECRET') &&
      !adminRelay.includes(
        'https://smart-pdm-3tbv.onrender.com'
      ) &&
      adminRelay.includes(
        'process.env.INTERNAL_REALTIME_SECRET'
      ),
    'admin relay keeps environment secret isolated',
  ],
];

const failed = checks
  .filter(([ok]) => !ok)
  .map(([, label]) => label);

if (failed.length) {
  throw new Error(
    `Validation failed before writing: ${failed.join(', ')}. No project files were written.`
  );
}

/* -------------------------------------------------------------------------- */
/* TESTS                                                                      */
/* -------------------------------------------------------------------------- */

const mobileTest = `'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isAllowedSocketOrigin,
} = require('../src/config/socket');

test('Flutter Web random localhost/LAN origins are accepted', () => {
  assert.equal(
    isAllowedSocketOrigin('http://localhost:55231'),
    true
  );
  assert.equal(
    isAllowedSocketOrigin('http://127.0.0.1:61321'),
    true
  );
  assert.equal(
    isAllowedSocketOrigin('http://192.168.100.9:55231'),
    true
  );
  assert.equal(
    isAllowedSocketOrigin('https://smart-pdm.vercel.app'),
    true
  );
  assert.equal(
    isAllowedSocketOrigin('https://untrusted.invalid'),
    false
  );
});

test('mobile Supabase messages bridge retries failures', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'src',
      'services',
      'realtimeBridgeService.js'
    ),
    'utf8'
  );

  assert.match(source, /table:\\s*'messages'/);
  assert.match(source, /scheduleRealtimeBridgeRestart/);
  assert.match(source, /CHANNEL_ERROR/);
  assert.match(source, /TIMED_OUT/);
});

test('mobile direct relay does not couple local and deployed secrets', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'src',
      'services',
      'adminRealtimeRelayService.js'
    ),
    'utf8'
  );

  assert.match(
    source,
    /process\\.env\\.INTERNAL_REALTIME_SECRET/
  );
  assert.doesNotMatch(
    source,
    /DEPLOYED_INTERNAL_REALTIME_SECRET/
  );
  assert.doesNotMatch(
    source,
    /smart-pdm\\.onrender\\.com/
  );
});
`;

const adminTest = `'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin direct relay stays inside its configured environment', () => {
  const relay = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'services',
      'studentRealtimeRelayService.js'
    ),
    'utf8'
  );

  assert.match(
    relay,
    /process\\.env\\.INTERNAL_REALTIME_SECRET/
  );
  assert.match(
    relay,
    /process\\.env\\.STUDENT_BACKEND_BASE_URL/
  );
  assert.doesNotMatch(
    relay,
    /DEPLOYED_INTERNAL_REALTIME_SECRET/
  );
  assert.doesNotMatch(
    relay,
    /smart-pdm-3tbv\\.onrender\\.com/
  );
});

test('admin Supabase bridge already covers messages and recovery', () => {
  const bridge = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'services',
      'realtimeBridgeService.js'
    ),
    'utf8'
  );

  assert.match(
    bridge,
    /table:\\s*'messages'/
  );
  assert.match(
    bridge,
    /scheduleRealtimeBridgeRestart/
  );
});
`;

/* -------------------------------------------------------------------------- */
/* TRANSACTIONAL WRITE                                                        */
/* -------------------------------------------------------------------------- */

const outputs = {
  mobileSocket,
  mobileBridge,
  mobileRelay,
  adminRelay,
};

const rollbackRoot = fs.mkdtempSync(
  path.join(
    os.tmpdir(),
    'smartpdm-cross-realtime-v2-'
  )
);

const staged = [];

function stage(file) {
  const relative = path.relative(repo, file);
  const copy = path.join(rollbackRoot, relative);

  fs.mkdirSync(path.dirname(copy), {
    recursive: true,
  });

  if (fs.existsSync(file)) {
    fs.copyFileSync(file, copy);
    staged.push({
      file,
      copy,
      existed: true,
    });
  } else {
    staged.push({
      file,
      copy,
      existed: false,
    });
  }
}

function restoreAll() {
  for (const item of staged) {
    if (item.existed) {
      fs.mkdirSync(path.dirname(item.file), {
        recursive: true,
      });
      fs.copyFileSync(item.copy, item.file);
    } else if (fs.existsSync(item.file)) {
      fs.unlinkSync(item.file);
    }
  }
}

for (const file of [
  files.mobileSocket,
  files.mobileBridge,
  files.mobileRelay,
  files.adminRelay,
  files.mobileTest,
  files.adminTest,
]) {
  stage(file);
}

try {
  for (const [key, content] of Object.entries(outputs)) {
    fs.writeFileSync(
      files[key],
      restoreEol(content, crlf[key] || false),
      'utf8'
    );
  }

  fs.mkdirSync(path.dirname(files.mobileTest), {
    recursive: true,
  });
  fs.mkdirSync(path.dirname(files.adminTest), {
    recursive: true,
  });

  fs.writeFileSync(
    files.mobileTest,
    mobileTest,
    'utf8'
  );

  fs.writeFileSync(
    files.adminTest,
    adminTest,
    'utf8'
  );

  for (const file of [
    files.mobileSocket,
    files.mobileBridge,
    files.mobileRelay,
    files.adminRelay,
  ]) {
    run('node', ['--check', file], repo);
  }

  run(
    'node',
    [
      '--test',
      'test/cross-environment-realtime-v2.test.js',
    ],
    mobileBackend
  );

  run(
    'node',
    [
      '--test',
      'test/cross-environment-realtime-v2.test.js',
    ],
    adminBackend
  );

  run(
    'flutter',
    [
      'test',
      'test/messaging_provider_test.dart',
    ],
    mobileFrontend
  );
} catch (error) {
  console.error(
    '\nMessaging realtime v2 failed a targeted test. Restoring all changed files...'
  );

  restoreAll();

  console.error(
    `Rollback completed from: ${rollbackRoot}`
  );

  throw error;
}

try {
  fs.rmSync(rollbackRoot, {
    recursive: true,
    force: true,
  });
} catch (_) {}

console.log(
  '\nPASS: messaging cross-environment realtime v2 targeted tests passed.'
);

console.log(
  '\nSecret model preserved: local and deployed INTERNAL_REALTIME_SECRET values remain separate.'
);

console.log(
  'Cross-environment messages use the shared Supabase messages realtime bridge.'
);

console.log(
  'Restart both local backends before manual testing.'
);
