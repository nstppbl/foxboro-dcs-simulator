import type { Bilingual } from '../../domain/hardware/catalog'
import type { FieldIo } from '../station'

/** One field instrument wired to an FBM point. Analog values travel as % of the instrument range. */
export interface Instrument {
  tag: string
  fbm: string
  pnt: number
  kind: 'ai' | 'ao' | 'di' | 'do'
  lo?: number
  hi?: number
  eu?: string
  desc: Bilingual
}

export interface DistDef {
  key: string
  label: Bilingual
  unit: string
  min: number
  max: number
  step: number
  def: number
}

export interface PlantVar {
  label: Bilingual
  value: number | string
  unit?: string
}

/** Small deterministic random generator (so tests are repeatable). */
export function rng(seed = 1) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * A first-principles process model connected to the CP through FBM points.
 * Subclasses implement `update(dt)` using ai()/ao()/di()/dout().
 */
export abstract class Plant {
  abstract id: string
  abstract instruments: Instrument[]
  abstract distDefs: DistDef[]
  dist: Record<string, number> = {}
  time = 0
  private pts = new Map<string, number>()
  /** failed FBM points (fault injection, stage 6) */
  bad = new Set<string>()
  private rand = rng(7)
  /** measurement noise, % of span (1 sigma, approx.) */
  noise = 0.15

  init() {
    for (const d of this.distDefs) this.dist[d.key] ??= d.def
    for (const i of this.instruments) if (!this.pts.has(`${i.fbm}:${i.pnt}`)) this.pts.set(`${i.fbm}:${i.pnt}`, 0)
    return this
  }

  private inst(tag: string) {
    const i = this.instruments.find((x) => x.tag === tag)
    if (!i) throw new Error(`no instrument ${tag}`)
    return i
  }

  /** write a transmitter value in engineering units */
  protected ai(tag: string, v: number, noisy = true) {
    const i = this.inst(tag)
    const span = (i.hi ?? 100) - (i.lo ?? 0)
    let pct = ((v - (i.lo ?? 0)) / span) * 100
    if (noisy && this.noise && pct > 0.5) pct += (this.rand() + this.rand() + this.rand() - 1.5) * this.noise
    this.pts.set(`${i.fbm}:${i.pnt}`, Math.max(-5, Math.min(105, pct)))
  }
  /** read an actuator signal in % (0-100) */
  protected ao(tag: string) {
    const i = this.inst(tag)
    return Math.max(0, Math.min(100, this.pts.get(`${i.fbm}:${i.pnt}`) ?? 0))
  }
  protected di(tag: string, v: boolean) {
    const i = this.inst(tag)
    this.pts.set(`${i.fbm}:${i.pnt}`, v ? 1 : 0)
  }
  protected dout(tag: string) {
    const i = this.inst(tag)
    return (this.pts.get(`${i.fbm}:${i.pnt}`) ?? 0) > 0.5
  }

  field(): FieldIo {
    return {
      read: (id, n) => {
        const k = `${id}:${n}`
        if (!this.pts.has(k)) return undefined
        return { v: this.pts.get(k)!, bad: this.bad.has(k) }
      },
      write: (id, n, v) => {
        const k = `${id}:${n}`
        if (this.pts.has(k)) this.pts.set(k, v)
      },
    }
  }

  step(dt: number) {
    this.time += dt
    this.update(dt)
  }

  /** current value of an instrument point in EU (for displays) */
  value(tag: string) {
    const i = this.inst(tag)
    const pct = this.pts.get(`${i.fbm}:${i.pnt}`) ?? 0
    if (i.kind === 'di' || i.kind === 'do') return pct > 0.5 ? 1 : 0
    return (i.lo ?? 0) + (pct / 100) * ((i.hi ?? 100) - (i.lo ?? 0))
  }

  protected abstract update(dt: number): void
  abstract vars(): PlantVar[]
  /** one-shot operator actions on the process (e.g. "add acid bolus") */
  actions(): { key: string; label: Bilingual }[] {
    return []
  }
  act(_key: string) {}
}

/** first-order lag helper */
export const lag = (y: number, u: number, tau: number, dt: number) => (tau <= 0 ? u : y + (u - y) * Math.min(1, dt / tau))

/** transport delay helper */
export class Delay {
  private buf: { t: number; v: number }[] = []
  private d: number
  constructor(d: number) {
    this.d = d
  }
  push(t: number, v: number) {
    this.buf.push({ t, v })
    while (this.buf.length > 1 && this.buf[1].t <= t - this.d) this.buf.shift()
    return this.buf[0].v
  }
}
