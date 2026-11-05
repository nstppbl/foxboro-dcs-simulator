import type { AlarmCond, AlarmType } from '../alarms'
import type { Block, ExecCtx, ParamDef, PKind, PType, Val } from '../types'

/** Compact parameter definition helper. */
export function P(
  name: string,
  type: PType,
  def: Val,
  kind: PKind,
  desc: string,
  opts: Partial<Pick<ParamDef, 'settable' | 'conn' | 'src' | 'group'>> = {},
): ParamDef {
  return { name, type, def, kind, desc, conn: kind === 'in', ...opts }
}

/** Parameters every block has (manual 2001V8 p. 4-18, 4-26). */
export const COMMON: ParamDef[] = [
  P('DESCRP', 'S', '', 'cfg', 'Block description (≤32 chars)', { group: 'general' }),
  P('LOOPID', 'S', '', 'cfg', 'Loop identifier shown under the faceplate', { group: 'general' }),
  P('PERIOD', 'I', 1, 'cfg', 'Execution period index (0=0.1 s, 1=0.5 s, 2=1 s, …)', { group: 'general', src: '4-18' }),
  P('PHASE', 'I', 0, 'cfg', 'Phase: BPC offset within the period', { group: 'general', src: '4-18' }),
]

export const IO: ParamDef[] = [
  P('IOMOPT', 'I', 1, 'cfg', '0 = link from block, 1 = FBM, 2 = link without signal conditioning', { group: 'io', src: '4-33' }),
  P('IOM_ID', 'S', '', 'cfg', 'FBM letterbug (ECB) providing the point', { group: 'io', src: '4-33' }),
  P('PNT_NO', 'I', 1, 'cfg', 'FBM point number (1-8 analog, 1-32 discrete)', { group: 'io', src: '4-33' }),
]

export const AM: ParamDef[] = [
  P('MA', 'B', true, 'in', 'Manual/Auto: true = Auto, false = Manual', { settable: true, group: 'control', src: '4-36' }),
  P('INITMA', 'I', 1, 'cfg', 'Initial M/A: 0 = Manual, 1 = Auto, 2 = from checkpoint', { group: 'control', src: '4-36' }),
  P('MANSW', 'B', false, 'in', 'Manual switch (overrides AUTSW)', { group: 'control', src: '4-36' }),
  P('AUTSW', 'B', false, 'in', 'Auto switch', { group: 'control', src: '4-36' }),
]

export const ALARM_OUT: ParamDef[] = [
  P('INHIB', 'B', false, 'in', 'Inhibit all alarms of this block', { settable: true, group: 'alarm', src: '4-48' }),
  P('CRIT', 'I', 0, 'out', 'Criticality: priority of the highest active alarm (0 = none)', { group: 'status', src: '4-45' }),
  P('PRTYPE', 'I', 0, 'out', 'Type of the highest-priority active alarm', { group: 'status', src: '4-45' }),
  P('UNACK', 'B', false, 'out', 'Unacknowledged alarm present', { group: 'status' }),
]

export const BAD_ALARM: ParamDef[] = [
  P('BAO', 'I', 0, 'cfg', 'Bad alarm option: 0 = off, 1 = on', { group: 'alarm', src: '5-70' }),
  P('BAT', 'S', '', 'cfg', 'Bad alarm text (≤28 chars)', { group: 'alarm' }),
  P('BAP', 'I', 3, 'cfg', 'Bad alarm priority 1-5', { group: 'alarm' }),
  P('BAG', 'I', 1, 'cfg', 'Bad alarm group 1-8', { group: 'alarm' }),
]

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const num = (v: Val | undefined) => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : parseFloat(v ?? '') || 0)
export const bool = (v: Val | undefined) => (typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : v === 'true' || v === '1')

/** Apply MANSW / AUTSW / linked MA (MANSW wins). Returns true if Auto. */
export function resolveMA(b: Block, ctx: ExecCtx): boolean {
  if (b.links.MA) b.p.MA = bool(ctx.input(b, 'MA').v)
  const man = b.links.MANSW ? bool(ctx.input(b, 'MANSW').v) : bool(b.p.MANSW)
  const aut = b.links.AUTSW ? bool(ctx.input(b, 'AUTSW').v) : bool(b.p.AUTSW)
  if (man) b.p.MA = false
  else if (aut) b.p.MA = true
  return bool(b.p.MA)
}

export function initMA(b: Block) {
  const i = num(b.p.INITMA)
  if (i === 0) b.p.MA = false
  else if (i === 1) b.p.MA = true
}

/**
 * Absolute/deviation/output alarm with deadband.
 * `high` alarms when value > limit; clears when value < limit - db.
 */
export function limitAlarm(
  b: Block,
  type: AlarmType,
  enabled: boolean,
  high: boolean,
  value: number,
  limit: number,
  db: number,
  pri: number,
  text: string,
  eu?: string,
): AlarmCond {
  const k = `alm_${type}`
  const was = !!b.st[k]
  let active = false
  if (enabled) {
    if (high) active = was ? value > limit - db : value > limit
    else active = was ? value < limit + db : value < limit
  }
  b.st[k] = active
  return { type, active, pri, text, value, limit, eu }
}

export function badAlarm(b: Block, bad: boolean): AlarmCond {
  return { type: 'BAD', active: num(b.p.BAO) > 0 && bad, pri: num(b.p.BAP) || 3, text: String(b.p.BAT || 'BAD I/O') }
}
