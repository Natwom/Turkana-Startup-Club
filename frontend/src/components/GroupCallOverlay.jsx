import { useEffect, useMemo, useRef, useState } from 'react'
import { useCalls } from '../context/CallContext'
import CallIcon from './CallIcon'
import { initials } from './chatUtils'

/* One shared AudioContext for all the "who is speaking" meters (browsers limit how many exist). */
let sharedCtx = null
const getAudioCtx = () => {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new Ctx()
  if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {})
  return sharedCtx
}

function useSpeaking(stream, enabled = true) {
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!stream || !enabled || stream.getAudioTracks().length === 0) {
      setSpeaking(false)
      return undefined
    }
    const ctx = getAudioCtx()
    if (!ctx) return undefined

    let source
    let analyser
    try {
      source = ctx.createMediaStreamSource(stream)
      analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
    } catch {
      return undefined
    }

    const data = new Uint8Array(analyser.frequencyBinCount)
    let raf = 0
    let last = false
    const tick = () => {
      analyser.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i += 1) sum += data[i]
      const on = sum / data.length > 18
      if (on !== last) {
        last = on
        setSpeaking(on)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      try { source.disconnect() } catch { /* ignore */ }
      setSpeaking(false)
    }
  }, [stream, enabled])

  return speaking
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

// plays one remote person's voice
function RemoteAudio({ stream }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay />
}

function Tile({ name, you, muted, hand, stream, conn }) {
  const speaking = useSpeaking(stream, !muted)

  let status = ''
  if (!you) {
    if (conn === 'failed') status = 'Connection problem'
    else if (conn === 'disconnected') status = 'Reconnecting…'
    else if (conn !== 'connected') status = 'Connecting…'
  }

  return (
    <div className="relative flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 p-4 min-h-[150px]">
      <span
        className={`relative h-20 w-20 rounded-full bg-emerald-600 text-white flex items-center justify-center
          text-2xl font-bold transition-shadow duration-150
          ${speaking ? 'ring-4 ring-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.6)]' : 'ring-2 ring-white/10'}`}
      >
        {initials(name)}
        {hand && <span className="absolute -top-2 -right-2 text-2xl" aria-label="Hand raised">✋</span>}
      </span>
      <p className="text-sm font-medium truncate max-w-full">
        {name}{you ? ' (you)' : ''}
      </p>
      <p className="text-xs text-gray-400 flex items-center gap-1 min-h-[1rem]">
        {muted && <CallIcon name="micOff" className="h-3.5 w-3.5" />}
        {muted ? 'Muted' : status}
      </p>
    </div>
  )
}

export default function GroupCallOverlay() {
  const {
    call, groupCall, peerStreams, localStream, groupInvite,
    joinGroupCall, dismissGroupInvite, leaveGroupCall, toggleGroupMute, toggleGroupHand,
  } = useCalls()

  const [minimized, setMinimized] = useState(false)
  const elapsed = useElapsed(groupCall?.startedAt)

  useEffect(() => {
    if (!groupCall) setMinimized(false)
  }, [groupCall])

  // everyone else in the call; raised hands first, in the order they were raised
  const people = useMemo(() => {
    if (!groupCall) return []
    const list = Object.entries(groupCall.participants).map(([id, p]) => ({
      id, ...p, stream: peerStreams[id],
    }))
    list.sort((a, b) =>
      (b.hand ? 1 : 0) - (a.hand ? 1 : 0) || (a.hand_at || 0) - (b.hand_at || 0))
    return list
  }, [groupCall, peerStreams])

  const invite = groupInvite && !call && !groupCall && (
    <div
      role="alert"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[65] w-[calc(100vw-1.5rem)] max-w-md rounded-2xl
        bg-gray-900 text-white shadow-xl p-3 flex items-center gap-3"
    >
      <span className="h-10 w-10 shrink-0 rounded-full bg-emerald-600 flex items-center justify-center">
        <CallIcon name="phone" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{groupInvite.groupName}</p>
        <p className="text-xs text-gray-300 truncate">{groupInvite.by} started a voice call</p>
      </div>
      <button onClick={dismissGroupInvite}
        className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20">
        Dismiss
      </button>
      <button onClick={() => joinGroupCall(groupInvite.groupId, groupInvite.groupName)}
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-500 hover:bg-green-600">
        Join
      </button>
    </div>
  )

  if (!groupCall) return invite || null

  const joining = groupCall.status === 'joining'
  const count = 1 + people.length
  const raisedNames = [
    ...(groupCall.handRaised ? ['You'] : []),
    ...people.filter((p) => p.hand).map((p) => p.name),
  ]

  // every remote voice keeps playing, whether the call screen is open or minimized
  const audios = (
    <div className="hidden">
      {people.map((p) => (p.stream ? <RemoteAudio key={p.id} stream={p.stream} /> : null))}
    </div>
  )

  const round = 'h-14 w-14 rounded-full flex items-center justify-center transition-colors'
  const small = 'h-9 w-9 rounded-full flex items-center justify-center transition-colors'

  if (minimized) {
    return (
      <>
        {audios}
        <div className="fixed top-0 inset-x-0 z-[60] bg-emerald-700 text-white px-3 pb-2 flex items-center gap-2
          shadow-lg pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button onClick={() => setMinimized(false)} className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold truncate">{groupCall.groupName}</p>
            <p className="text-xs text-emerald-100 truncate">
              {count} in call · {elapsed || 'Connecting…'} · tap to open
            </p>
          </button>
          <button onClick={toggleGroupMute} aria-label={groupCall.muted ? 'Unmute' : 'Mute'}
            className={`${small} ${groupCall.muted ? 'bg-white text-gray-900' : 'bg-white/20 hover:bg-white/30'}`}>
            <CallIcon name={groupCall.muted ? 'micOff' : 'mic'} className="h-4 w-4" />
          </button>
          <button onClick={toggleGroupHand} aria-label={groupCall.handRaised ? 'Lower hand' : 'Raise hand'}
            className={`${small} ${groupCall.handRaised ? 'bg-amber-400' : 'bg-white/20 hover:bg-white/30'}`}>
            ✋
          </button>
          <button onClick={leaveGroupCall} aria-label="Leave call"
            className={`${small} bg-red-600 hover:bg-red-700`}>
            <CallIcon name="phone" className="h-4 w-4 rotate-[135deg]" />
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {invite}
      {audios}
      <div className="fixed inset-0 z-[60] bg-gray-900 text-white flex flex-col">
        <div className="flex items-center gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold truncate">{groupCall.groupName}</p>
            <p className="text-xs text-gray-400">
              {joining ? 'Joining…' : `${count} in call · ${elapsed || '00:00'}`}
            </p>
          </div>
          <button onClick={() => setMinimized(true)} aria-label="Minimize call"
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <CallIcon name="chevronDown" className="h-5 w-5" />
          </button>
        </div>

        {raisedNames.length > 0 && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-amber-400/15 border border-amber-400/30 text-sm text-amber-200">
            ✋ {raisedNames.join(', ')}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Tile
              name="You"
              you
              muted={groupCall.muted}
              hand={groupCall.handRaised}
              stream={localStream}
            />
            {people.map((p) => (
              <Tile
                key={p.id}
                name={p.name}
                muted={p.muted}
                hand={p.hand}
                stream={p.stream}
                conn={p.conn}
              />
            ))}
          </div>
          {!joining && people.length === 0 && (
            <p className="text-center text-sm text-gray-400 mt-8">
              Waiting for others to join…
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-5 px-6 pt-3
          pb-[max(1.75rem,env(safe-area-inset-bottom))]">
          <button onClick={toggleGroupMute} disabled={joining}
            aria-label={groupCall.muted ? 'Unmute' : 'Mute'}
            className={`${round} disabled:opacity-40 ${groupCall.muted ? 'bg-white text-gray-900' : 'bg-white/15 hover:bg-white/25'}`}>
            <CallIcon name={groupCall.muted ? 'micOff' : 'mic'} className="h-6 w-6" />
          </button>
          <button onClick={toggleGroupHand} disabled={joining}
            aria-label={groupCall.handRaised ? 'Lower hand' : 'Raise hand'}
            className={`${round} text-2xl disabled:opacity-40 ${groupCall.handRaised ? 'bg-amber-400 text-gray-900' : 'bg-white/15 hover:bg-white/25'}`}>
            ✋
          </button>
          <button onClick={leaveGroupCall} aria-label="Leave call"
            className={`${round} bg-red-600 hover:bg-red-700`}>
            <CallIcon name="phone" className="h-6 w-6 rotate-[135deg]" />
          </button>
        </div>
      </div>
    </>
  )
}