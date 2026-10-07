import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-sky-100 text-sky-700',
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—'

const emptyForm = { title: '', description: '', location: '', starts_at: '', ends_at: '', capacity: '' }

export default function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setError('')
      const r = await api.get('/admin/events')
      setEvents(r.data)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load events'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (id, action, label) => {
    if (label && !window.confirm(label)) return
    setBusyId(id)
    try {
      await api.post(`/admin/events/${id}/${action}`)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const create = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      await api.post('/admin/events', {
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        starts_at: form.starts_at || undefined,
        ends_at: form.ends_at || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      })
      setNotice('Event created as draft — publish it when ready.')
      setForm(emptyForm)
      setShowForm(false)
      await load()
      setTimeout(() => setNotice(''), 5000)
    } catch (err) {
      setError(errorMessage(err, 'Failed to create event'))
    } finally {
      setCreating(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Loading…' : `${events.length} event${events.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold
            rounded-xl transition-colors shadow-sm">
          {showForm ? 'Close' : '+ New Event'}
        </button>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
          {notice}
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={load} className="font-semibold underline shrink-0">Retry</button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={create} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Create Event</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Title *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputCls} placeholder="e.g. Turkana Founders Meetup" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className={inputCls} placeholder="e.g. Lodwar, Turkana" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Capacity</label>
              <input type="number" min="1" value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                className={inputCls} placeholder="e.g. 100" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Starts at</label>
              <input type="datetime-local" value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ends at</label>
              <input type="datetime-local" value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description</label>
              <textarea rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputCls} placeholder="What is this event about?" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={creating}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold
                rounded-xl transition-colors disabled:opacity-50">
              {creating ? 'Creating…' : 'Create draft'}
            </button>
          </div>
        </form>
      )}

      {/* Events table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="p-4">Event</th>
                <th className="p-4">Date</th>
                <th className="p-4">Capacity</th>
                <th className="p-4">Registered</th>
                <th className="p-4">Attended</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="p-4">
                  <div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>
              ))}
              {!loading && events.length === 0 && (
                <tr><td colSpan={7} className="p-12 text-center text-slate-400">No events yet.</td></tr>
              )}
              {!loading && events.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4">
                    <p className="font-medium text-slate-900">{ev.title}</p>
                    {ev.location && <p className="text-xs text-slate-500">{ev.location}</p>}
                  </td>
                  <td className="p-4 text-slate-600 whitespace-nowrap">{fmtDate(ev.starts_at)}</td>
                  <td className="p-4 text-slate-600">{ev.capacity ?? '—'}</td>
                  <td className="p-4 text-slate-600">{ev.registrations}</td>
                  <td className="p-4 text-slate-600">{ev.attendance}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize
                      ${STATUS_STYLES[ev.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {ev.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      {ev.status === 'draft' && (
                        <button onClick={() => act(ev.id, 'publish')} disabled={busyId === ev.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg
                            text-xs font-semibold transition-colors disabled:opacity-50">
                          Publish
                        </button>
                      )}
                      {ev.status === 'published' && (
                        <button onClick={() => act(ev.id, 'cancel', `Cancel "${ev.title}"? Registrants will be notified.`)}
                          disabled={busyId === ev.id}
                          className="px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50
                            rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
                          Cancel
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