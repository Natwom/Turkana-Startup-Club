import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''

const TYPE_STYLES = {
  hackathon: 'bg-violet-50 text-violet-700 ring-violet-200',
  event: 'bg-sky-50 text-sky-700 ring-sky-200',
  course: 'bg-amber-50 text-amber-700 ring-amber-200',
  participation: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  award: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const SKELETONS = Array.from({ length: 3 })

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
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: fixed; inset: 0; margin: 0; border-radius: 0; }
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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search certificates or codes…"
              className="w-full border border-gray-200 rounded-lg pl-8 pr-8 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            {query && (
              <button onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
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
          <div className="text-4xl mb-3">🏅</div>
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
              <span className={`self-start text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset capitalize
                ${TYPE_STYLES[c.activity_type] || TYPE_STYLES.participation}`}>
                {c.activity_type}
              </span>
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
                  className={`text-sm px-3 py-2 rounded-lg border transition-colors
                    ${copied === c.certificate_id
                      ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
                      : 'text-gray-600 border-gray-200 hover:border-emerald-400 hover:text-emerald-700'}`}>
                  {copied === c.certificate_id ? 'Copied ✓' : 'Copy link'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {view && (
        <div className="fixed inset-0 z-20 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setView(null)}>
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="print-area bg-white rounded-2xl p-3 shadow-2xl">
              <div className="border-4 border-double border-emerald-700 rounded-xl p-10 text-center bg-gradient-to-b from-white to-emerald-50/40">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-2xl">🏆</div>
                <p className="text-sm tracking-[0.3em] text-emerald-700 font-semibold mt-4">TURKANA STARTUP CLUB</p>
                <h2 className="text-3xl font-bold mt-2 text-gray-900">Certificate</h2>
                <p className="text-gray-500 mt-6 text-sm">This is to certify that</p>
                <p className="text-2xl font-bold mt-2 text-emerald-800">{view.holder}</p>
                <p className="text-gray-500 mt-5 text-sm">has been awarded</p>
                <p className="text-lg font-semibold mt-2 text-gray-900">{view.title}</p>
                <p className="text-gray-500 mt-8 text-sm">Issued on {fmtDate(view.issued_at)}</p>
                <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-500">
                  <p>Certificate ID: <span className="font-mono font-semibold text-gray-700">{view.certificate_id}</span></p>
                  <p className="mt-1">Verify at <span className="font-mono">{verifyUrl(view.certificate_id)}</span></p>
                </div>
              </div>
            </div>
            <div className="no-print mt-4 flex flex-wrap justify-end gap-3">
              <button onClick={() => copy(view.certificate_id)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                {copied === view.certificate_id ? 'Link copied ✓' : 'Copy verify link'}
              </button>
              <button onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                ⎙ Print / Save as PDF
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
