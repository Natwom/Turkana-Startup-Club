import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

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
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
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
  checkCircle: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4L12 14.01l-3-3" />
    </>
  ),
  code: <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />,
  award: (
    <>
      <circle cx="12" cy="8" r="7" />
      <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
    </>
  ),
  folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  zap: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  heart: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  pin: (
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  refresh: (
    <>
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  arrow: <path d="M5 12h14M12 5l7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
}

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

/* ------------------------------------------------------------------ config */
const TONES = {
  emerald: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  violet: 'bg-violet-50 text-violet-700',
  rose: 'bg-rose-50 text-rose-700',
  slate: 'bg-slate-100 text-slate-700',
}

// key from the API -> label, icon, tone and the admin page that card opens
const METRICS = {
  members: { label: 'Total members', icon: 'users', tone: 'emerald', to: '/admin/members' },
  verified_members: { label: 'Verified members', icon: 'shield', tone: 'emerald', to: '/admin/members' },
  pending_verification: { label: 'Pending verification', icon: 'clock', tone: 'amber', to: '/admin/members' },
  mentors: { label: 'Mentors', icon: 'award', tone: 'violet', to: '/admin/mentorship/requests' },
  volunteers: { label: 'Volunteers', icon: 'heart', tone: 'rose', to: '/admin/volunteers/applications' },
  events: { label: 'Events', icon: 'calendar', tone: 'blue', to: '/admin/events' },
  event_registrations: { label: 'Event registrations', icon: 'ticket', tone: 'blue', to: '/admin/events/registrations' },
  attendance: { label: 'Attendance', icon: 'checkCircle', tone: 'emerald', to: '/admin/events/registrations' },
  hackathons: { label: 'Hackathons', icon: 'code', tone: 'violet', to: '/admin/hackathons/all-hackathons' },
  certificates: { label: 'Certificates issued', icon: 'award', tone: 'amber', to: '/admin/certificates/issued' },
  projects: { label: 'Projects', icon: 'folder', tone: 'slate', to: '/admin/projects/all-projects' },
  startups: { label: 'Startups', icon: 'zap', tone: 'amber', to: '/admin/startups/all-startups' },
  chapters: { label: 'Chapters', icon: 'pin', tone: 'blue', to: '/admin/chapters/all-chapters' },
  opportunities: { label: 'Opportunities', icon: 'briefcase', tone: 'slate', to: '/admin/opportunities/all' },
}

const GROUPS = [
  ['People', ['members', 'verified_members', 'pending_verification', 'mentors', 'volunteers']],
  ['Events and programs', ['events', 'event_registrations', 'attendance', 'hackathons', 'certificates']],
  ['Ecosystem', ['projects', 'startups', 'chapters', 'opportunities']],
]

const QUICK_ACTIONS = [
  ['Create event', '/admin/events/create-event', 'calendar'],
  ['Add hackathon', '/admin/hackathons/all-hackathons', 'code'],
  ['Issue certificate', '/admin/certificates/generate', 'award'],
  ['Add opportunity', '/admin/opportunities/all', 'briefcase'],
  ['Create chapter', '/admin/chapters/create-chapter', 'pin'],
  ['Send announcement', '/admin/communications/announcements', 'plus'],
]

// Which page should "Review" open for a pending-action key? Matches by keyword,
// so it still works if the backend adds or renames keys.
const reviewTarget = (key) => {
  const k = key.toLowerCase()
  if (k.includes('project')) return '/admin/projects/pending-approval'
  if (k.includes('startup')) return '/admin/startups/pending-approval'
  if (k.includes('opportunit')) return '/admin/opportunities/pending-approval'
  if (k.includes('resource')) return '/admin/resources/pending-approval'
  if (k.includes('volunteer')) return '/admin/volunteers/applications'
  if (k.includes('mentor')) return '/admin/mentorship/requests'
  if (k.includes('sponsor') || k.includes('partner')) return '/admin/sponsors-partners/sponsors'
  if (k.includes('report') || k.includes('moderat')) return '/admin/moderation/reports'
  if (k.includes('hackathon')) return '/admin/hackathons/all-hackathons'
  if (k.includes('event')) return '/admin/events'
  return '/admin/members'
}

const REFRESH_MS = 60000

/* ------------------------------------------------------------------ helpers */
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const fmt = (v) => num(v).toLocaleString()
const pct = (a, b) => (num(b) > 0 ? Math.min(100, Math.round((num(a) / num(b)) * 100)) : 0)
const titleCase = (s) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function downloadCsv(totals, pending) {
  const rows = [['Section', 'Metric', 'Value']]
  Object.entries(METRICS).forEach(([key, m]) => rows.push(['Totals', m.label, num(totals?.[key])]))
  Object.entries(pending || {}).forEach(([key, count]) => rows.push(['Pending actions', titleCase(key), num(count)]))
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tsc-dashboard-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------ small components */
function StatCard({ metric, value }) {
  return (
    <Link to={metric.to}
      className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONES[metric.tone]}`}>
        <Icon name={metric.icon} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-slate-900">{fmt(value)}</p>
        <p className="mt-1.5 truncate text-xs text-gray-500">{metric.label}</p>
      </div>
      <Icon name="arrow" className="ml-auto h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-emerald-600" />
    </Link>
  )
}

function Panel({ title, subtitle, action, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-5 pt-4">{children}</div>
    </section>
  )
}

function Bar({ label, value, hint, tone = 'bg-emerald-600' }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold text-slate-900">{value}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100"
        role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${tone} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function SkeletonDashboard() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-28 rounded-2xl bg-gray-200" />
      {[5, 5, 4].map((n, i) => (
        <div key={i}>
          <div className="mb-3 h-4 w-32 rounded bg-gray-200" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: n }).map((_, j) => <div key={j} className="h-[76px] rounded-xl bg-gray-100" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ page */
export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const mounted = useRef(true)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const r = await api.get('/admin/dashboard')
      if (!mounted.current) return
      setData(r.data)
      setError('')
      setUpdatedAt(new Date())
    } catch (e) {
      if (!mounted.current) return
      if (e.response?.status === 403) {
        setError("You don't have permission to view the dashboard (admin.dashboard). Ask a super admin to update your role.")
      } else if (!e.response) {
        setError('Cannot reach the server. Check your connection and try again.')
      } else {
        setError('Could not load the dashboard. Please try again.')
      }
    } finally {
      if (mounted.current) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    load()
    // keep the numbers fresh, but only while the tab is visible
    const t = setInterval(() => { if (!document.hidden) load() }, REFRESH_MS)
    return () => { mounted.current = false; clearInterval(t) }
  }, [load])

  const totals = data?.totals || {}
  const pending = data?.pending_actions || {}

  const pendingList = useMemo(
    () => Object.entries(pending).map(([key, count]) => ({ key, count: num(count) })).sort((a, b) => b.count - a.count),
    [pending]
  )
  const pendingTotal = pendingList.reduce((sum, p) => sum + p.count, 0)

  const verifiedRate = pct(totals.verified_members, totals.members)
  const attendanceRate = pct(totals.attendance, totals.event_registrations)
  const perEvent = num(totals.events) > 0 ? (num(totals.event_registrations) / num(totals.events)).toFixed(1) : '0'

  /* ---- first load / failure with nothing to show */
  if (!data && !error) return <SkeletonDashboard />

  if (!data && error) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
          <Icon name="alert" />
        </span>
        <p className="text-sm text-red-800">{error}</p>
        <button onClick={() => load(true)} disabled={refreshing}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
          {refreshing ? 'Retrying…' : 'Try again'}
        </button>
      </div>
    )
  }

  /* ---- dashboard */
  return (
    <div className="space-y-8">
      {/* header */}
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-emerald-200">
              {greeting()} · {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Ecosystem dashboard</h1>
            <p className="mt-1 text-sm text-slate-300">
              {pendingTotal > 0
                ? `${fmt(pendingTotal)} item${pendingTotal === 1 ? '' : 's'} waiting for your review.`
                : 'Everything is up to date. Nothing is waiting for review.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => downloadCsv(totals, pending)}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-sm font-medium hover:bg-white/20">
              <Icon name="download" className="h-4 w-4" />
              Export CSV
            </button>
            <button onClick={() => load(true)} disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-slate-900 hover:bg-emerald-50 disabled:opacity-70">
              <Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        {updatedAt && (
          <p className="mt-4 text-xs text-slate-400">
            Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · refreshes automatically every minute
          </p>
        )}
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error} Showing the last loaded numbers.</span>
        </div>
      )}

      {/* needs attention + health */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Action center"
            subtitle={pendingTotal > 0 ? `${fmt(pendingTotal)} pending in total, largest first` : 'No pending actions'}
          >
            {pendingList.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">No pending actions to show.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {pendingList.map(({ key, count }) => (
                  <li key={key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${count > 0 ? TONES.amber : TONES.emerald}`}>
                      <Icon name={count > 0 ? 'clock' : 'checkCircle'} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{titleCase(key)}</p>
                      <p className="text-sm text-gray-500">{count > 0 ? `${fmt(count)} pending` : 'All clear'}</p>
                    </div>
                    {count > 0 && (
                      <Link to={reviewTarget(key)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
                        Review
                        <Icon name="arrow" className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Community health" subtitle="Calculated from the totals below">
          <div className="space-y-5">
            <Bar label="Members verified" value={verifiedRate}
              hint={`${fmt(totals.verified_members)} of ${fmt(totals.members)} members`} />
            <Bar label="Event attendance" value={attendanceRate} tone="bg-blue-600"
              hint={`${fmt(totals.attendance)} of ${fmt(totals.event_registrations)} registrations`} />
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
              <span className="text-gray-600">Registrations per event</span>
              <span className="font-semibold text-slate-900">{perEvent}</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* quick actions */}
      <Panel title="Quick actions" subtitle="Jump straight to the most common tasks">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {QUICK_ACTIONS.map(([label, to, icon]) => (
            <Link key={label} to={to}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 px-3 py-4 text-center text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Icon name={icon} className="h-[18px] w-[18px]" />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </Panel>

      {/* grouped metrics */}
      {GROUPS.map(([title, keys]) => (
        <section key={title}>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {keys.map((key) => <StatCard key={key} metric={METRICS[key]} value={totals[key]} />)}
          </div>
        </section>
      ))}
    </div>
  )
}