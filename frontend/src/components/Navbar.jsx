import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/events', label: 'Events' },
  { to: '/community', label: 'Community' },
  { to: '/directory', label: 'Directory' },
  { to: '/hackathons', label: 'Hackathons' },
  { to: '/certificates', label: 'Certificates' },
]

const linkCls = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-emerald-50 text-emerald-700 font-semibold'
      : 'text-gray-600 hover:text-emerald-700 hover:bg-gray-50'
  }`

export default function Navbar() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="bg-white border-b sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to={user ? '/dashboard' : '/'} className="font-bold text-emerald-700 tracking-wide">
          TSC
        </Link>

        {/* desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {user && LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkCls}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-gray-600">{user.full_name}</span>
              <button onClick={logout}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-600 hover:text-emerald-700">Login</Link>
              <Link to="/register"
                className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                Join
              </Link>
            </>
          )}
        </div>

        {/* mobile toggle */}
        <button className="md:hidden p-2" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* mobile menu */}
      {open && (
        <div className="md:hidden border-t bg-white px-4 py-3 flex flex-col gap-1">
          {user ? (
            <>
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} className={linkCls} onClick={() => setOpen(false)}>
                  {l.label}
                </NavLink>
              ))}
              <button onClick={logout}
                className="text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="px-3 py-2 text-sm">Login</Link>
              <Link to="/register" onClick={() => setOpen(false)} className="px-3 py-2 text-sm">Join</Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}