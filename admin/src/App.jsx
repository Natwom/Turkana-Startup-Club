import { Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import AdminRoute from './routes/AdminRoute'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import Events from './pages/Events'
import ModulePage from './pages/ModulePage'
import Login from './pages/Login'

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<Login />} />
      <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/members" element={<Members />} />
        <Route path="/admin/events" element={<Events />} />
        {/* Everything else: /admin/chapters, /admin/events/registrations, etc. */}
        <Route path="/admin/*" element={<ModulePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}