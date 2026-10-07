// ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-10 text-center text-gray-500">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}