// Register.jsx
import { useState } from 'react'
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
  const [submitting, setSubmitting] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!acceptTerms) {
      setError('You must accept the Terms and Conditions to create an account.')
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
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const input = 'w-full mb-3 px-3 py-2 border rounded-lg'
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow-md w-full max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-emerald-700">Join Turkana Startup Club</h1>
        <p className="text-sm text-gray-500 mb-6">Register → Verify → Login → Complete Profile → Enter the community</p>
        {error && (
          <p className="mb-4 px-4 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</p>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <input placeholder="Full name *" required className={input} value={form.full_name} onChange={set('full_name')} />
          <input type="email" placeholder="Email *" required className={input} value={form.email} onChange={set('email')} />
          <input placeholder="Phone" className={input} value={form.phone} onChange={set('phone')} />
          <input type="password" placeholder="Password (min 8 chars) *" required minLength={8} className={input} value={form.password} onChange={set('password')} />
          <input placeholder="Location" className={input} value={form.location} onChange={set('location')} />
          <input placeholder="County" className={input} value={form.county} onChange={set('county')} />
          <input placeholder="Institution / Company" className={input} value={form.institution} onChange={set('institution')} />
          <input placeholder="Professional role" className={input} value={form.professional_role} onChange={set('professional_role')} />
          <select className={input} value={form.member_type} onChange={set('member_type')}>
            {MEMBER_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select className={input} value={form.experience_level} onChange={set('experience_level')}>
            {['Beginner', 'Intermediate', 'Advanced'].map((t) => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="Skills (comma separated, e.g. React, Python, UI Design)"
            className={input + ' md:col-span-2'} value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} />
          <input placeholder="LinkedIn URL" className={input} value={form.linkedin} onChange={set('linkedin')} />
          <input placeholder="GitHub URL" className={input} value={form.github} onChange={set('github')} />
          <input placeholder="Portfolio URL" className={input} value={form.portfolio} onChange={set('portfolio')} />
          <input placeholder="Startup / project info (if any)" className={input} value={form.startup_info} onChange={set('startup_info')} />
          <textarea placeholder="Short bio" rows={3} className={input + ' md:col-span-2'} value={form.bio} onChange={set('bio')} />
        </div>

        <label className="mt-2 mb-5 flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
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
              className="text-emerald-700 font-semibold hover:underline">
              Terms and Conditions
            </Link>{' '}
            and the{' '}
            <Link to="/terms#privacy" target="_blank" rel="noopener noreferrer"
              className="text-emerald-700 font-semibold hover:underline">
              Privacy Notice
            </Link>.
          </span>
        </label>

        <button type="submit" disabled={submitting}
          className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
          {submitting ? 'Creating account…' : 'Create Account'}
        </button>
        <p className="mt-4 text-sm text-center text-gray-600">
          Already a member? <Link to="/login" className="text-emerald-700 font-semibold">Login</Link>
        </p>
      </form>
    </div>
  )
}