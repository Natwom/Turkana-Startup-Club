// Login.jsx
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const errorMessage = (err) => {
  if (!err.response) return 'Cannot reach the server. Check your connection and try again.'
  const detail = err.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return 'Login failed. Please try again.'
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4L12 14.01l-3-3" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  )
}

export default function Login() {
  const { user, loading, login } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const redirectTimer = useRef(null)

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => clearTimeout(redirectTimer.current), [])

  // already signed in (for example, they opened /login in a new tab): go straight in
  if (!loading && user && !submitting && !success) {
    return <Navigate to="/dashboard" replace />
  }

  const submit = async (e) => {
    e.preventDefault()
    if (submitting || success) return
    setError('')
    setSubmitting(true)
    try {
      await login(form.email.trim(), form.password)
      setSuccess(true)
      redirectTimer.current = setTimeout(() => nav('/dashboard', { replace: true }), 1000)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  const locked = submitting || success
  const inputClass =
    'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-500'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-emerald-700 mb-1">Welcome back</h1>
        <p className="text-sm text-gray-500 mb-6">Login to the TSC community</p>

        {location.state?.registered && !error && !success && (
          <div className="mb-4 flex items-start gap-2 px-4 py-3 text-sm rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckIcon />
            <span>Account created. Check your email to verify your account, then log in below.</span>
          </div>
        )}

        {error && (
          <div role="alert"
            className="mb-4 flex items-start gap-2 px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200">
            <AlertIcon />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div role="status"
            className="mb-4 flex items-start gap-2 px-4 py-3 text-sm rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckIcon />
            <span>Login successful. Redirecting to your dashboard…</span>
          </div>
        )}

        <label className="sr-only" htmlFor="email">Email</label>
        <input id="email" type="email" placeholder="Email" required autoComplete="email" disabled={locked}
          className={`${inputClass} mb-3`}
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <label className="sr-only" htmlFor="password">Password</label>
        <div className="relative mb-4">
          <input id="password" type={showPassword ? 'text' : 'password'} placeholder="Password" required
            autoComplete="current-password" disabled={locked}
            className={`${inputClass} pr-16`}
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button type="button" onClick={() => setShowPassword((v) => !v)} disabled={locked}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-emerald-700"
            aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <button type="submit" disabled={locked}
          className="w-full py-2 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-70 disabled:cursor-not-allowed">
          {success ? (
            <>
              <CheckIcon />
              Logged in
            </>
          ) : submitting ? (
            <>
              <Spinner />
              Logging in…
            </>
          ) : (
            'Login'
          )}
        </button>

        <p className="mt-4 text-sm text-center text-gray-600">
          No account? <Link to="/register" className="text-emerald-700 font-semibold">Join TSC</Link>
        </p>
      </form>
    </div>
  )
}