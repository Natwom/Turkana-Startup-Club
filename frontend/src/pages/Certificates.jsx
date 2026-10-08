import { useEffect, useMemo, useState } from 'react'
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

/* ── Certificate seal (emerald + gold) ── */
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

/* ── SIGNATORIES: edit these ──────────────────────────────────────────
   name  : printed under the line (and drawn as a script signature if no image)
   role  : e.g. 'Programme Director'
   image : OPTIONAL path to a scanned signature (transparent PNG works best),
           e.g. '/signatures/director.png'  (file goes in frontend/public/signatures/)
   ------------------------------------------------------------------- */
const SIGNATORIES = [
  { name: '', role: 'Programme Director', image: '' },
  { name: '', role: 'Chairperson', image: '' },
]

const SERIF = "Georgia, 'Times New Roman', Times, serif"
const SCRIPT = "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', 'Lucida Handwriting', cursive"
const GOLD = '#c9a227'
const EMERALD = '#065f46'

const SKELETONS = Array.from({ length: 3 })

const fs = (n) => ({ fontSize: `${n}cqw` })

/* One signature block: signature, line, name, role, organisation */
function Signature({ person, align }) {
  const { name, role, image } = person
  return (
    <div style={{ justifySelf: align, width: '24cqw', textAlign: 'center' }}>
      <div style={{
        height: '6.5cqw', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        {image ? (
          <img src={image} alt={`Signature of ${name || role}`}
            style={{ maxHeight: '6.5cqw', maxWidth: '100%', objectFit: 'contain' }} />
        ) : name ? (
          <span style={{
            fontFamily: SCRIPT, fontSize: '3.2cqw', color: '#1e3a8a', lineHeight: 1,
            paddingBottom: '0.3cqw', whiteSpace: 'nowrap',
          }}>
            {name}
          </span>
        ) : null}
      </div>
      <div style={{ borderTop: '0.15cqw solid #6b7280', paddingTop: '0.6cqw' }}>
        {name && <p style={{ ...fs(1.45), fontWeight: 700, margin: 0 }}>{name}</p>}
        <p style={{ ...fs(1.2), color: '#6b7280', margin: 0 }}>{role}</p>
        <p style={{ ...fs(1.05), color: '#9ca3af', margin: 0 }}>Turkana Startup Club</p>
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
        position: 'relative', width: '100%', aspectRatio: '1.414 / 1',
        background: '#fffdf7', color: '#1f2937', fontFamily: SERIF, overflow: 'hidden',
      }}>
        {/* Double border */}
        <div style={{ position: 'absolute', inset: '1.6cqw', border: `0.7cqw solid ${EMERALD}` }} />
        <div style={{ position: 'absolute', inset: '2.8cqw', border: `0.2cqw solid ${GOLD}` }} />

        <div style={{
          position: 'absolute', inset: '5cqw 7cqw 4.4cqw', display: 'flex',
          flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}>
          {/* Header */}
          <p style={{ ...fs(1.45), letterSpacing: '0.38em', color: '#047857', fontWeight: 700, margin: 0 }}>
            TURKANA STARTUP CLUB
          </p>
          <h2 style={{ ...fs(4.6), fontWeight: 700, color: '#064e3b', margin: '1cqw 0 0', lineHeight: 1.15 }}>
            {copy.title}
          </h2>
          <div style={{ width: '14cqw', height: '0.2cqw', background: GOLD, margin: '1.2cqw 0' }} />

          {/* Recipient */}
          <p style={{ ...fs(1.55), fontStyle: 'italic', color: '#4b5563', margin: 0 }}>
            This certificate is proudly presented to
          </p>
          <p style={{
            ...fs(5.2), fontStyle: 'italic', fontWeight: 600, color: EMERALD, margin: '1cqw 0 0',
            padding: '0 4cqw 0.4cqw', borderBottom: `0.18cqw solid ${GOLD}`, maxWidth: '80cqw',
            lineHeight: 1.2, overflowWrap: 'anywhere',
          }}>
            {cert.holder}
          </p>

          {/* Citation */}
          <p style={{ ...fs(1.6), color: '#4b5563', margin: '1.4cqw 0 0' }}>{copy.line}</p>
          <p style={{ ...fs(2.7), fontWeight: 700, color: '#111827', margin: '0.5cqw 0 0', maxWidth: '78cqw', lineHeight: 1.25 }}>
            {cert.title}
          </p>
          {cert.description && (
            <p style={{ ...fs(1.35), color: '#6b7280', margin: '0.8cqw 0 0', maxWidth: '70cqw', lineHeight: 1.45 }}>
              {cert.description}
            </p>
          )}
          <p style={{ ...fs(1.4), color: '#6b7280', margin: '1cqw 0 0' }}>
            {cert.event_date ? `Held on ${fmtDate(cert.event_date)} · ` : ''}Issued on {fmtDate(cert.issued_at)}
          </p>

          <div style={{ flex: 1 }} />

          {/* Signatures + seal */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'end',
            width: '100%', gap: '3cqw',
          }}>
            <Signature person={SIGNATORIES[0]} align="start" />
            <Seal style={{ width: '10cqw', height: '10cqw' }} />
            <Signature person={SIGNATORIES[1]} align="end" />
          </div>

          {/* Verification footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.6cqw',
            width: '100%', marginTop: '2cqw', paddingTop: '1.2cqw', borderTop: `0.12cqw solid ${GOLD}`,
          }}>
            <QRCodeSVG value={verifyUrl} size={96} style={{ width: '6.2cqw', height: '6.2cqw' }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ ...fs(1.2), color: '#374151', margin: 0 }}>
                Certificate ID: <strong style={{ fontFamily: 'monospace' }}>{cert.certificate_id}</strong>
              </p>
              <p style={{ ...fs(1.05), color: '#6b7280', margin: '0.3cqw 0 0' }}>
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