import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { errorMessage } from '../services/api'
import { FORMS, ROW_ACTIONS } from '../services/moduleConfig'

/* ------------------------------------------------------------------ constants */
const PAGE_SIZES = [10, 25, 50]
const MAX_COLUMNS = 7

const TONE_CLASSES = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
}

const STATUS_TONES = {
  green: ['approved', 'verified', 'published', 'active', 'open', 'live', 'completed', 'accepted',
    'resolved', 'issued', 'registered', 'confirmed', 'running', 'attended', 'featured'],
  amber: ['pending', 'draft', 'upcoming', 'judging', 'waitlisted', 'review', 'submitted'],
  red: ['rejected', 'cancelled', 'canceled', 'suspended', 'failed', 'declined', 'banned'],
}

const ACTION_TONES = {
  green: 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600',
  red: 'bg-white border border-red-200 text-red-600 hover:bg-red-50',
  gray: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
}

/* ------------------------------------------------------------------ helpers */
const pretty = (s = '') =>
  s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

const columnLabel = (c) => pretty(c.replace(/_/g, '-'))

const isDate = (v) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(Date.parse(v))

const isUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

const isEmpty = (v) => v === null || v === undefined || v === ''

const stringify = (v) => (isEmpty(v) ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

const isFlagColumn = (c) => /^(is|has)_/.test(c)
const flagValue = (v) => {
  if (v === true || v === 1 || v === '1' || v === 'true') return true
  if (v === false || v === 0 || v === '0' || v === 'false') return false
  return undefined
}

const isStatusColumn = (c) => /(^|_)status$/.test(c)
const statusTone = (v) => {
  const s = String(v).toLowerCase()
  return Object.keys(STATUS_TONES).find((tone) => STATUS_TONES[tone].includes(s)) || 'slate'
}

function downloadCsv(rows, columns, name) {
  const lines = [columns.map(columnLabel), ...rows.map((r) => columns.map((c) => stringify(r[c])))]
  const csv = lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tsc-${name || 'export'}-${new Date().toISOString().slice(0, 10)}.csv`
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
  box: (
    <>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
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
function Cell({ v, col }) {
  if (isEmpty(v)) return <span className="text-slate-300">—</span>

  const flag = typeof v === 'boolean' ? v : isFlagColumn(col) ? flagValue(v) : undefined
  if (flag !== undefined) {
    return flag
      ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Yes</span>
      : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">No</span>
  }

  if (isStatusColumn(col) && typeof v === 'string') {
    return (
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${TONE_CLASSES[statusTone(v)]}`}>
        {v.replace(/_/g, ' ')}
      </span>
    )
  }

  if (isDate(v)) return <span className="whitespace-nowrap">{new Date(v).toLocaleString()}</span>

  if (typeof v === 'object') {
    const t = JSON.stringify(v)
    return <span className="text-xs text-slate-500" title={t}>{t.length > 60 ? `${t.slice(0, 60)}…` : t}</span>
  }

  const s = String(v)
  if (/^https?:\/\//i.test(s)) {
    return (
      <a href={s} target="_blank" rel="noopener noreferrer" className="break-all text-emerald-700 hover:underline">
        {s.length > 40 ? `${s.slice(0, 40)}…` : s}
      </a>
    )
  }
  if (s.length > 80) return <span title={s}>{s.slice(0, 80)}…</span>
  return s
}

function SortHeader({ label, active, dir, onClick }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 whitespace-nowrap font-semibold hover:text-slate-900">
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

function Modal({ title, children, onClose, labelledBy, wide = false }) {
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
          Cancel
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

/* ------------------------------------------------------------------ add / issue form */
function ActionForm({ config, onSaved, onCancel }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(config.fields.map((f) => [f.name, f.default ?? ''])))
  const [opts, setOpts] = useState({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [missing, setMissing] = useState([])

  useEffect(() => {
    let alive = true
    config.fields.filter((f) => f.optionsFrom).forEach(async (f) => {
      try {
        const r = await api.get(f.optionsFrom)
        const list = Array.isArray(r.data) ? r.data : Array.isArray(r.data?.items) ? r.data.items : []
        if (!alive) return
        setOpts((o) => ({
          ...o,
          [f.name]: list.map((x) => ({
            value: x[f.valueKey],
            label: f.labelExtra ? `${x[f.labelKey]} (${x[f.labelExtra]})` : x[f.labelKey],
          })),
        }))
      } catch {
        if (alive) setOpts((o) => ({ ...o, [f.name]: [] }))
      }
    })
    return () => { alive = false }
  }, [config])

  const submit = async (e) => {
    e.preventDefault()

    const empty = config.fields.filter((f) => f.required && isEmpty(values[f.name]))
    setMissing(empty.map((f) => f.name))
    if (empty.length) {
      setErr(`Please fill in: ${empty.map((f) => f.label).join(', ')}.`)
      return
    }

    setSaving(true)
    setErr('')
    const payload = {}
    config.fields.forEach((f) => {
      const v = values[f.name]
      if (isEmpty(v)) return
      payload[f.name] = f.type === 'number' ? Number(v) : v
    })
    try {
      const r = await api.post(config.endpoint, payload)
      onSaved(r.data?.message || 'Saved')
    } catch (ex) {
      setErr(errorMessage(ex, 'Could not save'))
      setSaving(false)
    }
  }

  const fieldCls = (name) =>
    `w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
      missing.includes(name)
        ? 'border-red-300 focus:ring-red-400'
        : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500'}`

  const renderField = (f, index) => {
    const set = (v) => {
      setValues((s) => ({ ...s, [f.name]: v }))
      setMissing((m) => m.filter((n) => n !== f.name))
    }
    const common = { id: `f-${f.name}`, value: values[f.name], className: fieldCls(f.name), autoFocus: index === 0 }

    if (f.type === 'textarea') {
      return <textarea rows={3} {...common} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
    }

    if (f.type === 'select') {
      const loadingOptions = f.optionsFrom && opts[f.name] === undefined
      const list = f.optionsFrom ? (opts[f.name] ?? []) : f.options.map((o) => ({ value: o, label: o }))
      return (
        <>
          <select {...common} onChange={(e) => set(e.target.value)} disabled={loadingOptions}>
            <option value="">{loadingOptions ? 'Loading…' : 'Select…'}</option>
            {list.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {f.optionsFrom && opts[f.name] && opts[f.name].length === 0 && (
            <p className="mt-1 text-xs text-amber-600">{f.emptyHint || 'Nothing to choose from yet.'}</p>
          )}
        </>
      )
    }

    return (
      <input type={f.type || 'text'} {...common} placeholder={f.placeholder}
        min={f.type === 'number' ? 0 : undefined} onChange={(e) => set(e.target.value)} />
    )
  }

  return (
    <form onSubmit={submit} noValidate className="mt-5 space-y-4">
      {err && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{err}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {config.fields.map((f, i) => (
          <div key={f.name} className={f.wide ? 'sm:col-span-2' : ''}>
            <label htmlFor={`f-${f.name}`} className="mb-1.5 block text-xs font-semibold text-slate-600">
              {f.label}{f.required ? ' *' : ''}
            </label>
            {renderField(f, i)}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            Cancel
          </button>
        )}
        <button type="submit" disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving ? 'Saving…' : config.button}
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ page */
export default function ModulePage() {
  const { '*': splat = '' } = useParams()
  const segments = splat.split('/').filter(Boolean)
  const title = pretty(segments[segments.length - 1] || 'Module')
  const apiPath = `/admin/${splat}`
  const form = FORMS[splat]
  const actions = ROW_ACTIONS[splat] || []

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null) // null or { status, message }

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [showForm, setShowForm] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [busyId, setBusyId] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const reqId = useRef(0)
  const dataRef = useRef(null)
  const toastTimer = useRef(null)

  useEffect(() => { dataRef.current = data }, [data])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const notify = useCallback((type, text) => {
    clearTimeout(toastTimer.current)
    setToast({ type, text })
    toastTimer.current = setTimeout(() => setToast(null), 4500)
  }, [])

  /* ---- load */
  const load = useCallback(async (silent = false) => {
    const id = ++reqId.current
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const r = await api.get(apiPath)
      if (id !== reqId.current) return
      setData(r.data)
      setError(null)
    } catch (err) {
      if (id !== reqId.current) return
      const message = errorMessage(err, 'Something went wrong while loading this page.')
      if (silent && dataRef.current) {
        notify('warning', `Could not refresh: ${message}`)   // keep the rows already on screen
      } else {
        setError({ status: err.response?.status ?? 0, message })
        setData(null)
      }
    } finally {
      if (id === reqId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [apiPath, notify])

  // moving between sidebar pages starts from a clean slate
  useEffect(() => {
    setQ('')
    setStatusFilter('all')
    setSortKey(null)
    setSortDir('asc')
    setPage(1)
    setShowForm(false)
    setToast(null)
    setFormKey((k) => k + 1)
    setData(null)
    load(false)
  }, [load])

  useEffect(() => { setPage(1) }, [q, statusFilter, sortKey, sortDir])

  /* ---- derived data */
  const rows = useMemo(() => {
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : null
    return list ? list.map((r) => (r && typeof r === 'object' ? r : { value: r })) : null
  }, [data])

  const obj = !rows && data && typeof data === 'object' ? data : null

  // hide the id column and raw foreign-key UUID columns
  const columns = useMemo(() => {
    if (!rows || rows.length === 0) return []
    const sample = rows[0]
    return Object.keys(sample)
      .filter((k) => k !== 'id' && !(k.endsWith('_id') && isUuid(sample[k])))
      .slice(0, MAX_COLUMNS)
  }, [rows])

  const hasStatus = columns.includes('status')

  const statusCounts = useMemo(() => {
    if (!rows || !hasStatus) return null
    const c = {}
    rows.forEach((r) => {
      const s = isEmpty(r.status) ? 'unknown' : String(r.status).toLowerCase()
      c[s] = (c[s] || 0) + 1
    })
    const keys = Object.keys(c)
    return keys.length >= 2 && keys.length <= 8 ? c : null
  }, [rows, hasStatus])

  const filtered = useMemo(() => {
    if (!rows) return []
    const term = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter !== 'all') {
        const s = isEmpty(r.status) ? 'unknown' : String(r.status).toLowerCase()
        if (s !== statusFilter) return false
      }
      if (term && !columns.some((c) => stringify(r[c]).toLowerCase().includes(term))) return false
      return true
    })
  }, [rows, q, statusFilter, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const list = [...filtered]
    list.sort((x, y) => {
      const a = x[sortKey]
      const b = y[sortKey]
      const an = isEmpty(a)
      const bn = isEmpty(b)
      if (an || bn) return an === bn ? 0 : an ? 1 : -1   // empty values always last
      let c
      if (typeof a === 'number' && typeof b === 'number') c = a - b
      else if (isDate(a) && isDate(b)) c = Date.parse(a) - Date.parse(b)
      else c = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? c : -c
    })
    return list
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  const hasActions = actions.length > 0 && rows && rows.length > 0 && 'id' in rows[0]
  const hasFilters = q.trim() !== '' || statusFilter !== 'all'
  const clearFilters = () => { setQ(''); setStatusFilter('all') }

  const noEndpoint = error && [404, 405, 501].includes(error.status)
  const noList = Boolean(noEndpoint && form)   // a form, but no list endpoint yet

  /* ---- actions */
  const toggleSort = (key) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc') }
    else if (sortDir === 'asc') setSortDir('desc')
    else { setSortKey(null); setSortDir('asc') }
  }

  const onSaved = (msg) => {
    notify('success', msg)
    setShowForm(false)
    setFormKey((k) => k + 1)
    load(true)
  }

  const runAction = async (row, a) => {
    setBusyId(row.id)
    try {
      const r = await api.post(`/admin/${a.base}/${row.id}/${a.action}`)
      notify('success', r.data?.message || `${a.label} done.`)
      await load(true)
    } catch (err) {
      notify('warning', errorMessage(err, 'Action failed'))
    } finally {
      setBusyId(null)
    }
  }

  const askAction = (row, a) => {
    if (!a.confirm) { runAction(row, a); return }
    setConfirm({
      title: `${a.label}?`,
      message: a.confirm,
      confirmLabel: a.label,
      tone: a.tone === 'red' ? 'danger' : 'primary',
      run: () => runAction(row, a),
    })
  }

  const doConfirm = async () => {
    if (!confirm) return
    setConfirmBusy(true)
    try { await confirm.run() } finally {
      setConfirmBusy(false)
      setConfirm(null)
    }
  }

  const RowButtons = ({ row }) => (
    <div className="flex flex-wrap justify-end gap-2">
      {actions.filter((a) => a.when(row)).map((a) => (
        <button key={a.action} onClick={() => askAction(row, a)} disabled={busyId === row.id}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${ACTION_TONES[a.tone] || ACTION_TONES.gray}`}>
          {a.label}
        </button>
      ))}
    </div>
  )

  const subtitle = loading
    ? 'Loading…'
    : rows
      ? filtered.length !== rows.length
        ? `${filtered.length} of ${rows.length} records`
        : `${rows.length} record${rows.length === 1 ? '' : 's'}`
      : ''

  /* ---- render */
  return (
    <div className="space-y-6">
      {/* breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
        <Link to="/admin" className="hover:text-emerald-600">Admin</Link>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <Icon name="right" className="h-3.5 w-3.5 text-slate-300" />
            {i === segments.length - 1
              ? <span className="font-semibold text-slate-900">{pretty(seg)}</span>
              : <span>{pretty(seg)}</span>}
          </span>
        ))}
      </nav>

      {/* header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rows && rows.length > 0 && (
            <button onClick={() => downloadCsv(sorted, columns, segments[segments.length - 1])}
              disabled={sorted.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Icon name="download" />
              Export CSV
            </button>
          )}
          {!loading && (
            <button onClick={() => load(true)} disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-70">
              <Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          {form && !noList && (
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
              <Icon name="plus" />
              {form.button}
            </button>
          )}
        </div>
      </div>

      {/* a form on a page that has no list endpoint yet */}
      {noList && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">{form.title}</h2>
          <p className="mt-1 text-sm text-slate-500">This page has no list view yet. Use the form below.</p>
          <ActionForm key={formKey} config={form} onSaved={onSaved} onCancel={null} />
        </section>
      )}

      {/* search and status tabs */}
      {rows && rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-md flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Icon name="search" />
              </span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search this list…" aria-label="Search this list"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="text-sm font-medium text-emerald-700 hover:underline">
                Clear filters
              </button>
            )}
          </div>

          {statusCounts && (
            <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:inline-flex" role="tablist" aria-label="Status">
              {[['all', 'All', rows.length], ...Object.entries(statusCounts).map(([k, n]) => [k, k.replace(/_/g, ' '), n])]
                .map(([value, label, count]) => (
                  <button key={value} role="tab" aria-selected={statusFilter === value} onClick={() => setStatusFilter(value)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-medium capitalize transition-colors ${
                      statusFilter === value ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {label}
                    <span className={`ml-1.5 text-xs ${statusFilter === value ? 'text-emerald-100' : 'text-slate-400'}`}>{count}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* body */}
      {loading ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${95 - i * 10}%` }} />
          ))}
        </div>
      ) : error ? (
        noList ? null : error.status === 403 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Icon name="lock" className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">You don't have access to {title}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{error.message}</p>
            <Link to="/admin" className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Back to dashboard
            </Link>
          </div>
        ) : noEndpoint ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Icon name="box" className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{title} is coming soon</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              This module is on the roadmap but its backend endpoint isn't available yet. Once{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">GET {apiPath}</code> exists, this page
              will show live data automatically.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={() => load(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Retry
              </button>
              <Link to="/admin" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Back to dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Icon name="alert" className="h-6 w-6" />
            </div>
            <p className="text-sm text-red-800">{error.message}</p>
            <button onClick={() => load(false)}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Try again
            </button>
          </div>
        )
      ) : rows ? (
        rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <p className="text-slate-500">No records yet.</p>
            {form && (
              <button onClick={() => setShowForm(true)} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
                {form.button}
              </button>
            )}
          </div>
        ) : (
          <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity ${refreshing ? 'opacity-70' : ''}`}>
            {/* desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    {columns.map((c) => (
                      <th key={c} className="p-4">
                        <SortHeader label={columnLabel(c)} active={sortKey === c} dir={sortDir} onClick={() => toggleSort(c)} />
                      </th>
                    ))}
                    {hasActions && <th className="p-4 text-right font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + (hasActions ? 1 : 0)} className="p-12 text-center">
                        <p className="text-slate-500">Nothing matches your search.</p>
                        <button onClick={clearFilters} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
                          Clear filters
                        </button>
                      </td>
                    </tr>
                  )}
                  {pageItems.map((row, i) => (
                    <tr key={row.id ?? `${start}-${i}`} className="transition-colors hover:bg-slate-50/60">
                      {columns.map((c) => (
                        <td key={c} className="max-w-xs p-4 align-top text-slate-700"><Cell v={row[c]} col={c} /></td>
                      ))}
                      {hasActions && <td className="p-4 align-top"><RowButtons row={row} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {pageItems.length === 0 && (
                <div className="p-10 text-center">
                  <p className="text-slate-500">Nothing matches your search.</p>
                  <button onClick={clearFilters} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
                    Clear filters
                  </button>
                </div>
              )}
              {pageItems.map((row, i) => {
                const [first, ...rest] = columns
                return (
                  <div key={row.id ?? `${start}-${i}`} className="space-y-3 p-4">
                    <p className="font-medium text-slate-900"><Cell v={row[first]} col={first} /></p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {rest.map((c) => (
                        <div key={c} className="min-w-0">
                          <dt className="text-xs text-slate-400">{columnLabel(c)}</dt>
                          <dd className="break-words text-slate-700"><Cell v={row[c]} col={c} /></dd>
                        </div>
                      ))}
                    </dl>
                    {hasActions && <RowButtons row={row} />}
                  </div>
                )
              })}
            </div>

            {/* pagination */}
            {sorted.length > 0 && (
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
        )
      ) : obj ? (
        /* a single object instead of a list: show it as an overview */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(obj).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{columnLabel(k)}</p>
              <div className={`mt-1 text-slate-800 ${typeof v === 'number' ? 'text-2xl font-bold' : 'text-sm'}`}>
                <Cell v={v} col={k} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {form && showForm && !noList && (
        <Modal title={form.title} onClose={() => setShowForm(false)} labelledBy="module-form-title" wide>
          <ActionForm config={form} onSaved={onSaved} onCancel={() => setShowForm(false)} />
        </Modal>
      )}
      {confirm && <ConfirmDialog dialog={confirm} busy={confirmBusy} onCancel={() => setConfirm(null)} onConfirm={doConfirm} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}