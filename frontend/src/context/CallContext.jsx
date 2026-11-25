import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'
import { AUDIO_CONSTRAINTS, getCleanMic } from '../services/voiceInput'
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

// Voice tuning for the Opus codec, written into the call setup (SDP):
// silence suppression (DTX), error correction, mono, and a voice-sized bitrate.
const tuneOpus = (sdp) => {
  const m = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i)
  if (!m) return sdp
  const pt = m[1]
  const wanted = {
    minptime: '10',
    useinbandfec: '1',
    usedtx: '1',
    stereo: '0',
    'sprop-stereo': '0',
    maxaveragebitrate: '40000',
    cbr: '0',
  }
  const re = new RegExp(`^a=fmtp:${pt} (.*)$`, 'm')
  const found = sdp.match(re)
  if (found) {
    const params = new Map()
    found[1].split(';').map((s) => s.trim()).filter(Boolean).forEach((p) => {
      const [k, ...v] = p.split('=')
      params.set(k, v.join('='))
    })
    Object.entries(wanted).forEach(([k, v]) => params.set(k, v))
    const line = `a=fmtp:${pt} ${[...params].map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join(';')}`
    return sdp.replace(re, line)
  }
  const added = Object.entries(wanted).map(([k, v]) => `${k}=${v}`).join(';')
  return sdp.replace(m[0], `${m[0]}\r\na=fmtp:${pt} ${added}`)
}

export function CallProvider({ children }) {
  const { send, subscribe, connected } = useRealtime()

  /* ---------------------------------------------------------------- 1:1 call state */
  const [call, setCall] = useState(null)
  const [notice, setNotice] = useState('')
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)

  /* ---------------------------------------------------------------- group call state */
  const [groupCall, setGroupCall] = useState(null)           // the call I am in (or joining)
  const [peerStreams, setPeerStreams] = useState({})         // userId -> MediaStream
  const [activeGroupCalls, setActiveGroupCalls] = useState({}) // groupId -> { groupName, count }
  const [groupInvite, setGroupInvite] = useState(null)       // pop-up: someone started a call

  const callRef = useRef(null)          // always-current copy of `call` for event handlers
  const gcRef = useRef(null)            // always-current copy of `groupCall`
  const pcRef = useRef(null)
  const localRef = useRef(null)
  const voiceRef = useRef(null)         // the cleaned-up microphone (group calls)
  const tipShown = useRef(false)
  const queuedCandidates = useRef([])
  const iceRef = useRef(null)
  const noticeTimer = useRef(null)
  const signalChain = useRef(Promise.resolve())
  const gPeers = useRef({})             // userId -> { pc, queued: [] }
  const gEarly = useRef({})             // candidates that arrived before their offer
  const gSignalChain = useRef(Promise.resolve())
  const live = useRef({})               // latest versions of the functions below

  const setCurrent = (next) => {
    callRef.current = next
    setCall(next)
  }

  const setGroup = (next) => {
    gcRef.current = next
    setGroupCall(next)
  }

  const flash = (message) => {
    setNotice(message)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 4500)
  }

  const releaseMedia = () => {
    voiceRef.current?.close()
    voiceRef.current = null
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
    if (!gcRef.current) releaseMedia() // never cut the microphone of a group call
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
      audio: AUDIO_CONSTRAINTS,
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

  /* ---------------------------------------------------------------- 1:1 actions */
  const startCall = async (peer, kind) => {
    if (callRef.current) { flash('You are already in a call.'); return }
    if (gcRef.current) { flash('Leave the group call first.'); return }
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

  /* ---------------------------------------------------------------- 1:1 signaling */
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

  /* ---------------------------------------------------------------- group call: peers */
  const patchParticipant = (userId, patch) => {
    const g = gcRef.current
    if (!g) return
    setGroup({
      ...g,
      participants: {
        ...g.participants,
        [userId]: { ...(g.participants[userId] || {}), ...patch },
      },
    })
  }

  const dropParticipant = (userId) => {
    const g = gcRef.current
    if (!g) return
    const next = { ...g.participants }
    delete next[userId]
    setGroup({ ...g, participants: next })
  }

  const removeGroupPeer = (userId) => {
    const entry = gPeers.current[userId]
    delete gPeers.current[userId]
    delete gEarly.current[userId]
    if (entry) {
      entry.pc.onicecandidate = null
      entry.pc.ontrack = null
      entry.pc.onconnectionstatechange = null
      entry.pc.close()
    }
    setPeerStreams((s) => {
      if (!(userId in s)) return s
      const next = { ...s }
      delete next[userId]
      return next
    })
  }

  const cleanupGroup = () => {
    Object.keys(gPeers.current).forEach((id) => removeGroupPeer(id))
    gPeers.current = {}
    gEarly.current = {}
    setPeerStreams({})
    if (!callRef.current) releaseMedia()
    setGroup(null)
  }

  const createGroupPeer = async (userId) => {
    const g = gcRef.current
    if (!g) return null
    if (gPeers.current[userId]) return gPeers.current[userId].pc

    const iceServers = await loadIce()
    // the call may have ended, or the peer been created, while we waited for the ICE list
    if (!gcRef.current || gcRef.current.groupId !== g.groupId) return null
    if (gPeers.current[userId]) return gPeers.current[userId].pc

    const pc = new RTCPeerConnection({ iceServers })
    gPeers.current[userId] = { pc, queued: [] }
    const local = localRef.current
    if (local) local.getTracks().forEach((t) => pc.addTrack(t, local))

    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track])
      setPeerStreams((s) => ({ ...s, [userId]: stream }))
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send({
          type: 'gcall_signal', group_id: g.groupId, to: userId,
          data: { candidate: e.candidate.toJSON() },
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (gPeers.current[userId]?.pc !== pc) return
      patchParticipant(userId, { conn: pc.connectionState })
    }
    return pc
  }

  // I just joined: send an offer to someone who was already in the call.
  const callGroupPeer = async (userId) => {
    const g = gcRef.current
    if (!g) return
    const pc = await createGroupPeer(userId)
    if (!pc) return
    try {
      const offer = await pc.createOffer()
      const sdp = tuneOpus(offer.sdp)
      await pc.setLocalDescription({ type: offer.type, sdp })
      send({
        type: 'gcall_signal', group_id: g.groupId, to: userId,
        data: { description: { type: offer.type, sdp } },
      })
    } catch {
      removeGroupPeer(userId)
    }
  }

  const handleGroupSignal = async (from, data) => {
    const g = gcRef.current
    if (!g) return

    let entry = gPeers.current[from]
    if (!entry) {
      // a connection is only created when an offer arrives; hold early candidates until then
      if (data.description?.type !== 'offer') {
        if (data.candidate) {
          if (!gEarly.current[from]) gEarly.current[from] = []
          gEarly.current[from].push(data.candidate)
        }
        return
      }
      await createGroupPeer(from)
      entry = gPeers.current[from]
      if (!entry) return
      entry.queued = gEarly.current[from] || []
      delete gEarly.current[from]
    }

    const { pc } = entry
    if (data.description) {
      await pc.setRemoteDescription(data.description)
      for (const cand of entry.queued.splice(0)) {
        await pc.addIceCandidate(cand).catch(() => {})
      }
      if (data.description.type === 'offer') {
        const answer = await pc.createAnswer()
        const sdp = tuneOpus(answer.sdp)
        await pc.setLocalDescription({ type: answer.type, sdp })
        send({
          type: 'gcall_signal', group_id: g.groupId, to: from,
          data: { description: { type: answer.type, sdp } },
        })
      }
    } else if (data.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {})
      else entry.queued.push(data.candidate)
    }
  }

  /* ---------------------------------------------------------------- group call: actions */
  const joinGroupCall = async (groupId, groupName) => {
    if (gcRef.current) { flash('You are already in a group call.'); return }
    if (callRef.current) { flash('Finish your current call first.'); return }
    if (!connected) { flash('You are offline. Reconnecting…'); return }

    setGroupInvite(null)
    setGroup({
      groupId, groupName, status: 'joining', muted: false, handRaised: false,
      startedAt: null, participants: {},
    })
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
        throw new Error('unsupported')
      }
      const mic = await getCleanMic() // echo cancellation + noise suppression + noise gate
      if (gcRef.current?.groupId !== groupId) { mic.close(); return } // cancelled meanwhile
      voiceRef.current = mic
      adoptStream(mic.stream)
    } catch (err) {
      cleanupGroup()
      flash(mediaErrorText(err))
      return
    }
    if (!send({ type: 'gcall_join', group_id: groupId })) {
      cleanupGroup()
      flash('Could not reach the server. Please try again.')
    }
  }

  const leaveGroupCall = () => {
    const g = gcRef.current
    if (!g) return
    send({ type: 'gcall_leave', group_id: g.groupId })
    cleanupGroup()
  }

  const toggleGroupMute = () => {
    const g = gcRef.current
    if (!g || !localRef.current) return
    const muted = !g.muted
    localRef.current.getAudioTracks().forEach((t) => { t.enabled = !muted })
    setGroup({ ...g, muted })
    send({ type: 'gcall_mute', group_id: g.groupId, muted })
  }

  const toggleGroupHand = () => {
    const g = gcRef.current
    if (!g) return
    const handRaised = !g.handRaised
    setGroup({ ...g, handRaised })
    send({ type: 'gcall_hand', group_id: g.groupId, raised: handRaised })
  }

  const dismissGroupInvite = () => setGroupInvite(null)

  /* ---------------------------------------------------------------- incoming messages */
  const onMessage = async (msg) => {
    const c = callRef.current

    switch (msg.type) {
      /* ---------- 1:1 calls ---------- */
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
        if (c || gcRef.current) { send({ type: 'call_decline', call_id: msg.call_id }); break }
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

      /* ---------- group calls ---------- */
      case 'gcall_status': {
        setActiveGroupCalls((prev) => {
          const next = { ...prev }
          if (msg.active) next[msg.group_id] = { groupName: msg.group_name, count: msg.count }
          else delete next[msg.group_id]
          return next
        })
        if (msg.active && msg.new && !gcRef.current && !callRef.current) {
          setGroupInvite({ groupId: msg.group_id, groupName: msg.group_name, by: msg.started_by })
        }
        if (!msg.active) {
          setGroupInvite((inv) => (inv?.groupId === msg.group_id ? null : inv))
        }
        break
      }

      case 'gcall_error': {
        const reasons = {
          not_allowed: 'You are not a member of this group.',
          busy_self: 'You are already in a call.',
          full: 'This voice call is full (6 people maximum).',
        }
        if (gcRef.current?.groupId === msg.group_id) cleanupGroup()
        flash(reasons[msg.reason] || 'Could not join the voice call.')
        break
      }

      case 'gcall_joined': {
        const g = gcRef.current
        if (!g || g.groupId !== msg.group_id) {
          // I cancelled while joining: make sure the server lets me go
          send({ type: 'gcall_leave', group_id: msg.group_id })
          break
        }
        const participants = {}
        msg.participants.forEach((p) => {
          participants[p.user_id] = {
            name: p.name, muted: p.muted, hand: p.hand, hand_at: p.hand_at, conn: 'new',
          }
        })
        setGroup({ ...g, status: 'active', startedAt: Date.now(), participants })
        if (msg.participants.length > 0 && !tipShown.current) {
          tipShown.current = true
          flash('Tip: use headphones to avoid echo.')
        }
        for (const p of msg.participants) await callGroupPeer(p.user_id)
        break
      }

      case 'gcall_peer_joined': {
        const g = gcRef.current
        if (!g || g.groupId !== msg.group_id) break
        const u = msg.user
        removeGroupPeer(u.user_id) // drop any stale connection from an earlier visit
        patchParticipant(u.user_id, {
          name: u.name, muted: u.muted, hand: u.hand, hand_at: u.hand_at, conn: 'new',
        })
        break
      }

      case 'gcall_peer_left':
        if (gcRef.current?.groupId === msg.group_id) {
          removeGroupPeer(msg.user_id)
          dropParticipant(msg.user_id)
        }
        break

      case 'gcall_peer_state':
        if (gcRef.current?.groupId === msg.group_id) {
          patchParticipant(msg.user.user_id, {
            muted: msg.user.muted, hand: msg.user.hand, hand_at: msg.user.hand_at,
          })
        }
        break

      case 'gcall_signal':
        if (gcRef.current?.groupId === msg.group_id) {
          // handle one at a time, in order
          gSignalChain.current = gSignalChain.current
            .then(() => handleGroupSignal(msg.from, msg.data || {}))
            .catch(() => {})
        }
        break

      case 'socket_closed':
        if (c) { cleanup(); flash('Connection lost. The call ended.') }
        if (gcRef.current) { cleanupGroup(); flash('Connection lost. You left the voice call.') }
        break

      default:
        break
    }
  }

  // keep the latest closures reachable from stable callbacks
  live.current = {
    onMessage, startCall, acceptCall, endCall, toggleMute, toggleCamera,
    joinGroupCall, leaveGroupCall, toggleGroupMute, toggleGroupHand,
  }

  useEffect(() => subscribe((msg) => { live.current.onMessage(msg) }), [subscribe])

  // which groups have a live call right now (for the "Join" banner)
  useEffect(() => {
    if (!connected) {
      setActiveGroupCalls({})
      return undefined
    }
    let cancelled = false
    api.get('/group-calls/active')
      .then((r) => {
        if (cancelled) return
        const map = {}
        ;(Array.isArray(r.data) ? r.data : []).forEach((g) => {
          map[g.group_id] = { groupName: g.group_name, count: g.count }
        })
        setActiveGroupCalls(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [connected])

  useEffect(() => () => {
    clearTimeout(noticeTimer.current)
    if (pcRef.current) pcRef.current.close()
    Object.values(gPeers.current).forEach((e) => e.pc.close())
    voiceRef.current?.close()
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
    // group voice calls
    groupCall, peerStreams, activeGroupCalls, groupInvite,
    joinGroupCall: (...a) => live.current.joinGroupCall(...a),
    leaveGroupCall: () => live.current.leaveGroupCall(),
    toggleGroupMute: () => live.current.toggleGroupMute(),
    toggleGroupHand: () => live.current.toggleGroupHand(),
    dismissGroupInvite,
  }), [call, notice, localStream, remoteStream, groupCall, peerStreams, activeGroupCalls, groupInvite])

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export const useCalls = () => useContext(CallContext)