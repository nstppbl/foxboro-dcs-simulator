import { DEFAULT_HLBL } from './blocks/hlbl'
import { newBlock } from './registry'
import type { Block, StationDb, Val } from './types'
import { key } from './types'

interface Spec {
  name: string
  type: string
  p?: Record<string, Val>
  links?: Record<string, string>
}

function build(letterbug: string, compounds: { name: string; p?: Record<string, Val>; blocks: Spec[] }[]): StationDb {
  const db: StationDb = { letterbug, compounds: [], cmp: {}, blk: {} }
  for (const c of compounds) {
    db.compounds.push(c.name)
    db.cmp[c.name] = { name: c.name, p: { DESCRP: '', ON: true, CINHIB: 0, PERIOD: 1, PHASE: 0, ...c.p }, blocks: c.blocks.map((b) => b.name) }
    for (const s of c.blocks) db.blk[key(c.name, s.name)] = newBlock(c.name, s.name, s.type, s.p, s.links) as Block
  }
  return db
}

/**
 * TANK2 lab database (manual 2001V8, LAB 1, Tables 8-14) on CP2701.
 *
 * PROCESS_2 is the course's process-simulation compound: the valve signal is
 * delayed (DEAD_TM), multiplied by the pump status (FLOW_CALC) and lagged
 * (LAG_TM) to give the tank level in INCHES, which LT100 reads with IOMOPT 2.
 */
export function tank2Db(): StationDb {
  return build('CP2701', [
    {
      name: 'TANK2_COMP',
      p: { DESCRP: 'TANK2 LEVEL CONTROL', CINHIB: 4, LOOPID: 'TANK2' },
      blocks: [
        {
          name: 'LT100',
          type: 'AIN',
          p: { DESCRP: 'TANK2 LEVEL MEAS', LOOPID: 'TANK2', IOMOPT: 2, IOM_ID: 'AIO001', PNT_NO: 4, SCI: 3, HSCO1: 10, LSCO1: 0, DELTO1: 0.1, EO1: 'INCHES', BAO: 1, BAT: 'PLACE LC100 IN MANUAL', BAP: 1, BAG: 1 },
          links: { MEAS: 'PROCESS_2:LAG_TM.OUT' },
        },
        {
          name: 'LC100',
          type: 'PID',
          p: {
            DESCRP: 'TANK2 LEVEL CNTRL', LOOPID: 'TANK2', HSCI1: 10, LSCI1: 0, DELTI1: 0.1, EI1: 'INCHES', SPT: 5, MODOPT: 4, PBAND: 30, INT: 0.2,
            MEASNM: 'TANK2 LEVEL', MALOPT: 1, MEASHL: 8, MEASLL: 2, MEASHT: 'LEVEL GETTING TOO HIGH', MEASLT: 'LEVEL GETTING TOO LOW', MEASDB: 0.5, MEASPR: 1, MEASGR: 1,
            DALOPT: 1, HDALIM: 2, LDALIM: 2, HDATXT: 'LEVEL TOO FAR ABOVE SPT', LDATXT: 'LEVEL TOO FAR BELOW SPT', DEVDB: 0.5, DEVPRI: 2,
          },
          links: { MEAS: ':LT100.PNT', FBK: ':LV100.BCALCO', BCALCI: ':LV100.BCALCO' },
        },
        {
          name: 'LV100',
          type: 'AOUT',
          p: { DESCRP: 'INFLOW VALVE POS', LOOPID: 'TANK2', IOMOPT: 2, IOM_ID: 'AIO001', PNT_NO: 8, SCO: 3, INITMA: 1, BAO: 1, BAT: 'INFLOW VALVE SIGNAL BAD', BAP: 1 },
          links: { MEAS: ':LC100.OUT' },
        },
      ],
    },
    {
      name: 'PROCESS_2',
      p: { DESCRP: 'TANK2 PROCESS SIMULATION' },
      blocks: [
        { name: 'MTR_CNTRL', type: 'MTR', p: { DESCRP: 'TANK2 INFLOW PUMP', LOOPID: 'TANK2', MANRUN: true, INITMA: 0 } },
        { name: 'DEAD_TM', type: 'DTIME', p: { DESCRP: 'VALVE TO FLOW DEAD TIME', DT: 0.1 }, links: { MEAS: 'TANK2_COMP:LV100.OUT' } },
        {
          name: 'FLOW_CALC',
          type: 'CALC',
          p: { DESCRP: 'INFLOW = VALVE x PUMP RUNNING', RI02: 0.1, STEP01: 'IN RI01', STEP02: 'IN BI01', STEP03: 'MUL', STEP04: 'IN RI02', STEP05: 'MUL', STEP06: 'OUT RO01', STEP07: 'END' },
          links: { RI01: ':DEAD_TM.OUT', BI01: ':MTR_CNTRL.MSTAT' },
        },
        { name: 'LAG_TM', type: 'LLAG', p: { DESCRP: 'TANK2 LEVEL LAG (INCHES)', LAGTIM: 0.5 }, links: { MEAS: ':FLOW_CALC.RO01' } },
      ],
    },
    {
      name: 'TANK2_SEQ',
      p: { DESCRP: 'TANK2 FILL SEQUENCE (HLBL)' },
      blocks: [{ name: 'FILL', type: 'HLBL', p: { DESCRP: 'FILL TANK2 THEN AUTO', SOURCE: DEFAULT_HLBL } }],
    },
  ])
}

export const STATION_PRESETS = { tank2: tank2Db }
export type StationPresetId = keyof typeof STATION_PRESETS
