import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Filter,
  Info,
  LoaderCircle,
  LogOut,
  MailCheck,
  MailOpen,
  MessageSquareMore,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Reply,
  Search,
  SendHorizontal,
  ShieldCheck,
  Trash2,
  WifiOff,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useSocketConnectionState, useSocketEmit, useSocketEvent } from '@/hooks/useSocket'
import API_BASE_URL from '@/api'

const MESSAGING_API_BASE = API_BASE_URL
// SMART-PDM_ADMIN_MESSAGES_RESPONSIVE_V1
// SMART-PDM_ADMIN_MESSAGES_EMBEDDED_GROUP_INFO_V2
// SMART_PDM_ADMIN_MESSAGES_COMPACT_LAYOUT_V1
// SMART_PDM_ADMIN_MESSAGES_TWO_MODE_ICON_COMPACT_V1
// SMART_PDM_ADMIN_MESSAGES_TWO_MODE_ICON_COMPACT_ANIMATED_V2

function createClientMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // RFC4122-compatible fallback for older browsers. The backend stores this as
  // UUID and uses it to make a retry idempotent.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function compactMessagePreview(value, maxLength = 90) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function formatThreadPreview(item, currentUserId) {
  const body = compactMessagePreview(item.lastMessage, 88)
  const content = body || (item.lastAttachmentUrl ? '📎 Attachment' : 'No messages yet')

  if (!item.lastSentAt) return content

  const senderId = String(item.lastSenderId || '')
  const isOwn = Boolean(senderId && senderId === String(currentUserId || ''))

  if (isOwn) return `You: ${content}`
  if (item.type === 'group' && item.lastSenderName) return `${item.lastSenderName}: ${content}`
  return content
}

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
    lastSenderId: raw.lastSenderId?.toString() || raw.last_sender_id?.toString() || '',
    lastSenderName: raw.lastSenderName?.toString() || raw.last_sender_name?.toString() || '',
    lastAttachmentUrl: raw.lastAttachmentUrl?.toString() || raw.last_attachment_url?.toString() || '',
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
    lastSenderId: raw.lastSenderId?.toString() || raw.last_sender_id?.toString() || '',
    lastSenderName: raw.lastSenderName?.toString() || raw.last_sender_name?.toString() || '',
    lastAttachmentUrl: raw.lastAttachmentUrl?.toString() || raw.last_attachment_url?.toString() || '',
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
    roArea: raw.roArea?.toString() || raw.ro_area?.toString() || '',
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
  const seenBy = (Array.isArray(raw.seenBy) ? raw.seenBy : Array.isArray(raw.seen_by) ? raw.seen_by : [])
    .map((receipt) => ({
      userId: receipt?.userId?.toString?.() || receipt?.user_id?.toString?.() || '',
      name: receipt?.name?.toString?.() || 'Unknown User',
      avatarUrl: receipt?.avatarUrl?.toString?.() || receipt?.avatar_url?.toString?.() || '',
      seenAt: receipt?.seenAt?.toString?.() || receipt?.seen_at?.toString?.() || '',
    }))
    .filter((receipt) => receipt.userId)

  return {
    messageId: raw.messageId?.toString() || raw.message_id?.toString() || '',
    senderId: raw.senderId?.toString() || raw.sender_id?.toString() || '',
    receiverId: raw.receiverId?.toString() || raw.receiver_id?.toString() || '',
    roomId: raw.roomId?.toString() || raw.room_id?.toString() || '',
    messageBody: raw.messageBody?.toString() || raw.message_body?.toString() || '',
    sentAt: raw.sentAt?.toString() || raw.sent_at?.toString() || '',
    editedAt: raw.editedAt?.toString() || raw.edited_at?.toString() || '',
    editCount: Number(raw.editCount ?? raw.edit_count ?? 0),
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
    replyToMessageId:
      raw.replyToMessageId?.toString() || raw.reply_to_message_id?.toString() || '',
    replyMessageBody:
      raw.replyMessageBody?.toString() || raw.reply_message_body?.toString() || '',
    replySenderId:
      raw.replySenderId?.toString() || raw.reply_sender_id?.toString() || '',
    replySenderName:
      raw.replySenderName?.toString() || raw.reply_sender_name?.toString() || '',
    clientMessageId:
      raw.clientMessageId?.toString() || raw.client_message_id?.toString() || '',
    seenByCounterparty:
      raw.seenByCounterparty === true || raw.seen_by_counterparty === true,
    seenBy,
    deliveryStatus: raw.deliveryStatus?.toString() || raw.delivery_status?.toString() || 'sent',
    sendError: raw.sendError?.toString() || raw.send_error?.toString() || '',
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
  const next = items.filter((item) => {
    if (item.messageId === message.messageId) return false
    if (message.clientMessageId && item.clientMessageId === message.clientMessageId) return false
    return true
  })
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

function isBrowserTabActivelyViewed() {
  if (typeof document === 'undefined') return false
  return document.visibilityState === 'visible' && document.hasFocus()
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

  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  if (difference === 0) return `Today, ${time}`
  if (difference === 1) return `Yesterday, ${time}`
  if (difference > 1 && difference < 7) {
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
    return `${weekday}, ${time}`
  }

  const calendarDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date)
  return `${calendarDate}, ${time}`
}

function shouldShowMessageSeparator(previousMessage, currentMessage) {
  if (!previousMessage) return true
  if (messageDayKey(previousMessage.sentAt) !== messageDayKey(currentMessage.sentAt)) return true

  const previousTime = new Date(previousMessage.sentAt).getTime()
  const currentTime = new Date(currentMessage.sentAt).getTime()
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) return false

  return currentTime - previousTime > 60 * 60 * 1000
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

function MessageDateDivider({ value, timeOnly = false }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-stone-200/80" />
      <span className="shrink-0 text-xs font-medium text-stone-500">
        {timeOnly
          ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
          : formatMessageDay(value)}
      </span>
      <div className="h-px flex-1 bg-stone-200/80" />
    </div>
  )
}

function NewMessagesDivider() {
  return (
    <div className="my-4 flex items-center gap-3" role="separator" aria-label="New messages">
      <div className="h-px flex-1 bg-stone-200" />
      <span className="shrink-0 rounded-full bg-[var(--portal-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--portal-base)]">
        New messages
      </span>
      <div className="h-px flex-1 bg-stone-200" />
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

function ThreadRow({
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
    ? `group relative border-b border-stone-100 transition ${isActive
      ? 'bg-[var(--portal-accent-soft)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r-full before:bg-[var(--portal-base)]'
      : hasUnread
        ? 'bg-[var(--portal-accent-soft)] hover:brightness-[0.99]'
        : 'bg-white hover:bg-stone-50'
    }`
    : `group relative ${iconOnly ? 'mx-1.5 my-1 rounded-xl' : 'mx-2 my-1 rounded-2xl'} overflow-hidden transition ${isActive
      ? 'bg-[var(--portal-accent-soft)]'
      : hasUnread
        ? 'bg-[var(--portal-accent-soft)]'
        : 'bg-white hover:bg-stone-50'
    } ${isActive ? 'before:absolute before:bottom-3 before:left-0 before:top-3 before:w-1 before:rounded-r-full before:bg-[var(--portal-base)]' : ''}`

  return (
    <div className={rowClass}>
      <button
        type="button"
        onClick={onClick}
        title={iconOnly ? item.name : undefined}
        aria-label={iconOnly ? `Open ${item.name}` : undefined}
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
              aria-label={`${item.unreadCount} unread`}
            />
          ) : null}
          {iconOnly && item.type === 'private' && item.isDisabled ? (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-stone-400" />
          ) : null}
        </div>

        {!iconOnly ? (
          <div className={`min-w-0 flex-1 ${compact ? 'pr-7' : 'pr-8'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p
                    className={`truncate text-sm ${hasUnread ? 'font-bold text-stone-950' : 'font-medium text-stone-900'}`}
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
                <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-label={`${item.unreadCount} unread`} />
              ) : null}
            </div>

            {!compact ? (
              <p
                className={`mt-1 truncate text-xs ${hasUnread ? 'font-semibold text-stone-700' : 'text-stone-500'}`}
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
            aria-label={`Options for ${item.name}`}
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

function parseSafeExternalUrl(rawValue) {
  try {
    const normalized = /^www\./i.test(rawValue) ? `https://${rawValue}` : rawValue
    const parsed = new URL(normalized)
    if (!['https:', 'http:'].includes(parsed.protocol)) return null
    if (parsed.username || parsed.password) return null
    return {
      href: parsed.href,
      hostname: parsed.hostname,
      isInsecure: parsed.protocol === 'http:',
    }
  } catch {
    return null
  }
}

function MessageText({ value, onOpenExternalLink }) {
  const text = String(value || '')
  const urlPattern = /((?:https?:\/\/|www\.)[^\s<]+)/gi
  const parts = text.split(urlPattern)

  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6">
      {parts.map((part, index) => {
        if (!/^(?:https?:\/\/|www\.)/i.test(part)) {
          return <span key={`text-${index}`}>{part}</span>
        }

        const trailingPunctuation = part.match(/[.,!?;:\])}]+$/)?.[0] || ''
        const url = trailingPunctuation ? part.slice(0, -trailingPunctuation.length) : part
        const safeUrl = parseSafeExternalUrl(url)

        if (!safeUrl) {
          return <span key={`text-${index}`}>{part}</span>
        }

        return (
          <span key={`link-${index}`}>
            <a
              href={safeUrl.href}
              rel="noopener noreferrer"
              className="font-medium underline decoration-current/60 underline-offset-2 hover:decoration-current"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenExternalLink?.(safeUrl)
              }}
            >
              {url}
            </a>
            {trailingPunctuation}
          </span>
        )
      })}
    </p>
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

function FloatingMessageTooltip({ anchorRef, open, placement = 'left', children }) {
  const [position, setPosition] = useState(null)

  useEffect(() => {
    if (!open) return undefined

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return

      if (placement === 'top') {
        setPosition({ left: rect.left + rect.width / 2, top: rect.top - 8, transform: 'translate(-50%, -100%)' })
      } else if (placement === 'right') {
        setPosition({ left: rect.right + 8, top: rect.top + rect.height / 2, transform: 'translateY(-50%)' })
      } else {
        setPosition({ left: rect.left - 8, top: rect.top + rect.height / 2, transform: 'translate(-100%, -50%)' })
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, open, placement])

  if (!open || !position || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed z-[200] whitespace-nowrap rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
      style={position}
      role="tooltip"
    >
      {children}
    </div>,
    document.body,
  )
}

function MessageBubble({
  message,
  displaySeenBy = [],
  isMine,
  isGroup = false,
  currentUserId = '',
  searchTerm = '',
  showAvatar = true,
  showSenderName = true,
  groupedWithPrevious = false,
  groupedWithNext = false,
  isLatestOutgoing = false,
  isCurrentSearchMatch = false,
  infoPanelOpen = false,
  editingMode = false,
  onReply,
  onCopy,
  onStartEdit,
  onLoadEditHistory,
  onDelete,
  onRetry,
  onOpenExternalLink,
}) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const [timestampOpen, setTimestampOpen] = useState(false)
  const [optionsTooltipOpen, setOptionsTooltipOpen] = useState(false)
  const [seenListOpen, setSeenListOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [editHistory, setEditHistory] = useState([])
  const [historyError, setHistoryError] = useState('')
  const actionRootRef = useRef(null)
  const messageRootRef = useRef(null)
  useEffect(() => {
    if (!actionsOpen) return undefined

    const closeOnOutside = (event) => {
      if (!actionRootRef.current?.contains(event.target)) setActionsOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setActionsOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [actionsOpen])

  if (String(message.subject || '').toLowerCase() === 'system') {
    return <div className="my-4 flex w-full items-center gap-3 text-center text-xs font-medium text-stone-500"><div className="h-px flex-1 bg-stone-200" /><span className="rounded-full bg-stone-100 px-3 py-1">{message.messageBody}</span><div className="h-px flex-1 bg-stone-200" /></div>
  }
  const query = searchTerm.trim().toLowerCase()
  const isMatch = Boolean(query && message.messageBody.toLowerCase().includes(query))
  const incomingCornerClass = `${groupedWithPrevious ? 'rounded-tl-md' : ''} ${groupedWithNext ? 'rounded-bl-md' : ''}`
  const outgoingCornerClass = `${groupedWithPrevious ? 'rounded-tr-md' : ''} ${groupedWithNext ? 'rounded-br-md' : ''}`
  const replyPreview = compactMessagePreview(message.replyMessageBody || 'Original message unavailable', 100)
  const repliedToCurrentUser = Boolean(
    message.replySenderId && currentUserId && message.replySenderId === currentUserId
  )
  const replyContextLabel = message.replyToMessageId
    ? isMine
      ? `You replied to ${message.replySenderId === currentUserId ? 'yourself' : message.replySenderName || 'a message'}`
      : repliedToCurrentUser
        ? `${message.senderName || 'Someone'} replied to you`
        : `${message.senderName || 'Someone'} replied to ${message.replySenderName || 'a message'}`
    : ''
  const seenBy = isGroup ? displaySeenBy : []
  const mobileSeenBy = seenBy.slice(0, 1)
  const desktopSeenBy = seenBy.slice(0, 3)
  const mobileAdditionalSeenCount = Math.max(0, seenBy.length - mobileSeenBy.length)
  const desktopAdditionalSeenCount = Math.max(0, seenBy.length - desktopSeenBy.length)
  const editDeadline = new Date(message.sentAt).getTime() + 15 * 60 * 1000
  const isOwnSentMessage = isMine && message.deliveryStatus === 'sent' && !message.messageId.startsWith('local:')
  const editWindowExpired = Number.isFinite(editDeadline) && Date.now() > editDeadline
  const editLimitReached = Number(message.editCount || 0) >= 5
  const isEmojiOnlyMessage = /^[\p{Extended_Pictographic}\uFE0F\u200D]+$/u.test(message.messageBody.trim())
  const canEdit = Boolean(
    isOwnSentMessage &&
    Number.isFinite(editDeadline) &&
    !editWindowExpired &&
    !editLimitReached &&
    !isEmojiOnlyMessage
  )
  const toggleEditHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false)
      return
    }
    setHistoryOpen(true)
    if (editHistory.length || historyLoading) return
    try {
      setHistoryLoading(true)
      setHistoryError('')
      setEditHistory(await onLoadEditHistory?.(message) || [])
    } catch (error) {
      setHistoryError(error.message || 'Unable to load edit history.')
    } finally {
      setHistoryLoading(false)
    }
  }
  const renderSeenAvatar = (receipt) => (
    <span
      key={receipt.userId}
      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-300 bg-white text-[6px] font-bold leading-none text-stone-600 shadow-sm sm:h-5 sm:w-5 sm:text-[7px]"
      title={`Seen by ${receipt.name}${receipt.seenAt ? ` at ${formatMessageTime(receipt.seenAt)}` : ''}`}
    >
      {receipt.avatarUrl ? (
        <img src={receipt.avatarUrl} alt={receipt.name} className="h-full w-full object-cover" />
      ) : (
        receipt.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
      )}
    </span>
  )

  const actionMenu = (
    <div ref={actionRootRef} className="relative shrink-0 self-center">
      <FloatingMessageTooltip anchorRef={actionRootRef} open={optionsTooltipOpen && !actionsOpen} placement="top">
        Message options
      </FloatingMessageTooltip>
      <button
        type="button"
        onClick={() => setActionsOpen((current) => !current)}
        onMouseEnter={() => { setOptionsTooltipOpen(true); setTimestampOpen(false) }}
        onMouseLeave={() => setOptionsTooltipOpen(false)}
        onFocus={() => { setOptionsTooltipOpen(true); setTimestampOpen(false) }}
        onBlur={() => setOptionsTooltipOpen(false)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-stone-400 opacity-70 transition hover:bg-stone-200 hover:text-stone-700 sm:opacity-0 sm:group-hover/message-row:opacity-100 sm:focus:opacity-100"
        aria-label="Message options"
        aria-haspopup="menu"
        aria-expanded={actionsOpen}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      {actionsOpen ? (
        <div
          role="menu"
          className={`absolute bottom-8 z-30 w-40 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl ${isMine ? 'right-0' : 'left-0'}`}
        >
          {!editingMode ? (
            <button
              type="button"
              onClick={() => { setActionsOpen(false); onReply?.(message) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50"
              role="menuitem"
            >
              <Reply className="h-3.5 w-3.5" /> Reply
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => { setActionsOpen(false); onCopy?.(message) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50"
            role="menuitem"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={() => { setActionsOpen(false); onStartEdit?.(message) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-stone-700 hover:bg-stone-50"
              role="menuitem"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => { setActionsOpen(false); onDelete?.(message) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50"
            role="menuitem"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete for me
          </button>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className={`group/message-row relative flex w-full items-end gap-1.5 ${groupedWithPrevious ? 'mt-1' : 'mt-3'} ${(isMine && isLatestOutgoing) || seenBy.length ? 'mb-6 sm:mb-7' : ''} ${isMine ? 'justify-end' : 'justify-start'}`}>
      {!isMine && isGroup ? (
        showAvatar ? <MessageAvatar message={message} /> : <div className="h-8 w-8 shrink-0" aria-hidden="true" />
      ) : null}

      <div className={`flex max-w-[88%] flex-col ${isMine ? 'items-end' : 'items-start'} sm:max-w-[76%] lg:max-w-[68%]`}>
        {((isGroup && !isMine && showSenderName && message.senderName && !message.replyToMessageId) || message.editedAt) ? (
          <p className={`mb-1 flex items-center gap-1 px-1 text-[11px] font-semibold text-stone-600 ${isMine ? 'justify-end text-right' : 'justify-start'}`}>
            <span>{isMine ? 'You' : message.senderName || 'User'}</span>
            {message.editedAt ? (
              <><span aria-hidden="true">·</span><button type="button" onClick={toggleEditHistory} className={`rounded px-0.5 transition hover:underline ${historyOpen ? 'font-bold text-stone-900 underline underline-offset-2' : 'font-semibold text-stone-600'}`} aria-expanded={historyOpen}>{historyOpen ? 'Hide edits' : 'Edited'}</button></>
            ) : null}
          </p>
        ) : null}

        <div
          ref={messageRootRef}
          className={`relative flex max-w-full flex-col ${isMine ? 'items-end' : 'items-start'}`}
          onMouseEnter={() => setTimestampOpen(true)}
          onMouseLeave={() => setTimestampOpen(false)}
          onFocusCapture={() => setTimestampOpen(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setTimestampOpen(false)
          }}
        >
          {historyOpen ? (
            <div className={`relative z-0 mb-1 flex w-full min-w-[13rem] max-w-sm flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
              {historyLoading ? <p className="px-3 py-1 text-xs text-stone-400">Loading...</p> : null}
              {historyError ? <p className="px-3 py-1 text-xs text-red-600">{historyError}</p> : null}
              {!historyLoading && !historyError ? (
                <div className={`flex max-h-40 w-full flex-col gap-1 overflow-y-auto ${isMine ? 'items-end' : 'items-start'}`}>
                  {editHistory.map((entry) => (
                    <div
                      key={entry.historyId}
                      className={`w-fit max-w-full rounded-2xl px-3.5 py-2 text-sm leading-6 shadow-sm ${isMine ? 'bg-[var(--portal-base)]/65 text-white/65' : 'border border-stone-200 bg-stone-200/80 text-stone-500'}`}
                      title={`Changed ${formatMessageTime(entry.editedAt)}`}
                    >
                      <p className="whitespace-pre-wrap break-words">{entry.previousMessageBody}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {message.replyToMessageId ? (
            <>
              <div
                className={`mb-1 flex max-w-full items-center gap-1.5 px-1 text-[11px] font-medium leading-4 text-stone-500 ${isMine ? 'justify-end text-right' : 'justify-start text-left'}`}
                title={replyContextLabel}
                aria-label={replyContextLabel}
              >
                <Reply className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{replyContextLabel}</span>
              </div>
              <div
                className={`relative z-0 -mb-1.5 inline-block w-fit max-w-full rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${isMine
                  ? 'mr-1.5 rounded-br-md bg-stone-600/85 text-white/90'
                  : 'ml-1.5 rounded-bl-md bg-stone-600/85 text-white/90'
                  }`}
                title={`Original message: ${replyPreview}`}
                aria-label={`${replyContextLabel}. Original message: ${replyPreview}`}
              >
                <p className="line-clamp-2 whitespace-pre-wrap break-words">{replyPreview}</p>
              </div>
            </>
          ) : null}

          <div className={`relative z-10 flex max-w-full items-center gap-0.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
            <div
              className={`w-fit max-w-full rounded-2xl px-3.5 py-2.5 shadow-sm transition ${isMine
                ? `bg-[var(--portal-base)] text-white ${outgoingCornerClass}`
                : `border border-stone-200 bg-white text-stone-800 ${incomingCornerClass}`
                } ${isCurrentSearchMatch ? 'ring-2 ring-[var(--portal-base)] ring-offset-2' : isMatch ? 'ring-2 ring-amber-300 ring-offset-2' : ''}`}
            >
              <MessageText value={message.messageBody} onOpenExternalLink={onOpenExternalLink} />
            </div>
            {actionMenu}
          </div>

          {message.sentAt ? (
            <FloatingMessageTooltip
              anchorRef={messageRootRef}
              open={timestampOpen && !optionsTooltipOpen}
              placement={isMine && infoPanelOpen ? 'right' : 'left'}
            >
              {formatMessageTime(message.sentAt)}
            </FloatingMessageTooltip>
          ) : null}
        </div>

        {(isMine && isLatestOutgoing) || seenBy.length ? (
          <div className="absolute right-0 top-full mt-1 flex min-h-5 max-w-[min(75vw,18rem)] items-center justify-end text-[10px] font-medium text-stone-400 sm:min-h-6 sm:text-[11px]" aria-live="polite">
            {message.deliveryStatus === 'sending' ? (
              <span>Sending…</span>
            ) : message.deliveryStatus === 'failed' ? (
              <button type="button" onClick={() => onRetry?.(message)} className="font-semibold text-red-600 hover:underline">
                Failed to send · Retry
              </button>
            ) : isGroup && seenBy.length ? (
              <span className="relative flex max-w-full items-center justify-end gap-1" aria-label={`Seen by ${seenBy.map((receipt) => receipt.name).join(', ')}`}>
                <span className="flex items-center justify-end gap-px sm:hidden">
                  {mobileSeenBy.map(renderSeenAvatar)}
                  {mobileAdditionalSeenCount ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-full bg-stone-200 px-1 text-[8px] font-semibold leading-4 text-stone-600 hover:bg-stone-300"
                      onClick={() => setSeenListOpen((current) => !current)}
                      aria-expanded={seenListOpen}
                      aria-label={`Show all ${seenBy.length} people who saw this message`}
                    >
                      +{mobileAdditionalSeenCount}
                    </button>
                  ) : null}
                </span>
                <span className="hidden items-center justify-end gap-0.5 sm:flex">
                  {desktopSeenBy.map(renderSeenAvatar)}
                  {desktopAdditionalSeenCount ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-full bg-stone-200 px-1.5 text-[8px] font-semibold leading-[18px] text-stone-600 hover:bg-stone-300"
                      onClick={() => setSeenListOpen((current) => !current)}
                      aria-expanded={seenListOpen}
                      aria-label={`Show all ${seenBy.length} people who saw this message`}
                    >
                      +{desktopAdditionalSeenCount}
                    </button>
                  ) : null}
                </span>
                {seenListOpen ? (
                  <span className="absolute bottom-6 right-0 z-30 w-64 overflow-hidden rounded-xl border border-stone-200 bg-white p-2 text-left text-stone-700 shadow-xl">
                    <span className="block px-2 pb-1.5 text-xs font-semibold text-stone-800">Seen by</span>
                    <span className="block max-h-48 overflow-y-auto">
                      {seenBy.map((receipt) => (
                        <span key={receipt.userId} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-200 text-[9px] font-bold text-stone-600">
                            {receipt.avatarUrl ? (
                              <img src={receipt.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              receipt.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">{receipt.name}</span>
                            <span className="block text-[10px] font-normal text-stone-400">{receipt.seenAt ? formatMessageTime(receipt.seenAt) : 'Seen'}</span>
                          </span>
                        </span>
                      ))}
                    </span>
                  </span>
                ) : null}
              </span>
            ) : isGroup ? (
              <span>Sent</span>
            ) : message.seenByCounterparty ? (
              <span>Seen</span>
            ) : (
              <span>Sent</span>
            )}
          </div>
        ) : null}
      </div>

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
  useEffect(() => {
    if (!member) return undefined
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [member, onClose])

  if (!member) return null

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/35 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${member.name} profile`} className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
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
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100" title="Close profile" aria-label="Close profile">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl bg-stone-50 p-4 text-sm">
          {member.studentNumber ? <div><span className="text-stone-500">ID</span><p className="font-medium text-stone-900">{member.studentNumber}</p></div> : null}
          {member.position ? <div><span className="text-stone-500">Position</span><p className="font-medium text-stone-900">{member.position}</p></div> : null}
          {member.department ? <div><span className="text-stone-500">Office</span><p className="font-medium text-stone-900">{member.department}</p></div> : null}
          {member.roArea ? <div><span className="text-stone-500">RO Area</span><p className="font-medium text-stone-900">{member.roArea}</p></div> : null}
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
  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel?.()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-stone-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-stone-500">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="h-10 rounded-xl border border-stone-200 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60">Cancel</button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60 ${variant === 'primary'
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
          title={`Actions for ${member.name}`}
          aria-label={`Actions for ${member.name}`}
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
                className="group-info-remove flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50"
                style={{ color: '#ef4444' }}
              >
                <UserMinus className="h-3.5 w-3.5" style={{ color: '#ef4444' }} /> Remove member
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
      className="group-info-panel flex h-full min-h-0 w-full flex-col overflow-hidden border-stone-200 bg-white lg:border-l"
    >
      <div className="shrink-0 border-b border-stone-100 px-4 py-4">
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
            title="Close group information"
            aria-label="Close group information"
          >
            <X className="h-4 w-4" />
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-stone-900">Members</h3>
            <p className="mt-0.5 text-xs text-stone-500">Manage participants and permissions.</p>
          </div>

          {viewerIsAdmin ? (
            <button
              type="button"
              onClick={onAddMember}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--portal-accent-soft)] px-3 text-xs font-semibold text-[var(--portal-base)] transition hover:brightness-95"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add
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

      <div className="shrink-0 border-t border-stone-100 bg-stone-50/70 px-4 py-4">
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
            ? 'Assign another group admin before leaving.'
            : 'Leaving moves this conversation to your Archived Messages.'}
        </p>
      </div>
    </section>
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
  const emitSocket = useSocketEmit()
  const socketStatus = useSocketConnectionState()

  const [isOpen, setIsOpen] = useState(false)
  const [mainView, setMainView] = useState('chats')
  const [searchTerm, setSearchTerm] = useState('')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [compactPane, setCompactPane] = useState('list')
  const conversationPaneModes = ['full', 'compact']
  const [conversationPaneMode, setConversationPaneMode] = useState(() => {
    try {
      const saved = localStorage.getItem(
        'smart-pdm-admin-messages-pane-mode'
      )

      if (saved === 'icons') return 'compact'

      return conversationPaneModes.includes(saved) ? saved : 'full'
    } catch {
      return 'full'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(
        'smart-pdm-admin-messages-pane-mode',
        conversationPaneMode
      )
    } catch {
      // Local preference storage is optional.
    }
  }, [conversationPaneMode])

  const conversationPaneGridClass =
    conversationPaneMode === 'compact'
      ? 'lg:grid-cols-[76px_minmax(0,1fr)]'
      : 'lg:grid-cols-[340px_minmax(0,1fr)]'

  const conversationWithInfoGridClass =
    conversationPaneMode === 'compact'
      ? 'lg:grid-cols-[76px_minmax(0,1fr)_300px] xl:grid-cols-[76px_minmax(0,1fr)_320px]'
      : 'lg:grid-cols-[280px_minmax(0,1fr)_300px] xl:grid-cols-[340px_minmax(0,1fr)_320px]'

  const toggleConversationPaneMode = () => {
    setConversationPaneMode((current) =>
      current === 'full' ? 'compact' : 'full'
    )
  }

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
  const [editingMessage, setEditingMessage] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionIndex, setMentionIndex] = useState(0)
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
  const [chatMatchIndex, setChatMatchIndex] = useState(0)
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState(null)
  const [deleteMessageBusy, setDeleteMessageBusy] = useState(false)
  const [pendingExternalLink, setPendingExternalLink] = useState(null)
  const [typingUserIds, setTypingUserIds] = useState([])

  useEffect(() => {
    setEditingMessage(null)
    setDraft('')
    setMentionQuery(null)
    setMentionIndex(0)
  }, [activeType, activeConversationId, activeRoomId, isOpen])

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null || activeType !== 'group') return []
    const normalizedQuery = mentionQuery.trim().toLowerCase()
    const everyoneMention = {
      userId: 'mention:everyone',
      name: 'everyone',
      isEveryoneMention: true,
    }
    return [everyoneMention, ...groupMembers
      .filter((member) => member.userId !== currentUserId)
    ]
      .filter((member) => !normalizedQuery || member.name?.toLowerCase().includes(normalizedQuery))
      .slice(0, 6)
  }, [mentionQuery, activeType, groupMembers, currentUserId])

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
  const sendingRef = useRef(false)
  const processedRealtimeMessageIdsRef = useRef(new Set())
  const pendingUnreadOpenRef = useRef(null)
  const typingStopTimerRef = useRef(null)
  const typingActiveRef = useRef(false)
  const typingTargetRef = useRef(null)
  const lastTypingEmitAtRef = useRef(0)
  const typingExpiryTimersRef = useRef(new Map())

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

  const chatMatches = useMemo(() => {
    const query = chatSearchTerm.trim().toLowerCase()
    if (!query) return []
    return messages.filter((message) =>
      message.messageBody.toLowerCase().includes(query)
    )
  }, [messages, chatSearchTerm])

  const chatMatchCount = chatMatches.length
  const currentChatMatchId = chatMatches[chatMatchIndex]?.messageId || ''

  const latestOwnMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.senderId === currentUserId) return messages[index].messageId
    }
    return ''
  }, [messages, currentUserId])

  const groupSeenByByMessageId = useMemo(() => {
    const latestPositionByMember = new Map()
    messages.forEach((message) => {
      if (message.senderId && message.senderId !== currentUserId) {
        const senderMember = groupMembers.find((member) => member.userId === message.senderId)
        // Sending a newer message proves the member advanced beyond any older
        // read receipt, so move their indicator beneath their new message.
        latestPositionByMember.set(message.senderId, {
          messageId: message.messageId,
          receipt: {
            userId: message.senderId,
            name: senderMember?.name || message.senderName || 'Group member',
            avatarUrl: senderMember?.avatarUrl || message.senderAvatarUrl || '',
            seenAt: message.sentAt,
          },
        })
      }

      (message.seenBy || []).forEach((receipt) => {
        if (receipt.userId === currentUserId) return
        latestPositionByMember.set(receipt.userId, { messageId: message.messageId, receipt })
      })
    })

    const receiptsByMessage = new Map()
    latestPositionByMember.forEach(({ messageId, receipt }) => {
      if (!receipt) return
      receiptsByMessage.set(messageId, [...(receiptsByMessage.get(messageId) || []), receipt])
    })
    return receiptsByMessage
  }, [messages, currentUserId, groupMembers])

  const typingLabel = useMemo(() => {
    if (!typingUserIds.length || !selectedItem) return ''

    const names = typingUserIds
      .map((userId) => {
        if (selectedItem.type === 'private') return selectedItem.name
        return groupMembers.find((member) => member.userId === userId)?.name || 'Someone'
      })
      .filter(Boolean)

    if (!names.length) return ''
    if (names.length === 1) return `${names[0]} is typing…`
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
    return `${names[0]} and ${names.length - 1} others are typing…`
  }, [typingUserIds, selectedItem, groupMembers])

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

  const scrollToMessageId = useCallback((messageId, behavior = 'smooth') => {
    if (!messageId) return
    window.requestAnimationFrame(() => {
      const container = messagesScrollRef.current
      const target = container?.querySelector(`[data-message-id="${messageId}"]`)
      if (!container || !target) return
      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const top = container.scrollTop + (targetRect.top - containerRect.top) - (container.clientHeight / 3)
      container.scrollTo({ top: Math.max(0, top), behavior })
      shouldAutoScrollRef.current = false
    })
  }, [])

  useEffect(() => {
    const pending = pendingUnreadOpenRef.current
    const pendingMatches = pending && (
      (activeType === 'group' && pending.type === 'group' && pending.id === activeRoomId) ||
      (activeType === 'private' && pending.type === 'private' && pending.id === activeConversationId)
    )
    forceScrollToBottomRef.current = !pendingMatches
    shouldAutoScrollRef.current = !pendingMatches
    setFirstUnreadMessageId('')
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
    if (!chatMatches.length) {
      setChatMatchIndex(0)
      return
    }
    setChatMatchIndex((current) => Math.min(current, chatMatches.length - 1))
  }, [chatMatches.length])

  useEffect(() => {
    if (chatSearchOpen && currentChatMatchId) {
      scrollToMessageId(currentChatMatchId)
    }
  }, [chatSearchOpen, currentChatMatchId, scrollToMessageId])

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

        if (
          preferredConversationId &&
          !activeRoomRef.current &&
          items.some((item) => item.id === preferredConversationId)
        ) {
          setActiveType('private')
          setActiveConversationId(preferredConversationId)
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

        if (
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

        setMessages((current) => {
          if (!silent) return items
          const serverClientIds = new Set(items.map((message) => message.clientMessageId).filter(Boolean))
          const localPending = current.filter((message) =>
            (message.deliveryStatus === 'sending' || message.deliveryStatus === 'failed') &&
            (!message.clientMessageId || !serverClientIds.has(message.clientMessageId))
          )
          return sortMessages([...items, ...localPending])
        })
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
        const roomMembers = (payload.members || payload.roomMembers || [])
          .map(normalizeRoomMember)
          .sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base', numeric: true }))
        const resolvedMemberCount = Number(
          payload.member_count ?? payload.memberCount ?? roomMembers.length
        )

        setMessages((current) => {
          if (!silent) return items
          const serverClientIds = new Set(items.map((message) => message.clientMessageId).filter(Boolean))
          const localPending = current.filter((message) =>
            (message.deliveryStatus === 'sending' || message.deliveryStatus === 'failed') &&
            (!message.clientMessageId || !serverClientIds.has(message.clientMessageId))
          )
          return sortMessages([...items, ...localPending])
        })
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
        const items = (payload.members || payload.roomMembers || [])
          .map(normalizeRoomMember)
          .sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base', numeric: true }))
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
      if (!isOpen || !isBrowserTabActivelyViewed()) {
        return { messageIds: [], isRead: false, unreadCount: null, skipped: true }
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
    [token, activeType, activeConversationId, isOpen]
  )

  const markRoomMessagesRead = useCallback(
    async (roomId) => {
      const normalizedRoomId = roomId?.toString?.().trim() || ''

      if (!normalizedRoomId) {
        return { messageIds: [], isRead: true, unreadCount: 0 }
      }
      if (!isOpen || !isBrowserTabActivelyViewed()) {
        return { messageIds: [], isRead: false, unreadCount: null, skipped: true }
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
    [token, activeType, activeRoomId, isOpen]
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

  useEffect(() => {
    const pending = pendingUnreadOpenRef.current
    if (!pending || loadingMessages || !messages.length) return

    const matchesActive =
      (pending.type === 'group' && activeType === 'group' && pending.id === activeRoomId) ||
      (pending.type === 'private' && activeType === 'private' && pending.id === activeConversationId)
    if (!matchesActive) return

    const firstUnread = messages.find(
      (message) => message.senderId !== currentUserId && message.isRead !== true
    )

    if (firstUnread?.messageId) {
      setFirstUnreadMessageId(firstUnread.messageId)
      scrollToMessageId(firstUnread.messageId, 'auto')
    }

    pendingUnreadOpenRef.current = null

    const markPromise = pending.type === 'group'
      ? markRoomMessagesRead(pending.id)
      : markConversationRead(pending.id)

    Promise.resolve(markPromise).catch((error) => {
      console.error('[Messaging] Auto read after opening unread thread failed:', error)
    })
  }, [
    messages,
    loadingMessages,
    activeType,
    activeConversationId,
    activeRoomId,
    currentUserId,
    markConversationRead,
    markRoomMessagesRead,
    scrollToMessageId,
  ])

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

  const emitTypingState = useCallback(
    (isTyping) => {
      const currentTarget = {
        type: activeType,
        roomId: activeType === 'group' ? activeRoomId : '',
        counterpartyId: activeType === 'private' ? activeConversationId : '',
      }
      const target = isTyping ? currentTarget : (typingTargetRef.current || currentTarget)
      const hasTarget = target.type === 'group' ? Boolean(target.roomId) : Boolean(target.counterpartyId)
      if (!isOpen || !hasTarget || !currentUserId) return false

      const emitted = emitSocket('message:typing', {
        roomId: target.type === 'group' ? target.roomId : null,
        room_id: target.type === 'group' ? target.roomId : null,
        counterpartyId: target.type === 'private' ? target.counterpartyId : null,
        counterparty_id: target.type === 'private' ? target.counterpartyId : null,
        isTyping,
        is_typing: isTyping,
      })

      if (emitted) {
        if (isTyping) typingTargetRef.current = target
        else typingTargetRef.current = null
      }
      return emitted
    },
    [emitSocket, isOpen, currentUserId, activeType, activeRoomId, activeConversationId]
  )

  const stopTyping = useCallback(() => {
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current)
      typingStopTimerRef.current = null
    }
    if (typingActiveRef.current) {
      emitTypingState(false)
      typingActiveRef.current = false
    }
  }, [emitTypingState])

  const handleDraftChange = useCallback((event) => {
    const value = event.target.value
    setDraft(value)

    const valueBeforeCaret = value.slice(0, event.target.selectionStart ?? value.length)
    const mentionMatch = activeType === 'group' ? valueBeforeCaret.match(/(?:^|\s)@([^@\s]*)$/) : null
    setMentionQuery(mentionMatch ? mentionMatch[1] : null)
    setMentionIndex(0)

    if (editingMessage) return

    if (!value.trim()) {
      stopTyping()
      return
    }

    const now = Date.now()
    if (!typingActiveRef.current || now - lastTypingEmitAtRef.current > 1200) {
      emitTypingState(true)
      typingActiveRef.current = true
      lastTypingEmitAtRef.current = now
    }

    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current)
    }
    typingStopTimerRef.current = window.setTimeout(() => {
      if (typingActiveRef.current) {
        emitTypingState(false)
        typingActiveRef.current = false
      }
      typingStopTimerRef.current = null
    }, 1800)
  }, [activeType, editingMessage, emitTypingState, stopTyping])

  const selectMention = useCallback((member) => {
    const composer = composerRef.current
    const caret = composer?.selectionStart ?? draft.length
    const beforeCaret = draft.slice(0, caret)
    const mentionMatch = beforeCaret.match(/(?:^|\s)@([^@\s]*)$/)
    if (!mentionMatch) return

    const mentionStart = caret - mentionMatch[1].length - 1
    const nextDraft = `${draft.slice(0, mentionStart)}@${member.name} ${draft.slice(caret)}`
    const nextCaret = mentionStart + member.name.length + 2
    setDraft(nextDraft)
    setMentionQuery(null)
    setMentionIndex(0)
    window.requestAnimationFrame(() => {
      composer?.focus()
      composer?.setSelectionRange(nextCaret, nextCaret)
    })
  }, [draft])

  useEffect(() => () => stopTyping(), [stopTyping])

  async function sendMessageBody(rawMessageBody, options = {}) {
    const messageBody = rawMessageBody?.trim?.() || ''
    if (!messageBody || sendingRef.current) return

    if (activeType === 'private' && selectedItem?.isDisabled) {
      setError('This account is currently disabled. You can view previous messages, but you cannot send new messages to this account.')
      return
    }

    const replyTarget = options.replyTarget || replyingTo
    const clientMessageId = options.clientMessageId || createClientMessageId()
    const optimisticId = options.optimisticId || `local:${clientMessageId}`
    const optimisticSentAt = options.sentAt || new Date().toISOString()
    const optimisticMessage = normalizeMessage({
      messageId: optimisticId,
      clientMessageId,
      senderId: currentUserId,
      receiverId: activeType === 'private' ? activeConversationId : null,
      roomId: activeType === 'group' ? activeRoomId : null,
      messageBody,
      sentAt: optimisticSentAt,
      isRead: true,
      seenByCounterparty: false,
      deliveryStatus: 'sending',
      replyToMessageId: replyTarget?.messageId || replyTarget?.replyToMessageId || '',
      replyMessageBody: replyTarget?.messageBody || replyTarget?.replyMessageBody || '',
      replySenderId: replyTarget?.senderId || replyTarget?.replySenderId || '',
      replySenderName:
        replyTarget?.senderName ||
        replyTarget?.replySenderName ||
        (replyTarget?.senderId === currentUserId ? 'You' : ''),
    })

    shouldAutoScrollRef.current = true
    sendingRef.current = true
    setSending(true)
    setMessages((current) => upsertMessage(current, optimisticMessage))

    if (!options.isRetry) {
      setDraft('')
      setReplyingTo(null)
      stopTyping()
    }

    try {
      let response
      const requestBody = {
        messageBody,
        clientMessageId,
        replyToMessageId: optimisticMessage.replyToMessageId || null,
      }

      if (activeType === 'group' && activeRoomId) {
        response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/rooms/${activeRoomId}/messages`,
          {
            method: 'POST',
            headers: buildMessagingHeaders(token, { json: true }),
            body: JSON.stringify(requestBody),
          }
        )
      } else if (activeConversationId) {
        response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/conversations/${activeConversationId}`,
          {
            method: 'POST',
            headers: buildMessagingHeaders(token, { json: true }),
            body: JSON.stringify(requestBody),
          }
        )
      } else {
        throw new Error('Select a conversation before sending a message.')
      }

      const payload = await parseApiResponse(response, 'Failed to send message.')
      const message = {
        ...normalizeMessage(payload),
        deliveryStatus: 'sent',
      }

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
      setError('')
    } catch (err) {
      setMessages((current) => current.map((message) =>
        message.messageId === optimisticId || message.clientMessageId === clientMessageId
          ? {
            ...message,
            messageId: optimisticId,
            clientMessageId,
            deliveryStatus: 'failed',
            sendError: err.message || 'Failed to send message.',
          }
          : message
      ))
      setError('')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault()
    if (editingMessage) {
      if (!draft.trim() || draft.trim() === editingMessage.messageBody) return
      try {
        setEditSaving(true)
        await handleEditMessage(editingMessage, draft.trim())
        setEditingMessage(null)
        setDraft('')
      } finally {
        setEditSaving(false)
      }
      return
    }
    await sendMessageBody(draft)
  }

  async function handleQuickLike() {
    if (draft.trim() || sendingRef.current) return
    await sendMessageBody('👍')
  }

  function handleReplyToMessage(message) {
    if (editingMessage) return
    if (!message || message.deliveryStatus === 'failed') return
    setReplyingTo(message)
    window.requestAnimationFrame(() => composerRef.current?.focus())
  }

  function handleStartEditMessage(message) {
    setReplyingTo(null)
    setChatSearchOpen(false)
    setChatSearchTerm('')
    setChatMatchIndex(0)
    setGroupInfoOpen(false)
    setEditingMessage(message)
    setDraft(message.messageBody)
    stopTyping()
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const composer = composerRef.current
        if (!composer) return
        const caretPosition = message.messageBody.length
        composer.focus()
        composer.setSelectionRange(caretPosition, caretPosition)
        composer.scrollTop = composer.scrollHeight
      })
    })
  }

  function cancelMessageEdit() {
    setEditingMessage(null)
    setDraft('')
    window.requestAnimationFrame(() => composerRef.current?.focus())
  }

  async function handleCopyMessage(message) {
    try {
      await navigator.clipboard.writeText(message?.messageBody || '')
    } catch {
      setError('Unable to copy this message in the current browser.')
    }
  }

  async function handleEditMessage(message, messageBody) {
    try {
      const response = await fetch(`${MESSAGING_API_BASE}/api/messages/message/${message.messageId}`, {
        method: 'PATCH',
        headers: buildMessagingHeaders(token, { json: true }),
        body: JSON.stringify({ messageBody }),
      })
      const payload = await parseApiResponse(response, 'Failed to edit message.')
      const updated = normalizeMessage(payload)

      setMessages((current) => current.map((item) => {
        if (item.messageId === message.messageId) {
          return { ...item, messageBody: updated.messageBody, editedAt: updated.editedAt, editCount: updated.editCount }
        }
        if (item.replyToMessageId === message.messageId) {
          return { ...item, replyMessageBody: updated.messageBody }
        }
        return item
      }))
      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        fetchRooms(activeRoomRef.current || activeRoomId),
      ])
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to edit message.')
      throw err
    }
  }

  async function handleLoadEditHistory(message) {
    const response = await fetch(`${MESSAGING_API_BASE}/api/messages/message/${message.messageId}/history`, {
      headers: buildMessagingHeaders(token),
    })
    const payload = await parseApiResponse(response, 'Failed to load edit history.')
    return (payload.items || payload.history || []).map((entry) => ({
      historyId: entry.historyId?.toString?.() || entry.history_id?.toString?.() || '',
      editNumber: Number(entry.editNumber ?? entry.edit_number ?? 0),
      previousMessageBody: entry.previousMessageBody?.toString?.() || entry.previous_message_body?.toString?.() || '',
      newMessageBody: entry.newMessageBody?.toString?.() || entry.new_message_body?.toString?.() || '',
      editedAt: entry.editedAt?.toString?.() || entry.edited_at?.toString?.() || '',
    })).sort((left, right) => left.editNumber - right.editNumber)
  }

  async function handleDeleteMessageForMe(message) {
    if (!message?.messageId || message.messageId.startsWith('local:')) {
      setMessages((current) => current.filter((item) => item.messageId !== message?.messageId))
      setPendingDeleteMessage(null)
      return
    }

    try {
      setDeleteMessageBusy(true)
      const response = await fetch(`${MESSAGING_API_BASE}/api/messages/message/${message.messageId}`, {
        method: 'DELETE',
        headers: buildMessagingHeaders(token),
      })
      await parseApiResponse(response, 'Failed to delete message for you.')

      setMessages((current) => current.filter((item) => item.messageId !== message.messageId))
      if (firstUnreadMessageId === message.messageId) setFirstUnreadMessageId('')
      if (replyingTo?.messageId === message.messageId) setReplyingTo(null)
      setPendingDeleteMessage(null)
      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        fetchRooms(activeRoomRef.current || activeRoomId),
      ])
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to delete message for you.')
    } finally {
      setDeleteMessageBusy(false)
    }
  }

  async function handleRetryFailedMessage(message) {
    if (!message || sendingRef.current) return
    await sendMessageBody(message.messageBody, {
      isRetry: true,
      clientMessageId: message.clientMessageId || createClientMessageId(),
      optimisticId: message.messageId,
      sentAt: message.sentAt,
      replyTarget: message.replyToMessageId
        ? {
          messageId: message.replyToMessageId,
          messageBody: message.replyMessageBody,
          senderId: message.replySenderId,
          senderName: message.replySenderName,
        }
        : null,
    })
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
    setCompactPane('thread')
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
    setChatMatchIndex(0)
    setGroupInfoOpen(false)
    setGroupMembers([])
    setTypingUserIds([])
    setReplyingTo(null)
    typingExpiryTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    typingExpiryTimersRef.current.clear()
    stopTyping()
  }, [activeType, activeConversationId, activeRoomId, stopTyping])

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
      if (Number(firstItem.unreadCount || 0) > 0) {
        pendingUnreadOpenRef.current = { type: firstItem.type, id: firstItem.id }
        setMessages([])
      }

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
      if (!isBrowserTabActivelyViewed()) return

      if (activeType === 'group' && activeRoomId) {
        fetchRoomMessages(activeRoomId, { silent: true })
        markRoomMessagesRead(activeRoomId).catch(() => { })
        return
      }

      if (activeType === 'private' && activeConversationId) {
        fetchConversationMessages(activeConversationId, { silent: true })
        markConversationRead(activeConversationId).catch(() => { })
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
    markConversationRead,
    markRoomMessagesRead,
  ])

  useEffect(() => {
    if (!selectedItem && filteredItems.length) {
      const firstItem = filteredItems[0]
      if (Number(firstItem.unreadCount || 0) > 0) {
        pendingUnreadOpenRef.current = { type: firstItem.type, id: firstItem.id }
        setMessages([])
      }

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
    'message:typing',
    (data = {}) => {
      const senderId = data?.sender_id?.toString?.() || data?.senderId?.toString?.() || ''
      if (!senderId || senderId === currentUserId || !isOpen) return

      const roomId = data?.room_id?.toString?.() || data?.roomId?.toString?.() || ''
      const counterpartyId = data?.counterparty_id?.toString?.() || data?.counterpartyId?.toString?.() || ''
      const isTyping = data?.is_typing === true || data?.isTyping === true
      const isRelevant = activeType === 'group'
        ? Boolean(activeRoomId && roomId === activeRoomId)
        : Boolean(activeConversationId && senderId === activeConversationId && (!counterpartyId || counterpartyId === currentUserId))

      if (!isRelevant) return

      const previousTimer = typingExpiryTimersRef.current.get(senderId)
      if (previousTimer) window.clearTimeout(previousTimer)

      if (!isTyping) {
        typingExpiryTimersRef.current.delete(senderId)
        setTypingUserIds((current) => current.filter((id) => id !== senderId))
        return
      }

      setTypingUserIds((current) => current.includes(senderId) ? current : [...current, senderId])
      const timerId = window.setTimeout(() => {
        typingExpiryTimersRef.current.delete(senderId)
        setTypingUserIds((current) => current.filter((id) => id !== senderId))
      }, 2800)
      typingExpiryTimersRef.current.set(senderId, timerId)
    },
    [isOpen, activeType, activeRoomId, activeConversationId, currentUserId]
  )

  useSocketEvent(
    'maintenance:updated',
    async (data) => {
      if (data?.module && data.module !== 'accounts') return

      const activeRoom = activeRoomRef.current || activeRoomId
      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        fetchRooms(activeRoom),
        activeRoom ? fetchRoomMembers(activeRoom) : Promise.resolve(),
        isOpen ? fetchScholarMembers() : Promise.resolve(),
      ])
    },
    [
      activeConversationId,
      activeRoomId,
      fetchConversations,
      fetchRooms,
      fetchRoomMembers,
      fetchScholarMembers,
      isOpen,
    ]
  )

  useSocketEvent(
    'ro:updated',
    async (data = {}) => {
      if (!['ro_area_coordinator', 'ro_department'].includes(data?.source)) return

      const activeRoom = activeRoomRef.current || activeRoomId
      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        fetchRooms(activeRoom),
        activeRoom ? fetchRoomMembers(activeRoom) : Promise.resolve(),
        isOpen ? fetchScholarMembers() : Promise.resolve(),
      ])
    },
    [
      activeConversationId,
      activeRoomId,
      fetchConversations,
      fetchRooms,
      fetchRoomMembers,
      fetchScholarMembers,
      isOpen,
    ]
  )

  useEffect(() => {
    if (!selectedMemberProfile?.userId) return
    const refreshedMember = groupMembers.find(
      (member) => member.userId === selectedMemberProfile.userId
    )
    if (refreshedMember) setSelectedMemberProfile(refreshedMember)
  }, [groupMembers, selectedMemberProfile?.userId])

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
    'message:updated',
    async (data = {}) => {
      const updated = normalizeMessage(data)
      if (!updated.messageId) return

      setMessages((current) => current.map((message) => {
        if (message.messageId === updated.messageId) {
          return {
            ...message,
            messageBody: updated.messageBody,
            editedAt: updated.editedAt || new Date().toISOString(),
            editCount: Math.max(Number(message.editCount || 0), Number(updated.editCount || 0)),
          }
        }
        if (message.replyToMessageId === updated.messageId) {
          return { ...message, replyMessageBody: updated.messageBody }
        }
        return message
      }))
      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        fetchRooms(activeRoomRef.current || activeRoomId),
      ])
    },
    [activeConversationId, activeRoomId, fetchConversations, fetchRooms]
  )

  useSocketEvent(
    'message:read',
    async (data) => {
      const messageIds = (data?.message_ids || data?.messageIds || [])
        .map((item) => item?.toString?.() || '')
        .filter(Boolean)

      if (messageIds.length) {
        const readerId = data?.reader_id?.toString?.() || data?.readerId?.toString?.() || ''
        const roomId = data?.room_id?.toString?.() || data?.roomId?.toString?.() || ''
        const seenAt = data?.updated_at?.toString?.() || new Date().toISOString()
        const reader = groupMembers.find((member) => member.userId === readerId)
        setMessages((current) =>
          markMessagesRead(current, messageIds).map((message) => {
            if (!readerId || readerId === currentUserId || !messageIds.includes(message.messageId)) {
              return message
            }

            if (roomId && message.roomId === roomId) {
              const nextReceipt = {
                userId: readerId,
                name: reader?.name || 'Group member',
                avatarUrl: reader?.avatarUrl || '',
                seenAt,
              }
              return {
                ...message,
                seenBy: [...(message.seenBy || []).filter((receipt) => receipt.userId !== readerId), nextReceipt],
              }
            }

            return message.senderId === currentUserId
              ? { ...message, seenByCounterparty: true }
              : message
          })
        )
      }

      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        fetchRooms(activeRoomRef.current || activeRoomId),
      ])
    },
    [
      activeConversationId,
      activeRoomId,
      currentUserId,
      fetchConversations,
      fetchRooms,
      groupMembers,
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
    'message:hidden',
    async (data = {}) => {
      const hiddenBy = data?.hidden_by?.toString?.() || data?.hiddenBy?.toString?.() || ''
      const messageId = data?.message_id?.toString?.() || data?.messageId?.toString?.() || ''
      if (!messageId || hiddenBy !== currentUserId) return

      setMessages((current) => current.filter((message) => message.messageId !== messageId))
      if (firstUnreadMessageId === messageId) setFirstUnreadMessageId('')
      if (replyingTo?.messageId === messageId) setReplyingTo(null)
      await Promise.all([
        fetchConversations(activeConversationRef.current || activeConversationId),
        fetchRooms(activeRoomRef.current || activeRoomId),
      ])
    },
    [currentUserId, firstUnreadMessageId, replyingTo, activeConversationId, activeRoomId, fetchConversations, fetchRooms]
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
  )

  return (
    <>
      {!isOpen && (
        <div className="group fixed bottom-6 right-6 z-40">
          <button
            type="button"
            onClick={() => {
              activeConversationRef.current = ''
              activeRoomRef.current = ''
              setActiveConversationId('')
              setActiveRoomId('')
              setMessages([])
              setSearchTerm('')
              setShowUnreadOnly(false)
              setMainView('chats')
              setArchivedOpen(false)
              setCreateGroupOpen(false)
              setAddMembersOpen(false)
              setGroupInfoOpen(false)
              setCompactPane('list')
              setIsOpen(true)
            }}
            className={`messages-launcher relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--portal-base)] text-white shadow-xl transition hover:brightness-95 ${totalUnreadCount > 0 ? 'ring-4 ring-red-200' : ''
              }`}
            style={{ backgroundColor: 'var(--portal-base)', color: '#ffffff' }}
            aria-label={totalUnreadCount > 0 ? `Messages, ${totalUnreadCount} unread` : 'Messages'}
          >
            <MessageSquareMore className="h-6 w-6" />

            {totalUnreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-h-[24px] min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold leading-none text-white shadow-md">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </span>
            )}
          </button>
        </div>
      )}

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
        open={Boolean(pendingDeleteMessage)}
        title="Delete message for you?"
        description="This message will be hidden only from your account. Other participants will still have their copy."
        confirmLabel="Delete for me"
        busy={deleteMessageBusy}
        onCancel={() => { if (!deleteMessageBusy) setPendingDeleteMessage(null) }}
        onConfirm={() => handleDeleteMessageForMe(pendingDeleteMessage)}
      />

      <ConfirmActionModal
        open={Boolean(pendingExternalLink)}
        title="Open external link?"
        description={pendingExternalLink
          ? `You are leaving SMaRT-PDM and opening ${pendingExternalLink.hostname}.${pendingExternalLink.isInsecure ? ' This connection is not encrypted (HTTP).' : ' Continue only if you trust this destination.'}`
          : ''}
        confirmLabel="Open link"
        variant="primary"
        onCancel={() => setPendingExternalLink(null)}
        onConfirm={() => {
          if (!pendingExternalLink?.href) return
          window.open(pendingExternalLink.href, '_blank', 'noopener,noreferrer')
          setPendingExternalLink(null)
        }}
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
        description="You will be removed from this group and it will move to your personal Archived Messages. You will no longer receive new group messages. If you are the only group admin and other members remain, assign another admin before leaving."
        confirmLabel="Leave group"
        busy={leaveGroupBusy}
        onCancel={() => setLeaveGroupOpen(false)}
        onConfirm={handleLeaveGroup}
      />

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-0 sm:p-4 lg:p-6">
          <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[88dvh] sm:max-w-7xl sm:rounded-[26px] sm:border sm:border-white/20">
            <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--portal-accent-soft)] text-[var(--portal-base)]">
                  <MessageSquareMore className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-base font-semibold text-stone-900">Messages</div>
                  <div className="text-xs text-stone-500">Private and group conversations</div>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={openArchivedThreads}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${mainView === 'archived' ? 'border-[var(--portal-base)] bg-[var(--portal-accent-soft)] text-[var(--portal-base)]' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}
                >
                  <Archive className="h-4 w-4" />
                  <span className="hidden sm:inline">Archived</span>
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
                  <span className="hidden sm:inline">Group</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fetchConversations(activeConversationId)
                    fetchRooms(activeRoomId)
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                  title="Refresh conversations"
                  aria-label="Refresh conversations"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => { stopTyping(); setIsOpen(false); setMainView('chats'); setArchivedOpen(false); setCreateGroupOpen(false); setAddMembersOpen(false); setGroupInfoOpen(false); setTransientPrivateContact(null); setCompactPane('list') }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:bg-stone-50"
                  title="Close messages"
                  aria-label="Close messages"
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
                className={`grid min-h-0 flex-1 gap-0 transition-[grid-template-columns] duration-300 ease-in-out motion-reduce:transition-none ${groupInfoOpen && selectedItem?.type === 'group' ? `grid-cols-1 ${conversationWithInfoGridClass}` : conversationPaneGridClass}`}
              >
                <section
                  className={`${groupInfoOpen ? 'hidden lg:flex' : compactPane === 'thread' ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-stone-200 bg-white lg:border-r`}
                >
                  <div className={`${conversationPaneMode === 'compact' ? 'px-2 py-3' : 'space-y-3 px-4 py-4'} border-b border-stone-100 transition-[padding] duration-300 ease-in-out motion-reduce:transition-none`}>
                    <div className={`flex items-center ${conversationPaneMode === 'compact' ? 'justify-center' : 'justify-between'} gap-2`}>
                      {conversationPaneMode !== 'compact' ? (
                        <p className="text-base font-semibold text-stone-900">Chats</p>
                      ) : null}

                      <button
                        type="button"
                        onClick={toggleConversationPaneMode}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition-all duration-300 ease-in-out hover:bg-stone-50 hover:text-stone-800 motion-reduce:transition-none"
                        title={
                          conversationPaneMode === 'full'
                            ? 'Compact chat list'
                            : 'Expand chat list'
                        }
                        aria-label={
                          conversationPaneMode === 'full'
                            ? 'Compact chat list'
                            : 'Expand chat list'
                        }
                      >
                        {conversationPaneMode === 'full' ? (
                          <span
                            className="flex h-4 w-4 items-center gap-[2px]"
                            aria-hidden="true"
                          >
                            <span className="h-4 w-2 rounded-[2px] bg-current" />
                            <span className="h-4 flex-1 rounded-[2px] border border-current opacity-50" />
                          </span>
                        ) : (
                          <span
                            className="flex h-4 w-4 items-center gap-[2px]"
                            aria-hidden="true"
                          >
                            <span className="h-4 w-1 rounded-[2px] bg-current" />
                            <span className="h-4 flex-1 rounded-[2px] border border-current opacity-50" />
                          </span>
                        )}
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
                            className={`inline-flex h-8 items-center gap-2 rounded-lg border ${conversationPaneMode === 'compact' ? 'px-2' : 'px-3'} text-xs font-medium transition ${showUnreadOnly
                              ? 'border-[var(--portal-base)] bg-[var(--portal-accent-soft)] text-[var(--portal-base)]'
                              : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                              }`}
                          >
                            <Filter className="h-3.5 w-3.5" />
                            <span className={conversationPaneMode === 'compact' ? 'sr-only' : ''}>
                              Unread only
                            </span>
                          </button>
                        </div>
                      </>
                    ) : null}
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
                            currentUserId={currentUserId}
                            onToggleRead={toggleThreadReadState}
                            onArchive={setPendingArchiveThread}
                            inboxStyle={false}
                            density={conversationPaneMode}
                            onClick={() => {
                              setTransientPrivateContact(null)
                              const hasUnread = Number(item.unreadCount || 0) > 0

                              if (hasUnread && !isActive) {
                                pendingUnreadOpenRef.current = { type: item.type, id: item.id }
                                setMessages([])
                              }

                              if (item.type === 'group') {
                                setActiveType('group')
                                setActiveRoomId(item.id)
                                setActiveConversationId('')
                              } else {
                                setActiveType('private')
                                setActiveConversationId(item.id)
                                setActiveRoomId('')
                              }

                              setCompactPane('thread')

                              if (hasUnread && isActive) {
                                const firstUnread = messages.find((message) => message.senderId !== currentUserId && message.isRead !== true)
                                if (firstUnread?.messageId) {
                                  setFirstUnreadMessageId(firstUnread.messageId)
                                  scrollToMessageId(firstUnread.messageId, 'auto')
                                }
                                if (item.type === 'group') {
                                  markRoomMessagesRead(item.id).catch(() => { })
                                } else {
                                  markConversationRead(item.id).catch(() => { })
                                }
                              }
                            }}
                          />
                        )
                      })
                    ) : (
                      <div className="flex flex-col items-center px-6 py-14 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                          <MessageSquareMore className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-stone-700">
                          {searchTerm || showUnreadOnly ? 'No matching conversations' : 'No conversations yet'}
                        </p>
                        <p className="mt-1 max-w-[240px] text-xs leading-5 text-stone-400">
                          {searchTerm || showUnreadOnly
                            ? 'Try another name, PDM ID, or clear the unread filter.'
                            : 'Search for an authorized user or create a group to start messaging.'}
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <section
                  className={`${groupInfoOpen ? 'hidden lg:flex' : compactPane === 'thread' ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col bg-white`}
                >
                  {selectedItem ? (
                    <>
                      <div className="border-b border-stone-100 bg-white px-4 py-3.5 sm:px-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setCompactPane('list')}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50 lg:hidden"
                              title="Back to inbox"
                              aria-label="Back to inbox"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </button>
                            <ThreadIcon item={selectedItem} />
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <p className="truncate text-sm font-semibold text-stone-900">{selectedItem.name}</p>
                                {selectedItem.type === 'private' && selectedItem.isDisabled ? (
                                  <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-stone-600">Account Disabled</span>
                                ) : null}
                              </div>
                              <p className={`mt-0.5 text-xs ${typingLabel ? 'font-medium text-[var(--portal-base)]' : 'text-stone-500'}`} aria-live="polite">
                                {typingLabel || (selectedItem.type === 'group'
                                  ? 'Group chat'
                                  : selectedItem.studentNumber || 'Private conversation')}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              disabled={Boolean(editingMessage)}
                              onClick={() => { setChatSearchOpen((current) => !current); setGroupInfoOpen(false); setChatMatchIndex(0) }}
                              className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-35 ${chatSearchOpen ? 'bg-[var(--portal-accent-soft)] text-[var(--portal-base)]' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:hover:bg-stone-100'}`}
                              title="Search this conversation"
                              aria-label="Search this conversation"
                              aria-pressed={chatSearchOpen}
                            >
                              <Search className="h-4 w-4" />
                            </button>
                            {selectedItem.type === 'group' ? (
                              <button
                                type="button"
                                disabled={Boolean(editingMessage)}
                                onClick={() => { setGroupInfoOpen((current) => !current); setChatSearchOpen(false) }}
                                className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-35 ${groupInfoOpen ? 'bg-[var(--portal-accent-soft)] text-[var(--portal-base)]' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:hover:bg-stone-100'}`}
                                title="Group information"
                                aria-label="Group information"
                                aria-pressed={groupInfoOpen}
                              >
                                <Info className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {socketStatus !== 'connected' ? (
                          <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700" role="status">
                            <WifiOff className="h-3.5 w-3.5" /> Reconnecting…
                          </div>
                        ) : null}

                        {chatSearchOpen && !groupInfoOpen ? (
                          <div className="mt-3 flex items-center gap-2">
                            <div className="relative min-w-0 flex-1">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                              <input
                                autoFocus
                                value={chatSearchTerm}
                                onChange={(event) => { setChatSearchTerm(event.target.value); setChatMatchIndex(0) }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' && chatMatchCount) {
                                    event.preventDefault()
                                    setChatMatchIndex((current) => event.shiftKey
                                      ? (current - 1 + chatMatchCount) % chatMatchCount
                                      : (current + 1) % chatMatchCount)
                                  }
                                  if (event.key === 'Escape') {
                                    setChatSearchOpen(false)
                                    setChatSearchTerm('')
                                  }
                                }}
                                placeholder="Search this conversation"
                                className="h-9 w-full rounded-xl border border-stone-200 pl-9 pr-3 text-xs outline-none focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
                                aria-label="Search messages in this conversation"
                              />
                            </div>
                            <span className="shrink-0 text-xs tabular-nums text-stone-500">
                              {chatSearchTerm.trim() ? (chatMatchCount ? `${chatMatchIndex + 1}/${chatMatchCount}` : '0 matches') : ''}
                            </span>
                            <button type="button" disabled={!chatMatchCount} onClick={() => setChatMatchIndex((current) => (current - 1 + chatMatchCount) % chatMatchCount)} className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="Previous match" aria-label="Previous search match"><ChevronUp className="h-4 w-4" /></button>
                            <button type="button" disabled={!chatMatchCount} onClick={() => setChatMatchIndex((current) => (current + 1) % chatMatchCount)} className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="Next match" aria-label="Next search match"><ChevronDown className="h-4 w-4" /></button>
                            <button type="button" onClick={() => { setChatSearchOpen(false); setChatSearchTerm(''); setChatMatchIndex(0) }} className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100" title="Close search" aria-label="Close conversation search"><X className="h-4 w-4" /></button>
                          </div>
                        ) : null}
                      </div>

                      <div
                        ref={messagesScrollRef}
                        onScroll={handleMessagesScroll}
                        className={`message-thread-surface relative min-h-0 flex-1 overflow-y-auto px-3 py-4 transition-colors sm:px-5 sm:py-5 ${editingMessage ? 'bg-neutral-300' : 'bg-[#f7f7f7]'}`}
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
                              const showDateDivider = shouldShowMessageSeparator(previousMessage, message)

                              return (
                                <div
                                  key={message.messageId}
                                  data-message-id={message.messageId}
                                  className={editingMessage
                                    ? String(editingMessage.messageId) === String(message.messageId)
                                      ? 'relative z-20 opacity-100'
                                      : 'pointer-events-none select-none opacity-40'
                                    : undefined}
                                >
                                  {showDateDivider ? (
                                    <MessageDateDivider
                                      value={message.sentAt}
                                      timeOnly={Boolean(
                                        previousMessage &&
                                        messageDayKey(previousMessage.sentAt) === messageDayKey(message.sentAt) &&
                                        messageDayKey(message.sentAt) === messageDayKey(new Date())
                                      )}
                                    />
                                  ) : null}
                                  {firstUnreadMessageId === message.messageId ? <NewMessagesDivider /> : null}
                                  <MessageBubble
                                    message={message}
                                    displaySeenBy={groupSeenByByMessageId.get(message.messageId) || []}
                                    isMine={isMine}
                                    isGroup={selectedItem.type === 'group'}
                                    currentUserId={currentUserId}
                                    searchTerm={chatSearchOpen ? chatSearchTerm : ''}
                                    groupedWithPrevious={groupedWithPrevious}
                                    groupedWithNext={groupedWithNext}
                                    showSenderName={!groupedWithPrevious}
                                    showAvatar={!groupedWithPrevious}
                                    isLatestOutgoing={isMine && latestOwnMessageId === message.messageId}
                                    isCurrentSearchMatch={currentChatMatchId === message.messageId}
                                    infoPanelOpen={groupInfoOpen}
                                    editingMode={Boolean(editingMessage)}
                                    onReply={handleReplyToMessage}
                                    onCopy={handleCopyMessage}
                                    onStartEdit={handleStartEditMessage}
                                    onLoadEditHistory={handleLoadEditHistory}
                                    onDelete={setPendingDeleteMessage}
                                    onRetry={handleRetryFailedMessage}
                                    onOpenExternalLink={setPendingExternalLink}
                                  />
                                </div>
                              )
                            })}
                            <div ref={messagesEndRef} />
                          </div>
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400"><MessageSquareMore className="h-5 w-5" /></div>
                            <p className="mt-3 text-sm font-semibold text-stone-700">No messages yet</p>
                            <p className="mt-1 text-xs leading-5 text-stone-400">Send the first message to start this conversation.</p>
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
                          className="border-t border-stone-100 bg-white px-3 py-3 sm:px-4"
                        >
                          {editingMessage ? (
                            <div className="mb-2 flex items-center justify-between px-1">
                              <p className="text-xs font-semibold text-stone-700">Edit message</p>
                              <button type="button" disabled={editSaving} onClick={cancelMessageEdit} className="flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700" title="Cancel edit" aria-label="Cancel edit"><X className="h-4 w-4" /></button>
                            </div>
                          ) : null}
                          {replyingTo ? (
                            <div className="mb-2 flex items-start justify-between gap-3 rounded-xl border-l-2 border-[var(--portal-base)] bg-stone-50 px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-stone-700">Replying to {replyingTo.senderId === currentUserId ? 'yourself' : replyingTo.senderName || selectedItem.name}</p>
                                <p className="mt-0.5 truncate text-xs text-stone-500">{compactMessagePreview(replyingTo.messageBody, 120)}</p>
                              </div>
                              <button type="button" onClick={() => setReplyingTo(null)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-200 hover:text-stone-700" title="Cancel reply" aria-label="Cancel reply"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : null}
                          <div className="relative flex items-end gap-2">
                            {mentionQuery !== null && mentionSuggestions.length ? (
                              <div className="absolute bottom-full left-0 z-40 mb-2 w-64 max-w-[calc(100vw-5rem)] overflow-hidden rounded-2xl border border-stone-200 bg-white py-1.5 shadow-xl" role="listbox" aria-label="Mention a group member">
                                {mentionSuggestions.map((member, index) => (
                                  <button
                                    key={member.userId}
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => selectMention(member)}
                                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${index === mentionIndex ? 'bg-stone-100' : 'hover:bg-stone-50'}`}
                                    role="option"
                                    aria-selected={index === mentionIndex}
                                  >
                                    {member.isEveryoneMention ? (
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--portal-accent-soft)] text-[var(--portal-base)]">
                                        <Users className="h-4 w-4" aria-hidden="true" />
                                      </span>
                                    ) : (
                                      <MemberAvatar member={member} sizeClass="h-8 w-8" />
                                    )}
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-medium text-stone-800">{member.name}</span>
                                      {member.isEveryoneMention ? <span className="block text-[11px] text-stone-500">Mention everyone in this group</span> : null}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            <textarea
                              ref={composerRef}
                              value={draft}
                              onChange={handleDraftChange}
                              onKeyDown={(event) => {
                                if (event.nativeEvent?.isComposing) return

                                if (mentionSuggestions.length) {
                                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                    event.preventDefault()
                                    setMentionIndex((current) => event.key === 'ArrowDown'
                                      ? (current + 1) % mentionSuggestions.length
                                      : (current - 1 + mentionSuggestions.length) % mentionSuggestions.length)
                                    return
                                  }
                                  if (event.key === 'Enter' || event.key === 'Tab') {
                                    event.preventDefault()
                                    selectMention(mentionSuggestions[mentionIndex] || mentionSuggestions[0])
                                    return
                                  }
                                }

                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  if (mentionQuery !== null) {
                                    setMentionQuery(null)
                                    return
                                  }
                                  if (editingMessage) cancelMessageEdit()
                                  else if (replyingTo) setReplyingTo(null)
                                  else if (chatSearchOpen) { setChatSearchOpen(false); setChatSearchTerm(''); setChatMatchIndex(0) }
                                  return
                                }

                                if (event.key !== 'Enter') return

                                // Shift + Enter keeps the textarea's normal newline behavior.
                                if (event.shiftKey) return

                                // Enter sends the current message instead of adding a newline.
                                event.preventDefault()
                                if (!sending && draft.trim()) {
                                  event.currentTarget.form?.requestSubmit()
                                }
                              }}
                              rows={1}
                              aria-label={editingMessage ? 'Edit message' : selectedItem.type === 'group' ? 'Message group' : `Message ${selectedItem.name}`}
                              placeholder={
                                editingMessage
                                  ? 'Edit message'
                                  : selectedItem.type === 'group'
                                    ? 'Message group'
                                    : 'Message'
                              }
                              className="max-h-32 min-h-[42px] flex-1 resize-none rounded-[22px] border-0 bg-stone-100 px-4 py-2.5 text-sm text-stone-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
                            />

                            {editingMessage || draft.trim() ? (
                              <button
                                type="submit"
                                disabled={sending || editSaving || !draft.trim() || (editingMessage && draft.trim() === editingMessage.messageBody)}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--portal-base)] text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                                title={editingMessage ? 'Save edit' : 'Send message'}
                                aria-label={editingMessage ? 'Save edit' : 'Send message'}
                              >
                                {sending || editSaving ? (
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : editingMessage ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <SendHorizontal className="h-4 w-4" />
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleQuickLike}
                                disabled={sending}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--portal-accent-soft)] text-xl leading-none text-[var(--portal-base)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Send like"
                                aria-label="Send like"
                              >
                                {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <span aria-hidden="true">👍</span>}
                              </button>
                            )}
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

                {renderGroupInfo({ embedded: true })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
