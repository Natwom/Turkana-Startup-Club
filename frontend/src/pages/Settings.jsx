import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'

const MEMBER_TYPES = ['Student', 'Developer', 'Designer', 'Founder', 'Tech enthusiast', 'Mentor', 'Investor', 'Other']
const LEVELS = ['Beginner', 'Intermediate', 'Advanced']
const MAX_PHOTO = 2 * 1024 * 1024

const errorMessage = (err) => {
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return 'Something went wrong. Please try again.'
}

const toForm = (d) => ({
  ...d,
  skills: (d.skills || []).join(', '),
  interests: (d.interests || []).join(', '),
})

const splitList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)

const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white'

function Section({ title, hint, children }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {hint && <p className="text-sm text-gray-500 mt-0.5">{hint}</p>}
      <div className="mt-4 grid md:grid-cols-2 gap-4">{children}</div>
    </section>
  )
}

function Field({ label, wide, hint, children }) {
  return (
    <label className={`block text-sm ${wide ? 'md:col-span-2' : ''}`}>
      <span className="text-gray-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </label>
  )
}

function Banner({ kind, children }) {
  const styles = kind === 'error'
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
  return <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm border ${styles}`}>{children}</div>
}

function ChipPreview({ value }) {
  const chips = splitList(value)
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((c) => (
        <span key={c} className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{c}</span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ photo */
function PhotoSection({ name, photoUrl, onChanged }) {
  const { refreshUser } = useAuth()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const onPick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''            // allow picking the same file again later
    if (!file) return
    setError('')
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError('Choose a PNG, JPG or WEBP image.')
      return
    }
    if (file.size > MAX_PHOTO) {
      setError('Photo must be 2 MB or smaller.')
      return
    }
    const body = new FormData()
    body.append('file', file)
    setBusy(true)
    try {
      const r = await api.post('/settings/photo', body)
      onChanged(r.data.photo_url)
      await refreshUser()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      await api.delete('/settings/photo')
      onChanged('')
      await refreshUser()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
      <h2 className="font-semibold text-gray-900">Profile photo</h2>
      <p className="text-sm text-gray-500 mt-0.5">PNG, JPG or WEBP, up to 2 MB. Drag &amp; drop works too.</p>
      {error && <div className="mt-3"><Banner kind="error">{error}</Banner></div>}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false)
          const file = e.dataTransfer?.files?.[0]
          if (file) onPick({ target: { files: [file], value: '' } })
        }}
        className={`mt-4 flex items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-colors
          ${dragOver ? 'border-emerald-400 bg-emerald-50/50' : 'border-gray-200'}`}>
        <Avatar name={name} url={photoUrl} size="w-20 h-20" text="text-2xl" />
        <div className="flex gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
            className="hidden" onChange={onPick} />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {busy ? 'Working…' : photoUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {photoUrl && (
            <button type="button" disabled={busy} onClick={remove}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              Remove
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ password */
function strength(pw) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(s, 4)
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = ['', 'bg-red-400', 'bg-amber-400', 'bg-sky-400', 'bg-emerald-500']

function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const score = strength(next)
  const mismatch = confirm.length > 0 && next !== confirm

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setDone(false)
    if (next.length < 8) return setError('New password must be at least 8 characters.')
    if (next !== confirm) return setError('New password and confirmation do not match.')
    if (next === current) return setError('New password must be different from the current one.')
    setBusy(true)
    try {
      await api.post('/settings/password', { current_password: current, new_password: next })
      setCurrent('')
      setNext('')
      setConfirm('')
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-6 mb-10 shadow-sm">
      <h2 className="font-semibold text-gray-900">Change password</h2>
      <p className="text-sm text-gray-500 mt-0.5">Use at least 8 characters.</p>
      <div className="mt-4">
        {error && <Banner kind="error">{error}</Banner>}
        {done && <Banner kind="ok">Password updated. Use it next time you sign in.</Banner>}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Current password" wide>
          <input type="password" className={inputClass} value={current}
            onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Field label="New password">
          <input type="password" className={inputClass} value={next}
            onChange={(e) => setNext(e.target.value)} autoComplete="new-password"
            minLength={8} maxLength={72} required />
          {score > 0 && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full ${i <= score ? STRENGTH_COLORS[score] : 'bg-gray-200'}`} />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">{STRENGTH_LABELS[score]}</p>
            </div>
          )}
        </Field>
        <Field label="Confirm new password" hint={mismatch ? 'Passwords do not match yet' : undefined}>
          <input type="password" className={`${inputClass} ${mismatch ? 'border-red-300 focus:ring-red-400' : ''}`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
            minLength={8} maxLength={72} required />
        </Field>
      </div>
      <button type="submit" disabled={busy}
        className="mt-5 px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
        {busy ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}

/* ------------------------------------------------------------------ page */
export default function Settings() {
  const { refreshUser } = useAuth()
  const [initial, setInitial] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/settings')
      .then((r) => {
        const f = toForm(r.data)
        setInitial(JSON.stringify(f))
        setForm(f)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [])

  const dirty = useMemo(
    () => form !== null && initial !== null && JSON.stringify(form) !== initial,
    [form, initial]
  )

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const payload = {
        full_name: form.full_name,
        phone: form.phone,
        location: form.location,
        county: form.county,
        institution: form.institution,
        professional_role: form.professional_role,
        member_type: form.member_type,
        experience_level: form.experience_level,
        bio: form.bio,
        linkedin: form.linkedin,
        github: form.github,
        portfolio: form.portfolio,
        startup_info: form.startup_info,
        skills: splitList(form.skills),
        interests: splitList(form.interests),
        profile_public: form.profile_public,
      }
      const r = await api.put('/settings', payload)
      const f = toForm(r.data)
      setForm(f)
      setInitial(JSON.stringify(f))
      await refreshUser()          // top bar picks up the new name right away
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const discard = () => {
    setForm(JSON.parse(initial))
    setSaved(false)
    setError('')
  }

  if (!form) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        ) : (
          <div className="space-y-4 animate-pulse">
            <div className="h-32 bg-gray-100 rounded-2xl" />
            <div className="h-64 bg-gray-100 rounded-2xl" />
          </div>
        )}
      </div>
    )
  }

  const types = MEMBER_TYPES.includes(form.member_type) || !form.member_type
    ? MEMBER_TYPES : [form.member_type, ...MEMBER_TYPES]

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Settings</h1>
        {dirty && (
          <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            Unsaved changes
          </span>
        )}
      </div>

      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="ok">Settings saved.</Banner>}

      <PhotoSection
        name={form.full_name}
        photoUrl={form.photo_url}
        onChanged={(url) => setForm((f) => ({ ...f, photo_url: url }))}
      />

      <form onSubmit={save}>
        <Section title="Account" hint="Your email is your login and can't be changed here.">
          <Field label="Email">
            <input className={`${inputClass} bg-gray-50 text-gray-500`} value={form.email} disabled />
          </Field>
          <Field label="Status">
            <p className="px-3 py-2 text-sm">
              {form.is_verified ? '✅ Verified member' : 'Not verified yet'}
            </p>
          </Field>
          <Field label="Full name">
            <input className={inputClass} value={form.full_name} onChange={set('full_name')}
              required minLength={2} maxLength={200} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={set('phone')}
              maxLength={30} placeholder="+254…" />
          </Field>
        </Section>

        <Section title="Profile" hint="This is what other members see in the directory.">
          <Field label="Professional role">
            <input className={inputClass} value={form.professional_role} onChange={set('professional_role')}
              maxLength={150} placeholder="e.g. Software developer" />
          </Field>
          <Field label="Institution / company">
            <input className={inputClass} value={form.institution} onChange={set('institution')} maxLength={200} />
          </Field>
          <Field label="Member type">
            <select className={inputClass} value={form.member_type} onChange={set('member_type')}>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Experience level">
            <select className={inputClass} value={form.experience_level} onChange={set('experience_level')}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="County">
            <input className={inputClass} value={form.county} onChange={set('county')} maxLength={100} />
          </Field>
          <Field label="Location / town">
            <input className={inputClass} value={form.location} onChange={set('location')} maxLength={150} />
          </Field>
          <Field label={`Bio (${(form.bio || '').length}/2000)`} wide>
            <textarea className={`${inputClass} resize-y`} rows={4} value={form.bio} onChange={set('bio')} maxLength={2000} />
          </Field>
          <Field label="Skills (comma separated)" wide>
            <input className={inputClass} value={form.skills} onChange={set('skills')}
              placeholder="python, design, marketing" />
            <ChipPreview value={form.skills} />
          </Field>
          <Field label="Interests (comma separated)" wide>
            <input className={inputClass} value={form.interests} onChange={set('interests')}
              placeholder="AI, agritech, fintech" />
            <ChipPreview value={form.interests} />
          </Field>
        </Section>

        <Section title="Links & startup" hint="Only members you are connected with can see these.">
          <Field label="LinkedIn">
            <input className={inputClass} value={form.linkedin} onChange={set('linkedin')} maxLength={300} />
          </Field>
          <Field label="GitHub">
            <input className={inputClass} value={form.github} onChange={set('github')} maxLength={300} />
          </Field>
          <Field label="Portfolio / website" wide>
            <input className={inputClass} value={form.portfolio} onChange={set('portfolio')} maxLength={300} />
          </Field>
          <Field label="Startup info" wide>
            <textarea className={`${inputClass} resize-y`} rows={3} value={form.startup_info} onChange={set('startup_info')}
              maxLength={2000} />
          </Field>
        </Section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900">Privacy</h2>
          <label className="mt-4 flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1 accent-emerald-600"
              checked={form.profile_public} onChange={set('profile_public')} />
            <span>
              <span className="font-medium text-gray-900">Show my bio in the member directory</span>
              <span className="block text-gray-500">
                When off, your bio is hidden from everyone except members you are connected with.
              </span>
            </span>
          </label>
        </section>

        {/* Sticky save bar */}
        <div className={`sticky bottom-0 z-10 -mx-4 px-4 py-3 flex items-center gap-3 border-t
          ${dirty ? 'bg-white/95 backdrop-blur border-emerald-200' : 'bg-transparent border-transparent'}`}>
          <button type="submit" disabled={saving || !dirty}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {dirty && (
            <button type="button" onClick={discard}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              Discard
            </button>
          )}
          {saved && !dirty && <span className="text-sm text-emerald-700">✓ Saved</span>}
        </div>
      </form>

      <div className="mt-6">
        <PasswordSection />
      </div>
    </div>
  )
}
