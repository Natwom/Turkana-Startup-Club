// pages/Events.jsx
import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
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
  checkCircle: ['M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  xCircle: ['m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  clock: ['M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  ticket: [
    'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z',
    'M14 6v2m0 3v2m0 3v2',
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

const typeColors = {
  hackathon: 'bg-emerald-50 text-emerald-700',
  workshop: 'bg-blue-50 text-blue-700',
  meetup: 'bg-violet-50 text-violet-700',
  conference: 'bg-amber-50 text-amber-700',
  other: 'bg-gray-100 text-gray-600',
}
const typeColor = (t) => typeColors[(t || 'other').toLowerCase()] || typeColors.other

const statusStyles = {
  confirmed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-600',
  waitlisted: 'bg-amber-50 text-amber-700',
  attended: 'bg-blue-50 text-blue-700',
}
const statusMeta = {
  confirmed: { label: 'Confirmed', icon: 'checkCircle' },
  cancelled: { label: 'Cancelled', icon: 'xCircle' },
  waitlisted: { label: 'Waitlisted', icon: 'clock' },
  attended: { label: 'Attended', icon: 'check' },
}

function StatusPill({ status, className = '' }) {
  const meta = statusMeta[status]
  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full whitespace-nowrap ${statusStyles[status] || 'bg-gray-100 text-gray-500'} ${className}`}>
      {meta && <Icon name={meta.icon} className="w-3.5 h-3.5" />}
      {meta ? meta.label : status}
    </span>
  )
}

function DateBadge({ dateStr }) {
  const d = new Date(dateStr)
  return (
    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-200 shrink-0">
      <span className="text-xl font-extrabold leading-none">{d.getDate()}</span>
      <span className="text-[10px] uppercase tracking-wide mt-0.5">{d.toLocaleString('en', { month: 'short' })}</span>
    </div>
  )
}

function EventCard({ e, registered, onRegister, busy }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex gap-4">
      <DateBadge dateStr={e.starts_at} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeColor(e.event_type)}`}>
            {e.event_type}
          </span>
          {e.capacity != null && (
            <span className="text-[11px] text-gray-400">
              {e.registered_count ?? 0}/{e.capacity} registered
            </span>
          )}
        </div>
        <h3 className="font-bold text-gray-900 mt-2 leading-snug">{e.title}</h3>
        {e.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{e.description}</p>}
        <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
          <Icon name="calendar" className="w-4 h-4 text-gray-400 shrink-0" />
          {new Date(e.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
        <p className="text-sm text-gray-600 flex items-center gap-2 mt-0.5">
          <Icon name="pin" className="w-4 h-4 text-gray-400 shrink-0" />
          <span>{e.venue}{e.location ? `, ${e.location}` : ''}</span>
        </p>
        <button
          onClick={() => onRegister(e.id)}
          disabled={busy || registered}
          className={`mt-3 px-4 py-2 text-sm font-medium rounded-lg transition inline-flex items-center gap-1.5 ${
            registered
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
          }`}>
          {registered && <Icon name="check" className="w-4 h-4" />}
          {registered ? 'Registered' : busy ? 'Registering…' : 'Register'}
        </button>
      </div>
    </div>
  )
}

function TicketCard({ t, onCancel, onView, busy }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{t.event?.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {t.event?.starts_at ? new Date(t.event.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}
          </p>
          <p className="text-xs text-gray-400 mt-1 font-mono">{t.registration_id}</p>
        </div>
        <StatusPill status={t.status} className="text-[11px] px-2 py-1" />
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onView(t)}
          className="flex-1 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition inline-flex items-center justify-center gap-1.5">
          <Icon name="ticket" className="w-4 h-4" />
          Show QR Ticket
        </button>
        {t.status === 'confirmed' && (
          <button onClick={() => onCancel(t)} disabled={busy}
            className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function TicketModal({ ticket, onClose, onCancel, busy }) {
  if (!ticket) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
          <Icon name="ticket" className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-lg mt-3 text-gray-900">{ticket.event?.title}</h3>
        <p className="text-sm text-gray-500 mt-1">
          {ticket.event?.starts_at ? new Date(ticket.event.starts_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) : ''}
        </p>
        <p className="text-sm text-gray-500">{ticket.event?.venue}</p>

        <div className="inline-block p-3 border-2 border-dashed border-emerald-200 rounded-xl mt-4 bg-emerald-50/40">
          <QRCodeCanvas value={`TSC:${ticket.event_id}:${ticket.registration_id}:${ticket.qr_token}`} size={180} />
        </div>
        <p className="text-xs font-mono text-gray-400 mt-3">{ticket.registration_id}</p>
        <div className="mt-2">
          <StatusPill status={ticket.status} className="text-xs px-2.5 py-1" />
        </div>

        <div className="flex gap-2 mt-5">
          {ticket.status === 'confirmed' && (
            <button onClick={() => onCancel(ticket)} disabled={busy}
              className="flex-1 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">
              Cancel Registration
            </button>
          )}
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium bg-gray-100 rounded-lg hover:bg-gray-200">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Events() {
  const [events, setEvents] = useState([])
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)
  const [msg, setMsg] = useState(null) // { text, ok }
  const [viewTicket, setViewTicket] = useState(null)

  const load = () => {
    api.get('/events').then((r) => setEvents(r.data)).catch(() => flash('Could not load events.', false))
    api.get('/events/my').then((r) => setMine(r.data)).catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const flash = (text, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  const registeredIds = useMemo(() => new Set(mine.filter((t) => t.status === 'confirmed').map((t) => t.event_id)), [mine])
  const types = useMemo(() => ['all', ...new Set(events.map((e) => e.event_type).filter(Boolean))], [events])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter((e) =>
      (typeFilter === 'all' || e.event_type === typeFilter) &&
      (!q || e.title.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q) || (e.location || '').toLowerCase().includes(q))
    )
  }, [events, search, typeFilter])

  const register = async (id) => {
    setBusyId(id)
    try {
      await api.post(`/events/${id}/register`)
      flash('You are registered! Your ticket is under My Tickets.')
      load()
    } catch (err) {
      flash(err.response?.data?.detail || 'Registration failed.', false)
    } finally {
      setBusyId(null)
    }
  }

  const cancel = async (t) => {
    if (!window.confirm(`Cancel your registration for "${t.event?.title}"?`)) return
    setBusyId(t.id)
    try {
      await api.post(`/events/${t.event_id}/cancel`)
      flash('Registration cancelled.', false)
      setViewTicket(null)
      load()
    } catch (err) {
      flash(err.response?.data?.detail || 'Could not cancel.', false)
    } finally {
      setBusyId(null)
    }
  }

  const upcoming = mine.filter((t) => t.status === 'confirmed')
  const past = mine.filter((t) => t.status !== 'confirmed')

  return (
    <div>
      {/* Flash message */}
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
          msg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          <Icon name={msg.ok ? 'checkCircle' : 'xCircle'} className="w-5 h-5 shrink-0" />
          {msg.text}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* ── Events column ── */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Upcoming Events</h1>
            <span className="text-sm text-gray-400">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Search + filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
                <Icon name="search" className="w-4 h-4" />
              </span>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events by title, description or location…"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {types.map((t) => <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>)}
            </select>
          </div>

          {/* List */}
          {loading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gray-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-20 bg-gray-100 rounded" />
                      <div className="h-4 w-3/4 bg-gray-100 rounded" />
                      <div className="h-3 w-full bg-gray-100 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-gray-400">
              <Icon name="calendar" className="w-10 h-10 mx-auto" />
              <p className="mt-3 font-medium text-gray-500">No events match your search</p>
              <p className="text-sm mt-1">Try a different keyword or category.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filtered.map((e) => (
                <EventCard key={e.id} e={e}
                  registered={registeredIds.has(e.id)}
                  busy={busyId === e.id}
                  onRegister={register} />
              ))}
            </div>
          )}
        </div>

        {/* ── Tickets column ── */}
        <div className="lg:sticky lg:top-20">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Icon name="ticket" className="w-6 h-6 text-emerald-600" />
            My Tickets
          </h2>
          {mine.length === 0 && !loading ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-400">
              <Icon name="ticket" className="w-8 h-8 mx-auto" />
              <p className="mt-2 text-sm font-medium text-gray-500">No tickets yet</p>
              <p className="text-xs mt-1">Register for an event to get your QR ticket.</p>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Confirmed</p>
                  {upcoming.map((t) => <TicketCard key={t.id} t={t} busy={busyId === t.id} onCancel={cancel} onView={setViewTicket} />)}
                </>
              )}
              {past.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-4 mb-2">Past / Other</p>
                  {past.map((t) => <TicketCard key={t.id} t={t} busy={busyId === t.id} onCancel={cancel} onView={setViewTicket} />)}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <TicketModal ticket={viewTicket} onClose={() => setViewTicket(null)} onCancel={cancel} busy={busyId === viewTicket?.id} />
    </div>
  )
}