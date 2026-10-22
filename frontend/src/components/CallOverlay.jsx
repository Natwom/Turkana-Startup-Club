import { useEffect, useState } from 'react'
import { useCalls } from '../context/CallContext'
import CallIcon from './CallIcon'

const initials = (name = '?') =>
  name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

// Simple generated ringtone (no audio file needed). Browsers may keep it silent
// until the person has tapped something on the page.
function useRingtone(on, incoming) {
  useEffect(() => {
    if (!on) return undefined
    let ctx
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch {
      return undefined
    }
    let stopped = false
    const beep = () => {
      if (stopped) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = incoming ? 480 : 425
      gain.gain.value = 0.08
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.8)
    }
    if (ctx.resume) ctx.resume().catch(() => {})
    beep()
    const timer = setInterval(beep, 2500)
    if (incoming && navigator.vibrate) navigator.vibrate([400, 200, 400])
    return () => {
      stopped = true
      clearInterval(timer)
      if (navigator.vibrate) navigator.vibrate(0)
      ctx.close().catch(() => {})
    }
  }, [on, incoming])
}

function useElapsed(startedAt) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!startedAt) return undefined
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  if (!startedAt) return ''
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const bindStream = (stream) => (el) => {
  if (el && el.srcObject !== stream) el.srcObject = stream
}

export default function CallOverlay() {
  const { call, notice, localStream, remoteStream, acceptCall, declineCall,
    endCall, toggleMute, toggleCamera } = useCalls()

  const ringing = call?.status === 'ringing'
  useRingtone(Boolean(ringing), call?.direction === 'in')
  const elapsed = useElapsed(call?.startedAt)

  const banner = notice && (
    <div role="status"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] max-w-[calc(100vw-1.5rem)] px-4 py-2.5
        rounded-xl bg-gray-900 text-white text-sm shadow-lg text-center">
      {notice}
    </div>
  )

  if (!call) return banner || null

  const isVideo = call.kind === 'video'
  const incomingRinging = call.direction === 'in' && call.status === 'ringing'
  const showRemoteVideo = isVideo && (call.status === 'connecting' || call.status === 'active') && remoteStream

  const statusText = {
    calling: 'Starting call…',
    ringing: call.direction === 'in' ? `Incoming ${isVideo ? 'video' : 'voice'} call` : 'Ringing…',
    connecting: 'Connecting…',
    active: elapsed || 'Connected',
  }[call.status]

  const round = 'h-14 w-14 rounded-full flex items-center justify-center transition-colors'

  return (
    <>
      {banner}
      <div className="fixed inset-0 z-[60] bg-gray-900 text-white flex flex-col">
        {/* remote audio always plays here; remote video below is muted so sound isn't doubled */}
        <audio autoPlay ref={bindStream(remoteStream)} />

        {showRemoteVideo && (
          <video autoPlay playsInline muted ref={bindStream(remoteStream)}
            className="absolute inset-0 h-full w-full object-cover" />
        )}
        {isVideo && localStream && !call.camOff && (
          <video autoPlay playsInline muted ref={bindStream(localStream)}
            className="absolute top-4 right-4 z-10 h-36 w-24 sm:h-44 sm:w-32 rounded-xl object-cover
              border border-white/30 shadow-lg [transform:scaleX(-1)]" />
        )}

        <div className={`relative flex-1 flex flex-col items-center justify-center px-6 text-center
          ${showRemoteVideo ? 'justify-start pt-10 bg-gradient-to-b from-black/50 to-transparent flex-none' : ''}`}>
          {!showRemoteVideo && (
            <span className="h-28 w-28 rounded-full bg-emerald-600 text-white flex items-center
              justify-center text-4xl font-bold mb-5">
              {initials(call.peerName)}
            </span>
          )}
          <p className="text-xl font-semibold break-words max-w-full">{call.peerName}</p>
          <p className="mt-1 text-sm text-gray-300">{statusText}</p>
        </div>

        {showRemoteVideo && <div className="flex-1" />}

        <div className="relative flex items-center justify-center gap-5 px-6
          pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-4">
          {incomingRinging ? (
            <>
              <button onClick={declineCall} aria-label="Decline call"
                className={`${round} bg-red-600 hover:bg-red-700`}>
                <CallIcon name="phone" className="h-6 w-6 rotate-[135deg]" />
              </button>
              <button onClick={acceptCall} aria-label="Accept call"
                className={`${round} bg-green-500 hover:bg-green-600`}>
                <CallIcon name={isVideo ? 'video' : 'phone'} className="h-6 w-6" />
              </button>
            </>
          ) : (
            <>
              <button onClick={toggleMute} aria-label={call.muted ? 'Unmute' : 'Mute'}
                className={`${round} ${call.muted ? 'bg-white text-gray-900' : 'bg-white/15 hover:bg-white/25'}`}>
                <CallIcon name={call.muted ? 'micOff' : 'mic'} className="h-6 w-6" />
              </button>
              {isVideo && (
                <button onClick={toggleCamera} aria-label={call.camOff ? 'Turn camera on' : 'Turn camera off'}
                  className={`${round} ${call.camOff ? 'bg-white text-gray-900' : 'bg-white/15 hover:bg-white/25'}`}>
                  <CallIcon name={call.camOff ? 'videoOff' : 'video'} className="h-6 w-6" />
                </button>
              )}
              <button onClick={endCall} aria-label="End call"
                className={`${round} bg-red-600 hover:bg-red-700`}>
                <CallIcon name="phone" className="h-6 w-6 rotate-[135deg]" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}