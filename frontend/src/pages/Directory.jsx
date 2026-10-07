import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'

const errorMessage = (err) => {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return 'Something went wrong. Please try again.'
}

const MEMBER_TYPES = ['all', 'student', 'alumni', 'faculty', 'mentor']

const STATUS_LABELS = {
  connected: ['Connected', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
  pending_sent: ['Request sent', 'bg-amber-50 text-amber-700 border-amber-200'],
  pending_received: ['Wants to connect', 'bg-sky-50 text-sky-700 border-sky-200'],
  none: ['Not connected', 'bg-gray-50 text-gray-500 border-gray-200'],
}

const SKELETONS = Array.from({ length: 6 })

const initials = (name = '?') =>
  name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

export default function Directory() {
  const [members, setMembers] = useState([])
  const [requests, setRequests] = useState([])
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sort, setSort] = useState('name')
  const [busyId, setBusyId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const searchRef = useRef(null)
  const isInitial = useRef(true)

  const loadMembers = useCallback(async () => {
    try {
      const r = await api.get('/members', { params: { q } })
      setMembers(Array.isArray(r.data) ? r.data : [])
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [q])

  const loadRequests = useCallback(async () => {
    try {
      const r = await api.get('/members/connections/requests')
      setRequests(Array.isArray(r.data) ? r.data : [])
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [])

  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    const t = setTimeout(loadMembers, 250)
    return () => clearTimeout(t)
  }, [loadMembers])

  useEffect(() => {
    loadMembers()
    loadRequests()
  }, [loadRequests]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const run = async (id, request) => {
    setBusyId(id)
    setError('')
    try {
      await request()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      // always re-sync with the server so buttons reflect the real state
      await Promise.all([loadMembers(), loadRequests()])
      setBusyId(null)
    }
  }

  const connect = (id) => run(id, () => api.post(`/members/${id}/connect`))
  const accept = (id) => run(id, () => api.post(`/members/${id}/connect/accept`))
  const decline = (id) => run(id, () => api.post(`/members/${id}/connect/decline`))
  const cancel = (id) => run(id, () => api.delete(`/members/${id}/connect`))

  const visible = useMemo(() => {
    let list = members
    if (typeFilter !== 'all') {
      list = list.filter((m) => (m.member_type || '').toLowerCase() === typeFilter)
    }
    return [...list].sort((a, b) => {
      if (sort === 'name') return (a.full_name || '').localeCompare(b.full_name || '')
      return (b.skills?.length || 0) - (a.skills?.length || 0)
    })
  }, [members, typeFilter, sort])

  const stats = useMemo(() => ({
    total: members.length,
    connected: members.filter((m) => m.connection_status === 'connected').length,
    pending: requests.length,
  }), [members, requests])

  const typeCounts = useMemo(() => {
    const c = { all: members.length }
    for (const t of MEMBER_TYPES.slice(1)) {
      c[t] = members.filter((m) => (m.member_type || '').toLowerCase() === t).length
    }
    return c
  }, [members])

  const highlight = (text = '') => {
    const needle = q.trim()
    if (!needle) return text
    const i = text.toLowerCase().indexOf(needle.toLowerCase())
    if (i === -1) return text
    return (
      <>
        {text.slice(0, i)}
        <mark className="bg-emerald-100 text-inherit rounded-sm px-0.5">{text.slice(i, i + needle.length)}</mark>
        {text.slice(i + needle.length)}
      </>
    )
  }

  const renderAction = (m) => {
    const busy = busyId === m.id
    const base = 'mt-4 px-4 py-1.5 text-sm rounded-lg border disabled:opacity-50 transition-colors'

    switch (m.connection_status) {
      case 'connected':
        return (
          <div className="mt-4 flex items-center gap-3">
            <span className="px-4 py-1.5 text-sm rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              ✓ Connected
            </span>
            <button disabled={busy} onClick={() => cancel(m.id)}
              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50">
              Disconnect
            </button>
          </div>
        )
      case 'pending_sent':
        return (
          <div className="mt-4 flex items-center gap-3">
            <span className="px-4 py-1.5 text-sm rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              Request sent
            </span>
            <button disabled={busy} onClick={() => cancel(m.id)}
              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50">
              Cancel
            </button>
          </div>
        )
      case 'pending_received':
        return (
          <div className="mt-4 flex gap-2">
            <button disabled={busy} onClick={() => accept(m.id)}
              className="px-4 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              Accept
            </button>
            <button disabled={busy} onClick={() => decline(m.id)}
              className="px-4 py-1.5 text-sm rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              Decline
            </button>
          </div>
        )
      default:
        return (
          <button disabled={busy} onClick={() => connect(m.id)}
            className={`${base} border-emerald-600 text-emerald-700 hover:bg-emerald-50`}>
            {busy ? 'Sending…' : 'Connect'}
          </button>
        )
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Member Directory</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats.total} members · {stats.connected} connections · {stats.pending} pending
          </p>
        </div>
        <button onClick={() => { loadMembers(); loadRequests() }}
          className="text-sm text-gray-500 hover:text-emerald-700 transition-colors">
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={() => { setError(''); loadMembers(); loadRequests() }}
            className="font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {/* Requests banner */}
      {requests.length > 0 && (
        <div className="mb-6 bg-sky-50/50 border border-sky-200 rounded-2xl p-4">
          <h2 className="font-semibold text-gray-900 mb-3">
            Connection requests
            <span className="ml-2 text-xs font-bold bg-sky-600 text-white rounded-full px-2 py-0.5">
              {requests.length}
            </span>
          </h2>
          <div className="space-y-2">
            {requests.map((r) => {
              const busy = busyId === r.user_id
              return (
                <div key={r.connection_id}
                  className="flex items-center justify-between bg-white border border-sky-100 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">
                      {initials(r.full_name)}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{r.full_name}</p>
                      <p className="text-xs text-gray-500">{r.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => accept(r.user_id)}
                      className="px-3 py-1 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      Accept
                    </button>
                    <button disabled={busy} onClick={() => decline(r.user_id)}
                      className="px-3 py-1 text-sm rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      Decline
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[240px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, skill, institution…  (Ctrl+K)"
            className="w-full border border-gray-200 rounded-lg pl-8 pr-8 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          {q && (
            <button onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="name">Sort: Name</option>
          <option value="skills">Sort: Most skills</option>
        </select>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {MEMBER_TYPES.map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap capitalize transition-colors
              ${typeFilter === t
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-700'}`}>
            {t === 'all' ? `All (${typeCounts.all})` : `${t} (${typeCounts[t] || 0})`}
          </button>
        ))}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid md:grid-cols-3 gap-4">
          {SKELETONS.map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-2 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2.5 bg-gray-100 rounded w-full" />
                <div className="h-2.5 bg-gray-100 rounded w-3/4" />
              </div>
              <div className="mt-4 flex gap-1.5">
                <div className="h-5 w-14 bg-gray-100 rounded" />
                <div className="h-5 w-16 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && visible.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-500 text-sm">No members match your filters.</p>
          <button onClick={() => { setQ(''); setTypeFilter('all') }}
            className="mt-3 text-sm text-emerald-700 font-medium hover:underline">
            Clear filters
          </button>
        </div>
      )}

      {/* Member cards */}
      {!loading && (
        <div className="grid md:grid-cols-3 gap-4">
          {visible.map((m) => {
            const [label, cls] = STATUS_LABELS[m.connection_status] || STATUS_LABELS.none
            return (
              <div key={m.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <button onClick={() => setSelected(m)} className="text-left group">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      {initials(m.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                        {highlight(m.full_name)}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {m.role || m.member_type}
                      </p>
                    </div>
                  </div>
                </button>

                <span className={`mt-3 self-start text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>
                  {label}
                </span>

                <p className="text-sm text-gray-600 mt-3 line-clamp-2 flex-1">{highlight(m.bio)}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {m.skills?.slice(0, 4).map((s) => (
                    <span key={s}
                      className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                      {highlight(s)}
                    </span>
                  ))}
                  {(m.skills?.length || 0) > 4 && (
                    <span className="text-xs text-gray-400 px-1 py-1">+{m.skills.length - 4}</span>
                  )}
                </div>

                {renderAction(m)}
              </div>
            )
          })}
        </div>
      )}

      {/* Profile modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
               onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelected(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold">
                {initials(selected.full_name)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selected.full_name}</h3>
                <p className="text-sm text-gray-500">{selected.role || selected.member_type}</p>
              </div>
            </div>
            <span className={`mt-4 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border
              ${STATUS_LABELS[selected.connection_status]?.[1] || STATUS_LABELS.none[1]}`}>
              {STATUS_LABELS[selected.connection_status]?.[0] || STATUS_LABELS.none[0]}
            </span>
            <p className="mt-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {selected.bio || 'No bio provided.'}
            </p>
            {selected.skills?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.skills.map((s) => (
                    <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6">{renderAction(selected)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
