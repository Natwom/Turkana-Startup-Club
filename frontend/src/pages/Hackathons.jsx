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

export default function Hackathons() {
  const [items, setItems] = useState([])
  const [joined, setJoined] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)

  const [statusFilter, setStatusFilter] = useState('all')
  const [mineOnly, setMineOnly] = useState(false)
  const [query, setQuery] = useState('')

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
    const onKey = (e) => { if (e.key === 'Escape') setDetail(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
      setNotice(r.data.message)
      setTimeout(() => setNotice(''), 5000)
      await load()
      if (detail?.id === id) open(id) // keep modal in sync
    } catch (err) {
      setError(msg(err, 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items
      .filter((h) => statusFilter === 'all' || h.status === statusFilter)
      .filter((h) => !mineOnly || joined.includes(h.id))
      .filter((h) => !needle
        || (h.name || '').toLowerCase().includes(needle)
        || (h.venue || '').toLowerCase().includes(needle)
        || (h.description || '').toLowerCase().includes(needle))
      .sort((a, b) =>
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
        || new Date(a.starts_at) - new Date(b.starts_at))
  }, [items, joined, statusFilter, mineOnly, query])

  const counts = useMemo(() => {
    const c = { all: items.length, mine: joined.length }
    for (const s of Object.keys(BADGE)) c[s] = items.filter((h) => h.status === s).length
    return c
  }, [items, joined])

  const joinedStats = useMemo(() => ({
    live: items.filter((h) => joined.includes(h.id) && h.status === 'live').length,
    upcoming: items.filter((h) => joined.includes(h.id) && h.status === 'upcoming').length,
  }), [items, joined])

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
        <button disabled={busy} onClick={() => act(h.id, 'join')}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
          Join hackathon
        </button>
      )
    return <span className="text-sm text-gray-400">Registration closed</span>
  }

  const emptyIcon = mineOnly ? 'ticket' : query || statusFilter !== 'all' ? 'search' : 'flag'

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
              : query || statusFilter !== 'all'
                ? 'No hackathons match your filters.'
                : 'No hackathons yet. Check back soon!'}
          </p>
          {(query || statusFilter !== 'all' || mineOnly) && (
            <button onClick={() => { setQuery(''); setStatusFilter('all'); setMineOnly(false) }}
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
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset capitalize ${BADGE[h.status] ?? BADGE.completed}`}>
                  {h.status === 'live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />}
                  {h.status}
                </span>
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
              {h.venue && (
                <p className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                  <Icon name="pin" className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate">{h.venue}</span>
                </p>
              )}

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
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset capitalize ${BADGE[detail.status] ?? BADGE.completed}`}>
                  {detail.status}
                </span>
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
            {detail.venue && (
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                <Icon name="pin" className="w-4 h-4 text-gray-400 shrink-0" />
                {detail.venue}
              </p>
            )}

            <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
              <AvatarStack count={detail.participants || 0} />
              <span>{detail.participants} participant{detail.participants === 1 ? '' : 's'}</span>
            </div>

            {detail.description && <p className="text-sm text-gray-700 mt-4 whitespace-pre-line leading-relaxed">{detail.description}</p>}

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
    </div>
  )
}