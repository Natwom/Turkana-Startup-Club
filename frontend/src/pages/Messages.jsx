import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'
import GroupChat from '../components/GroupChat'
import NewGroupModal from '../components/NewGroupModal'
import CallButtons from '../components/CallButtons'
import { OnlineDot, StatusText } from '../components/OnlineDot'
import { errorMessage, shortTime, dayLabel, initials } from '../components/chatUtils'

export default function Messages() {
  const { userId, groupId } = useParams()
  const navigate = useNavigate()
  const hasSelection = Boolean(userId || groupId)

  const [tab, setTab] = useState(groupId ? 'groups' : 'chats')
  const [conversations, setConversations] = useState([])
  const [groups, setGroups] = useState([])
  const [showNewGroup, setShowNewGroup] = useState(false)

  const [thread, setThread] = useState({ user: null, messages: [] })
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [query, setQuery] = useState('')
  const [loadingThread, setLoadingThread] = useState(false)

  const scrollRef = useRef(null)
  const areaRef = useRef(null)
  const stickToBottom = useRef(true)
  const firstLoad = useRef(true)

  // keep the active tab in sync with the URL (e.g. when opened from a notification)
  useEffect(() => {
    if (groupId) setTab('groups')
    else if (userId) setTab('chats')
  }, [groupId, userId])

  const loadConversations = useCallback(async () => {
    try {
      const r = await api.get('/messages/conversations')
      setConversations(Array.isArray(r.data) ? r.data : [])
    } catch {
      /* keep the previous list */
    }
  }, [])

  const loadGroups = useCallback(async () => {
    try {
      const r = await api.get('/groups')
      setGroups(Array.isArray(r.data) ? r.data : [])
    } catch {
      /* keep the previous list */
    }
  }, [])

  const loadThread = useCallback(async () => {
    if (!userId) return
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
      loadConversations()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      firstLoad.current = false
      setLoadingThread(false)
    }
  }, [userId, loadConversations])

  useEffect(() => {
    loadConversations()
    loadGroups()
    const t = setInterval(() => {
      loadConversations()
      loadGroups()
    }, 15000)
    return () => clearInterval(t)
  }, [loadConversations, loadGroups])

  useEffect(() => {
    setThread({ user: null, messages: [] })
    setError('')
    firstLoad.current = true
    stickToBottom.current = true
    loadThread()
    const t = setInterval(loadThread, 5000)
    return () => clearInterval(t)
  }, [loadThread])

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

  const switchTab = (next) => {
    setTab(next)
    setQuery('')
    navigate('/messages')
  }

  const handleGroupGone = useCallback(() => {
    loadGroups()
    navigate('/messages')
  }, [loadGroups, navigate])

  const unreadChats = conversations.reduce((n, c) => n + (c.unread || 0), 0)
  const unreadGroups = groups.reduce((n, g) => n + (g.unread || 0), 0)

  const visibleConvs = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return conversations
    return conversations.filter((c) => (c.full_name || '').toLowerCase().includes(needle))
  }, [conversations, query])

  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return groups
    return groups.filter((g) => (g.name || '').toLowerCase().includes(needle))
  }, [groups, query])

  const grouped = useMemo(() => {
    const out = []
    for (const m of thread.messages) {
      const day = new Date(m.created_at).toDateString()
      const last = out[out.length - 1]
      if (last && last.day === day) last.items.push(m)
      else out.push({ day, label: dayLabel(m.created_at), items: [m] })
    }
    return out
  }, [thread.messages])

  const tabBtn = (id, label, unread) => (
    <button
      onClick={() => switchTab(id)}
      className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors
        ${tab === id
          ? 'border-emerald-600 text-emerald-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
      {label}
      {unread > 0 && (
        <span className="bg-emerald-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center">
          {unread}
        </span>
      )}
    </button>
  )

  const showSearch = tab === 'chats' ? conversations.length > 3 : groups.length > 3

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-3 sm:mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Messages</h1>
        {(conversations.length > 0 || groups.length > 0) && (
          <span className="text-sm text-gray-500">{unreadChats + unreadGroups} unread</span>
        )}
      </div>

      {/* On phones only one panel shows at a time: the list, or the open chat. */}
      <div className="grid md:grid-cols-3 gap-4 h-[calc(100dvh-10.5rem)] min-h-[26rem] md:h-[72vh]">
        {/* Left column */}
        <div className={`${hasSelection ? 'hidden md:flex' : 'flex'} flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm min-h-0`}>
          <div className="flex border-b border-gray-100">
            {tabBtn('chats', 'Chats', unreadChats)}
            {tabBtn('groups', 'Groups', unreadGroups)}
          </div>

          {tab === 'groups' && (
            <div className="p-3 border-b border-gray-100">
              <button
                onClick={() => setShowNewGroup(true)}
                className="w-full text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 py-2 transition-colors"
              >
                + New group
              </button>
            </div>
          )}

          {showSearch && (
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tab === 'chats' ? 'Search conversations…' : 'Search groups…'}
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {tab === 'chats' ? (
              visibleConvs.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="text-3xl mb-2">💬</div>
                  <p className="text-sm text-gray-500">
                    {query ? 'No conversations match.' : 'Connect with members in the Directory to start chatting.'}
                  </p>
                </div>
              ) : (
                visibleConvs.map((c) => (
                  <button
                    key={c.user_id}
                    onClick={() => navigate(`/messages/${c.user_id}`)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors
                      ${c.user_id === userId ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="relative inline-flex shrink-0">
                          <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                            {initials(c.full_name)}
                          </span>
                          <OnlineDot userId={c.user_id} className="h-2.5 w-2.5" />
                        </span>
                        <span className={`text-sm truncate ${c.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {c.full_name}
                        </span>
                      </span>
                      <span className="text-[11px] text-gray-400 shrink-0">{shortTime(c.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1 pl-[2.625rem]">
                      <p className={`text-xs truncate ${c.unread ? 'text-gray-800' : 'text-gray-500'}`}>
                        {c.last_message ? `${c.last_from_me ? 'You: ' : ''}${c.last_message}` : 'Say hello 👋'}
                      </p>
                      {c.unread > 0 && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center shrink-0">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )
            ) : visibleGroups.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-2">👥</div>
                <p className="text-sm text-gray-500">
                  {query ? 'No groups match.' : 'Create a group to chat with several connections at once.'}
                </p>
              </div>
            ) : (
              visibleGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/messages/group/${g.id}`)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors
                    ${g.id === groupId ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm">
                        👥
                      </span>
                      <span className={`text-sm truncate ${g.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {g.name}
                      </span>
                    </span>
                    <span className="text-[11px] text-gray-400 shrink-0">{shortTime(g.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 pl-[2.625rem]">
                    <p className={`text-xs truncate ${g.unread ? 'text-gray-800' : 'text-gray-500'}`}>
                      {g.last_message
                        ? `${g.last_from_me ? 'You' : g.last_sender.split(' ')[0]}: ${g.last_message}`
                        : `${g.member_count} members`}
                    </p>
                    {g.unread > 0 && (
                      <span className="bg-emerald-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center shrink-0">
                        {g.unread}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div className={`${hasSelection ? 'flex' : 'hidden md:flex'} md:col-span-2 flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm min-h-0`}>
          {hasSelection && (
            <div className="md:hidden px-3 py-2 border-b border-gray-100">
              <button onClick={() => navigate('/messages')}
                className="text-sm font-medium text-emerald-700 hover:underline">
                ← Back
              </button>
            </div>
          )}

          {groupId ? (
            <GroupChat key={groupId} groupId={groupId} onChanged={loadGroups} onGone={handleGroupGone} />
          ) : !userId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-400 px-4 text-center">
              <div className="text-4xl mb-3">✉</div>
              Select a conversation or group to start messaging.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                <span className="relative inline-flex shrink-0">
                  <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                    {initials(thread.user?.full_name)}
                  </span>
                  <OnlineDot userId={userId} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{thread.user?.full_name || '…'}</p>
                  <p className="text-xs text-gray-500 truncate">
                    <StatusText userId={userId} />
                    {thread.user?.role && <span> · {thread.user.role}</span>}
                  </p>
                </div>
                <CallButtons userId={userId} name={thread.user?.full_name || 'this member'} />
              </div>

              <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-50/60">
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
                            <div
                              className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm shadow-sm
                                ${theirs
                                  ? 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                                  : 'bg-emerald-600 text-white rounded-br-md'}`}
                            >
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

              {error && <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-t border-red-200">{error}</div>}

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
                    className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-[120px]"
                  />
                  <button
                    type="submit"
                    disabled={sending || !text.trim()}
                    className="px-4 py-2.5 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors shrink-0"
                  >
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

      {showNewGroup && (
        <NewGroupModal
          onClose={() => setShowNewGroup(false)}
          onCreated={(g) => {
            setShowNewGroup(false)
            loadGroups()
            setTab('groups')
            navigate(`/messages/group/${g.id}`)
          }}
        />
      )}
    </div>
  )
}