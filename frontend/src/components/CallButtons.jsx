import { useCalls } from '../context/CallContext'
import CallIcon from './CallIcon'

export default function CallButtons({ userId, name, className = '' }) {
  const { startCall, call } = useCalls()
  const busy = Boolean(call)
  const btn =
    'h-9 w-9 shrink-0 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-emerald-700 ' +
    'hover:bg-emerald-50 hover:border-emerald-300 flex items-center justify-center disabled:opacity-40 transition-colors'

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <button type="button" disabled={busy} className={btn}
        onClick={() => startCall({ id: userId, name }, 'audio')}
        aria-label={`Voice call ${name}`} title="Voice call">
        <CallIcon name="phone" className="h-4 w-4" />
      </button>
      <button type="button" disabled={busy} className={btn}
        onClick={() => startCall({ id: userId, name }, 'video')}
        aria-label={`Video call ${name}`} title="Video call">
        <CallIcon name="video" className="h-4 w-4" />
      </button>
    </span>
  )
}