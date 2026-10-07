import { Routes, Route, Navigate } from 'react-router-dom'

import AppLayout from '../layouts/AppLayout'
import ProtectedRoute from '../components/ProtectedRoute'

import Landing from '../pages/Landing'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Verify from '../pages/Verify'

import Dashboard from '../pages/Dashboard'
import Events from '../pages/Events'
import Directory from '../pages/Directory'
import Hackathons from '../pages/Hackathons'
import Certificates from '../pages/Certificates'
import Community from '../pages/Community'
import Network from '../pages/Network'
import Messages from '../pages/Messages'

export default function AppRoutes() {
  return (
    <Routes>
      {/* public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/verify/:code" element={<Verify />} />

      {/* member area (login required) */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/events" element={<Events />} />
        <Route path="/community" element={<Community />} />
        <Route path="/hackathons" element={<Hackathons />} />
        <Route path="/certificates" element={<Certificates />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/network" element={<Network />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:userId" element={<Messages />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}