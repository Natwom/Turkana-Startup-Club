// Microphone capture tuned for voice chat.
// Browser echo cancellation + noise suppression, then a high-pass filter and a noise gate,
// so the room goes quiet when you stop talking and only your voice is sent.

export const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
}

// Runs on the audio thread (no timers), so it keeps working in a background tab.
const GATE_WORKLET = `
class VoiceGate extends AudioWorkletProcessor {
  constructor() {
    super()
    this.gain = 0
    this.floor = 0.004   // running estimate of the room's noise level
    this.hold = 0        // keeps the gate open briefly between words
  }

  process(inputs, outputs) {
    const input = inputs[0]
    const output = outputs[0]
    if (!output || !output[0]) return true
    const y = output[0]
    if (!input || !input[0]) {
      y.fill(0)
      return true
    }
    const x = input[0]
    const n = x.length

    let sum = 0
    for (let i = 0; i < n; i++) sum += x[i] * x[i]
    const rms = Math.sqrt(sum / n)

    // open when clearly louder than the room noise (adapts to quiet and noisy rooms)
    const threshold = Math.min(0.05, Math.max(0.01, this.floor * 3.5))
    const open = rms > threshold
    if (open) this.hold = 80            // about 210 ms
    else if (this.hold > 0) this.hold -= 1

    // noise floor: falls fast, rises slowly (almost not at all while someone is talking)
    if (rms < this.floor) this.floor = this.floor * 0.9 + rms * 0.1
    else this.floor += (rms - this.floor) * (open ? 0.00002 : 0.0005)

    // fast attack so words are not clipped, smooth release so it never "chops"
    const target = open || this.hold > 0 ? 1 : 0
    const g0 = this.gain
    const g1 = g0 + (target - g0) * (target > g0 ? 0.25 : 0.04)
    for (let i = 0; i < n; i++) {
      y[i] = x[i] * (g0 + ((g1 - g0) * (i + 1)) / n)
    }
    this.gain = g1
    return true
  }
}
registerProcessor('voice-gate', VoiceGate)
`

const stopAll = (stream) => stream.getTracks().forEach((t) => t.stop())

/**
 * Resolves { stream, close }.
 * `stream` is what you send into the call; call `close()` when the call ends
 * to release the microphone. Throws only if the microphone itself is unavailable
 * (permission denied, no device), so callers can show the usual error.
 */
export async function getCleanMic() {
  const raw = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false })
  const plain = { stream: raw, close: () => stopAll(raw) }

  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx || typeof AudioWorkletNode === 'undefined') return plain // older browser: plain mic

  let ctx
  try {
    ctx = new Ctx({ latencyHint: 'interactive' })
    ctx.onstatechange = () => {
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume().catch(() => {})
    }
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})

    const url = URL.createObjectURL(new Blob([GATE_WORKLET], { type: 'application/javascript' }))
    try {
      await ctx.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }

    const source = ctx.createMediaStreamSource(raw)
    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 100
    highpass.Q.value = 0.707
    const gate = new AudioWorkletNode(ctx, 'voice-gate', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    })
    const dest = ctx.createMediaStreamDestination()

    source.connect(highpass)
    highpass.connect(gate)
    gate.connect(dest)

    const processedCtx = ctx
    return {
      stream: dest.stream,
      close: () => {
        try { source.disconnect() } catch { /* ignore */ }
        try { highpass.disconnect() } catch { /* ignore */ }
        try { gate.disconnect() } catch { /* ignore */ }
        processedCtx.onstatechange = null
        stopAll(dest.stream)
        stopAll(raw)
        processedCtx.close().catch(() => {})
      },
    }
  } catch {
    try { ctx?.close() } catch { /* ignore */ }
    return plain
  }
}