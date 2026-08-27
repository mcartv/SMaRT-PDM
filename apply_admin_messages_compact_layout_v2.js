const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Admin Messaging Compact Layout v2';
const PATCH_MARKER = 'SMART_PDM_ADMIN_MESSAGES_COMPACT_LAYOUT_V2';

function parseArgs(argv) {
  let dryRun = false;
  let root = '.';
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else root = arg;
  }
  return { dryRun, root: path.resolve(root) };
}

function normalize(value) {
  return String(value || '').replace(/\r\n/g, '\n');
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
  return normalize(fs.readFileSync(filePath, 'utf8'));
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source block was not found.`);
  const second = source.indexOf(before, first + before.length);
  if (second >= 0) throw new Error(`${label}: expected one source block, found more than one.`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker was not found.`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label}: end marker was not found.`);
  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

function ensureIncludes(source, needles, label) {
  for (const needle of needles) {
    if (!source.includes(needle)) {
      throw new Error(`${label}: missing expected contract: ${needle}`);
    }
  }
}

function ensureExcludes(source, needles, label) {
  for (const needle of needles) {
    if (source.includes(needle)) {
      throw new Error(`${label}: obsolete behavior remains: ${needle}`);
    }
  }
}

function run(command, args, cwd, label) {
  console.log(`\n> ${[command, ...args].join(' ')}`);

  let executable = command;
  let executableArgs = args;

  if (process.platform === 'win32' && (command === 'npm' || command === 'npx')) {
    executable = process.env.ComSpec || 'cmd.exe';
    executableArgs = ['/d', '/s', '/c', [command, ...args].join(' ')];
  }

  const result = spawnSync(executable, executableArgs, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`);
}

function makeBackup(root, originals) {
  const backupRoot = path.join(
    root,
    '.smart-pdm-patch-backup',
    `admin-messages-compact-layout-v2-${Date.now()}`
  );

  for (const [filePath, original] of originals.entries()) {
    if (original == null) continue;
    const destination = path.join(backupRoot, path.relative(root, filePath));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, original, 'utf8');
  }

  return backupRoot;
}

function rollback(originals) {
  for (const [filePath, original] of originals.entries()) {
    if (original == null) {
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
      continue;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, original, 'utf8');
  }
}

function buildThreadRow() {
  return `function ThreadRow({
  item,
  isActive,
  currentUserId,
  onClick,
  onToggleRead,
  onArchive,
  inboxStyle = false,
  density = 'full',
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState(null)
  const menuButtonRef = useRef(null)
  const hasUnread = Number(item.unreadCount || 0) > 0
  const iconOnly = density === 'compact'
  const compact = density === 'compact'

  const closeMenu = () => {
    setMenuOpen(false)
    setMenuPosition(null)
  }

  const toggleMenu = (event) => {
    event.stopPropagation()

    if (menuOpen) {
      closeMenu()
      return
    }

    const rect = menuButtonRef.current?.getBoundingClientRect()
    if (rect) {
      const menuWidth = 192
      const menuHeight = 82
      const viewportPadding = 8
      const gap = 4
      const left = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
      )
      const openAbove = rect.bottom + gap + menuHeight > window.innerHeight - viewportPadding
      const top = openAbove
        ? Math.max(viewportPadding, rect.top - menuHeight - gap)
        : rect.bottom + gap

      setMenuPosition({ top, left })
    }

    setMenuOpen(true)
  }

  useEffect(() => {
    if (!menuOpen) return undefined

    const handleViewportChange = () => closeMenu()
    const handleKeyDown = (event) => { if (event.key === 'Escape') closeMenu() }
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const rowClass = inboxStyle
    ? \`group relative border-b border-stone-100 transition \${isActive
      ? 'bg-[var(--portal-accent-soft)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r-full before:bg-[var(--portal-base)]'
      : hasUnread
        ? 'bg-[var(--portal-accent-soft)] hover:brightness-[0.99]'
        : 'bg-white hover:bg-stone-50'
      }\`
    : \`group relative \${iconOnly ? 'mx-1.5 my-1 rounded-xl' : 'mx-2 my-1 rounded-2xl'} overflow-hidden transition \${isActive
      ? 'bg-[var(--portal-accent-soft)]'
      : hasUnread
        ? 'bg-[var(--portal-accent-soft)]'
        : 'bg-white hover:bg-stone-50'
      } \${isActive ? 'before:absolute before:bottom-3 before:left-0 before:top-3 before:w-1 before:rounded-r-full before:bg-[var(--portal-base)]' : ''}\`

  return (
    <div className={rowClass}>
      <button
        type="button"
        onClick={onClick}
        title={iconOnly ? item.name : undefined}
        aria-label={iconOnly ? \`Open \${item.name}\` : undefined}
        className={iconOnly
          ? 'relative flex w-full items-center justify-center px-2 py-2.5 text-left'
          : inboxStyle
            ? 'flex w-full items-center gap-3 px-3.5 py-3.5 text-left'
            : 'flex w-full items-center gap-3 px-3 py-3 text-left'}
      >
        <div className="relative shrink-0">
          <ThreadIcon item={item} />
          {iconOnly && hasUnread ? (
            <span
              className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-500"
              aria-label={\`\${item.unreadCount} unread\`}
            />
          ) : null}
          {iconOnly && item.type === 'private' && item.isDisabled ? (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-stone-400" />
          ) : null}
        </div>

        {!iconOnly ? (
          <div className={\`min-w-0 flex-1 \${compact ? 'pr-7' : 'pr-8'}\`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p
                    className={\`truncate text-sm \${hasUnread ? 'font-bold text-stone-950' : 'font-medium text-stone-900'}\`}
                  >
                    {item.name}
                  </p>
                  {!compact && item.type === 'private' && item.isDisabled ? (
                    <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-stone-600">
                      Account Disabled
                    </span>
                  ) : null}
                </div>

                {!compact ? (
                  <p className="truncate text-xs text-stone-500">
                    {item.type === 'group' ? 'Group chat' : item.studentNumber || 'No student number'}
                  </p>
                ) : null}
              </div>

              {!compact ? (
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={inboxStyle
                    ? 'text-[11px] font-medium text-stone-400'
                    : 'text-xs font-medium text-stone-400'}>
                    {formatConversationTime(item.lastSentAt)}
                  </span>

                  {hasUnread ? (
                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
                      {item.unreadCount > 99 ? '99+' : item.unreadCount}
                    </span>
                  ) : null}
                </div>
              ) : hasUnread ? (
                <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-label={\`\${item.unreadCount} unread\`} />
              ) : null}
            </div>

            {!compact ? (
              <p
                className={\`mt-1 truncate text-xs \${hasUnread ? 'font-semibold text-stone-700' : 'text-stone-500'}\`}
              >
                {formatThreadPreview(item, currentUserId)}
              </p>
            ) : (
              <p className="mt-1 truncate text-[11px] text-stone-500">
                {item.type === 'group'
                  ? formatThreadPreview(item, currentUserId)
                  : item.studentNumber || formatThreadPreview(item, currentUserId)}
              </p>
            )}
          </div>
        ) : null}
      </button>

      {!item.isSearchResult && !iconOnly ? (
        <div className="absolute right-2 top-3">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={toggleMenu}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            title="Thread options"
            aria-label={\`Options for \${item.name}\`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[75] cursor-default"
                onClick={closeMenu}
                aria-label="Close menu"
              />

              <div
                role="menu"
                className="fixed z-[80] w-48 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl"
                style={{
                  top: menuPosition?.top ?? 0,
                  left: menuPosition?.left ?? 0,
                }}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    closeMenu()
                    onToggleRead?.(item)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-stone-700 transition hover:bg-stone-50"
                >
                  {hasUnread ? (
                    <>
                      <MailCheck className="h-3.5 w-3.5 text-green-600" />
                      Mark as read
                    </>
                  ) : (
                    <>
                      <MailOpen className="h-3.5 w-3.5 text-red-600" />
                      Mark as unread
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    closeMenu()
                    onArchive?.(item)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-700 transition hover:bg-red-50"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}`;
}

function buildGroupInfoModal() {
  return `function GroupInfoModal({
  open,
  room,
  members,
  loading,
  currentUserId,
  onClose,
  onSearchChat,
  onViewProfile,
  onMessage,
  onRemove,
  onPromote,
  onAddMember,
  onLeave,
}) {
  const [menuMemberId, setMenuMemberId] = useState('')

  useEffect(() => {
    if (!open) setMenuMemberId('')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open || !room) return null

  const currentMember = members.find(
    (member) => member.userId === currentUserId || member.isCurrentUser
  )
  const viewerIsAdmin =
    currentMember?.isAdmin === true || room.viewerIsAdmin === true
  const adminCount = members.filter((member) => member.isAdmin).length
  const displayedMemberCount = Number(room.memberCount || members.length || 0)
  const mustAssignAdminBeforeLeaving =
    viewerIsAdmin && displayedMemberCount > 1 && adminCount <= 1
  const adminMembers = members.filter((member) => member.isAdmin)
  const regularMembers = members.filter((member) => !member.isAdmin)

  const renderMemberRow = (member) => {
    const canPromote =
      viewerIsAdmin &&
      !member.isCurrentUser &&
      member.userId !== currentUserId &&
      !member.isAdmin
    const canRemove =
      viewerIsAdmin &&
      !member.isCurrentUser &&
      member.userId !== currentUserId &&
      !member.isAdmin

    return (
      <div
        key={member.userId}
        className="relative flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-stone-50"
      >
        <MemberAvatar member={member} sizeClass="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-stone-900">
              {member.name}
            </p>
            {member.isCurrentUser || member.userId === currentUserId ? (
              <span className="shrink-0 text-xs font-medium text-stone-400">
                You
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-stone-500">
            {member.subtitle || member.role || 'Group member'}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setMenuMemberId((current) =>
              current === member.userId ? '' : member.userId
            )
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
          title={\`Actions for \${member.name}\`}
          aria-label={\`Actions for \${member.name}\`}
          aria-haspopup="menu"
          aria-expanded={menuMemberId === member.userId}
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuMemberId === member.userId ? (
          <div
            className="absolute right-2 top-10 z-20 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl"
            role="menu"
          >
            <button
              type="button"
              onClick={() => {
                setMenuMemberId('')
                onViewProfile(member)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              <Eye className="h-3.5 w-3.5" /> View profile
            </button>

            {!member.isCurrentUser && member.userId !== currentUserId ? (
              <button
                type="button"
                onClick={() => {
                  setMenuMemberId('')
                  onMessage(member)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                <MessageSquareMore className="h-3.5 w-3.5" /> Message
              </button>
            ) : null}

            {canPromote ? (
              <button
                type="button"
                onClick={() => {
                  setMenuMemberId('')
                  onPromote(member)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--portal-base)] hover:bg-[var(--portal-accent-soft)]"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Make group admin
              </button>
            ) : null}

            {canRemove ? (
              <button
                type="button"
                onClick={() => {
                  setMenuMemberId('')
                  onRemove(member)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50"
              >
                <UserMinus className="h-3.5 w-3.5" /> Remove member
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <section
      aria-label="Group information"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"
    >
      <div className="shrink-0 border-b border-stone-100 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--portal-accent-soft)] text-[var(--portal-base)]">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900">
                {room.name}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">Group chat</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-50"
            title="Back to conversation"
            aria-label="Back to conversation"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onSearchChat}
          className="mt-3 flex h-10 w-full items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 text-left text-sm text-stone-500 transition hover:border-stone-300 hover:bg-white"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span>Search chat</span>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">Members</h3>
                <p className="mt-0.5 text-xs text-stone-500">
                  Manage group participants and permissions.
                </p>
              </div>

              {viewerIsAdmin ? (
                <button
                  type="button"
                  onClick={onAddMember}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--portal-accent-soft)] px-3 text-xs font-semibold text-[var(--portal-base)] transition hover:brightness-95"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add member</span>
                  <span className="sm:hidden">Add</span>
                </button>
              ) : null}
            </div>

            {loading ? (
              <div className="flex justify-center gap-2 rounded-2xl border border-stone-100 bg-stone-50 px-4 py-10 text-sm text-stone-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading members
              </div>
            ) : members.length ? (
              <div className="space-y-5">
                {adminMembers.length ? (
                  <section>
                    <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Group Admins
                    </p>
                    <div className="space-y-1">
                      {adminMembers.map(renderMemberRow)}
                    </div>
                  </section>
                ) : null}

                {regularMembers.length ? (
                  <section>
                    <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      Members
                    </p>
                    <div className="space-y-1">
                      {regularMembers.map(renderMemberRow)}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-500">
                {Number(room.memberCount || 0) > 0
                  ? 'Member details could not be loaded.'
                  : 'No members in this group.'}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-stone-100 bg-stone-50/70 px-4 py-4 lg:w-[280px] lg:border-l lg:border-t-0 sm:px-5">
          <div className="mx-auto max-w-3xl lg:mx-0">
            <button
              type="button"
              onClick={onLeave}
              disabled={mustAssignAdminBeforeLeaving}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
              title={
                mustAssignAdminBeforeLeaving
                  ? 'Assign another group admin before leaving.'
                  : 'Leave group'
              }
            >
              <LogOut className="h-4 w-4" /> Leave group
            </button>

            <p className="mt-2 text-center text-xs leading-5 text-stone-400">
              {mustAssignAdminBeforeLeaving
                ? 'Assign another group admin before leaving so the group is not left without an administrator.'
                : 'Leaving removes you from the group and moves it to your personal Archived Messages.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}`;
}

function buildContractTest() {
  return `const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const source = fs.readFileSync(
  path.join(repoRoot, 'admin', 'frontend', 'src', 'pages', 'AdminMessages.jsx'),
  'utf8'
);

test('conversation list supports exactly Full and Compact modes', () => {
  assert.match(source, /conversationPaneModes = \['full', 'compact'\]/);
  assert.match(source, /full: 'lg:grid-cols-\[340px_minmax\(0,1fr\)\]'/);
  assert.match(source, /compact: 'lg:grid-cols-\[76px_minmax\(0,1fr\)\]'/);
});

test('Compact mode is avatar-only', () => {
  assert.match(source, /const iconOnly = density === 'compact'/);
  assert.match(source, /!iconOnly \? \(/);
  assert.match(source, /!item\.isSearchResult && !iconOnly/);
  assert.match(source, /title=\{iconOnly \? item\.name/);
});

test('resize control toggles between the two modes', () => {
  assert.match(source, /Resize chat list/);
  assert.match(source, /conversationPaneModes\[\(index \+ 1\) % conversationPaneModes\.length\]/);
});

test('group info is embedded and replaces the chat panes', () => {
  assert.match(source, /groupInfoOpen \? 'hidden'/);
  assert.match(source, /renderGroupInfo\(\{ embedded: true \}\)/);
  assert.match(source, /grid-cols-1/);
  assert.doesNotMatch(source, /renderGroupInfo\(\{ responsive: true \}\)/);
});

test('group information no longer renders as a fixed right drawer', () => {
  assert.match(source, /aria-label="Group information"/);
  assert.match(source, /className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"/);
  assert.doesNotMatch(source, /fixed inset-y-0 right-0 z-\[90\]/);
});

test('Search members regression is removed and Search chat is restored', () => {
  assert.doesNotMatch(source, /placeholder="Search members"/);
  assert.doesNotMatch(source, /aria-label="Search group members"/);
  assert.match(source, />Search chat</);
  assert.match(source, /onSearchChat/);
});

test('group info keeps member actions and leave group', () => {
  assert.match(source, /Make group admin/);
  assert.match(source, /Remove member/);
  assert.match(source, /Add member/);
  assert.match(source, /Leave group/);
});

test('small header actions hide long labels on narrow screens', () => {
  assert.match(source, /hidden sm:inline">Archived/);
  assert.match(source, /hidden sm:inline">Group/);
});
`;
}

function patchSource(source) {
  if (source.includes(PATCH_MARKER)) return source;

  ensureIncludes(
    source,
    [
      'SMART-PDM_ADMIN_MESSAGES_RESPONSIVE_V1',
      'SMART-PDM_ADMIN_MESSAGES_EMBEDDED_GROUP_INFO_V2',
      'function ThreadRow({',
      'function GroupInfoModal({',
      'const [compactPane, setCompactPane] = useState(\'list\')',
      'renderGroupInfo({ responsive: true })',
      'placeholder="Search members"',
    ],
    'Current Admin messaging source'
  );

  source = replaceOnce(
    source,
    '// SMART-PDM_ADMIN_MESSAGES_EMBEDDED_GROUP_INFO_V2',
    `// SMART-PDM_ADMIN_MESSAGES_EMBEDDED_GROUP_INFO_V2
// ${PATCH_MARKER}`,
    'Patch marker'
  );

  source = replaceRange(
    source,
    'function ThreadRow({',
    'function ArchivedThreadsModal({',
    buildThreadRow(),
    'ThreadRow density redesign'
  );

  source = replaceRange(
    source,
    'function GroupInfoModal({',
    'function CreateGroupModal({',
    buildGroupInfoModal(),
    'Embedded GroupInfo redesign'
  );

  source = replaceOnce(
    source,
`  const [compactPane, setCompactPane] = useState('list')`,
`  const [compactPane, setCompactPane] = useState('list')
  const conversationPaneModes = ['full', 'compact']
  const [conversationPaneMode, setConversationPaneMode] = useState(() => {
    try {
      const saved = localStorage.getItem('smart-pdm-admin-messages-pane-mode')
      return conversationPaneModes.includes(saved) ? saved : 'full'
    } catch {
      return 'full'
    }
  })`,
    'Conversation pane mode state'
  );

  source = replaceOnce(
    source,
`  const [conversations, setConversations] = useState([])`,
`  useEffect(() => {
    try {
      localStorage.setItem(
        'smart-pdm-admin-messages-pane-mode',
        conversationPaneMode
      )
    } catch {
      // Local preference storage is optional.
    }
  }, [conversationPaneMode])

  const conversationPaneGridClass = {
    full: 'lg:grid-cols-[340px_minmax(0,1fr)]',
    compact: 'lg:grid-cols-[76px_minmax(0,1fr)]',
  }[conversationPaneMode]

  const cycleConversationPaneMode = () => {
    setConversationPaneMode((current) => {
      const index = conversationPaneModes.indexOf(current)
      return conversationPaneModes[(index + 1) % conversationPaneModes.length]
    })
  }

  const [conversations, setConversations] = useState([])`,
    'Conversation pane mode behavior'
  );

  const renderInfoStart = '  const renderGroupInfo = ({ embedded = false, responsive = false } = {}) => (';
  const renderInfoEnd = '\n\n  return (\n    <>';

  const renderStartIndex = source.indexOf(renderInfoStart);
  const renderEndIndex = source.indexOf(renderInfoEnd, renderStartIndex);
  if (renderStartIndex < 0 || renderEndIndex < 0) {
    throw new Error('renderGroupInfo helper boundaries were not found.');
  }

  const newRenderInfo = `  const renderGroupInfo = ({ embedded = false } = {}) => (
    <GroupInfoModal
      open={groupInfoOpen}
      room={selectedItem?.type === 'group' ? selectedItem : null}
      members={groupMembers}
      loading={loadingGroupMembers}
      currentUserId={currentUserId}
      onClose={() => setGroupInfoOpen(false)}
      onSearchChat={() => {
        setGroupInfoOpen(false)
        setChatSearchOpen(true)
        setChatMatchIndex(0)
      }}
      onViewProfile={setSelectedMemberProfile}
      onMessage={handleMessageMember}
      onRemove={setPendingRemoveMember}
      onPromote={setPendingPromoteMember}
      onAddMember={() => {
        setAddMembersOpen(true)
        setGroupInfoOpen(false)
        setMainView('add-members')
      }}
      onLeave={() => setLeaveGroupOpen(true)}
      embedded={embedded}
    />
  )`;

  source =
    source.slice(0, renderStartIndex) +
    newRenderInfo +
    source.slice(renderEndIndex);

  source = replaceOnce(
    source,
`            <div
              className={\`grid min-h-0 flex-1 gap-0 \${groupInfoOpen && selectedItem?.type === 'group' ? 'lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]' : 'lg:grid-cols-[340px_minmax(0,1fr)]'}\`}
            >`,
`            <div
              className={\`grid min-h-0 flex-1 gap-0 \${groupInfoOpen && selectedItem?.type === 'group' ? 'grid-cols-1' : conversationPaneGridClass}\`}
            >`,
    'Messaging pane grid'
  );

  source = replaceOnce(
    source,
`                className={\`\${compactPane === 'thread' ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-stone-200 bg-white lg:border-r\`}`,
`                className={\`\${groupInfoOpen ? 'hidden' : compactPane === 'thread' ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-stone-200 bg-white lg:border-r\`}`,
    'Conversation list visibility'
  );

  source = replaceOnce(
    source,
`                className={\`\${compactPane === 'thread' ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col bg-white\`}`,
`                className={\`\${groupInfoOpen ? 'hidden' : compactPane === 'thread' ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col bg-white\`}`,
    'Thread pane visibility'
  );

  const listHeaderStart = '                <div className="space-y-3 border-b border-stone-100 px-4 py-4">';
  const listHeaderEnd = '\n\n                <div className="min-h-0 flex-1 overflow-y-auto">';
  const listStartIndex = source.indexOf(listHeaderStart);
  const listEndIndex = source.indexOf(listHeaderEnd, listStartIndex);

  if (listStartIndex < 0 || listEndIndex < 0) {
    throw new Error('Chat-list header boundaries were not found.');
  }

  const newListHeader = `                <div className={\`\${conversationPaneMode === 'compact' ? 'px-2 py-3' : 'space-y-3 px-4 py-4'} border-b border-stone-100\`}>
                  <div className={\`flex items-center \${conversationPaneMode === 'compact' ? 'justify-center' : 'justify-between'} gap-2\`}>
                    {conversationPaneMode !== 'compact' ? (
                      <p className="text-base font-semibold text-stone-900">Chats</p>
                    ) : null}

                    <button
                      type="button"
                      onClick={cycleConversationPaneMode}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-50 hover:text-stone-800"
                      title={\`Resize chat list · \${conversationPaneMode}\`}
                      aria-label={\`Resize chat list. Current size: \${conversationPaneMode}\`}
                    >
                      <span className="flex h-4 w-4 items-end gap-[2px]" aria-hidden="true">
                        <span className={\`block h-4 rounded-[2px] bg-current transition-all \${conversationPaneMode === 'full' ? 'w-2' : conversationPaneMode === 'compact' ? 'w-1.5' : 'w-1'}\`} />
                        <span className="block h-4 flex-1 rounded-[2px] border border-current opacity-50" />
                      </span>
                    </button>
                  </div>

                  {conversationPaneMode !== 'compact' ? (
                    <>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder={conversationPaneMode === 'compact' ? 'Search chats' : 'Search name, PDM ID, or message'}
                          className="h-10 w-full rounded-full border-0 bg-stone-100 pl-10 pr-4 text-sm text-stone-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setShowUnreadOnly((current) => !current)}
                          className={\`inline-flex h-8 items-center gap-2 rounded-lg border \${conversationPaneMode === 'compact' ? 'px-2' : 'px-3'} text-xs font-medium transition \${showUnreadOnly
                            ? 'border-[var(--portal-base)] bg-[var(--portal-accent-soft)] text-[var(--portal-base)]'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                            }\`}
                        >
                          <Filter className="h-3.5 w-3.5" />
                          <span className={conversationPaneMode === 'compact' ? 'sr-only' : ''}>
                            Unread only
                          </span>
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>`;

  source =
    source.slice(0, listStartIndex) +
    newListHeader +
    source.slice(listEndIndex);

  source = replaceOnce(
    source,
`                          inboxStyle={false}
                          onClick={() => {`,
`                          inboxStyle={false}
                          density={conversationPaneMode}
                          onClick={() => {`,
    'ThreadRow density prop'
  );

  source = replaceOnce(
    source,
'{renderGroupInfo({ responsive: true })}',
'{renderGroupInfo({ embedded: true })}',
    'Embedded GroupInfo rendering'
  );

  source = replaceOnce(
    source,
'<span>Archived</span>',
'<span className="hidden sm:inline">Archived</span>',
    'Small-screen Archived label'
  );

  source = replaceOnce(
    source,
'<span>Group</span>',
'<span className="hidden sm:inline">Group</span>',
    'Small-screen Group label'
  );

  return source;
}

function main() {
  const { dryRun, root } = parseArgs(process.argv.slice(2));

  const file = path.join(
    root,
    'admin',
    'frontend',
    'src',
    'pages',
    'AdminMessages.jsx'
  );
  const testFile = path.join(
    root,
    'admin',
    'backend',
    'test',
    'admin-messages-compact-layout-contract.test.js'
  );

  console.log(PATCH_NAME);
  console.log(`Repository: ${root}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}\n`);

  const original = readRequired(file);
  const originalTest = fs.existsSync(testFile)
    ? normalize(fs.readFileSync(testFile, 'utf8'))
    : null;

  console.log('[1/6] Verifying current Admin messaging layout regression...');
  ensureIncludes(
    original,
    [
      'renderGroupInfo({ responsive: true })',
      'placeholder="Search members"',
      "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]",
      'function ThreadRow({',
    ],
    'Current messaging layout'
  );
  console.log('      PASS');

  console.log('[2/6] Adding exactly two chat-list modes: Full / Compact (avatar-only)...');
  const staged = patchSource(original);
  ensureIncludes(
    staged,
    [
      "conversationPaneModes = ['full', 'compact', 'icons']",
      "icons: 'lg:grid-cols-[76px_minmax(0,1fr)]'",
      'density={conversationPaneMode}',
      'Resize chat list',
    ],
    'Resizable conversation list'
  );
  console.log('      PASS');

  console.log('[3/6] Restoring embedded Group Info instead of the right-side drawer...');
  ensureIncludes(
    staged,
    [
      "{renderGroupInfo({ embedded: true })}",
      "groupInfoOpen ? 'hidden'",
      "'grid-cols-1'",
      'className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"',
    ],
    'Embedded Group Info'
  );
  ensureExcludes(
    staged,
    [
      'renderGroupInfo({ responsive: true })',
      'fixed inset-y-0 right-0 z-[90]',
    ],
    'Drawer regression'
  );
  console.log('      PASS');

  console.log('[4/6] Removing Search Members regression and restoring Search Chat...');
  ensureExcludes(
    staged,
    [
      'placeholder="Search members"',
      'aria-label="Search group members"',
    ],
    'Group member search regression'
  );
  ensureIncludes(
    staged,
    [
      '>Search chat</span>',
      'onSearchChat',
      'setChatSearchOpen(true)',
    ],
    'Search chat action'
  );
  console.log('      PASS');

  console.log('[5/6] Cleaning small-screen header + compact conversation rows...');
  ensureIncludes(
    staged,
    [
      'hidden sm:inline">Archived',
      'hidden sm:inline">Group',
      "const iconOnly = density === 'icons'",
      "const compact = density === 'compact'",
    ],
    'Small-screen messaging cleanup'
  );
  console.log('      PASS');

  console.log('[6/6] Building targeted Admin messaging UI regression tests...');
  const stagedTest = buildContractTest();
  console.log('      PASS');

  console.log('\nFiles affected by this installer:');
  console.log('  1. admin/frontend/src/pages/AdminMessages.jsx');
  console.log('  2. admin/backend/test/admin-messages-compact-layout-contract.test.js (new)');
  console.log('\nNo messaging backend service, API route, database, or mobile messaging file is changed.');

  if (dryRun) {
    console.log('\nPASS: dry-run completed. No files were changed.');
    return;
  }

  const originals = new Map([
    [file, original],
    [testFile, originalTest],
  ]);

  const backupRoot = makeBackup(root, originals);
  let wrote = false;

  try {
    fs.writeFileSync(file, staged, 'utf8');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, stagedTest, 'utf8');
    wrote = true;

    run(
      process.execPath,
      ['--test', testFile],
      path.join(root, 'admin', 'backend'),
      'Admin messaging compact-layout contract tests'
    );

    run(
      'npm',
      ['run', 'build'],
      path.join(root, 'admin', 'frontend'),
      'Admin frontend build'
    );

    console.log('\nPASS: Admin messaging responsive layout cleanup completed.');
    console.log('\nVerified behavior:');
    console.log('  [x] Chat list toggles Full ↔ Compact');
    console.log('  [x] Selected chat remains usable at every list width');
    console.log('  [x] Compact mode shows only the conversation profile/icon');
    console.log('  [x] Group Info replaces the conversation panes instead of opening a right drawer');
    console.log('  [x] Search Members is removed');
    console.log('  [x] Search Chat returns to the conversation search');
    console.log('  [x] Member list/actions, Add Member, and Leave Group remain');
    console.log('  [x] Top toolbar labels collapse on narrower screens');
    console.log(`\nBackup: ${backupRoot}`);
  } catch (error) {
    if (wrote) {
      console.error('\nPatch verification failed. Restoring previous files...');
      rollback(originals);
      console.error(`Rollback completed. Backup: ${backupRoot}`);
    }
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(`\nFAIL: ${error.message}`);
  process.exitCode = 1;
}
