import { useRealtime } from '../context/RealtimeContext'

export function lastSeenLabel(iso) {
  if (!iso) return 'Offline'
  const d = new Date(iso)
  if (isNaN(d)) return 'Offline'

  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (secs < 60) return 'Last seen just now'
  if (secs < 3600) return `Last seen ${Math.floor(secs / 60)} min ago`

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return `Last seen today at ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Last seen yesterday at ${time}`
  if (secs < 7 * 86400) {
    return `Last seen ${d.toLocaleDateString([], { weekday: 'long' })} at ${time}`
  }
  return `Last seen ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}`
}

export function useStatus(userId) {
  const rt = useRealtime()
  const p = rt?.presence?.[userId]
  const online = Boolean(p?.online)
  return { online, label: online ? 'Online' : lastSeenLabel(p?.last_seen) }
}

// Small dot for the corner of an avatar. The avatar's wrapper must be `relative`.
export function OnlineDot({ userId, className = '' }) {
  const { online, label } = useStatus(userId)
  return (
    <span
      title={label}
      className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white
        ${online ? 'bg-green-500' : 'bg-gray-300'} ${className}`}
    />
  )
}

// "Online" in green, or "Last seen 5 min ago" in grey.
export function StatusText({ userId, className = '' }) {
  const { online, label } = useStatus(userId)
  return (
    <span className={`${online ? 'text-green-600 font-medium' : 'text-gray-400'} ${className}`}>
      {label}
    </span>
  )
}