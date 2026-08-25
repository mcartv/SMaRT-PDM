import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  Eye,
  Filter,
  Info,
  LoaderCircle,
  LogOut,
  MailCheck,
  MailOpen,
  MessageSquareMore,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SendHorizontal,
  ShieldCheck,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useSocketEvent } from '@/hooks/useSocket'
import API_BASE_URL from '@/api'

const MESSAGING_API_BASE = API_BASE_URL
// SMART-PDM_ADMIN_MESSAGES_RESPONSIVE_V1
// SMART-PDM_ADMIN_MESSAGES_EMBEDDED_GROUP_INFO_V2

function parseMessagingToken(token) {
  try {
    if (!token) return {}
    const parts = token.split('.')
    if (parts.length < 2) return {}

    const normalizedPayload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')

    return JSON.parse(atob(normalizedPayload)) || {}
  } catch {
    return {}
  }
}

function buildMessagingHeaders(token, options = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
  }

  if (options.json) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

async function parseApiResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || payload.message || fallbackMessage)
  }

  return payload
}

function normalizeConversation(raw = {}) {
  return {
    id: raw.counterpartyId?.toString() || raw.counterparty_id?.toString() || '',
    type: 'private',
    name: raw.name?.toString() || 'Unknown user',
    studentNumber: raw.studentNumber?.toString() || raw.student_number?.toString() || '',
    lastMessage: raw.lastMessage?.toString() || raw.last_message?.toString() || '',
    lastSentAt: raw.lastSentAt?.toString() || raw.last_sent_at?.toString() || '',
    createdAt: raw.createdAt?.toString() || raw.created_at?.toString() || '',
    avatarUrl:
      raw.avatarUrl?.toString() ||
      raw.profilePhotoUrl?.toString() ||
      raw.avatar_url?.toString() ||
      raw.profile_photo_url?.toString() ||
      '',
    unreadCount: Number(raw.unreadCount ?? raw.unread_count ?? 0),
    isDisabled: raw.isDisabled === true || raw.is_disabled === true,
  }
}

function normalizeRoom(raw = {}) {
  const memberCount = Number(raw.member_count ?? raw.memberCount ?? 0)

  return {
    id: raw.roomId?.toString() || raw.room_id?.toString() || '',
    type: 'group',
    name: raw.roomName?.toString() || raw.room_name?.toString() || 'Untitled Group',
    memberCount,
    studentNumber: `${memberCount} member${memberCount === 1 ? '' : 's'}`,
    lastMessage: raw.lastMessage?.toString() || raw.last_message?.toString() || '',
    lastSentAt: raw.lastSentAt?.toString() || raw.last_sent_at?.toString() || '',
    createdAt: raw.createdAt?.toString() || raw.created_at?.toString() || '',
    unreadCount: Number(raw.unreadCount ?? raw.unread_count ?? 0),
    viewerIsAdmin: raw.viewerIsAdmin === true || raw.viewer_is_admin === true || raw.is_admin === true,
  }
}

function normalizeRoomMember(raw = {}) {
  return {
    userId: raw.userId?.toString() || raw.user_id?.toString() || '',
    name: raw.name?.toString() || 'Unknown User',
    subtitle: raw.subtitle?.toString() || '',
    studentNumber: raw.studentNumber?.toString() || raw.student_number?.toString() || '',
    role: raw.role?.toString() || '',
    email: raw.email?.toString() || '',
    department: raw.department?.toString() || '',
    position: raw.position?.toString() || '',
    avatarUrl:
      raw.avatarUrl?.toString() ||
      raw.avatar_url?.toString() ||
      raw.profilePhotoUrl?.toString() ||
      raw.profile_photo_url?.toString() ||
      '',
    isAdmin: raw.isAdmin === true || raw.is_admin === true,
    isCurrentUser: raw.isCurrentUser === true || raw.is_current_user === true,
  }
}

function normalizeArchivedThread(raw = {}) {
  const type = raw.thread_type === 'group' ? 'group' : 'private'

  return {
    archiveId:
      raw.archiveId?.toString() ||
      raw.archive_id?.toString() ||
      `${type}-${raw.room_id || raw.counterparty_id || ''}`,
    id:
      type === 'group'
        ? raw.room_id?.toString() || ''
        : raw.counterparty_id?.toString() || '',
    type,
    name: raw.name?.toString() || (type === 'group' ? 'Untitled Group' : 'Unknown User'),
    studentNumber:
      raw.studentNumber?.toString() ||
      raw.student_number?.toString() ||
      (type === 'group' ? `${Number(raw.member_count ?? raw.memberCount ?? 0)} members` : ''),
    lastMessage: raw.lastMessage?.toString() || raw.last_message?.toString() || '',
    lastSentAt: raw.lastSentAt?.toString() || raw.last_sent_at?.toString() || '',
    archivedAt: raw.archivedAt?.toString() || raw.archived_at?.toString() || '',
    isDisabled: raw.isDisabled === true || raw.is_disabled === true,
    canRestore: type !== 'group' || raw.canRestore === true || raw.can_restore === true,
  }
}

function normalizeScholarMember(raw = {}) {
  return {
    userId: raw.user_id?.toString() || '',
    scholarId: raw.scholar_id?.toString() || '',
    studentId: raw.student_id?.toString() || '',
    studentNumber: raw.student_number?.toString() || '',
    firstName: raw.first_name?.toString() || '',
    lastName: raw.last_name?.toString() || '',
    studentName: raw.student_name?.toString() || 'Unknown Contact',
    avatarUrl:
      raw.avatarUrl?.toString() ||
      raw.profilePhotoUrl?.toString() ||
      raw.avatar_url?.toString() ||
      raw.profile_photo_url?.toString() ||
      '',
    programName: raw.program_name?.toString() || 'No Program',
    benefactorName: raw.benefactor_name?.toString() || 'Unassigned Benefactor',
    role: raw.role?.toString() || '',
    position: raw.position?.toString() || '',
    contactType: raw.contact_type?.toString() || 'student',
  }
}

function toScholarSearchItem(raw = {}) {
  return {
    id: raw.userId || '',
    type: 'private',
    name: raw.studentName || 'Unknown Contact',
    studentNumber: raw.studentNumber || raw.studentId || '',
    studentId: raw.studentId || '',
    firstName: raw.firstName || '',
    lastName: raw.lastName || '',
    avatarUrl: raw.avatarUrl || '',
    lastMessage: '',
    lastSentAt: '',
    createdAt: '',
    unreadCount: 0,
    isSearchResult: true,
    isDisabled: false,
    role: raw.role || '',
    position: raw.position || '',
    contactType: raw.contactType || 'student',
  }
}

function normalizeMessage(raw = {}) {
  return {
    messageId: raw.messageId?.toString() || raw.message_id?.toString() || '',
    senderId: raw.senderId?.toString() || raw.sender_id?.toString() || '',
    receiverId: raw.receiverId?.toString() || raw.receiver_id?.toString() || '',
    roomId: raw.roomId?.toString() || raw.room_id?.toString() || '',
    messageBody: raw.messageBody?.toString() || raw.message_body?.toString() || '',
    sentAt: raw.sentAt?.toString() || raw.sent_at?.toString() || '',
    isRead: raw.isRead === true || raw.is_read === true,
    subject: raw.subject?.toString() || null,
    attachmentUrl: raw.attachmentUrl?.toString() || raw.attachment_url?.toString() || null,
    senderName: raw.senderName?.toString() || raw.sender_name?.toString() || '',
    senderAvatarUrl:
      raw.senderAvatarUrl?.toString() ||
      raw.senderProfilePhotoUrl?.toString() ||
      raw.sender_avatar_url?.toString() ||
      raw.sender_profile_photo_url?.toString() ||
      '',
  }
}

function sortMessages(items = []) {
  return [...items].sort(
    (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime()
  )
}

function sortItems(items = []) {
  const getSortTime = (item) => new Date(item.lastSentAt || item.createdAt || 0).getTime()
  return [...items].sort((left, right) => getSortTime(right) - getSortTime(left))
}

function upsertMessage(items, message) {
  const next = items.filter((item) => item.messageId !== message.messageId)
  next.push(message)
  return sortMessages(next)
}

function markMessagesRead(items, messageIds = []) {
  const ids = new Set(messageIds)

  return items.map((item) =>
    ids.has(item.messageId)
      ? {
        ...item,
        isRead: true,
      }
      : item
  )
}

function markMessagesUnread(items, messageIds = []) {
  const ids = new Set(messageIds)

  return items.map((item) =>
    ids.has(item.messageId)
      ? {
        ...item,
        isRead: false,
      }
      : item
  )
}

function formatConversationTime(value) {
  if (!value) return ''

  const date = new Date(value)
  const sameDay = new Date().toDateString() === date.toDateString()

  return sameDay
    ? new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
    : new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date)
}

function formatMessageTime(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function messageDayKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatMessageDay(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const difference = Math.round((today.getTime() - target.getTime()) / 86400000)

  if (difference === 0) return 'Today'
  if (difference === 1) return 'Yesterday'

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date)
}

function messagesBelongTogether(older, newer) {
  if (!older || !newer) return false
  if (!older.senderId || older.senderId !== newer.senderId) return false
  if (messageDayKey(older.sentAt) !== messageDayKey(newer.sentAt)) return false

  const olderTime = new Date(older.sentAt).getTime()
  const newerTime = new Date(newer.sentAt).getTime()
  if (Number.isNaN(olderTime) || Number.isNaN(newerTime)) return false

  return newerTime - olderTime <= 5 * 60 * 1000
}

function MessageDateDivider({ value }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-stone-200/80" />
      <span className="shrink-0 text-xs font-medium text-stone-500">
        {formatMessageDay(value)}
      </span>
      <div className="h-px flex-1 bg-stone-200/80" />
    </div>
  )
}

function ThreadIcon({ item }) {
  const initials = (item.name || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-stone-100 text-xs font-bold text-stone-600">
      {item.type === 'group' ? (
        <Users className="h-4 w-4" />
      ) : item.avatarUrl ? (
        <img src={item.avatarUrl} alt={`${item.name || 'User'} profile`} className="h-full w-full object-cover" />
      ) : (
        initials || <UserRound className="h-4 w-4" />
      )}
    </div>
  )
}

function ThreadRow({ item, isActive, onClick, onToggleRead, onArchive, inboxStyle = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState(null)
  const menuButtonRef = useRef(null)
  const hasUnread = Number(item.unreadCount || 0) > 0

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
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [menuOpen])

  return (
    <div
      className={inboxStyle
        ? `group relative border-b border-stone-100 transition ${isActive
          ? 'bg-[var(--portal-accent-soft)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r-full before:bg-[var(--portal-base)]'
          : hasUnread
            ? 'bg-white hover:bg-stone-50'
            : 'bg-white hover:bg-stone-50'
          }`
        : `group relative mx-2 my-1 overflow-hidden rounded-2xl transition ${isActive
          ? 'bg-white hover:bg-stone-50'
          : hasUnread
            ? 'bg-[var(--portal-accent-soft)]'
            : 'bg-white hover:bg-stone-50'
          } ${isActive ? 'before:absolute before:bottom-3 before:left-0 before:top-3 before:w-1 before:rounded-r-full before:bg-[var(--portal-base)]' : ''}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={inboxStyle
          ? 'flex w-full items-center gap-3 px-3.5 py-3.5 text-left'
          : 'flex w-full items-center gap-3 px-3 py-3 text-left'}
      >
        <ThreadIcon item={item} />

        <div className="min-w-0 flex-1 pr-8">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p
                  className={`truncate text-sm ${hasUnread ? 'font-bold text-stone-950' : 'font-medium text-stone-900'
                    }`}
                >
                  {item.name}
                </p>
                {item.type === 'private' && item.isDisabled ? (
                  <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-stone-600">
                    Account Disabled
                  </span>
                ) : null}
              </div>

              <p className="truncate text-xs text-stone-500">
                {item.type === 'group' ? 'Group chat' : item.studentNumber || 'No student number'}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={inboxStyle
                ? 'text-[11px] font-medium text-stone-400'
                : 'text-xs text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'}>
                {formatConversationTime(item.lastSentAt)}
              </span>

              {hasUnread && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </span>
              )}
            </div>
          </div>

          <p
            className={`mt-1 truncate text-xs ${hasUnread ? 'font-semibold text-stone-700' : 'text-stone-500'
              }`}
          >
            {item.lastMessage || 'No messages yet'}
          </p>
        </div>
      </button>

      {!item.isSearchResult && (
        <div className="absolute right-2 top-3">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={toggleMenu}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            title="Thread options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
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
          )}
        </div>
      )}
    </div>
  )
}

function ArchivedThreadsModal({
  open,
  onClose,
  items,
  loading,
  restoringId,
  onRestore,
  onRefresh,
}) {
  if (!open) return null

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50"
            title="Back to chats"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-stone-900">Archived Messages</h3>
            <p className="mt-1 text-xs text-stone-500">Restore archived private chats and group chats.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-stone-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading archived threads
          </div>
        ) : items.length ? (
          <div className="space-y-2">
            {items.map((item) => {
              const itemKey = `${item.type}-${item.id}`

              return (
                <div
                  key={`${item.archiveId}-${itemKey}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600">
                      {item.type === 'group' ? <Users className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">{item.name}</p>
                      <p className="truncate text-xs text-stone-500">
                        {item.studentNumber || (item.type === 'group' ? 'Group chat' : 'Private chat')}
                      </p>
                      <p className="mt-1 truncate text-xs text-stone-500">{item.lastMessage || 'No message preview'}</p>
                      <p className="mt-1 text-xs text-stone-400">Archived {formatMessageTime(item.archivedAt)}</p>
                    </div>
                  </div>

                  {item.canRestore ? (
                    <button
                      type="button"
                      disabled={restoringId === itemKey}
                      onClick={() => onRestore(item)}
                      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-green-200 bg-white px-3 text-xs font-semibold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {restoringId === itemKey ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                      Restore
                    </button>
                  ) : (
                    <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 text-xs font-medium text-stone-500">
                      <LogOut className="h-3.5 w-3.5" />
                      Left group
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-500">
              <Archive className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-stone-900">No archived threads</p>
            <p className="mt-1 text-xs text-stone-500">Archived chats will show here.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function MessageAvatar({ message, isMine = false }) {
  const initials = (message.senderName || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-bold ${isMine
        ? 'border-[var(--portal-base)]/20 bg-[var(--portal-accent-soft)] text-[var(--portal-base)]'
        : 'border-stone-200 bg-white text-stone-600'
        }`}
      title={message.senderName || 'Group member'}
    >
      {message.senderAvatarUrl ? (
        <img
          src={message.senderAvatarUrl}
          alt={`${message.senderName || 'Member'} profile`}
          className="h-full w-full object-cover"
        />
      ) : (
        initials || <UserRound className="h-4 w-4" />
      )}
    </div>
  )
}

function MessageBubble({
  message,
  isMine,
  isGroup = false,
  searchTerm = '',
  showAvatar = true,
  showSenderName = true,
  groupedWithPrevious = false,
  groupedWithNext = false,
}) {
  const query = searchTerm.trim().toLowerCase()
  const isMatch = Boolean(query && message.messageBody.toLowerCase().includes(query))
  const incomingCornerClass = `${groupedWithPrevious ? 'rounded-tl-md' : ''} ${groupedWithNext ? 'rounded-bl-md' : ''}`
  const outgoingCornerClass = `${groupedWithPrevious ? 'rounded-tr-md' : ''} ${groupedWithNext ? 'rounded-br-md' : ''}`

  return (
    <div className={`flex items-end gap-2 ${groupedWithPrevious ? 'mt-1' : 'mt-3'} ${isMine ? 'justify-end' : 'justify-start'}`}>
      {!isMine && isGroup ? (
        showAvatar ? <MessageAvatar message={message} /> : <div className="h-8 w-8 shrink-0" aria-hidden="true" />
      ) : null}

      <div className={`flex max-w-[82%] flex-col ${isMine ? 'items-end' : 'items-start'} sm:max-w-[72%]`}>
        {isGroup && !isMine && showSenderName && message.senderName ? (
          <p className="mb-1 px-1 text-xs font-semibold text-stone-500">
            {message.senderName}
          </p>
        ) : null}

        <div className="group/message relative">
          <div
            className={`rounded-2xl px-3.5 py-2.5 shadow-sm transition ${isMine
              ? `bg-[var(--portal-base)] text-white ${outgoingCornerClass}`
              : `border border-stone-200 bg-white text-stone-800 ${incomingCornerClass}`
              } ${isMatch ? 'ring-2 ring-amber-300 ring-offset-2' : ''}`}
          >
            <p className="whitespace-pre-wrap text-sm leading-6">{message.messageBody}</p>
          </div>

          {message.sentAt ? (
            <div
              className={`pointer-events-none absolute bottom-full z-20 mb-2 hidden whitespace-nowrap rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover/message:block group-focus-within/message:block ${isMine ? 'right-0' : 'left-0'}`}
              role="tooltip"
            >
              {formatMessageTime(message.sentAt)}
            </div>
          ) : null}
        </div>
      </div>

      {isMine && isGroup ? (
        showAvatar ? <MessageAvatar message={message} isMine /> : <div className="h-8 w-8 shrink-0" aria-hidden="true" />
      ) : null}
    </div>
  )
}


function MemberAvatar({ member, sizeClass = 'h-10 w-10' }) {
  const initials = (member.name || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-stone-100 text-xs font-bold text-stone-600`}>
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt={`${member.name} profile`} className="h-full w-full object-cover" />
      ) : (
        initials || <UserRound className="h-4 w-4" />
      )}
    </div>
  )
}

function MemberProfileModal({ member, onClose, onMessage }) {
  if (!member) return null

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/35 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <MemberAvatar member={member} sizeClass="h-14 w-14" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold text-stone-900">{member.name}</h3>
                {member.isAdmin ? (
                  <span className="rounded-full bg-[var(--portal-accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--portal-base)]">Group Admin</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-stone-500">{member.subtitle || member.role || 'Group member'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl bg-stone-50 p-4 text-sm">
          {member.studentNumber ? <div><span className="text-stone-500">ID</span><p className="font-medium text-stone-900">{member.studentNumber}</p></div> : null}
          {member.position ? <div><span className="text-stone-500">Position</span><p className="font-medium text-stone-900">{member.position}</p></div> : null}
          {member.department ? <div><span className="text-stone-500">Office</span><p className="font-medium text-stone-900">{member.department}</p></div> : null}
          {member.role ? <div><span className="text-stone-500">Role</span><p className="font-medium text-stone-900">{member.role}</p></div> : null}
          {member.email ? <div><span className="text-stone-500">Email</span><p className="break-all font-medium text-stone-900">{member.email}</p></div> : null}
        </div>

        {!member.isCurrentUser ? (
          <button type="button" onClick={() => onMessage?.(member)} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--portal-base)] px-4 text-sm font-semibold text-white hover:brightness-95">
            <MessageSquareMore className="h-4 w-4" />
            Message
          </button>
        ) : null}
      </div>
    </div>
  )
}

function ConfirmActionModal({ open, title, description, confirmLabel, busy, onCancel, onConfirm, variant = 'danger' }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-base font-semibold text-stone-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="h-10 rounded-xl border border-stone-200 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60">Cancel</button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60 ${
              variant === 'primary'
                ? 'bg-[var(--portal-base)] hover:brightness-95'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function GroupInfoModal({
  open,
  room,
  members,
  loading,
  currentUserId,
  onClose,
  searchTerm,
  matchCount,
  onSearchChange,
  onViewProfile,
  onMessage,
  onRemove,
  onPromote,
  onAddMember,
  onLeave,
  overlay = false,
  embedded = false,
}) {
  const [menuMemberId, setMenuMemberId] = useState('')

  useEffect(() => {
    if (!open) {
      setMenuMemberId('')
    }
  }, [open])

  if (!open || !room) return null

  const filteredMembers = members

  return (
    <aside
      className={embedded
        ? 'flex h-full min-h-0 w-full flex-col bg-white'
        : overlay
          ? 'fixed inset-y-0 right-0 z-[90] flex min-h-0 w-[min(380px,100vw)] flex-col border-l border-stone-200 bg-white shadow-2xl'
          : 'flex min-h-0 flex-col border-l border-stone-200 bg-white'}
    >
      <div className="border-b border-stone-100 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--portal-accent-soft)] text-[var(--portal-base)]">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900">{room.name}</p>
              <p className="mt-0.5 text-xs text-stone-500">Group chat</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100"
            title={embedded ? 'Back to conversation' : 'Close group info'}
            aria-label={embedded ? 'Back to conversation' : 'Close group info'}
          >
            {embedded ? <ArrowLeft className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={searchTerm}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Search chat"
            className="h-9 w-full rounded-lg border border-stone-200 pl-9 pr-3 text-sm outline-none focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
          />
        </div>
        {searchTerm?.trim() ? (
          <p className="mt-1.5 text-xs text-stone-500">{matchCount} match{matchCount === 1 ? '' : 'es'}</p>
        ) : null}
      </div>

      <div className="px-4 pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-stone-800">All members</p>
          {room.viewerIsAdmin ? (
            <button
              type="button"
              onClick={onAddMember}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--portal-accent-soft)] px-2.5 text-xs font-semibold text-[var(--portal-base)] transition hover:brightness-95"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add member
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center gap-2 py-10 text-sm text-stone-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading members</div>
        ) : filteredMembers.length ? (
          <div className="space-y-2">
            {filteredMembers.map((member) => {
              const canPromote = room.viewerIsAdmin && !member.isCurrentUser && !member.isAdmin
              const canRemove = room.viewerIsAdmin && !member.isCurrentUser && !member.isAdmin
              return (
                <div key={member.userId} className="relative flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-stone-50">
                  <MemberAvatar member={member} sizeClass="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-stone-900">{member.name}</p>
                      {member.isAdmin ? <span className="shrink-0 rounded-full bg-[var(--portal-accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--portal-base)]">Admin</span> : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-stone-500">{member.userId === currentUserId ? 'You' : member.subtitle || member.role || 'Group member'}</p>
                  </div>
                  <button type="button" onClick={() => setMenuMemberId((current) => current === member.userId ? '' : member.userId)} className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100" title="Member actions">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuMemberId === member.userId ? (
                    <div className="absolute right-2 top-10 z-20 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl">
                      <button type="button" onClick={() => { setMenuMemberId(''); onViewProfile(member) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50"><Eye className="h-3.5 w-3.5" /> View profile</button>
                      {!member.isCurrentUser ? <button type="button" onClick={() => { setMenuMemberId(''); onMessage(member) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50"><MessageSquareMore className="h-3.5 w-3.5" /> Message</button> : null}
                      {canPromote ? <button type="button" onClick={() => { setMenuMemberId(''); onPromote(member) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--portal-base)] hover:bg-[var(--portal-accent-soft)]"><ShieldCheck className="h-3.5 w-3.5" /> Make group admin</button> : null}
                      {canRemove ? <button type="button" onClick={() => { setMenuMemberId(''); onRemove(member) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50"><UserMinus className="h-3.5 w-3.5" /> Remove member</button> : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-stone-500">
            {Number(room.memberCount || 0) > 0 ? 'Member details could not be loaded.' : 'No members in this group.'}
          </div>
        )}

        <div className="mt-6 border-t border-stone-100 pt-4">
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white text-xs font-semibold text-red-700 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Leave group
          </button>
          <p className="mt-2 text-center text-xs leading-5 text-stone-400">
            Leaving removes you from the group and moves it to your personal Archived Messages.
          </p>
        </div>
      </div>
    </aside>
  )
}

function CreateGroupModal({
  open,
  onClose,
  onCreate,
  creating,
  scholars,
  loadingScholars,
  currentUserId,
}) {
  const [roomName, setRoomName] = useState('')
  const [search, setSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('All Programs')
  const [benefactorFilter, setBenefactorFilter] = useState('All Benefactors')
  const [selectedMembers, setSelectedMembers] = useState([])

  useEffect(() => {
    if (!open) {
      setRoomName('')
      setSearch('')
      setProgramFilter('All Programs')
      setBenefactorFilter('All Benefactors')
      setSelectedMembers([])
    }
  }, [open])

  const programOptions = useMemo(() => ['All Programs', ...new Set(scholars.map((item) => item.programName).filter(Boolean))], [scholars])
  const benefactorOptions = useMemo(() => ['All Benefactors', ...new Set(scholars.map((item) => item.benefactorName).filter(Boolean))], [scholars])
  const filteredScholars = useMemo(() => {
    const query = search.trim().toLowerCase()
    return scholars.filter((item) => {
      const matchesSearch = !query || [item.studentId, item.firstName, item.lastName, item.studentName, item.studentNumber, item.programName, item.benefactorName, item.role, item.position]
        .filter(Boolean).join(' ').toLowerCase().includes(query)
      return matchesSearch && (programFilter === 'All Programs' || item.programName === programFilter) && (benefactorFilter === 'All Benefactors' || item.benefactorName === benefactorFilter)
    })
  }, [scholars, search, programFilter, benefactorFilter])

  if (!open) return null

  const toggleMember = (userId) => {
    setSelectedMembers((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId])
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50" title="Back to chats">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-stone-900">Create Group Chat</h3>
            <p className="mt-1 text-xs text-stone-500">Select students and authorized users by program, office, or role.</p>
          </div>
        </div>
        <span className="text-xs font-medium text-stone-500">{selectedMembers.length} selected</span>
      </div>

      <div className="border-b border-stone-100 px-5 py-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_200px]">
          <input type="text" value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Group name" className="h-10 w-full rounded-xl border border-stone-200 px-4 text-sm text-stone-800 outline-none focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]" />
          <select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} className="h-10 rounded-xl border border-stone-200 px-3 text-sm text-stone-800 outline-none focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]">
            {programOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={benefactorFilter} onChange={(event) => setBenefactorFilter(event.target.value)} className="h-10 rounded-xl border border-stone-200 px-3 text-sm text-stone-800 outline-none focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]">
            {benefactorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, ID, program, office, or role" className="h-10 w-full rounded-xl border border-stone-200 pl-10 pr-4 text-sm text-stone-800 outline-none focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loadingScholars ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-stone-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading contacts</div>
          ) : filteredScholars.length ? (
            <div className="space-y-2">
              {filteredScholars.map((item) => {
                const checked = selectedMembers.includes(item.userId)
                return (
                  <label key={item.userId} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${checked ? 'border-[var(--portal-base)] bg-[var(--portal-accent-soft)]' : 'border-stone-200 bg-white hover:bg-stone-50'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleMember(item.userId)} className="h-4 w-4 accent-[var(--portal-base)]" />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                      {item.avatarUrl ? <img src={item.avatarUrl} alt={`${item.studentName} profile`} className="h-full w-full object-cover" /> : (item.studentName || 'U').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-stone-900">{item.studentName}</p>
                        {checked ? <span className="inline-flex items-center rounded-full bg-[var(--portal-base)] px-2 py-0.5 text-xs font-semibold text-white"><Check className="mr-1 h-3 w-3" /> Selected</span> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">{item.studentNumber || item.position || item.role || 'Authorized user'}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-stone-500">No contacts match the current filters.</div>
          )}
        </div>

        <div className="hidden w-[250px] border-l border-stone-100 bg-stone-50/70 px-4 py-4 lg:block">
          <p className="text-sm font-semibold text-stone-900">Selected Members</p>
          <p className="mt-1 text-xs text-stone-500">{selectedMembers.length} selected</p>
          <div className="mt-4 space-y-2">
            {selectedMembers.length ? selectedMembers.map((userId) => {
              const scholar = scholars.find((item) => item.userId === userId)
              if (!scholar) return null
              return <div key={userId} className="rounded-xl border border-stone-200 bg-white px-3 py-2"><p className="truncate text-sm font-medium text-stone-900">{scholar.studentName}</p><p className="mt-0.5 truncate text-xs text-stone-500">{scholar.studentNumber || scholar.position || scholar.role}</p></div>
            }) : <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-4 text-sm text-stone-500">No members selected yet.</div>}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
        <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-50">Cancel</button>
        <button
          type="button"
          disabled={creating || !roomName.trim() || !selectedMembers.length}
          onClick={() => onCreate({ roomName: roomName.trim(), memberIds: [currentUserId, ...selectedMembers].filter(Boolean) })}
          className="inline-flex h-10 items-center rounded-xl bg-[var(--portal-base)] px-4 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Creating</> : <><Plus className="mr-2 h-4 w-4" /> Create Group</>}
        </button>
      </div>
    </section>
  )
}

function AddMembersView({
  open,
  onClose,
  onAdd,
  adding,
  scholars,
  loadingScholars,
  existingMemberIds = [],
}) {
  const [search, setSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('All Programs')
  const [benefactorFilter, setBenefactorFilter] = useState('All Benefactors')
  const [selectedMembers, setSelectedMembers] = useState([])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setProgramFilter('All Programs')
      setBenefactorFilter('All Benefactors')
      setSelectedMembers([])
    }
  }, [open])

  const programOptions = useMemo(() => {
    return ['All Programs', ...new Set(scholars.map((item) => item.programName).filter(Boolean))]
  }, [scholars])

  const benefactorOptions = useMemo(() => {
    return ['All Benefactors', ...new Set(scholars.map((item) => item.benefactorName).filter(Boolean))]
  }, [scholars])

  const filteredScholars = useMemo(() => {
    const query = search.trim().toLowerCase()
    const existingIds = new Set(existingMemberIds.filter(Boolean))

    return scholars.filter((item) => {
      if (existingIds.has(item.userId)) return false

      const matchesSearch =
        !query ||
        [
          item.studentId,
          item.firstName,
          item.lastName,
          item.studentName,
          item.studentNumber,
          item.programName,
          item.benefactorName,
          item.role,
          item.position,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)

      const matchesProgram =
        programFilter === 'All Programs' || item.programName === programFilter

      const matchesBenefactor =
        benefactorFilter === 'All Benefactors' || item.benefactorName === benefactorFilter

      return matchesSearch && matchesProgram && matchesBenefactor
    })
  }, [scholars, search, programFilter, benefactorFilter, existingMemberIds])

  if (!open) return null

  const toggleMember = (userId) => {
    setSelectedMembers((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50"
            title="Back to group chat"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-stone-900">Add Contacts To Group</h3>
            <p className="mt-1 text-xs text-stone-500">
              Search students or authorized users, then add them to this group chat.
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-stone-500">{selectedMembers.length} selected</span>
      </div>

      <div className="border-b border-stone-100 px-5 py-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, ID, program, office, or role"
              className="h-10 w-full rounded-xl border border-stone-200 pl-10 pr-4 text-sm text-stone-800 outline-none transition focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
            />
          </div>

          <select
            value={programFilter}
            onChange={(event) => setProgramFilter(event.target.value)}
            className="h-10 rounded-xl border border-stone-200 px-3 text-sm text-stone-800 outline-none transition focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
          >
            {programOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>

          <select
            value={benefactorFilter}
            onChange={(event) => setBenefactorFilter(event.target.value)}
            className="h-10 rounded-xl border border-stone-200 px-3 text-sm text-stone-800 outline-none transition focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
          >
            {benefactorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loadingScholars ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-stone-500">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading contacts
            </div>
          ) : filteredScholars.length ? (
            <div className="space-y-2">
              {filteredScholars.map((item) => {
                const checked = selectedMembers.includes(item.userId)
                const initials = (item.studentName || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')

                return (
                  <label
                    key={item.userId}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${checked
                      ? 'border-[var(--portal-base)] bg-[var(--portal-accent-soft)]'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(item.userId)}
                      className="h-4 w-4 accent-[var(--portal-base)]"
                    />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                      {item.avatarUrl ? (
                        <img src={item.avatarUrl} alt={`${item.studentName} profile`} className="h-full w-full object-cover" />
                      ) : initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-stone-900">{item.studentName}</p>
                        {checked ? (
                          <span className="inline-flex items-center rounded-full bg-[var(--portal-base)] px-2 py-0.5 text-xs font-semibold text-white">
                            <Check className="mr-1 h-3 w-3" /> Selected
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-stone-500">
                        {item.studentNumber || item.position || item.role || 'Authorized user'}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-stone-500">
              No contacts match the current filters.
            </div>
          )}
        </div>

        <div className="hidden w-[250px] border-l border-stone-100 bg-stone-50/70 px-4 py-4 lg:block">
          <p className="text-sm font-semibold text-stone-900">Selected Contacts</p>
          <p className="mt-1 text-xs text-stone-500">{selectedMembers.length} selected</p>
          <div className="mt-4 space-y-2">
            {selectedMembers.length ? selectedMembers.map((userId) => {
              const scholar = scholars.find((item) => item.userId === userId)
              if (!scholar) return null
              return (
                <div key={userId} className="rounded-xl border border-stone-200 bg-white px-3 py-2">
                  <p className="truncate text-sm font-medium text-stone-900">{scholar.studentName}</p>
                  <p className="mt-0.5 truncate text-xs text-stone-500">{scholar.studentNumber || scholar.position || scholar.role}</p>
                </div>
              )
            }) : (
              <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-4 text-sm text-stone-500">
                No contacts selected yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 items-center rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={adding || !selectedMembers.length}
          onClick={() => onAdd(selectedMembers)}
          className="inline-flex h-10 items-center rounded-xl bg-[var(--portal-base)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {adding ? (
            <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Adding</>
          ) : (
            <><UserPlus className="mr-2 h-4 w-4" /> Add To Group</>
          )}
        </button>
      </div>
    </section>
  )
}

export default function AdminMessages({
  tokenStorageKey = 'adminToken',
  portalKey = 'admin',
}) {
  const token = sessionStorage.getItem(tokenStorageKey) || ''
  const tokenPayload = parseMessagingToken(token)
  const currentUserId =
    tokenPayload.user_id || tokenPayload.userId || tokenPayload.sub || tokenPayload.id || ''

  const [isOpen, setIsOpen] = useState(false)
  const [mainView, setMainView] = useState('chats')
  const [searchTerm, setSearchTerm] = useState('')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const isAdminMessaging = portalKey === 'admin'
  const [compactPane, setCompactPane] = useState('list')

  const [conversations, setConversations] = useState([])
  const [rooms, setRooms] = useState([])
  const [scholars, setScholars] = useState([])
  const [loadingScholars, setLoadingScholars] = useState(false)

  const [activeType, setActiveType] = useState('private')
  const [activeConversationId, setActiveConversationId] = useState('')
  const [activeRoomId, setActiveRoomId] = useState('')
  const [transientPrivateContact, setTransientPrivateContact] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)

  const [createRoomOpen, setCreateGroupOpen] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [addMembersOpen, setAddMembersOpen] = useState(false)
  const [addingMembers, setAddingMembers] = useState(false)

  const [groupInfoOpen, setGroupInfoOpen] = useState(false)
  const [groupMembers, setGroupMembers] = useState([])
  const [loadingGroupMembers, setLoadingGroupMembers] = useState(false)
  const [selectedMemberProfile, setSelectedMemberProfile] = useState(null)
  const [pendingRemoveMember, setPendingRemoveMember] = useState(null)
  const [removeMemberBusy, setRemoveMemberBusy] = useState(false)
  const [pendingPromoteMember, setPendingPromoteMember] = useState(null)
  const [promoteMemberBusy, setPromoteMemberBusy] = useState(false)
  const [leaveGroupOpen, setLeaveGroupOpen] = useState(false)
  const [leaveGroupBusy, setLeaveGroupBusy] = useState(false)
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [chatSearchTerm, setChatSearchTerm] = useState('')

  const [archivedOpen, setArchivedOpen] = useState(false)
  const [archivedItems, setArchivedItems] = useState([])
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [restoringArchiveId, setRestoringArchiveId] = useState('')
  const [pendingArchiveThread, setPendingArchiveThread] = useState(null)
  const [archiveThreadBusy, setArchiveThreadBusy] = useState(false)

  const activeConversationRef = useRef('')
  const activeRoomRef = useRef('')
  const messagesEndRef = useRef(null)
  const messagesScrollRef = useRef(null)
  const composerRef = useRef(null)
  const shouldAutoScrollRef = useRef(true)
  const forceScrollToBottomRef = useRef(true)
  const processedRealtimeMessageIdsRef = useRef(new Set())

  const totalUnreadCount = useMemo(
    () =>
      [...conversations, ...rooms].reduce(
        (sum, item) => sum + Number(item.unreadCount || 0),
        0
      ),
    [conversations, rooms]
  )

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('portal-messages:unread', {
        detail: { portalKey, count: totalUnreadCount },
      })
    )
  }, [portalKey, totalUnreadCount])

  const scholarByUserId = useMemo(
    () =>
      new Map(
        scholars
          .filter((item) => item.userId)
          .map((item) => [item.userId, item])
      ),
    [scholars]
  )

  const mergedItems = useMemo(() => {
    const privateItems = conversations.map((item) => ({
      ...item,
      type: 'private',
      name: item.name || scholarByUserId.get(item.id)?.studentName || 'Unknown user',
      studentNumber:
        item.studentNumber ||
        scholarByUserId.get(item.id)?.studentNumber ||
        scholarByUserId.get(item.id)?.studentId ||
        '',
      avatarUrl: item.avatarUrl || scholarByUserId.get(item.id)?.avatarUrl || '',
    }))

    const groupItems = rooms.map((item) => ({
      ...item,
      type: 'group',
    }))

    return sortItems([...privateItems, ...groupItems])
  }, [conversations, rooms, scholarByUserId])

  const scholarSearchItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    if (!query || showUnreadOnly) {
      return []
    }

    const existingPrivateIds = new Set(
      mergedItems
        .filter((item) => item.type === 'private')
        .map((item) => item.id)
        .filter(Boolean)
    )

    return scholars
      .filter((item) => {
        if (!item.userId || existingPrivateIds.has(item.userId)) {
          return false
        }

        return [
          item.studentId,
          item.firstName,
          item.lastName,
          item.studentName,
          item.studentNumber,
          item.programName,
          item.benefactorName,
          item.role,
          item.position,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      })
      .map(toScholarSearchItem)
  }, [mergedItems, scholars, searchTerm, showUnreadOnly])

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    const matchedThreads = mergedItems.filter((item) => {
      const matchesUnread = showUnreadOnly ? Number(item.unreadCount || 0) > 0 : true
      const searchText = [item.name, item.studentNumber, item.lastMessage]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = query ? searchText.includes(query) : true
      return matchesUnread && matchesSearch
    })

    if (!query || showUnreadOnly) {
      return matchedThreads
    }

    return [...matchedThreads, ...scholarSearchItems]
  }, [mergedItems, scholarSearchItems, searchTerm, showUnreadOnly])

  const selectedItem = useMemo(() => {
    if (activeType === 'group') {
      return (
        filteredItems.find((item) => item.type === 'group' && item.id === activeRoomId) ||
        mergedItems.find((item) => item.type === 'group' && item.id === activeRoomId)
      )
    }

    return (
      filteredItems.find((item) => item.type === 'private' && item.id === activeConversationId) ||
      mergedItems.find((item) => item.type === 'private' && item.id === activeConversationId) ||
      (transientPrivateContact?.id === activeConversationId ? transientPrivateContact : null)
    )
  }, [filteredItems, mergedItems, activeType, activeConversationId, activeRoomId, transientPrivateContact])

  const chatMatchCount = useMemo(() => {
    const query = chatSearchTerm.trim().toLowerCase()
    if (!query) return 0
    return messages.filter((message) => message.messageBody.toLowerCase().includes(query)).length
  }, [messages, chatSearchTerm])

  useEffect(() => {
    activeConversationRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    activeRoomRef.current = activeRoomId
  }, [activeRoomId])

  const scrollMessagesToBottom = useCallback((behavior = 'auto') => {
    window.requestAnimationFrame(() => {
      const container = messagesScrollRef.current
      if (!container) return
      container.scrollTo({ top: container.scrollHeight, behavior })
      shouldAutoScrollRef.current = true
    })
  }, [])

  const handleMessagesScroll = useCallback(() => {
    const container = messagesScrollRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < 120
  }, [])

  useEffect(() => {
    forceScrollToBottomRef.current = true
    shouldAutoScrollRef.current = true
  }, [activeType, activeConversationId, activeRoomId])

  useEffect(() => {
    if (!messages.length) return

    if (forceScrollToBottomRef.current) {
      scrollMessagesToBottom('auto')
      forceScrollToBottomRef.current = false
      return
    }

    if (shouldAutoScrollRef.current) {
      scrollMessagesToBottom('smooth')
    }
  }, [messages, scrollMessagesToBottom])

  useEffect(() => {
    const composer = composerRef.current
    if (!composer) return
    composer.style.height = 'auto'
    composer.style.height = `${Math.min(composer.scrollHeight, 128)}px`
  }, [draft])

  const fetchConversations = useCallback(
    async (preferredConversationId = activeConversationRef.current) => {
      setLoadingConversations(true)

      try {
        const response = await fetch(`${MESSAGING_API_BASE}/api/messages/conversations`, {
          headers: buildMessagingHeaders(token),
        })

        const payload = await parseApiResponse(response, 'Failed to load conversations.')
        const items = sortItems((payload.items || []).map(normalizeConversation))

        setConversations(items)
        setError('')

        if (!items.length && !rooms.length) {
          setActiveConversationId('')
          setMessages([])
          return
        }

        if (items.length && !activeRoomRef.current) {
          const nextConversationId = items.some((item) => item.id === preferredConversationId)
            ? preferredConversationId
            : items[0].id

          setActiveType('private')
          setActiveConversationId(nextConversationId)
        }
      } catch (err) {
        setError(err.message || 'Failed to load conversations.')
      } finally {
        setLoadingConversations(false)
      }
    },
    [token, rooms.length]
  )

  const fetchRooms = useCallback(
    async (preferredRoomId = activeRoomRef.current) => {
      try {
        const response = await fetch(`${MESSAGING_API_BASE}/api/messages/rooms`, {
          headers: buildMessagingHeaders(token),
        })

        const payload = await parseApiResponse(response, 'Failed to load rooms.')
        const rawItems = Array.isArray(payload) ? payload : payload.items || []
        const items = sortItems(rawItems.map(normalizeRoom))

        setRooms(items)

        if (items.length && !activeConversationRef.current && !preferredRoomId) {
          setActiveType('group')
          setActiveRoomId(items[0].id)
        } else if (
          items.length &&
          preferredRoomId &&
          items.some((item) => item.id === preferredRoomId)
        ) {
          setActiveType('group')
          setActiveRoomId(preferredRoomId)
        }
      } catch (err) {
        console.error('ROOM FETCH ERROR:', err.message)
      }
    },
    [token]
  )

  const fetchScholarMembers = useCallback(async () => {
    try {
      setLoadingScholars(true)

      const response = await fetch(`${MESSAGING_API_BASE}/api/messages/members/contacts`, {
        headers: buildMessagingHeaders(token),
      })

      const payload = await parseApiResponse(response, 'Failed to load contacts.')
      setScholars((payload.items || []).map(normalizeScholarMember))
    } catch (err) {
      setError(err.message || 'Failed to load contacts.')
    } finally {
      setLoadingScholars(false)
    }
  }, [token])

  const fetchConversationMessages = useCallback(
    async (counterpartyId, { silent = false } = {}) => {
      if (!counterpartyId) {
        setMessages([])
        return
      }

      if (!silent) setLoadingMessages(true)

      try {
        const response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/conversations/${counterpartyId}`,
          {
            headers: buildMessagingHeaders(token),
          }
        )

        const payload = await parseApiResponse(response, 'Failed to load messages.')
        const items = sortMessages((payload.items || []).map(normalizeMessage))
        const counterpartyDisabled = payload?.counterparty?.is_disabled === true

        setMessages(items)
        setConversations((current) =>
          current.map((item) =>
            item.id === counterpartyId
              ? { ...item, isDisabled: counterpartyDisabled }
              : item
          )
        )
        setError('')
      } catch (err) {
        if (!silent) {
          setError(err.message || 'Failed to load messages.')
          setMessages([])
        }
      } finally {
        if (!silent) setLoadingMessages(false)
      }
    },
    [token]
  )

  const fetchRoomMessages = useCallback(
    async (roomId, { silent = false } = {}) => {
      if (!roomId) {
        setMessages([])
        return
      }

      if (!silent) setLoadingMessages(true)

      try {
        const response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/rooms/${roomId}/messages`,
          {
            headers: buildMessagingHeaders(token),
          }
        )

        const payload = await parseApiResponse(response, 'Failed to load room messages.')
        const items = sortMessages((payload.items || []).map(normalizeMessage))
        const hasMemberPayload =
          Array.isArray(payload.members) ||
          Array.isArray(payload.roomMembers) ||
          payload.member_count != null ||
          payload.memberCount != null
        const roomMembers = (payload.members || payload.roomMembers || []).map(normalizeRoomMember)
        const resolvedMemberCount = Number(
          payload.member_count ?? payload.memberCount ?? roomMembers.length
        )

        setMessages(items)
        if (hasMemberPayload) {
          setGroupMembers(roomMembers)
          setRooms((current) => current.map((room) =>
            room.id === roomId
              ? {
                  ...room,
                  viewerIsAdmin:
                    payload.viewer_is_admin === true ||
                    payload.viewerIsAdmin === true ||
                    room.viewerIsAdmin,
                  memberCount: resolvedMemberCount,
                  studentNumber: `${resolvedMemberCount} member${resolvedMemberCount === 1 ? '' : 's'}`,
                }
              : room
          ))
        }
        setError('')
      } catch (err) {
        if (!silent) {
          setError(err.message || 'Failed to load room messages.')
          setMessages([])
        }
      } finally {
        if (!silent) setLoadingMessages(false)
      }
    },
    [token]
  )

  const fetchRoomMembers = useCallback(
    async (roomId = activeRoomRef.current) => {
      const normalizedRoomId = roomId?.toString?.().trim() || ''
      if (!normalizedRoomId) {
        setGroupMembers([])
        return []
      }

      try {
        setLoadingGroupMembers(true)
        const response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/rooms/${normalizedRoomId}/messages`,
          { headers: buildMessagingHeaders(token) }
        )
        const payload = await parseApiResponse(response, 'Failed to load group members.')
        const hasMemberPayload = Array.isArray(payload.members) || Array.isArray(payload.roomMembers)
        const items = (payload.members || payload.roomMembers || []).map(normalizeRoomMember)
        if (hasMemberPayload) {
          setGroupMembers(items)
          setRooms((current) => current.map((room) =>
            room.id === normalizedRoomId
              ? {
                  ...room,
                  viewerIsAdmin:
                    payload.viewer_is_admin === true ||
                    payload.viewerIsAdmin === true ||
                    room.viewerIsAdmin,
                  memberCount: Number(payload.member_count ?? payload.memberCount ?? items.length),
                  studentNumber: `${Number(payload.member_count ?? payload.memberCount ?? items.length)} member${Number(payload.member_count ?? payload.memberCount ?? items.length) === 1 ? '' : 's'}`,
                }
              : room
          ))
        }
        return items
      } catch (err) {
        setError(err.message || 'Failed to load group members.')
        return []
      } finally {
        setLoadingGroupMembers(false)
      }
    },
    [token]
  )

  const markConversationRead = useCallback(
    async (counterpartyId) => {
      const normalizedCounterpartyId = counterpartyId?.toString?.().trim() || ''

      if (!normalizedCounterpartyId) {
        return { messageIds: [], isRead: true, unreadCount: 0 }
      }

      try {
        const response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/conversations/${normalizedCounterpartyId}/read`,
          {
            method: 'PATCH',
            headers: buildMessagingHeaders(token, { json: true }),
          }
        )

        const payload = await parseApiResponse(response, 'Failed to mark conversation as read.')

        const messageIds = (payload.messageIds || payload.message_ids || [])
          .map((messageId) => messageId?.toString?.() || '')
          .filter(Boolean)

        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === normalizedCounterpartyId
              ? {
                ...conversation,
                unreadCount: 0,
              }
              : conversation
          )
        )

        if (
          activeType === 'private' &&
          (activeConversationRef.current || activeConversationId) === normalizedCounterpartyId &&
          messageIds.length
        ) {
          setMessages((current) => markMessagesRead(current, messageIds))
        }

        setError('')
        return payload
      } catch (err) {
        console.error('MARK CONVERSATION READ ERROR:', err)
        setError(err.message || 'Failed to mark conversation as read.')
        throw err
      }
    },
    [token, activeType, activeConversationId]
  )

  const markRoomMessagesRead = useCallback(
    async (roomId) => {
      const normalizedRoomId = roomId?.toString?.().trim() || ''

      if (!normalizedRoomId) {
        return { messageIds: [], isRead: true, unreadCount: 0 }
      }

      try {
        const response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/rooms/${normalizedRoomId}/read`,
          {
            method: 'PATCH',
            headers: buildMessagingHeaders(token, { json: true }),
          }
        )

        const payload = await parseApiResponse(response, 'Failed to mark room messages as read.')

        const messageIds = (payload.messageIds || payload.message_ids || [])
          .map((messageId) => messageId?.toString?.() || '')
          .filter(Boolean)

        setRooms((current) =>
          current.map((room) =>
            room.id === normalizedRoomId
              ? {
                ...room,
                unreadCount: 0,
              }
              : room
          )
        )

        if (
          activeType === 'group' &&
          (activeRoomRef.current || activeRoomId) === normalizedRoomId &&
          messageIds.length
        ) {
          setMessages((current) => markMessagesRead(current, messageIds))
        }

        setError('')
        return payload
      } catch (err) {
        console.error('MARK ROOM READ ERROR:', err)
        setError(err.message || 'Failed to mark room messages as read.')
        throw err
      }
    },
    [token, activeType, activeRoomId]
  )

  const toggleThreadReadState = useCallback(
    async (item) => {
      if (!item?.id || item.isSearchResult) return

      const shouldMarkRead = Number(item.unreadCount || 0) > 0

      const endpoint =
        item.type === 'group'
          ? `${MESSAGING_API_BASE}/api/messages/rooms/${item.id}/read-state`
          : `${MESSAGING_API_BASE}/api/messages/conversations/${item.id}/read-state`

      try {
        const response = await fetch(endpoint, {
          method: 'PATCH',
          headers: buildMessagingHeaders(token, { json: true }),
          body: JSON.stringify({
            isRead: shouldMarkRead,
          }),
        })

        const payload = await parseApiResponse(response, 'Failed to update read state.')

        const messageIds = (payload.messageIds || [])
          .map((messageId) => messageId?.toString?.() || '')
          .filter(Boolean)

        const nextUnreadCount = Number(payload.unreadCount || 0)

        if (item.type === 'group') {
          setRooms((current) =>
            current.map((room) =>
              room.id === item.id
                ? {
                  ...room,
                  unreadCount: nextUnreadCount,
                }
                : room
            )
          )
        } else {
          setConversations((current) =>
            current.map((conversation) =>
              conversation.id === item.id
                ? {
                  ...conversation,
                  unreadCount: nextUnreadCount,
                }
                : conversation
            )
          )
        }

        if (messageIds.length) {
          setMessages((current) =>
            shouldMarkRead
              ? markMessagesRead(current, messageIds)
              : markMessagesUnread(current, messageIds)
          )
        }

        setError('')
      } catch (err) {
        setError(err.message || 'Failed to update read state.')
      }
    },
    [token]
  )

  const fetchArchivedThreads = useCallback(async () => {
    try {
      setLoadingArchived(true)

      const response = await fetch(`${MESSAGING_API_BASE}/api/messages/archived`, {
        headers: buildMessagingHeaders(token),
      })

      const payload = await parseApiResponse(response, 'Failed to load archived threads.')
      const items = (payload.items || []).map(normalizeArchivedThread)

      setArchivedItems(items)
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load archived threads.')
    } finally {
      setLoadingArchived(false)
    }
  }, [token])

  const openArchivedThreads = useCallback(() => {
    setMainView('archived')
    setArchivedOpen(true)
    setCreateGroupOpen(false)
    setAddMembersOpen(false)
    setGroupInfoOpen(false)
    fetchArchivedThreads()
  }, [fetchArchivedThreads])

  const archiveThread = useCallback(
    async (item) => {
      if (!item?.id || item.isSearchResult) return

      const endpoint =
        item.type === 'group'
          ? `${MESSAGING_API_BASE}/api/messages/rooms/${item.id}/archive`
          : `${MESSAGING_API_BASE}/api/messages/conversations/${item.id}/archive`

      try {
        setArchiveThreadBusy(true)

        const response = await fetch(endpoint, {
          method: 'PATCH',
          headers: buildMessagingHeaders(token, { json: true }),
        })

        await parseApiResponse(response, 'Failed to archive thread.')

        if (item.type === 'group') {
          setRooms((current) => current.filter((room) => room.id !== item.id))

          if (activeType === 'group' && activeRoomId === item.id) {
            setActiveRoomId('')
            setMessages([])
          }
        } else {
          setConversations((current) =>
            current.filter((conversation) => conversation.id !== item.id)
          )

          if (activeType === 'private' && activeConversationId === item.id) {
            setActiveConversationId('')
            setMessages([])
          }
        }

        await Promise.all([fetchConversations(), fetchRooms()])

        if (archivedOpen) {
          await fetchArchivedThreads()
        }

        setPendingArchiveThread(null)
        setError('')
      } catch (err) {
        setError(err.message || 'Failed to archive thread.')
      } finally {
        setArchiveThreadBusy(false)
      }
    },
    [
      token,
      activeType,
      activeRoomId,
      activeConversationId,
      archivedOpen,
      fetchConversations,
      fetchRooms,
      fetchArchivedThreads,
    ]
  )

  const restoreArchivedThread = useCallback(
    async (item) => {
      if (!item?.id) return

      const itemKey = `${item.type}-${item.id}`

      const endpoint =
        item.type === 'group'
          ? `${MESSAGING_API_BASE}/api/messages/rooms/${item.id}/restore`
          : `${MESSAGING_API_BASE}/api/messages/conversations/${item.id}/restore`

      try {
        setRestoringArchiveId(itemKey)

        const response = await fetch(endpoint, {
          method: 'PATCH',
          headers: buildMessagingHeaders(token, { json: true }),
        })

        await parseApiResponse(response, 'Failed to restore archived thread.')

        setArchivedItems((current) =>
          current.filter((archivedItem) => `${archivedItem.type}-${archivedItem.id}` !== itemKey)
        )

        await Promise.all([fetchConversations(), fetchRooms()])

        if (archivedOpen) {
          await fetchArchivedThreads()
        }

        setError('')
      } catch (err) {
        setError(err.message || 'Failed to restore archived thread.')
      } finally {
        setRestoringArchiveId('')
      }
    },
    [
      token,
      archivedOpen,
      fetchConversations,
      fetchRooms,
      fetchArchivedThreads,
    ]
  )

  async function handleSendMessage(event) {
    event.preventDefault()

    const messageBody = draft.trim()
    if (!messageBody) return

    if (activeType === 'private' && selectedItem?.isDisabled) {
      setError('This account is currently disabled. You can view previous messages, but you cannot send new messages to this account.')
      return
    }

    shouldAutoScrollRef.current = true
    setSending(true)

    try {
      let response

      if (activeType === 'group' && activeRoomId) {
        response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/rooms/${activeRoomId}/messages`,
          {
            method: 'POST',
            headers: buildMessagingHeaders(token, { json: true }),
            body: JSON.stringify({ messageBody }),
          }
        )
      } else if (activeConversationId) {
        response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/conversations/${activeConversationId}`,
          {
            method: 'POST',
            headers: buildMessagingHeaders(token, { json: true }),
            body: JSON.stringify({ messageBody }),
          }
        )
      } else {
        setSending(false)
        return
      }

      const payload = await parseApiResponse(response, 'Failed to send message.')
      const message = normalizeMessage(payload)

      setMessages((current) => upsertMessage(current, message))

      if (activeType === 'group') {
        setRooms((current) =>
          sortItems(
            current.map((item) =>
              item.id === activeRoomId
                ? {
                  ...item,
                  lastMessage: message.messageBody,
                  lastSentAt: message.sentAt,
                }
                : item
            )
          )
        )
      } else {
        setConversations((current) => {
          const exists = current.some((item) => item.id === activeConversationId)

          if (!exists) {
            return sortItems([
              ...current,
              {
                id: activeConversationId,
                type: 'private',
                name: selectedItem?.name || 'Unknown user',
                studentNumber: selectedItem?.studentNumber || '',
                avatarUrl: selectedItem?.avatarUrl || '',
                lastMessage: message.messageBody,
                lastSentAt: message.sentAt,
                createdAt: message.sentAt,
                unreadCount: 0,
                isDisabled: selectedItem?.isDisabled === true,
              },
            ])
          }

          return sortItems(
            current.map((item) =>
              item.id === activeConversationId
                ? {
                  ...item,
                  lastMessage: message.messageBody,
                  lastSentAt: message.sentAt,
                }
                : item
            )
          )
        })
      }

      if (activeType === 'private') {
        setTransientPrivateContact(null)
      }
      setDraft('')
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  async function handleCreateGroup(payload) {
    try {
      setCreatingGroup(true)

      const response = await fetch(`${MESSAGING_API_BASE}/api/messages/rooms`, {
        method: 'POST',
        headers: buildMessagingHeaders(token, { json: true }),
        body: JSON.stringify(payload),
      })

      const createdRoom = await parseApiResponse(response, 'Failed to create group chat.')

      setCreateGroupOpen(false)
      setMainView('chats')
      await fetchRooms(createdRoom.room_id?.toString?.() || createdRoom.room_id || '')
    } catch (err) {
      setError(err.message || 'Failed to create group chat.')
    } finally {
      setCreatingGroup(false)
    }
  }

  async function handleAddMembers(memberIds) {
    if (!activeRoomId || !memberIds.length) return

    try {
      setAddingMembers(true)

      const response = await fetch(`${MESSAGING_API_BASE}/api/messages/rooms/${activeRoomId}/members`, {
        method: 'POST',
        headers: buildMessagingHeaders(token, { json: true }),
        body: JSON.stringify({ memberIds }),
      })

      const memberPayload = await parseApiResponse(response, 'Failed to add members to group chat.')
      const refreshedMembers = (memberPayload.members || memberPayload.roomMembers || []).map(normalizeRoomMember)
      const refreshedCount = Number(memberPayload.member_count ?? memberPayload.memberCount ?? refreshedMembers.length)

      if (Array.isArray(memberPayload.members) || Array.isArray(memberPayload.roomMembers)) {
        setGroupMembers(refreshedMembers)
      }
      setRooms((current) => current.map((room) =>
        room.id === activeRoomId
          ? {
              ...room,
              memberCount: refreshedCount,
              studentNumber: `${refreshedCount} member${refreshedCount === 1 ? '' : 's'}`,
            }
          : room
      ))

      setAddMembersOpen(false)
      setMainView('chats')
      setGroupInfoOpen(true)
      setError('')
      await Promise.all([fetchRooms(activeRoomId), fetchRoomMembers(activeRoomId)])
    } catch (err) {
      setError(err.message || 'Failed to add members to group chat.')
    } finally {
      setAddingMembers(false)
    }
  }

  async function handlePromoteMember(member) {
    if (!activeRoomId || !member?.userId) return

    try {
      setPromoteMemberBusy(true)
      const response = await fetch(
        `${MESSAGING_API_BASE}/api/messages/rooms/${activeRoomId}/members`,
        {
          method: 'POST',
          headers: buildMessagingHeaders(token, { json: true }),
          body: JSON.stringify({ action: 'promote_admin', memberId: member.userId }),
        }
      )
      const memberPayload = await parseApiResponse(response, 'Failed to make member a group admin.')
      const refreshedMembers = (memberPayload.members || memberPayload.roomMembers || []).map(normalizeRoomMember)
      const refreshedCount = Number(memberPayload.member_count ?? memberPayload.memberCount ?? refreshedMembers.length)

      if (Array.isArray(memberPayload.members) || Array.isArray(memberPayload.roomMembers)) {
        setGroupMembers(refreshedMembers)
      }
      setRooms((current) => current.map((room) =>
        room.id === activeRoomId
          ? {
              ...room,
              memberCount: refreshedCount,
              studentNumber: `${refreshedCount} member${refreshedCount === 1 ? '' : 's'}`,
            }
          : room
      ))
      setPendingPromoteMember(null)
      await Promise.all([fetchRoomMembers(activeRoomId), fetchRooms(activeRoomId)])
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to make member a group admin.')
    } finally {
      setPromoteMemberBusy(false)
    }
  }

  async function handleRemoveMember(member) {
    if (!activeRoomId || !member?.userId) return

    try {
      setRemoveMemberBusy(true)
      const response = await fetch(
        `${MESSAGING_API_BASE}/api/messages/rooms/${activeRoomId}/members`,
        {
          method: 'POST',
          headers: buildMessagingHeaders(token, { json: true }),
          body: JSON.stringify({ action: 'remove', memberId: member.userId }),
        }
      )
      const memberPayload = await parseApiResponse(response, 'Failed to remove group member.')
      const refreshedMembers = (memberPayload.members || memberPayload.roomMembers || []).map(normalizeRoomMember)
      const refreshedCount = Number(memberPayload.member_count ?? memberPayload.memberCount ?? refreshedMembers.length)
      if (Array.isArray(memberPayload.members) || Array.isArray(memberPayload.roomMembers)) {
        setGroupMembers(refreshedMembers)
      }
      setRooms((current) => current.map((room) =>
        room.id === activeRoomId
          ? {
              ...room,
              memberCount: refreshedCount,
              studentNumber: `${refreshedCount} member${refreshedCount === 1 ? '' : 's'}`,
            }
          : room
      ))
      setPendingRemoveMember(null)
      await Promise.all([fetchRoomMembers(activeRoomId), fetchRooms(activeRoomId)])
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to remove group member.')
    } finally {
      setRemoveMemberBusy(false)
    }
  }

  async function handleLeaveGroup() {
    if (!activeRoomId) return

    try {
      setLeaveGroupBusy(true)
      const leavingRoomId = activeRoomId
      const response = await fetch(`${MESSAGING_API_BASE}/api/messages/rooms/${leavingRoomId}/members`, {
        method: 'POST',
        headers: buildMessagingHeaders(token, { json: true }),
        body: JSON.stringify({ action: 'leave' }),
      })
      await parseApiResponse(response, 'Failed to leave group.')
      setLeaveGroupOpen(false)
      setGroupInfoOpen(false)
      setGroupMembers([])
      setActiveRoomId('')
      setMessages([])
      setRooms((current) => current.filter((room) => room.id !== leavingRoomId))
      await Promise.all([fetchRooms(''), fetchConversations()])
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to leave group.')
    } finally {
      setLeaveGroupBusy(false)
    }
  }

  function handleMessageMember(member) {
    if (!member?.userId || member.userId === currentUserId) return
    setSelectedMemberProfile(null)
    setGroupInfoOpen(false)
    setChatSearchOpen(false)
    setChatSearchTerm('')
    if (isAdminMessaging) setCompactPane('thread')
    setActiveType('private')
    setActiveConversationId(member.userId)
    setActiveRoomId('')

    const existingConversation = conversations.find((item) => item.id === member.userId)
    setTransientPrivateContact(
      existingConversation
        ? null
        : {
            id: member.userId,
            type: 'private',
            name: member.name || 'Unknown user',
            studentNumber: member.studentNumber || member.subtitle || '',
            avatarUrl: member.avatarUrl || '',
            lastMessage: '',
            lastSentAt: '',
            createdAt: '',
            unreadCount: 0,
            isDisabled: false,
            isTransient: true,
          }
    )
  }

  useEffect(() => {
    if (groupInfoOpen && activeType === 'group' && activeRoomId) {
      fetchRoomMembers(activeRoomId)
    }
  }, [groupInfoOpen, activeType, activeRoomId, fetchRoomMembers])

  useEffect(() => {
    setChatSearchOpen(false)
    setChatSearchTerm('')
    setGroupInfoOpen(false)
    setGroupMembers([])
  }, [activeType, activeConversationId, activeRoomId])

  useEffect(() => {
    if (!token || !currentUserId) {
      if (isOpen) {
        setError('Your user session is required to open messaging.')
      }
      setLoadingConversations(false)
      return
    }

    fetchConversations()
    fetchRooms()
  }, [isOpen, token, currentUserId, fetchConversations, fetchRooms])

  useEffect(() => {
    if (isOpen) {
      fetchScholarMembers()
    }
  }, [isOpen, fetchScholarMembers])

  useEffect(() => {
    if ((createRoomOpen || addMembersOpen) && !scholars.length) {
      fetchScholarMembers()
    }
  }, [createRoomOpen, addMembersOpen, scholars.length, fetchScholarMembers])

  useEffect(() => {
    if (!isOpen) return

    if (!activeConversationId && !activeRoomId && filteredItems.length) {
      const firstItem = filteredItems[0]

      if (firstItem.type === 'group') {
        setActiveType('group')
        setActiveRoomId(firstItem.id)
        setActiveConversationId('')
      } else {
        setActiveType('private')
        setActiveConversationId(firstItem.id)
        setActiveRoomId('')
      }
    }
  }, [isOpen, activeConversationId, activeRoomId, filteredItems])

  useEffect(() => {
    if (!isOpen) return

    if (activeType === 'group') {
      if (!activeRoomId) {
        setMessages([])
        return
      }

      fetchRoomMessages(activeRoomId)
      return
    }

    if (!activeConversationId) {
      setMessages([])
      return
    }

    fetchConversationMessages(activeConversationId)
  }, [
    isOpen,
    activeType,
    activeConversationId,
    activeRoomId,
    fetchConversationMessages,
    fetchRoomMessages,
  ])

  useEffect(() => {
    if (!isOpen) return undefined

    const syncOpenThread = () => {
      if (document.visibilityState !== 'visible') return

      if (activeType === 'group' && activeRoomId) {
        fetchRoomMessages(activeRoomId, { silent: true })
        return
      }

      if (activeType === 'private' && activeConversationId) {
        fetchConversationMessages(activeConversationId, { silent: true })
      }
    }

    const intervalId = window.setInterval(syncOpenThread, 2000)
    window.addEventListener('focus', syncOpenThread)
    document.addEventListener('visibilitychange', syncOpenThread)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', syncOpenThread)
      document.removeEventListener('visibilitychange', syncOpenThread)
    }
  }, [
    isOpen,
    activeType,
    activeConversationId,
    activeRoomId,
    fetchConversationMessages,
    fetchRoomMessages,
  ])

  useEffect(() => {
    if (!selectedItem && filteredItems.length) {
      const firstItem = filteredItems[0]

      if (firstItem.type === 'group') {
        setActiveType('group')
        setActiveRoomId(firstItem.id)
        setActiveConversationId('')
      } else {
        setActiveType('private')
        setActiveConversationId(firstItem.id)
        setActiveRoomId('')
      }
    }

    if (!filteredItems.length && searchTerm) {
      setMessages([])
    }
  }, [filteredItems, selectedItem, searchTerm])

  const handleIncomingMessageRealtime = useCallback(
    async (rawPayload = {}, eventName = 'message:created') => {
      const message = normalizeMessage(rawPayload)

      const messageId = message.messageId || ''
      const senderId = message.senderId || ''
      const receiverId = message.receiverId || ''
      const roomId = message.roomId || ''

      if (messageId) {
        const processedIds = processedRealtimeMessageIdsRef.current
        if (processedIds.has(messageId)) return

        processedIds.add(messageId)
        if (processedIds.size > 500) {
          const newestIds = [...processedIds].slice(-250)
          processedRealtimeMessageIdsRef.current = new Set(newestIds)
        }
      }

      const activeConversation =
        activeConversationRef.current || activeConversationId || ''

      const activeRoom = activeRoomRef.current || activeRoomId || ''

      if (!messageId) {
        await Promise.all([
          fetchConversations(activeConversation),
          fetchRooms(activeRoom),
        ])
        return
      }

      const isPrivateMessage = !roomId

      const isPrivateForCurrentAdmin =
        isPrivateMessage &&
        currentUserId &&
        (senderId === currentUserId || receiverId === currentUserId)

      const privateCounterpartyId =
        senderId === currentUserId ? receiverId : senderId

      const isActivePrivateThread =
        isOpen &&
        activeType === 'private' &&
        activeConversation &&
        isPrivateForCurrentAdmin &&
        privateCounterpartyId === activeConversation

      const isActiveGroupThread =
        isOpen &&
        activeType === 'group' &&
        roomId &&
        activeRoom &&
        roomId === activeRoom

      /*
        1. Put the new message directly into the open chat.
        This is the realtime part. Do not wait for fetch.
      */
      if (isActivePrivateThread || isActiveGroupThread) {
        setMessages((current) => upsertMessage(current, message))
      }

      /*
        2. Update the private conversation preview/sidebar.
      */
      if (isPrivateForCurrentAdmin && privateCounterpartyId) {
        setConversations((current) => {
          let found = false

          const next = current.map((item) => {
            if (item.id !== privateCounterpartyId) {
              return item
            }

            found = true

            return {
              ...item,
              lastMessage: message.messageBody,
              lastSentAt: message.sentAt,
              unreadCount:
                isActivePrivateThread || senderId === currentUserId
                  ? 0
                  : Number(item.unreadCount || 0) + 1,
            }
          })

          if (!found) {
            next.unshift({
              id: privateCounterpartyId,
              type: 'private',
              name:
                senderId === currentUserId
                  ? 'Contact'
                  : message.senderName || 'New Conversation',
              studentNumber: '',
              lastMessage: message.messageBody,
              lastSentAt: message.sentAt,
              createdAt: message.sentAt,
              avatarUrl: message.senderAvatarUrl || '',
              unreadCount:
                isActivePrivateThread || senderId === currentUserId ? 0 : 1,
            })
          }

          return sortItems(next)
        })
      }

      /*
        3. Update group preview/sidebar.
      */
      if (roomId) {
        setRooms((current) =>
          sortItems(
            current.map((item) =>
              item.id === roomId
                ? {
                  ...item,
                  lastMessage: message.messageBody,
                  lastSentAt: message.sentAt,
                  unreadCount:
                    isActiveGroupThread || senderId === currentUserId
                      ? 0
                      : Number(item.unreadCount || 0) + 1,
                }
                : item
            )
          )
        )
      }

      /*
        4. Silently sync lists with backend after UI updates.
      */
      Promise.all([
        fetchConversations(activeConversation),
        fetchRooms(activeRoom),
      ]).catch((error) => {
        console.error('[Admin Messaging Realtime] silent sync error:', error)
      })

      /*
        5. If the active thread received an incoming message, mark it read.
      */
      if (isActivePrivateThread && senderId !== currentUserId) {
        markConversationRead(activeConversation).catch((error) => {
          console.error('[Admin Messaging Realtime] private read error:', error)
        })
      }

      if (isActiveGroupThread && senderId !== currentUserId) {
        markRoomMessagesRead(activeRoom).catch((error) => {
          console.error('[Admin Messaging Realtime] room read error:', error)
        })
      }
    },
    [
      activeType,
      activeConversationId,
      activeRoomId,
      currentUserId,
      isOpen,
      fetchConversations,
      fetchRooms,
      markConversationRead,
      markRoomMessagesRead,
    ]
  )

  useSocketEvent(
    'maintenance:updated',
    async (data) => {
      if (data?.module && data.module !== 'accounts') return

      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        isOpen ? fetchScholarMembers() : Promise.resolve(),
      ])
    },
    [activeConversationId, fetchConversations, fetchScholarMembers, isOpen]
  )

  useSocketEvent(
    'message:new',
    (data) => {
      handleIncomingMessageRealtime(data, 'message:new')
    },
    [handleIncomingMessageRealtime]
  )

  useSocketEvent(
    'message:created',
    (data) => {
      handleIncomingMessageRealtime(data, 'message:created')
    },
    [handleIncomingMessageRealtime]
  )

  useSocketEvent(
    'message:read',
    async (data) => {
      const messageIds = (data?.message_ids || data?.messageIds || [])
        .map((item) => item?.toString?.() || '')
        .filter(Boolean)

      if (messageIds.length) {
        setMessages((current) => markMessagesRead(current, messageIds))
      }

      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        fetchRooms(activeRoomRef.current || activeRoomId),
      ])
    },
    [
      activeConversationId,
      activeRoomId,
      fetchConversations,
      fetchRooms,
    ]
  )

  useSocketEvent(
    'message:unread',
    async (data) => {
      const messageIds = (data?.message_ids || data?.messageIds || [])
        .map((item) => item?.toString?.() || '')
        .filter(Boolean)

      if (messageIds.length) {
        setMessages((current) => markMessagesUnread(current, messageIds))
      }

      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        fetchRooms(activeRoomRef.current || activeRoomId),
      ])
    },
    [
      activeConversationId,
      activeRoomId,
      fetchConversations,
      fetchRooms,
    ]
  )

  useSocketEvent(
    'conversation:updated',
    async () => {
      await fetchConversations(
        activeConversationRef.current || activeConversationId
      )
    },
    [
      activeConversationId,
      fetchConversations,
    ]
  )

  useSocketEvent(
    'message:thread-archived',
    async () => {
      if (!isOpen && !archivedOpen) return

      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        fetchRooms(activeRoomRef.current || activeRoomId),
      ])

      if (archivedOpen) {
        await fetchArchivedThreads()
      }
    },
    [
      isOpen,
      archivedOpen,
      activeConversationId,
      activeRoomId,
      fetchConversations,
      fetchRooms,
      fetchArchivedThreads,
    ]
  )

  useSocketEvent(
    'message:thread-restored',
    async () => {
      if (!isOpen && !archivedOpen) return

      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        fetchRooms(activeRoomRef.current || activeRoomId),
      ])

      if (archivedOpen) {
        await fetchArchivedThreads()
      }
    },
    [
      isOpen,
      archivedOpen,
      activeConversationId,
      activeRoomId,
      fetchConversations,
      fetchRooms,
      fetchArchivedThreads,
    ]
  )

  useSocketEvent(
    'room:created',
    async (data) => {
      const roomId = data?.room_id?.toString?.() || ''

      await fetchRooms(roomId || activeRoomRef.current || activeRoomId)
    },
    [
      activeRoomId,
      fetchRooms,
    ]
  )

  useSocketEvent(
    'room:members-added',
    async (data) => {
      const roomId = data?.room_id?.toString?.() || ''

      await fetchRooms(activeRoomRef.current || activeRoomId)

      if (
        isOpen &&
        activeType === 'group' &&
        roomId &&
        (activeRoomRef.current === roomId || activeRoomId === roomId)
      ) {
        await fetchRoomMessages(roomId)
        if (groupInfoOpen) await fetchRoomMembers(roomId)
      }
    },
    [
      isOpen,
      activeType,
      activeRoomId,
      groupInfoOpen,
      fetchRooms,
      fetchRoomMessages,
      fetchRoomMembers,
    ]
  )

  useSocketEvent(
    'room:member-promoted',
    async (data) => {
      const roomId = data?.room_id?.toString?.() || data?.roomId?.toString?.() || ''

      await fetchRooms(activeRoomRef.current || activeRoomId)

      if (
        isOpen &&
        activeType === 'group' &&
        roomId &&
        (activeRoomRef.current === roomId || activeRoomId === roomId)
      ) {
        await fetchRoomMessages(roomId, { silent: true })
        if (groupInfoOpen) await fetchRoomMembers(roomId)
      }
    },
    [
      isOpen,
      activeType,
      activeRoomId,
      groupInfoOpen,
      fetchRooms,
      fetchRoomMessages,
      fetchRoomMembers,
    ]
  )

  useSocketEvent(
    'room:members-removed',
    async (data) => {
      const roomId = data?.room_id?.toString?.() || data?.roomId?.toString?.() || ''
      const memberId = data?.member_id?.toString?.() || data?.memberId?.toString?.() || ''

      await fetchRooms(activeRoomRef.current || activeRoomId)

      if (roomId && (activeRoomRef.current === roomId || activeRoomId === roomId)) {
        if (memberId === currentUserId) {
          setGroupInfoOpen(false)
          setGroupMembers([])
          setActiveRoomId('')
          setMessages([])
        } else if (groupInfoOpen) {
          await fetchRoomMembers(roomId)
        }
      }
    },
    [
      activeRoomId,
      currentUserId,
      groupInfoOpen,
      fetchRooms,
      fetchRoomMembers,
    ]
  )

  useSocketEvent(
    'room:member-left',
    async (data) => {
      const roomId = data?.room_id?.toString?.() || data?.roomId?.toString?.() || ''
      const userId = data?.user_id?.toString?.() || data?.userId?.toString?.() || ''

      await fetchRooms(activeRoomRef.current || activeRoomId)

      if (roomId && (activeRoomRef.current === roomId || activeRoomId === roomId)) {
        if (userId === currentUserId) {
          setGroupInfoOpen(false)
          setGroupMembers([])
          setActiveRoomId('')
          setMessages([])
        } else if (groupInfoOpen) {
          await fetchRoomMembers(roomId)
        }
      }
    },
    [
      activeRoomId,
      currentUserId,
      groupInfoOpen,
      fetchRooms,
      fetchRoomMembers,
    ]
  )

  useSocketEvent(
    'room:updated',
    async (data) => {
      const roomId = data?.room_id?.toString?.() || ''

      await fetchRooms(activeRoomRef.current || activeRoomId)

      if (
        isOpen &&
        activeType === 'group' &&
        roomId &&
        (activeRoomRef.current === roomId || activeRoomId === roomId)
      ) {
        await fetchRoomMessages(roomId)
      }
    },
    [
      isOpen,
      activeType,
      activeRoomId,
      fetchRooms,
      fetchRoomMessages,
    ]
  )

  useSocketEvent(
    'room:archived',
    async () => {
      await fetchRooms(activeRoomRef.current || activeRoomId)

      if (archivedOpen) {
        await fetchArchivedThreads()
      }
    },
    [
      activeRoomId,
      archivedOpen,
      fetchRooms,
      fetchArchivedThreads,
    ]
  )

  useSocketEvent(
    'room:restored',
    async () => {
      await fetchRooms(activeRoomRef.current || activeRoomId)

      if (archivedOpen) {
        await fetchArchivedThreads()
      }
    },
    [
      activeRoomId,
      archivedOpen,
      fetchRooms,
      fetchArchivedThreads,
    ]
  )

  const renderGroupInfo = ({ embedded = false } = {}) => (
    <GroupInfoModal
      open={groupInfoOpen}
      room={selectedItem?.type === 'group' ? selectedItem : null}
      members={groupMembers}
      loading={loadingGroupMembers}
      currentUserId={currentUserId}
      onClose={() => setGroupInfoOpen(false)}
      searchTerm={chatSearchTerm}
      matchCount={chatMatchCount}
      onSearchChange={(value) => {
        setChatSearchTerm(value)
        setChatSearchOpen(Boolean(value.trim()))
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
  )

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMainView('chats')
          setArchivedOpen(false)
          setCreateGroupOpen(false)
          setAddMembersOpen(false)
          setGroupInfoOpen(false)
          if (isAdminMessaging) setCompactPane('list')
          setIsOpen(true)
        }}
        className={`fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--portal-base)] text-white shadow-xl transition hover:brightness-95 ${totalUnreadCount > 0 ? 'ring-4 ring-red-200' : ''
          }`}
        title={totalUnreadCount > 0 ? `${totalUnreadCount} unread message(s)` : 'Messages'}
      >
        <MessageSquareMore className="h-6 w-6" />

        {totalUnreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold leading-none text-white shadow-md">
            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
          </span>
        )}
      </button>

      <MemberProfileModal
        member={selectedMemberProfile}
        onClose={() => setSelectedMemberProfile(null)}
        onMessage={handleMessageMember}
      />

      <ConfirmActionModal
        open={Boolean(pendingArchiveThread)}
        title="Archive conversation?"
        description={pendingArchiveThread ? `"${pendingArchiveThread.name}" will move to Archived Messages. If you are still a participant, a new message will bring it back automatically.` : ''}
        confirmLabel="Archive"
        busy={archiveThreadBusy}
        variant="primary"
        onCancel={() => { if (!archiveThreadBusy) setPendingArchiveThread(null) }}
        onConfirm={() => archiveThread(pendingArchiveThread)}
      />

      <ConfirmActionModal
        open={Boolean(pendingRemoveMember)}
        title="Remove member?"
        description={pendingRemoveMember ? `${pendingRemoveMember.name} will lose access to this group and its future messages.` : ''}
        confirmLabel="Remove"
        busy={removeMemberBusy}
        onCancel={() => setPendingRemoveMember(null)}
        onConfirm={() => handleRemoveMember(pendingRemoveMember)}
      />

      <ConfirmActionModal
        open={Boolean(pendingPromoteMember)}
        title="Make group admin?"
        description={pendingPromoteMember ? `${pendingPromoteMember.name} will be able to add members, remove regular members, and promote other members to group admin.` : ''}
        confirmLabel="Make admin"
        busy={promoteMemberBusy}
        variant="primary"
        onCancel={() => setPendingPromoteMember(null)}
        onConfirm={() => handlePromoteMember(pendingPromoteMember)}
      />

      <ConfirmActionModal
        open={leaveGroupOpen}
        title="Leave group?"
        description="You will be removed from this group and it will move to your personal Archived Messages. You will no longer receive new group messages. If you are the group admin, management will transfer to the oldest remaining member."
        confirmLabel="Leave group"
        busy={leaveGroupBusy}
        onCancel={() => setLeaveGroupOpen(false)}
        onConfirm={handleLeaveGroup}
      />

      {isOpen && (
        <div
          className={isAdminMessaging
            ? 'fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 p-0 sm:p-3 md:p-5 lg:items-center lg:p-6'
            : 'fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-4 sm:p-6'}
        >
          <div
            className={isAdminMessaging
              ? 'flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[calc(100dvh-24px)] sm:rounded-[24px] sm:border sm:border-stone-200 md:h-[calc(100dvh-40px)] lg:h-[92dvh] lg:max-h-[860px] lg:max-w-6xl'
              : 'flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-2xl'}
          >
            <div
              className={isAdminMessaging
                ? 'flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-3 py-3 sm:px-4 lg:px-5'
                : 'flex items-center justify-between border-b border-stone-100 px-4 py-3 sm:px-5'}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--portal-accent-soft)] text-[var(--portal-base)]">
                  <MessageSquareMore className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-base font-semibold text-stone-900">Messages</div>
                  <div className="text-xs text-stone-500">{isAdminMessaging ? 'Admin inbox' : 'Private and group conversations'}</div>
                </div>
              </div>

              <div className={isAdminMessaging ? 'flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2' : 'flex items-center gap-2'}>
                <button
                  type="button"
                  onClick={openArchivedThreads}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${mainView === 'archived' ? 'border-[var(--portal-base)] bg-[var(--portal-accent-soft)] text-[var(--portal-base)]' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}
                >
                  <Archive className="h-4 w-4" />
                  <span className={isAdminMessaging ? 'hidden sm:inline' : ''}>Archived</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMainView('create-group')
                    setCreateGroupOpen(true)
                    setArchivedOpen(false)
                    setAddMembersOpen(false)
                    setGroupInfoOpen(false)
                  }}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${mainView === 'create-group' ? 'border-[var(--portal-base)] bg-[var(--portal-accent-soft)] text-[var(--portal-base)]' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}
                >
                  <Users className="h-4 w-4" />
                  <span className={isAdminMessaging ? 'hidden sm:inline' : ''}>Group</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchConversations(activeConversationId)
                    fetchRooms(activeRoomId)
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => { setIsOpen(false); setMainView('chats'); setArchivedOpen(false); setCreateGroupOpen(false); setAddMembersOpen(false); setGroupInfoOpen(false); setTransientPrivateContact(null); if (isAdminMessaging) setCompactPane('list') }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {error && (
              <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-5">
                {error}
              </div>
            )}

            {mainView === 'archived' ? (
              <ArchivedThreadsModal
                open={archivedOpen}
                onClose={() => { setArchivedOpen(false); setMainView('chats') }}
                items={archivedItems}
                loading={loadingArchived}
                restoringId={restoringArchiveId}
                onRestore={restoreArchivedThread}
                onRefresh={fetchArchivedThreads}
              />
            ) : mainView === 'create-group' ? (
              <CreateGroupModal
                open={createRoomOpen}
                onClose={() => { setCreateGroupOpen(false); setMainView('chats') }}
                onCreate={handleCreateGroup}
                creating={creatingGroup}
                scholars={scholars}
                loadingScholars={loadingScholars}
                currentUserId={currentUserId}
              />
            ) : mainView === 'add-members' ? (
              <AddMembersView
                open={addMembersOpen}
                onClose={() => {
                  setAddMembersOpen(false)
                  setMainView('chats')
                  setGroupInfoOpen(true)
                }}
                onAdd={handleAddMembers}
                adding={addingMembers}
                scholars={scholars}
                loadingScholars={loadingScholars}
                existingMemberIds={groupMembers.map((member) => member.userId)}
              />
            ) : (
            <div
              className={isAdminMessaging
                ? 'grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[300px_minmax(0,1fr)]'
                : `grid min-h-0 flex-1 gap-0 ${groupInfoOpen && selectedItem?.type === 'group' ? 'xl:grid-cols-[320px_minmax(0,1fr)_320px]' : 'xl:grid-cols-[340px_minmax(0,1fr)]'}`}
            >
              <section
                className={isAdminMessaging
                  ? `${compactPane === 'thread' ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-r border-stone-200 bg-stone-50/40`
                  : 'flex min-h-0 flex-col border-b border-stone-200 xl:border-b-0 xl:border-r'}
              >
                <div className={isAdminMessaging ? 'space-y-3 border-b border-stone-100 bg-white px-3 py-3.5 sm:px-4' : 'space-y-3 border-b border-stone-100 px-4 py-4'}>
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-stone-900">{isAdminMessaging ? 'Inbox' : 'Chats'}</p>
                    <p className="text-xs text-stone-400">{filteredItems.length}</p>
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder={isAdminMessaging ? 'Search people or conversations' : 'Search conversations'}
                      className={isAdminMessaging
                        ? 'h-10 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-sm text-stone-800 outline-none transition focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]'
                        : 'h-10 w-full rounded-full border-0 bg-stone-100 pl-10 pr-4 text-sm text-stone-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-[var(--portal-accent-soft)]'}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setShowUnreadOnly((current) => !current)}
                      className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${showUnreadOnly
                        ? 'border-[var(--portal-base)] bg-[var(--portal-accent-soft)] text-[var(--portal-base)]'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      Unread only
                    </button>

                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {loadingConversations ? (
                    <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-stone-500">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading threads
                    </div>
                  ) : filteredItems.length ? (
                    filteredItems.map((item) => {
                      const isActive =
                        item.type === 'group'
                          ? activeType === 'group' && item.id === activeRoomId
                          : activeType === 'private' && item.id === activeConversationId

                      return (
                        <ThreadRow
                          key={`${item.type}-${item.id}`}
                          item={item}
                          isActive={isActive}
                          onToggleRead={toggleThreadReadState}
                          onArchive={setPendingArchiveThread}
                          inboxStyle={isAdminMessaging}
                          onClick={() => {
                            setTransientPrivateContact(null)
                            if (item.type === 'group') {
                              setActiveType('group')
                              setActiveRoomId(item.id)
                              setActiveConversationId('')
                            } else {
                              setActiveType('private')
                              setActiveConversationId(item.id)
                              setActiveRoomId('')
                            }

                            if (isAdminMessaging) setCompactPane('thread')

                            if (Number(item.unreadCount || 0) > 0) {
                              toggleThreadReadState(item)
                            }
                          }}
                        />
                      )
                    })
                  ) : (
                    <div className="px-6 py-14 text-center text-sm text-stone-500">
                      {searchTerm || showUnreadOnly
                        ? 'No threads match the current filter.'
                        : 'No messages or rooms yet.'}
                    </div>
                  )}
                </div>
              </section>

              <section
                className={isAdminMessaging
                  ? `${compactPane === 'thread' ? 'flex' : 'hidden md:flex'} min-h-0 flex-col bg-white`
                  : 'flex min-h-0 flex-col bg-white'}
              >
                {isAdminMessaging && groupInfoOpen && selectedItem?.type === 'group' ? (
                  renderGroupInfo({ embedded: true })
                ) : selectedItem ? (
                  <>
                    <div className={isAdminMessaging ? 'border-b border-stone-100 bg-white px-3 py-3 sm:px-4 lg:px-5' : 'border-b border-stone-100 bg-white px-5 py-3.5'}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {isAdminMessaging ? (
                            <button
                              type="button"
                              onClick={() => setCompactPane('list')}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50 md:hidden"
                              title="Back to inbox"
                              aria-label="Back to inbox"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </button>
                          ) : null}
                          <ThreadIcon item={selectedItem} />
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-semibold text-stone-900">{selectedItem.name}</p>
                              {selectedItem.type === 'private' && selectedItem.isDisabled ? (
                                <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-stone-600">Account Disabled</span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs text-stone-500">
                              {selectedItem.type === 'group'
                                ? 'Group chat'
                                : selectedItem.studentNumber || 'Private conversation'}
                            </p>
                          </div>
                        </div>

                        {selectedItem.type === 'group' ? (
                          <button
                            type="button"
                            onClick={() => setGroupInfoOpen((current) => !current)}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
                            title="Group information"
                            aria-label="Group information"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>

                      {selectedItem.type === 'group' && chatSearchOpen && !groupInfoOpen ? (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                            <input
                              autoFocus
                              value={chatSearchTerm}
                              onChange={(event) => setChatSearchTerm(event.target.value)}
                              placeholder="Search this conversation"
                              className="h-9 w-full rounded-xl border border-stone-200 pl-9 pr-3 text-xs outline-none focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
                            />
                          </div>
                          <span className="shrink-0 text-xs text-stone-500">
                            {chatSearchTerm.trim() ? `${chatMatchCount} match${chatMatchCount === 1 ? '' : 'es'}` : ''}
                          </span>
                          <button type="button" onClick={() => { setChatSearchOpen(false); setChatSearchTerm('') }} className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"><X className="h-4 w-4" /></button>
                        </div>
                      ) : null}
                    </div>

                    <div
                      ref={messagesScrollRef}
                      onScroll={handleMessagesScroll}
                      className={isAdminMessaging
                        ? 'min-h-0 flex-1 overflow-y-auto bg-stone-50 px-3 py-4 sm:px-5 sm:py-5 lg:px-6'
                        : 'min-h-0 flex-1 overflow-y-auto bg-[#f7f7f7] px-5 py-5'}
                    >
                      {loadingMessages ? (
                        <div className="flex h-full items-center justify-center gap-2 py-12 text-sm text-stone-500">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Loading thread
                        </div>
                      ) : messages.length ? (
                        <div className="flex min-h-full flex-col justify-end">
                          {messages.map((message, index) => {
                            const isMine = message.senderId === currentUserId
                            const previousMessage = index > 0 ? messages[index - 1] : null
                            const nextMessage = index + 1 < messages.length ? messages[index + 1] : null
                            const groupedWithPrevious = messagesBelongTogether(previousMessage, message)
                            const groupedWithNext = messagesBelongTogether(message, nextMessage)
                            const showDateDivider = !previousMessage || messageDayKey(previousMessage.sentAt) !== messageDayKey(message.sentAt)

                            return (
                              <div key={message.messageId}>
                                {showDateDivider ? <MessageDateDivider value={message.sentAt} /> : null}
                                <MessageBubble
                                  message={message}
                                  isMine={isMine}
                                  isGroup={selectedItem.type === 'group'}
                                  searchTerm={selectedItem.type === 'group' ? chatSearchTerm : ''}
                                  groupedWithPrevious={groupedWithPrevious}
                                  groupedWithNext={groupedWithNext}
                                  showSenderName={!groupedWithPrevious}
                                  showAvatar={!groupedWithPrevious}
                                />
                              </div>
                            )
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-stone-500">
                          No messages in this thread yet.
                        </div>
                      )}
                    </div>

                    {selectedItem.type === 'private' && selectedItem.isDisabled ? (
                      <div className="border-t border-stone-200 bg-stone-50 px-5 py-4">
                        <p className="text-sm font-semibold text-stone-800">This account is currently disabled.</p>
                        <p className="mt-1 text-xs text-stone-500">
                          Previous messages remain available, but new messages cannot be sent to this account.
                        </p>
                      </div>
                    ) : (
                    <form
                      onSubmit={handleSendMessage}
                      className={isAdminMessaging
                        ? 'border-t border-stone-100 bg-white px-3 py-3 sm:px-4'
                        : 'border-t border-stone-100 bg-white px-4 py-3'}
                    >
                      <div className="flex items-end gap-2">
                        <textarea
                          ref={composerRef}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' || event.nativeEvent?.isComposing) return

                            // Shift + Enter keeps the textarea's normal newline behavior.
                            if (event.shiftKey) return

                            // Enter sends the current message instead of adding a newline.
                            event.preventDefault()
                            if (!sending && draft.trim()) {
                              event.currentTarget.form?.requestSubmit()
                            }
                          }}
                          rows={1}
                          placeholder={
                            selectedItem.type === 'group'
                              ? 'Message group'
                              : 'Message'
                          }
                          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-[22px] border-0 bg-stone-100 px-4 py-2.5 text-sm text-stone-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
                        />

                        <button
                          type="submit"
                          disabled={sending || !draft.trim()}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--portal-base)] text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Send message"
                          aria-label="Send message"
                        >
                          {sending ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <SendHorizontal className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </form>
                    )}
                  </>
                ) : (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 px-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--portal-accent-soft)] text-[var(--portal-base)]">
                      <MessageSquareMore className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-stone-900">
                        Select a thread
                      </p>
                      <p className="mt-2 text-sm text-stone-500">
                        Choose a private conversation or a group chat from the left.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {!isAdminMessaging ? renderGroupInfo() : null}
            </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
