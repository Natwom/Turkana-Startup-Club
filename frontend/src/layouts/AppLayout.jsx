// layouts/AppLayout.jsx
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import api from '../services/api'

const links = [
  ['Dashboard', '/dashboard'], ['Events', '/events'], ['Community', '/community'],
  ['Hackathons', '/hackathons'], ['Certificates', '/certificates'], ['Directory', '/directory'],
  ['Network', '/network'], ['Messages', '/messages'],
]

/* ------------------------------------------------------------------ icons */
const ICONS = {
  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  settings: (
    <>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
}

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

/* ------------------------------------------------------------------ notification bell */
function NotificationBell() {
  const [data, setData] = useState({ unread: 0, items: [] })
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(() => {
    api.get('/me/notifications').then((r) => setData(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  const clickItem = async (n) => {
    if (!n.is_read) await api.post(`/me/notifications/${n.id}/read`).catch(() => {})
    setOpen(false)
    load()
    if (n.link) navigate(n.link)
  }

  const readAll = async () => {
    await api.post('/me/notifications/read-all').catch(() => {})
    load()
  }

  return (
    <div className="relative">
      <button onClick={() => { setOpen((v) => !v); if (!open) load() }}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        aria-label={data.unread > 0 ? `Notifications, ${data.unread} unread` : 'Notifications'}
        aria-expanded={open}>
        <Icon name="bell" className="h-5 w-5" />
        {data.unread > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-red-600 text-white text-[10px] font-bold
            rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center ring-2 ring-white">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border rounded-xl shadow-lg z-20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-sm">Notifications</span>
              {data.unread > 0 && (
                <button onClick={readAll} className="text-xs text-emerald-700 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {data.items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <span className="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                    <Icon name="bell" className="h-5 w-5" />
                  </span>
                  <p className="text-sm text-gray-500">No notifications yet.</p>
                </div>
              ) : data.items.map((n) => (
                <button key={n.id} onClick={() => clickItem(n)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 ${
                    n.is_read ? '' : 'bg-emerald-50/60'}`}>
                  <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                  <p className="text-[11px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ user menu */
function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100"
        aria-label="Account menu" aria-expanded={open}>
        <Avatar name={user?.full_name} url={user?.profile?.photo_url} />
        <span className="hidden xl:inline text-sm text-gray-700 max-w-[10rem] truncate">{user?.full_name}</span>
        <Icon name="chevron" className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-white border rounded-xl shadow-lg z-20 overflow-hidden">
            <div className="px-4 py-3 border-b">
              <p className="text-sm font-semibold truncate">{user?.full_name}</p>
              {user?.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
            </div>
            <NavLink to="/settings"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
              <Icon name="settings" className="h-4 w-4 text-gray-500" />
              Settings
            </NavLink>
            <button onClick={logout}
              className="flex w-full items-center gap-2.5 text-left px-4 py-2.5 text-sm text-red-600 hover:bg-gray-50 border-t">
              <Icon name="logout" className="h-4 w-4" />
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ layout */
export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const loadUnread = useCallback(() => {
    api.get('/messages/unread-count').then((r) => setUnreadMessages(r.data.unread)).catch(() => {})
  }, [])

  // refresh on every page change, and every 30s
  useEffect(() => {
    loadUnread()
    setMenuOpen(false) // close the mobile menu after navigating
  }, [loadUnread, location.pathname])

  useEffect(() => {
    const t = setInterval(loadUnread, 30000)
    return () => clearInterval(t)
  }, [loadUnread])

  const linkClass = ({ isActive }) =>
    `relative whitespace-nowrap px-3 py-1.5 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-emerald-50 text-emerald-700 font-semibold'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`

  const badge = (
    <span className="ml-1.5 inline-flex bg-red-600 text-white text-[10px] font-bold rounded-full
      h-4 min-w-[1rem] px-1 items-center justify-center align-middle">
      {unreadMessages > 9 ? '9+' : unreadMessages}
    </span>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <NavLink to="/dashboard" className="font-bold text-xl text-emerald-700 shrink-0 mr-2">TSC</NavLink>

          {/* desktop links */}
          <div className="hidden lg:flex items-center gap-1 flex-1">
            {links.map(([label, to]) => (
              <NavLink key={to} to={to} className={linkClass}>
                {label}
                {to === '/messages' && unreadMessages > 0 && badge}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-1 ml-auto shrink-0">
            <NotificationBell />
            <UserMenu user={user} logout={logout} />
            {/* mobile menu button */}
            <button onClick={() => setMenuOpen((v) => !v)}
              className="lg:hidden ml-1 p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
              <Icon name={menuOpen ? 'close' : 'menu'} className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* mobile links */}
        {menuOpen && (
          <div className="lg:hidden border-t bg-white px-4 py-2 grid grid-cols-2 gap-1">
            {links.map(([label, to]) => (
              <NavLink key={to} to={to} className={linkClass}>
                {label}
                {to === '/messages' && unreadMessages > 0 && badge}
              </NavLink>
            ))}
          </div>
        )}
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6"><Outlet /></main>
    </div>
  )
}