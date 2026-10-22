import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'
import { realtimeUrl } from '../services/ws'
import { useAuth } from './AuthContext'

const RealtimeContext = createContext(null)

export function RealtimeProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id

  const [connected, setConnected] = useState(false)
  const [presence, setPresence] = useState({}) // { userId: { online, last_seen } }
  const [now, setNow] = useState(() => Date.now())
  const wsRef = useRef(null)
  const handlers = useRef(new Set())

  const send = useCallback((payload) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload))
      return true
    }
    return false
  }, [])

  const subscribe = useCallback((fn) => {
    handlers.current.add(fn)
    return () => { handlers.current.delete(fn) }
  }, [])

  const loadPresence = useCallback(async () => {
    try {
      const r = await api.get('/presence')
      if (r.data && typeof r.data === 'object') setPresence(r.data)
    } catch {
      /* keep what we have */
    }
  }, [])

  // re-render consumers every 30s so "Last seen 4 min ago" stays accurate
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  // safety net: re-sync the full list every minute while connected
  useEffect(() => {
    if (!connected) return undefined
    const t = setInterval(loadPresence, 60000)
    return () => clearInterval(t)
  }, [connected, loadPresence])

  useEffect(() => {
    if (!userId) return undefined

    let stopped = false
    let retry = 0
    let retryTimer = null
    let heartbeat = null
    let ws = null

    const connect = () => {
      if (stopped || (ws && ws.readyState <= 1)) return
      const token = localStorage.getItem('tsc_access_token')
      if (!token) return

      const mine = new WebSocket(realtimeUrl())
      ws = mine
      wsRef.current = mine

      mine.onopen = () => mine.send(JSON.stringify({ type: 'auth', token }))

      mine.onmessage = (e) => {
        let msg
        try { msg = JSON.parse(e.data) } catch { return }

        if (msg.type === 'ready') {
          retry = 0
          setConnected(true)
          loadPresence()
          heartbeat = setInterval(() => {
            if (mine.readyState === 1) mine.send('{"type":"ping"}')
          }, 25000)
          return
        }
        if (msg.type === 'presence') {
          setPresence((p) => ({
            ...p,
            [msg.user_id]: {
              online: msg.online,
              last_seen: msg.last_seen ?? p[msg.user_id]?.last_seen ?? null,
            },
          }))
        }
        handlers.current.forEach((fn) => fn(msg))
      }

      mine.onclose = async (e) => {
        clearInterval(heartbeat)
        heartbeat = null
        if (wsRef.current === mine) {
          wsRef.current = null
          setConnected(false)
          handlers.current.forEach((fn) => fn({ type: 'socket_closed' }))
        }
        if (stopped) return
        // expired access token: any API call makes api.js refresh it
        if (e.code === 4401) {
          try { await api.get('/auth/me') } catch { /* ignore */ }
        }
        const delay = Math.min(15000, 1000 * 2 ** retry)
        retry += 1
        retryTimer = setTimeout(connect, delay)
      }

      mine.onerror = () => mine.close()
    }

    // phone woke up / network came back: reconnect right away
    const wake = () => {
      if (document.visibilityState === 'visible' && !stopped && (!ws || ws.readyState > 1)) {
        clearTimeout(retryTimer)
        retry = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)

    connect()

    return () => {
      stopped = true
      clearTimeout(retryTimer)
      clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
      wsRef.current = null
      if (ws) ws.close()
      setConnected(false)
    }
  }, [userId, loadPresence])

  const value = useMemo(
    () => ({ connected, presence, now, send, subscribe }),
    [connected, presence, now, send, subscribe],
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export const useRealtime = () => useContext(RealtimeContext)