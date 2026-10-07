import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'

const ALL_ROLES = [
  'ADMIN', 'EVENT_MANAGER', 'HACKATHON_MANAGER', 'COMMUNITY_MODERATOR',
  'MENTORSHIP_MANAGER', 'INCUBATION_MANAGER', 'CHAPTER_MANAGER',
  'CONTENT_MANAGER', 'VOLUNTEER_MANAGER', 'JUDGE', 'MENTOR',
]

const ROLE_COLORS = {
  ADMIN: 'bg-violet-100 text-violet-700',
  SUPER_ADMIN: 'bg-violet-100 text-violet-700',
  EVENT_MANAGER: 'bg-sky-100 text-sky-700',
  HACKATHON_MANAGER: 'bg-sky-100 text-sky-700',
  COMMUNITY_MODERATOR: 'bg-rose-100 text-rose-700',
  MENTORSHIP_MANAGER: 'bg-emerald-100 text-emerald-700',
  INCUBATION_MANAGER: 'bg-emerald-100 text-emerald-700',
  CHAPTER_MANAGER: 'bg-amber-100 text-amber-700',
  CONTENT_MANAGER: 'bg-amber-100 text-amber-700',
  VOLUNTEER_MANAGER: 'bg-amber-100 text-amber-700',
  JUDGE: 'bg-slate-200 text-slate-700',
  MENTOR: 'bg-slate-200 text-slate-700',
}

const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'

function StatusBadge({ m }) {
  if (m.is_suspended)
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Suspended</span>
  if (m.is_verified)
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Verified</span>
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Pending</span>
}

export default function Members() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [suspended, setSuspended] = useState('all')
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      setError('')
      const r = await api.get('/admin/members', {
        params: {
          verification: filter === 'all' ? '' : filter,
          suspended: suspended === 'all' ? '' : suspended,
          q,
        },
      })
      setMembers(r.data)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load members'))
    } finally {
      setLoading(false)
    }
  }, [filter, suspended, q])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const act = async (id, action, label) => {
    if (label && !window.confirm(`Are you sure you want to ${label}?`)) return
    setBusyId(id)
    try {
      await api.post(`/admin/members/${id}/${action}`)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const toggleRole = async (m, role) => {
    const current = (m.roles ?? []).filter((r) => ALL_ROLES.includes(r))
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role]
    setBusyId(m.id)
    try {
      await api.put(`/admin/members/${m.id}/roles`, next)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Failed to update roles'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Members</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Loading…' : `${members.length} member${members.length === 1 ? '' : 's'} shown`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="all">All statuses</option>
          <option value="pending">Pending verification</option>
          <option value="verified">Verified</option>
        </select>
        <select value={suspended} onChange={(e) => setSuspended(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="all">All accounts</option>
          <option value="no">Active only</option>
          <option value="yes">Suspended only</option>
        </select>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={load} className="font-semibold underline shrink-0">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="p-4">Member</th>
                <th className="p-4">Type</th>
                <th className="p-4">County</th>
                <th className="p-4">Status</th>
                <th className="p-4">Roles</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="p-4">
                    <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
                  </td>
                </tr>
              ))}

              {!loading && members.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    No members match your filters.
                  </td>
                </tr>
              )}

              {!loading && members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center
                                      justify-center text-xs font-bold shrink-0">
                        {initials(m.full_name)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{m.full_name}</p>
                        <p className="text-xs text-slate-500">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600">{m.member_type || '—'}</td>
                  <td className="p-4 text-slate-600">{m.county || '—'}</td>
                  <td className="p-4"><StatusBadge m={m} /></td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5 max-w-xs">
                      {(m.roles ?? []).filter((r) => ALL_ROLES.includes(r)).length === 0 && (
                        <span className="text-xs text-slate-400 italic">No roles</span>
                      )}
                      {(m.roles ?? []).filter((r) => ALL_ROLES.includes(r)).map((r) => (
                        <button key={r} onClick={() => toggleRole(m, r)} disabled={busyId === m.id}
                          title="Click to remove"
                          className={`px-2 py-0.5 rounded-full text-xs font-medium transition-opacity
                            hover:opacity-60 disabled:opacity-40 ${ROLE_COLORS[r] ?? 'bg-slate-200 text-slate-700'}`}>
                          {r.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">Click a role to remove · click below to add:</p>
                    <div className="flex flex-wrap gap-1.5 mt-1 max-w-xs">
                      {ALL_ROLES.filter((r) => !(m.roles ?? []).includes(r)).map((r) => (
                        <button key={r} onClick={() => toggleRole(m, r)} disabled={busyId === m.id}
                          className="px-2 py-0.5 rounded-full text-xs border border-dashed border-slate-300
                            text-slate-400 hover:border-emerald-500 hover:text-emerald-600 transition-colors
                            disabled:opacity-40">
                          + {r.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      {!m.is_verified && (
                        <button onClick={() => act(m.id, 'verify')} disabled={busyId === m.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg
                            text-xs font-semibold transition-colors disabled:opacity-50">
                          Verify
                        </button>
                      )}
                      {!m.is_suspended ? (
                        <button onClick={() => act(m.id, 'suspend', `suspend ${m.full_name}`)} disabled={busyId === m.id}
                          className="px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50
                            rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
                          Suspend
                        </button>
                      ) : (
                        <button onClick={() => act(m.id, 'reactivate')} disabled={busyId === m.id}
                          className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg
                            text-xs font-semibold transition-colors disabled:opacity-50">
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}