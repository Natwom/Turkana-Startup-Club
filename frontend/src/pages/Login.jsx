// pages/Login.jsx
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const REDIRECT_MS = 2000

const errorMessage = (err) => {
  if (!err.response) return 'Cannot reach the server. Check your connection and try again.'
  const detail = err.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return 'Login failed. Please try again.'
}

/* ------------------------------------------------------------------ icons */
function Svg({ children, className = 'h-5 w-5', strokeWidth = 1.75 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
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

const InfoCheckIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.8 2.8L16 10" />
  </Svg>
)

const CalendarIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 11h18" />
  </Svg>
)

const UsersIcon = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
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

  useEffect(() => {
    buttonRef.current?.focus()
  }, [])

  return (
    <div
      className="tsc-fade fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-success-title"
      aria-describedby="login-success-desc"
    >
      <div className="tsc-pop w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-8 pb-6 pt-9 text-center">
          <div className="tsc-ring mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="tsc-draw" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <h2 id="login-success-title" className="mt-5 text-xl font-semibold text-gray-900">
            Login successful
          </h2>
          <p id="login-success-desc" className="mt-1.5 text-sm text-gray-600">
            Welcome back{name ? `, ${name}` : ''}. Taking you to your dashboard.
          </p>
          <button
            ref={buttonRef}
            type="button"
            onClick={onContinue}
            className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Go to dashboard
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
  [CalendarIcon, 'Events and hackathons', 'Register for every build session, workshop and demo day.'],
  [UsersIcon, 'Mentors and founders', 'Find co-founders, collaborators and mentors across Turkana.'],
  [AwardIcon, 'Verified certificates', 'Earn certificates you can share with employers and funders.'],
]

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <Link to="/" className="relative flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">T</span>
        <span className="text-lg font-semibold">Turkana Startup Club</span>
      </Link>

      <div className="relative max-w-md">
        <h2 className="text-3xl font-bold leading-tight">
          Pick up where you left off.
        </h2>
        <p className="mt-3 text-emerald-100">
          Your events, connections and messages are waiting for you.
        </p>
        <ul className="mt-10 space-y-6">
          {HIGHLIGHTS.map(([Icon, title, desc]) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-0.5 text-sm text-emerald-100">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-emerald-200">
        Building Turkana's startup ecosystem together.
      </p>
    </aside>
  )
}

/* ------------------------------------------------------------------ page */
export default function Login() {
  const { user, loading, login } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const redirectTimer = useRef(null)

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [welcomeName, setWelcomeName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => () => clearTimeout(redirectTimer.current), [])

  // already signed in (for example, they opened /login in a new tab): go straight in
  if (!loading && user && !submitting && !success) {
    return <Navigate to="/dashboard" replace />
  }

  const goToDashboard = () => {
    clearTimeout(redirectTimer.current)
    nav('/dashboard', { replace: true })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (submitting || success) return
    setError('')
    setSubmitting(true)
    try {
      const me = await login(form.email.trim(), form.password)
      setWelcomeName(me?.full_name?.split(' ')[0] || '')
      setSuccess(true)
      redirectTimer.current = setTimeout(goToDashboard, REDIRECT_MS)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  const locked = submitting || success
  const fieldClass =
    'block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'

  return (
    <div className="flex min-h-screen bg-white">
      <style>{STYLES}</style>

      <BrandPanel />

      <main className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* compact logo for phones and tablets */}
          <Link to="/" className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-lg font-bold text-white">T</span>
            <span className="text-lg font-semibold text-emerald-800">Turkana Startup Club</span>
          </Link>

          <form
            onSubmit={submit}
            noValidate={false}
            className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
          >
            <h1 className="text-2xl font-bold text-gray-900">Log in</h1>
            <p className="mt-1 text-sm text-gray-500">
              Enter your details to access the TSC community.
            </p>

            {location.state?.registered && !error && (
              <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <InfoCheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Account created. Check your email to verify your account, then log in below.</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    disabled={locked}
                    className={fieldClass}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={locked}
                    className={`${fieldClass} pr-11`}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={locked}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon className="h-[18px] w-[18px]" /> : <EyeIcon className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={locked}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Spinner />
                  Logging in…
                </>
              ) : (
                'Log in'
              )}
            </button>

            <p className="mt-6 text-center text-sm text-gray-600">
              New to TSC?{' '}
              <Link to="/register" className="font-semibold text-emerald-700 hover:underline">
                Create an account
              </Link>
            </p>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            By logging in you agree to our{' '}
            <Link to="/terms" className="underline hover:text-emerald-700">Terms</Link>.
          </p>
        </div>
      </main>

      {success && <SuccessModal name={welcomeName} onContinue={goToDashboard} />}
    </div>
  )
}