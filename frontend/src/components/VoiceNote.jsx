import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CallIcon from './CallIcon'
import { formatDuration } from './chatUtils'

export const MAX_VOICE_SECONDS = 300 // keep in sync with the backend (5 minutes)

export const micErrorText = (err) => {
  if (err?.name === 'NotAllowedError') {
    return 'Allow microphone access in your browser settings to record voice messages.'
  }
  if (err?.name === 'NotFoundError') return 'No microphone found on this device.'
  if (err?.message === 'unsupported') {
    return 'Voice messages need a secure (https) connection and a browser that can record audio.'
  }
  return 'Could not start recording.'
}

// Chrome/Android -> webm, Safari/iOS -> mp4, Firefox -> ogg
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
const pickMime = () => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

export const extensionFor = (type = '') => {
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'm4a'
  if (type.includes('ogg')) return 'ogg'
  return 'webm'
}

/* ------------------------------------------------------------------ recorder */
export function useVoiceRecorder() {
  const [state, setState] = useState('idle') // 'idle' | 'recording'
  const [seconds, setSeconds] = useState(0)

  const recRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const startedRef = useRef(0)
  const startingRef = useRef(false)

  const supported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)

  const reset = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recRef.current = null
    chunksRef.current = []
    setState('idle')
    setSeconds(0)
  }, [])

  const start = useCallback(async () => {
    if (!supported) throw new Error('unsupported')
    if (recRef.current || startingRef.current) return
    startingRef.current = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      const mimeType = pickMime()
      let rec
      try {
        rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      } catch (err) {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        throw err
      }
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recRef.current = rec
      rec.start(250)
      startedRef.current = Date.now()
      setSeconds(0)
      setState('recording')
      timerRef.current = setInterval(
        () => setSeconds(Math.floor((Date.now() - startedRef.current) / 1000)),
        250,
      )
    } finally {
      startingRef.current = false
    }
  }, [supported])

  // Stops and resolves { blob, duration, ms }, or null if nothing was recorded.
  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const rec = recRef.current
        if (!rec) {
          resolve(null)
          return
        }
        const ms = Date.now() - startedRef.current
        const type = rec.mimeType || 'audio/webm'
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type })
          reset()
          resolve(blob.size > 0 ? { blob, duration: Math.max(1, Math.round(ms / 1000)), ms } : null)
        }
        try {
          if (rec.state === 'inactive') rec.onstop()
          else rec.stop()
        } catch {
          reset()
          resolve(null)
        }
      }),
    [reset],
  )

  const cancel = useCallback(() => {
    const rec = recRef.current
    if (rec) {
      rec.ondataavailable = null
      rec.onstop = null
      try {
        if (rec.state !== 'inactive') rec.stop()
      } catch {
        /* ignore */
      }
    }
    reset()
  }, [reset])

  // release the microphone if the chat is closed mid-recording
  useEffect(() => () => cancel(), [cancel])

  return { state, seconds, supported, start, stop, cancel }
}

/* ------------------------------------------------------------------ player */
// Looks like a waveform, derived from the file name so it is stable between renders.
const barsFor = (seed = '', n = 28) => {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  if (h === 0) h = 1
  const out = []
  for (let i = 0; i < n; i += 1) {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    out.push(25 + (Math.abs(h) % 75))
  }
  return out
}

export function VoicePlayer({ src, duration = 0, mine = false }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [rate, setRate] = useState(1)
  const [failed, setFailed] = useState(false)

  const bars = useMemo(() => barsFor(src), [src])
  const total = duration > 0 ? duration : 0
  const ratio = total ? Math.min(1, current / total) : 0

  // only one voice note plays at a time
  useEffect(() => {
    const onOther = (e) => {
      if (e.detail !== audioRef.current) audioRef.current?.pause()
    }
    window.addEventListener('tsc:voice-play', onOther)
    return () => window.removeEventListener('tsc:voice-play', onOther)
  }, [])

  const toggle = async () => {
    const a = audioRef.current
    if (!a) return
    if (!a.paused) {
      a.pause()
      return
    }
    try {
      setFailed(false)
      await a.play()
    } catch {
      setFailed(true)
    }
  }

  const seek = (e) => {
    const a = audioRef.current
    if (!a || !total) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    try {
      a.currentTime = pct * total
      setCurrent(a.currentTime)
    } catch {
      /* some browsers cannot seek a fresh recording; ignore */
    }
  }

  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1
    setRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const playBtn = mine ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'
  const barOn = mine ? 'bg-white' : 'bg-emerald-600'
  const barOff = mine ? 'bg-white/40' : 'bg-gray-300'
  const meta = mine ? 'text-emerald-100' : 'text-gray-500'

  return (
    <div className="flex items-center gap-2.5">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => {
          setPlaying(true)
          if (audioRef.current) audioRef.current.playbackRate = rate
          window.dispatchEvent(new CustomEvent('tsc:voice-play', { detail: audioRef.current }))
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrent(0)
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onError={() => setFailed(true)}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${playBtn}`}
      >
        <CallIcon name={playing ? 'pause' : 'play'} className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div
          onClick={seek}
          className="flex items-center gap-[2px] h-7 cursor-pointer select-none"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(current)}
        >
          {bars.map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}%` }}
              className={`flex-1 rounded-full ${i / bars.length < ratio ? barOn : barOff}`}
            />
          ))}
        </div>
        <p className={`text-[10px] mt-0.5 tabular-nums ${meta}`}>
          {failed ? 'Cannot play this message' : formatDuration(playing || current > 0 ? current : total)}
        </p>
      </div>

      <button
        type="button"
        onClick={cycleRate}
        aria-label="Playback speed"
        className={`shrink-0 text-[10px] font-semibold rounded-full px-2 py-1 border
          ${mine ? 'border-white/40 text-white' : 'border-gray-200 text-gray-600'}`}
      >
        {rate}x
      </button>
    </div>
  )
}