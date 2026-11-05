import { describe, expect, it } from 'vitest'
import { toStationDb, validateCfg } from '../config'
import { scenario, SCENARIOS } from '../scenarios'
import { ControlStation } from '../station'

function start(id: string) {
  const sc = scenario(id)
  const plant = sc.plant?.()
  const st = new ControlStation(toStationDb(sc.cfg()), plant?.field())
  if (plant) st.onTick = (dt) => plant.step(dt)
  return { st, plant: plant! }
}
const n = (v: unknown) => Number(v)

describe('scenarios', () => {
  it.each(SCENARIOS.map((s) => s.id))('%s validates without errors', (id) => {
    expect(validateCfg(scenario(id).cfg()).filter((i) => i.sev === 'error')).toEqual([])
  })

  it('tank T-101 holds level and rejects a draw-off step', () => {
    const { st, plant } = start('tank')
    st.run(1200)
    expect(Math.abs(n(st.block('TANK101', 'LIC101')!.p.MEAS) - 2.5)).toBeLessThan(0.1)
    plant.dist.OUTFLOW = 18
    st.run(1800)
    expect(Math.abs(n(st.block('TANK101', 'LIC101')!.p.MEAS) - 2.5)).toBeLessThan(0.1)
  })

  it('flow line follows setpoint; stopping the pump drops flow and running feedback', () => {
    const { st } = start('flow')
    st.run(120)
    expect(n(st.block('FLOW201', 'FIC201')!.p.MEAS)).toBeGreaterThan(23)
    expect(n(st.block('FLOW201', 'FIC201')!.p.MEAS)).toBeLessThan(27)
    expect(st.block('FLOW201', 'YS201')!.p.CIN).toBe(true)
    st.set('FLOW201', 'P201', 'COUT', false)
    st.run(30)
    expect(st.block('FLOW201', 'YS201')!.p.CIN).toBe(false)
    expect(n(st.block('FLOW201', 'FT201')!.p.PNT)).toBeLessThan(3)
  })

  it('heat exchanger reaches 70 C and recovers from a flow increase', () => {
    const { st, plant } = start('hex')
    st.run(1500)
    expect(n(st.block('HEX301', 'TIC301')!.p.MEAS)).toBeCloseTo(70, 0)
    plant.dist.FLOW = 14
    st.run(1500)
    expect(Math.abs(n(st.block('HEX301', 'TIC301')!.p.MEAS) - 70)).toBeLessThan(1.5)
  })

  it('batch reactor runs the whole recipe to BATCH COMPLETE', () => {
    const { st, plant } = start('batch')
    st.set('R401_SEQ', 'PHASES', 'ACTIVE', true)
    let maxT = 0
    for (let i = 0; i < 9000 && st.block('R401_SEQ', 'PHASES')!.p.STATE !== 'DONE'; i++) {
      st.run(1)
      maxT = Math.max(maxT, n(st.block('REACTOR', 'TT401')!.p.PNT))
    }
    const ph = st.block('R401_SEQ', 'PHASES')!
    expect(ph.p.PERROR).toBe('')
    expect(ph.p.STATE).toBe('DONE')
    expect(st.block('R401_SEQ', 'RECIPE')!.p.RO01).toBe(7)
    expect((plant as unknown as { conversion(): number }).conversion()).toBeGreaterThan(88)
    expect(maxT).toBeLessThan(90) // cascade keeps the exotherm below the HIGH alarm
    expect(st.alarms.history.some((h) => h.type === 'MSG' && h.text === 'BATCH COMPLETE')).toBe(true)
  })

  it('batch reactor: agitator failure during REACT holds the batch', () => {
    const { st, plant } = start('batch')
    st.set('R401_SEQ', 'PHASES', 'ACTIVE', true)
    for (let i = 0; i < 6000 && n(st.block('R401_SEQ', 'RECIPE')!.p.RO01) !== 4; i++) st.run(1)
    plant.act('agit')
    st.run(30)
    expect(st.block('R401_SEQ', 'RECIPE')!.p.RO01).toBe(9)
  })

  it('WFI loop stays hot and diverts on high conductivity', () => {
    const { st, plant } = start('wfi')
    st.run(900)
    expect(n(st.block('WFI501', 'TIC502')!.p.MEAS)).toBeCloseTo(80, 0)
    expect(st.block('WFI501', 'XV503')!.p.COUT).toBe(false)
    plant.dist.COND = 2
    st.run(120)
    expect(st.block('WFI501', 'XV503')!.p.COUT).toBe(true)
    expect(st.alarms.cad().some((a) => a.ref === 'WFI501:AT503' && a.type === 'HIABS')).toBe(true)
  })

  it('CIP program completes', () => {
    const { st } = start('cip')
    st.set('CIP_SEQ', 'CIP_PROG', 'ACTIVE', true)
    for (let i = 0; i < 400 && st.block('CIP_SEQ', 'CIP_PROG')!.p.STATE !== 'DONE'; i++) st.run(10)
    const p = st.block('CIP_SEQ', 'CIP_PROG')!
    expect(p.p.PERROR).toBe('')
    expect(p.p.STATE).toBe('DONE')
  })
})
