/**
 * Alarm horn with Web Audio (manual ch. 11: alarm tones are configured per priority;
 * here P1 = Tone 1 fast high beep, P2-P5 = Tone 2 slow low beep).
 */
let ctx: AudioContext | undefined
let timer: number | undefined
let current = 0

function beep(freq: number, ms: number, vol = 0.08) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'square'
  o.frequency.value = freq
  g.gain.value = vol
  o.connect(g).connect(ctx.destination)
  o.start()
  o.stop(ctx.currentTime + ms / 1000)
}

/** Must be called from a user gesture once, so the browser allows sound. */
export function unlockAudio() {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* no audio */
  }
}

/** 0 = silent, 1 = Tone 1 (P1), 2 = Tone 2 (P2-P5) */
export function setHorn(tone: number) {
  if (tone === current) return
  current = tone
  if (timer !== undefined) window.clearInterval(timer)
  timer = undefined
  if (!tone || !ctx) return
  const play = () => (tone === 1 ? (beep(1100, 140), window.setTimeout(() => beep(1100, 140), 250)) : beep(620, 300))
  play()
  timer = window.setInterval(play, tone === 1 ? 700 : 1400)
}
