import { create } from 'zustand'
import { STATION_PRESETS, type StationPresetId } from '../engine/presets'
import { ControlStation } from '../engine/station'
import type { Block, Val } from '../engine/types'

/** Values recorded for trending, per block type (manual: detail trend has 4 pens). */
export const TREND_PENS: Record<string, string[]> = {
  PID: ['MEAS', 'SPT', 'OUT'],
  PIDA: ['MEAS', 'SPT', 'OUT'],
  AIN: ['PNT'],
  AOUT: ['OUT'],
  RATIO: ['MEAS', 'OUT'],
  LLAG: ['MEAS', 'OUT'],
  DTIME: ['MEAS', 'OUT'],
  CALC: ['RO01', 'RO02'],
  CHARC: ['MEAS', 'OUT'],
  SWCH: ['OUT'],
  MTR: ['MSTAT', 'MANRUN'],
  DIN: ['CIN'],
  DOUT: ['COUT'],
  HLBL: ['STMNO'],
}

/** 15 min at 1 s, like the FoxView detail-display trend */
export const TREND_LEN = 900

export interface TrendBuf {
  t: number[]
  v: Record<string, number[]>
}

export type Selection = { kind: 'compound'; c: string } | { kind: 'block'; c: string; b: string } | { kind: 'cad' } | { kind: 'journal' }

interface SimState {
  station: ControlStation
  preset: StationPresetId
  running: boolean
  speed: number
  /** bumps on every refresh so views re-render */
  version: number
  sel: Selection
  trends: Record<string, TrendBuf>
  toast?: { text: string; err: boolean; id: number }
  select: (s: Selection) => void
  setRunning: (r: boolean) => void
  setSpeed: (s: number) => void
  reset: (p?: StationPresetId) => void
  set: (c: string, b: string, param: string, v: Val, config?: boolean) => boolean
  link: (c: string, b: string, param: string, src: string) => boolean
  ack: (ref: string) => void
  ackCompound: (c: string) => void
  ackAll: () => void
  setCompound: (c: string, param: 'ON' | 'CINHIB', v: Val) => void
  notify: (text: string, err?: boolean) => void
  refresh: () => void
}

function sampleAll(st: ControlStation, trends: Record<string, TrendBuf>) {
  for (const [ref, b] of Object.entries(st.db.blk)) {
    const pens = TREND_PENS[b.type] ?? []
    const buf = (trends[ref] ??= { t: [], v: {} })
    buf.t.push(st.time)
    for (const p of pens) {
      const arr = (buf.v[p] ??= [])
      const v = b.p[p]
      arr.push(typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) || 0)
      if (arr.length > TREND_LEN) arr.shift()
    }
    if (buf.t.length > TREND_LEN) buf.t.shift()
  }
}

/** Run a fresh station to steady state (start-up transient acknowledged and cleared). */
function warmUp(st: ControlStation, trends: Record<string, TrendBuf>) {
  for (let i = 0; i < 2400; i++) {
    st.step()
    if (i % 20 === 0) sampleAll(st, trends)
  }
  for (const c of st.db.compounds) st.ackCompound(c)
  st.alarms.history = []
}

let timer: number | undefined
let lastSample = -1

export const useSim = create<SimState>()((set, get) => {
  const loop = () => {
    const s = get()
    if (!s.running) return
    // 100 ms of wall time = 2 BPC ticks at 1×
    const n = Math.round(2 * s.speed)
    for (let i = 0; i < n; i++) {
      s.station.step()
      if (Math.floor(s.station.time) !== lastSample) {
        lastSample = Math.floor(s.station.time)
        sampleAll(s.station, s.trends)
      }
    }
    set({ version: s.version + 1 })
  }
  const start = () => {
    if (timer === undefined && typeof window !== 'undefined') timer = window.setInterval(loop, 100)
  }
  const stop = () => {
    if (timer !== undefined) window.clearInterval(timer)
    timer = undefined
  }
  const station = new ControlStation(STATION_PRESETS.tank2())
  // pre-run so the trainee finds the loop at steady state, with trend history
  const trends: Record<string, TrendBuf> = {}
  warmUp(station, trends)
  lastSample = Math.floor(station.time)
  queueMicrotask(start)

  return {
    station,
    preset: 'tank2',
    running: true,
    speed: 1,
    version: 0,
    sel: { kind: 'block', c: 'TANK2_COMP', b: 'LC100' },
    trends,
    select: (sel) => set({ sel }),
    setRunning: (running) => {
      set({ running })
      if (running) start()
      else stop()
    },
    setSpeed: (speed) => set({ speed }),
    reset: (p) => {
      const preset = p ?? get().preset
      const st = new ControlStation(STATION_PRESETS[preset]())
      const tr: Record<string, TrendBuf> = {}
      warmUp(st, tr)
      lastSample = Math.floor(st.time)
      set({ station: st, preset, trends: tr, version: get().version + 1 })
    },
    set: (c, b, param, v, config) => {
      const err = get().station.set(c, b, param, v, { config })
      if (err) get().notify(`${c}:${b}.${param}: ${err}`, true)
      get().refresh()
      return !err
    },
    link: (c, b, param, src) => {
      const err = get().station.setLink(c, b, param, src)
      if (err) get().notify(`${c}:${b}.${param}: ${err}`, true)
      get().refresh()
      return !err
    },
    ack: (ref) => {
      get().station.ack(ref)
      get().refresh()
    },
    ackCompound: (c) => {
      get().station.ackCompound(c)
      get().refresh()
    },
    ackAll: () => {
      const st = get().station
      for (const c of st.db.compounds) st.ackCompound(c)
      get().refresh()
    },
    setCompound: (c, param, v) => {
      const cmp = get().station.compound(c)
      if (cmp) cmp.p[param] = v
      get().refresh()
    },
    notify: (text, err = false) => set({ toast: { text, err, id: Date.now() } }),
    refresh: () => set({ version: get().version + 1 }),
  }
})

export const blockOf = (s: SimState): Block | undefined => (s.sel.kind === 'block' ? s.station.block(s.sel.c, s.sel.b) : undefined)
