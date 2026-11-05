import { AlarmManager, PRTYPE, cinhibBlocks, type AlarmCond, type AlarmType } from './alarms'
import { bool, num } from './blocks/common'
import { BLOCK_TYPES, paramDef } from './registry'
import { BASE_TICK_S, PERIOD_SECONDS, executesOn } from './scheduler'
import type { Block, Compound, ExecCtx, StationDb, Val } from './types'
import { key } from './types'

/** Parse "C:B.P" or ":B.P" (relative to `compound`). */
export function parseRef(ref: string, compound: string): { c: string; b: string; p: string } | undefined {
  const m = /^([A-Za-z0-9_]*):([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)$/.exec(ref.trim())
  if (!m) return undefined
  return { c: (m[1] || compound).toUpperCase(), b: m[2].toUpperCase(), p: m[3].toUpperCase() }
}

export interface FieldIo {
  read(iomId: string, pnt: number): { v: number; bad: boolean } | undefined
  write(iomId: string, pnt: number, v: number): void
}

/**
 * A simulated Control Processor: executes compounds and blocks on the BPC
 * (50 ms base tick) according to PERIOD / PHASE, resolves C:B.P connections,
 * and feeds block alarm conditions to the AlarmManager.
 */
export class ControlStation {
  db: StationDb
  alarms = new AlarmManager()
  time = 0
  tick = 0
  field: FieldIo
  /** called once per BPC tick after the blocks ran (process models) */
  onTick?: (dt: number, st: ControlStation) => void

  constructor(db: StationDb, field?: FieldIo) {
    this.db = db
    const pts = new Map<string, number>()
    this.field = field ?? {
      read: (id, n) => (pts.has(`${id}:${n}`) ? { v: pts.get(`${id}:${n}`)!, bad: false } : undefined),
      write: (id, n, v) => void pts.set(`${id}:${n}`, v),
    }
    for (const c of db.compounds) {
      const cmp = db.cmp[c]
      cmp.p.ON ??= true
      cmp.p.CINHIB ??= 0
      cmp.p.PERIOD ??= 1
      cmp.p.PHASE ??= 0
    }
    for (const b of Object.values(db.blk)) this.initBlock(b)
  }

  initBlock(b: Block) {
    b.st = {}
    b.bad = {}
    BLOCK_TYPES[b.type]?.init?.(b)
  }

  block(c: string, b: string): Block | undefined {
    return this.db.blk[key(c, b)]
  }

  compound(c: string): Compound | undefined {
    return this.db.cmp[c]
  }

  /** Read a parameter by reference, relative to `from`'s compound. */
  read(ref: string, fromCompound: string): { v: Val; bad: boolean } | undefined {
    const r = parseRef(ref, fromCompound)
    if (!r) return undefined
    const b = this.block(r.c, r.b)
    if (!b || !(r.p in b.p)) return undefined
    const cmpOff = !bool(this.db.cmp[r.c]?.p.ON)
    return { v: b.p[r.p], bad: !!b.bad[r.p] || cmpOff }
  }

  /**
   * Operator / program write. Returns an error string if refused.
   * Rules: linked inputs cannot be set; OUT only in Manual; SPT only in Local.
   */
  set(c: string, bn: string, param: string, v: Val, opts: { config?: boolean } = {}): string | undefined {
    const b = this.block(c, bn)
    if (!b) return `${c}:${bn} does not exist`
    const d = paramDef(b.type, param)
    if (!d) return `${param} is not a parameter of ${b.type}`
    if (b.links[param]) return `${param} is connected to ${b.links[param]} (secured)`
    if (!opts.config) {
      if (param === 'OUT' && 'MA' in b.p && bool(b.p.MA)) return 'OUT can be set only in Manual'
      if (param === 'SPT' && 'LR' in b.p && bool(b.p.LR)) return 'SPT can be set only in Local'
      if (param === 'PNT' && 'MA' in b.p && bool(b.p.MA)) return 'PNT can be set only in Manual'
    }
    let val: Val = v
    if (d.type === 'R') val = typeof v === 'number' ? v : parseFloat(String(v))
    else if (d.type === 'I') val = Math.round(typeof v === 'number' ? v : parseFloat(String(v)))
    else if (d.type === 'B') val = bool(v)
    else val = String(v)
    if (typeof val === 'number' && !Number.isFinite(val)) return `${param}: number expected`
    b.p[param] = val
    if (param === 'INITMA' || param === 'INITLR') BLOCK_TYPES[b.type]?.init?.(b)
    return undefined
  }

  setLink(c: string, bn: string, param: string, src: string): string | undefined {
    const b = this.block(c, bn)
    if (!b) return `${c}:${bn} does not exist`
    const d = paramDef(b.type, param)
    if (!d) return `${param} is not a parameter of ${b.type}`
    if (!src) {
      delete b.links[param]
      return undefined
    }
    if (!d.conn) return `${param} is not connectable`
    const r = parseRef(src, c)
    if (!r) return `bad reference syntax "${src}" (use C:B.P or :B.P)`
    const sb = this.block(r.c, r.b)
    if (!sb) return `${r.c}:${r.b} does not exist`
    if (!(r.p in sb.p)) return `${r.p} is not a parameter of ${r.c}:${r.b}`
    b.links[param] = src.toUpperCase()
    return undefined
  }

  ack(ref: string) {
    this.alarms.ack(this.time, ref)
    this.refreshUnack(ref)
  }

  ackCompound(c: string) {
    this.alarms.ackCompound(this.time, c)
    for (const n of this.db.cmp[c]?.blocks ?? []) this.refreshUnack(key(c, n))
  }

  private refreshUnack(ref: string) {
    const b = this.db.blk[ref]
    if (b) b.p.UNACK = this.alarms.blockUnacked(ref)
  }

  private ctxFor(dt: number): ExecCtx {
    return {
      dt,
      time: this.time,
      input: (blk, param) => {
        const src = blk.links[param]
        if (!src) return { v: blk.p[param], bad: false, linked: false }
        const r = this.read(src, blk.compound)
        if (!r) return { v: blk.p[param], bad: true, linked: true }
        blk.p[param] = r.v
        return { v: r.v, bad: r.bad, linked: true }
      },
      num: (blk, param) => num(blk.p[param]),
      read: (ref, from) => this.read(ref, from.compound),
      write: (ref, v, from) => {
        const r = parseRef(ref, from.compound)
        if (!r) return false
        const err = this.set(r.c, r.b, r.p, v, { config: true })
        return !err
      },
      message: (blk, text) => this.alarms.message(this.time, key(blk.compound, blk.name), text),
      alarm: (blk, conds) => this.applyAlarms(blk, conds),
      field: this.field,
    }
  }

  private applyAlarms(b: Block, conds: AlarmCond[]) {
    const ref = key(b.compound, b.name)
    const cinhib = num(this.db.cmp[b.compound]?.p.CINHIB)
    let crit = 0
    let prtype = 0
    for (const c of conds) {
      const inhibited = bool(b.p.INHIB) || cinhibBlocks(cinhib, c.pri)
      const name = String((/OUT$/.test(c.type) ? b.p.OUTNM : b.p.MEASNM) || b.name)
      this.alarms.update(this.time, { ref, compound: b.compound, block: b.name, name, descrp: String(b.p.DESCRP ?? ''), inhibited }, c)
      if (c.active && !inhibited && (crit === 0 || c.pri < crit)) {
        crit = c.pri
        prtype = PRTYPE[c.type as AlarmType]
      }
    }
    b.p.CRIT = crit
    b.p.PRTYPE = prtype
    b.p.UNACK = this.alarms.blockUnacked(ref)
  }

  /** Execute one Basic Processing Cycle (50 ms of process time). */
  step() {
    this.tick++
    this.time = +(this.tick * BASE_TICK_S).toFixed(3)
    for (const cn of this.db.compounds) {
      const cmp = this.db.cmp[cn]
      if (!bool(cmp.p.ON)) continue
      for (const bn of cmp.blocks) {
        const b = this.db.blk[key(cn, bn)]
        if (!b) continue
        const def = BLOCK_TYPES[b.type]
        if (!def) continue
        const period = num(b.p.PERIOD)
        if (!executesOn({ period, phase: num(b.p.PHASE) }, this.tick)) continue
        const last = b.st.lastT as number | undefined
        const dt = last === undefined ? PERIOD_SECONDS[period] ?? 0.5 : this.time - last
        b.st.lastT = this.time
        // fetch every connected input, so displays show the current linked value
        for (const [param, src] of Object.entries(b.links)) {
          const r = this.read(src, b.compound)
          if (r) b.p[param] = r.v
        }
        def.exec(b, this.ctxFor(dt))
      }
    }
    this.onTick?.(BASE_TICK_S, this)
  }

  /** Run for `seconds` of simulated time. */
  run(seconds: number) {
    const n = Math.round(seconds / BASE_TICK_S)
    for (let i = 0; i < n; i++) this.step()
  }
}
