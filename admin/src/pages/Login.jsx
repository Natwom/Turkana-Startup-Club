// pages/Login.jsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { errorMessage } from '../services/api'

const REDIRECT_MS = 1600

const loginError = (err) => {
  if (err?.noToken) return 'The server did not return a session. Please try again.'
  if (!err?.response) {
    return 'Cannot reach the server. If it has been idle it may be waking up, so wait a minute and try again.'
  }
  if (err.response.status === 401) return 'Incorrect email or password.'
  return errorMessage(err, 'Sign in failed. Please try again.')
}

/* ------------------------------------------------------------------ icons */
function Svg({ children, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  )
}

const MailIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Svg>
)
const LockIcon = (p) => (
  <Svg {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
)
const EyeIcon = (p) => (
  <Svg {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)
const EyeOffIcon = (p) => (
  <Svg {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9" />
    <path d="M6.6 6.7A17 17 0 0 0 2 12s3.5 6 10 6a9.7 9.7 0 0 0 4.2-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
)
const AlertIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </Svg>
)
const UsersIcon = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
  </Svg>
)
const CalendarIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 11h18" />
  </Svg>
)
const AwardIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="9" r="5" />
    <path d="m8.8 13.4-1.3 7.1L12 18l4.5 2.5-1.3-7.1" />
  </Svg>
)

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Turkana Startup Club">
      <rect width="64" height="64" rx="15" fill="#059669" />
      <circle cx="50.5" cy="12.5" r="4" fill="#FBBF24" />
      <path d="M10 25.5C14 19.5 22.5 17 32 17S50 19.5 54 25.5C47 23.2 40 22.4 32 22.4S17 23.2 10 25.5Z" fill="#FFFFFF" />
      <path d="M17 18.2C21 14.4 26 13 32 13S43 14.4 47 18.2C42 16.6 37.5 16 32 16S22 16.6 17 18.2Z" fill="#D1FAE5" />
      <path d="M30.4 22.6H33.6L34 36C34.2 42 35 47 36.4 52H27.6C29 47 29.8 42 30 36Z" fill="#FFFFFF" />
      <path d="M31.2 33.5L22.5 25.2L24.3 23.7L32 30Z" fill="#FFFFFF" />
      <path d="M32.8 33.5L41.5 25.2L39.7 23.7L32 30Z" fill="#FFFFFF" />
      <rect x="17" y="52" width="30" height="3" rx="1.5" fill="#A7F3D0" />
    </svg>
  )
}

/* ------------------------------------------------------------------ animations */
const STYLES = `
@keyframes tsc-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes tsc-pop { 0% { opacity: 0; transform: translateY(12px) scale(.94) } 100% { opacity: 1; transform: none } }
@keyframes tsc-draw { to { stroke-dashoffset: 0 } }
@keyframes tsc-ring { 0% { transform: scale(.6); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
@keyframes tsc-progress { from { transform: scaleX(0) } to { transform: scaleX(1) } }
.tsc-fade { animation: tsc-fade .2s ease-out both }
.tsc-pop { animation: tsc-pop .3s cubic-bezier(.2,.8,.2,1) both }
.tsc-ring { animation: tsc-ring .45s cubic-bezier(.2,.8,.2,1) .1s both }
.tsc-draw { stroke-dasharray: 32; stroke-dashoffset: 32; animation: tsc-draw .4s ease-out .45s forwards }
.tsc-progress { transform-origin: left; animation: tsc-progress ${REDIRECT_MS}ms linear forwards }
@media (prefers-reduced-motion: reduce) {
  .tsc-fade, .tsc-pop, .tsc-ring, .tsc-progress { animation: none }
  .tsc-draw { animation: none; stroke-dashoffset: 0 }
}
`

/* ------------------------------------------------------------------ success popup */
function SuccessModal({ name, onContinue }) {
  const buttonRef = useRef(null)
  useEffect(() => { buttonRef.current?.focus() }, [])

  return (
    <div className="tsc-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="admin-login-title" aria-describedby="admin-login-desc">
      <div className="tsc-pop w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-8 pb-6 pt-9 text-center">
          <div className="tsc-ring mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="tsc-draw" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <h2 id="admin-login-title" className="mt-5 text-xl font-semibold text-slate-900">Signed in</h2>
          <p id="admin-login-desc" className="mt-1.5 text-sm text-slate-600">
            Welcome back{name ? `, ${name}` : ''}. Opening the control center.
          </p>
          <button ref={buttonRef} type="button" onClick={onContinue}
            className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
            Open dashboard
          </button>
        </div>
        <div className="h-1 bg-emerald-100">
          <div className="tsc-progress h-full bg-emerald-600" />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ brand panel */
const HIGHLIGHTS = [
  [UsersIcon, 'Members and roles', 'Verify accounts and assign who can manage what.'],
  [CalendarIcon, 'Events and hackathons', 'Create, publish and track registrations.'],
  [AwardIcon, 'Certificates and programs', 'Issue certificates and run incubation programs.'],
]

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12">
      <div className="pointer-events-none absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
      <div className="relative flex items-center gap-3">
        <LogoMark className="h-10 w-10" />
        <div className="leading-tight">
          <p className="font-semibold">Turkana Startup Club</p>
          <p className="text-sm text-emerald-300">Admin Control Center</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <h2 className="text-3xl font-bold leading-tight">Run the whole ecosystem from one place.</h2>
        <ul className="mt-10 space-y-6">
          {HIGHLIGHTS.map(([Icon, title, desc]) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-0.5 text-sm text-slate-300">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-slate-400">Authorized administrators only. Sign-ins are recorded for security.</p>
    </aside>
  )
}

/* ------------------------------------------------------------------ page */
export default function Login() {
  const nav = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [welcome, setWelcome] = useState(null)   // null, or { name } once signed in
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const goToDashboard = () => {
    clearTimeout(timer.current)
    nav('/admin', { replace: true })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (submitting || welcome) return
    setError('')
    setSubmitting(true)
    try {
      const { data } = await api.post('/auth/login', { email: form.email.trim(), password: form.password })
      if (!data?.access_token) {
        const ex = new Error('No token returned')
        ex.noToken = true
        throw ex
      }
      localStorage.setItem('tsc_admin_token', data.access_token)

      // optional: use the admin's first name in the welcome message
      let name = ''
      try {
        const me = await api.get('/auth/me')
        name = me.data?.full_name?.split(' ')[0] || ''
      } catch { /* the welcome message works without a name */ }

      setWelcome({ name })
      timer.current = setTimeout(goToDashboard, REDIRECT_MS)
    } catch (err) {
      setError(loginError(err))
      setSubmitting(false)
    }
  }

  const locked = submitting || Boolean(welcome)
  const fieldCls =
    'block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

  return (
    <div className="flex min-h-screen bg-white">
      <style>{STYLES}</style>

      <BrandPanel />

      <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* compact logo for phones and tablets */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <LogoMark className="h-10 w-10" />
            <div className="leading-tight">
              <p className="font-semibold text-slate-900">Turkana Startup Club</p>
              <p className="text-sm text-emerald-700">Admin Control Center</p>
            </div>
          </div>

          <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              <LockIcon className="h-3.5 w-3.5" />
              Administrator access
            </span>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-500">Use your administrator account to continue.</p>

            {error && (
              <div role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input id="email" type="email" required autoComplete="email" autoFocus
                    placeholder="admin@example.com" disabled={locked} className={fieldCls}
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input id="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password"
                    placeholder="Enter your password" disabled={locked} className={`${fieldCls} pr-11`}
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} disabled={locked}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                    {showPassword ? <EyeOffIcon className="h-[18px] w-[18px]" /> : <EyeIcon className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" disabled={locked}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70">
              {submitting ? (<><Spinner />Signing in…</>) : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Having trouble? Ask a super admin to check your role and account status.
          </p>
        </div>
      </main>

      {welcome && <SuccessModal name={welcome.name} onContinue={goToDashboard} />}
    </div>
  )
}