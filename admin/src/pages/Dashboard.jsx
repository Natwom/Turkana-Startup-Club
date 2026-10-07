import { useEffect, useState } from 'react'
import api from '../services/api'

const LABELS = {
  members: 'Total Members', verified_members: 'Verified Members',
  pending_verification: 'Pending Verification', events: 'Events',
  event_registrations: 'Event Registrations', attendance: 'Attendance',
  hackathons: 'Hackathons', projects: 'Projects', startups: 'Startups',
  mentors: 'Mentors', volunteers: 'Volunteers', chapters: 'Chapters',
  opportunities: 'Opportunities', certificates: 'Certificates',
}

export default function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/admin/dashboard').then((r) => setData(r.data)).catch((e) => {
      if (e.response?.status === 403) alert('Missing permission: admin.dashboard')
    })
  }, [])

  if (!data) return <p className="text-gray-500">Loading ecosystem health…</p>
  const { totals, pending_actions } = data

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Ecosystem Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">Live health of the entire TSC ecosystem</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(LABELS).map(([key, label]) => (
          <div key={key} className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold text-emerald-700">{totals[key]}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold mt-8 mb-3 text-slate-900">Action Center</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {Object.entries(pending_actions).map(([key, count]) => (
          <div key={key} className="bg-white rounded-xl border p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold capitalize">{key.replace(/_/g, ' ')}</p>
              <p className="text-sm text-gray-500">{count} pending</p>
            </div>
            {count > 0 && (
              <a href="/admin/members" className="px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg">Review</a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}