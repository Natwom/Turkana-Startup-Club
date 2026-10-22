import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'
import { useRealtime } from './RealtimeContext'

const CallContext = createContext(null)
const FALLBACK_ICE = [{ urls: 'stun:stun.l.google.com:19302' }]

const mediaErrorText = (err) => {
  if (err?.name === 'NotAllowedError') {
    return 'Allow microphone (and camera) access in your browser settings to make calls.'
  }
  if (err?.name === 'NotFoundError') return 'No microphone or camera found on this device.'
  if (err?.message === 'unsupported') {
    return 'Calls need a secure (https) connection and a browser that supports them.'
  }
  return 'Could not access your microphone or camera.'
}

const stopStream = (s) => s?.getTracks().forEach((t) => t.stop())

export function CallProvider({ children }) {
  const { send, subscribe, connected } = useRealtime()

  const [call, setCall] = useState(null)
  const [notice, setNotice] = useState('')
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)

  const callRef = useRef(null)          // always-current copy of `call` for event handlers
  const pcRef = useRef(null)
  const localRef = useRef(null)
  const queuedCandidates = useRef([])
  const iceRef = useRef(null)
  const noticeTimer = useRef(null)
  const signalChain = useRef(Promise.resolve())
  const live = useRef({})               // latest versions of the functions below

  const setCurrent = (next) => {
    callRef.current = next
    setCall(next)
  }

  const flash = (message) => {
    setNotice(message)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 4500)
  }

  const releaseMedia = () => {
    stopStream(localRef.current)
    localRef.current = null
    setLocalStream(null)
  }

  const cleanup = () => {
    const pc = pcRef.current
    pcRef.current = null
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.close()
    }
    releaseMedia()
    queuedCandidates.current = []
    setRemoteStream(null)
    setCurrent(null)
  }

  const terminate = (message, tellServer) => {
    const c = callRef.current
    if (tellServer && c?.id) send({ type: 'call_end', call_id: c.id })
    cleanup()
    if (message) flash(message)
  }

  const loadIce = async () => {
    if (iceRef.current) return iceRef.current
    try {
      const r = await api.get('/calls/ice')
      iceRef.current = r.data.iceServers?.length ? r.data.iceServers : FALLBACK_ICE
    } catch {
      iceRef.current = FALLBACK_ICE
    }
    return iceRef.current
  }

  const captureMedia = async (kind) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      throw new Error('unsupported')
    }
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: kind === 'video'
        ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        : false,
    })
  }

  const adoptStream = (stream) => {
    localRef.current = stream
    setLocalStream(stream)
  }

  const createPeer = async (callId, stream) => {
    const iceServers = await loadIce()
    const pc = new RTCPeerConnection({ iceServers })
    pcRef.current = pc
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))

    pc.ontrack = (e) => setRemoteStream(e.streams[0] || new MediaStream([e.track]))

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send({ type: 'signal', call_id: callId, data: { candidate: e.candidate.toJSON() } })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc || !callRef.current) return
      const st = pc.connectionState
      if (st === 'connected') {
        setCurrent({
          ...callRef.current,
          status: 'active',
          startedAt: callRef.current.startedAt || Date.now(),
        })
      } else if (st === 'failed') {
        terminate('The call failed. Check your connection and try again.', true)
      } else if (st === 'disconnected') {
        setTimeout(() => {
          if (pcRef.current === pc && pc.connectionState !== 'connected') {
            terminate('Connection lost. The call ended.', true)
          }
        }, 10000)
      }
    }
    return pc
  }

  /* ---------------------------------------------------------------- actions */
  const startCall = async (peer, kind) => {
    if (callRef.current) { flash('You are already in a call.'); return }
    if (!connected) { flash('You are offline. Reconnecting…'); return }

    setCurrent({
      id: null, peerId: peer.id, peerName: peer.name, kind,
      direction: 'out', status: 'calling', muted: false, camOff: false, startedAt: null,
    })
    try {
      const stream = await captureMedia(kind)
      if (!callRef.current) { stopStream(stream); return } // cancelled while the permission prompt was open
      adoptStream(stream)
    } catch (err) {
      cleanup()
      flash(mediaErrorText(err))
      return
    }
    if (!send({ type: 'call_invite', to: peer.id, kind })) {
      cleanup()
      flash('Could not reach the server. Please try again.')
    }
  }

  const acceptCall = async () => {
    const c = callRef.current
    if (!c || c.direction !== 'in' || c.status !== 'ringing') return
    setCurrent({ ...c, status: 'connecting' })
    try {
      const stream = await captureMedia(c.kind)
      if (callRef.current?.id !== c.id) { stopStream(stream); return } // caller hung up meanwhile
      adoptStream(stream)
      await createPeer(c.id, stream) // ready for the offer BEFORE we tell the caller we accepted
      send({ type: 'call_accept', call_id: c.id })
    } catch (err) {
      send({ type: 'call_decline', call_id: c.id })
      cleanup()
      flash(mediaErrorText(err))
    }
  }

  const endCall = () => {
    const c = callRef.current
    if (!c) return
    if (c.id) {
      const type = c.status === 'ringing'
        ? (c.direction === 'out' ? 'call_cancel' : 'call_decline')
        : 'call_end'
      send({ type, call_id: c.id })
    }
    cleanup()
  }

  const toggleMute = () => {
    const c = callRef.current
    if (!c || !localRef.current) return
    const muted = !c.muted
    localRef.current.getAudioTracks().forEach((t) => { t.enabled = !muted })
    setCurrent({ ...c, muted })
  }

  const toggleCamera = () => {
    const c = callRef.current
    if (!c || !localRef.current) return
    const camOff = !c.camOff
    localRef.current.getVideoTracks().forEach((t) => { t.enabled = !camOff })
    setCurrent({ ...c, camOff })
  }

  /* ---------------------------------------------------------------- signaling */
  const startOffer = async (callId) => {
    try {
      const pc = await createPeer(callId, localRef.current)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      send({
        type: 'signal', call_id: callId,
        data: { description: { type: offer.type, sdp: offer.sdp } },
      })
    } catch {
      terminate('Could not connect the call.', true)
    }
  }

  const handleSignal = async (data) => {
    const pc = pcRef.current
    const c = callRef.current
    if (!pc || !c) return

    if (data.description) {
      await pc.setRemoteDescription(data.description)
      for (const cand of queuedCandidates.current.splice(0)) {
        await pc.addIceCandidate(cand).catch(() => {})
      }
      if (data.description.type === 'offer') {
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        send({
          type: 'signal', call_id: c.id,
          data: { description: { type: answer.type, sdp: answer.sdp } },
        })
      }
    } else if (data.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {})
      else queuedCandidates.current.push(data.candidate)
    }
  }

  const onMessage = async (msg) => {
    const c = callRef.current

    switch (msg.type) {
      case 'call_ringing':
        if (c && c.direction === 'out' && !c.id) setCurrent({ ...c, id: msg.call_id, status: 'ringing' })
        break

      case 'call_failed': {
        const name = c?.peerName || 'This member'
        const reasons = {
          offline: `${name} is offline right now. They will see a missed call.`,
          busy: `${name} is on another call.`,
          busy_self: 'You are already in a call.',
          not_allowed: 'You can only call your connections.',
        }
        cleanup()
        flash(reasons[msg.reason] || 'The call could not be started.')
        break
      }

      case 'call_incoming':
        if (c) { send({ type: 'call_decline', call_id: msg.call_id }); break }
        setCurrent({
          id: msg.call_id, peerId: msg.from, peerName: msg.from_name, kind: msg.kind,
          direction: 'in', status: 'ringing', muted: false, camOff: false, startedAt: null,
        })
        break

      case 'call_accepted':
        if (c && c.id === msg.call_id && c.direction === 'out') {
          setCurrent({ ...c, status: 'connecting' })
          await startOffer(c.id)
        }
        break

      case 'signal':
        if (c && c.id === msg.call_id) {
          // handle one at a time, in order
          signalChain.current = signalChain.current
            .then(() => handleSignal(msg.data || {}))
            .catch(() => {})
        }
        break

      case 'call_declined':
        if (c && c.id === msg.call_id) { cleanup(); flash(`${c.peerName} declined the call.`) }
        break

      case 'call_unanswered':
        if (c && c.id === msg.call_id) { cleanup(); flash(`${c.peerName} did not answer.`) }
        break

      case 'call_cancelled':
        if (c && c.id === msg.call_id) { cleanup(); flash(`Missed call from ${c.peerName}.`) }
        break

      case 'call_ended':
        if (c && c.id === msg.call_id) { cleanup(); flash('Call ended.') }
        break

      case 'call_handled': // answered or declined on another device of mine
        if (c && c.id === msg.call_id && c.status === 'ringing') cleanup()
        break

      case 'socket_closed':
        if (c) { cleanup(); flash('Connection lost. The call ended.') }
        break

      default:
        break
    }
  }

  // keep the latest closures reachable from stable callbacks
  live.current = { onMessage, startCall, acceptCall, endCall, toggleMute, toggleCamera }

  useEffect(() => subscribe((msg) => { live.current.onMessage(msg) }), [subscribe])

  useEffect(() => () => {
    clearTimeout(noticeTimer.current)
    if (pcRef.current) pcRef.current.close()
    stopStream(localRef.current)
  }, [])

  const value = useMemo(() => ({
    call, notice, localStream, remoteStream,
    startCall: (...a) => live.current.startCall(...a),
    acceptCall: () => live.current.acceptCall(),
    declineCall: () => live.current.endCall(),
    endCall: () => live.current.endCall(),
    toggleMute: () => live.current.toggleMute(),
    toggleCamera: () => live.current.toggleCamera(),
  }), [call, notice, localStream, remoteStream])

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export const useCalls = () => useContext(CallContext)