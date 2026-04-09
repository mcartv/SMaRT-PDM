import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import {
  LoaderCircle,
  MessageSquareMore,
  SendHorizonal,
  UserRound,
  Search,
  X,
  Filter,
  RefreshCw,
} from 'lucide-react'
import {
  buildMessagingHeaders,
  getAdminMessagingToken,
  MESSAGING_API_BASE,
  MESSAGING_SOCKET_BASE,
  parseMessagingToken,
} from '../lib/messaging-config'

function normalizeConversation(raw = {}) {
  return {
    counterpartyId: raw.counterpartyId?.toString() || '',
    name: raw.name?.toString() || 'Unknown user',
    studentNumber: raw.studentNumber?.toString() || '',
    lastMessage: raw.lastMessage?.toString() || '',
    lastSentAt: raw.lastSentAt?.toString() || '',
    unreadCount: Number(raw.unreadCount || 0),
  }
}

function normalizeMessage(raw = {}) {
  return {
    messageId: raw.messageId?.toString() || '',
    senderId: raw.senderId?.toString() || '',
    receiverId: raw.receiverId?.toString() || '',
    messageBody: raw.messageBody?.toString() || '',
    sentAt: raw.sentAt?.toString() || '',
    isRead: raw.isRead === true,
    subject: raw.subject?.toString() || null,
    attachmentUrl: raw.attachmentUrl?.toString() || null,
  }
}

function sortMessages(items = []) {
  return [...items].sort(
    (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime()
  )
}

function sortConversations(items = []) {
  return [...items].sort(
    (left, right) =>
      new Date(right.lastSentAt || 0).getTime() - new Date(left.lastSentAt || 0).getTime()
  )
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
  if (!value) {
    return ''
  }

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
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

async function parseApiResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || payload.message || fallbackMessage)
  }

  return payload
}

export default function AdminMessages() {
  const token = getAdminMessagingToken()
  const tokenPayload = parseMessagingToken(token)
  const currentUserId =
    tokenPayload.user_id || tokenPayload.userId || tokenPayload.sub || ''

  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState('')
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)

  const activeConversationRef = useRef('')
  const currentUserIdRef = useRef(currentUserId)
  const messagesEndRef = useRef(null)
  const socketRef = useRef(null)

  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0),
    [conversations]
  )

  const filteredConversations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return sortConversations(
      conversations.filter((conversation) => {
        const matchesUnread = showUnreadOnly ? conversation.unreadCount > 0 : true

        const matchesSearch = query
          ? (
              conversation.name ||
              conversation.studentNumber ||
              conversation.lastMessage
            )
              .toLowerCase()
              .includes(query)
          : true

        return matchesUnread && matchesSearch
      })
    )
  }, [conversations, searchTerm, showUnreadOnly])

  const selectedConversation = filteredConversations.find(
    (item) => item.counterpartyId === activeConversationId
  ) || conversations.find((item) => item.counterpartyId === activeConversationId)

  useEffect(() => {
    activeConversationRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

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
        const items = sortConversations((payload.items || []).map(normalizeConversation))

        setConversations(items)
        setError('')

        if (!items.length) {
          setActiveConversationId('')
          setMessages([])
          return
        }

        const nextConversationId = items.some(
          (item) => item.counterpartyId === preferredConversationId
        )
          ? preferredConversationId
          : items[0].counterpartyId

        setActiveConversationId(nextConversationId)
      } catch (err) {
        setError(err.message || 'Failed to load conversations.')
      } finally {
        setLoadingConversations(false)
      }
    },
    [token]
  )

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

  const markConversationRead = useCallback(
    async (counterpartyId) => {
      if (!counterpartyId) {
        return
      }

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
            item.counterpartyId === counterpartyId
              ? {
                  ...item,
                  unreadCount: 0,
                }
              : item
          )
        )
      } catch {
        // Keep the current UI state if the read acknowledgement fails.
      }
    },
    [token]
  )

  async function handleSendMessage(event) {
    event.preventDefault()

    const messageBody = draft.trim()
    if (!messageBody || !activeConversationId) {
      return
    }

    setSending(true)

    try {
      const response = await fetch(
        `${MESSAGING_API_BASE}/api/messages/conversations/${activeConversationId}`,
        {
          method: 'POST',
          headers: buildMessagingHeaders(token, { json: true }),
          body: JSON.stringify({ messageBody }),
        }
      )
      const payload = await parseApiResponse(response, 'Failed to send message.')
      const message = normalizeMessage(payload)

      setMessages((current) => upsertMessage(current, message))
      setConversations((current) => {
        const next = current.map((item) =>
          item.counterpartyId === activeConversationId
            ? {
                ...item,
                lastMessage: message.messageBody,
                lastSentAt: message.sentAt,
              }
            : item
        )

        return sortConversations(next)
      })
      setDraft('')
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (!token || !currentUserId) {
      setError('Admin authentication is required to open messaging.')
      setLoadingConversations(false)
      return undefined
    }

    fetchConversations()

    const socket = io(MESSAGING_SOCKET_BASE, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token },
    })

    socketRef.current = socket
    socket.connect()

    socket.on('message:new', (rawPayload) => {
      const message = normalizeMessage(rawPayload || {})
      if (!message.messageId) {
        return
      }

      const selfUserId = currentUserIdRef.current
      const counterpartyId =
        message.senderId === selfUserId ? message.receiverId : message.senderId

      setMessages((current) =>
        activeConversationRef.current === counterpartyId
          ? upsertMessage(current, message)
          : current
      )

      setConversations((current) => {
        const next = [...current]
        const index = next.findIndex((item) => item.counterpartyId === counterpartyId)

        if (index < 0) {
          fetchConversations(counterpartyId)
          return current
        }

        const existing = next[index]
        const nextUnreadCount =
          message.receiverId === selfUserId && !message.isRead
            ? existing.unreadCount + 1
            : existing.unreadCount

        next[index] = {
          ...existing,
          lastMessage: message.messageBody,
          lastSentAt: message.sentAt,
          unreadCount: nextUnreadCount,
        }

        return sortConversations(next)
      })

      if (
        activeConversationRef.current === counterpartyId &&
        message.receiverId === selfUserId &&
        !message.isRead
      ) {
        markConversationRead(counterpartyId)
      }
    })

    socket.on('message:read', (rawPayload) => {
      const payload = rawPayload || {}
      const messageIds = (payload.messageIds || []).map((item) => item.toString())
      const counterpartyId = payload.counterpartyId?.toString() || ''
      const readerId = payload.readerId?.toString() || ''

      if (!messageIds.length) {
        return
      }

      setMessages((current) => markMessagesRead(current, messageIds))

      if (readerId === currentUserIdRef.current && counterpartyId) {
        setConversations((current) =>
          current.map((item) =>
            item.counterpartyId === counterpartyId
              ? {
                  ...item,
                  unreadCount: 0,
                }
              : item
          )
        )
      }
    })

    return () => {
      socket.disconnect()
      socket.removeAllListeners()
      socketRef.current = null
    }
  }, [currentUserId, fetchConversations, markConversationRead, token])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (!activeConversationId && conversations.length) {
      setActiveConversationId(conversations[0].counterpartyId)
    }
  }, [isOpen, activeConversationId, conversations])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (!activeConversationId) {
      setMessages([])
      return
    }

    fetchConversationMessages(activeConversationId)
    markConversationRead(activeConversationId)
  }, [isOpen, activeConversationId, fetchConversationMessages, markConversationRead])

  useEffect(() => {
    if (!selectedConversation && filteredConversations.length) {
      setActiveConversationId(filteredConversations[0].counterpartyId)
    }

    if (!filteredConversations.length && searchTerm) {
      setMessages([])
    }
  }, [filteredConversations, selectedConversation, searchTerm])

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

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-4 sm:p-6">
          <div className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 sm:px-6">
              <div>
                <h1 className="text-xl font-semibold text-stone-900">Messages</h1>
                <p className="mt-1 text-sm text-stone-500">
                  Respond to student messages from the fixed admin office thread.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchConversations(activeConversationId)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {error && (
              <div className="mx-5 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
                {error}
              </div>
            )}

            <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[340px_minmax(0,1fr)]">
              <section className="flex min-h-0 flex-col border-b border-stone-200 xl:border-b-0 xl:border-r">
                <div className="space-y-3 border-b border-stone-100 px-4 py-4 sm:px-5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search conversations..."
                      className="h-11 w-full rounded-2xl border border-stone-200 bg-white pl-10 pr-4 text-sm text-stone-800 outline-none transition focus:border-[#7c4a2e] focus:ring-2 focus:ring-[#7c4a2e]/15"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setShowUnreadOnly((current) => !current)}
                      className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition ${
                        showUnreadOnly
                          ? 'border-[#7c4a2e] bg-amber-50 text-[#7c4a2e]'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <Filter className="h-4 w-4" />
                      Unread only
                    </button>

                    <p className="text-xs text-stone-500">
                      {filteredConversations.length} conversation
                      {filteredConversations.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {loadingConversations ? (
                    <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-stone-500">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading conversations
                    </div>
                  ) : filteredConversations.length ? (
                    filteredConversations.map((conversation) => {
                      const isActive = conversation.counterpartyId === activeConversationId

                      return (
                        <button
                          key={conversation.counterpartyId}
                          type="button"
                          onClick={() => setActiveConversationId(conversation.counterpartyId)}
                          className={`flex w-full items-start gap-3 border-b border-stone-100 px-4 py-4 text-left transition sm:px-5 ${
                            isActive ? 'bg-amber-50/70' : 'hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">
                            <UserRound className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-stone-900">
                                  {conversation.name}
                                </p>
                                <p className="truncate text-xs text-stone-500">
                                  {conversation.studentNumber || 'No student number'}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                <span className="text-[11px] text-stone-400">
                                  {formatConversationTime(conversation.lastSentAt)}
                                </span>
                                {conversation.unreadCount > 0 && (
                                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    {conversation.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>

                            <p className="mt-1 truncate text-sm text-stone-600">
                              {conversation.lastMessage || 'No messages yet'}
                            </p>
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <div className="px-6 py-14 text-center text-sm text-stone-500">
                      {searchTerm || showUnreadOnly
                        ? 'No conversations match the current filter.'
                        : 'No student conversations yet.'}
                    </div>
                  )}
                </div>
              </section>

              <section className="flex min-h-0 flex-col bg-white">
                {selectedConversation ? (
                  <>
                    <div className="border-b border-stone-100 px-5 py-4 sm:px-6 sm:py-5">
                      <p className="text-lg font-semibold text-stone-900">
                        {selectedConversation.name}
                      </p>
                      <p className="mt-1 text-sm text-stone-500">
                        {selectedConversation.studentNumber || 'No student number'}
                      </p>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto bg-stone-50/50 px-5 py-5 sm:px-6">
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
                              <div
                                key={message.messageId}
                                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-[85%] rounded-3xl px-4 py-3 shadow-sm sm:max-w-[75%] ${
                                    isMine
                                      ? 'bg-[#7c4a2e] text-white'
                                      : 'border border-stone-200 bg-white text-stone-800'
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap text-sm leading-6">
                                    {message.messageBody}
                                  </p>
                                  <div
                                    className={`mt-2 text-[11px] ${
                                      isMine ? 'text-amber-100' : 'text-stone-400'
                                    }`}
                                  >
                                    {formatMessageTime(message.sentAt)}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-stone-500">
                          No messages in this conversation yet.
                        </div>
                      )}
                    </div>

                    <form
                      onSubmit={handleSendMessage}
                      className="border-t border-stone-100 bg-white px-5 py-4 sm:px-6"
                    >
                      <div className="flex items-end gap-3">
                        <textarea
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          rows={3}
                          placeholder="Write a reply to the student..."
                          className="min-h-[88px] flex-1 resize-none rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-800 outline-none transition focus:border-[#7c4a2e] focus:ring-2 focus:ring-[#7c4a2e]/15"
                        />

                        <button
                          type="submit"
                          disabled={sending || !draft.trim()}
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#7c4a2e] px-5 text-sm font-semibold text-white transition hover:bg-[#6f4229] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sending ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <SendHorizonal className="h-4 w-4" />
                          )}
                          Send
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 px-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-[#7c4a2e]">
                      <MessageSquareMore className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-stone-900">
                        Select a conversation
                      </p>
                      <p className="mt-2 text-sm text-stone-500">
                        Choose a student from the left to load the admin thread.
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