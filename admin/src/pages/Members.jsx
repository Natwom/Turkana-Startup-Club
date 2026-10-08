import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api, { errorMessage } from '../services/api'

/* ------------------------------------------------------------------ constants */
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

const AVATAR_COLORS = [
  'bg-emerald-600', 'bg-sky-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-teal-600',
]

const PAGE_SIZES = [10, 25, 50]
const MAX_ROLE_CHIPS = 3

/* ------------------------------------------------------------------ helpers */
const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'

const avatarColor = (name = '') => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

const roleLabel = (r) => r.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())

const statusOf = (m) => (m.is_suspended ? 'suspended' : m.is_verified ? 'verified' : 'pending')
const isSuper = (m) => (m.roles ?? []).includes('SUPER_ADMIN')
const visibleRoles = (m) => (m.roles ?? []).filter((r) => ALL_ROLES.includes(r) || r === 'SUPER_ADMIN')
const editableRoles = (m) => (m.roles ?? []).filter((r) => ALL_ROLES.includes(r))

const asList = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [])

function downloadCsv(list) {
  const rows = [['Name', 'Email', 'Type', 'County', 'Status', 'Roles']]
  list.forEach((m) => rows.push([
    m.full_name || '', m.email || '', m.member_type || '', m.county || '',
    statusOf(m), visibleRoles(m).map(roleLabel).join('; '),
  ]))
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tsc-members-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------ icons */
const ICONS = {
  search: <path d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />,
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
  ban: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93l14.14 14.14" />
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
function Avatar({ name }) {
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(name)}`}>
      {initials(name)}
    </div>
  )
}

function StatusBadge({ m }) {
  const s = statusOf(m)
  const styles = {
    suspended: 'bg-red-100 text-red-700',
    verified: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
  }
  const labels = { suspended: 'Suspended', verified: 'Verified', pending: 'Pending' }
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[s]}`}>{labels[s]}</span>
}

function RoleChips({ m }) {
  const roles = visibleRoles(m)
  if (roles.length === 0) return <span className="text-xs italic text-slate-400">No roles</span>
  const shown = roles.slice(0, MAX_ROLE_CHIPS)
  const extra = roles.length - shown.length
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((r) => (
        <span key={r} className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r] ?? 'bg-slate-200 text-slate-700'}`}>
          {roleLabel(r)}
        </span>
      ))}
      {extra > 0 && (
        <span title={roles.slice(MAX_ROLE_CHIPS).map(roleLabel).join(', ')}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          +{extra} more
        </span>
      )}
    </div>
  )
}

function RowActions({ m, busy, onVerify, onSuspend, onReactivate, onRoles }) {
  const superAdmin = isSuper(m)
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {!m.is_verified && (
        <button onClick={onVerify} disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
          Verify
        </button>
      )}
      <button onClick={onRoles} disabled={busy || superAdmin}
        title={superAdmin ? "Super admin roles can't be changed here" : 'Change roles'}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
        Roles
      </button>
      {m.is_suspended ? (
        <button onClick={onReactivate} disabled={busy}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50">
          Reactivate
        </button>
      ) : !superAdmin && (
        <button onClick={onSuspend} disabled={busy}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50">
          Suspend
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

function Modal({ title, children, onClose, labelledBy = 'modal-title' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
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

function RolesDialog({ member, saving, onClose, onSave }) {
  const initial = useMemo(() => editableRoles(member), [member])
  const [picked, setPicked] = useState(() => new Set(initial))

  const toggle = (r) =>
    setPicked((prev) => {
      const next = new Set(prev)
      next.has(r) ? next.delete(r) : next.add(r)
      return next
    })

  const changed = picked.size !== initial.length || initial.some((r) => !picked.has(r))

  return (
    <Modal title={`Roles for ${member.full_name}`} onClose={saving ? () => {} : onClose} labelledBy="roles-title">
      <p className="mt-1 text-sm text-slate-500">{member.email}</p>
      <div className="mt-4 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {ALL_ROLES.map((r) => (
          <label key={r}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              picked.has(r) ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            <input type="checkbox" checked={picked.has(r)} onChange={() => toggle(r)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            {roleLabel(r)}
          </label>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs text-slate-500">{picked.size} role{picked.size === 1 ? '' : 's'} selected</span>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => onSave([...picked])} disabled={saving || !changed}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save roles'}
          </button>
        </div>
      </div>
    </Modal>
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

/* ------------------------------------------------------------------ page */
export default function Members() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [filter, setFilter] = useState('all')
  const [suspended, setSuspended] = useState('all')
  const [q, setQ] = useState('')

  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [selected, setSelected] = useState(() => new Set())
  const [busyId, setBusyId] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [rolesFor, setRolesFor] = useState(null)
  const [savingRoles, setSavingRoles] = useState(false)
  const [toast, setToast] = useState(null)

  const reqId = useRef(0)
  const toastTimer = useRef(null)
  const allRef = useRef(null)

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
      const r = await api.get('/admin/members', {
        params: {
          verification: filter === 'all' ? '' : filter,
          suspended: suspended === 'all' ? '' : suspended,
          q,
        },
      })
      if (id !== reqId.current) return
      const list = asList(r.data)
      setMembers(list)
      setError('')
      // forget selections for members that are no longer in the list
      const ids = new Set(list.map((m) => m.id))
      setSelected((prev) => new Set([...prev].filter((x) => ids.has(x))))
    } catch (err) {
      if (id !== reqId.current) return
      setError(errorMessage(err, 'Failed to load members'))
    } finally {
      if (id === reqId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [filter, suspended, q])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  // new filters or search: back to page 1 and clear the selection
  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [filter, suspended, q])

  /* ---- derived data */
  const counts = useMemo(() => ({
    total: members.length,
    verified: members.filter((m) => statusOf(m) === 'verified').length,
    pending: members.filter((m) => statusOf(m) === 'pending').length,
    suspended: members.filter((m) => statusOf(m) === 'suspended').length,
  }), [members])

  const sorted = useMemo(() => {
    const rank = { pending: 0, verified: 1, suspended: 2 }
    const byName = (a, b) => (a.full_name || '').localeCompare(b.full_name || '', undefined, { sensitivity: 'base' })
    const list = [...members]
    list.sort((a, b) => {
      const c = sortKey === 'status'
        ? (rank[statusOf(a)] - rank[statusOf(b)]) || byName(a, b)
        : byName(a, b)
      return sortDir === 'asc' ? c : -c
    })
    return list
  }, [members, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pageItems = sorted.slice(start, start + pageSize)

  const allOnPage = pageItems.length > 0 && pageItems.every((m) => selected.has(m.id))
  const someOnPage = pageItems.some((m) => selected.has(m.id))

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someOnPage && !allOnPage
  }, [someOnPage, allOnPage])

  const selectedMembers = useMemo(() => members.filter((m) => selected.has(m.id)), [members, selected])
  const bulkVerifiable = selectedMembers.filter((m) => !m.is_verified)
  const bulkSuspendable = selectedMembers.filter((m) => !m.is_suspended && !isSuper(m))

  const hasFilters = filter !== 'all' || suspended !== 'all' || q.trim() !== ''

  /* ---- actions */
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPage) pageItems.forEach((m) => next.delete(m.id))
      else pageItems.forEach((m) => next.add(m.id))
      return next
    })

  const clearFilters = () => { setFilter('all'); setSuspended('all'); setQ('') }

  const runAction = async (m, action, doneText) => {
    setBusyId(m.id)
    try {
      await api.post(`/admin/members/${m.id}/${action}`)
      notify('success', doneText)
      await load()
    } catch (err) {
      notify('warning', errorMessage(err, 'That action failed'))
    } finally {
      setBusyId(null)
    }
  }

  const askSuspend = (m) =>
    setConfirm({
      title: 'Suspend this member?',
      message: `${m.full_name} will be signed out and unable to log in until you reactivate the account.`,
      confirmLabel: 'Suspend',
      tone: 'danger',
      run: async () => { await runAction(m, 'suspend', `${m.full_name} was suspended.`) },
    })

  const runBulk = async (action, targets, doneWord) => {
    setBulkBusy(true)
    const results = await Promise.allSettled(
      targets.map((m) => api.post(`/admin/members/${m.id}/${action}`))
    )
    const failed = results.filter((r) => r.status === 'rejected').length
    const ok = targets.length - failed
    if (failed === 0) notify('success', `${ok} member${ok === 1 ? '' : 's'} ${doneWord}.`)
    else notify('warning', `${ok} ${doneWord}, ${failed} failed. Try the failed ones again.`)
    setSelected(new Set())
    await load()
    setBulkBusy(false)
  }

  const askBulkSuspend = () =>
    setConfirm({
      title: `Suspend ${bulkSuspendable.length} member${bulkSuspendable.length === 1 ? '' : 's'}?`,
      message: 'They will be unable to log in until reactivated. Super admins and already suspended accounts are skipped.',
      confirmLabel: 'Suspend selected',
      tone: 'danger',
      run: async () => { await runBulk('suspend', bulkSuspendable, 'suspended') },
    })

  const doConfirm = async () => {
    if (!confirm) return
    setConfirmBusy(true)
    try { await confirm.run() } finally {
      setConfirmBusy(false)
      setConfirm(null)
    }
  }

  const saveRoles = async (roles) => {
    if (!rolesFor) return
    setSavingRoles(true)
    try {
      await api.put(`/admin/members/${rolesFor.id}/roles`, roles)
      notify('success', `Roles updated for ${rolesFor.full_name}.`)
      setRolesFor(null)
      await load()
    } catch (err) {
      notify('warning', errorMessage(err, 'Failed to update roles'))
    } finally {
      setSavingRoles(false)
    }
  }

  const rowProps = (m) => ({
    m,
    busy: busyId === m.id || bulkBusy,
    onVerify: () => runAction(m, 'verify', `${m.full_name} was verified.`),
    onSuspend: () => askSuspend(m),
    onReactivate: () => runAction(m, 'reactivate', `${m.full_name} was reactivated.`),
    onRoles: () => setRolesFor(m),
  })

  /* ---- render */
  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Members</h1>
          <p className="mt-1 text-sm text-slate-500">
            Verify accounts, manage roles and suspend access.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadCsv(sorted)} disabled={sorted.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Icon name="download" />
            Export CSV
          </button>
          <button onClick={load} disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70">
            <Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* summary of the current view */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard icon="users" label={hasFilters ? 'Members in this view' : 'Total members'} value={counts.total} tone="bg-slate-100 text-slate-700" />
        <SummaryCard icon="shield" label="Verified" value={counts.verified} tone="bg-emerald-50 text-emerald-700" />
        <SummaryCard icon="clock" label="Pending verification" value={counts.pending} tone="bg-amber-50 text-amber-700" />
        <SummaryCard icon="ban" label="Suspended" value={counts.suspended} tone="bg-red-50 text-red-700" />
      </div>

      {/* filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" />
          </span>
          <input
            type="search"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search members"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" role="tablist" aria-label="Verification status">
          {[['all', 'All'], ['pending', 'Pending'], ['verified', 'Verified']].map(([value, label]) => (
            <button key={value} role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filter === value ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              {label}
            </button>
          ))}
        </div>

        <select value={suspended} onChange={(e) => setSuspended(e.target.value)} aria-label="Account state"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="all">All accounts</option>
          <option value="no">Active only</option>
          <option value="yes">Suspended only</option>
        </select>

        {hasFilters && (
          <button onClick={clearFilters} className="text-sm font-medium text-emerald-700 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="shrink-0 font-semibold underline">Retry</button>
        </div>
      )}

      {/* bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-emerald-900">
            {selected.size} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => runBulk('verify', bulkVerifiable, 'verified')}
              disabled={bulkBusy || bulkVerifiable.length === 0}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              Verify {bulkVerifiable.length || ''}
            </button>
            <button onClick={askBulkSuspend} disabled={bulkBusy || bulkSuspendable.length === 0}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
              Suspend {bulkSuspendable.length || ''}
            </button>
            <button onClick={() => setSelected(new Set())} disabled={bulkBusy}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* list */}
      <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity ${refreshing && !loading ? 'opacity-70' : ''}`}>
        {/* desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="w-10 p-4">
                  <input ref={allRef} type="checkbox" checked={allOnPage} onChange={togglePage}
                    disabled={pageItems.length === 0} aria-label="Select all on this page"
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                </th>
                <th className="p-4">
                  <SortHeader label="Member" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
                </th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">County</th>
                <th className="p-4">
                  <SortHeader label="Status" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
                </th>
                <th className="p-4 font-semibold">Roles</th>
                <th className="p-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="p-4"><div className="h-5 w-full animate-pulse rounded bg-slate-100" /></td>
                </tr>
              ))}

              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <p className="text-slate-500">No members match your filters.</p>
                    {hasFilters && (
                      <button onClick={clearFilters} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {!loading && pageItems.map((m) => (
                <tr key={m.id} className={`transition-colors hover:bg-slate-50/60 ${selected.has(m.id) ? 'bg-emerald-50/40' : ''}`}>
                  <td className="p-4">
                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)}
                      aria-label={`Select ${m.full_name}`}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.full_name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{m.full_name}</p>
                        <p className="truncate text-xs text-slate-500">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600">{m.member_type || '—'}</td>
                  <td className="p-4 text-slate-600">{m.county || '—'}</td>
                  <td className="p-4"><StatusBadge m={m} /></td>
                  <td className="max-w-[16rem] p-4"><RoleChips m={m} /></td>
                  <td className="p-4"><RowActions {...rowProps(m)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* mobile cards */}
        <div className="divide-y divide-slate-100 md:hidden">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4"><div className="h-16 animate-pulse rounded bg-slate-100" /></div>
          ))}

          {!loading && pageItems.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-slate-500">No members match your filters.</p>
              {hasFilters && (
                <button onClick={clearFilters} className="mt-2 text-sm font-medium text-emerald-700 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          )}

          {!loading && pageItems.map((m) => (
            <div key={m.id} className={`space-y-3 p-4 ${selected.has(m.id) ? 'bg-emerald-50/40' : ''}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)}
                  aria-label={`Select ${m.full_name}`}
                  className="mt-2.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <Avatar name={m.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{m.full_name}</p>
                  <p className="truncate text-xs text-slate-500">{m.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[m.member_type, m.county].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <StatusBadge m={m} />
              </div>
              <RoleChips m={m} />
              <RowActions {...rowProps(m)} />
            </div>
          ))}
        </div>

        {/* pagination */}
        {!loading && sorted.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}
            </p>
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

      {confirm && (
        <ConfirmDialog dialog={confirm} busy={confirmBusy} onCancel={() => setConfirm(null)} onConfirm={doConfirm} />
      )}
      {rolesFor && (
        <RolesDialog member={rolesFor} saving={savingRoles} onClose={() => setRolesFor(null)} onSave={saveRoles} />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}