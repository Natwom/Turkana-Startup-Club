import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import MemberPicker from './MemberPicker'
import VerifiedBadge from './VerifiedBadge'
import { errorMessage, shortTime, dayLabel, initials } from './chatUtils'

/* ------------------------------------------------------------ group info modal */
function GroupInfo({ group, myId, onClose, onReload, onGone }) {
  const isAdmin = group.my_role === 'admin'
  const [adding, setAdding] = useState(false)
  const [connections, setConnections] = useState([])
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!adding) return
    api
      .get('/members/connections')
      .then((r) => {
        const inGroup = new Set(group.members.map((m) => m.user_id))
        setConnections((Array.isArray(r.data) ? r.data : []).filter((c) => !inGroup.has(c.user_id)))
      })
      .catch(() => {})
  }, [adding, group.members])

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const addMembers = () =>
    run(async () => {
      await api.post(`/groups/${group.id}/members`, { user_ids: selected })
      setSelected([])
      setAdding(false)
      await onReload()
    })

  const removeMember = (m) => {
    if (!window.confirm(`Remove ${m.full_name} from this group?`)) return
    run(async () => {
      await api.delete(`/groups/${group.id}/members/${m.user_id}`)
      await onReload()
    })
  }

  const leave = () => {
    if (!window.confirm('Leave this group?')) return
    run(async () => {
      await api.delete(`/groups/${group.id}/members/${myId}`)
      onGone()
    })
  }

  const deleteGroup = () => {
    if (!window.confirm('Delete this group for everyone? This cannot be undone.')) return
    run(async () => {
      await api.delete(`/groups/${group.id}`)
      onGone()
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 break-words">{group.name}</h2>
            {group.description && <p className="text-sm text-gray-500 mt-0.5 break-words">{group.description}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">{group.members.length} members</h3>
            {isAdmin && !adding && (
              <button onClick={() => setAdding(true)} className="text-sm font-medium text-emerald-700 hover:underline">
                + Add members
              </button>
            )}
          </div>

          {adding && (
            <div className="mb-3 space-y-2">
              <MemberPicker
                options={connections}
                selected={selected}
                onToggle={toggle}
                emptyText="All your connections are already in this group."
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setAdding(false); setSelected([]) }}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={addMembers} disabled={busy || selected.length === 0}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
                  Add {selected.length > 0 ? `(${selected.length})` : ''}
                </button>
              </div>
            </div>
          )}

          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {group.members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-8 h-8 shrink-0 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                  {initials(m.full_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-medium text-gray-800 min-w-0">
                    <span className="truncate">{m.full_name}{m.user_id === myId ? ' (you)' : ''}</span>
                    {m.is_badge_verified && <VerifiedBadge className="h-3.5 w-3.5" />}
                  </span>
                  {m.role && <span className="block text-xs text-gray-500 truncate">{m.role}</span>}
                </span>
                {m.group_role === 'admin' && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    Admin
                  </span>
                )}
                {isAdmin && m.user_id !== myId && (
                  <button onClick={() => removeMember(m)} disabled={busy}
                    className="text-xs text-red-600 hover:underline disabled:opacity-40">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <button onClick={leave} disabled={busy}
            className="px-3 py-2 text-sm rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40">
            Leave group
          </button>
          {isAdmin && (
            <button onClick={deleteGroup} disabled={busy}
              className="px-3 py-2 text-sm rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-40">
              Delete group
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ group chat panel */
export default function GroupChat({ groupId, onChanged, onGone }) {
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showInfo, setShowInfo] = useState(false)

  const scrollRef = useRef(null)
  const areaRef = useRef(null)
  const stickToBottom = useRef(true)

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/groups/${groupId}`)
      const { messages: msgs, ...info } = r.data
      setGroup(info)
      setMessages((prev) => {
        const same =
          prev.length === msgs.length && prev[prev.length - 1]?.id === msgs[msgs.length - 1]?.id
        return same ? prev : msgs
      })
      setError('')
      onChanged?.() // unread counts changed because the group was opened
    } catch (err) {
      const status = err.response?.status
      if (status === 404 || status === 403) {
        onGone?.() // removed from the group, or it was deleted
        return
      }
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [groupId, onChanged, onGone])

  useEffect(() => {
    stickToBottom.current = true
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

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
      const r = await api.post(`/groups/${groupId}/messages`, { content })
      setMessages((m) => [...m, r.data])
      setText('')
      setError('')
      stickToBottom.current = true
      onChanged?.()
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

  const grouped = useMemo(() => {
    const groups = []
    for (const m of messages) {
      const day = new Date(m.created_at).toDateString()
      const last = groups[groups.length - 1]
      if (last && last.day === day) last.items.push(m)
      else groups.push({ day, label: dayLabel(m.created_at), items: [m] })
    }
    return groups
  }, [messages])

  const myId = user?.id

  return (
    <>
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-base">
          👥
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{group?.name || '…'}</p>
          {group && <p className="text-xs text-gray-500">{group.members.length} members</p>}
        </div>
        <button
          onClick={() => setShowInfo(true)}
          disabled={!group}
          className="text-sm font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg px-3 py-1.5 disabled:opacity-40"
        >
          Group info
        </button>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/60">
        {loading && (
          <div className="space-y-3 animate-pulse pt-2">
            <div className="h-8 w-1/2 bg-gray-100 rounded-2xl" />
            <div className="h-8 w-2/5 bg-emerald-100 rounded-2xl ml-auto" />
            <div className="h-8 w-1/3 bg-gray-100 rounded-2xl" />
          </div>
        )}
        {!loading && messages.length === 0 && !error && (
          <div className="text-center pt-12">
            <div className="text-3xl mb-2">👋</div>
            <p className="text-sm text-gray-400">No messages yet. Say hello to the group.</p>
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
              {g.items.map((m, i) => {
                const mine = m.sender_id === myId
                const showName = !mine && g.items[i - 1]?.sender_id !== m.sender_id
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm shadow-sm
                        ${mine
                          ? 'bg-emerald-600 text-white rounded-br-md'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'}`}
                    >
                      {showName && (
                        <p className="flex items-center gap-1 text-xs font-semibold text-emerald-700 mb-0.5">
                          <span>{m.sender_name}</span>
                          {m.sender_badge && <VerifiedBadge className="h-3.5 w-3.5" />}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p className={`text-[10px] mt-1 text-right ${mine ? 'text-emerald-200' : 'text-gray-400'}`}>
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
            placeholder="Message the group…"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-[120px]"
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

      {showInfo && group && (
        <GroupInfo
          group={group}
          myId={myId}
          onClose={() => setShowInfo(false)}
          onReload={load}
          onGone={() => { setShowInfo(false); onChanged?.(); onGone?.() }}
        />
      )}
    </>
  )
}