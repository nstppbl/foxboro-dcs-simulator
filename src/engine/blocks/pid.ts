import type { AlarmCond } from '../alarms'
import type { Block, BlockTypeDef, ExecCtx, ParamDef } from '../types'
import { ALARM_OUT, AM, COMMON, P, bool, clamp, initMA, limitAlarm, num, resolveMA } from './common'

/** PID parameters (manual 2001V8 p. 4-37 … 4-47, LAB 1 tables). */
const PID_PARAMS: ParamDef[] = [
  ...COMMON,
  P('MEAS', 'R', 0, 'in', 'Controlled measurement (e.g. :LT100.PNT)', { group: 'control', src: '4-27' }),
  P('HSCI1', 'R', 100, 'cfg', 'High scale, measurement range', { group: 'control' }),
  P('LSCI1', 'R', 0, 'cfg', 'Low scale, measurement range', { group: 'control' }),
  P('EI1', 'S', '%', 'cfg', 'Measurement engineering units', { group: 'control' }),
  P('DELTI1', 'R', 0.1, 'cfg', 'Change-driven delta, measurement', { group: 'control' }),
  P('SPT', 'R', 50, 'in', 'Setpoint (local)', { settable: true, group: 'control', src: '4-37' }),
  P('RSP', 'R', 0, 'in', 'Remote setpoint (cascade)', { group: 'control', src: '4-37' }),
  P('LR', 'B', false, 'in', 'Local/Remote: false = Local, true = Remote', { settable: true, group: 'control' }),
  P('LOCSW', 'B', false, 'in', 'Local switch (overrides REMSW)', { group: 'control' }),
  P('REMSW', 'B', false, 'in', 'Remote switch', { group: 'control' }),
  P('INITLR', 'I', 0, 'cfg', 'Initial L/R: 0 = Local, 1 = Remote, 2 = checkpoint', { group: 'control' }),
  ...AM,
  P('MBADOP', 'I', 0, 'cfg', '1 = go to Manual on BAD measurement', { group: 'control' }),
  P('HSCO1', 'R', 100, 'cfg', 'High scale, output', { group: 'control' }),
  P('LSCO1', 'R', 0, 'cfg', 'Low scale, output', { group: 'control' }),
  P('EO1', 'S', '%', 'cfg', 'Output engineering units', { group: 'control' }),
  P('OUT', 'R', 0, 'out', 'Controller output (settable in Manual only)', { settable: true, group: 'control' }),
  P('FBK', 'R', 0, 'in', 'External reset feedback (integral action)', { group: 'control', src: '4-31' }),
  P('BCALCI', 'R', 0, 'in', 'Back-calculation input from downstream BCALCO', { group: 'control', src: '4-31' }),
  P('BCALCO', 'R', 0, 'out', 'Back-calculated value for an upstream (primary) controller', { group: 'control' }),
  P('INCOPT', 'I', 0, 'cfg', 'Action: 0 = increase/decrease (reverse), 1 = increase/increase (direct)', { group: 'tune', src: '4-37' }),
  P('MODOPT', 'I', 1, 'cfg', 'Mode: 1 P, 2 I, 3 PD, 4 PI, 5 PID', { settable: true, group: 'tune', src: '4-38' }),
  P('PBAND', 'R', 100, 'in', 'Proportional band, % (gain = 100/PBAND)', { settable: true, group: 'tune', src: '4-37' }),
  P('INT', 'R', 1, 'in', 'Integral time, minutes per repeat', { settable: true, group: 'tune', src: '4-37' }),
  P('DERIV', 'R', 0, 'in', 'Derivative time, minutes', { settable: true, group: 'tune', src: '4-37' }),
  P('HOLD', 'B', false, 'in', 'Hold the output', { settable: true, group: 'control' }),
  // measurement alarms
  P('MALOPT', 'I', 0, 'cfg', 'Measurement alarm option: 0 none, 1 high+low, 2 high, 3 low', { group: 'alarm', src: '4-42' }),
  P('MEASHL', 'R', 100, 'cfg', 'High absolute alarm limit (HIABS)', { settable: true, group: 'alarm' }),
  P('MEASLL', 'R', 0, 'cfg', 'Low absolute alarm limit (LOABS)', { settable: true, group: 'alarm' }),
  P('MEASDB', 'R', 0, 'cfg', 'Measurement alarm deadband', { group: 'alarm' }),
  P('MEASPR', 'I', 3, 'cfg', 'Measurement alarm priority 1-5', { settable: true, group: 'alarm', src: '4-45' }),
  P('MEASGR', 'I', 1, 'cfg', 'Measurement alarm group 1-8', { group: 'alarm' }),
  P('MEASNM', 'S', '', 'cfg', 'Measurement alarm name (≤12 chars)', { group: 'alarm' }),
  P('MEASHT', 'S', '', 'cfg', 'High alarm text (≤28 chars)', { group: 'alarm' }),
  P('MEASLT', 'S', '', 'cfg', 'Low alarm text (≤28 chars)', { group: 'alarm' }),
  P('HHAOPT', 'I', 0, 'cfg', 'High-high/low-low option: 0 none, 1 both, 2 HH, 3 LL', { group: 'alarm' }),
  P('HHALIM', 'R', 100, 'cfg', 'High-high limit (HHABS)', { settable: true, group: 'alarm' }),
  P('LLALIM', 'R', 0, 'cfg', 'Low-low limit (LLABS)', { settable: true, group: 'alarm' }),
  P('HHAPRI', 'I', 1, 'cfg', 'HH/LL alarm priority', { group: 'alarm' }),
  P('HHATXT', 'S', '', 'cfg', 'High-high text', { group: 'alarm' }),
  P('LLATXT', 'S', '', 'cfg', 'Low-low text', { group: 'alarm' }),
  P('DALOPT', 'I', 0, 'cfg', 'Deviation alarm option: 0 none, 1 both, 2 high, 3 low', { group: 'alarm' }),
  P('HDALIM', 'R', 10, 'cfg', 'High deviation limit (MEAS-SPT, EU)', { settable: true, group: 'alarm' }),
  P('LDALIM', 'R', 10, 'cfg', 'Low deviation limit (SPT-MEAS, EU)', { settable: true, group: 'alarm' }),
  P('DEVDB', 'R', 0, 'cfg', 'Deviation alarm deadband', { group: 'alarm' }),
  P('DEVPRI', 'I', 3, 'cfg', 'Deviation alarm priority', { settable: true, group: 'alarm' }),
  P('HDATXT', 'S', '', 'cfg', 'High deviation text', { group: 'alarm' }),
  P('LDATXT', 'S', '', 'cfg', 'Low deviation text', { group: 'alarm' }),
  P('OALOPT', 'I', 0, 'cfg', 'Output alarm option: 0 none, 1 both, 2 high, 3 low', { group: 'alarm' }),
  P('HOALIM', 'R', 100, 'cfg', 'High output limit (HIOUT)', { settable: true, group: 'alarm' }),
  P('LOALIM', 'R', 0, 'cfg', 'Low output limit (LOOUT)', { settable: true, group: 'alarm' }),
  P('OUTDB', 'R', 0, 'cfg', 'Output alarm deadband', { group: 'alarm' }),
  P('OUTPRI', 'I', 3, 'cfg', 'Output alarm priority', { settable: true, group: 'alarm' }),
  P('OUTNM', 'S', '', 'cfg', 'Output alarm name', { group: 'alarm' }),
  P('HOATXT', 'S', '', 'cfg', 'High output text', { group: 'alarm' }),
  P('LOATXT', 'S', '', 'cfg', 'Low output text', { group: 'alarm' }),
  P('MEASHI', 'B', false, 'out', 'High measurement alarm active', { group: 'status' }),
  P('MEASLI', 'B', false, 'out', 'Low measurement alarm active', { group: 'status' }),
  P('ERROR', 'R', 0, 'out', 'MEAS − SPT in engineering units', { group: 'status' }),
  P('TRACK', 'B', false, 'out', 'Tracking (downstream open loop)', { group: 'status' }),
  P('HOLDST', 'B', false, 'out', 'Holding (bad measurement/link or HOLD)', { group: 'status' }),
  ...ALARM_OUT,
]

function hasI(mode: number) {
  return mode === 2 || mode === 4 || mode === 5
}
function hasP(mode: number) {
  return mode !== 2
}
function hasD(mode: number) {
  return mode === 3 || mode === 5
}

function pidInit(b: Block) {
  initMA(b)
  const lr = num(b.p.INITLR)
  if (lr === 0) b.p.LR = false
  else if (lr === 1) b.p.LR = true
  b.st.init = true
}

/** Is the downstream block (source of BCALCI) in open loop (Manual)? */
function downstreamOpen(b: Block, ctx: ExecCtx): boolean {
  const src = b.links.BCALCI
  if (!src) return false
  const blkRef = src.slice(0, src.lastIndexOf('.'))
  const ma = ctx.read(`${blkRef}.MA`, b)
  const trk = ctx.read(`${blkRef}.TRACK`, b)
  const lr = ctx.read(`${blkRef}.LR`, b)
  // downstream in Manual, itself tracking, or a secondary controller in Local → open loop
  return (ma !== undefined && !bool(ma.v)) || (trk !== undefined && bool(trk.v)) || (lr !== undefined && !bool(lr.v))
}

function pidExec(b: Block, ctx: ExecCtx) {
  let auto = resolveMA(b, ctx)
  // L/R
  if (b.links.LR) b.p.LR = bool(ctx.input(b, 'LR').v)
  if (bool(b.links.LOCSW ? ctx.input(b, 'LOCSW').v : b.p.LOCSW)) b.p.LR = false
  else if (bool(b.links.REMSW ? ctx.input(b, 'REMSW').v : b.p.REMSW)) b.p.LR = true
  for (const k of ['PBAND', 'INT', 'DERIV', 'HOLD', 'SPT']) if (b.links[k]) b.p[k] = ctx.input(b, k).v

  const m = ctx.input(b, 'MEAS')
  const meas = num(m.v)
  if (m.bad && num(b.p.MBADOP) === 1 && auto) {
    b.p.MA = false
    auto = false
  }
  if (bool(b.p.LR)) {
    const r = ctx.input(b, 'RSP')
    if (!r.bad) b.p.SPT = num(r.v)
  }
  const sp = num(b.p.SPT)
  const hiI = num(b.p.HSCI1)
  const loI = num(b.p.LSCI1)
  const hiO = num(b.p.HSCO1)
  const loO = num(b.p.LSCO1)
  const spanI = hiI - loI || 1
  const spanO = hiO - loO || 1
  const mode = num(b.p.MODOPT) || 1
  const kc = 100 / Math.max(0.1, num(b.p.PBAND))
  let e = ((sp - meas) / spanI) * 100
  if (num(b.p.INCOPT) === 1) e = -e
  b.p.ERROR = meas - sp

  const outPct = ((num(b.p.OUT) - loO) / spanO) * 100
  const track = downstreamOpen(b, ctx)
  const hold = m.bad || bool(b.p.HOLD)
  b.p.TRACK = track
  b.p.HOLDST = hold && !track

  // derivative on measurement (no derivative kick on SP change)
  const measPct = (meas / spanI) * 100
  const prevMeas = (b.st.prevMeas as number | undefined) ?? measPct
  b.st.prevMeas = measPct
  let d = 0
  if (hasD(mode) && ctx.dt > 0) {
    const raw = -kc * num(b.p.DERIV) * 60 * ((measPct - prevMeas) / ctx.dt) * (num(b.p.INCOPT) === 1 ? -1 : 1)
    const prevD = (b.st.d as number) ?? 0
    d = prevD + (raw - prevD) * 0.3 // derivative filter
    b.st.d = d
  }
  const p = hasP(mode) ? kc * e : 0

  if (!auto || track || b.st.init) {
    // manual / tracking / first scan: back-initialise the integral for bumpless transfer
    if (track) {
      const bc = num(ctx.input(b, 'BCALCI').v)
      b.p.OUT = clamp(bc, loO, hiO)
    }
    const cur = ((num(b.p.OUT) - loO) / spanO) * 100
    b.st.i = cur - p - d
    b.st.init = false
  } else if (!hold) {
    let i = (b.st.i as number) ?? outPct - p
    const ti = num(b.p.INT)
    if (hasI(mode) && ti > 0) {
      const gainI = mode === 2 ? 1 : kc
      i += (gainI * e * ctx.dt) / (ti * 60)
    }
    let out = p + i + d
    // anti-windup: clamp and back off the integral
    const c = clamp(out, 0, 100)
    if (c !== out) {
      i -= out - c
      out = c
    }
    b.st.i = i
    b.p.OUT = loO + (out / 100) * spanO
  }
  b.p.OUT = clamp(num(b.p.OUT), loO, hiO)
  b.p.BCALCO = sp
  b.bad.OUT = false

  // ---- alarms -------------------------------------------------------------
  const malopt = num(b.p.MALOPT)
  const hhopt = num(b.p.HHAOPT)
  const dalopt = num(b.p.DALOPT)
  const oalopt = num(b.p.OALOPT)
  const eu = String(b.p.EI1)
  const conds: AlarmCond[] = [
    limitAlarm(b, 'HHABS', hhopt === 1 || hhopt === 2, true, meas, num(b.p.HHALIM), num(b.p.MEASDB), num(b.p.HHAPRI), String(b.p.HHATXT || 'HIGH-HIGH MEAS'), eu),
    limitAlarm(b, 'LLABS', hhopt === 1 || hhopt === 3, false, meas, num(b.p.LLALIM), num(b.p.MEASDB), num(b.p.HHAPRI), String(b.p.LLATXT || 'LOW-LOW MEAS'), eu),
    limitAlarm(b, 'HIABS', malopt === 1 || malopt === 2, true, meas, num(b.p.MEASHL), num(b.p.MEASDB), num(b.p.MEASPR), String(b.p.MEASHT || 'HIGH MEAS'), eu),
    limitAlarm(b, 'LOABS', malopt === 1 || malopt === 3, false, meas, num(b.p.MEASLL), num(b.p.MEASDB), num(b.p.MEASPR), String(b.p.MEASLT || 'LOW MEAS'), eu),
    limitAlarm(b, 'HIDEV', dalopt === 1 || dalopt === 2, true, meas - sp, num(b.p.HDALIM), num(b.p.DEVDB), num(b.p.DEVPRI), String(b.p.HDATXT || 'HIGH DEVIATION'), eu),
    limitAlarm(b, 'LODEV', dalopt === 1 || dalopt === 3, false, meas - sp, -num(b.p.LDALIM), num(b.p.DEVDB), num(b.p.DEVPRI), String(b.p.LDATXT || 'LOW DEVIATION'), eu),
    limitAlarm(b, 'HIOUT', oalopt === 1 || oalopt === 2, true, num(b.p.OUT), num(b.p.HOALIM), num(b.p.OUTDB), num(b.p.OUTPRI), String(b.p.HOATXT || 'HIGH OUTPUT'), String(b.p.EO1)),
    limitAlarm(b, 'LOOUT', oalopt === 1 || oalopt === 3, false, num(b.p.OUT), num(b.p.LOALIM), num(b.p.OUTDB), num(b.p.OUTPRI), String(b.p.LOATXT || 'LOW OUTPUT'), String(b.p.EO1)),
  ]
  b.p.MEASHI = conds[2].active || conds[0].active
  b.p.MEASLI = conds[3].active || conds[1].active
  ctx.alarm(b, conds)
}

export const PID: BlockTypeDef = {
  type: 'PID',
  family: 'control',
  desc: {
    en: 'PID controller: compares MEAS with SPT and computes OUT (P, I, PD, PI or PID per MODOPT). Auto/Manual, Local/Remote, bumpless transfer, absolute, deviation and output alarms.',
    ru: 'ПИД-регулятор: сравнивает MEAS с SPT и вычисляет OUT (P, I, PD, PI или PID по MODOPT). Auto/Manual, Local/Remote, безударное переключение, абсолютные, отклонения и выходные аварии.',
  },
  params: PID_PARAMS,
  init: pidInit,
  exec: pidExec,
  alarms: ['HIABS', 'LOABS', 'HHABS', 'LLABS', 'HIDEV', 'LODEV', 'HIOUT', 'LOOUT'],
}

export const PIDA: BlockTypeDef = {
  ...PID,
  type: 'PIDA',
  desc: {
    en: 'PIDA advanced PID. In this simulator it uses the PID algorithm and parameters (feedforward and adaptive options are not modelled).',
    ru: 'PIDA — расширенный PID. В тренажёре использует алгоритм и параметры PID (feedforward и адаптивные опции не моделируются).',
  },
}

/** RATIO — output = MEAS × RATIO + BIAS. */
export const RATIO: BlockTypeDef = {
  type: 'RATIO',
  family: 'control',
  desc: { en: 'Ratio station: OUT = MEAS × RATIO + BIAS (e.g. a ratio-of-flows setpoint).', ru: 'Ratio: OUT = MEAS × RATIO + BIAS (например, задание по соотношению расходов).' },
  params: [
    ...COMMON,
    P('MEAS', 'R', 0, 'in', 'Wild-flow measurement'),
    P('RATIO', 'R', 1, 'in', 'Ratio', { settable: true, group: 'tune' }),
    P('BIAS', 'R', 0, 'in', 'Bias', { settable: true, group: 'tune' }),
    P('HSCO1', 'R', 100, 'cfg', 'High output limit'),
    P('LSCO1', 'R', 0, 'cfg', 'Low output limit'),
    ...AM.slice(0, 2),
    P('OUT', 'R', 0, 'out', 'Output', { settable: true, group: 'control' }),
    ...ALARM_OUT,
  ],
  init: initMA,
  exec(b, ctx) {
    const auto = resolveMA(b, ctx)
    const m = ctx.input(b, 'MEAS')
    if (b.links.RATIO) b.p.RATIO = ctx.input(b, 'RATIO').v
    if (auto) b.p.OUT = clamp(num(m.v) * num(b.p.RATIO) + num(b.p.BIAS), num(b.p.LSCO1), num(b.p.HSCO1))
    b.bad.OUT = m.bad
    ctx.alarm(b, [])
  },
}
