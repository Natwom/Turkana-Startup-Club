import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../services/api'

const ADMIN_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'EVENT_MANAGER', 'HACKATHON_MANAGER',
  'COMMUNITY_MODERATOR', 'MENTORSHIP_MANAGER', 'INCUBATION_MANAGER',
  'CHAPTER_MANAGER', 'CONTENT_MANAGER', 'VOLUNTEER_MANAGER',
]

export default function AdminRoute({ children }) {
  const [state, setState] = useState({ loading: true, ok: false })

  useEffect(() => {
    const token = localStorage.getItem('tsc_admin_token')
    if (!token) {
      setState({ loading: false, ok: false })
      return
    }
    api.get('/auth/me')
      .then((r) => {
        // Handles both ["ADMIN"] and [{ name: "ADMIN" }] response shapes
        const roles = (r.data?.roles ?? []).map((x) =>
          typeof x === 'string' ? x : x?.name
        )
        const ok = roles.some((x) => ADMIN_ROLES.includes(x)) && !r.data?.is_suspended
        setState({ loading: false, ok })
      })
      .catch(() => setState({ loading: false, ok: false }))
  }, [])

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-emerald-600 animate-spin" />
          <p className="text-sm text-slate-500">Checking access…</p>
        </div>
      </div>
    )
  }

  return state.ok ? children : <Navigate to="/admin/login" replace />
}