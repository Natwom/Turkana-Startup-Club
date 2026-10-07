import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, PackageOpen, Plus } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { FORMS, ROW_ACTIONS } from '../services/moduleConfig'

const pretty = (s = '') =>
  s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

const isDate = (v) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(Date.parse(v))

const isUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

const TONES = {
  green: 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600',
  red: 'bg-white border border-red-200 text-red-600 hover:bg-red-50',
  gray: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
}

const inputCls =
  'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500'

const Cell = ({ v }) => {
  if (v === null || v === undefined || v === '') return <span className="text-slate-300">—</span>
  if (typeof v === 'boolean')
    return v
      ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Yes</span>
      : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">No</span>
  if (isDate(v)) return new Date(v).toLocaleString()
  if (typeof v === 'object') return <span className="text-xs text-slate-500">{JSON.stringify(v)}</span>
  return String(v)
}

/* ------------------------------------------------------------ add / issue form */
function ActionForm({ config, onSaved, onCancel }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(config.fields.map((f) => [f.name, f.default ?? ''])))
  const [opts, setOpts] = useState({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    config.fields.filter((f) => f.optionsFrom).forEach(async (f) => {
      try {
        const r = await api.get(f.optionsFrom)
        const list = Array.isArray(r.data) ? r.data : []
        setOpts((o) => ({
          ...o,
          [f.name]: list.map((x) => ({
            value: x[f.valueKey],
            label: f.labelExtra ? `${x[f.labelKey]} (${x[f.labelExtra]})` : x[f.labelKey],
          })),
        }))
      } catch {
        setOpts((o) => ({ ...o, [f.name]: [] }))
      }
    })
  }, [config])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    const payload = {}
    config.fields.forEach((f) => {
      const v = values[f.name]
      if (v === '' || v === null || v === undefined) return
      payload[f.name] = f.type === 'number' ? Number(v) : v
    })
    try {
      const r = await api.post(config.endpoint, payload)
      onSaved(r.data?.message || 'Saved')
    } catch (ex) {
      setErr(errorMessage(ex, 'Could not save'))
    } finally {
      setSaving(false)
    }
  }

  const renderField = (f) => {
    const set = (v) => setValues((s) => ({ ...s, [f.name]: v }))
    const common = { value: values[f.name], required: f.required, className: inputCls }

    if (f.type === 'textarea')
      return <textarea rows={3} {...common} placeholder={f.placeholder}
        onChange={(e) => set(e.target.value)} />

    if (f.type === 'select') {
      const list = f.optionsFrom
        ? (opts[f.name] ?? [])
        : f.options.map((o) => ({ value: o, label: o }))
      return (
        <>
          <select {...common} onChange={(e) => set(e.target.value)}>
            <option value="">Select…</option>
            {list.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {f.optionsFrom && opts[f.name] && opts[f.name].length === 0 && (
            <p className="text-xs text-amber-600 mt-1">{f.emptyHint || 'Nothing to choose from yet.'}</p>
          )}
        </>
      )
    }

    return <input type={f.type || 'text'} {...common} placeholder={f.placeholder}
      min={f.type === 'number' ? 0 : undefined}
      onChange={(e) => set(e.target.value)} />
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <h2 className="font-semibold text-slate-900">{config.title}</h2>
      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{err}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {config.fields.map((f) => (
          <div key={f.name} className={f.wide ? 'sm:col-span-2' : ''}>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              {f.label}{f.required ? ' *' : ''}
            </label>
            {renderField(f)}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Cancel
          </button>
        )}
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold
            rounded-xl transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : config.button}
        </button>
      </div>
    </form>
  )
}

/* ----------------------------------------------------------------------- page */
export default function ModulePage() {
  const { '*': splat = '' } = useParams()
  const segments = splat.split('/').filter(Boolean)
  const title = pretty(segments[segments.length - 1] || 'Module')
  const apiPath = `/admin/${splat}`
  const form = FORMS[splat]
  const actions = ROW_ACTIONS[splat] || []

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null) // null = ok, otherwise message
  const [showForm, setShowForm] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.get(apiPath)
      setData(r.data)
    } catch (err) {
      setError(errorMessage(err, 'This module is not available yet'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [apiPath])

  // reset UI state when moving between sidebar pages
  useEffect(() => {
    setShowForm(false)
    setNotice('')
    setActionError('')
    setFormKey((k) => k + 1)
    load()
  }, [load])

  const flash = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 6000)
  }

  const onSaved = (msg) => {
    flash(msg)
    setShowForm(false)
    setFormKey((k) => k + 1)
    load()
  }

  const runAction = async (row, a) => {
    if (a.confirm && !window.confirm(a.confirm)) return
    setBusyId(row.id)
    setActionError('')
    try {
      const r = await api.post(`/admin/${a.base}/${row.id}/${a.action}`)
      flash(r.data?.message || 'Done')
      await load()
    } catch (err) {
      setActionError(errorMessage(err, 'Action failed'))
    } finally {
      setBusyId(null)
    }
  }

  const rows = Array.isArray(data) ? data : null
  const obj = !rows && data && typeof data === 'object' ? data : null
  const hasActions = actions.length > 0 && rows && rows.length > 0 && 'id' in rows[0]

  // hide the id column and raw foreign-key UUID columns
  const columns = rows && rows.length
    ? Object.keys(rows[0])
        .filter((k) => k !== 'id' && !(k.endsWith('_id') && isUuid(rows[0][k])))
        .slice(0, 7)
    : []

  const noList = error && form // page has a form but no list endpoint
  const formOpen = form && (showForm || noList)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link to="/admin" className="hover:text-emerald-600">Admin</Link>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight size={14} className="text-slate-300" />
            {i === segments.length - 1
              ? <span className="text-slate-900 font-semibold">{pretty(seg)}</span>
              : <span>{pretty(seg)}</span>}
          </span>
        ))}
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Loading…' : rows ? `${rows.length} record${rows.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        {form && !noList && (
          <button onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700
              text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
            <Plus size={16} /> {showForm ? 'Close' : form.button}
          </button>
        )}
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
          {notice}
        </div>
      )}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {actionError}
        </div>
      )}

      {formOpen && (
        <>
          {noList && (
            <p className="text-sm text-slate-500">
              This page has no list view yet — use the form below.
            </p>
          )}
          <ActionForm key={formKey} config={form} onSaved={onSaved}
            onCancel={noList ? null : () => setShowForm(false)} />
        </>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${90 - i * 10}%` }} />
          ))}
        </div>
      ) : error ? (
        noList ? null : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center px-6 py-20">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <PackageOpen size={26} className="text-slate-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">{title} — coming soon</h2>
              <p className="text-sm text-slate-500 mt-2 max-w-md">
                This module is on the roadmap but its backend endpoint isn't available yet.
                Once <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">GET {apiPath}</code> is
                implemented, this page will show live data automatically — no frontend changes needed.
              </p>
              <div className="flex gap-3 mt-6">
                <button onClick={load}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold
                    rounded-xl hover:bg-slate-50 transition-colors">
                  Retry
                </button>
                <Link to="/admin"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold
                    rounded-xl transition-colors">
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        )
      ) : rows ? (
        rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">
            No records found.{form ? ` Use “${form.button}” above to add one.` : ''}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {columns.map((c) => (
                      <th key={c} className="p-4">{pretty(c.replace(/_/g, '-'))}</th>
                    ))}
                    {hasActions && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, i) => (
                    <tr key={row.id ?? i} className="hover:bg-slate-50/60 transition-colors">
                      {columns.map((c) => (
                        <td key={c} className="p-4 text-slate-700"><Cell v={row[c]} /></td>
                      ))}
                      {hasActions && (
                        <td className="p-4">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {actions.filter((a) => a.when(row)).map((a) => (
                              <button key={a.action} onClick={() => runAction(row, a)}
                                disabled={busyId === row.id}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                                  disabled:opacity-50 ${TONES[a.tone] || TONES.gray}`}>
                                {a.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : obj ? (
        /* Non-array response → key/value overview */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
            {Object.entries(obj).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {pretty(k.replace(/_/g, '-'))}
                </dt>
                <dd className="mt-0.5 text-sm text-slate-800"><Cell v={v} /></dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  )
}