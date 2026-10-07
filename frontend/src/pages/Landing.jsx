// pages/Landing.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const pillars = [
  ['BUILD', 'Hackathons, build sessions, project teams, demo days.', '💻'],
  ['CONNECT', 'Member directory, founder meetups, mentor matching.', '🤝'],
  ['LEARN', 'Workshops, tech talks, AI, cybersecurity, pitching.', '📚'],
  ['GROW', 'Mentorship, incubation, grants, accelerators.', '📈'],
  ['COMMUNITY', 'Chapters, volunteers, annual conference, recognition.', '🌍'],
]

const features = [
  {
    icon: '🗓️',
    title: 'Events & Hackathons',
    desc: 'Discover, RSVP to and get reminders for every event, workshop and hackathon in the ecosystem.',
  },
  {
    icon: '🧭',
    title: 'Startup Directory',
    desc: 'A public directory of startups and founders. Find co-founders, collaborators and partners.',
  },
  {
    icon: '🎓',
    title: 'Digital Certificates',
    desc: 'Earn verifiable certificates for participating in events, hackathons and programs.',
  },
  {
    icon: '💬',
    title: 'Messaging & Networking',
    desc: 'Connect with members directly, message founders, mentors and volunteers in real time.',
  },
  {
    icon: '🔔',
    title: 'Smart Notifications',
    desc: 'Stay in the loop with instant alerts for event invites, mentorship matches and mentions.',
  },
  {
    icon: '🚀',
    title: 'Incubation & Grants',
    desc: 'Apply to incubation programs, pitch competitions and grant opportunities from one place.',
  },
]

const steps = [
  ['Create your profile', 'Join as a member, founder, mentor or volunteer and tell us your story.'],
  ['Get matched', 'We match you with events, mentors, teams and opportunities relevant to you.'],
  ['Build & grow', 'Participate, earn certificates, grow your network and scale your startup.'],
]

const testimonials = [
  {
    quote: 'TSC helped me find my co-founder at a hackathon. Our fintech startup now serves 2,000 customers.',
    name: 'Akon E.',
    role: 'Founder, PayLake',
  },
  {
    quote: 'The mentorship program took my idea from a sketch to a funded pilot in six months.',
    name: 'Faith N.',
    role: 'Founder, HealthFirst',
  },
  {
    quote: 'As a volunteer I grew my skills, built my network, and earned certifications that got me hired.',
    name: 'Samuel L.',
    role: 'Community Volunteer',
  },
]

const faqs = [
  ['Who can join the Turkana Startup Club?', 'Anyone! Students, developers, founders, mentors, investors and volunteers who want to grow the startup ecosystem in Turkana.'],
  ['Is membership free?', 'Yes — becoming a member is completely free. Some specialized programs may have their own requirements.'],
  ['What happens at TSC events?', 'Hackathons, technical workshops, founder meetups, demo days and the annual conference — everything is designed to help you build, learn and connect.'],
  ['How do I get mentorship or funding?', 'Complete your profile, list your startup and apply to incubation programs. Our team will review and match you with mentors and opportunities.'],
]

const stats = [
  ['1,200+', 'Members'],
  ['85+', 'Events Hosted'],
  ['40+', 'Startups Supported'],
  ['120+', 'Mentors'],
]

const socials = [
  ['X / Twitter', 'https://twitter.com', '𝕏'],
  ['Instagram', 'https://instagram.com', '📷'],
  ['LinkedIn', 'https://linkedin.com', '💼'],
  ['YouTube', 'https://youtube.com', '▶️'],
]

function CountUp({ target, duration = 1500 }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf
    const start = performance.now()
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1)
      setValue(Math.floor(p * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return <>{value}</>
}

function FAQ({ q, a, open, onToggle }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-gray-50">
        <span className="font-medium text-gray-800">{q}</span>
        <span className={`ml-4 text-emerald-600 transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && <p className="px-5 pb-4 text-sm text-gray-600 border-t border-gray-100 pt-3">{a}</p>}
    </div>
  )
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-800">

      {/* ── Header (sticky, blurs on scroll) ── */}
      <header className={`sticky top-0 z-50 transition-all ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-white'}`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center">T</span>
            <span className="font-bold text-xl text-emerald-700">Turkana Startup Club</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#pillars" className="hover:text-emerald-700">Pillars</a>
            <a href="#features" className="hover:text-emerald-700">Features</a>
            <a href="#how" className="hover:text-emerald-700">How It Works</a>
            <a href="#faq" className="hover:text-emerald-700">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-gray-700 hover:text-gray-900">Login</Link>
            <Link to="/register" className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm">
              Join TSC
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 text-white">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative max-w-4xl mx-auto px-4 py-24 md:py-32 text-center">
          <span className="inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wide bg-white/10 border border-white/20 rounded-full">
            🚀 Empowering Turkana's builders, founders & dreamers
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            The digital home of Turkana's<br className="hidden md:block" /> startup ecosystem
          </h1>
          <p className="mt-6 text-emerald-100 text-lg max-w-2xl mx-auto">
            Community · Networking · Events · Hackathons · Projects · Mentorship · Incubation — everything you need to turn an idea into a venture.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/register" className="px-6 py-3 bg-white text-emerald-700 font-semibold rounded-lg shadow hover:shadow-lg transition">
              Join TSC — It's Free
            </Link>
            <Link to="/events" className="px-6 py-3 border border-white/40 rounded-lg hover:bg-white/10 transition">
              Explore Events →
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative bg-white text-gray-800 border-t border-emerald-900/10">
          <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map(([num, label]) => (
              <div key={label}>
                <p className="text-3xl font-extrabold text-emerald-700">
                  <CountUp target={parseInt(num, 10)} />{num.includes('+') ? '+' : ''}
                </p>
                <p className="text-sm text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Five Pillars ── */}
      <section id="pillars" className="max-w-6xl mx-auto px-4 py-20 scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Our Five Pillars</h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">Everything we do is organized around five pillars designed to move you from idea to impact.</p>
        </div>
        <div className="grid md:grid-cols-5 gap-4">
          {pillars.map(([name, desc, icon], i) => (
            <div key={name}
              className="group border rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 bg-gradient-to-b from-white to-gray-50">
              <span className="text-3xl">{icon}</span>
              <h3 className="mt-4 font-bold text-emerald-700">{String(i + 1).padStart(2, '0')} · {name}</h3>
              <p className="mt-2 text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="bg-gray-50 border-y scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">One Platform, Everything You Need</h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">Join and instantly access the tools that power Turkana's startup community.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                <span className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-2xl">{f.icon}</span>
                <h3 className="mt-4 font-bold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" className="max-w-6xl mx-auto px-4 py-20 scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">How It Works</h2>
          <p className="mt-3 text-gray-500">From sign-up to scale-up in three simple steps.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map(([title, desc], i) => (
            <div key={title} className="relative text-center px-6">
              <span className="w-14 h-14 mx-auto rounded-full bg-emerald-600 text-white text-xl font-bold flex items-center justify-center shadow-lg">
                {i + 1}
              </span>
              <h3 className="mt-5 font-bold text-lg">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-emerald-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">Stories from Our Community</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <figure key={t.name} className="bg-white/10 border border-white/15 rounded-2xl p-6 backdrop-blur-sm">
                <blockquote className="text-emerald-50">“{t.quote}”</blockquote>
                <figcaption className="mt-5">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-sm text-emerald-200">{t.role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-3xl mx-auto px-4 py-20 scroll-mt-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
          <p className="mt-3 text-gray-500">Everything you need to know about joining TSC.</p>
        </div>
        <div className="space-y-3">
          {faqs.map(([q, a], i) => (
            <FAQ key={q} q={q} a={a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl text-center text-white px-6 py-16 shadow-xl">
          <h2 className="text-3xl font-bold">Ready to build the future of Turkana?</h2>
          <p className="mt-4 text-emerald-100">Join 1,200+ members already building, learning and growing together.</p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/register" className="px-6 py-3 bg-white text-emerald-700 font-semibold rounded-lg shadow hover:shadow-lg transition">
              Become a Member
            </Link>
            <Link to="/events" className="px-6 py-3 border border-white/40 rounded-lg hover:bg-white/10 transition">
              Browse Upcoming Events
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center">T</span>
              <span className="font-bold text-lg text-white">Turkana Startup Club</span>
            </div>
            <p className="mt-3 text-sm max-w-sm">Empowering entrepreneurs, developers and changemakers across Turkana County and beyond.</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/events" className="hover:text-white">Events</Link></li>
              <li><Link to="/register" className="hover:text-white">Join TSC</Link></li>
              <li><Link to="/login" className="hover:text-white">Member Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Follow Us</h4>
            <div className="flex gap-3">
              {socials.map(([name, url, icon]) => (
                <a key={name} href={url} target="_blank" rel="noreferrer" title={name}
                  className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-emerald-600 transition">
                  {icon}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800">
          <p className="max-w-6xl mx-auto px-4 py-4 text-xs text-gray-500">
            © {new Date().getFullYear()} Turkana Startup Club. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}