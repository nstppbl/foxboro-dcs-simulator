import { describe, expect, it } from 'vitest'
import { compareToCp, cloneCfg, fromStationDb, renameBlock, toStationDb, validateCfg } from '../config'
import { tank2Db } from '../presets'
import { ControlStation } from '../station'
import { lab1Cfg, labCfg, useEng } from '../../store/engineering'
import { useSim } from '../../store/sim'

describe('configuration database', () => {
  it('the TANK2 lab validates without errors or warnings', () => {
    const issues = validateCfg(labCfg())
    expect(issues.filter((i) => i.sev !== 'info')).toEqual([])
  })

  it('round-trips CP database → configuration → CP database', () => {
    const cfg = fromStationDb(tank2Db())
    const s = new ControlStation(toStationDb(cfg))
    s.run(600)
    expect(Number(s.block('TANK2_COMP', 'LC100')!.p.MEAS)).toBeCloseTo(5, 1)
  })

  it('finds typical configuration errors', () => {
    const cfg = labCfg()
    const t = cfg.compounds[0]
    const lc = t.blocks.find((b) => b.name === 'LC100')!
    lc.links.MEAS = ':LT10.PNT'
    lc.v.PERIOD = 0 // 0.1 s, faster than compound PERIOD 1
    delete lc.links.BCALCI
    const msgs = validateCfg(cfg).map((i) => `${i.sev} ${i.ref}.${i.param} ${i.msg.en}`)
    expect(msgs.some((m) => m.startsWith('error') && m.includes('LT10 does not exist'))).toBe(true)
    expect(msgs.some((m) => m.startsWith('error') && m.includes('faster than the compound PERIOD'))).toBe(true)
    expect(msgs.some((m) => m.startsWith('warning') && m.includes('bumpless'))).toBe(true)
  })

  it('rename fixes connections in other blocks and compounds', () => {
    const cfg = labCfg()
    renameBlock(cfg, 'TANK2_COMP', 'LV100', 'LV101')
    const t = cfg.compounds[0]
    expect(t.blocks.find((b) => b.name === 'LC100')!.links.BCALCI).toBe(':LV101.BCALCO')
    const dead = cfg.compounds[1].blocks.find((b) => b.name === 'DEAD_TM')!
    expect(dead.links.MEAS).toBe('TANK2_COMP:LV101.OUT')
    expect(validateCfg(cfg).filter((i) => i.sev === 'error')).toEqual([])
  })

  it('Compare to CP reports DB ONLY / CP ONLY / DIFFERENT', () => {
    const cp = labCfg()
    const cfg = cloneCfg(cp)
    cfg.compounds[0].blocks = cfg.compounds[0].blocks.filter((b) => b.name !== 'LV100')
    cfg.compounds[0].blocks.find((b) => b.name === 'LC100')!.v.PBAND = 50
    cfg.compounds[0].blocks.push({ name: 'LT101', type: 'AIN', v: {}, links: {}, x: 0, y: 0 })
    const rows = compareToCp(cfg, cp)
    expect(rows.find((r) => r.ref === 'TANK2_COMP:LV100')!.where).toBe('CP ONLY')
    expect(rows.find((r) => r.ref === 'TANK2_COMP:LT101')!.where).toBe('DB ONLY')
    expect(rows.find((r) => r.ref === 'TANK2_COMP:LC100')!.detail).toContain('PBAND')
  })
})

describe('LAB 1 through the engineering store', () => {
  it('builds TANK2_COMP, downloads it and the loop controls', () => {
    const e = useEng.getState()
    e.resetLab('lab1')
    expect(lab1Cfg().compounds[0].blocks).toEqual([])
    const add = (type: string, name: string) => {
      useEng.getState().addBlock(type)
      useEng.getState().rename('TANK2_COMP', useEng.getState().selB!, name)
    }
    add('AIN', 'LT100')
    add('PID', 'LC100')
    add('AOUT', 'LV100')
    const sv = (b: string, p: string, v: string) => expect(useEng.getState().setValue('TANK2_COMP', b, p, v)).toBe(true)
    sv('LT100', 'IOMOPT', '2')
    sv('LT100', 'HSCO1', '10')
    sv('LT100', 'MEAS', 'PROCESS_2:LAG_TM.OUT') // ICC style: a C:B.P string makes a connection
    sv('LC100', 'MEAS', ':LT100.PNT')
    sv('LC100', 'HSCI1', '10')
    sv('LC100', 'SPT', '5')
    sv('LC100', 'MODOPT', '4')
    sv('LC100', 'PBAND', '30')
    sv('LC100', 'INT', '0.2')
    sv('LC100', 'BCALCI', ':LV100.BCALCO')
    sv('LC100', 'FBK', ':LV100.BCALCO')
    sv('LV100', 'IOMOPT', '2')
    sv('LV100', 'MEAS', ':LC100.OUT')
    expect(useEng.getState().setLink('PROCESS_2', 'DEAD_TM', 'MEAS', 'TANK2_COMP:LV100.OUT')).toBe(true)
    expect(useEng.getState().cfg.compounds[0].blocks.find((b) => b.name === 'LT100')!.links.MEAS).toBe('PROCESS_2:LAG_TM.OUT')
    expect(useEng.getState().download()).toBe(true)
    const st = useSim.getState().station
    st.run(900)
    expect(Number(st.block('TANK2_COMP', 'LC100')!.p.MEAS)).toBeCloseTo(5, 1)
  })

  it('refuses to download with validation errors', () => {
    useEng.getState().resetLab('full')
    useEng.getState().setLink('TANK2_COMP', 'LC100', 'MEAS', ':NOPE.PNT')
    expect(useEng.getState().download()).toBe(false)
  })

  it('a download keeps the running loop bumpless and applies a tuning change', () => {
    useEng.getState().resetLab('full')
    const before = Number(useSim.getState().station.block('TANK2_COMP', 'LV100')!.p.OUT)
    useEng.getState().setValue('TANK2_COMP', 'LC100', 'PBAND', '50')
    expect(useEng.getState().download()).toBe(true)
    const st = useSim.getState().station
    expect(st.block('TANK2_COMP', 'LC100')!.p.PBAND).toBe(50)
    st.run(1)
    expect(Math.abs(Number(st.block('TANK2_COMP', 'LV100')!.p.OUT) - before)).toBeLessThan(1)
  })
})
