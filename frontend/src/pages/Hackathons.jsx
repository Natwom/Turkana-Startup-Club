import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../services/api'

/* ── Inline SVG icons (no extra dependency needed) ── */
const ICONS = {
  calendar: [
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  ],
  pin: [
    'M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    'M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z',
  ],
  globe: [
    'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418',
  ],
  video: [
    'm15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z',
  ],
  search: ['m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z'],
  check: ['m4.5 12.75 6 6 9-13.5'],
  x: ['M6 18 18 6M6 6l12 12'],
  refresh: [
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99',
  ],
  arrowRight: ['M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3'],
  ticket: [
    'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z',
    'M14 6v2m0 3v2m0 3v2',
  ],
  flag: [
    'M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5',
  ],
}

function Icon({ name, className = 'w-4 h-4' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      {(ICONS[name] || []).map((d, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
      ))}
    </svg>
  )
}

const BADGE = {
  upcoming: 'bg-sky-50 text-sky-700 ring-sky-200',
  live: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  judging: 'bg-amber-50 text-amber-700 ring-amber-200',
  completed: 'bg-gray-100 text-gray-600 ring-gray-200',
}

const STATUS_ORDER = { live: 0, upcoming: 1, judging: 2, completed: 3 }

const MODE_LABEL = { online: 'Online', in_person: 'In person', hybrid: 'Hybrid' }
const MODE_BADGE = {
  online: 'bg-violet-50 text-violet-700 ring-violet-200',
  in_person: 'bg-gray-100 text-gray-600 ring-gray-200',
  hybrid: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
}

const TASK_STATE = {
  open: ['Open', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  upcoming: ['Not open yet', 'bg-sky-50 text-sky-700 ring-sky-200'],
  closed: ['Closed', 'bg-gray-100 text-gray-600 ring-gray-200'],
}

const userTimeZone = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return '' }
})()

const fmt = (d) =>
  d ? new Date(d).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : null

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null

const fmtTime = (d) =>
  d ? new Date(d).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' }) : null

const msg = (err, fallback) => {
  const d = err?.response?.data?.detail
  return typeof d === 'string' ? d : fallback
}

const modeOf = (h) => h?.mode || 'in_person'

const SKELETONS = Array.from({ length: 3 })

function countdownParts(target) {
  const diff = new Date(target) - Date.now()
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return { d, h, m }
}

function Countdown({ target, prefix = 'Starts in' }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])
  const c = countdownParts(target)
  if (!c) return null
  return (
    <span className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1 font-medium">
      {prefix} {c.d > 0 && `${c.d}d `}{c.h}h {c.m}m
    </span>
  )
}

function AvatarStack({ count }) {
  const shown = Math.min(count, 3)
  return (
    <span className="flex items-center -space-x-1.5">
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i}
          className="w-5 h-5 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-emerald-700">
          {String.fromCharCode(65 + i)}
        </span>
      ))}
      {count > 3 && (
        <span className="w-5 h-5 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-semibold text-gray-500">
          +{count - 3}
        </span>
      )}
    </span>
  )
}

function ModeBadge({ mode }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${MODE_BADGE[mode] ?? MODE_BADGE.in_person}`}>
      {mode !== 'in_person' && <Icon name="globe" className="w-3 h-3" />}
      {MODE_LABEL[mode] ?? mode}
    </span>
  )
}

function Where({ h, className = '' }) {
  const mode = modeOf(h)
  if (mode === 'online') {
    return (
      <p className={`text-sm text-gray-500 flex items-center gap-2 ${className}`}>
        <Icon name="globe" className="w-4 h-4 text-gray-400 shrink-0" />
        <span>Online — join from anywhere</span>
      </p>
    )
  }
  if (!h.venue) {
    return mode === 'hybrid' ? (
      <p className={`text-sm text-gray-500 flex items-center gap-2 ${className}`}>
        <Icon name="globe" className="w-4 h-4 text-gray-400 shrink-0" />
        <span>In person + online</span>
      </p>
    ) : null
  }
  return (
    <p className={`text-sm text-gray-500 flex items-center gap-2 ${className}`}>
      <Icon name="pin" className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="truncate">{h.venue}{mode === 'hybrid' ? ' · also online' : ''}</span>
    </p>
  )
}

/* ── One task: instructions, deadline, submission form, score ── */
function TaskCard({ hackathonId, task, onSaved }) {
  const sub = task.submission
  const [editing, setEditing] = useState(false)
  const [link, setLink] = useState(sub?.link || '')
  const [text, setText] = useState(sub?.text || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [stateLabel, stateCls] = TASK_STATE[task.state] ?? TASK_STATE.closed
  const needsLink = task.submission_type !== 'text'
  const needsText = task.submission_type !== 'link'
  const reviewed = Boolean(sub?.reviewed)
  const canSubmit = task.state === 'open' && !reviewed
  const showForm = canSubmit && (!sub || editing)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const r = await api.post(`/hackathons/${hackathonId}/tasks/${task.id}/submit`, { link, text })
      setEditing(false)
      onSaved(r.data?.message || 'Submission saved')
    } catch (ex) {
      setErr(msg(ex, 'Could not save your submission'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-slate-50/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">{task.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{task.points} points</p>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset whitespace-nowrap ${stateCls}`}>
          {stateLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
        {task.opens_at && <span>Opens {fmt(task.opens_at)}</span>}
        {task.closes_at && <span>· Closes {fmt(task.closes_at)}</span>}
        {task.state === 'open' && task.closes_at && <Countdown target={task.closes_at} prefix="Closes in" />}
        {task.state === 'upcoming' && task.opens_at && <Countdown target={task.opens_at} prefix="Opens in" />}
      </div>

      {task.instructions && (
        <p className="text-sm text-gray-700 mt-3 whitespace-pre-line leading-relaxed">{task.instructions}</p>
      )}
      {task.state === 'upcoming' && (
        <p className="text-sm text-gray-500 mt-3">Instructions will appear when this task opens.</p>
      )}

      {sub && !showForm && (
        <div className="mt-3 rounded-lg bg-white border border-gray-200 p-3 text-sm">
          <p className="text-xs font-semibold text-gray-500">Your submission</p>
          {sub.link && (
            <a href={sub.link} target="_blank" rel="noopener noreferrer"
              className="block break-all text-emerald-700 hover:underline mt-1">{sub.link}</a>
          )}
          {sub.text && <p className="text-gray-700 whitespace-pre-line mt-1">{sub.text}</p>}
          {reviewed ? (
            <div className="mt-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
              <p className="text-emerald-800 font-semibold">Score: {sub.score}/{task.points}</p>
              {sub.feedback && <p className="text-emerald-800 mt-0.5 whitespace-pre-line">{sub.feedback}</p>}
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-2">Submitted — waiting for review.</p>
          )}
          {canSubmit && (
            <button onClick={() => setEditing(true)}
              className="mt-2 text-sm text-emerald-700 font-medium hover:underline">
              Edit submission
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="mt-3 space-y-3">
          {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
          {needsLink && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Link (GitHub, demo, Drive…)
              </label>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          )}
          {needsText && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Your answer</label>
              <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {busy ? 'Saving…' : sub ? 'Update submission' : 'Submit'}
            </button>
            {editing && (
              <button type="button" onClick={() => { setEditing(false); setErr('') }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {task.state === 'closed' && !sub && (
        <p className="text-sm text-gray-500 mt-3">This task is closed and no submission was made.</p>
      )}
    </div>
  )
}

export default function Hackathons() {
  const [items, setItems] = useState([])
  const [joined, setJoined] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)

  const [statusFilter, setStatusFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [mineOnly, setMineOnly] = useState(false)
  const [query, setQuery] = useState('')

  // join flow (registration questions)
  const [joinFor, setJoinFor] = useState(null)
  const [joinAnswers, setJoinAnswers] = useState({})
  const [joinErr, setJoinErr] = useState('')
  const [joining, setJoining] = useState(false)

  // tasks for the open hackathon
  const [tasks, setTasks] = useState(null)

  const detailId = detail?.id

  const flash = (text) => {
    setNotice(text)
    setTimeout(() => setNotice(''), 5000)
  }

  const load = useCallback(async () => {
    try {
      const [all, mine] = await Promise.all([
        api.get('/hackathons'),
        api.get('/hackathons/my'),
      ])
      setItems(Array.isArray(all.data) ? all.data : [])
      setJoined(Array.isArray(mine.data) ? mine.data : [])
      setError('')
    } catch (err) {
      setError(msg(err, 'Could not load hackathons'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setJoinFor(null)
        setDetail(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const loadTasks = useCallback(async (id) => {
    try {
      const r = await api.get(`/hackathons/${id}/tasks`)
      setTasks(Array.isArray(r.data) ? r.data : [])
    } catch {
      setTasks([])
    }
  }, [])

  // tasks are only for members who joined the hackathon that is open in the modal
  useEffect(() => {
    if (detailId && joined.includes(detailId)) loadTasks(detailId)
    else setTasks(null)
  }, [detailId, joined, loadTasks])

  const open = async (id) => {
    try {
      const r = await api.get(`/hackathons/${id}`)
      setDetail(r.data)
    } catch (err) {
      setError(msg(err, 'Could not open hackathon'))
    }
  }

  const act = async (id, action) => {
    setBusy(true)
    setError('')
    try {
      const r = await api.post(`/hackathons/${id}/${action}`)
      flash(r.data.message)
      await load()
      if (detail?.id === id) open(id) // keep modal in sync (also reveals/hides the meeting link)
    } catch (err) {
      setError(msg(err, 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }

  // Joining: ask the registration questions first (if the hackathon has any)
  const startJoin = async (h) => {
    setBusy(true)
    setError('')
    try {
      const r = await api.get(`/hackathons/${h.id}`)
      const qs = r.data.questions || []
      if (qs.length === 0) {
        await act(h.id, 'join')
        return
      }
      setJoinAnswers({})
      setJoinErr('')
      setJoinFor(r.data)
    } catch (err) {
      setError(msg(err, 'Could not open hackathon'))
    } finally {
      setBusy(false)
    }
  }

  const submitJoin = async (e) => {
    e.preventDefault()
    const missing = joinFor.questions.filter((q) => q.required && !(joinAnswers[q.id] || '').trim())
    if (missing.length) {
      setJoinErr('Please answer all required questions.')
      return
    }
    setJoining(true)
    setJoinErr('')
    try {
      const r = await api.post(`/hackathons/${joinFor.id}/join`, { answers: joinAnswers })
      const id = joinFor.id
      flash(r.data.message)
      setJoinFor(null)
      await load()
      if (detail?.id === id) open(id)
    } catch (err) {
      setJoinErr(msg(err, 'Could not join this hackathon'))
    } finally {
      setJoining(false)
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items
      .filter((h) => statusFilter === 'all' || h.status === statusFilter)
      .filter((h) => modeFilter === 'all' || modeOf(h) === modeFilter)
      .filter((h) => !mineOnly || joined.includes(h.id))
      .filter((h) => !needle
        || (h.name || '').toLowerCase().includes(needle)
        || (h.venue || '').toLowerCase().includes(needle)
        || (h.description || '').toLowerCase().includes(needle))
      .sort((a, b) =>
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
        || new Date(a.starts_at) - new Date(b.starts_at))
  }, [items, joined, statusFilter, modeFilter, mineOnly, query])

  const counts = useMemo(() => {
    const c = { all: items.length, mine: joined.length }
    for (const s of Object.keys(BADGE)) c[s] = items.filter((h) => h.status === s).length
    return c
  }, [items, joined])

  const joinedStats = useMemo(() => ({
    live: items.filter((h) => joined.includes(h.id) && h.status === 'live').length,
    upcoming: items.filter((h) => joined.includes(h.id) && h.status === 'upcoming').length,
  }), [items, joined])

  const anyFilter = query || statusFilter !== 'all' || modeFilter !== 'all' || mineOnly
  const clearAll = () => { setQuery(''); setStatusFilter('all'); setModeFilter('all'); setMineOnly(false) }

  const JoinButton = ({ h }) => {
    if (joined.includes(h.id))
      return (
        <button disabled={busy} onClick={() => act(h.id, 'leave')}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50 transition-colors">
          <Icon name="check" className="w-4 h-4" />
          Joined · Leave
        </button>
      )
    if (h.status === 'upcoming' || h.status === 'live')
      return (
        <button disabled={busy} onClick={() => startJoin(h)}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
          Join hackathon
        </button>
      )
    return <span className="text-sm text-gray-400">Registration closed</span>
  }

  const emptyIcon = mineOnly ? 'ticket' : anyFilter ? 'search' : 'flag'

  return (
    <div className="max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Hackathons</h1>
          <p className="text-sm text-gray-500 mt-1">
            {counts.all} events · you joined {counts.mine}
            {joinedStats.live > 0 && <span className="text-emerald-600 font-medium"> · {joinedStats.live} live now</span>}
          </p>
        </div>
        <button onClick={load}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-700 transition-colors">
          <Icon name="refresh" className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
          <span className="inline-flex items-center gap-2">
            <Icon name="check" className="w-4 h-4 shrink-0" />
            {notice}
          </span>
          <button onClick={() => setNotice('')} aria-label="Dismiss" className="text-emerald-500 hover:text-emerald-700">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={() => { setError(''); load() }} className="font-medium hover:underline">Retry</button>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
            <Icon name="search" className="w-4 h-4" />
          </span>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hackathons…"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search"
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
              <Icon name="x" className="w-4 h-4" />
            </button>
          )}
        </div>
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}
          aria-label="Format"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="all">All formats</option>
          <option value="online">Online</option>
          <option value="in_person">In person</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <button onClick={() => setMineOnly((v) => !v)}
          className={`px-3 py-2 text-sm rounded-lg border transition-colors
            ${mineOnly
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400 hover:text-emerald-700'}`}>
          My hackathons ({counts.mine})
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', ...Object.keys(BADGE)].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap capitalize transition-colors
              ${statusFilter === s
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-700'}`}>
            {s === 'all' ? `All (${counts.all})` : `${s} (${counts[s] || 0})`}
          </button>
        ))}
      </div>

      {/* Skeletons */}
      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SKELETONS.map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
              <div className="h-5 w-20 bg-gray-100 rounded-full" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mt-3" />
              <div className="h-2.5 bg-gray-100 rounded w-1/2 mt-2" />
              <div className="mt-4 space-y-2">
                <div className="h-2.5 bg-gray-100 rounded w-full" />
                <div className="h-2.5 bg-gray-100 rounded w-2/3" />
              </div>
              <div className="mt-5 h-9 w-32 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && visible.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
            <Icon name={emptyIcon} className="w-7 h-7" />
          </div>
          <p className="text-gray-500 text-sm">
            {mineOnly
              ? "You haven't joined any hackathons yet."
              : anyFilter
                ? 'No hackathons match your filters.'
                : 'No hackathons yet. Check back soon!'}
          </p>
          {anyFilter && (
            <button onClick={clearAll}
              className="mt-3 text-sm text-emerald-700 font-medium hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Cards */}
      {!loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((h) => (
            <article key={h.id}
              className={`bg-white border rounded-2xl p-5 flex flex-col shadow-sm hover:shadow-md transition-shadow
                ${joined.includes(h.id) ? 'border-emerald-300' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset capitalize ${BADGE[h.status] ?? BADGE.completed}`}>
                    {h.status === 'live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />}
                    {h.status}
                  </span>
                  <ModeBadge mode={modeOf(h)} />
                </div>
                {joined.includes(h.id) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <Icon name="check" className="w-3.5 h-3.5" />
                    Joined
                  </span>
                )}
              </div>

              <h3 className="font-bold text-gray-900 mt-2 leading-snug">{h.name}</h3>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                <Icon name="calendar" className="w-4 h-4 text-gray-400 shrink-0" />
                {fmtDate(h.starts_at)} · {fmtTime(h.starts_at)}
              </p>
              <Where h={h} className="mt-0.5" />

              {h.status === 'upcoming' && <div className="mt-2"><Countdown target={h.starts_at} /></div>}

              {h.description && (
                <p className="text-sm text-gray-600 mt-2 line-clamp-3 flex-1">{h.description}</p>
              )}

              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <AvatarStack count={h.participants || 0} />
                <span>{h.participants} participant{h.participants === 1 ? '' : 's'}</span>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                <JoinButton h={h} />
                <button onClick={() => open(h.id)}
                  className="inline-flex items-center gap-1 text-sm text-emerald-700 font-medium hover:underline ml-auto">
                  Details
                  <Icon name="arrowRight" className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Details modal */}
      {detail && (
        <div className="fixed inset-0 z-20 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset capitalize ${BADGE[detail.status] ?? BADGE.completed}`}>
                    {detail.status}
                  </span>
                  <ModeBadge mode={modeOf(detail)} />
                </div>
                <h2 className="text-xl font-bold mt-2 text-gray-900">{detail.name}</h2>
              </div>
              <button onClick={() => setDetail(null)} aria-label="Close"
                className="text-gray-400 hover:text-gray-700">
                <Icon name="x" className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-gray-600">
              <span className="inline-flex items-center gap-2">
                <Icon name="calendar" className="w-4 h-4 text-gray-400 shrink-0" />
                {fmt(detail.starts_at)}
              </span>
              {detail.ends_at && (
                <span className="inline-flex items-center gap-2">
                  <Icon name="arrowRight" className="w-4 h-4 text-gray-400 shrink-0" />
                  {fmt(detail.ends_at)}
                </span>
              )}
              {detail.status === 'upcoming' && <Countdown target={detail.starts_at} />}
            </div>
            {modeOf(detail) !== 'in_person' && userTimeZone && (
              <p className="text-xs text-gray-400 mt-1">Times are shown in your time zone ({userTimeZone}).</p>
            )}
            <Where h={detail} className="mt-1" />

            {/* Online access */}
            {modeOf(detail) !== 'in_person' && detail.has_meeting_link && (
              <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                <p className="text-sm font-semibold text-violet-900 flex items-center gap-2">
                  <Icon name="video" className="w-4 h-4" />
                  Online access
                </p>
                {detail.meeting_url ? (
                  <a href={detail.meeting_url} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
                    Join online
                    <Icon name="arrowRight" className="w-4 h-4" />
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-violet-800">
                    {joined.includes(detail.id)
                      ? 'The meeting link will appear here once the hackathon is open.'
                      : 'Join this hackathon to see the online meeting link.'}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
              <AvatarStack count={detail.participants || 0} />
              <span>{detail.participants} participant{detail.participants === 1 ? '' : 's'}</span>
            </div>

            {detail.description && <p className="text-sm text-gray-700 mt-4 whitespace-pre-line leading-relaxed">{detail.description}</p>}

            {/* Tasks (members only) */}
            {joined.includes(detail.id) && (
              <div className="mt-5">
                <h3 className="font-semibold text-sm mb-2 text-gray-900">Your tasks</h3>
                {tasks === null ? (
                  <p className="text-sm text-gray-500">Loading tasks…</p>
                ) : tasks.length === 0 ? (
                  <p className="text-sm text-gray-500">No tasks have been posted yet. Check back soon.</p>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((t) => (
                      <TaskCard key={t.id} hackathonId={detail.id} task={t}
                        onSaved={(m) => { flash(m); loadTasks(detail.id) }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {detail.tracks?.length > 0 && (
              <div className="mt-5">
                <h3 className="font-semibold text-sm mb-2 text-gray-900">Challenges / Tracks</h3>
                <ul className="space-y-2">
                  {detail.tracks.map((t) => (
                    <li key={t.id} className="text-sm border border-gray-200 rounded-xl p-3 bg-slate-50/50">
                      <p className="font-medium text-gray-900">{t.name}</p>
                      {t.description && <p className="text-gray-600 mt-0.5">{t.description}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {detail.rules && (
              <div className="mt-5">
                <h3 className="font-semibold text-sm mb-1 text-gray-900">Rules</h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">{detail.rules}</p>
              </div>
            )}
            {detail.schedule && (
              <div className="mt-5">
                <h3 className="font-semibold text-sm mb-1 text-gray-900">Schedule</h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">{detail.schedule}</p>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-100"><JoinButton h={detail} /></div>
          </div>
        </div>
      )}

      {/* Join modal: registration questions */}
      {joinFor && (
        <div className="fixed inset-0 z-30 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { if (!joining) setJoinFor(null) }}>
          <form onSubmit={submitJoin} noValidate
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Join {joinFor.name}</h2>
                <p className="text-sm text-gray-500 mt-1">Answer a few questions to complete your registration.</p>
              </div>
              <button type="button" onClick={() => setJoinFor(null)} disabled={joining} aria-label="Close"
                className="text-gray-400 hover:text-gray-700">
                <Icon name="x" className="w-6 h-6" />
              </button>
            </div>

            {joinErr && (
              <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {joinErr}
              </div>
            )}

            <div className="mt-4 space-y-4">
              {joinFor.questions.map((q) => (
                <div key={q.id}>
                  <label htmlFor={`q-${q.id}`} className="block text-sm font-medium text-gray-800 mb-1.5">
                    {q.question}{q.required ? ' *' : ' (optional)'}
                  </label>
                  <textarea id={`q-${q.id}`} rows={3} value={joinAnswers[q.id] || ''}
                    onChange={(e) => setJoinAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setJoinFor(null)} disabled={joining}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={joining}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {joining ? 'Joining…' : 'Join hackathon'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}