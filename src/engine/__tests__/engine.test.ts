import { describe, expect, it } from 'vitest'
import { compileHlbl } from '../blocks/hlbl'
import { tank2Db } from '../presets'
import { executesOn } from '../scheduler'
import { ControlStation, parseRef } from '../station'

const lc = (s: ControlStation) => s.block('TANK2_COMP', 'LC100')!

describe('scheduler', () => {
  it('runs PERIOD 1 (0.5 s) every 10 BPC ticks and honours PHASE', () => {
    const ticks = Array.from({ length: 40 }, (_, i) => i).filter((t) => executesOn({ period: 1, phase: 0 }, t))
    expect(ticks).toEqual([0, 10, 20, 30])
    expect(executesOn({ period: 2, phase: 3 }, 23)).toBe(true)
  })
})

describe('references', () => {
  it('parses C:B.P and :B.P', () => {
    expect(parseRef('PROCESS_2:LAG_TM.OUT', 'X')).toEqual({ c: 'PROCESS_2', b: 'LAG_TM', p: 'OUT' })
    expect(parseRef(':LT100.PNT', 'TANK2_COMP')).toEqual({ c: 'TANK2_COMP', b: 'LT100', p: 'PNT' })
    expect(parseRef('LT100.PNT', 'X')).toBeUndefined()
  })
})

describe('TANK2 loop', () => {
  it('settles the level at SPT in Auto (PI control)', () => {
    const s = new ControlStation(tank2Db())
    s.run(600)
    expect(Number(lc(s).p.MEAS)).toBeCloseTo(5, 1)
    expect(Number(s.block('TANK2_COMP', 'LV100')!.p.OUT)).toBeCloseTo(50, 0)
  })

  it('follows a setpoint change and is bumpless on Auto → Manual → Auto', () => {
    const s = new ControlStation(tank2Db())
    s.run(300)
    expect(s.set('TANK2_COMP', 'LC100', 'OUT', 70)).toMatch(/Manual/)
    s.set('TANK2_COMP', 'LC100', 'MA', false)
    const out = Number(lc(s).p.OUT)
    s.run(5)
    s.set('TANK2_COMP', 'LC100', 'MA', true)
    s.run(0.5)
    expect(Math.abs(Number(lc(s).p.OUT) - out)).toBeLessThan(2)
    s.set('TANK2_COMP', 'LC100', 'SPT', 7)
    s.run(600)
    expect(Number(lc(s).p.MEAS)).toBeCloseTo(7, 1)
  })

  it('raises LOABS priority 1 and LODEV when the pump stops, honouring ACK', () => {
    const s = new ControlStation(tank2Db())
    s.run(300)
    s.set('PROCESS_2', 'MTR_CNTRL', 'MANRUN', false)
    s.run(200)
    const b = lc(s)
    expect(b.p.CRIT).toBe(1)
    expect(b.p.PRTYPE).toBe(2) // LOABS
    expect(b.p.UNACK).toBe(true)
    const cad = s.alarms.cad()
    expect(cad.map((a) => a.type)).toEqual(expect.arrayContaining(['LOABS', 'LODEV']))
    expect(cad.find((a) => a.type === 'LOABS')!.text).toBe('LEVEL GETTING TOO LOW')
    s.ack('TANK2_COMP:LC100')
    expect(lc(s).p.UNACK).toBe(false)
  })

  it('CINHIB 4 hides priority 4-5 alarms but not priority 1', () => {
    const s = new ControlStation(tank2Db())
    s.set('TANK2_COMP', 'LC100', 'MEASPR', 4, { config: true })
    s.set('TANK2_COMP', 'LC100', 'SPT', 1)
    s.run(400)
    expect(s.alarms.cad().some((a) => a.type === 'LOABS')).toBe(false)
  })

  it('refuses to set a connected parameter', () => {
    const s = new ControlStation(tank2Db())
    expect(s.set('TANK2_COMP', 'LC100', 'MEAS', 3)).toMatch(/connected/)
  })
})

describe('CALC', () => {
  it('computes inflow = valve × pump running × 0.1', () => {
    const s = new ControlStation(tank2Db())
    s.run(300)
    const f = s.block('PROCESS_2', 'FLOW_CALC')!
    expect(Number(f.p.RO01)).toBeCloseTo(Number(s.block('PROCESS_2', 'DEAD_TM')!.p.OUT) * 0.1, 3)
  })
})

describe('HLBL', () => {
  it('reports compile errors with the line number', () => {
    expect(compileHlbl('IF X > 1 THEN\nY := 2\n').error).toMatch(/ENDIF/)
    expect(compileHlbl('X := (1 + \n').error).toMatch(/line 1/)
  })

  it('runs the TANK2 fill sequence to completion', () => {
    const s = new ControlStation(tank2Db())
    s.set('PROCESS_2', 'MTR_CNTRL', 'MANRUN', false)
    s.set('TANK2_COMP', 'LC100', 'MA', false)
    s.set('TANK2_COMP', 'LC100', 'OUT', 0)
    s.run(300)
    expect(Number(lc(s).p.MEAS)).toBeLessThan(0.5)
    s.set('TANK2_SEQ', 'FILL', 'ACTIVE', true)
    s.run(30)
    expect(s.block('TANK2_SEQ', 'FILL')!.p.STATE).toBe('WAITING')
    s.run(600)
    const f = s.block('TANK2_SEQ', 'FILL')!
    expect(f.p.PERROR).toBe('')
    expect(f.p.STATE).toBe('DONE')
    expect(lc(s).p.MA).toBe(true)
    expect(s.alarms.history.some((h) => h.type === 'MSG' && h.text.includes('LC100 IN AUTO'))).toBe(true)
  })

  it('supports WHILE loops, variables and WAIT', () => {
    const s = new ControlStation(tank2Db())
    s.set('TANK2_SEQ', 'FILL', 'SOURCE', 'N := 0\nWHILE N < 3 DO\n  N := N + 1\n  WAIT 1\nENDWHILE\nTANK2_COMP:LC100.SPT := N\n', { config: true })
    s.set('TANK2_SEQ', 'FILL', 'ACTIVE', true)
    s.run(10)
    expect(lc(s).p.SPT).toBe(3)
  })
})
