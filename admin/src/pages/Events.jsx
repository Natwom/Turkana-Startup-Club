import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api, { errorMessage } from '../services/api'

/* ------------------------------------------------------------------ constants */
const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-sky-100 text-sky-700',
}

const STATUS_TABS = [
  ['all', 'All'],
  ['draft', 'Drafts'],
  ['published', 'Published'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
]

const PAGE_SIZES = [10, 25, 50]

const emptyForm = { title: '', description: '', location: '', starts_at: '', ends_at: '', capacity: '' }

/* ------------------------------------------------------------------ helpers */
const asList = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [])
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const toDate = (d) => {
  if (!d) return null
  const t = new Date(d)
  return isNaN(t) ? null : t
}

const fmtDate = (d) => {
  const t = toDate(d)
  return t
    ? t.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
}

const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// 'past' | 'live' | 'upcoming' | 'unknown'
const phaseOf = (ev) => {
  const start = toDate(ev.starts_at)
  if (!start) return 'unknown'
  const now = new Date()
  const end = toDate(ev.ends_at) || new Date(startOfDay(start).getTime() + 86400000 - 1)
  if (now > end) return 'past'
  if (now >= start) return 'live'
  return 'upcoming'
}

const whenLabel = (ev) => {
  const phase = phaseOf(ev)
  if (phase === 'past') return 'Ended'
  if (phase === 'live') return 'Happening now'
  if (phase === 'unknown') return ''
  const days = Math.round((startOfDay(toDate(ev.starts_at)) - startOfDay(new Date())) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

function downloadCsv(list) {
  const rows = [['Title', 'Location', 'Starts', 'Ends', 'Capacity', 'Registered', 'Attended', 'Status']]
  list.forEach((ev) => rows.push([
    ev.title || '', ev.location || '', ev.starts_at || '', ev.ends_at || '',
    ev.capacity ?? '', num(ev.registrations), num(ev.attendance), ev.status || '',
  ]))
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tsc-events-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------ icons */
const ICONS = {
  search: <path d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  refresh: (
    <>
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  left: <path d="M15 18l-6-6 6-6" />,
  right: <path d="M9 18l6-6-6-6" />,
  up: <path d="M18 15l-6-6-6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  pin: (
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  ticket: (
    <>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
      <path d="M13 5v2M13 11v2M13 17v2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </>
  ),
}

function Icon({ name, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

/* ------------------------------------------------------------------ small components */
function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status || 'unknown'}
    </span>
  )
}

function WhenChip({ ev }) {
  const label = whenLabel(ev)
  if (!label) return null
  const phase = phaseOf(ev)
  const cls = phase === 'live'
    ? 'bg-emerald-50 text-emerald-700'
    : phase === 'past'
      ? 'bg-slate-100 text-slate-500'
      : 'bg-blue-50 text-blue-700'
  return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
}

function Registrations({ ev }) {
  const reg = num(ev.registrations)
  const cap = num(ev.capacity)
  if (!cap) {
    return (
      <div>
        <p className="font-medium text-slate-800">{reg}</p>
        <p className="text-xs text-slate-400">No limit set</p>
      </div>
    )
  }
  const pct = Math.min(100, Math.round((reg / cap) * 100))
  const full = reg >= cap
  return (
    <div className="min-w-[8rem]">
      <p className="text-slate-800">
        <span className="font-medium">{reg}</span>
        <span className="text-slate-400"> / {cap}</span>
        {full && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Full</span>}
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Capacity used">
        <div className={`h-full rounded-full ${full ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Attendance({ ev }) {
  const reg = num(ev.registrations)
  const att = num(ev.attendance)
  const rate = reg > 0 ? Math.round((att / reg) * 100) : null
  return (
    <div>
      <p className="font-medium text-slate-800">{att}</p>
      {rate !== null && phaseOf(ev) !== 'upcoming' && <p className="text-xs text-slate-400">{rate}% of registered</p>}
    </div>
  )
}

function RowActions({ ev, busy, onPublish, onCancel }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {ev.status === 'draft' && (
        <button onClick={onPublish} disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
          Publish
        </button>
      )}
      {ev.status === 'published' && (
        <button onClick={onCancel} disabled={busy}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50">
          Cancel event
        </button>
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xl font-bold leading-none text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

function SortHeader({ label, active, dir, onClick }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 font-semibold hover:text-slate-900">
      {label}
      <span className={active ? 'text-emerald-600' : 'text-slate-300'}>
        <Icon name={active && dir === 'desc' ? 'down' : 'up'} className="h-3.5 w-3.5" />
      </span>
    </button>
  )
}

function Toast({ toast, onClose }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div role="status"
      className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg ${
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
      <Icon name={ok ? 'check' : 'alert'} className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{toast.text}</span>
      <button onClick={onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  )
}

function Modal({ title, subtitle, children, onClose, labelledBy, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'} rounded-2xl bg-white p-6 shadow-2xl`}>
        <h2 id={labelledBy} className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

function ConfirmDialog({ dialog, busy, onCancel, onConfirm }) {
  const danger = dialog.tone === 'danger'
  return (
    <Modal title={dialog.title} onClose={busy ? () => {} : onCancel} labelledBy="confirm-title">
      <p className="mt-2 text-sm text-slate-600">{dialog.message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onCancel} disabled={busy}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
          Keep as is
        </button>
        <button onClick={onConfirm} disabled={busy} autoFocus
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
          {busy ? 'Working…' : dialog.confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ create form */
function EventFormModal({ onClose, onCreate }) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const titleRef = useRef(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  const validate = () => {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Give the event a title.'
    if (form.capacity !== '' && (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1)) {
      errs.capacity = 'Capacity must be a whole number of 1 or more.'
    }
    if (form.starts_at && form.ends_at && new Date(form.ends_at) < new Date(form.starts_at)) {
      errs.ends_at = 'The end time must be after the start time.'
    }
    return errs
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return
    setSaving(true)
    setServerError('')
    try {
      await onCreate({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim() || undefined,
        starts_at: form.starts_at || undefined,
        ends_at: form.ends_at || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      })
    } catch (err) {
      setServerError(errorMessage(err, 'Failed to create event'))
      setSaving(false)
    }
  }

  const inputCls = (hasError) =>
    `w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
      hasError ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500'}`
  const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-600'
  const errCls = 'mt-1 text-xs text-red-600'

  return (
    <Modal title="Create event" subtitle="It is saved as a draft. Publish it when you are ready for members to see it."
      onClose={saving ? () => {} : onClose} labelledBy="event-form-title" wide>
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {serverError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="ev-title" className={labelCls}>Title *</label>
            <input id="ev-title" ref={titleRef} value={form.title} onChange={set('title')}
              className={inputCls(errors.title)} placeholder="e.g. Turkana Founders Meetup" />
            {errors.title && <p className={errCls}>{errors.title}</p>}
          </div>

          <div>
            <label htmlFor="ev-location" className={labelCls}>Location</label>
            <input id="ev-location" value={form.location} onChange={set('location')}
              className={inputCls(false)} placeholder="e.g. Lodwar, Turkana" />
          </div>

          <div>
            <label htmlFor="ev-capacity" className={labelCls}>Capacity</label>
            <input id="ev-capacity" type="number" min="1" step="1" value={form.capacity} onChange={set('capacity')}
              className={inputCls(errors.capacity)} placeholder="Leave empty for no limit" />
            {errors.capacity && <p className={errCls}>{errors.capacity}</p>}
          </div>

          <div>
            <label htmlFor="ev-starts" className={labelCls}>Starts at</label>
            <input id="ev-starts" type="datetime-local" value={form.starts_at} onChange={set('starts_at')}
              className={inputCls(false)} />
          </div>

          <div>
            <label htmlFor="ev-ends" className={labelCls}>Ends at</label>
            <input id="ev-ends" type="datetime-local" value={form.ends_at} onChange={set('ends_at')}
              className={inputCls(errors.ends_at)} />
            {errors.ends_at && <p className={errCls}>{errors.ends_at}</p>}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="ev-desc" className={labelCls}>Description</label>
            <textarea id="ev-desc" rows={3} value={form.description} onChange={set('description')}
              className={inputCls(false)} placeholder="What is this event about?" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
            {saving ? 'Creating…' : 'Create draft'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ page */
export default function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [whenFilter, setWhenFilter] = useState('all')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [busyId, setBusyId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const reqId = useRef(0)
  const toastTimer = useRef(null)

  const notify = useCallback((type, text) => {
    clearTimeout(toastTimer.current)
    setToast({ type, text })
    toastTimer.current = setTimeout(() => setToast(null), 4500)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  /* ---- load */
  const load = useCallback(async () => {
    const id = ++reqId.current
    setRefreshing(true)
    try {
      const r = await api.get('/admin/events')
      if (id !== reqId.current) return
      setEvents(asList(r.data))
      setError('')
    } catch (err) {
      if (id !== reqId.current) return
      setError(errorMessage(err, 'Failed to load events'))
    } finally {
      if (id === reqId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => { setPage(1) }, [q, statusFilter, whenFilter, sortKey, sortDir])

  /* ---- derived data */
  const summary = useMemo(() => {
    const upcoming = events.filter((e) => e.status === 'published' && ['upcoming', 'live'].includes(phaseOf(e)))
    return {
      total: events.length,
      upcoming: upcoming.length,
      drafts: events.filter((e) => e.status === 'draft').length,
      registrations: events.reduce((sum, e) => sum + num(e.registrations), 0),
    }
  }, [events])

  const tabCounts = useMemo(() => {
    const c = { all: events.length }
    events.forEach((e) => { c[e.status] = (c[e.status] || 0) + 1 })
    return c
  }, [events])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return events.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (whenFilter === 'upcoming' && !['upcoming', 'live'].includes(phaseOf(e))) return false
      if (whenFilter === 'past' && phaseOf(e) !== 'past') return false
      if (term && !`${e.title || ''} ${e.location || ''}`.toLowerCase().includes(term)) return false
      return true
    })
  }, [events, q, statusFilter, whenFilter])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      if (sortKey === 'title') {
        const c = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
        return sortDir === 'asc' ? c : -c
      }
      const ta = toDate(a.starts_at)?.getTime()
      const tb = toDate(b.starts_at)?.getTime()
      // events without a date always go to the bottom
      if (ta === undefined && tb === undefined) return 0
      if (ta === undefined) return 1
      if (tb === undefined) return -1
      return sortDir === 'asc' ? ta - tb : tb - ta
    })
    return list
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  const hasFilters = q.trim() !== '' || statusFilter !== 'all' || whenFilter !== 'all'
  const clearFilters = () => { setQ(''); setStatusFilter('all'); setWhenFilter('all') }

  /* ---- actions */
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'title' ? 'asc' : 'desc') }
  }

  const runAction = async (ev, action, doneText) => {
    setBusyId(ev.id)
    try {
      await api.post(`/admin/events/${ev.id}/${action}`)
      notify('success', doneText)
      await load()
    } catch (err) {
      notify('warning', errorMessage(err, 'That action failed'))
    } finally {
      setBusyId(null)
    }
  }

  const askPublish = (ev) =>
    setConfirm({
      title: 'Publish this event?',
      message: `"${ev.title}" will become visible to members, who can then register for it.`,
      confirmLabel: 'Publish',
      tone: 'primary',
      run: () => runAction(ev, 'publish', `"${ev.title}" is now published.`),
    })

  const askCancel = (ev) =>
    setConfirm({
      title: 'Cancel this event?',
      message: `"${ev.title}" will be cancelled and its registrants will be notified. This cannot be undone from this page.`,
      confirmLabel: 'Cancel event',
      tone: 'danger',
      run: () => runAction(ev, 'cancel', `"${ev.title}" was cancelled.`),
    })

  const doConfirm = async () => {
    if (!confirm) return
    setConfirmBusy(true)
    try { await confirm.run() } finally {
      setConfirmBusy(false)
      setConfirm(null)
    }
  }

  const createEvent = async (payload) => {
    await api.post('/admin/events', payload)   // errors are shown inside the form
    setShowForm(false)
    notify('success', 'Event created as a draft. Publish it when you are ready.')
    await load()
  }

  const rowProps = (ev) => ({
    ev,
    busy: busyId === ev.id,
    onPublish: () => askPublish(ev),
    onCancel: () => askCancel(ev),
  })

  /* ---- render */
  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="mt-1 text-sm text-slate-500">Create events, publish them and track registrations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => downloadCsv(sorted)} disabled={sorted.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Icon name="download" />
            Export CSV
          </button>
          <button onClick={load} disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-70">
            <Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
            <Icon name="plus" />
            New event
          </button>
        </div>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard icon="calendar" label="Total events" value={summary.total} tone="bg-slate-100 text-slate-700" />
        <SummaryCard icon="globe" label="Upcoming and live" value={summary.upcoming} tone="bg-emerald-50 text-emerald-700" />
        <SummaryCard icon="edit" label="Drafts to publish" value={summary.drafts} tone="bg-amber-50 text-amber-700" />
        <SummaryCard icon="ticket" label="Total registrations" value={summary.registrations.toLocaleString()} tone="bg-blue-50 text-blue-700" />
      </div>

      {/* filters */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative max-w-md flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" />
            </span>
            <input type="search" placeholder="Search title or location…" value={q}
              onChange={(e) => setQ(e.target.value)} aria-label="Search events"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <select value={whenFilter} onChange={(e) => setWhenFilter(e.target.value)} aria-label="Date range"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="all">All dates</option>
            <option value="upcoming">Upcoming and live</option>
            <option value="past">Past</option>
          </select>

          {hasFilters && (
            <button onClick={clearFilters} className="text-sm font-medium text-emerald-700 hover:underline">
              Clear filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:inline-flex" role="tablist" aria-label="Event status">
          {STATUS_TABS.map(([value, label]) => (
            <button key={value} role="tab" aria-selected={statusFilter === value} onClick={() => setStatusFilter(value)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === value ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              {label}
              <span className={`ml-1.5 text-xs ${statusFilter === value ? 'text-emerald-100' : 'text-slate-400'}`}>
                {tabCounts[value] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="shrink-0 font-semibold underline">Retry</button>
        </div>
      )}

      {/* list */}
      <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity ${refreshing && !loading ? 'opacity-70' : ''}`}>
        {/* desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="p-4">
                  <SortHeader label="Event" active={sortKey === 'title'} dir={sortDir} onClick={() => toggleSort('title')} />
                </th>
                <th className="p-4">
                  <SortHeader label="Date" active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
                </th>
                <th className="p-4 font-semibold">Registered</th>
                <th className="p-4 font-semibold">Attended</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="p-4"><div className="h-5 animate-pulse rounded bg-slate-100" /></td></tr>
              ))}

              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <p className="text-slate-500">
                      {events.length === 0 ? 'No events yet.' : 'No events match your filters.'}
                    </p>
                    {events.length === 0 ? (
                      <button onClick={() => setShowForm(true)} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
                        Create your first event
                      </button>
                    ) : hasFilters && (
                      <button onClick={clearFilters} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {!loading && pageItems.map((ev) => (
                <tr key={ev.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="max-w-[18rem] p-4">
                    <p className="truncate font-medium text-slate-900">{ev.title}</p>
                    {ev.location && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                        <Icon name="pin" className="h-3 w-3 shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-4 text-slate-600">
                    {fmtDate(ev.starts_at)}
                    <div><WhenChip ev={ev} /></div>
                  </td>
                  <td className="p-4"><Registrations ev={ev} /></td>
                  <td className="p-4"><Attendance ev={ev} /></td>
                  <td className="p-4"><StatusBadge status={ev.status} /></td>
                  <td className="p-4"><RowActions {...rowProps(ev)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* mobile cards */}
        <div className="divide-y divide-slate-100 md:hidden">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4"><div className="h-20 animate-pulse rounded bg-slate-100" /></div>
          ))}

          {!loading && pageItems.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-slate-500">{events.length === 0 ? 'No events yet.' : 'No events match your filters.'}</p>
              {hasFilters && (
                <button onClick={clearFilters} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          )}

          {!loading && pageItems.map((ev) => (
            <div key={ev.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{ev.title}</p>
                  {ev.location && <p className="mt-0.5 text-xs text-slate-500">{ev.location}</p>}
                  <p className="mt-1 text-xs text-slate-600">{fmtDate(ev.starts_at)}</p>
                  <WhenChip ev={ev} />
                </div>
                <StatusBadge status={ev.status} />
              </div>
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3 text-sm">
                <div>
                  <p className="mb-1 text-xs text-slate-500">Registered</p>
                  <Registrations ev={ev} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-500">Attended</p>
                  <Attendance ev={ev} />
                </div>
              </div>
              <RowActions {...rowProps(ev)} />
            </div>
          ))}
        </div>

        {/* pagination */}
        {!loading && sorted.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>Showing {start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                Rows
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page"
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40">
                  <Icon name="left" />
                </button>
                <span className="px-2">Page {safePage} of {totalPages}</span>
                <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages} aria-label="Next page"
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40">
                  <Icon name="right" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showForm && <EventFormModal onClose={() => setShowForm(false)} onCreate={createEvent} />}
      {confirm && <ConfirmDialog dialog={confirm} busy={confirmBusy} onCancel={() => setConfirm(null)} onConfirm={doConfirm} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}