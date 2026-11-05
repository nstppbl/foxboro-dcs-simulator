import type { BlockTypeDef } from '../types'
import { ALARM_OUT, AM, BAD_ALARM, COMMON, IO, P, badAlarm, bool, clamp, initMA, limitAlarm, num, resolveMA } from './common'

/** AIN — Analog Input (manual 2001V8 p. 4-15). */
export const AIN: BlockTypeDef = {
  type: 'AIN',
  family: 'io',
  desc: {
    en: 'Analog Input: reads one FBM point (or another block), applies signal conditioning and engineering-unit scaling, detects BAD and out-of-range.',
    ru: 'Analog Input: читает одну точку FBM (или другой блок), выполняет преобразование сигнала и масштабирование в инженерные единицы, обнаруживает BAD и выход за диапазон.',
  },
  params: [
    ...COMMON,
    ...IO,
    P('MEAS', 'R', 0, 'in', 'Measurement input when IOMOPT = 0 or 2', { group: 'io' }),
    P('SCI', 'I', 3, 'cfg', 'Signal conditioning index (3 = linear 4-20 mA)', { group: 'io', src: '4-33' }),
    P('HSCO1', 'R', 100, 'cfg', 'High scale, output range 1', { group: 'io', src: '4-34' }),
    P('LSCO1', 'R', 0, 'cfg', 'Low scale, output range 1', { group: 'io', src: '4-34' }),
    P('EO1', 'S', '%', 'cfg', 'Engineering units, output range 1', { group: 'io' }),
    P('DELTO1', 'R', 0.1, 'cfg', 'Change-driven delta for output (% of span)', { group: 'io', src: '4-35' }),
    P('FTIME', 'R', 0, 'cfg', 'First-order filter time constant (s)', { group: 'io' }),
    ...AM.slice(0, 2),
    P('PNT', 'R', 0, 'out', 'Point value in engineering units', { settable: true, group: 'control' }),
    P('BAD', 'B', false, 'out', 'Input is BAD (FBM/channel failure or bad link)', { group: 'status' }),
    P('OOR', 'B', false, 'out', 'Input is out of range', { group: 'status' }),
    P('PNTNM', 'S', '', 'cfg', 'Point alarm name (≤12 chars)', { group: 'alarm' }),
    P('HLOP', 'I', 0, 'cfg', 'High/low absolute alarm option: 0 none, 1 both, 2 high, 3 low', { group: 'alarm' }),
    P('HAL', 'R', 100, 'cfg', 'High absolute alarm limit (HIABS)', { settable: true, group: 'alarm' }),
    P('LAL', 'R', 0, 'cfg', 'Low absolute alarm limit (LOABS)', { settable: true, group: 'alarm' }),
    P('HLDB', 'R', 0, 'cfg', 'High/low alarm deadband', { group: 'alarm' }),
    P('HLPR', 'I', 3, 'cfg', 'High/low alarm priority 1-5', { settable: true, group: 'alarm' }),
    P('HATXT', 'S', '', 'cfg', 'High alarm text (≤28 chars)', { group: 'alarm' }),
    P('LATXT', 'S', '', 'cfg', 'Low alarm text (≤28 chars)', { group: 'alarm' }),
    ...BAD_ALARM,
    ...ALARM_OUT,
  ],
  init: initMA,
  alarms: ['BAD', 'OOR', 'HIABS', 'LOABS'],
  exec(b, ctx) {
    const auto = resolveMA(b, ctx)
    const hi = num(b.p.HSCO1)
    const lo = num(b.p.LSCO1)
    let bad = false
    let oor = false
    let value = num(b.p.PNT)
    const opt = num(b.p.IOMOPT)
    if (opt === 1) {
      const r = ctx.field.read(String(b.p.IOM_ID), num(b.p.PNT_NO))
      if (!r || r.bad) bad = true
      else {
        oor = r.v < -2.5 || r.v > 102.5 // beyond 3.6 / 20.4 mA
        value = lo + (clamp(r.v, -5, 105) / 100) * (hi - lo)
      }
    } else {
      const r = ctx.input(b, 'MEAS')
      bad = r.bad
      const m = num(r.v)
      value = opt === 0 ? lo + (m / 100) * (hi - lo) : m
    }
    if (auto) {
      const ft = num(b.p.FTIME)
      if (ft > 0 && !bad) value = num(b.p.PNT) + (value - num(b.p.PNT)) * Math.min(1, ctx.dt / ft)
      if (!bad) b.p.PNT = value
    }
    b.p.BAD = bad
    b.p.OOR = oor
    b.bad.PNT = bad
    const hl = num(b.p.HLOP)
    const pv = num(b.p.PNT)
    const eu = String(b.p.EO1)
    ctx.alarm(b, [
      badAlarm(b, bad),
      { type: 'OOR', active: num(b.p.BAO) > 0 && oor && !bad, pri: num(b.p.BAP) || 3, text: 'OUT OF RANGE' },
      limitAlarm(b, 'HIABS', (hl === 1 || hl === 2) && !bad, true, pv, num(b.p.HAL), num(b.p.HLDB), num(b.p.HLPR), String(b.p.HATXT || 'HIGH'), eu),
      limitAlarm(b, 'LOABS', (hl === 1 || hl === 3) && !bad, false, pv, num(b.p.LAL), num(b.p.HLDB), num(b.p.HLPR), String(b.p.LATXT || 'LOW'), eu),
    ])
  },
}

/** AOUT — Analog Output (manual 2001V8 p. 4-17). */
export const AOUT: BlockTypeDef = {
  type: 'AOUT',
  family: 'io',
  desc: {
    en: 'Analog Output: sends a controller output to an FBM analog output channel (valve), provides back-calculation (BCALCO) for bumpless transfer.',
    ru: 'Analog Output: передаёт выход регулятора на аналоговый выход FBM (клапан), формирует обратный расчёт BCALCO для безударного переключения.',
  },
  params: [
    ...COMMON,
    ...IO,
    P('MEAS', 'R', 0, 'in', 'Input value (normally linked from PID.OUT)', { group: 'control' }),
    P('SCO', 'I', 3, 'cfg', 'Output signal conditioning index', { group: 'io' }),
    P('HSCO1', 'R', 100, 'cfg', 'High scale, output', { group: 'io' }),
    P('LSCO1', 'R', 0, 'cfg', 'Low scale, output', { group: 'io' }),
    P('EO1', 'S', '%', 'cfg', 'Engineering units', { group: 'io' }),
    ...AM,
    P('OUT', 'R', 0, 'out', 'Output value (settable in Manual)', { settable: true, group: 'control' }),
    P('BCALCO', 'R', 0, 'out', 'Back-calculated output to the upstream BCALCI', { group: 'control', src: '4-31' }),
    P('BAD', 'B', false, 'out', 'Output channel BAD', { group: 'status' }),
    ...BAD_ALARM,
    ...ALARM_OUT,
  ],
  init: initMA,
  alarms: ['BAD'],
  exec(b, ctx) {
    const auto = resolveMA(b, ctx)
    const hi = num(b.p.HSCO1)
    const lo = num(b.p.LSCO1)
    const r = ctx.input(b, 'MEAS')
    if (auto && !r.bad) b.p.OUT = clamp(num(r.v), lo, hi)
    b.p.OUT = clamp(num(b.p.OUT), lo, hi)
    b.p.BCALCO = b.p.OUT
    // BCALCO carries "open loop" status upstream when this block is in Manual
    b.st.openLoop = !auto
    let bad = false
    if (num(b.p.IOMOPT) === 1) {
      const id = String(b.p.IOM_ID)
      const pct = ((num(b.p.OUT) - lo) / (hi - lo || 1)) * 100
      ctx.field.write(id, num(b.p.PNT_NO), pct)
      bad = !ctx.field.read(id, num(b.p.PNT_NO)) || !!ctx.field.read(id, num(b.p.PNT_NO))?.bad
    }
    b.p.BAD = bad
    ctx.alarm(b, [badAlarm(b, bad)])
  },
}

/** DIN — Digital Input. */
export const DIN: BlockTypeDef = {
  type: 'DIN',
  family: 'io',
  desc: { en: 'Digital Input: reads one discrete FBM point (contact).', ru: 'Digital Input: читает одну дискретную точку FBM (контакт).' },
  params: [
    ...COMMON,
    ...IO,
    P('IN', 'B', false, 'in', 'Input when IOMOPT = 0'),
    P('INVCIN', 'B', false, 'cfg', 'Invert contact input'),
    ...AM.slice(0, 2),
    P('CIN', 'B', false, 'out', 'Contact input value', { settable: true, group: 'control' }),
    P('BAD', 'B', false, 'out', 'Input BAD', { group: 'status' }),
    ...BAD_ALARM,
    ...ALARM_OUT,
  ],
  init: initMA,
  exec(b, ctx) {
    const auto = resolveMA(b, ctx)
    let v = bool(b.p.CIN)
    let bad = false
    if (num(b.p.IOMOPT) === 1) {
      const r = ctx.field.read(String(b.p.IOM_ID), num(b.p.PNT_NO))
      bad = !r || r.bad
      if (r) v = r.v > 0.5
    } else {
      const r = ctx.input(b, 'IN')
      bad = r.bad
      v = bool(r.v)
    }
    if (bool(b.p.INVCIN)) v = !v
    if (auto && !bad) b.p.CIN = v
    b.p.BAD = bad
    ctx.alarm(b, [badAlarm(b, bad)])
  },
}

/** DOUT — Digital Output. */
export const DOUT: BlockTypeDef = {
  type: 'DOUT',
  family: 'io',
  desc: { en: 'Digital Output: drives one discrete FBM output (solenoid, starter).', ru: 'Digital Output: управляет одним дискретным выходом FBM (соленоид, пускатель).' },
  params: [
    ...COMMON,
    ...IO,
    P('IN', 'B', false, 'in', 'Requested output state'),
    ...AM,
    P('COUT', 'B', false, 'out', 'Contact output (settable in Manual)', { settable: true, group: 'control' }),
    ...ALARM_OUT,
  ],
  init: initMA,
  exec(b, ctx) {
    const auto = resolveMA(b, ctx)
    if (auto) b.p.COUT = bool(ctx.input(b, 'IN').v)
    if (num(b.p.IOMOPT) === 1) ctx.field.write(String(b.p.IOM_ID), num(b.p.PNT_NO), bool(b.p.COUT) ? 1 : 0)
    ctx.alarm(b, [])
  },
}
