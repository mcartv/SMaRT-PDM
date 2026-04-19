import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LoaderCircle,
  MessageSquareMore,
  SendHorizontal,
  UserRound,
  UserPlus,
  Search,
  X,
  Filter,
  RefreshCw,
  Users,
  Plus,
  Check,
} from 'lucide-react'
import API_BASE_URL from '@/api';


const MESSAGING_API_BASE = API_BASE_URL;

function getAdminMessagingToken() {
  return localStorage.getItem('adminToken') || ''
}

function parseMessagingToken(token) {
  try {
    if (!token) return {}
    const parts = token.split('.')
    if (parts.length < 2) return {}
    return JSON.parse(atob(parts[1])) || {}
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

function normalizeConversation(raw = {}) {
  return {
    id:
      raw.counterpartyId?.toString() ||
      raw.counterparty_id?.toString() ||
      '',
    type: 'private',
    name: raw.name?.toString() || 'Unknown user',
    studentNumber:
      raw.studentNumber?.toString() ||
      raw.student_number?.toString() ||
      '',
    lastMessage:
      raw.lastMessage?.toString() ||
      raw.last_message?.toString() ||
      '',
    lastSentAt:
      raw.lastSentAt?.toString() ||
      raw.last_sent_at?.toString() ||
      '',
    createdAt:
      raw.createdAt?.toString() ||
      raw.created_at?.toString() ||
      '',
    avatarUrl:
      raw.avatarUrl?.toString() ||
      raw.profilePhotoUrl?.toString() ||
      raw.avatar_url?.toString() ||
      raw.profile_photo_url?.toString() ||
      '',
    unreadCount: Number(raw.unreadCount ?? raw.unread_count ?? 0),
  }
}

function normalizeRoom(raw = {}) {
  return {
    id: raw.room_id?.toString() || '',
    type: 'group',
    name: raw.room_name?.toString() || 'Untitled Group',
    studentNumber: `${Number(raw.member_count || 0)} members`,
    lastMessage: raw.last_message?.toString() || '',
    lastSentAt: raw.last_sent_at?.toString() || '',
    createdAt:
      raw.createdAt?.toString() ||
      raw.created_at?.toString() ||
      '',
    unreadCount: 0,
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
    studentName: raw.student_name?.toString() || 'Unknown Scholar',
    avatarUrl:
      raw.avatarUrl?.toString() ||
      raw.profilePhotoUrl?.toString() ||
      raw.avatar_url?.toString() ||
      raw.profile_photo_url?.toString() ||
      '',
    programName: raw.program_name?.toString() || 'No Program',
    benefactorName: raw.benefactor_name?.toString() || 'Unassigned Benefactor',
  }
}

function toScholarSearchItem(raw = {}) {
  return {
    id: raw.userId || '',
    type: 'private',
    name: raw.studentName || 'Unknown Scholar',
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
  }
}

function normalizeMessage(raw = {}) {
  return {
    messageId:
      raw.messageId?.toString() ||
      raw.message_id?.toString() ||
      '',
    senderId:
      raw.senderId?.toString() ||
      raw.sender_id?.toString() ||
      '',
    receiverId:
      raw.receiverId?.toString() ||
      raw.receiver_id?.toString() ||
      '',
    roomId:
      raw.roomId?.toString() ||
      raw.room_id?.toString() ||
      '',
    messageBody:
      raw.messageBody?.toString() ||
      raw.message_body?.toString() ||
      '',
    sentAt:
      raw.sentAt?.toString() ||
      raw.sent_at?.toString() ||
      '',
    isRead: raw.isRead === true || raw.is_read === true,
    subject: raw.subject?.toString() || null,
    attachmentUrl:
      raw.attachmentUrl?.toString() ||
      raw.attachment_url?.toString() ||
      null,
    senderName:
      raw.senderName?.toString() ||
      raw.sender_name?.toString() ||
      '',
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

function Avatar({ src = '', alt = '', name = '', type = 'private', className = '' }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || 'Profile picture'}
        className={className}
      />
    )
  }

  return (
    <div className={className}>
      {type === 'group' ? (
        <Users className="h-5 w-5" />
      ) : (
        <UserRound className="h-5 w-5" />
      )}
    </div>
  )
}

async function parseApiResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || payload.message || fallbackMessage)
  }

  return payload
}

function ThreadIcon({ type }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
      {type === 'group' ? <Users className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
    </div>
  )
}

function ThreadRow({ item, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-stone-100 px-4 py-3 text-left transition ${isActive ? 'bg-amber-50/60' : 'hover:bg-stone-50'
        }`}
    >
      <ThreadIcon type={item.type} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-900">{item.name}</p>
            <p className="truncate text-[11px] text-stone-500">
              {item.studentNumber || (item.type === 'group' ? 'Group chat' : 'No student number')}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[10px] text-stone-400">
              {formatConversationTime(item.lastSentAt)}
            </span>
            {item.unreadCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {item.unreadCount}
              </span>
            )}
          </div>
        </div>

        <p className="mt-1 truncate text-xs text-stone-500">
          {item.lastMessage || 'No messages yet'}
        </p>
      </div>
    </button>
  )
}

function MessageBubble({ message, isMine }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[70%] ${isMine
            ? 'bg-[#7c4a2e] text-white'
            : 'border border-stone-200 bg-white text-stone-800'
          }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-6">{message.messageBody}</p>
        <div className={`mt-1.5 text-[10px] ${isMine ? 'text-amber-100' : 'text-stone-400'}`}>
          {formatMessageTime(message.sentAt)}
        </div>
      </div>
    </div>
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

  const programOptions = useMemo(() => {
    return ['All Programs', ...new Set(scholars.map((item) => item.programName).filter(Boolean))]
  }, [scholars])

  const benefactorOptions = useMemo(() => {
    return ['All Benefactors', ...new Set(scholars.map((item) => item.benefactorName).filter(Boolean))]
  }, [scholars])

  const filteredScholars = useMemo(() => {
    const query = search.trim().toLowerCase()

    return scholars.filter((item) => {
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
  }, [scholars, search, programFilter, benefactorFilter])

  if (!open) return null

  const toggleMember = (userId) => {
    setSelectedMembers((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    )
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[84vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-stone-900">Create Group Chat</h3>
            <p className="mt-1 text-xs text-stone-500">
              Select scholars by program and benefactor.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:bg-stone-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-stone-100 px-5 py-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Group name"
              className="h-10 w-full rounded-xl border border-stone-200 px-4 text-sm text-stone-800 outline-none transition focus:border-[#7c4a2e] focus:ring-2 focus:ring-[#7c4a2e]/15"
            />

            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="h-10 rounded-xl border border-stone-200 px-4 text-sm text-stone-800 outline-none transition focus:border-[#7c4a2e] focus:ring-2 focus:ring-[#7c4a2e]/15"
            >
              {programOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <select
              value={benefactorFilter}
              onChange={(e) => setBenefactorFilter(e.target.value)}
              className="h-10 rounded-xl border border-stone-200 px-4 text-sm text-stone-800 outline-none transition focus:border-[#7c4a2e] focus:ring-2 focus:ring-[#7c4a2e]/15"
            >
              {benefactorOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scholar, student number, program, or benefactor"
              className="h-10 w-full rounded-xl border border-stone-200 px-4 text-sm text-stone-800 outline-none transition focus:border-[#7c4a2e] focus:ring-2 focus:ring-[#7c4a2e]/15"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loadingScholars ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-stone-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading scholars
              </div>
            ) : filteredScholars.length ? (
              <div className="space-y-2">
                {filteredScholars.map((item) => {
                  const checked = selectedMembers.includes(item.userId)

                  return (
                    <label
                      key={item.userId}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${checked
                          ? 'border-[#7c4a2e] bg-amber-50'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(item.userId)}
                        className="mt-1 h-4 w-4 accent-[#7c4a2e]"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium text-stone-900">
                            {item.studentName}
                          </p>

                          {checked && (
                            <span className="inline-flex items-center rounded-full bg-[#7c4a2e] px-2 py-0.5 text-[10px] font-semibold text-white">
                              <Check className="mr-1 h-3 w-3" />
                              Selected
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-stone-500">
                          {item.studentNumber || 'No student number'}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-700">
                            {item.programName}
                          </span>
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-700">
                            {item.benefactorName}
                          </span>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-stone-500">
                No scholars match the current filters.
              </div>
            )}
          </div>

          <div className="w-[250px] border-l border-stone-100 bg-stone-50/70 px-5 py-4">
            <p className="text-sm font-semibold text-stone-900">Selected Members</p>
            <p className="mt-1 text-xs text-stone-500">
              {selectedMembers.length} selected
            </p>

            <div className="mt-4 space-y-2">
              {selectedMembers.length ? (
                selectedMembers.map((userId) => {
                  const scholar = scholars.find((item) => item.userId === userId)
                  if (!scholar) return null

                  return (
                    <div
                      key={userId}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2"
                    >
                      <p className="text-sm font-medium text-stone-900">
                        {scholar.studentName}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {scholar.studentNumber || 'No student number'}
                      </p>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-4 text-sm text-stone-500">
                  No members selected yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={creating || !roomName.trim() || !selectedMembers.length}
            onClick={() =>
              onCreate({
                roomName: roomName.trim(),
                memberIds: [currentUserId, ...selectedMembers].filter(Boolean),
              })
            }
            className="inline-flex h-10 items-center rounded-xl bg-[#7c4a2e] px-4 text-sm font-semibold text-white transition hover:bg-[#6f4229] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Creating
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddMembersModal({
  open,
  onClose,
  onAdd,
  adding,
  scholars,
  loadingScholars,
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

    return scholars.filter((item) => {
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
  }, [scholars, search, programFilter, benefactorFilter])

  if (!open) return null

  const toggleMember = (userId) => {
    setSelectedMembers((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    )
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Add Scholars To Group</h3>
            <p className="mt-1 text-sm text-stone-500">
              Search scholars, filter them, then add them to the selected group chat.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:bg-stone-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-stone-100 px-5 py-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student ID, first name, last name, program, or benefactor"
              className="h-11 w-full rounded-2xl border border-stone-200 px-4 text-sm text-stone-800 outline-none transition focus:border-[#7c4a2e] focus:ring-2 focus:ring-[#7c4a2e]/15"
            />

            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="h-11 rounded-2xl border border-stone-200 px-4 text-sm text-stone-800 outline-none transition focus:border-[#7c4a2e] focus:ring-2 focus:ring-[#7c4a2e]/15"
            >
              {programOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <select
              value={benefactorFilter}
              onChange={(e) => setBenefactorFilter(e.target.value)}
              className="h-11 rounded-2xl border border-stone-200 px-4 text-sm text-stone-800 outline-none transition focus:border-[#7c4a2e] focus:ring-2 focus:ring-[#7c4a2e]/15"
            >
              {benefactorOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loadingScholars ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-stone-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading scholars
              </div>
            ) : filteredScholars.length ? (
              <div className="space-y-2">
                {filteredScholars.map((item) => {
                  const checked = selectedMembers.includes(item.userId)

                  return (
                    <label
                      key={item.userId}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                        checked
                          ? 'border-[#7c4a2e] bg-amber-50'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(item.userId)}
                        className="mt-1 h-4 w-4 accent-[#7c4a2e]"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-stone-900">
                            {item.studentName}
                          </p>

                          {checked && (
                            <span className="inline-flex items-center rounded-full bg-[#7c4a2e] px-2 py-0.5 text-[10px] font-semibold text-white">
                              <Check className="mr-1 h-3 w-3" />
                              Selected
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-stone-500">
                          {item.studentNumber || 'No student number'}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-700">
                            {item.programName}
                          </span>
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-700">
                            {item.benefactorName}
                          </span>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-stone-500">
                No scholars match the current filters.
              </div>
            )}
          </div>

          <div className="w-[260px] border-l border-stone-100 bg-stone-50/70 px-5 py-4">
            <p className="text-sm font-semibold text-stone-900">Selected Scholars</p>
            <p className="mt-1 text-xs text-stone-500">
              {selectedMembers.length} selected
            </p>

            <div className="mt-4 space-y-2">
              {selectedMembers.length ? (
                selectedMembers.map((userId) => {
                  const scholar = scholars.find((item) => item.userId === userId)
                  if (!scholar) return null

                  return (
                    <div
                      key={userId}
                      className="rounded-2xl border border-stone-200 bg-white px-3 py-2"
                    >
                      <p className="text-sm font-medium text-stone-900">
                        {scholar.studentName}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {scholar.studentNumber || 'No student number'}
                      </p>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-4 text-sm text-stone-500">
                  No scholars selected yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-2xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={adding || !selectedMembers.length}
            onClick={() => onAdd(selectedMembers)}
            className="inline-flex h-11 items-center rounded-2xl bg-[#7c4a2e] px-4 text-sm font-semibold text-white transition hover:bg-[#6f4229] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Adding
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Add To Group
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminMessages() {
  const token = getAdminMessagingToken()
  const tokenPayload = parseMessagingToken(token)
  const currentUserId =
    tokenPayload.user_id || tokenPayload.userId || tokenPayload.sub || tokenPayload.id || ''

  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  const [conversations, setConversations] = useState([])
  const [rooms, setRooms] = useState([])
  const [scholars, setScholars] = useState([])
  const [loadingScholars, setLoadingScholars] = useState(false)

  const [activeType, setActiveType] = useState('private')
  const [activeConversationId, setActiveConversationId] = useState('')
  const [activeRoomId, setActiveRoomId] = useState('')
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

  const activeConversationRef = useRef('')
  const activeRoomRef = useRef('')
  const messagesEndRef = useRef(null)

  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0),
    [conversations]
  )

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
      const matchesUnread = showUnreadOnly ? item.unreadCount > 0 : true
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
      return filteredItems.find((item) => item.type === 'group' && item.id === activeRoomId)
        || mergedItems.find((item) => item.type === 'group' && item.id === activeRoomId)
    }

    return filteredItems.find((item) => item.type === 'private' && item.id === activeConversationId)
      || mergedItems.find((item) => item.type === 'private' && item.id === activeConversationId)
  }, [filteredItems, mergedItems, activeType, activeConversationId, activeRoomId])

  useEffect(() => {
    activeConversationRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    activeRoomRef.current = activeRoomId
  }, [activeRoomId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

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

        if (items.length) {
          const nextConversationId = items.some(
            (item) => item.id === preferredConversationId
          )
            ? preferredConversationId
            : items[0].id

          if (!activeRoomRef.current) {
            setActiveType('private')
            setActiveConversationId(nextConversationId)
          }
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
        const rawItems = Array.isArray(payload) ? payload : (payload.items || [])
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
      const response = await fetch(`${MESSAGING_API_BASE}/api/messages/members/scholars`, {
        headers: buildMessagingHeaders(token),
      })
      const payload = await parseApiResponse(response, 'Failed to load scholar members.')
      setScholars((payload.items || []).map(normalizeScholarMember))
    } catch (err) {
      setError(err.message || 'Failed to load scholar members.')
    } finally {
      setLoadingScholars(false)
    }
  }, [token])

  const fetchConversationMessages = useCallback(
    async (counterpartyId) => {
      if (!counterpartyId) {
        setMessages([])
        return
      }

      setLoadingMessages(true)

      try {
        const response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/conversations/${counterpartyId}`,
          {
            headers: buildMessagingHeaders(token),
          }
        )
        const payload = await parseApiResponse(response, 'Failed to load messages.')
        const items = sortMessages((payload.items || []).map(normalizeMessage))
        setMessages(items)
        setError('')
      } catch (err) {
        setError(err.message || 'Failed to load messages.')
        setMessages([])
      } finally {
        setLoadingMessages(false)
      }
    },
    [token]
  )

  const fetchRoomMessages = useCallback(
    async (roomId) => {
      if (!roomId) {
        setMessages([])
        return
      }

      setLoadingMessages(true)

      try {
        const response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/rooms/${roomId}/messages`,
          {
            headers: buildMessagingHeaders(token),
          }
        )
        const payload = await parseApiResponse(response, 'Failed to load room messages.')
        const items = sortMessages((payload.items || []).map(normalizeMessage))
        setMessages(items)
        setError('')
      } catch (err) {
        setError(err.message || 'Failed to load room messages.')
        setMessages([])
      } finally {
        setLoadingMessages(false)
      }
    },
    [token]
  )

  const markConversationRead = useCallback(
    async (counterpartyId) => {
      if (!counterpartyId) return

      try {
        const response = await fetch(
          `${MESSAGING_API_BASE}/api/messages/conversations/${counterpartyId}/read`,
          {
            method: 'PATCH',
            headers: buildMessagingHeaders(token, { json: true }),
          }
        )
        const payload = await parseApiResponse(response, 'Failed to mark messages as read.')
        const messageIds = (payload.messageIds || []).map((item) => item.toString())

        if (messageIds.length) {
          setMessages((current) => markMessagesRead(current, messageIds))
        }

        setConversations((current) =>
          current.map((item) =>
            item.id === counterpartyId
              ? {
                ...item,
                unreadCount: 0,
              }
              : item
          )
        )
      } catch {
        // keep current UI state if read update fails
      }
    },
    [token]
  )

  const markRoomMessagesRead = useCallback(
    async (roomId) => {
      if (!roomId) return

      try {
        await fetch(`${MESSAGING_API_BASE}/api/messages/rooms/${roomId}/read`, {
          method: 'PATCH',
          headers: buildMessagingHeaders(token, { json: true }),
        })
      } catch {
        // no-op
      }
    },
    [token]
  )

  async function handleSendMessage(event) {
    event.preventDefault()

    const messageBody = draft.trim()
    if (!messageBody) return

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
        setConversations((current) =>
          sortItems(
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
        )
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

      await parseApiResponse(response, 'Failed to add members to group chat.')

      setAddMembersOpen(false)
      setError('')
      await fetchRooms(activeRoomId)
    } catch (err) {
      setError(err.message || 'Failed to add members to group chat.')
    } finally {
      setAddingMembers(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return

    if (!token || !currentUserId) {
      setError('Admin authentication is required to open messaging.')
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
      } else {
        setActiveType('private')
        setActiveConversationId(firstItem.id)
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
      markRoomMessagesRead(activeRoomId)
      return
    }

    if (!activeConversationId) {
      setMessages([])
      return
    }

    fetchConversationMessages(activeConversationId)
    markConversationRead(activeConversationId)
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

      if (firstItem.type === 'group') {
        setActiveType('group')
        setActiveRoomId(firstItem.id)
      } else {
        setActiveType('private')
        setActiveConversationId(firstItem.id)
      }
    }

    if (!filteredItems.length && searchTerm) {
      setMessages([])
    }
  }, [filteredItems, selectedItem, searchTerm])

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#7c4a2e] text-white shadow-xl transition hover:bg-[#6f4229]"
      >
        <MessageSquareMore className="h-7 w-7" />
        {totalUnreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[24px] rounded-full bg-red-500 px-1.5 py-1 text-center text-[11px] font-bold leading-none text-white">
            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
          </span>
        )}
      </button>

      <CreateGroupModal
        open={createRoomOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreate={handleCreateGroup}
        creating={creatingGroup}
        scholars={scholars}
        loadingScholars={loadingScholars}
        currentUserId={currentUserId}
      />

      <AddMembersModal
        open={addMembersOpen}
        onClose={() => setAddMembersOpen(false)}
        onAdd={handleAddMembers}
        adding={addingMembers}
        scholars={scholars}
        loadingScholars={loadingScholars}
      />

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-4 sm:p-6">
          <div className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 sm:px-5">
              <div className="text-sm font-semibold text-stone-900">Messages</div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreateGroupOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  <Users className="h-4 w-4" />
                  Group
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
                  onClick={() => setIsOpen(false)}
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

            <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
              <section className="flex min-h-0 flex-col border-b border-stone-200 xl:border-b-0 xl:border-r">
                <div className="space-y-2 border-b border-stone-100 px-4 py-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search..."
                      className="h-10 w-full rounded-lg border border-stone-200 bg-white pl-10 pr-4 text-sm text-stone-800 outline-none transition focus:border-[#7c4a2e] focus:ring-2 focus:ring-[#7c4a2e]/15"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setShowUnreadOnly((current) => !current)}
                      className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${showUnreadOnly
                          ? 'border-[#7c4a2e] bg-amber-50 text-[#7c4a2e]'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      Unread only
                    </button>

                    <p className="text-[11px] text-stone-500">
                      {filteredItems.length} thread{filteredItems.length === 1 ? '' : 's'}
                    </p>
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
                          onClick={() => {
                            if (item.type === 'group') {
                              setActiveType('group')
                              setActiveRoomId(item.id)
                            } else {
                              setActiveType('private')
                              setActiveConversationId(item.id)
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

              <section className="flex min-h-0 flex-col bg-white">
                {selectedItem ? (
                  <>
                    <div className="border-b border-stone-100 px-5 py-4">
                      <div className="flex items-center gap-2">
                        {selectedItem.type === 'group' ? (
                          <Users className="h-4 w-4 text-stone-500" />
                        ) : (
                          <UserRound className="h-4 w-4 text-stone-500" />
                        )}
                        <p className="text-base font-semibold text-stone-900">
                          {selectedItem.name}
                        </p>
                      </div>

                      <p className="mt-1 text-xs text-stone-500">
                        {selectedItem.type === 'group'
                          ? 'Group chat'
                          : selectedItem.studentNumber || 'No student number'}
                      </p>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto bg-stone-50/50 px-5 py-4">
                      {loadingMessages ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-stone-500">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Loading thread
                        </div>
                      ) : messages.length ? (
                        <div className="space-y-3">
                          {messages.map((message) => {
                            const isMine = message.senderId === currentUserId

                            return (
                              <MessageBubble
                                key={message.messageId}
                                message={message}
                                isMine={isMine}
                              />
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

                    <form
                      onSubmit={handleSendMessage}
                      className="border-t border-stone-100 bg-white px-5 py-3"
                    >
                      <div className="flex items-end gap-2">
                        <textarea
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          rows={2}
                          placeholder={
                            selectedItem.type === 'group'
                              ? 'Write a message to the group...'
                              : 'Write a reply...'
                          }
                          className="min-h-[72px] flex-1 resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 outline-none transition focus:border-[#7c4a2e] focus:ring-2 focus:ring-[#7c4a2e]/15"
                        />

                        <button
                          type="submit"
                          disabled={sending || !draft.trim()}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#7c4a2e] px-4 text-sm font-semibold text-white transition hover:bg-[#6f4229] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sending ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <SendHorizontal className="h-4 w-4" />
                              Send
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 px-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-[#7c4a2e]">
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}
