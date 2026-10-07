import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('tsc_access_token')
    if (!token) return setLoading(false)
    api.get('/auth/me').then((r) => setUser(r.data)).catch(() => localStorage.clear()).finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('tsc_access_token', data.access_token)
    localStorage.setItem('tsc_refresh_token', data.refresh_token)
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }

  const register = (payload) => api.post('/auth/register', payload)

  // re-read the current user (name, photo...) after settings change
  const refreshUser = useCallback(async () => {
    const r = await api.get('/auth/me')
    setUser(r.data)
    return r.data
  }, [])

  const logout = () => {
    localStorage.clear()
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)