import type { Bilingual } from '../domain/hardware/catalog'
import { fromStationDb, type CfgBlock, type CfgDb } from './config'
import type { Plant } from './process/plant'
import { BatchReactorPlant, CipPlant, FlowPlant, HexPlant, TankPlant, WfiPlant } from './process/models'
import { tank2Db } from './presets'
import type { Val } from './types'

export interface Scenario {
  id: string
  title: Bilingual
  desc: Bilingual
  pharma?: boolean
  cfg: () => CfgDb
  plant?: () => Plant
}

const B = (name: string, type: string, v: Record<string, Val>, links: Record<string, string>, x: number, y: number): CfgBlock => ({ name, type, v, links, x, y })
const ai = (name: string, fbm: string, pnt: number, hi: number, eu: string, descrp: string, extra: Record<string, Val> = {}, x = 40, y = 40) =>
  B(name, 'AIN', { DESCRP: descrp, IOMOPT: 1, IOM_ID: fbm, PNT_NO: pnt, HSCO1: hi, EO1: eu, BAO: 1, BAT: `${name} SIGNAL BAD`, BAP: 2, ...extra }, {}, x, y)
const aout = (name: string, fbm: string, pnt: number, descrp: string, meas: string, x: number, y: number, extra: Record<string, Val> = {}) =>
  B(name, 'AOUT', { DESCRP: descrp, IOMOPT: 1, IOM_ID: fbm, PNT_NO: pnt, ...extra }, meas ? { MEAS: meas } : {}, x, y)
const dout = (name: string, fbm: string, pnt: number, descrp: string, x: number, y: number, extra: Record<string, Val> = {}) => B(name, 'DOUT', { DESCRP: descrp, IOMOPT: 1, IOM_ID: fbm, PNT_NO: pnt, ...extra }, {}, x, y)
const din = (name: string, fbm: string, pnt: number, descrp: string, x: number, y: number) => B(name, 'DIN', { DESCRP: descrp, IOMOPT: 1, IOM_ID: fbm, PNT_NO: pnt }, {}, x, y)
const cmp = (name: string, descrp: string, blocks: CfgBlock[], p: Record<string, Val> = {}) => ({ name, p: { DESCRP: descrp, PERIOD: 1, PHASE: 0, CINHIB: 0, ON: true, ...p }, blocks })

// ------------------------------------------------------------------ TANK2 (course LAB 1)
const TANK2_LAYOUT: Record<string, [number, number]> = {
  'TANK2_COMP:LT100': [40, 60],
  'TANK2_COMP:LC100': [330, 60],
  'TANK2_COMP:LV100': [620, 60],
  'PROCESS_2:DEAD_TM': [40, 60],
  'PROCESS_2:FLOW_CALC': [330, 60],
  'PROCESS_2:LAG_TM': [620, 60],
  'PROCESS_2:MTR_CNTRL': [40, 280],
  'TANK2_SEQ:FILL': [40, 60],
}

export function labCfg(): CfgDb {
  const cfg = fromStationDb(tank2Db())
  for (const c of cfg.compounds)
    for (const b of c.blocks) {
      const p = TANK2_LAYOUT[`${c.name}:${b.name}`]
      if (p) [b.x, b.y] = p
    }
  return cfg
}

/** LAB 1 exercise: TANK2_COMP exists but is empty; the trainee builds LT100, LC100, LV100. */
export function lab1Cfg(): CfgDb {
  const cfg = labCfg()
  cfg.compounds.find((c) => c.name === 'TANK2_COMP')!.blocks = []
  cfg.compounds.find((c) => c.name === 'PROCESS_2')!.blocks.find((b) => b.name === 'DEAD_TM')!.links = {}
  cfg.compounds = cfg.compounds.filter((c) => c.name !== 'TANK2_SEQ')
  return cfg
}

// ------------------------------------------------------------------ TANK T-101
function tankCfg(): CfgDb {
  return {
    letterbug: 'CP2701',
    compounds: [
      cmp('TANK101', 'T-101 LEVEL CONTROL', [
        ai('LT101', 'TK1AI1', 1, 5, 'M', 'T-101 LEVEL', { LOOPID: 'T101', HLOP: 1, HAL: 4.5, LAL: 0.5, HLPR: 2, HATXT: 'T-101 LEVEL HIGH', LATXT: 'T-101 LEVEL LOW', PNTNM: 'T101 LEVEL' }, 40, 60),
        ai('FT101', 'TK1AI1', 2, 30, 'M3/H', 'T-101 INLET FLOW', {}, 40, 200),
        ai('FT102', 'TK1AI1', 3, 30, 'M3/H', 'T-101 OUTLET FLOW', {}, 40, 320),
        B('LIC101', 'PID', { DESCRP: 'T-101 LEVEL CONTROL', LOOPID: 'T101', HSCI1: 5, EI1: 'M', SPT: 2.5, MODOPT: 4, PBAND: 40, INT: 4, MALOPT: 1, MEASHL: 4.2, MEASLL: 0.8, MEASHT: 'T-101 LEVEL HIGH', MEASLT: 'T-101 LEVEL LOW', MEASPR: 2, MEASNM: 'T101 LEVEL' }, { MEAS: ':LT101.PNT', BCALCI: ':LV101.BCALCO' }, 330, 60),
        aout('LV101', 'TK1AO1', 1, 'T-101 INLET VALVE', ':LIC101.OUT', 620, 60),
      ]),
    ],
  }
}

// ------------------------------------------------------------------ FLOW LINE
function flowCfg(): CfgDb {
  return {
    letterbug: 'CP2701',
    compounds: [
      cmp('FLOW201', 'P-201 FLOW CONTROL', [
        ai('FT201', 'FL2AI1', 1, 50, 'M3/H', 'P-201 DISCHARGE FLOW', { LOOPID: 'F201' }, 40, 60),
        ai('PT202', 'FL2AI1', 2, 10, 'BAR', 'P-201 DISCHARGE PRESS', { HLOP: 2, HAL: 9, HLPR: 2, HATXT: 'DISCHARGE PRESSURE HIGH' }, 40, 200),
        B('FIC201', 'PID', { DESCRP: 'P-201 FLOW CONTROL', LOOPID: 'F201', HSCI1: 50, EI1: 'M3/H', SPT: 25, MODOPT: 4, PBAND: 200, INT: 0.04, DALOPT: 1, HDALIM: 5, LDALIM: 5, DEVPRI: 3, HDATXT: 'FLOW ABOVE SETPOINT', LDATXT: 'FLOW BELOW SETPOINT' }, { MEAS: ':FT201.PNT', BCALCI: ':FV201.BCALCO' }, 330, 60),
        aout('FV201', 'FL2AO1', 1, 'P-201 FLOW VALVE', ':FIC201.OUT', 620, 60),
        dout('P201', 'FL2DO1', 1, 'P-201 START (MANUAL: SET COUT)', 330, 260, { INITMA: 0, COUT: true }),
        din('YS201', 'FL2DI1', 1, 'P-201 RUNNING', 620, 260),
      ]),
    ],
  }
}

// ------------------------------------------------------------------ HEAT EXCHANGER
function hexCfg(): CfgDb {
  return {
    letterbug: 'CP2701',
    compounds: [
      cmp('HEX301', 'E-301 OUTLET TEMPERATURE', [
        ai('TT301', 'HX3AI1', 1, 150, 'DEGC', 'E-301 OUTLET TEMP', { LOOPID: 'T301' }, 40, 60),
        ai('TT302', 'HX3AI1', 2, 100, 'DEGC', 'E-301 INLET TEMP', {}, 40, 200),
        ai('FT303', 'HX3AI1', 3, 30, 'M3/H', 'E-301 PRODUCT FLOW', {}, 40, 320),
        ai('FT304', 'HX3AI1', 4, 1500, 'KG/H', 'E-301 STEAM FLOW', {}, 40, 440),
        B('TIC301', 'PID', { DESCRP: 'E-301 OUTLET TEMP CONTROL', LOOPID: 'T301', HSCI1: 150, EI1: 'DEGC', SPT: 70, MODOPT: 5, PBAND: 120, INT: 0.7, DERIV: 0.08, MALOPT: 1, MEASHL: 85, MEASLL: 55, MEASHT: 'PRODUCT TOO HOT', MEASLT: 'PRODUCT TOO COLD', MEASPR: 2 }, { MEAS: ':TT301.PNT', BCALCI: ':TV301.BCALCO' }, 330, 60),
        aout('TV301', 'HX3AO1', 1, 'E-301 STEAM VALVE', ':TIC301.OUT', 620, 60),
      ]),
    ],
  }
}

// ------------------------------------------------------------------ BATCH REACTOR
export const BATCH_HLBL = `-- R-401 batch: A + B -> P (exothermic)
-- Recipe parameters: R401_SEQ:RECIPE RI01 = volume A (L), RI02 = volume B (L),
--                    RI03 = reaction temperature (C), RI04 = hold time (s)
VA := R401_SEQ:RECIPE.RI01
VB := R401_SEQ:RECIPE.RI02
TR := R401_SEQ:RECIPE.RI03
HOLDT := R401_SEQ:RECIPE.RI04
IF REACTOR:LT401.PNT > 20 THEN
  SENDMSG "R-401 NOT EMPTY - BATCH NOT STARTED"
  EXIT
ENDIF
SENDMSG "BATCH START"
-- PHASE 1: CHARGE_A
R401_SEQ:RECIPE.RO01 := 1
SENDMSG "PHASE CHARGE_A"
REACTOR:FQ404.BI01 := TRUE
WAIT 1
REACTOR:FQ404.BI01 := FALSE
REACTOR:FIC404.SPT := 60
REACTOR:FIC404.MA := TRUE
WAITUNTIL REACTOR:FQ404.RO01 >= VA
REACTOR:FIC404.MA := FALSE
REACTOR:FIC404.OUT := 0
-- PHASE 2: CHARGE_B (agitator must run)
R401_SEQ:RECIPE.RO01 := 2
SENDMSG "PHASE CHARGE_B"
REACTOR:M407.IN := TRUE
WAITUNTIL REACTOR:YS407.CIN
REACTOR:FQ405.BI01 := TRUE
WAIT 1
REACTOR:FQ405.BI01 := FALSE
REACTOR:FIC405.SPT := 40
REACTOR:FIC405.MA := TRUE
WAITUNTIL REACTOR:FQ405.RO01 >= VB
REACTOR:FIC405.MA := FALSE
REACTOR:FIC405.OUT := 0
-- PHASE 3: HEAT
R401_SEQ:RECIPE.RO01 := 3
SENDMSG "PHASE HEAT"
REACTOR:TIC401.SPT := TR
REACTOR:TIC401.MA := TRUE
WAITUNTIL REACTOR:TT401.PNT >= TR - 1
-- PHASE 4: REACT (hold at temperature)
R401_SEQ:RECIPE.RO01 := 4
SENDMSG "PHASE REACT"
T := 0
WHILE T < HOLDT DO
  IF NOT REACTOR:YS407.CIN THEN
    SENDMSG "AGITATOR STOPPED - BATCH HELD, COOLING"
    REACTOR:TIC401.SPT := 30
    R401_SEQ:RECIPE.RO01 := 9
    EXIT
  ENDIF
  WAIT 5
  T := T + 5
ENDWHILE
-- PHASE 5: COOL
R401_SEQ:RECIPE.RO01 := 5
SENDMSG "PHASE COOL"
REACTOR:TIC401.SPT := 40
WAITUNTIL REACTOR:TT401.PNT <= 45
-- PHASE 6: DISCHARGE
R401_SEQ:RECIPE.RO01 := 6
SENDMSG "PHASE DISCHARGE"
REACTOR:XV406.IN := TRUE
WAITUNTIL REACTOR:ZSO406.CIN
WAITUNTIL REACTOR:LT401.PNT <= 5
REACTOR:XV406.IN := FALSE
REACTOR:M407.IN := FALSE
REACTOR:TIC401.MA := FALSE
REACTOR:TIC401.OUT := 20
R401_SEQ:RECIPE.RO01 := 7
SENDMSG "BATCH COMPLETE"
`

function batchCfg(): CfgDb {
  const col = (i: number) => 40 + i * 290
  const tot = (name: string, ft: string, x: number, y: number) =>
    B(name, 'CALC', { DESCRP: `${ft} TOTALIZER (L), BI01 = RESET`, STEP01: 'IN RO01', STEP02: 'IN RI01', STEP03: 'IN 0.0083333', STEP04: 'MUL', STEP05: 'ADD', STEP06: 'IN BI01', STEP07: 'NOT', STEP08: 'MUL', STEP09: 'OUT RO01', STEP10: 'END' }, { RI01: `:${ft}.PNT` }, x, y)
  return {
    letterbug: 'CP2701',
    compounds: [
      cmp('REACTOR', 'R-401 BATCH REACTOR CONTROL', [
        ai('LT401', 'R4AI01', 1, 1000, 'L', 'R-401 VOLUME', { HLOP: 2, HAL: 950, HLPR: 1, HATXT: 'R-401 OVERFILL', PNTNM: 'R401 VOLUME' }, col(0), 40),
        ai('TT401', 'R4AI01', 2, 150, 'DEGC', 'R-401 TEMPERATURE', {}, col(0), 160),
        ai('TT402', 'R4AI01', 3, 150, 'DEGC', 'R-401 JACKET TEMPERATURE', {}, col(0), 280),
        ai('PT403', 'R4AI01', 4, 6, 'BAR', 'R-401 PRESSURE', { HLOP: 2, HAL: 3.5, HLPR: 1, HATXT: 'R-401 PRESSURE HIGH' }, col(0), 400),
        ai('FT404', 'R4AI01', 5, 100, 'L/MIN', 'FEED A FLOW', {}, col(0), 520),
        ai('FT405', 'R4AI01', 6, 100, 'L/MIN', 'FEED B FLOW', {}, col(0), 640),
        tot('FQ404', 'FT404', col(1), 520),
        tot('FQ405', 'FT405', col(1), 680),
        B('TIC401', 'PIDA', { DESCRP: 'R-401 TEMP (CASCADE PRIMARY)', LOOPID: 'R401', HSCI1: 150, EI1: 'DEGC', HSCO1: 150, LSCO1: 10, EO1: 'DEGC', SPT: 20, INITMA: 0, OUT: 20, MODOPT: 4, PBAND: 25, INT: 5, MEASNM: 'R401 TEMP', MALOPT: 2, MEASHL: 92, MEASHT: 'R-401 TEMPERATURE HIGH', MEASPR: 2, HHAOPT: 2, HHALIM: 100, HHATXT: 'R-401 TEMP HH - INTERLOCK', HHAPRI: 1 }, { MEAS: ':TT401.PNT', BCALCI: ':TIC402.BCALCO' }, col(1), 40),
        B('TIC402', 'PID', { DESCRP: 'R-401 JACKET TEMP (SECONDARY)', LOOPID: 'R401', HSCI1: 150, EI1: 'DEGC', SPT: 20, INITLR: 1, MODOPT: 4, PBAND: 40, INT: 0.3 }, { MEAS: ':TT402.PNT', RSP: ':TIC401.OUT', BCALCI: ':TV402.BCALCO' }, col(2), 40),
        B('ILK401', 'CALC', { DESCRP: 'HH TEMP / HIGH PRESSURE INTERLOCK', STEP01: 'IN RI01', STEP02: 'IN 100', STEP03: 'GT', STEP04: 'IN RI02', STEP05: 'IN 4', STEP06: 'GT', STEP07: 'OR', STEP08: 'OUT BO01', STEP09: 'END' }, { RI01: ':TT401.PNT', RI02: ':PT403.PNT' }, col(2), 260),
        B('SW402', 'SWCH', { DESCRP: 'INTERLOCK: FULL COOLING' }, { IN_1: ':TIC402.OUT', TOGGLE: ':ILK401.BO01' }, col(3), 260),
        aout('TV402', 'R4AO01', 3, 'JACKET VALVE (SPLIT RANGE)', ':SW402.OUT', col(3), 40),
        B('FIC404', 'PID', { DESCRP: 'FEED A FLOW CONTROL', HSCI1: 100, EI1: 'L/MIN', SPT: 60, INITMA: 0, MODOPT: 4, PBAND: 150, INT: 0.05 }, { MEAS: ':FT404.PNT', BCALCI: ':FV404.BCALCO' }, col(2), 520),
        aout('FV404', 'R4AO01', 1, 'FEED A VALVE', ':FIC404.OUT', col(3), 520),
        B('FIC405', 'PID', { DESCRP: 'FEED B FLOW CONTROL', HSCI1: 100, EI1: 'L/MIN', SPT: 40, INITMA: 0, MODOPT: 4, PBAND: 150, INT: 0.05 }, { MEAS: ':FT405.PNT', BCALCI: ':FV405.BCALCO' }, col(2), 680),
        aout('FV405', 'R4AO01', 2, 'FEED B VALVE', ':FIC405.OUT', col(3), 680),
        dout('M407', 'R4DO01', 1, 'AGITATOR START', col(4), 40),
        din('YS407', 'R4DI01', 1, 'AGITATOR RUNNING', col(4), 160),
        dout('XV406', 'R4DO01', 2, 'DISCHARGE VALVE', col(4), 280),
        din('ZSO406', 'R4DI01', 2, 'DISCHARGE VALVE OPEN', col(4), 400),
      ]),
      cmp('R401_SEQ', 'R-401 BATCH SEQUENCE', [
        B('RECIPE', 'CALC', { DESCRP: 'RECIPE: RI01 A L, RI02 B L, RI03 C, RI04 S', RI01: 400, RI02: 400, RI03: 80, RI04: 450 }, {}, 40, 60),
        B('PHASES', 'HLBL', { DESCRP: 'R-401 PHASE LOGIC', SOURCE: BATCH_HLBL }, {}, 330, 60),
      ]),
    ],
  }
}

// ------------------------------------------------------------------ WFI
function wfiCfg(): CfgDb {
  return {
    letterbug: 'CP2701',
    compounds: [
      cmp('WFI501', 'T-501 HOT WFI STORAGE AND LOOP', [
        ai('LT501', 'WF5AI1', 1, 100, '%', 'T-501 WFI LEVEL', { HLOP: 1, HAL: 92, LAL: 15, HLPR: 2, HATXT: 'WFI TANK LEVEL HIGH', LATXT: 'WFI TANK LEVEL LOW' }, 40, 60),
        ai('TT502', 'WF5AI1', 2, 100, 'DEGC', 'WFI LOOP RETURN TEMP', {}, 40, 200),
        ai('AT503', 'WF5AI1', 3, 5, 'US/CM', 'STILL CONDUCTIVITY', { HLOP: 2, HAL: 1.3, HLPR: 1, HATXT: 'WFI CONDUCTIVITY > 1.3 US/CM' }, 40, 340),
        ai('FT504', 'WF5AI1', 4, 10, 'M3/H', 'WFI LOOP RETURN FLOW', {}, 40, 480),
        B('LIC501', 'PID', { DESCRP: 'T-501 LEVEL (STILL OUTPUT)', HSCI1: 100, EI1: '%', SPT: 60, MODOPT: 4, PBAND: 60, INT: 3 }, { MEAS: ':LT501.PNT', BCALCI: ':FV501.BCALCO' }, 330, 60),
        aout('FV501', 'WF5AO1', 1, 'STILL PRODUCTION VALVE', ':LIC501.OUT', 620, 60),
        B('TIC502', 'PID', { DESCRP: 'WFI LOOP TEMP >= 65 C', HSCI1: 100, EI1: 'DEGC', SPT: 80, MODOPT: 4, PBAND: 40, INT: 1.5, MALOPT: 3, MEASLL: 72, MEASLT: 'WFI LOOP TEMP LOW', MEASPR: 2, HHAOPT: 3, LLALIM: 65, LLATXT: 'WFI BELOW 65 C - SANITIZE', HHAPRI: 1 }, { MEAS: ':TT502.PNT', BCALCI: ':TV502.BCALCO' }, 330, 200),
        aout('TV502', 'WF5AO1', 2, 'LOOP HEATER STEAM VALVE', ':TIC502.OUT', 620, 200),
        B('DIV503', 'CALC', { DESCRP: 'DIVERT IF CONDUCTIVITY > 1.3', STEP01: 'IN RI01', STEP02: 'IN 1.3', STEP03: 'GT', STEP04: 'OUT BO01', STEP05: 'END' }, { RI01: ':AT503.PNT' }, 330, 340),
        { ...dout('XV503', 'WF5DO1', 1, 'DIVERT TO DRAIN', 620, 340), links: { IN: ':DIV503.BO01' } },
      ]),
    ],
  }
}

// ------------------------------------------------------------------ CIP
export const CIP_HLBL = `-- C-601 CIP: pre-rinse, caustic wash 75 C, rinse, acid wash, final rinse
SENDMSG "CIP START"
-- PRE-RINSE
SENDMSG "STEP PRE-RINSE"
CIP:XV601.IN := TRUE
WAITUNTIL CIP:LT601.PNT >= 300
CIP:XV601.IN := FALSE
CIP:P601.IN := TRUE
CIP:XV604.IN := TRUE
WAITUNTIL CIP:LT601.PNT <= 20
CIP:XV604.IN := FALSE
CIP:P601.IN := FALSE
-- CAUSTIC WASH
SENDMSG "STEP CAUSTIC WASH"
CIP:XV601.IN := TRUE
WAITUNTIL CIP:LT601.PNT >= 300
CIP:XV601.IN := FALSE
CIP:P601.IN := TRUE
CIP:XV602.IN := TRUE
WAITUNTIL CIP:AT603.PNT >= 80
CIP:XV602.IN := FALSE
CIP:TIC602.SPT := 75
CIP:TIC602.MA := TRUE
WAITUNTIL CIP:TT602.PNT >= 73
SENDMSG "CAUSTIC AT TEMPERATURE - HOLD"
WAIT 600
CIP:TIC602.MA := FALSE
CIP:TIC602.OUT := 0
CIP:XV604.IN := TRUE
WAITUNTIL CIP:LT601.PNT <= 20
CIP:XV604.IN := FALSE
CIP:P601.IN := FALSE
-- INTERMEDIATE RINSE
SENDMSG "STEP INTERMEDIATE RINSE"
CIP:XV601.IN := TRUE
WAITUNTIL CIP:LT601.PNT >= 300
CIP:XV601.IN := FALSE
CIP:P601.IN := TRUE
CIP:XV604.IN := TRUE
WAITUNTIL CIP:LT601.PNT <= 20
CIP:XV604.IN := FALSE
-- ACID WASH
SENDMSG "STEP ACID WASH"
CIP:XV601.IN := TRUE
WAITUNTIL CIP:LT601.PNT >= 300
CIP:XV601.IN := FALSE
CIP:XV603.IN := TRUE
WAITUNTIL CIP:AT603.PNT >= 40
CIP:XV603.IN := FALSE
WAIT 300
CIP:XV604.IN := TRUE
WAITUNTIL CIP:LT601.PNT <= 20
CIP:XV604.IN := FALSE
-- FINAL RINSE until conductivity <= 1 mS/cm
CLEAN := 0
N := 0
WHILE CLEAN = 0 DO
  N := N + 1
  SENDMSG "STEP FINAL RINSE"
  CIP:XV601.IN := TRUE
  WAITUNTIL CIP:LT601.PNT >= 300
  CIP:XV601.IN := FALSE
  WAIT 30
  IF CIP:AT603.PNT <= 1 THEN
    CLEAN := 1
  ELSE
    SENDMSG "FINAL RINSE CONDUCTIVITY HIGH - REPEAT"
  ENDIF
  CIP:XV604.IN := TRUE
  WAITUNTIL CIP:LT601.PNT <= 20
  CIP:XV604.IN := FALSE
ENDWHILE
CIP:P601.IN := FALSE
SENDMSG "CIP COMPLETE"
`

function cipCfg(): CfgDb {
  return {
    letterbug: 'CP2701',
    compounds: [
      cmp('CIP', 'C-601 CIP SKID', [
        ai('LT601', 'CI6AI1', 1, 500, 'L', 'CIP TANK LEVEL', {}, 40, 40),
        ai('TT602', 'CI6AI1', 2, 100, 'DEGC', 'CIP SUPPLY TEMP', {}, 40, 160),
        ai('AT603', 'CI6AI1', 3, 200, 'MS/CM', 'CIP RETURN CONDUCTIVITY', {}, 40, 280),
        ai('FT604', 'CI6AI1', 4, 10, 'M3/H', 'CIP SUPPLY FLOW', { HLOP: 3, LAL: 3, HLPR: 3, LATXT: 'CIP SUPPLY FLOW LOW' }, 40, 400),
        B('TIC602', 'PID', { DESCRP: 'CIP SUPPLY TEMP CONTROL', HSCI1: 100, EI1: 'DEGC', SPT: 75, INITMA: 0, MODOPT: 4, PBAND: 30, INT: 2 }, { MEAS: ':TT602.PNT', BCALCI: ':TV602.BCALCO' }, 330, 160),
        aout('TV602', 'CI6AO1', 1, 'CIP HEATER STEAM VALVE', ':TIC602.OUT', 620, 160),
        dout('XV601', 'CI6DO1', 1, 'WATER INLET', 330, 300),
        dout('XV602', 'CI6DO1', 2, 'CAUSTIC DOSING', 330, 400),
        dout('XV603', 'CI6DO1', 3, 'ACID DOSING', 330, 500),
        dout('XV604', 'CI6DO1', 4, 'RETURN TO DRAIN', 620, 300),
        dout('P601', 'CI6DO1', 5, 'CIP SUPPLY PUMP', 620, 400),
      ]),
      cmp('CIP_SEQ', 'C-601 CIP PROGRAM', [B('CIP_PROG', 'HLBL', { DESCRP: 'CIP CYCLE', SOURCE: CIP_HLBL }, {}, 40, 60)]),
    ],
  }
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'tank2',
    title: { en: 'TANK2 course lab (LAB 1)', ru: 'Лаба курса TANK2 (LAB 1)' },
    desc: { en: 'The course database: TANK2_COMP level loop with the PROCESS_2 simulation compound and an HLBL fill sequence.', ru: 'База из курса: контур уровня TANK2_COMP, compound моделирования PROCESS_2 и последовательность заполнения на HLBL.' },
    cfg: labCfg,
  },
  {
    id: 'tank',
    title: { en: 'Tank level T-101', ru: 'Уровень в баке T-101' },
    desc: { en: 'Integrating process: inlet valve vs draw-off pump. Learn P vs PI on a level loop and the effect of tank area.', ru: 'Интегрирующий объект: клапан на входе против насоса откачки. P и PI на контуре уровня, влияние сечения бака.' },
    cfg: tankCfg,
    plant: () => new TankPlant().init(),
  },
  {
    id: 'flow',
    title: { en: 'Pump and flow line P-201', ru: 'Насос и линия расхода P-201' },
    desc: { en: 'Fast, noisy flow loop on an equal-percentage valve with a pump curve; discharge pressure alarm; pump start from a DOUT.', ru: 'Быстрый зашумлённый контур расхода с равнопроцентным клапаном и характеристикой насоса; авария по давлению; пуск насоса через DOUT.' },
    cfg: flowCfg,
    plant: () => new FlowPlant().init(),
  },
  {
    id: 'hex',
    title: { en: 'Heat exchanger E-301', ru: 'Теплообменник E-301' },
    desc: { en: 'Steam-heated exchanger with lag and dead time: PID tuning, load changes (flow, inlet temperature) and fouling.', ru: 'Теплообменник на паре с инерцией и запаздыванием: настройка PID, изменения нагрузки (расход, температура на входе) и загрязнение.' },
    cfg: hexCfg,
    plant: () => new HexPlant().init(),
  },
  {
    id: 'batch',
    pharma: true,
    title: { en: 'Batch reactor R-401 (API synthesis)', ru: 'Batch-реактор R-401 (синтез API)' },
    desc: {
      en: 'Jacketed exothermic batch reactor: recipe, HLBL phases CHARGE_A → CHARGE_B → HEAT → REACT → COOL → DISCHARGE, temperature cascade TIC401 → TIC402 → split-range jacket valve, HH interlock.',
      ru: 'Экзотермический batch-реактор с рубашкой: рецепт, фазы HLBL CHARGE_A → CHARGE_B → HEAT → REACT → COOL → DISCHARGE, каскад температуры TIC401 → TIC402 → клапан рубашки split range, блокировка по HH.',
    },
    cfg: batchCfg,
    plant: () => new BatchReactorPlant().init(),
  },
  {
    id: 'wfi',
    pharma: true,
    title: { en: 'Hot WFI storage and loop T-501', ru: 'Горячая WFI: бак и контур T-501' },
    desc: { en: 'Water for injection: tank level, loop kept ≥ 65 °C, conductivity limit 1.3 µS/cm with automatic divert to drain.', ru: 'Вода для инъекций: уровень в баке, контур не ниже 65 °C, предел электропроводности 1,3 мкСм/см с автоматическим сбросом в дренаж.' },
    cfg: wfiCfg,
    plant: () => new WfiPlant().init(),
  },
  {
    id: 'cip',
    pharma: true,
    title: { en: 'CIP skid C-601 (HLBL program)', ru: 'Мойка CIP C-601 (программа HLBL)' },
    desc: { en: 'Clean-in-place cycle written in HLBL: pre-rinse, hot caustic, rinse, acid, final rinse to conductivity ≤ 1 mS/cm.', ru: 'Цикл мойки на месте на HLBL: предополаскивание, горячая щёлочь, ополаскивание, кислота, финальное ополаскивание до ≤ 1 мСм/см.' },
    cfg: cipCfg,
    plant: () => new CipPlant().init(),
  },
]

export const scenario = (id: string) => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
