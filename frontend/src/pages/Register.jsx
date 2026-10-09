// Register.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const MEMBER_TYPES = ['Student', 'Developer', 'Designer', 'Founder', 'Entrepreneur',
  'Business professional', 'Investor', 'Mentor', 'Researcher', 'Freelancer', 'Tech enthusiast', 'Other']

const errorMessage = (err) => {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => (d.msg || '').replace(/^Value error, /, '')).join(', ')
  }
  return 'Registration failed. Please try again.'
}

/* ── Inline SVG icons (no extra dependency needed) ── */
const ICONS = {
  check: ['m4.5 12.75 6 6 9-13.5'],
  x: ['M6 18 18 6M6 6l12 12'],
  eye: [
    'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z',
    'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  ],
  eyeOff: [
    'M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88',
  ],
  back: ['M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18'],
  alert: ['M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z'],
}

function Icon({ name, className = 'w-4 h-4' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
      stroke="currentColor" className={className} aria-hidden="true">
      {(ICONS[name] || []).map((d, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />
      ))}
    </svg>
  )
}

const FLOW = ['Register', 'Verify', 'Login', 'Complete Profile', 'Enter the community']

const TIPS = [
  ['Build', 'Join hackathons, build sessions, project teams and demo days.'],
  ['Connect', 'Meet founders, mentors and collaborators across Turkana.'],
  ['Learn', 'Workshops and tech talks on AI, cybersecurity and pitching.'],
  ['Grow', 'Apply for mentorship, incubation, grants and accelerators.'],
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_RE = /^(https?:\/\/)?[^\s/$.?#]+\.[^\s]{2,}$/i

// 1–4 (Weak → Strong) once the password has at least 8 characters
const passwordStrength = (pw) => {
  if (!pw) return { filled: 0, label: '' }
  if (pw.length < 8) return { filled: 1, label: 'Too short' }
  const points = [
    pw.length >= 12,
    /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    /\d/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ].filter(Boolean).length
  const filled = Math.max(1, points)
  return { filled, label: ['Weak', 'Fair', 'Good', 'Strong'][filled - 1] }
}
const STRENGTH_COLORS = ['', 'bg-red-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500']

const INPUT =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white placeholder-gray-400 ' +
  'transition hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500'

/* ── Label + input wrapper ── */
function Field({ label, required, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
        <span>
          {label}
          {required && <span className="text-emerald-600"> *</span>}
        </span>
        {hint}
      </span>
      {children}
    </label>
  )
}

/* ── Green tick that pops in when a field is valid ── */
function Valid({ show }) {
  return (
    <span
      aria-hidden="true"
      className={`tsc-anim pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-all duration-300 ${
        show ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
      }`}
    >
      <Icon name="check" className="h-3 w-3" />
    </span>
  )
}

/* ── Numbered form section that fades in on load ── */
function Section({ n, title, ready, delay, children }) {
  return (
    <section
      className={`tsc-anim transition-all duration-700 ease-out ${ready ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}
      style={{ transitionDelay: ready ? `${delay}ms` : '0ms' }}
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">{n}</span>
        {title}
      </h2>
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">{children}</div>
    </section>
  )
}

export default function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', location: '', county: 'Turkana',
    institution: '', professional_role: '', member_type: 'Tech enthusiast',
    experience_level: 'Beginner', skills: [], bio: '', linkedin: '', github: '',
    portfolio: '', startup_info: '', interests: [],
  })
  const [skillsInput, setSkillsInput] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState('')
  const [errorKey, setErrorKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // UI-only state
  const [ready, setReady] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [tip, setTip] = useState(0)
  const errRef = useRef(null)
  const asideRef = useRef(null)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const showError = (msg) => {
    setError(msg)
    setErrorKey((k) => k + 1)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!acceptTerms) {
      showError('You must accept the Terms and Conditions to create an account.')
      return
    }
    setSubmitting(true)
    try {
      await register({
        ...form,
        skills: skillsInput.split(',').map((s) => s.trim()).filter(Boolean),
        accept_terms: acceptTerms,
      })
      nav('/login', { state: { registered: true } })
    } catch (err) {
      showError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  /* ── JS-driven UI ── */

  // staggered fade-in on first paint
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // rotate the benefit shown in the side panel
  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 3500)
    return () => clearInterval(t)
  }, [])

  // bring a new error into view
  useEffect(() => {
    if (error && errRef.current) errRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error, errorKey])

  // spotlight in the side panel follows the mouse
  const onAsideMove = (e) => {
    const el = asideRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - r.left}px`)
    el.style.setProperty('--y', `${e.clientY - r.top}px`)
  }

  // live skill chips parsed from the comma-separated input
  const skills = useMemo(
    () => skillsInput.split(',').map((s) => s.trim()).filter(Boolean),
    [skillsInput]
  )
  const removeSkill = (idx) => setSkillsInput(skills.filter((_, i) => i !== idx).join(', '))

  const strength = passwordStrength(form.password)
  const emailOk = EMAIL_RE.test(form.email)

  // form completion percentage
  const progress = useMemo(() => {
    const checks = [
      form.full_name.trim(), emailOk, form.password.length >= 8, form.phone.trim(),
      form.location.trim(), form.institution.trim(), form.professional_role.trim(),
      skills.length > 0, form.linkedin.trim(), form.github.trim(), form.portfolio.trim(),
      form.startup_info.trim(), form.bio.trim(), acceptTerms,
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [form, emailOk, skills, acceptTerms])

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <style>{`
        @keyframes tsc-shake {
          0%, 100% { transform: translateX(0) }
          20%, 60% { transform: translateX(-6px) }
          40%, 80% { transform: translateX(6px) }
        }
        @keyframes tsc-pop { from { transform: scale(0.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes tsc-float { 0%, 100% { translate: 0 0 } 50% { translate: 0 -16px } }
        .tsc-shake { animation: tsc-shake 0.45s ease-in-out; }
        .tsc-pop { animation: tsc-pop 0.2s ease-out; }
        .tsc-float { animation: tsc-float 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .tsc-anim, .tsc-shake, .tsc-pop, .tsc-float { transition: none !important; animation: none !important; }
        }
      `}</style>

      {/* ── Side panel (desktop only) ── */}
      <aside
        ref={asideRef}
        onMouseMove={onAsideMove}
        className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[38%] lg:flex-col lg:justify-between lg:p-12"
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />
        <div className="tsc-float absolute -left-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" aria-hidden="true" />
        <div className="tsc-float absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl" style={{ animationDelay: '-3s' }} aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(380px circle at var(--x, 50%) var(--y, 30%), rgba(255,255,255,0.13), transparent 65%)' }}
        />

        <Link to="/" className="relative flex w-fit items-center gap-2 text-sm text-emerald-100 transition hover:text-white">
          <Icon name="back" className="h-4 w-4" /> Back to home
        </Link>

        <div className="relative">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-xl font-bold">T</span>
          <h2 className="mt-5 text-3xl font-extrabold leading-tight">
            Turn your idea<br />into a venture.
          </h2>

          {/* rotating benefit */}
          <div className="mt-8 grid min-h-[96px]">
            {TIPS.map(([title, text], i) => (
              <div
                key={title}
                aria-hidden={i !== tip}
                className={`tsc-anim col-start-1 row-start-1 transition-all duration-700 ${
                  i === tip ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                }`}
              >
                <p className="text-sm font-semibold uppercase tracking-widest text-emerald-200">{title}</p>
                <p className="mt-1 text-lg text-emerald-50">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            {TIPS.map(([title], i) => (
              <button
                key={title}
                type="button"
                onClick={() => setTip(i)}
                aria-label={`Show ${title}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === tip ? 'w-8 bg-white' : 'w-3 bg-white/40 hover:bg-white/70'}`}
              />
            ))}
          </div>
        </div>

        <p className="relative text-xs text-emerald-200">Free to join · Open to everyone · Made in Turkana</p>
      </aside>

      {/* ── Form ── */}
      <main className="flex-1 px-4 py-10">
        <Link to="/" className="mx-auto mb-4 flex w-full max-w-2xl items-center gap-2 text-sm text-gray-500 hover:text-emerald-700 lg:hidden">
          <Icon name="back" className="h-4 w-4" /> Back to home
        </Link>

        <form onSubmit={submit} className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 shadow-md sm:p-8">
          <div
            className={`tsc-anim transition-all duration-700 ease-out ${ready ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}
          >
            <h1 className="text-2xl font-bold text-emerald-700">Join Turkana Startup Club</h1>

            {/* flow chips */}
            <ol className="mb-5 mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500">
              {FLOW.map((step, i) => (
                <li key={step} className="flex items-center gap-1.5">
                  <span className={i === 0 ? 'rounded-full bg-emerald-600 px-2.5 py-0.5 font-semibold text-white' : 'rounded-full bg-gray-100 px-2.5 py-0.5'}>
                    {step}
                  </span>
                  {i < FLOW.length - 1 && <span aria-hidden="true">→</span>}
                </li>
              ))}
            </ol>

            {/* completion bar */}
            <div className="mb-6">
              <div className="mb-1 flex justify-between text-xs text-gray-500">
                <span>Form completion</span>
                <span className="font-medium text-emerald-700">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="tsc-anim h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {error && (
            <div
              ref={errRef}
              key={errorKey}
              role="alert"
              className="tsc-shake mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError('')} aria-label="Dismiss error" className="text-red-400 hover:text-red-600">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="space-y-7">
            {/* 1 · Account */}
            <Section n={1} title="Your account" ready={ready} delay={100}>
              <Field label="Full name" required>
                <input placeholder="Full name *" required className={INPUT} value={form.full_name} onChange={set('full_name')} />
              </Field>

              <Field label="Email" required>
                <div className="relative">
                  <input type="email" placeholder="Email *" required className={`${INPUT} pr-10`} value={form.email} onChange={set('email')} />
                  <Valid show={emailOk} />
                </div>
              </Field>

              <Field label="Phone">
                <input placeholder="Phone" className={INPUT} value={form.phone} onChange={set('phone')} />
              </Field>

              <Field
                label="Password"
                required
                hint={form.password && (
                  <span className={`font-semibold ${strength.filled >= 3 ? 'text-emerald-600' : strength.filled === 2 ? 'text-amber-600' : 'text-red-500'}`}>
                    {strength.label}
                  </span>
                )}
              >
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Password (min 8 chars) *"
                    required
                    minLength={8}
                    className={`${INPUT} pr-10`}
                    value={form.password}
                    onChange={set('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Icon name={showPw ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                  </button>
                </div>
                {/* strength meter */}
                <div className="mt-2 flex gap-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((n) => (
                    <span
                      key={n}
                      className={`tsc-anim h-1 flex-1 rounded-full transition-colors duration-300 ${
                        n <= strength.filled ? STRENGTH_COLORS[strength.filled] : 'bg-gray-100'
                      }`}
                    />
                  ))}
                </div>
              </Field>
            </Section>

            {/* 2 · About you */}
            <Section n={2} title="About you" ready={ready} delay={220}>
              <Field label="Location">
                <input placeholder="Location" className={INPUT} value={form.location} onChange={set('location')} />
              </Field>
              <Field label="County">
                <input placeholder="County" className={INPUT} value={form.county} onChange={set('county')} />
              </Field>
              <Field label="Institution / Company">
                <input placeholder="Institution / Company" className={INPUT} value={form.institution} onChange={set('institution')} />
              </Field>
              <Field label="Professional role">
                <input placeholder="Professional role" className={INPUT} value={form.professional_role} onChange={set('professional_role')} />
              </Field>
              <Field label="I am a">
                <select className={INPUT} value={form.member_type} onChange={set('member_type')}>
                  {MEMBER_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Experience level">
                <select className={INPUT} value={form.experience_level} onChange={set('experience_level')}>
                  {['Beginner', 'Intermediate', 'Advanced'].map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>

              <Field label="Skills" className="md:col-span-2" hint={skills.length > 0 && <span>{skills.length} added</span>}>
                <input
                  placeholder="Skills (comma separated, e.g. React, Python, UI Design)"
                  className={INPUT}
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                />
                {skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {skills.map((s, i) => (
                      <span
                        key={`${s}-${i}`}
                        className="tsc-pop inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() => removeSkill(i)}
                          aria-label={`Remove ${s}`}
                          className="rounded-full text-emerald-500 hover:text-emerald-800"
                        >
                          <Icon name="x" className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>
            </Section>

            {/* 3 · Links & bio */}
            <Section n={3} title="Links & bio" ready={ready} delay={340}>
              <Field label="LinkedIn">
                <div className="relative">
                  <input placeholder="LinkedIn URL" className={`${INPUT} pr-10`} value={form.linkedin} onChange={set('linkedin')} />
                  <Valid show={URL_RE.test(form.linkedin)} />
                </div>
              </Field>
              <Field label="GitHub">
                <div className="relative">
                  <input placeholder="GitHub URL" className={`${INPUT} pr-10`} value={form.github} onChange={set('github')} />
                  <Valid show={URL_RE.test(form.github)} />
                </div>
              </Field>
              <Field label="Portfolio">
                <div className="relative">
                  <input placeholder="Portfolio URL" className={`${INPUT} pr-10`} value={form.portfolio} onChange={set('portfolio')} />
                  <Valid show={URL_RE.test(form.portfolio)} />
                </div>
              </Field>
              <Field label="Startup / project">
                <input placeholder="Startup / project info (if any)" className={INPUT} value={form.startup_info} onChange={set('startup_info')} />
              </Field>
              <Field
                label="Short bio"
                className="md:col-span-2"
                hint={<span>{form.bio.length} character{form.bio.length === 1 ? '' : 's'}</span>}
              >
                <textarea placeholder="Short bio" rows={3} className={`${INPUT} resize-y`} value={form.bio} onChange={set('bio')} />
              </Field>
            </Section>
          </div>

          <label className="mb-5 mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 transition hover:border-emerald-200">
            <input
              type="checkbox"
              required
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
            />
            <span>
              I have read and agree to the{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer"
                className="font-semibold text-emerald-700 hover:underline">
                Terms and Conditions
              </Link>{' '}
              and the{' '}
              <Link to="/terms#privacy" target="_blank" rel="noopener noreferrer"
                className="font-semibold text-emerald-700 hover:underline">
                Privacy Notice
              </Link>.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-60 disabled:hover:shadow-sm"
          >
            {submitting && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            )}
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already a member? <Link to="/login" className="font-semibold text-emerald-700 hover:underline">Login</Link>
          </p>
        </form>
      </main>
    </div>
  )
}