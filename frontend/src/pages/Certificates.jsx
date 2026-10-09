import { useEffect, useId, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import api from '../services/api'

/* ── Inline SVG icons (no extra dependency needed) ── */
const ICONS = {
  search: ['m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z'],
  x: ['M6 18 18 6M6 6l12 12'],
  check: ['m4.5 12.75 6 6 9-13.5'],
  link: [
    'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244',
  ],
  printer: [
    'M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z',
  ],
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

/* ── Small seal used on the certificate cards (emerald + gold) ── */
function Seal({ className = '', style }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <circle cx="50" cy="50" r="47" fill="#047857" />
      <circle cx="50" cy="50" r="43" fill="none" stroke="#fcd34d" strokeWidth="1.2" strokeDasharray="2 2.2" />
      <circle cx="50" cy="50" r="37" fill="#065f46" stroke="#fcd34d" strokeWidth="1.5" />
      <polygon
        points="50,28 55.29,42.72 70.92,43.2 58.56,52.78 62.93,67.8 50,59 37.07,67.8 41.44,52.78 29.08,43.2 44.71,42.72"
        fill="#fcd34d"
      />
    </svg>
  )
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''

const TYPE_STYLES = {
  hackathon: 'bg-violet-50 text-violet-700 ring-violet-200',
  event: 'bg-sky-50 text-sky-700 ring-sky-200',
  course: 'bg-amber-50 text-amber-700 ring-amber-200',
  participation: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  award: 'bg-rose-50 text-rose-700 ring-rose-200',
}

// Wording printed on the certificate for each type
const TYPE_COPY = {
  participation: { title: 'Certificate of Participation', line: 'in recognition of active participation in' },
  hackathon: { title: 'Certificate of Achievement', line: 'for active participation and demonstrated innovation in' },
  event: { title: 'Certificate of Attendance', line: 'for attending' },
  course: { title: 'Certificate of Completion', line: 'for successfully completing' },
  award: { title: 'Certificate of Excellence', line: 'in recognition of outstanding achievement and distinguished contribution in' },
}

/* ── SIGNATORIES ──────────────────────────────────────────────────────
   name  : printed under the signature line
   role  : printed in small capitals under the name
   image : path to the signature image in frontend/public/signatures/
           Replace these files with a scan of the real signature
           (a transparent PNG or SVG works best) and keep the same file name.
           If the image is missing, the name is shown in a script font instead.
   ------------------------------------------------------------------- */
const SIGNATORIES = [
  { name: 'Daniel Natwom', role: 'Founder / CEO', image: '/signatures/founder-ceo.svg' },
]

/* ── Design tokens ── */
const SERIF = "Georgia, 'Times New Roman', Times, serif"
const DISPLAY = "'Cormorant Garamond', Georgia, 'Times New Roman', serif"
const SCRIPT = "'Great Vibes', 'Segoe Script', 'Brush Script MT', 'Snell Roundhand', 'Lucida Handwriting', cursive"
const GOLD = '#b8922a'
const GOLD_LIGHT = '#e6c65a'
const EMERALD = '#065f46'
const EMERALD_MID = '#047857'
const INK = '#1e3a8a'

const SKELETONS = Array.from({ length: 3 })

const fs = (n) => ({ fontSize: `${n}cqw` })

// Name size shrinks for long names so they stay on one line
const nameSize = (name = '') => (name.length > 30 ? 3.9 : name.length > 22 ? 4.8 : name.length > 16 ? 5.6 : 6.4)

// 32-point starburst used for the edge of the gold seal
const BURST = (() => {
  const pts = []
  const n = 32
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 47 : 43
    const a = (Math.PI * i) / n - Math.PI / 2
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
})()

/* ── Gold embossed seal with ribbon tails ── */
function GoldSeal({ style }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 100 118" style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.45" stopColor="#d9ae2f" />
          <stop offset="1" stopColor="#9a7410" />
        </linearGradient>
        <radialGradient id={`${id}-green`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#0b7a5a" />
          <stop offset="1" stopColor="#064e3b" />
        </radialGradient>
      </defs>
      {/* ribbon tails */}
      <polygon points="30,78 48,88 40,117 31,108 21,114" fill={EMERALD} stroke={GOLD} strokeWidth="0.8" />
      <polygon points="70,78 52,88 60,117 69,108 79,114" fill={EMERALD} stroke={GOLD} strokeWidth="0.8" />
      {/* disc */}
      <polygon points={BURST} fill={`url(#${id}-gold)`} stroke="#8a6a12" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#fff6c8" strokeOpacity="0.7" strokeWidth="1" strokeDasharray="1.6 2" />
      <circle cx="50" cy="50" r="33" fill={`url(#${id}-green)`} stroke={GOLD_LIGHT} strokeWidth="1.4" />
      <g transform="translate(50 42) scale(0.74) translate(-50 -50)">
        <polygon
          points="50,28 55.29,42.72 70.92,43.2 58.56,52.78 62.93,67.8 50,59 37.07,67.8 41.44,52.78 29.08,43.2 44.71,42.72"
          fill={GOLD_LIGHT}
        />
      </g>
      <text x="50" y="68" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="10"
        letterSpacing="1.5" fill={GOLD_LIGHT}>
        TSC
      </text>
    </svg>
  )
}

/* ── Corner flourish (drawn once, mirrored into the four corners) ── */
function Corner({ style }) {
  return (
    <svg viewBox="0 0 60 60" style={{ position: 'absolute', width: '9.5cqw', height: '9.5cqw', ...style }} aria-hidden="true">
      <g fill="none" stroke={GOLD} strokeLinecap="round">
        <path d="M3 3 V40" strokeWidth="1.6" />
        <path d="M3 3 H40" strokeWidth="1.6" />
        <path d="M3 20 A17 17 0 0 0 20 3" strokeWidth="1.1" />
        <path d="M3 30 A27 27 0 0 0 30 3" strokeWidth="0.7" strokeOpacity="0.8" />
      </g>
      <circle cx="11" cy="11" r="2.4" fill={EMERALD} />
      <circle cx="11" cy="11" r="4.4" fill="none" stroke={GOLD} strokeWidth="0.7" />
    </svg>
  )
}

/* ── Faint acacia mark used as a watermark ── */
function Watermark({ style }) {
  return (
    <svg viewBox="0 0 64 64" style={style} aria-hidden="true">
      <g fill={EMERALD}>
        <path d="M10 25.5C14 19.5 22.5 17 32 17S50 19.5 54 25.5C47 23.2 40 22.4 32 22.4S17 23.2 10 25.5Z" />
        <path d="M17 18.2C21 14.4 26 13 32 13S43 14.4 47 18.2C42 16.6 37.5 16 32 16S22 16.6 17 18.2Z" />
        <path d="M30.4 22.6H33.6L34 36C34.2 42 35 47 36.4 52H27.6C29 47 29.8 42 30 36Z" />
        <path d="M31.2 33.5L22.5 25.2L24.3 23.7L32 30Z" />
        <path d="M32.8 33.5L41.5 25.2L39.7 23.7L32 30Z" />
        <rect x="17" y="52" width="30" height="3" rx="1.5" />
      </g>
    </svg>
  )
}

/* ── Small colour logo for the certificate header ── */
function HeaderMark({ style }) {
  return (
    <svg viewBox="0 0 64 64" style={style} aria-hidden="true">
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

/* ── Gold divider with a diamond in the middle ── */
function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2cqw', margin: '1cqw 0 0.9cqw' }}>
      <span style={{ width: '14cqw', height: '0.18cqw', background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
      <span style={{ width: '0.9cqw', height: '0.9cqw', background: GOLD, transform: 'rotate(45deg)' }} />
      <span style={{ width: '14cqw', height: '0.18cqw', background: `linear-gradient(270deg, transparent, ${GOLD})` }} />
    </div>
  )
}

/* One signature block: signature, line, name, role, organisation */
function Signature({ person, align }) {
  const { name, role, image } = person
  const [broken, setBroken] = useState(false)
  const showImage = image && !broken

  return (
    <div style={{ justifySelf: align, width: '25cqw', textAlign: 'center' }}>
      <div style={{ height: '6cqw', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        {showImage ? (
          <img
            src={image}
            alt={`Signature of ${name}`}
            onError={() => setBroken(true)}
            style={{ width: '22cqw', maxHeight: '6cqw', objectFit: 'contain', display: 'block' }}
          />
        ) : name ? (
          <span style={{
            fontFamily: SCRIPT, fontSize: '3.4cqw', color: INK, lineHeight: 1,
            paddingBottom: '0.4cqw', whiteSpace: 'nowrap',
          }}>
            {name}
          </span>
        ) : null}
      </div>
      <div style={{ borderTop: '0.15cqw solid #4b5563', paddingTop: '0.7cqw' }}>
        <p style={{ ...fs(1.6), fontWeight: 700, color: '#111827', margin: 0 }}>{name}</p>
        <p style={{
          ...fs(1.1), color: EMERALD_MID, margin: '0.25cqw 0 0', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>
          {role}
        </p>
        <p style={{ ...fs(1.0), color: '#9ca3af', margin: '0.25cqw 0 0' }}>Turkana Startup Club</p>
      </div>
    </div>
  )
}

/* ── The certificate itself. Everything is sized in cqw (container width),
      so it scales perfectly on phones, desktops and when printed. ── */
function CertificateSheet({ cert, verifyUrl }) {
  const copy = TYPE_COPY[cert.activity_type] || TYPE_COPY.participation

  return (
    <div style={{ containerType: 'inline-size', width: '100%' }}>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '1.414 / 1', color: '#1f2937',
        fontFamily: SERIF, overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, #fffef9 0%, #fbf5e2 100%)',
      }}>
        {/* fine diagonal texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(6,95,70,0.028) 0 0.35cqw, transparent 0.35cqw 0.7cqw)',
        }} />

        {/* watermark */}
        <Watermark style={{
          position: 'absolute', left: '50%', top: '50%', width: '40cqw', height: '40cqw',
          transform: 'translate(-50%, -52%)', opacity: 0.055, pointerEvents: 'none',
        }} />

        {/* triple border */}
        <div style={{ position: 'absolute', inset: '1.4cqw', border: `0.9cqw solid ${EMERALD}` }} />
        <div style={{ position: 'absolute', inset: '2.7cqw', border: `0.25cqw solid ${GOLD}` }} />
        <div style={{ position: 'absolute', inset: '3.3cqw', border: `0.08cqw solid ${EMERALD}`, opacity: 0.6 }} />

        {/* corner flourishes */}
        <Corner style={{ top: '3.3cqw', left: '3.3cqw' }} />
        <Corner style={{ top: '3.3cqw', right: '3.3cqw', transform: 'scaleX(-1)' }} />
        <Corner style={{ bottom: '3.3cqw', left: '3.3cqw', transform: 'scaleY(-1)' }} />
        <Corner style={{ bottom: '3.3cqw', right: '3.3cqw', transform: 'scale(-1, -1)' }} />

        <div style={{
          position: 'absolute', inset: '5cqw 9cqw 4.4cqw', display: 'flex',
          flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}>
          {/* Header */}
          <HeaderMark style={{ width: '3.4cqw', height: '3.4cqw' }} />
          <p style={{
            ...fs(1.35), letterSpacing: '0.42em', color: EMERALD_MID, fontWeight: 700,
            margin: '0.6cqw 0 0', paddingLeft: '0.42em',
          }}>
            TURKANA STARTUP CLUB
          </p>
          <h2 style={{
            fontFamily: DISPLAY, ...fs(4.9), fontWeight: 700, color: '#064e3b',
            margin: '0.6cqw 0 0', lineHeight: 1.12, letterSpacing: '0.01em',
          }}>
            {copy.title}
          </h2>
          <Divider />

          {/* Recipient */}
          <p style={{ ...fs(1.5), fontStyle: 'italic', color: '#4b5563', margin: 0 }}>
            This certificate is proudly presented to
          </p>
          <p style={{
            fontFamily: SCRIPT, ...fs(nameSize(cert.holder)), fontWeight: 400, color: EMERALD,
            margin: '0.5cqw 0 0', padding: '0 5cqw 0.5cqw', maxWidth: '82cqw', lineHeight: 1.25,
            overflowWrap: 'anywhere',
            borderBottom: `0.18cqw solid ${GOLD}`,
          }}>
            {cert.holder}
          </p>

          {/* Citation */}
          <p style={{ ...fs(1.5), color: '#4b5563', margin: '1.1cqw 0 0' }}>{copy.line}</p>
          <p style={{
            fontFamily: DISPLAY, ...fs(2.7), fontWeight: 700, color: '#111827',
            margin: '0.4cqw 0 0', maxWidth: '76cqw', lineHeight: 1.2,
          }}>
            {cert.title}
          </p>
          {cert.description && (
            <p style={{ ...fs(1.25), color: '#6b7280', margin: '0.7cqw 0 0', maxWidth: '68cqw', lineHeight: 1.4 }}>
              {cert.description}
            </p>
          )}
          <p style={{ ...fs(1.3), color: '#6b7280', margin: '0.8cqw 0 0' }}>
            {cert.event_date ? `Held on ${fmtDate(cert.event_date)}  ·  ` : ''}Issued on {fmtDate(cert.issued_at)}
          </p>

          <div style={{ flex: 1 }} />

          {/* Signature + seal */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'end',
            width: '100%', gap: '2cqw',
          }}>
            <div />
            <GoldSeal style={{ width: '9cqw', height: '10.6cqw' }} />
            <Signature person={SIGNATORIES[0]} align="end" />
          </div>

          {/* Verification footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.4cqw',
            width: '100%', marginTop: '1.4cqw', paddingTop: '1cqw',
            borderTop: `0.1cqw solid ${GOLD}`,
          }}>
            <QRCodeSVG value={verifyUrl} size={96} style={{ width: '5.2cqw', height: '5.2cqw' }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ ...fs(1.1), color: '#374151', margin: 0 }}>
                Certificate ID: <strong style={{ fontFamily: 'monospace' }}>{cert.certificate_id}</strong>
              </p>
              <p style={{ ...fs(0.95), color: '#6b7280', margin: '0.25cqw 0 0' }}>
                Scan the code or visit {verifyUrl} to verify this certificate.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Certificates() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState(null)
  const [copied, setCopied] = useState('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    api.get('/certificates/my')
      .then((r) => setItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('Could not load your certificates'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setView(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const verifyUrl = (code) => `${window.location.origin}/verify/${code}`

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(verifyUrl(code))
      setCopied(code)
      setTimeout(() => setCopied(''), 2500)
    } catch {
      window.prompt('Copy this link:', verifyUrl(code))
    }
  }

  const types = useMemo(
    () => ['all', ...new Set(items.map((c) => c.activity_type).filter(Boolean))],
    [items]
  )
  const counts = useMemo(() => {
    const c = { all: items.length }
    for (const t of types.slice(1)) c[t] = items.filter((i) => i.activity_type === t).length
    return c
  }, [items, types])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items
      .filter((c) => typeFilter === 'all' || c.activity_type === typeFilter)
      .filter((c) => !needle
        || (c.title || '').toLowerCase().includes(needle)
        || (c.certificate_id || '').toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at))
  }, [items, typeFilter, query])

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Great+Vibes&display=swap');
        @media print {
          @page { size: A4 landscape; margin: 0; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: fixed; inset: 0; width: 100vw; height: 100vh;
            margin: 0; padding: 0 !important; border-radius: 0 !important;
            box-shadow: none !important; background: #fff;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Certificates</h1>
        <p className="text-sm text-gray-500 mt-1">
          {items.length} certificate{items.length === 1 ? '' : 's'} earned · each has a public verification link
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="font-medium hover:underline">Reload</button>
        </div>
      )}

      {/* Controls */}
      {!loading && items.length > 0 && (
        <>
          <div className="relative mb-3 max-w-md">
            <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
              <Icon name="search" className="w-4 h-4" />
            </span>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search certificates or codes…"
              className="w-full border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search"
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
                <Icon name="x" className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {types.map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap capitalize transition-colors
                  ${typeFilter === t
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-700'}`}>
                {t === 'all' ? `All (${counts.all})` : `${t} (${counts[t] || 0})`}
              </button>
            ))}
          </div>
        </>
      )}

      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SKELETONS.map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
              <div className="h-5 w-24 bg-gray-100 rounded-full" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mt-3" />
              <div className="h-2.5 bg-gray-100 rounded w-1/2 mt-2" />
              <div className="mt-5 h-9 w-32 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Seal className="w-16 h-16 mx-auto mb-3 opacity-80" />
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            You don't have any certificates yet. Take part in events and hackathons to earn them!
          </p>
        </div>
      )}

      {!loading && items.length > 0 && visible.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No certificates match your filters.</p>
          <button onClick={() => { setQuery(''); setTypeFilter('all') }}
            className="mt-3 text-sm text-emerald-700 font-medium hover:underline">Clear filters</button>
        </div>
      )}

      {!loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((c) => (
            <article key={c.id}
              className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset capitalize
                  ${TYPE_STYLES[c.activity_type] || TYPE_STYLES.participation}`}>
                  {c.activity_type}
                </span>
                <Seal className="w-9 h-9 shrink-0" />
              </div>
              <h3 className="font-bold text-gray-900 mt-3 leading-snug">{c.title}</h3>
              <p className="text-sm text-gray-500 mt-1">Issued {fmtDate(c.issued_at)}</p>
              <p className="text-xs text-gray-400 mt-2">
                Code: <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded">{c.certificate_id}</span>
              </p>
              <div className="mt-auto pt-4 flex items-center gap-2">
                <button onClick={() => setView(c)}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                  View / Print
                </button>
                <button onClick={() => copy(c.certificate_id)}
                  className={`inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors
                    ${copied === c.certificate_id
                      ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
                      : 'text-gray-600 border-gray-200 hover:border-emerald-400 hover:text-emerald-700'}`}>
                  <Icon name={copied === c.certificate_id ? 'check' : 'link'} className="w-4 h-4" />
                  {copied === c.certificate_id ? 'Copied' : 'Copy link'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {view && (
        <div className="fixed inset-0 z-20 bg-gray-900/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setView(null)}>
          <div className="w-full max-w-4xl my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="print-area bg-white rounded-xl p-2 shadow-2xl">
              <CertificateSheet cert={view} verifyUrl={verifyUrl(view.certificate_id)} />
            </div>
            <div className="no-print mt-4 flex flex-wrap justify-end gap-3">
              <button onClick={() => copy(view.certificate_id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                <Icon name={copied === view.certificate_id ? 'check' : 'link'} className="w-4 h-4" />
                {copied === view.certificate_id ? 'Link copied' : 'Copy verify link'}
              </button>
              <button onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                <Icon name="printer" className="w-4 h-4" />
                Print / Save as PDF
              </button>
              <button onClick={() => setView(null)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}