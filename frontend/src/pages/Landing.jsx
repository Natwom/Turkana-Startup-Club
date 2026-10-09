// pages/Landing.jsx
import { useCallback, useEffect, useRef, useState } from 'react'
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
  menu: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  close: 'M6 18 18 6M6 6l12 12',
  up: 'M4.5 15.75l7.5-7.5 7.5 7.5',
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

/* ── Social brand logos (inline SVG, 24x24 viewBox) ── */
function SocialIcon({ name, className = 'w-5 h-5' }) {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    className,
    'aria-hidden': 'true',
  }

  switch (name) {
    case 'x':
      return (
        <svg {...common} fill="currentColor">
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
        </svg>
      )
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg {...common} fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg {...common} fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      )
    default:
      return null
  }
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

// Highlights shown under the hero: [headline, supporting text, icon]
const highlights = [
  ['Free to join', 'No fees, no catch', 'users'],
  ['Open to everyone', 'Students to founders', 'cap'],
  ['Build, learn, connect', 'Events, mentors, projects', 'bulb'],
  ['Made in Turkana', 'For the county and beyond', 'globe'],
]

// [name, url, icon key]
// Replace these URLs with the club's real social media pages.
const socials = [
  ['X (Twitter)', 'https://x.com', 'x'],
  ['Instagram', 'https://instagram.com', 'instagram'],
  ['LinkedIn', 'https://linkedin.com', 'linkedin'],
  ['YouTube', 'https://youtube.com', 'youtube'],
]

// Sections shown in the nav: [id, label]
const NAV = [
  ['pillars', 'Pillars'],
  ['features', 'Features'],
  ['how', 'How It Works'],
  ['faq', 'FAQ'],
]

// Words the hero types out, one after another
const TYPED_WORDS = ['builders', 'founders', 'developers', 'mentors', 'dreamers']

const TESTIMONIAL_MS = 6000

/* ═══════════════════════════ Hooks ═══════════════════════════ */

// Respect the visitor's "reduce motion" setting
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

// true once the element has scrolled into view (fires once)
function useInView(reduced, threshold = 0.15) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    if (reduced) { setSeen(true); return }
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) { setSeen(true); return }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setSeen(true); io.disconnect() }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduced, threshold])

  return [ref, seen]
}

// Types a word, pauses, deletes it, moves to the next
function useTypewriter(words, reduced) {
  const [text, setText] = useState(reduced ? words[0] : '')

  useEffect(() => {
    if (reduced) { setText(words[0]); return }
    let wordIdx = 0
    let charIdx = 0
    let deleting = false
    let timer

    const tick = () => {
      const word = words[wordIdx]
      if (!deleting) {
        charIdx += 1
        setText(word.slice(0, charIdx))
        if (charIdx === word.length) {
          deleting = true
          timer = setTimeout(tick, 1600)
          return
        }
        timer = setTimeout(tick, 85)
      } else {
        charIdx -= 1
        setText(word.slice(0, charIdx))
        if (charIdx === 0) {
          deleting = false
          wordIdx = (wordIdx + 1) % words.length
          timer = setTimeout(tick, 350)
          return
        }
        timer = setTimeout(tick, 45)
      }
    }

    timer = setTimeout(tick, 600)
    return () => clearTimeout(timer)
  }, [words, reduced])

  return text
}

/* ═══════════════════════ Small components ═══════════════════════ */

// Fades + slides its children up when scrolled into view
function Reveal({ children, delay = 0, className = '', reduced }) {
  const [ref, seen] = useInView(reduced)
  return (
    <div
      ref={ref}
      style={{ transitionDelay: seen && !reduced ? `${delay}ms` : '0ms' }}
      className={`transition-all duration-700 ease-out ${
        seen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
    >
      {children}
    </div>
  )
}

// Feature card with a soft green spotlight that follows the cursor
function FeatureCard({ icon, title, desc }) {
  const ref = useRef(null)

  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className="group relative h-full overflow-hidden bg-white rounded-2xl p-6 border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: 'radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgba(16,185,129,0.14), transparent 70%)' }}
      />
      <span className="relative w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white group-hover:rotate-6 transition-all duration-300">
        <Icon name={icon} className="w-6 h-6" />
      </span>
      <h3 className="relative mt-4 font-bold text-lg">{title}</h3>
      <p className="relative mt-2 text-sm text-gray-600">{desc}</p>
    </div>
  )
}

// Accordion item with a smooth open/close height animation
function FAQ({ q, a, open, onToggle }) {
  return (
    <div className={`border rounded-xl overflow-hidden transition-colors duration-300 ${open ? 'border-emerald-300 shadow-sm' : 'border-gray-200'}`}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-gray-50"
      >
        <span className="font-medium text-gray-800">{q}</span>
        <span className={`ml-4 text-xl leading-none text-emerald-600 transition-transform duration-300 ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-sm text-gray-600 border-t border-gray-100 pt-3">{a}</p>
        </div>
      </div>
    </div>
  )
}

// Auto-rotating testimonial carousel (pauses on hover / focus)
function Testimonials({ reduced }) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || reduced) return
    const t = setTimeout(() => setIdx((i) => (i + 1) % testimonials.length), TESTIMONIAL_MS)
    return () => clearTimeout(t)
  }, [idx, paused, reduced])

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* All quotes share one grid cell so the height never jumps */}
      <div className="grid max-w-3xl mx-auto">
        {testimonials.map((t, i) => (
          <figure
            key={t.name}
            aria-hidden={i !== idx}
            className={`col-start-1 row-start-1 text-center bg-white/10 border border-white/15 rounded-3xl px-6 py-10 md:px-12 backdrop-blur-sm
              transition-all duration-700 ease-out
              ${i === idx ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`}
          >
            <span className="block text-5xl leading-none text-emerald-300/70 font-serif" aria-hidden="true">“</span>
            <blockquote className="mt-2 text-xl md:text-2xl text-emerald-50 leading-relaxed">{t.quote}</blockquote>
            <figcaption className="mt-6">
              <p className="font-semibold">{t.name}</p>
              <p className="text-sm text-emerald-200">{t.role}</p>
            </figcaption>
          </figure>
        ))}
      </div>

      {/* Tabs with a progress bar that fills while the quote is showing */}
      <div className="mt-8 max-w-3xl mx-auto grid grid-cols-3 gap-3">
        {testimonials.map((t, i) => (
          <button
            key={t.name}
            onClick={() => setIdx(i)}
            aria-label={`Show story from ${t.name}`}
            aria-current={i === idx}
            className="group text-left"
          >
            <span className="block h-1 rounded-full bg-white/20 overflow-hidden">
              <span
                key={`${i}-${idx === i ? 'on' : 'off'}`}
                className="block h-full bg-emerald-300 origin-left"
                style={{
                  transform: i < idx || (i === idx && reduced) ? 'scaleX(1)' : i === idx ? undefined : 'scaleX(0)',
                  animation: i === idx && !reduced ? `tsc-fill ${TESTIMONIAL_MS}ms linear forwards` : 'none',
                  animationPlayState: paused ? 'paused' : 'running',
                }}
              />
            </span>
            <span className={`mt-2 block text-xs sm:text-sm truncate transition-colors ${i === idx ? 'text-white font-medium' : 'text-emerald-200 group-hover:text-white'}`}>
              {t.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════ Page ═══════════════════════════ */

export default function Landing() {
  const reduced = usePrefersReducedMotion()

  const [scrolled, setScrolled] = useState(false)
  const [showTop, setShowTop] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeId, setActiveId] = useState('')

  const progressRef = useRef(null)
  const heroRef = useRef(null)
  const dotsRef = useRef(null)
  const blobARef = useRef(null)
  const blobBRef = useRef(null)

  const typed = useTypewriter(TYPED_WORDS, reduced)
  const [howRef, howSeen] = useInView(reduced, 0.25)

  // One scroll listener (throttled with rAF): progress bar, header, parallax, back-to-top
  useEffect(() => {
    let ticking = false

    const update = () => {
      ticking = false
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight

      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`
      }
      setScrolled(y > 10)
      setShowTop(y > 600)

      if (!reduced && y < 900) {
        if (dotsRef.current) dotsRef.current.style.transform = `translateY(${y * 0.15}px)`
        if (blobARef.current) blobARef.current.style.transform = `translateY(${y * 0.25}px)`
        if (blobBRef.current) blobBRef.current.style.transform = `translateY(${y * -0.12}px)`
      }
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [reduced])

  // Highlight the nav link of the section currently in view
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActiveId(e.target.id) })
      },
      { rootMargin: '-40% 0px -55% 0px' }
    )
    NAV.forEach(([id]) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])

  // Close the mobile menu with Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Smooth-scroll to a section
  const goTo = useCallback((e, id) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
      window.history.replaceState(null, '', `#${id}`)
    }
    setMenuOpen(false)
  }, [reduced])

  const scrollTop = () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })

  // Hero spotlight follows the mouse
  const onHeroMove = (e) => {
    const el = heroRef.current
    if (!el || reduced) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - r.left}px`)
    el.style.setProperty('--y', `${e.clientY - r.top}px`)
  }

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <style>{`
        @keyframes tsc-blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
        @keyframes tsc-fill  { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        @keyframes tsc-float {
          0%, 100% { translate: 0 0 }
          50% { translate: 0 -18px }
        }
        .tsc-caret { animation: tsc-blink 1s steps(1) infinite; }
        .tsc-float { animation: tsc-float 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .tsc-caret, .tsc-float { animation: none; }
        }
      `}</style>

      {/* ── Scroll progress bar ── */}
      <div
        ref={progressRef}
        aria-hidden="true"
        className="fixed top-0 left-0 z-[60] h-1 w-full origin-left bg-gradient-to-r from-emerald-400 to-teal-400"
        style={{ transform: 'scaleX(0)' }}
      />

      {/* ── Header (sticky, blurs on scroll) ── */}
      <header className={`sticky top-0 z-50 transition-all ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-white'}`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center">T</span>
            <span className="font-bold text-xl text-emerald-700">Turkana Startup Club</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => goTo(e, id)}
                className={`relative py-1 transition-colors hover:text-emerald-700 ${activeId === id ? 'text-emerald-700 font-medium' : ''}`}
              >
                {label}
                <span className={`absolute left-0 -bottom-0.5 h-0.5 rounded bg-emerald-500 transition-all duration-300 ${activeId === id ? 'w-full' : 'w-0'}`} />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-gray-700 hover:text-gray-900">Login</Link>
            <Link to="/register" className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm">
              Join TSC
            </Link>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
            >
              <Icon name={menuOpen ? 'close' : 'menu'} className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile menu (slides open) */}
        <div
          className="md:hidden grid transition-[grid-template-rows] duration-300 ease-out border-gray-100"
          style={{ gridTemplateRows: menuOpen ? '1fr' : '0fr', borderTopWidth: menuOpen ? 1 : 0 }}
        >
          <div className="overflow-hidden">
            <nav className="px-4 py-3 flex flex-col text-sm">
              {NAV.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => goTo(e, id)}
                  className={`px-3 py-2.5 rounded-lg ${activeId === id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        ref={heroRef}
        onMouseMove={onHeroMove}
        className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 text-white"
      >
        {/* dotted pattern (drifts slightly on scroll) */}
        <div
          ref={dotsRef}
          className="absolute -inset-10 opacity-10 will-change-transform"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />

        {/* floating glow blobs */}
        <div ref={blobARef} className="absolute -top-24 -left-24 will-change-transform" aria-hidden="true">
          <div className="tsc-float w-72 h-72 rounded-full bg-emerald-400/20 blur-3xl" />
        </div>
        <div ref={blobBRef} className="absolute -bottom-32 -right-20 will-change-transform" aria-hidden="true">
          <div className="tsc-float w-80 h-80 rounded-full bg-teal-300/20 blur-3xl" style={{ animationDelay: '-3s' }} />
        </div>

        {/* cursor spotlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(420px circle at var(--x, 50%) var(--y, 30%), rgba(255,255,255,0.13), transparent 65%)' }}
        />

        <div className="relative max-w-4xl mx-auto px-4 py-24 md:py-32 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-semibold tracking-wide bg-white/10 border border-white/20 rounded-full">
            <span className="relative flex w-2 h-2">
              {!reduced && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />}
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-300" />
            </span>
            Empowering Turkana's builders, founders & dreamers
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            The digital home of Turkana's<br className="hidden md:block" /> startup ecosystem
          </h1>

          {/* typewriter line */}
          <p className="mt-5 text-xl md:text-2xl font-semibold text-emerald-200 h-8" aria-live="off">
            Made for <span className="text-white">{typed}</span>
            <span className="tsc-caret ml-0.5 inline-block w-0.5 h-6 align-middle bg-emerald-200" aria-hidden="true" />
          </p>

          <p className="mt-6 text-emerald-100 text-lg max-w-2xl mx-auto">
            Community · Networking · Events · Hackathons · Projects · Mentorship · Incubation — everything you need to turn an idea into a venture.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/register" className="px-6 py-3 bg-white text-emerald-700 font-semibold rounded-lg shadow hover:shadow-lg hover:-translate-y-0.5 transition-all">
              Join TSC — It's Free
            </Link>
            <Link to="/events" className="group px-6 py-3 border border-white/40 rounded-lg hover:bg-white/10 transition">
              Explore Events <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>

        {/* Highlights bar (replaces the old numeric stats) */}
        <div className="relative bg-white text-gray-800 border-t border-emerald-900/10">
          <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
            {highlights.map(([title, sub, icon], i) => (
              <Reveal key={title} delay={i * 90} reduced={reduced}>
                <div className="group flex items-center gap-3">
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white group-hover:scale-110 transition-all duration-300">
                    <Icon name={icon} className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 leading-tight">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Five Pillars ── */}
      <section id="pillars" className="max-w-6xl mx-auto px-4 py-20 scroll-mt-20">
        <Reveal reduced={reduced} className="text-center mb-12">
          <h2 className="text-3xl font-bold">Our Five Pillars</h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">Everything we do is organized around five pillars designed to move you from idea to impact.</p>
        </Reveal>
        <div className="grid md:grid-cols-5 gap-4">
          {pillars.map(([name, desc, icon], i) => (
            <Reveal key={name} delay={i * 100} reduced={reduced}>
              <div className="group h-full border rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 bg-gradient-to-b from-white to-gray-50">
                <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
                  <Icon name={icon} className="w-6 h-6" />
                </span>
                <h3 className="mt-4 font-bold text-emerald-700">{String(i + 1).padStart(2, '0')} · {name}</h3>
                <p className="mt-2 text-sm text-gray-600">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="bg-gray-50 border-y scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <Reveal reduced={reduced} className="text-center mb-12">
            <h2 className="text-3xl font-bold">One Platform, Everything You Need</h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">Join and instantly access the tools that power Turkana's startup community.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 110} reduced={reduced}>
                <FeatureCard {...f} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" className="max-w-6xl mx-auto px-4 py-20 scroll-mt-20">
        <Reveal reduced={reduced} className="text-center mb-12">
          <h2 className="text-3xl font-bold">How It Works</h2>
          <p className="mt-3 text-gray-500">From sign-up to scale-up in three simple steps.</p>
        </Reveal>
        <div ref={howRef} className="relative grid md:grid-cols-3 gap-6">
          {/* connector line that draws itself across the circles */}
          <div className="hidden md:block absolute top-7 left-[16.6%] right-[16.6%] h-0.5 bg-emerald-100" aria-hidden="true">
            <div
              className="h-full bg-emerald-500 origin-left transition-transform ease-out"
              style={{
                transform: howSeen ? 'scaleX(1)' : 'scaleX(0)',
                transitionDuration: reduced ? '0ms' : '1400ms',
                transitionDelay: reduced ? '0ms' : '300ms',
              }}
            />
          </div>
          {steps.map(([title, desc], i) => (
            <Reveal key={title} delay={i * 250} reduced={reduced}>
              <div className="relative text-center px-6">
                <span className="relative z-10 w-14 h-14 mx-auto rounded-full bg-emerald-600 text-white text-xl font-bold flex items-center justify-center shadow-lg ring-4 ring-white hover:scale-110 transition-transform duration-300">
                  {i + 1}
                </span>
                <h3 className="mt-5 font-bold text-lg">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-emerald-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <Reveal reduced={reduced}>
            <h2 className="text-3xl font-bold text-center mb-12">Stories from Our Community</h2>
          </Reveal>
          <Reveal reduced={reduced} delay={150}>
            <Testimonials reduced={reduced} />
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-3xl mx-auto px-4 py-20 scroll-mt-20">
        <Reveal reduced={reduced} className="text-center mb-10">
          <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
          <p className="mt-3 text-gray-500">Everything you need to know about joining TSC.</p>
        </Reveal>
        <div className="space-y-3">
          {faqs.map(([q, a], i) => (
            <Reveal key={q} delay={i * 80} reduced={reduced}>
              <FAQ q={q} a={a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <Reveal reduced={reduced}>
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl text-center text-white px-6 py-16 shadow-xl">
            <div className="tsc-float absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="tsc-float absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-teal-300/20 blur-2xl" style={{ animationDelay: '-4s' }} aria-hidden="true" />
            <h2 className="relative text-3xl font-bold">Ready to build the future of Turkana?</h2>
            <p className="relative mt-4 text-emerald-100">Join the community that is building, learning and growing together.</p>
            <div className="relative mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Link to="/register" className="px-6 py-3 bg-white text-emerald-700 font-semibold rounded-lg shadow hover:shadow-lg hover:-translate-y-0.5 transition-all">
                Become a Member
              </Link>
              <Link to="/events" className="px-6 py-3 border border-white/40 rounded-lg hover:bg-white/10 transition">
                Browse Upcoming Events
              </Link>
            </div>
          </div>
        </Reveal>
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
              <li><Link to="/terms" className="hover:text-white">Terms &amp; Privacy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Follow Us</h4>
            <div className="flex gap-3">
              {socials.map(([name, url, icon]) => (
                <a key={name} href={url} target="_blank" rel="noreferrer noopener" title={name} aria-label={name}
                  className="w-10 h-10 rounded-lg bg-gray-800 text-gray-300 flex items-center justify-center hover:bg-emerald-600 hover:text-white hover:-translate-y-1 transition-all duration-200">
                  <SocialIcon name={icon} className="w-5 h-5" />
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

      {/* ── Back to top ── */}
      <button
        onClick={scrollTop}
        aria-label="Back to top"
        className={`fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center hover:bg-emerald-700 hover:-translate-y-1 transition-all duration-300 ${
          showTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <Icon name="up" className="w-5 h-5" />
      </button>
    </div>
  )
}