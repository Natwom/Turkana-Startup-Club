import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'

/* ------------------------------------------------------------------ icons */
const ICONS = {
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  mail: (
    <>
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M22 6l-10 7L2 6" />
    </>
  ),
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  ticket: (
    <>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
      <path d="M13 5v2M13 11v2M13 17v2" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  userPlus: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6M23 11h-6" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  checkCircle: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4L12 14.01l-3-3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  x: <path d="M18 6L6 18M6 6l12 12" />,
  pin: (
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M12 5l7 7" />,
}

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

/* ------------------------------------------------------------------ helpers */
const errorMessage = (err) => {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return 'Something went wrong. Please try again.'
}

// The API may return a plain list or an object like { items: [...] }.
// Always hand the UI an array so .filter() / .slice() / .map() never throw.
const asArray = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [])

// Always hand the UI a number for counters.
const toCount = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Always hand the UI text where text is expected.
const toText = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? '' : String(v))

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// Server timestamps may be naive UTC (no "Z"); treat them as UTC so "time ago" is right
const parseDate = (iso) => {
  if (!iso) return null
  const s = /([zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`
  const d = new Date(s)
  return isNaN(d) ? null : d
}

const timeAgo = (iso) => {
  const d = parseDate(iso)
  if (!d) return ''
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

const PROFILE_CHECKS = [
  ['photo_url', 'Add a profile photo'],
  ['bio', 'Write a short bio'],
  ['professional_role', 'Add your professional role'],
  ['institution', 'Add your institution or company'],
  ['skills', 'List your skills'],
  ['linkedin', 'Link your LinkedIn'],
  ['github', 'Link your GitHub'],
]

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  violet: 'bg-violet-50 text-violet-700',
}

/* ------------------------------------------------------------------ small components */
function Card({ title, action, children, className = '' }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-2xl shadow-sm ${className}`}>
      <header className="flex items-center justify-between px-5 pt-5">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {action}
      </header>
      <div className="p-5 pt-4">{children}</div>
    </section>
  )
}

function CardLink({ to, children }) {
  return (
    <Link to={to}
      className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline whitespace-nowrap">
      {children}
      <Icon name="arrow" className="h-3.5 w-3.5" />
    </Link>
  )
}

function Stat({ to, icon, label, value, tone, loading }) {
  return (
    <Link to={to}
      className="group bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition">
      <div className="flex items-center gap-3">
        <span className={`h-11 w-11 rounded-xl flex items-center justify-center ${TONES[tone]}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          {loading
            ? <div className="h-6 w-8 rounded bg-gray-200 animate-pulse" />
            : <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>}
          <p className="text-xs text-gray-500 mt-1 truncate">{label}</p>
        </div>
      </div>
    </Link>
  )
}

function Empty({ icon, children }) {
  return (
    <div className="text-center py-6">
      <span className="mx-auto mb-3 h-11 w-11 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="text-sm text-gray-500">{children}</p>
    </div>
  )
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-gray-100" />
      ))}
    </div>
  )
}

function Ring({ pct }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0" role="img" aria-label={`${pct}% complete`}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="#059669" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 44 44)" />
      <text x="44" y="50" textAnchor="middle" fontSize="18" fontWeight="700" fill="#111827">{pct}%</text>
    </svg>
  )
}

function StatusChip({ status }) {
  const s = toText(status)
  const good = ['registered', 'confirmed', 'approved'].includes(s)
  const wait = ['waitlisted', 'pending'].includes(s)
  const cls = good ? 'bg-emerald-50 text-emerald-700' : wait ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${cls}`}>{s || 'registered'}</span>
}

/* ------------------------------------------------------------------ page */
export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [events, setEvents] = useState([])
  const [connections, setConnections] = useState([])
  const [requests, setRequests] = useState([])
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [conversations, setConversations] = useState([])
  const [notifs, setNotifs] = useState({ unread: 0, items: [] })
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [sentIds, setSentIds] = useState(() => new Set())
  const [copiedId, setCopiedId] = useState(null)

  const load = useCallback(async () => {
    const [ev, cn, rq, un, cv, nt, mb] = await Promise.allSettled([
      api.get('/events/my'),
      api.get('/members/connections'),
      api.get('/members/connections/requests'),
      api.get('/messages/unread-count'),
      api.get('/messages/conversations'),
      api.get('/me/notifications'),
      api.get('/members'),
    ])
    // one failing section must not blank the whole dashboard,
    // and an unexpected response shape must not crash the render
    if (ev.status === 'fulfilled') setEvents(asArray(ev.value.data))
    if (cn.status === 'fulfilled') setConnections(asArray(cn.value.data))
    if (rq.status === 'fulfilled') setRequests(asArray(rq.value.data))
    if (un.status === 'fulfilled') setUnreadMessages(toCount(un.value.data?.unread))
    if (cv.status === 'fulfilled') setConversations(asArray(cv.value.data))
    if (nt.status === 'fulfilled') {
      setNotifs({ unread: toCount(nt.value.data?.unread), items: asArray(nt.value.data?.items) })
    }
    if (mb.status === 'fulfilled') setMembers(asArray(mb.value.data))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* ---- derived data */
  const profile = user?.profile || {}
  const firstName = user?.full_name?.split(' ')[0] || 'there'

  const checks = useMemo(() => PROFILE_CHECKS.map(([key, label]) => {
    const v = profile[key]
    return { key, label, done: Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim()) }
  }), [profile])
  const completion = Math.round((checks.filter((c) => c.done).length / checks.length) * 100)
  const missing = checks.filter((c) => !c.done)

  const upcoming = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return events
      .filter((e) => {
        if (!e || !e.event || ['attended', 'cancelled'].includes(e.status)) return false
        const t = new Date(e.event.starts_at)
        return isNaN(t) || t >= today
      })
      .sort((a, b) => new Date(a.event.starts_at) - new Date(b.event.starts_at))
  }, [events])

  const suggestions = useMemo(() => {
    const mine = (Array.isArray(profile.skills) ? profile.skills : []).map((s) => String(s).toLowerCase())
    return members
      .filter((m) => m && (m.connection_status === 'none' || sentIds.has(m.id)))
      .map((m) => ({
        ...m,
        shared: (Array.isArray(m.skills) ? m.skills : []).filter((s) => mine.includes(String(s).toLowerCase())).length,
      }))
      .sort((a, b) => b.shared - a.shared)
      .slice(0, 4)
  }, [members, profile.skills, sentIds])

  /* ---- actions */
  const respond = async (id, action) => {
    setBusyId(id)
    setError('')
    try {
      await api.post(`/members/${id}/connect/${action}`)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const connect = async (id) => {
    setBusyId(id)
    setError('')
    try {
      await api.post(`/members/${id}/connect`)
      setSentIds((prev) => new Set(prev).add(id))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const copyTicket = async (e) => {
    try {
      await navigator.clipboard.writeText(String(e.registration_id))
      setCopiedId(e.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      setError('Could not copy. Select the ticket number and copy it manually.')
    }
  }

  const openNotification = async (n) => {
    if (!n.is_read) await api.post(`/me/notifications/${n.id}/read`).catch(() => {})
    if (n.link) navigate(n.link)
    else load()
  }

  const markAllRead = async () => {
    await api.post('/me/notifications/read-all').catch(() => {})
    load()
  }

  /* ---- render */
  return (
    <div className="space-y-6">
      {/* hero */}
      <section className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar name={user?.full_name} url={profile.photo_url} size="w-16 h-16" text="text-2xl" />
            <div className="min-w-0">
              <p className="text-emerald-100 text-sm">
                {greeting()} · {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold truncate">Karibu, {firstName}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(profile.professional_role || profile.member_type) && (
                  <span className="text-xs bg-white/15 rounded-full px-3 py-1">
                    {toText(profile.professional_role || profile.member_type)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs bg-white/15 rounded-full px-3 py-1">
                  <Icon name={user?.is_verified ? 'checkCircle' : 'clock'} className="h-3.5 w-3.5" />
                  {user?.is_verified ? 'Verified member' : 'Pending verification'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link to="/events" className="px-4 py-2 text-sm font-medium rounded-lg bg-white text-emerald-700 hover:bg-emerald-50">
              Browse events
            </Link>
            <Link to="/directory" className="px-4 py-2 text-sm font-medium rounded-lg bg-white/15 hover:bg-white/25">
              Find members
            </Link>
            <Link to="/settings" className="px-4 py-2 text-sm font-medium rounded-lg bg-white/15 hover:bg-white/25">
              Edit profile
            </Link>
          </div>
        </div>
      </section>

      {!user?.is_verified && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <Icon name="clock" className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Your account is pending verification. You can use the community while an admin reviews it.</span>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-700" aria-label="Dismiss">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat to="/network" icon="users" label="Connections" value={connections.length} tone="emerald" loading={loading} />
        <Stat to="/network" icon="mail" label="Pending requests" value={requests.length} tone="amber" loading={loading} />
        <Stat to="/messages" icon="chat" label="Unread messages" value={unreadMessages} tone="blue" loading={loading} />
        <Stat to="/events" icon="calendar" label="Upcoming events" value={upcoming.length} tone="violet" loading={loading} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ---------------- left column */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="My upcoming events" action={<CardLink to="/events">Browse events</CardLink>}>
            {loading ? <Skeleton /> : upcoming.length === 0 ? (
              <Empty icon="calendar">
                No upcoming registrations. <Link to="/events" className="text-emerald-700 hover:underline">Find an event</Link> to join.
              </Empty>
            ) : (
              <ul className="divide-y">
                {upcoming.slice(0, 4).map((e) => {
                  const d = new Date(e.event.starts_at)
                  const valid = !isNaN(d)
                  return (
                    <li key={e.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="h-14 w-14 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 flex flex-col items-center justify-center">
                        <span className="text-[10px] uppercase font-semibold tracking-wide">
                          {valid ? d.toLocaleString([], { month: 'short' }) : '—'}
                        </span>
                        <span className="text-xl font-bold leading-none">{valid ? d.getDate() : ''}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{toText(e.event.title)}</p>
                        <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                          {valid ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          {e.event.venue && (
                            <>
                              <span aria-hidden="true">·</span>
                              <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{toText(e.event.venue)}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <StatusChip status={e.status} />
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title="My tickets">
            {loading ? <Skeleton rows={2} /> : upcoming.length === 0 ? (
              <Empty icon="ticket">Your event tickets will appear here after you register.</Empty>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {upcoming.slice(0, 4).map((e) => (
                  <div key={e.id} className="border border-dashed border-emerald-300 bg-emerald-50/40 rounded-xl p-4">
                    <p className="text-sm font-medium text-gray-900 truncate">{toText(e.event.title)}</p>
                    <p className="mt-1 font-mono text-sm text-emerald-800 break-all">{toText(e.registration_id)}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <StatusChip status={e.status} />
                      <button onClick={() => copyTicket(e)}
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline">
                        {copiedId === e.id && <Icon name="check" className="h-3.5 w-3.5" />}
                        {copiedId === e.id ? 'Copied' : 'Copy number'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="People you may know" action={<CardLink to="/directory">View directory</CardLink>}>
            {loading ? <Skeleton /> : suggestions.length === 0 ? (
              <Empty icon="users">No new suggestions right now. Check back as more members join.</Empty>
            ) : (
              <ul className="divide-y">
                {suggestions.map((m) => {
                  const sent = sentIds.has(m.id) || m.connection_status === 'pending_sent'
                  return (
                    <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Avatar name={toText(m.full_name)} url={toText(m.photo_url)} size="w-11 h-11" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{toText(m.full_name)}</p>
                        <p className="text-sm text-gray-500 truncate">{toText(m.role || m.member_type)}</p>
                        {m.shared > 0 && (
                          <p className="text-xs text-emerald-700 mt-0.5">
                            {m.shared} shared skill{m.shared > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      {sent ? (
                        <span className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600">Request sent</span>
                      ) : (
                        <button disabled={busyId === m.id} onClick={() => connect(m.id)}
                          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                          <Icon name="userPlus" className="h-4 w-4" />
                          Connect
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* ---------------- right column */}
        <div className="space-y-6">
          <Card title="Profile completion">
            <div className="flex items-center gap-4">
              <Ring pct={completion} />
              <p className="text-sm text-gray-600">
                {completion === 100
                  ? 'Your profile is complete.'
                  : 'A complete profile gets more connections and opportunities.'}
              </p>
            </div>
            {missing.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {missing.slice(0, 4).map((c) => (
                  <li key={c.key}>
                    <Link to="/settings"
                      className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-gray-50 hover:bg-emerald-50 text-gray-700">
                      <span>{c.label}</span>
                      <Icon name="plus" className="h-4 w-4 text-emerald-700" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Connection requests${requests.length ? ` (${requests.length})` : ''}`}
            action={<CardLink to="/network">My network</CardLink>}>
            {loading ? <Skeleton rows={2} /> : requests.length === 0 ? (
              <Empty icon="mail">No pending requests.</Empty>
            ) : (
              <ul className="space-y-3">
                {requests.slice(0, 3).map((r) => (
                  <li key={r.connection_id ?? r.user_id} className="flex items-center gap-3">
                    <Avatar name={toText(r.full_name)} size="w-10 h-10" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{toText(r.full_name)}</p>
                      <p className="text-xs text-gray-500 truncate">{toText(r.role)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button disabled={busyId === r.user_id} onClick={() => respond(r.user_id, 'accept')}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                        Accept
                      </button>
                      <button disabled={busyId === r.user_id} onClick={() => respond(r.user_id, 'decline')}
                        aria-label="Decline"
                        className="px-2 py-1.5 rounded-lg border text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                        <Icon name="x" className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recent messages" action={<CardLink to="/messages">Open inbox</CardLink>}>
            {loading ? <Skeleton rows={2} /> : conversations.length === 0 ? (
              <Empty icon="chat">Connect with members to start chatting.</Empty>
            ) : (
              <ul className="space-y-1">
                {conversations.slice(0, 3).map((c) => (
                  <li key={c.user_id}>
                    <Link to={`/messages/${c.user_id}`}
                      className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50">
                      <Avatar name={toText(c.full_name)} size="w-10 h-10" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${c.unread ? 'font-bold' : 'font-medium'}`}>{toText(c.full_name)}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {c.last_message ? `${c.last_from_me ? 'You: ' : ''}${toText(c.last_message)}` : 'Say hello'}
                        </p>
                      </div>
                      {toCount(c.unread) > 0 && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center">
                          {toCount(c.unread)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Notifications"
            action={notifs.unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-emerald-700 hover:underline">Mark all read</button>
            )}>
            {loading ? <Skeleton rows={2} /> : notifs.items.length === 0 ? (
              <Empty icon="bell">You're all caught up.</Empty>
            ) : (
              <ul className="space-y-1">
                {notifs.items.slice(0, 5).map((n) => (
                  <li key={n.id}>
                    <button onClick={() => openNotification(n)}
                      className="w-full text-left flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.is_read ? 'bg-gray-300' : 'bg-emerald-500'}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm truncate ${n.is_read ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>{toText(n.title)}</span>
                        <span className="block text-[11px] text-gray-400">{timeAgo(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}