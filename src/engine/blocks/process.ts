import type { BlockTypeDef } from '../types'
import { ALARM_OUT, AM, COMMON, P, bool, initMA, num, resolveMA } from './common'

/** LLAG — lead/lag. Used in the course's PROCESS_2 compound to simulate process lag (LAG_TM). */
export const LLAG: BlockTypeDef = {
  type: 'LLAG',
  family: 'process',
  desc: {
    en: 'Lead/Lag: OUT follows GAIN×MEAS through a first-order lag (LAGTIM) with optional lead (LEADTM). Times in minutes.',
    ru: 'Lead/Lag: OUT следует за GAIN×MEAS через инерционное звено первого порядка (LAGTIM) с опережением LEADTM. Время в минутах.',
  },
  params: [
    ...COMMON,
    P('MEAS', 'R', 0, 'in', 'Input'),
    P('LAGTIM', 'R', 0.2, 'in', 'Lag time constant, minutes', { settable: true, group: 'tune' }),
    P('LEADTM', 'R', 0, 'in', 'Lead time, minutes', { settable: true, group: 'tune' }),
    P('GAIN', 'R', 1, 'in', 'Gain', { settable: true, group: 'tune' }),
    P('BIAS', 'R', 0, 'in', 'Bias', { settable: true, group: 'tune' }),
    P('OUT', 'R', 0, 'out', 'Output', { group: 'control' }),
    ...ALARM_OUT,
  ],
  exec(b, ctx) {
    const m = ctx.input(b, 'MEAS')
    const u = num(m.v) * num(b.p.GAIN) + num(b.p.BIAS)
    const lag = Math.max(0, num(b.p.LAGTIM)) * 60
    const lead = Math.max(0, num(b.p.LEADTM)) * 60
    const prevU = (b.st.u as number) ?? u
    let y = (b.st.y as number) ?? u
    const x = u + (ctx.dt > 0 ? (lead * (u - prevU)) / ctx.dt : 0)
    y = lag > 0 ? y + ((x - y) * Math.min(1, ctx.dt / lag)) : x
    b.st.u = u
    b.st.y = y
    b.p.OUT = y
    b.bad.OUT = m.bad
    ctx.alarm(b, [])
  },
}

/** DTIME — dead time (transport delay). Used as DEAD_TM in PROCESS_2. */
export const DTIME: BlockTypeDef = {
  type: 'DTIME',
  family: 'process',
  desc: { en: 'Dead Time: OUT = MEAS delayed by DT minutes (transport delay).', ru: 'Dead Time: OUT = MEAS с задержкой DT минут (транспортное запаздывание).' },
  params: [
    ...COMMON,
    P('MEAS', 'R', 0, 'in', 'Input'),
    P('DT', 'R', 0.05, 'in', 'Dead time, minutes', { settable: true, group: 'tune' }),
    P('OUT', 'R', 0, 'out', 'Delayed output', { group: 'control' }),
    ...ALARM_OUT,
  ],
  exec(b, ctx) {
    const m = ctx.input(b, 'MEAS')
    const buf = (b.st.buf as { t: number; v: number }[]) ?? []
    buf.push({ t: ctx.time, v: num(m.v) })
    const cut = ctx.time - num(b.p.DT) * 60
    // keep the newest sample that is at least DT old, drop older ones
    while (buf.length > 1 && buf[1].t <= cut) buf.shift()
    b.st.buf = buf
    b.p.OUT = buf[0].v
    b.bad.OUT = m.bad
    ctx.alarm(b, [])
  },
}

/** MTR — motor control (start/stop with run feedback). PROCESS_2:MTR_CNTRL in the course labs. */
export const MTR: BlockTypeDef = {
  type: 'MTR',
  family: 'logic',
  desc: {
    en: 'Motor control: MANRUN (operator) or AUTRUN (auto) request starts the motor; MSTAT is the run feedback after FBTIME. TRIP stops it and raises a STATE alarm.',
    ru: 'Управление двигателем: запрос MANRUN (оператор) или AUTRUN (автомат) запускает двигатель; MSTAT — обратная связь «в работе» через FBTIME. TRIP останавливает его с аварией STATE.',
  },
  params: [
    ...COMMON,
    ...AM,
    P('MANRUN', 'B', false, 'in', 'Manual run request (operator START/STOP)', { settable: true, group: 'control' }),
    P('AUTRUN', 'B', false, 'in', 'Auto run request', { group: 'control' }),
    P('TRIP', 'B', false, 'in', 'Trip / fault input', { settable: true, group: 'control' }),
    P('FBTIME', 'R', 1.5, 'cfg', 'Feedback delay, seconds', { group: 'tune' }),
    P('MSTAT', 'B', false, 'out', 'Motor status: true = running', { group: 'control' }),
    P('SAO', 'I', 1, 'cfg', 'State (trip) alarm option', { group: 'alarm' }),
    P('SAP', 'I', 2, 'cfg', 'State alarm priority', { group: 'alarm' }),
    ...ALARM_OUT,
  ],
  init: (b) => {
    initMA(b)
    b.p.MA = false
  },
  exec(b, ctx) {
    const auto = resolveMA(b, ctx)
    if (b.links.TRIP) b.p.TRIP = bool(ctx.input(b, 'TRIP').v)
    if (b.links.MANRUN) b.p.MANRUN = bool(ctx.input(b, 'MANRUN').v)
    const req = auto ? bool(ctx.input(b, 'AUTRUN').v) : bool(b.p.MANRUN)
    const trip = bool(b.p.TRIP)
    const want = req && !trip
    const since = (b.st.since as number) ?? ctx.time
    if (want !== b.st.want) b.st.since = ctx.time
    b.st.want = want
    if (!want) b.p.MSTAT = false
    else if (ctx.time - ((b.st.since as number) ?? since) >= num(b.p.FBTIME)) b.p.MSTAT = true
    ctx.alarm(b, [{ type: 'STATE', active: num(b.p.SAO) > 0 && trip, pri: num(b.p.SAP) || 2, text: 'MOTOR TRIPPED' }])
  },
}
