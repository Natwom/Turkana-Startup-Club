import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'

const errorMessage = (err) => {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return 'Something went wrong. Please try again.'
}

const shortTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

const dayLabel = (iso) => {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
}

const initials = (name = '?') =>
  name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

export default function Messages() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [thread, setThread] = useState({ user: null, messages: [] })
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [query, setQuery] = useState('')
  const [loadingThread, setLoadingThread] = useState(false)

  const scrollRef = useRef(null)   // the scrollable message list
  const areaRef = useRef(null)     // the textarea
  const stickToBottom = useRef(true)
  const firstLoad = useRef(true)

  const loadConversations = useCallback(async () => {
    try {
      const r = await api.get('/messages/conversations')
      setConversations(Array.isArray(r.data) ? r.data : [])
    } catch {
      /* keep the previous list */
    }
  }, [])

  const loadThread = useCallback(async () => {
    if (!userId) return
    // Only show the skeleton the first time a conversation opens,
    // not on every background refresh (that caused the up/down jumping).
    if (firstLoad.current) setLoadingThread(true)
    try {
      const r = await api.get(`/messages/${userId}`)
      setThread((prev) => {
        const prevLast = prev.messages[prev.messages.length - 1]?.id
        const nextLast = r.data.messages?.[r.data.messages.length - 1]?.id
        const same =
          prev.user?.full_name === r.data.user?.full_name &&
          prev.messages.length === (r.data.messages?.length || 0) &&
          prevLast === nextLast
        return same ? prev : r.data
      })
      setError('')
      loadConversations() // unread counts changed because the thread was opened
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      firstLoad.current = false
      setLoadingThread(false)
    }
  }, [userId, loadConversations])

  useEffect(() => {
    loadConversations()
    const t = setInterval(loadConversations, 15000)
    return () => clearInterval(t)
  }, [loadConversations])

  useEffect(() => {
    setThread({ user: null, messages: [] })
    setError('')
    firstLoad.current = true
    stickToBottom.current = true
    loadThread()
    const t = setInterval(loadThread, 5000)
    return () => clearInterval(t)
  }, [loadThread])

  // Scroll ONLY the message list (never the whole page) when new messages arrive
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [thread.messages.length])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  // Auto-grow the textarea up to 5 lines
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [text])

  const send = async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const r = await api.post(`/messages/${userId}`, { content })
      setThread((t) => ({ ...t, messages: [...t.messages, r.data] }))
      setText('')
      setError('')
      stickToBottom.current = true
      loadConversations()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const visibleConvs = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return conversations
    return conversations.filter((c) => (c.full_name || '').toLowerCase().includes(needle))
  }, [conversations, query])

  // Group messages by day for date dividers
  const grouped = useMemo(() => {
    const groups = []
    for (const m of thread.messages) {
      const day = new Date(m.created_at).toDateString()
      const last = groups[groups.length - 1]
      if (last && last.day === day) last.items.push(m)
      else groups.push({ day, label: dayLabel(m.created_at), items: [m] })
    }
    return groups
  }, [thread.messages])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Messages</h1>
        {conversations.length > 0 && (
          <span className="text-sm text-gray-500">
            {conversations.reduce((n, c) => n + (c.unread || 0), 0)} unread
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4 h-[72vh]">
        {/* Conversation list */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
          {conversations.length > 3 && (
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search conversations…"
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {visibleConvs.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-sm text-gray-500">
                  {query ? 'No conversations match.' : 'Connect with members in the Directory to start chatting.'}
                </p>
              </div>
            ) : visibleConvs.map((c) => (
              <button key={c.user_id} onClick={() => navigate(`/messages/${c.user_id}`)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors
                  ${c.user_id === userId ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                      {initials(c.full_name)}
                    </span>
                    <span className={`text-sm truncate ${c.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {c.full_name}
                    </span>
                  </span>
                  <span className="text-[11px] text-gray-400 shrink-0">{shortTime(c.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1 pl-[2.625rem]">
                  <p className={`text-xs truncate ${c.unread ? 'text-gray-800' : 'text-gray-500'}`}>
                    {c.last_message
                      ? `${c.last_from_me ? 'You: ' : ''}${c.last_message}`
                      : 'Say hello 👋'}
                  </p>
                  {c.unread > 0 && (
                    <span className="bg-emerald-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center shrink-0">
                      {c.unread}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          {!userId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-400">
              <div className="text-4xl mb-3">✉</div>
              Select a conversation to start messaging.
            </div>
          ) : (
            <>
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                  {initials(thread.user?.full_name)}
                </span>
                <div>
                  <p className="font-semibold text-gray-900">{thread.user?.full_name || '…'}</p>
                  {thread.user?.role && <p className="text-xs text-gray-500">{thread.user.role}</p>}
                </div>
              </div>

              <div ref={scrollRef} onScroll={onScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/60">
                {loadingThread && (
                  <div className="space-y-3 animate-pulse pt-2">
                    <div className="h-8 w-1/2 bg-gray-100 rounded-2xl" />
                    <div className="h-8 w-2/5 bg-emerald-100 rounded-2xl ml-auto" />
                    <div className="h-8 w-1/3 bg-gray-100 rounded-2xl" />
                  </div>
                )}
                {!loadingThread && thread.messages.length === 0 && !error && (
                  <div className="text-center pt-12">
                    <div className="text-3xl mb-2">👋</div>
                    <p className="text-sm text-gray-400">No messages yet. Start the conversation.</p>
                  </div>
                )}
                {grouped.map((g) => (
                  <div key={g.day}>
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-[11px] font-medium text-gray-400">{g.label}</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <div className="space-y-1.5">
                      {g.items.map((m) => {
                        const theirs = m.sender_id === userId
                        return (
                          <div key={m.id} className={`flex ${theirs ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm shadow-sm
                              ${theirs
                                ? 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                                : 'bg-emerald-600 text-white rounded-br-md'}`}>
                              <p className="whitespace-pre-wrap break-words">{m.content}</p>
                              <p className={`text-[10px] mt-1 text-right ${theirs ? 'text-gray-400' : 'text-emerald-200'}`}>
                                {shortTime(m.created_at)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-t border-red-200">{error}</div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); send() }} className="p-3 border-t border-gray-100 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={areaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    maxLength={2000}
                    placeholder="Type a message…"
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-[120px]"
                  />
                  <button type="submit" disabled={sending || !text.trim()}
                    className="px-4 py-2.5 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors shrink-0">
                    {sending ? '…' : 'Send ➤'}
                  </button>
                </div>
                <div className="flex justify-end mt-1 px-1">
                  <span className={`text-[10px] ${text.length > 1800 ? 'text-red-500' : 'text-gray-400'}`}>
                    {text.length}/2000
                  </span>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}