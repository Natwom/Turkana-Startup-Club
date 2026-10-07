// pages/Login.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { errorMessage } from '../services/api'

export default function Login() {
  const nav = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { data } = await api.post('/auth/login', form)
      if (!data?.access_token) throw new Error('No token returned')
      localStorage.setItem('tsc_admin_token', data.access_token)
      nav('/admin')
    } catch (err) {
      setError(errorMessage(err, 'Invalid credentials'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-900">TSC Admin Control Center</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in with an administrator account</p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <input type="email" placeholder="Email" required className="w-full mb-3 px-3 py-2 border rounded-lg"
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" placeholder="Password" required className="w-full mb-4 px-3 py-2 border rounded-lg"
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button disabled={submitting} className="w-full py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50">
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
