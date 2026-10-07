import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'

/* ------------------------------------------------------------------ icons */
const ICONS = {
  refresh: (
    <>
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </>
  ),
  x: <path d="M18 6L6 18M6 6l12 12" />,
  thumb: <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  bookmark: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  flag: (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </>
  ),
  send: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
}

function Icon({ name, className = 'h-4 w-4', filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

/* ------------------------------------------------------------------ constants & helpers */
const TYPES = ['post', 'project', 'startup', 'question', 'opportunity']

const TYPE_STYLES = {
  post: 'bg-slate-100 text-slate-700 ring-slate-200',
  project: 'bg-violet-50 text-violet-700 ring-violet-200',
  startup: 'bg-amber-50 text-amber-700 ring-amber-200',
  question: 'bg-sky-50 text-sky-700 ring-sky-200',
  opportunity: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

const REPORT_REASONS = ['Spam', 'Harassment', 'Misleading', 'Inappropriate content', 'Other']

const MAX_CHARS = 500
const PAGE_SIZE = 10
const LONG_POST = 320
const LOAD_SKELETONS = Array.from({ length: 3 })

// Server timestamps may be naive UTC (no "Z"); treat them as UTC so times are correct
const parseDate = (iso) => {
  if (!iso) return null
  const s = /([zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`
  const d = new Date(s)
  return isNaN(d) ? null : d
}

function timeAgo(iso) {
  const d = parseDate(iso)
  if (!d) return ''
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const readLS = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
const writeLS = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ }
}

/* ------------------------------------------------------------------ page */
export default function Community() {
  const { user } = useAuth()
  const { hash } = useLocation()

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // composer (drafts persist across refreshes)
  const [content, setContent] = useState(() => readLS('community:draft:content', ''))
  const [postType, setPostType] = useState(() => readLS('community:draft:type', 'post'))
  const [publishing, setPublishing] = useState(false)

  // interactions
  const [drafts, setDrafts] = useState(() => readLS('community:draft:comments', {}))
  const [openComments, setOpenComments] = useState({})
  const [expanded, setExpanded] = useState({})
  const [sendingId, setSendingId] = useState(null)
  const [saved, setSaved] = useState(() => readLS('community:saved', []))

  // feed controls
  const [activeType, setActiveType] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('newest')
  const [visible, setVisible] = useState(PAGE_SIZE)

  // report dialog + toast
  const [reportFor, setReportFor] = useState(null)
  const [reason, setReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [toast, setToast] = useState(null)

  const searchRef = useRef(null)
  const toastTimer = useRef(null)
  const scrolledToHash = useRef(false)

  useEffect(() => writeLS('community:draft:content', content), [content])
  useEffect(() => writeLS('community:draft:type', postType), [postType])
  useEffect(() => writeLS('community:draft:comments', drafts), [drafts])
  useEffect(() => writeLS('community:saved', saved), [saved])
  useEffect(() => setVisible(PAGE_SIZE), [activeType, query, sort])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const showToast = useCallback((message, kind = 'ok') => {
    clearTimeout(toastTimer.current)
    setToast({ message, kind })
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const r = await api.get('/feed')
      setPosts(Array.isArray(r.data) ? r.data : [])
      setError('')
    } catch {
      setError('Could not load the community feed. Check your connection and try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  // Ctrl/Cmd+K focuses search, Escape closes the report dialog
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') setReportFor(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // open a shared link like /community#post-<id>
  useEffect(() => {
    if (scrolledToHash.current || loading || !hash.startsWith('#post-')) return
    const el = document.getElementById(hash.slice(1))
    if (el) {
      scrolledToHash.current = true
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [hash, loading, posts])

  /* ---- derived */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = posts.filter((p) => {
      if (activeType === 'saved') {
        if (!saved.includes(p.id)) return false
      } else if (activeType !== 'all' && p.post_type !== activeType) {
        return false
      }
      if (!q) return true
      return (p.content || '').toLowerCase().includes(q)
        || (p.author?.name || '').toLowerCase().includes(q)
        || (p.comments || []).some((c) => (c.content || '').toLowerCase().includes(q))
    })
    return [...list].sort((a, b) => {
      if (sort === 'top') return (b.likes || 0) - (a.likes || 0)
      if (sort === 'discussed') return (b.comments?.length || 0) - (a.comments?.length || 0)
      return (parseDate(b.created_at) || 0) - (parseDate(a.created_at) || 0)
    })
  }, [posts, activeType, query, sort, saved])

  const counts = useMemo(() => {
    const c = { all: posts.length, saved: posts.filter((p) => saved.includes(p.id)).length }
    for (const t of TYPES) c[t] = posts.filter((p) => p.post_type === t).length
    return c
  }, [posts, saved])

  const shown = filtered.slice(0, visible)
  const filtering = Boolean(query) || activeType !== 'all'
  const remaining = MAX_CHARS - content.length

  /* ---- actions */
  const publish = async (e) => {
    e?.preventDefault()
    if (!content.trim() || publishing) return
    setPublishing(true)
    try {
      await api.post('/feed', null, { params: { content: content.trim(), post_type: postType } })
      setContent('')
      setActiveType('all')
      setSort('newest')
      await load(true)
      showToast('Your post is live')
    } catch {
      showToast('Your post could not be published. Please try again.', 'error')
    } finally {
      setPublishing(false)
    }
  }

  // Optimistic like: instant UI, rolled back on failure
  const toggleLike = (p) => ({ ...p, liked_by_me: !p.liked_by_me, likes: (p.likes || 0) + (p.liked_by_me ? -1 : 1) })

  const like = async (id) => {
    setPosts((ps) => ps.map((p) => (p.id === id ? toggleLike(p) : p)))
    try {
      const r = await api.post(`/feed/${id}/like`)
      if (r?.data?.likes !== undefined) {
        setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, likes: r.data.likes } : p)))
      }
    } catch {
      setPosts((ps) => ps.map((p) => (p.id === id ? toggleLike(p) : p)))
      showToast('Could not update your like.', 'error')
    }
  }

  const comment = async (id) => {
    const text = (drafts[id] || '').trim()
    if (!text || sendingId === id) return
    setSendingId(id)
    try {
      await api.post(`/feed/${id}/comments`, null, { params: { content: text } })
      setDrafts((d) => ({ ...d, [id]: '' }))
      setOpenComments((o) => ({ ...o, [id]: true }))
      await load(true)
    } catch {
      showToast('Your comment could not be sent.', 'error')
    } finally {
      setSendingId(null)
    }
  }

  const submitReport = async () => {
    if (!reason.trim() || reporting) return
    setReporting(true)
    try {
      await api.post('/feed/report', null, {
        params: { target_type: 'post', target_id: reportFor, reason: reason.trim() },
      })
      setReportFor(null)
      setReason('')
      showToast('Report submitted. Thank you.')
    } catch {
      showToast('Could not submit the report. Please try again.', 'error')
    } finally {
      setReporting(false)
    }
  }

  const toggleSave = (id) => {
    const isSaved = saved.includes(id)
    setSaved((s) => (isSaved ? s.filter((x) => x !== id) : [...s, id]))
    showToast(isSaved ? 'Removed from saved' : 'Saved for later')
  }

  const copyLink = async (id) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/community#post-${id}`)
      showToast('Link copied')
    } catch {
      showToast('Could not copy the link.', 'error')
    }
  }

  const clearFilters = () => { setQuery(''); setActiveType('all') }

  /* ---- render */
  return (
    <div className="max-w-2xl mx-auto pb-16">
      {/* header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Community</h1>
          <p className="text-sm text-gray-500 mt-1">
            {counts.all} {counts.all === 1 ? 'post' : 'posts'} from members
            {refreshing && <span className="ml-2 text-emerald-600">Updating…</span>}
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 transition-colors">
          <Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* composer */}
      <form onSubmit={publish} className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 shadow-sm">
        <div className="flex gap-3">
          <Avatar name={user?.full_name} url={user?.profile?.photo_url} size="w-10 h-10" />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') publish(e) }}
            rows={3}
            placeholder="Share an update, ask a question or post an opportunity…"
            className="flex-1 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Post type">
            {TYPES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={postType === t}
                onClick={() => setPostType(t)}
                className={`text-xs font-medium capitalize px-3 py-1.5 rounded-full ring-1 ring-inset transition-colors ${
                  postType === t
                    ? TYPE_STYLES[t]
                    : 'bg-white text-gray-500 ring-gray-200 hover:ring-gray-300'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs tabular-nums ${remaining < 50 ? 'text-red-500' : 'text-gray-400'}`}>
              {remaining}
            </span>
            <button type="submit" disabled={!content.trim() || publishing}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Icon name="send" className="h-4 w-4" />
              {publishing ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">Tip: press Ctrl + Enter to post. Your draft is saved automatically.</p>
      </form>

      {/* search + sort */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Icon name="search" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts, people, comments…  (Ctrl+K)"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-9 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <Icon name="x" className="h-4 w-4" />
            </button>
          )}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort posts"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="newest">Newest</option>
          <option value="top">Most liked</option>
          <option value="discussed">Most discussed</option>
        </select>
      </div>

      {/* type tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', ...TYPES, 'saved'].map((t) => (
          <button key={t} onClick={() => setActiveType(t)}
            className={`px-3 py-1.5 text-xs font-medium capitalize rounded-full whitespace-nowrap transition-colors ${
              activeType === t
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-700'}`}>
            {t} ({counts[t] || 0})
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span className="flex items-center gap-2"><Icon name="alert" className="h-4 w-4 shrink-0" />{error}</span>
          <button onClick={() => load()} className="font-medium hover:underline shrink-0">Retry</button>
        </div>
      )}

      {/* skeletons */}
      {loading && (
        <div className="space-y-4">
          {LOAD_SKELETONS.map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                  <div className="h-2 bg-gray-100 rounded w-1/6" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-2xl">
          <span className="mx-auto mb-3 h-12 w-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
            <Icon name={filtering ? 'search' : 'inbox'} className="h-6 w-6" />
          </span>
          <p className="text-gray-500 text-sm">
            {activeType === 'saved'
              ? 'You have not saved any posts yet.'
              : filtering
                ? 'No posts match your filters.'
                : 'No posts yet. Be the first to share something.'}
          </p>
          {filtering && (
            <button onClick={clearFilters} className="mt-3 text-sm text-emerald-700 font-medium hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* feed */}
      <div className="space-y-4">
        {shown.map((p) => {
          const open = openComments[p.id] ?? (p.comments?.length > 0)
          const text = p.content || ''
          const isLong = text.length > LONG_POST
          const isExpanded = expanded[p.id]
          const isSaved = saved.includes(p.id)
          const when = parseDate(p.created_at)

          return (
            <article key={p.id} id={`post-${p.id}`}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow scroll-mt-20">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={p.author?.name} url={p.author?.photo_url} size="w-10 h-10" />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 leading-tight truncate">{p.author?.name}</p>
                    <p className="text-xs text-gray-400" title={when ? when.toLocaleString() : ''}>
                      {timeAgo(p.created_at)}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 text-xs font-semibold capitalize px-2.5 py-1 rounded-full ring-1 ring-inset ${TYPE_STYLES[p.post_type] || TYPE_STYLES.post}`}>
                  {p.post_type}
                </span>
              </div>

              <p className="mt-3 text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                {isLong && !isExpanded ? `${text.slice(0, LONG_POST).trimEnd()}…` : text}
              </p>
              {isLong && (
                <button onClick={() => setExpanded((x) => ({ ...x, [p.id]: !isExpanded }))}
                  className="mt-1 text-xs font-medium text-emerald-700 hover:underline">
                  {isExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
              {p.image_url && (
                <img src={p.image_url} alt="" loading="lazy" className="mt-3 rounded-xl max-h-80 w-full object-cover" />
              )}

              {/* actions */}
              <div className="flex items-center gap-1 mt-4 -mx-2 text-sm">
                <button onClick={() => like(p.id)} aria-pressed={Boolean(p.liked_by_me)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                    p.liked_by_me
                      ? 'text-emerald-700 font-semibold bg-emerald-50'
                      : 'text-gray-500 hover:text-emerald-700 hover:bg-gray-50'}`}>
                  <Icon name="thumb" filled={Boolean(p.liked_by_me)} />
                  {p.likes || 0}
                </button>
                <button onClick={() => setOpenComments((o) => ({ ...o, [p.id]: !open }))}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                    open ? 'text-emerald-700 bg-emerald-50' : 'text-gray-500 hover:text-emerald-700 hover:bg-gray-50'}`}>
                  <Icon name="chat" />
                  {p.comments?.length || 0}
                </button>
                <button onClick={() => toggleSave(p.id)} title={isSaved ? 'Remove from saved' : 'Save for later'}
                  aria-pressed={isSaved}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                    isSaved ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:text-amber-600 hover:bg-gray-50'}`}>
                  <Icon name="bookmark" filled={isSaved} />
                </button>
                <button onClick={() => copyLink(p.id)} title="Copy link"
                  className="px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                  <Icon name="link" />
                </button>
                <button onClick={() => { setReportFor(p.id); setReason('') }}
                  className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <Icon name="flag" className="h-3.5 w-3.5" />
                  Report
                </button>
              </div>

              {/* comments */}
              {open && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  {p.comments?.length > 0 && (
                    <div className="space-y-2.5 mb-3">
                      {p.comments.map((c) => (
                        <div key={c.id} className="flex gap-2 text-sm">
                          <Avatar name={c.author} size="w-7 h-7" text="text-xs" />
                          <p className="text-gray-700 bg-slate-50 rounded-xl px-3 py-1.5 break-words min-w-0">
                            <span className="font-semibold text-gray-900">{c.author}</span>{' '}
                            {c.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input value={drafts[p.id] || ''}
                      placeholder="Write a comment…"
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && comment(p.id)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <button onClick={() => comment(p.id)}
                      disabled={!(drafts[p.id] || '').trim() || sendingId === p.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                      <Icon name="send" className="h-4 w-4" />
                      {sendingId === p.id ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {/* pagination */}
      {!loading && filtered.length > visible && (
        <div className="mt-6 text-center">
          <button onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="px-5 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-emerald-400 hover:text-emerald-700 transition-colors">
            Show more ({filtered.length - visible} remaining)
          </button>
        </div>
      )}

      {/* report dialog */}
      {reportFor && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReportFor(null)}>
          <div role="dialog" aria-modal="true" aria-label="Report post"
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Report this post</h2>
                <p className="text-sm text-gray-500 mt-0.5">Tell moderators what is wrong. Reports are reviewed by the team.</p>
              </div>
              <button onClick={() => setReportFor(null)} aria-label="Close"
                className="text-gray-400 hover:text-gray-700">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {REPORT_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r === 'Other' ? '' : r)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    reason === r
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-emerald-400'}`}>
                  {r}
                </button>
              ))}
            </div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))}
              rows={3} placeholder="Add details (required)"
              className="mt-3 w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setReportFor(null)}
                className="px-4 py-2 text-sm rounded-lg border text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={submitReport} disabled={!reason.trim() || reporting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40">
                {reporting ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm text-white ${
            toast.kind === 'error' ? 'bg-red-600' : 'bg-gray-900'}`}>
          <Icon name={toast.kind === 'error' ? 'alert' : 'check'} className="h-4 w-4" />
          {toast.message}
        </div>
      )}
    </div>
  )
}