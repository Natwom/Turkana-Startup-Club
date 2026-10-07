import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const errorMessage = (err) => {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return 'Something went wrong. Please try again.'
}

// Prefix bare links with https:// so "javascript:" style values can never become a real link
const toHref = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

const initials = (name = '?') =>
  name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

const SKELETONS = Array.from({ length: 3 })

function ProfileModal({ memberId, onClose, onMessage }) {
  const [p, setP] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/members/${memberId}`)
      .then((r) => setP(r.data))
      .catch((err) => setError(errorMessage(err)))
  }, [memberId])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}
        {!p && !error && (
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gray-200" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-1/4" />
              </div>
            </div>
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </div>
        )}
        {p && (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-lg font-bold text-emerald-700">
                  {initials(p.full_name)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{p.full_name}</h2>
                  <p className="text-sm text-gray-500">{p.role || p.member_type}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            <dl className="mt-5 text-sm grid grid-cols-2 gap-y-3 bg-slate-50 rounded-xl p-4">
              {p.institution && (<><dt className="text-gray-500">Institution</dt><dd className="font-medium text-gray-900">{p.institution}</dd></>)}
              {p.county && (<><dt className="text-gray-500">County</dt><dd className="font-medium text-gray-900">{p.county}</dd></>)}
              {p.experience_level && (<><dt className="text-gray-500">Experience</dt><dd className="font-medium text-gray-900">{p.experience_level}</dd></>)}
              {p.member_type && (<><dt className="text-gray-500">Member type</dt><dd className="font-medium text-gray-900">{p.member_type}</dd></>)}
            </dl>

            {p.bio && <p className="text-sm text-gray-700 mt-4 whitespace-pre-wrap leading-relaxed">{p.bio}</p>}

            {p.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {p.skills.map((s) => (
                  <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">{s}</span>
                ))}
              </div>
            )}

            <div className="mt-5 border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Contact &amp; links</h3>
              {p.contact ? (
                <dl className="text-sm space-y-2">
                  {p.contact.phone && (<div><dt className="inline text-gray-500">Phone: </dt><dd className="inline font-medium text-gray-800">{p.contact.phone}</dd></div>)}
                  {p.contact.linkedin && (<div><dt className="inline text-gray-500">LinkedIn: </dt>
                    <dd className="inline"><a className="text-emerald-700 hover:underline break-all" href={toHref(p.contact.linkedin)} target="_blank" rel="noopener noreferrer">{p.contact.linkedin}</a></dd></div>)}
                  {p.contact.github && (<div><dt className="inline text-gray-500">GitHub: </dt>
                    <dd className="inline"><a className="text-emerald-700 hover:underline break-all" href={toHref(p.contact.github)} target="_blank" rel="noopener noreferrer">{p.contact.github}</a></dd></div>)}
                  {p.contact.portfolio && (<div><dt className="inline text-gray-500">Portfolio: </dt>
                    <dd className="inline"><a className="text-emerald-700 hover:underline break-all" href={toHref(p.contact.portfolio)} target="_blank" rel="noopener noreferrer">{p.contact.portfolio}</a></dd></div>)}
                  {p.contact.startup_info && (<div><dt className="text-gray-500">Startup</dt><dd className="whitespace-pre-wrap text-gray-700">{p.contact.startup_info}</dd></div>)}
                  {!p.contact.phone && !p.contact.linkedin && !p.contact.github &&
                    !p.contact.portfolio && !p.contact.startup_info && (
                      <p className="text-gray-500">This member has not added contact details yet.</p>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-gray-500">Connect with this member to see their contact details and links.</p>
              )}
            </div>

            {p.connection_status === 'connected' && (
              <button onClick={() => onMessage(p.id)}
                className="mt-5 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                ✉ Send message
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function Network() {
  const navigate = useNavigate()
  const [connections, setConnections] = useState([])
  const [requests, setRequests] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [viewId, setViewId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        api.get('/members/connections'),
        api.get('/members/connections/requests'),
      ])
      setConnections(Array.isArray(c.data) ? c.data : [])
      setRequests(Array.isArray(r.data) ? r.data : [])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const run = async (id, request) => {
    setBusyId(id)
    setError('')
    try {
      await request()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      await load()
      setBusyId(null)
    }
  }

  const accept = (id) => run(id, () => api.post(`/members/${id}/connect/accept`))
  const decline = (id) => run(id, () => api.post(`/members/${id}/connect/decline`))
  const disconnect = (id) => run(id, () => api.delete(`/members/${id}/connect`)).finally(() => setConfirmId(null))
  const message = (id) => navigate(`/messages/${id}`)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return connections
    return connections.filter((c) =>
      (c.full_name || '').toLowerCase().includes(needle)
      || (c.role || '').toLowerCase().includes(needle)
      || (c.member_type || '').toLowerCase().includes(needle)
      || (c.skills || []).some((s) => s.toLowerCase().includes(needle)))
  }, [connections, query])

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Network</h1>
          <p className="text-sm text-gray-500 mt-1">
            {connections.length} connection{connections.length === 1 ? '' : 's'}
            {requests.length > 0 && <span className="text-sky-700 font-medium"> · {requests.length} pending</span>}
          </p>
        </div>
        <button onClick={load} className="text-sm text-gray-500 hover:text-emerald-700 transition-colors">↻ Refresh</button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={() => { setError(''); load() }} className="font-medium hover:underline">Dismiss</button>
        </div>
      )}

      {requests.length > 0 && (
        <div className="mb-6 bg-sky-50/50 border border-sky-200 rounded-2xl p-4">
          <h2 className="font-semibold text-gray-900 mb-3">
            Connection requests
            <span className="ml-2 text-xs font-bold bg-sky-600 text-white rounded-full px-2 py-0.5">{requests.length}</span>
          </h2>
          <div className="space-y-2">
            {requests.map((r) => {
              const busy = busyId === r.user_id
              return (
                <div key={r.connection_id}
                  className="flex items-center justify-between bg-white border border-sky-100 rounded-xl px-4 py-2.5">
                  <button onClick={() => setViewId(r.user_id)} className="text-left flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">
                      {initials(r.full_name)}
                    </span>
                    <span>
                      <p className="font-medium text-sm text-gray-900 hover:underline">{r.full_name}</p>
                      <p className="text-xs text-gray-500">{r.role}</p>
                    </span>
                  </button>
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

      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-gray-900">Connections ({visible.length})</h2>
        {connections.length > 4 && (
          <div className="relative w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search connections…"
              className="w-full border border-gray-200 rounded-lg pl-8 pr-7 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            {query && (
              <button onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}
          </div>
        )}
      </div>

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
              <div className="mt-4 flex gap-1.5">
                <div className="h-5 w-14 bg-gray-100 rounded" />
                <div className="h-5 w-16 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && connections.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">🤝</div>
          <p className="text-sm text-gray-500">
            You have no connections yet. Find people in the{' '}
            <button onClick={() => navigate('/directory')} className="text-emerald-700 font-medium hover:underline">
              Member Directory
            </button>.
          </p>
        </div>
      )}

      {!loading && connections.length > 0 && visible.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No connections match "{query}".</p>
          <button onClick={() => setQuery('')} className="mt-3 text-sm text-emerald-700 font-medium hover:underline">
            Clear search
          </button>
        </div>
      )}

      {!loading && (
        <div className="grid md:grid-cols-3 gap-4">
          {visible.map((c) => {
            const busy = busyId === c.user_id
            const confirming = confirmId === c.user_id
            return (
              <article key={c.connection_id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <button onClick={() => setViewId(c.user_id)} className="text-left w-full group">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700">
                      {initials(c.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                        {c.full_name}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{c.role || c.member_type}</p>
                    </div>
                  </div>
                </button>
                {c.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {c.skills.slice(0, 5).map((s) => (
                      <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{s}</span>
                    ))}
                    {c.skills.length > 5 && (
                      <span className="text-xs text-gray-400 px-1 py-1">+{c.skills.length - 5}</span>
                    )}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button onClick={() => message(c.user_id)}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                    ✉ Message
                  </button>
                  <button onClick={() => setViewId(c.user_id)}
                    className="px-3 py-1.5 text-sm rounded-lg border text-gray-700 hover:bg-gray-50 transition-colors">
                    View profile
                  </button>
                  {confirming ? (
                    <span className="ml-auto flex items-center gap-2">
                      <button disabled={busy} onClick={() => disconnect(c.user_id)}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">
                        {busy ? 'Removing…' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </span>
                  ) : (
                    <button disabled={busy} onClick={() => setConfirmId(c.user_id)}
                      className="ml-auto text-xs text-gray-400 hover:text-red-600 disabled:opacity-50">
                      Disconnect
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {viewId && (
        <ProfileModal memberId={viewId} onClose={() => setViewId(null)}
          onMessage={(id) => { setViewId(null); message(id) }} />
      )}
    </div>
  )
}
