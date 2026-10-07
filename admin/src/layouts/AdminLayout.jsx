import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, MapPin, CalendarDays, Trophy, FolderKanban, Rocket,
  Handshake, Briefcase, FolderOpen, MessageSquare, Network, HeartHandshake,
  Award, Star, FlaskConical, Megaphone, BarChart3, FileText, ShieldCheck,
  Lock, Settings, LogOut, Search, ChevronDown,
} from 'lucide-react'

const slug = (s) => s.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin' },
  { label: 'Members', icon: Users, to: '/admin/members' },
  { group: 'Chapters', icon: MapPin, children: ['All Chapters', 'Create Chapter', 'Chapter Leaders', 'Chapter Activity'] },
  { group: 'Events', icon: CalendarDays, children: [
      { label: 'All Events', to: '/admin/events' }, 'Create Event', 'Registrations', 'Attendance',
      'QR Check-in', 'Speakers', 'Mentors', 'Event Reports'] },
  { group: 'Hackathons', icon: Trophy, children: [
      'All Hackathons', 'Challenges', 'Participants', 'Teams', 'Projects', 'Judges', 'Criteria', 'Scores', 'Results'] },
  { group: 'Projects', icon: FolderKanban, children: ['All Projects', 'Pending Approval', 'Featured', 'Showcase'] },
  { group: 'Startups', icon: Rocket, children: ['All Startups', 'Pending Approval', 'Featured', 'Verification'] },
  { group: 'Mentorship', icon: Handshake, children: ['Mentors', 'Mentees', 'Requests', 'Active Mentorships', 'Sessions'] },
  { group: 'Opportunities', icon: Briefcase, children: ['All', 'Jobs', 'Grants', 'Internships', 'Competitions', 'Pending Approval'] },
  { group: 'Resources', icon: FolderOpen, children: ['All Resources', 'Upload', 'Categories', 'Pending Approval'] },
  { group: 'Community', icon: MessageSquare, children: ['Posts', 'Comments', 'Reports', 'Moderation'] },
  { group: 'Networking', icon: Network, children: ['Connections', 'Activity', 'Reports'] },
  { group: 'Volunteers', icon: HeartHandshake, children: ['Applications', 'Volunteers', 'Assignments', 'History'] },
  { group: 'Certificates', icon: Award, children: ['Generate', 'Issued', 'Templates', 'Verification'] },
  { group: 'Achievements', icon: Star, children: ['Badges', 'Member Achievements', 'Recognition'] },
  { group: 'Incubation', icon: FlaskConical, children: ['Programs', 'Applications', 'Cohorts', 'Startups', 'Mentors', 'Milestones'] },
  { group: 'Sponsors & Partners', icon: Handshake, children: ['Sponsors', 'Partners', 'Partnerships', 'Events Supported'] },
  { group: 'Communications', icon: Megaphone, children: ['Announcements', 'Notifications', 'Email', 'SMS'] },
  { group: 'Analytics', icon: BarChart3, children: ['Members', 'Events', 'Hackathons', 'Projects', 'Startups', 'Chapters', 'Engagement'] },
  { group: 'Reports', icon: FileText, children: ['Members', 'Events', 'Attendance', 'Hackathons', 'Startups', 'Export Data'] },
  { group: 'Moderation', icon: ShieldCheck, children: ['Reports', 'Flagged Content', 'Suspended Users', 'Moderation Logs'] },
  { group: 'Security', icon: Lock, children: ['Admin Users', 'Roles', 'Permissions', 'Login Activity', 'Audit Logs'] },
  { group: 'Settings', icon: Settings, children: ['General', 'Branding', 'Email', 'Notifications', 'Storage', 'Integrations', 'System Settings'] },
]

// Normalize children to { label, to }
const normalized = NAV.map((item) => {
  if (item.to || !item.children) return item
  const base = `/admin/${slug(item.group)}`
  return {
    ...item,
    children: item.children.map((c) =>
      typeof c === 'string'
        ? { label: c, to: `${base}/${slug(c)}` }
        : { ...c, to: c.to ?? `${base}/${slug(c.label)}` }),
  }
})

export default function AdminLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(() => ({ Events: true }))
  const [q, setQ] = useState('')

  // keep the group of the current page open
  useEffect(() => {
    const g = normalized.find((i) => i.children && i.children.some((c) => pathname.startsWith(c.to)))
    if (g) setOpen((o) => (o[g.group] ? o : { ...o, [g.group]: true }))
  }, [pathname])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return normalized
    return normalized
      .map((item) => {
        if (item.to) return item.label.toLowerCase().includes(query) ? item : null
        const children = item.children.filter((c) => c.label.toLowerCase().includes(query))
        return children.length ? { ...item, children } : null
      })
      .filter(Boolean)
  }, [q])

  const logout = () => {
    localStorage.removeItem('tsc_admin_token')
    localStorage.removeItem('tsc_admin_user')
    window.location.href = '/admin/login'
  }

  const toggleGroup = (item) => {
    const isOpen = !!open[item.group]
    setOpen((o) => ({ ...o, [item.group]: !isOpen }))
    // opening a group also lands on its first page
    if (!isOpen && item.children?.length) navigate(item.children[0].to)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="h-14 flex items-center px-4 font-bold text-white border-b border-slate-700 tracking-wide">
          <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2" /> TSC ADMIN
        </div>

        <div className="px-3 pt-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search menu…"
              className="w-full bg-slate-800 text-sm text-slate-200 placeholder-slate-500 rounded-lg
                pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm">
          {filtered.map((item, i) =>
            item.to ? (
              <NavLink key={item.label} to={item.to} end
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1 transition-colors ${
                    isActive ? 'bg-emerald-700 text-white font-medium' : 'hover:bg-slate-800'}`}>
                <item.icon size={16} /> {item.label}
              </NavLink>
            ) : (
              <div key={item.group ?? i} className="mb-1">
                <button
                  onClick={() => toggleGroup(item)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg
                    text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                  <span className="flex items-center gap-2">
                    <item.icon size={14} /> {item.group}
                  </span>
                  <ChevronDown size={14}
                    className={`transition-transform ${open[item.group] ? 'rotate-180' : ''}`} />
                </button>
                {(open[item.group] || q) && item.children.map((c) => (
                  <NavLink key={c.to} to={c.to}
                    className={({ isActive }) =>
                      `block px-6 py-1.5 rounded-lg transition-colors ${
                        isActive ? 'text-emerald-400 font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    {c.label}
                  </NavLink>
                ))}
              </div>
            )
          )}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-slate-500">No menu items match "{q}"</p>
          )}
        </nav>

        <button onClick={logout}
          className="m-3 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <LogOut size={16} /> Logout
        </button>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}