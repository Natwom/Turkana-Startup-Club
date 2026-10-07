// pages/Landing.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

/* ── Inline SVG icon set (no extra dependency needed) ── */
const ICON_PATHS = {
  code: 'M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5',
  users:
    'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z',
  book:
    'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25',
  trend:
    'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941',
  globe:
    'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418',
  calendar:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  search:
    'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
  cap:
    'M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5',
  chat:
    'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  bell:
    'M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0',
  bulb:
    'M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
}

function Icon({ name, className = 'w-6 h-6' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[name]} />
    </svg>
  )
}

const pillars = [
  ['BUILD', 'Hackathons, build sessions, project teams, demo days.', 'code'],
  ['CONNECT', 'Member directory, founder meetups, mentor matching.', 'users'],
  ['LEARN', 'Workshops, tech talks, AI, cybersecurity, pitching.', 'book'],
  ['GROW', 'Mentorship, incubation, grants, accelerators.', 'trend'],
  ['COMMUNITY', 'Chapters, volunteers, annual conference, recognition.', 'globe'],
]

const features = [
  {
    icon: 'calendar',
    title: 'Events & Hackathons',
    desc: 'Discover, RSVP to and get reminders for every event, workshop and hackathon in the ecosystem.',
  },
  {
    icon: 'search',
    title: 'Startup Directory',
    desc: 'A public directory of startups and founders. Find co-founders, collaborators and partners.',
  },
  {
    icon: 'cap',
    title: 'Digital Certificates',
    desc: 'Earn verifiable certificates for participating in events, hackathons and programs.',
  },
  {
    icon: 'chat',
    title: 'Messaging & Networking',
    desc: 'Connect with members directly, message founders, mentors and volunteers in real time.',
  },
  {
    icon: 'bell',
    title: 'Smart Notifications',
    desc: 'Stay in the loop with instant alerts for event invites, mentorship matches and mentions.',
  },
  {
    icon: 'bulb',
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

// [name, url, short label shown in the button]
const socials = [
  ['X / Twitter', 'https://twitter.com', 'X'],
  ['Instagram', 'https://instagram.com', 'IG'],
  ['LinkedIn', 'https://linkedin.com', 'in'],
  ['YouTube', 'https://youtube.com', 'YT'],
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
          <span className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-semibold tracking-wide bg-white/10 border border-white/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-300" />
            Empowering Turkana's builders, founders & dreamers
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
              <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Icon name={icon} className="w-6 h-6" />
              </span>
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
                <span className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Icon name={f.icon} className="w-6 h-6" />
                </span>
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
              {socials.map(([name, url, label]) => (
                <a key={name} href={url} target="_blank" rel="noreferrer" title={name} aria-label={name}
                  className="w-9 h-9 rounded-lg bg-gray-800 text-sm font-semibold text-gray-300 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition">
                  {label}
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