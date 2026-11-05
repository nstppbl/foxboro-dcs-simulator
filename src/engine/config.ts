/**
 * Engineering configuration database (what IACC / Control Editors / ICC edit),
 * kept separate from the running CP database. Validate checks it, Download
 * turns it into a StationDb for the simulated CP.
 */
import type { Bilingual } from '../domain/hardware/catalog'
import { compileHlbl } from './blocks/hlbl'
import { BLOCK_TYPES, newBlock, paramDef } from './registry'
import { PERIOD_SECONDS } from './scheduler'
import { parseRef } from './station'
import type { StationDb, Val } from './types'
import { key } from './types'

export interface CfgBlock {
  name: string
  type: string
  /** parameter values that differ from the type defaults */
  v: Record<string, Val>
  links: Record<string, string>
  /** position on the strategy (CSD) sheet */
  x: number
  y: number
}

export interface CfgCompound {
  name: string
  p: Record<string, Val>
  /** in execution order */
  blocks: CfgBlock[]
}

export interface CfgDb {
  letterbug: string
  compounds: CfgCompound[]
}

export const NAME_RE = /^[A-Z0-9_]{1,12}$/

export const COMPOUND_DEFAULTS: Record<string, Val> = { DESCRP: '', PERIOD: 1, PHASE: 0, CINHIB: 0, ON: true }

/** Ports shown on a block symbol in the Strategy Editor (linked parameters are always shown too). */
export const PORTS: Record<string, { in: string[]; out: string[] }> = {
  AIN: { in: ['MEAS'], out: ['PNT', 'BAD'] },
  AOUT: { in: ['MEAS'], out: ['OUT', 'BCALCO'] },
  DIN: { in: ['IN'], out: ['CIN'] },
  DOUT: { in: ['IN'], out: ['COUT'] },
  PID: { in: ['MEAS', 'RSP', 'FBK', 'BCALCI'], out: ['OUT', 'BCALCO'] },
  PIDA: { in: ['MEAS', 'RSP', 'FBK', 'BCALCI'], out: ['OUT', 'BCALCO'] },
  RATIO: { in: ['MEAS', 'RATIO'], out: ['OUT'] },
  CALC: { in: ['RI01', 'RI02', 'BI01'], out: ['RO01', 'BO01'] },
  CHARC: { in: ['MEAS'], out: ['OUT'] },
  SWCH: { in: ['IN_1', 'IN_2', 'TOGGLE'], out: ['OUT'] },
  LLAG: { in: ['MEAS'], out: ['OUT'] },
  DTIME: { in: ['MEAS'], out: ['OUT'] },
  MTR: { in: ['AUTRUN', 'TRIP'], out: ['MSTAT'] },
  HLBL: { in: ['ACTIVE'], out: ['STATE'] },
}

// ---------------------------------------------------------------- conversion

export function blockParams(b: CfgBlock): Record<string, Val> {
  const def = BLOCK_TYPES[b.type]
  const p: Record<string, Val> = {}
  for (const d of def?.params ?? []) p[d.name] = d.def
  return { ...p, ...b.v }
}

export function toStationDb(cfg: CfgDb): StationDb {
  const db: StationDb = { letterbug: cfg.letterbug, compounds: [], cmp: {}, blk: {} }
  for (const c of cfg.compounds) {
    db.compounds.push(c.name)
    db.cmp[c.name] = { name: c.name, p: { ...COMPOUND_DEFAULTS, ...c.p }, blocks: c.blocks.map((b) => b.name) }
    for (const b of c.blocks) db.blk[key(c.name, b.name)] = newBlock(c.name, b.name, b.type, b.v, b.links)
  }
  return db
}

/** Build a configuration from a station database (Upload / initial lab load). */
export function fromStationDb(db: StationDb, layout?: CfgDb): CfgDb {
  return {
    letterbug: db.letterbug,
    compounds: db.compounds.map((cn) => {
      const cmp = db.cmp[cn]
      const old = layout?.compounds.find((c) => c.name === cn)
      return {
        name: cn,
        p: { ...COMPOUND_DEFAULTS, ...pick(cmp.p, Object.keys(COMPOUND_DEFAULTS)) },
        blocks: cmp.blocks.map((bn, i) => {
          const b = db.blk[key(cn, bn)]
          const def = BLOCK_TYPES[b.type]
          const v: Record<string, Val> = {}
          for (const d of def.params) if (d.kind !== 'out' && !b.links[d.name] && b.p[d.name] !== d.def) v[d.name] = b.p[d.name]
          const pos = old?.blocks.find((x) => x.name === bn)
          return { name: bn, type: b.type, v, links: { ...b.links }, x: pos?.x ?? 40 + (i % 4) * 250, y: pos?.y ?? 40 + Math.floor(i / 4) * 230 }
        }),
      }
    }),
  }
}

function pick(o: Record<string, Val>, keys: string[]) {
  const r: Record<string, Val> = {}
  for (const k of keys) if (k in o) r[k] = o[k]
  return r
}

export const cloneCfg = (c: CfgDb): CfgDb => JSON.parse(JSON.stringify(c))

/** Content signature of a block, positions excluded (used for Modified / Compare to CP). */
export function blockSig(b: CfgBlock): string {
  const v = Object.keys(b.v)
    .sort()
    .map((k) => `${k}=${b.v[k]}`)
  const l = Object.keys(b.links)
    .sort()
    .map((k) => `${k}<${b.links[k]}`)
  return `${b.type}|${v.join(';')}|${l.join(';')}`
}

export function compoundSig(c: CfgCompound): string {
  return `${Object.keys(c.p)
    .sort()
    .map((k) => `${k}=${c.p[k]}`)
    .join(';')}|${c.blocks.map((b) => b.name).join(',')}`
}

// ---------------------------------------------------------------- status / compare

export type ObjState = 'Added' | 'Downloaded' | 'Modified'

export function blockState(cfg: CfgCompound, b: CfgBlock, cp: CfgDb | undefined): ObjState {
  const cc = cp?.compounds.find((c) => c.name === cfg.name)
  const cb = cc?.blocks.find((x) => x.name === b.name)
  if (!cb) return 'Added'
  return blockSig(cb) === blockSig(b) ? 'Downloaded' : 'Modified'
}

export function compoundState(c: CfgCompound, cp: CfgDb | undefined): ObjState {
  const cc = cp?.compounds.find((x) => x.name === c.name)
  if (!cc) return 'Added'
  if (compoundSig(cc) !== compoundSig(c)) return 'Modified'
  return c.blocks.every((b) => blockState(c, b, cp) === 'Downloaded') ? 'Downloaded' : 'Modified'
}

export interface CompareRow {
  ref: string
  where: 'DB ONLY' | 'CP ONLY' | 'DIFFERENT' | 'SAME'
  detail: string
}

/** Compare to CP (IACC Comparison Utility). */
export function compareToCp(cfg: CfgDb, cp: CfgDb): CompareRow[] {
  const rows: CompareRow[] = []
  const names = new Set([...cfg.compounds.map((c) => c.name), ...cp.compounds.map((c) => c.name)])
  for (const cn of names) {
    const a = cfg.compounds.find((c) => c.name === cn)
    const b = cp.compounds.find((c) => c.name === cn)
    if (!b) {
      rows.push({ ref: cn, where: 'DB ONLY', detail: 'compound' })
      continue
    }
    if (!a) {
      rows.push({ ref: cn, where: 'CP ONLY', detail: 'compound' })
      continue
    }
    rows.push({ ref: cn, where: compoundSig(a) === compoundSig(b) ? 'SAME' : 'DIFFERENT', detail: 'compound' })
    const bn = new Set([...a.blocks.map((x) => x.name), ...b.blocks.map((x) => x.name)])
    for (const n of bn) {
      const x = a.blocks.find((q) => q.name === n)
      const y = b.blocks.find((q) => q.name === n)
      const ref = `${cn}:${n}`
      if (!y) rows.push({ ref, where: 'DB ONLY', detail: x!.type })
      else if (!x) rows.push({ ref, where: 'CP ONLY', detail: y.type })
      else if (blockSig(x) === blockSig(y)) rows.push({ ref, where: 'SAME', detail: x.type })
      else rows.push({ ref, where: 'DIFFERENT', detail: diffParams(x, y).join(', ') })
    }
  }
  return rows
}

export function diffParams(a: CfgBlock, b: CfgBlock): string[] {
  const pa = blockParams(a)
  const pb = blockParams(b)
  const out: string[] = []
  for (const k of Object.keys(pa)) {
    const la = a.links[k] ?? ''
    const lb = b.links[k] ?? ''
    if (la !== lb || (!la && pa[k] !== pb[k])) out.push(k)
  }
  return out
}

// ---------------------------------------------------------------- validation

export interface CfgIssue {
  sev: 'error' | 'warning' | 'info'
  ref: string
  param?: string
  msg: Bilingual
  page?: string
}

const CALC_OPS = new Set(['IN', 'ADD', 'SUB', 'MUL', 'DIV', 'MAX', 'MIN', 'AND', 'OR', 'GT', 'LT', 'GE', 'LE', 'EQ', 'ABS', 'SQRT', 'CHS', 'NOT', 'CLR', 'OUT', 'END'])

function phaseMax(period: number): number {
  const every = Math.round((PERIOD_SECONDS[period] ?? 0.5) / 0.5)
  return Math.max(0, every - 1)
}

/** Hierarchy validation: compound level first, then each block (manual ch. 5 validation tables). */
export function validateCfg(cfg: CfgDb): CfgIssue[] {
  const out: CfgIssue[] = []
  const I = (sev: CfgIssue['sev'], ref: string, en: string, ru: string, param?: string, page?: string) => out.push({ sev, ref, param, msg: { en, ru }, page })
  const cmpNames = new Set<string>()
  // where each output is read from: "C:B" -> list of readers
  const find = (c: string, b: string) => cfg.compounds.find((x) => x.name === c)?.blocks.find((x) => x.name === b)

  for (const c of cfg.compounds) {
    if (!NAME_RE.test(c.name)) I('error', c.name, 'Compound name must be 1-12 characters A-Z, 0-9, _.', 'Имя compound: 1-12 символов A-Z, 0-9, _.', undefined, '4-4')
    if (cmpNames.has(c.name)) I('error', c.name, 'Duplicate compound name in the station.', 'Повторяющееся имя compound в станции.')
    cmpNames.add(c.name)
    const cper = Number(c.p.PERIOD ?? 1)
    if (!(cper in PERIOD_SECONDS)) I('error', c.name, `PERIOD ${cper} is not a valid period index (0-13).`, `PERIOD ${cper} — недопустимый индекс периода (0-13).`, 'PERIOD', '4-18')
    if (c.blocks.length === 0) I('warning', c.name, 'Compound has no blocks.', 'В compound нет блоков.')
    const bn = new Set<string>()
    for (const b of c.blocks) {
      const ref = `${c.name}:${b.name}`
      const def = BLOCK_TYPES[b.type]
      if (!def) {
        I('error', ref, `Unknown block type ${b.type}.`, `Неизвестный тип блока ${b.type}.`)
        continue
      }
      if (!NAME_RE.test(b.name)) I('error', ref, 'Block name must be 1-12 characters A-Z, 0-9, _.', 'Имя блока: 1-12 символов A-Z, 0-9, _.', undefined, '4-4')
      if (bn.has(b.name)) I('error', ref, 'Duplicate block name in the compound.', 'Повторяющееся имя блока в compound.')
      bn.add(b.name)
      const p = blockParams(b)
      const per = Number(p.PERIOD)
      if (!(per in PERIOD_SECONDS)) I('error', ref, `PERIOD ${per} is not a valid period index.`, `PERIOD ${per} — недопустимый индекс периода.`, 'PERIOD', '4-18')
      else {
        if (PERIOD_SECONDS[per] < (PERIOD_SECONDS[cper] ?? 0.5))
          I('error', ref, `Block PERIOD ${per} (${PERIOD_SECONDS[per]} s) is faster than the compound PERIOD ${cper}. The compound PERIOD must be ≤ the shortest block PERIOD.`, `PERIOD блока ${per} (${PERIOD_SECONDS[per]} с) быстрее PERIOD compound ${cper}. PERIOD compound должен быть ≤ самого короткого PERIOD блока.`, 'PERIOD', '4-18')
        const ph = Number(p.PHASE)
        if (ph < 0 || ph > phaseMax(per)) I('error', ref, `PHASE ${ph} is out of range 0-${phaseMax(per)} for PERIOD ${per}.`, `PHASE ${ph} вне диапазона 0-${phaseMax(per)} для PERIOD ${per}.`, 'PHASE', '4-18')
      }
      if (String(p.DESCRP).length > 32) I('warning', ref, 'DESCRP is longer than 32 characters.', 'DESCRP длиннее 32 символов.', 'DESCRP')

      // connections
      for (const [param, src] of Object.entries(b.links)) {
        const d = paramDef(b.type, param)
        if (!d) {
          I('error', ref, `${param} is not a parameter of ${b.type}.`, `${param} не является параметром ${b.type}.`, param)
          continue
        }
        if (!d.conn) I('error', ref, `${param} is not connectable (configuration parameter).`, `${param} не подключаемый (конфигурационный параметр).`, param, '4-11')
        const r = parseRef(src, c.name)
        if (!r) {
          I('error', ref, `Connection "${src}" has bad syntax. Use COMPOUND:BLOCK.PARAM or :BLOCK.PARAM.`, `Связь "${src}" с ошибкой синтаксиса. Используйте COMPOUND:BLOCK.PARAM или :BLOCK.PARAM.`, param, '4-11')
          continue
        }
        const sb = find(r.c, r.b)
        if (!sb) {
          I('error', ref, `${param}: source block ${r.c}:${r.b} does not exist in this station.`, `${param}: блок-источник ${r.c}:${r.b} не существует в этой станции.`, param)
          continue
        }
        const sd = paramDef(sb.type, r.p)
        if (!sd) {
          I('error', ref, `${param}: ${r.p} is not a parameter of ${r.c}:${r.b} (${sb.type}).`, `${param}: ${r.p} не является параметром ${r.c}:${r.b} (${sb.type}).`, param)
          continue
        }
        const bin = (t: string) => (t === 'B' ? 'B' : t === 'S' ? 'S' : 'N')
        if (bin(sd.type) !== bin(d.type))
          I('warning', ref, `${param} (${d.type}) is connected to ${src} of type ${sd.type}.`, `${param} (${d.type}) связан с ${src} типа ${sd.type}.`, param)
        if (r.c === c.name) {
          const si = c.blocks.findIndex((x) => x.name === r.b)
          const ti = c.blocks.indexOf(b)
          if (si > ti && sd.kind === 'out' && !(param === 'BCALCI' || param === 'FBK'))
            I('info', ref, `${param} reads ${r.b}, which executes later in the compound: the value is one scan old. Check the execution order.`, `${param} читает ${r.b}, который исполняется позже в compound: значение отстаёт на один скан. Проверьте порядок исполнения.`, param, '5-35')
        }
      }

      // type-specific checks
      const linked = (k: string) => !!b.links[k]
      if (b.type === 'AIN' || b.type === 'DIN') {
        const opt = Number(p.IOMOPT)
        const inp = b.type === 'AIN' ? 'MEAS' : 'IN'
        if (opt === 1 && !String(p.IOM_ID)) I('error', ref, 'IOMOPT = 1 (FBM) needs IOM_ID, the FBM letterbug.', 'IOMOPT = 1 (FBM) требует IOM_ID — letterbug FBM.', 'IOM_ID', '4-33')
        if (opt !== 1 && !linked(inp)) I('warning', ref, `IOMOPT = ${opt} reads ${inp}, but ${inp} is not connected.`, `IOMOPT = ${opt} читает ${inp}, но ${inp} не подключён.`, inp, '4-33')
      }
      if (b.type === 'AIN' && Number(p.HSCO1) <= Number(p.LSCO1)) I('error', ref, 'HSCO1 must be greater than LSCO1.', 'HSCO1 должен быть больше LSCO1.', 'HSCO1', '4-34')
      if (b.type === 'AOUT' || b.type === 'DOUT') {
        if (Number(p.IOMOPT) === 1 && !String(p.IOM_ID)) I('error', ref, 'IOMOPT = 1 (FBM) needs IOM_ID.', 'IOMOPT = 1 (FBM) требует IOM_ID.', 'IOM_ID', '4-33')
        const inp = b.type === 'AOUT' ? 'MEAS' : 'IN'
        if (!linked(inp)) I('warning', ref, `${inp} is not connected: in Auto the output follows a constant.`, `${inp} не подключён: в Auto выход следует за константой.`, inp)
      }
      if (b.type === 'PID' || b.type === 'PIDA') {
        if (!linked('MEAS')) I('error', ref, 'MEAS is not connected: the controller has no measurement.', 'MEAS не подключён: у регулятора нет измерения.', 'MEAS', '4-27')
        if (Number(p.HSCI1) <= Number(p.LSCI1)) I('error', ref, 'HSCI1 must be greater than LSCI1.', 'HSCI1 должен быть больше LSCI1.', 'HSCI1')
        const m = Number(p.MODOPT)
        if (!(m >= 1 && m <= 5)) I('error', ref, 'MODOPT must be 1-5 (P, I, PD, PI, PID).', 'MODOPT должен быть 1-5 (P, I, PD, PI, PID).', 'MODOPT', '4-38')
        if (Number(p.PBAND) <= 0) I('error', ref, 'PBAND must be > 0.', 'PBAND должен быть > 0.', 'PBAND', '4-37')
        if ((m === 2 || m === 4 || m === 5) && Number(p.INT) <= 0) I('warning', ref, 'Integral mode with INT = 0: no integral action.', 'Режим с интегралом, но INT = 0: интегральной составляющей нет.', 'INT')
        // downstream AOUT reading this PID's OUT
        const me = `${c.name}:${b.name}`
        for (const c2 of cfg.compounds)
          for (const d2 of c2.blocks)
            if (d2.type === 'AOUT' && d2.links.MEAS) {
              const r = parseRef(d2.links.MEAS, c2.name)
              if (r && `${r.c}:${r.b}` === me && r.p === 'OUT' && !linked('BCALCI'))
                I('warning', ref, `${c2.name}:${d2.name} is driven by this OUT but BCALCI is not connected to its BCALCO: transfers will not be bumpless.`, `${c2.name}:${d2.name} управляется этим OUT, но BCALCI не связан с его BCALCO: переключения не будут безударными.`, 'BCALCI', '4-31')
            }
        const mal = Number(p.MALOPT)
        if (mal === 1 && Number(p.MEASHL) <= Number(p.MEASLL)) I('error', ref, 'MEASHL must be greater than MEASLL.', 'MEASHL должен быть больше MEASLL.', 'MEASHL')
        for (const t of ['MEASHT', 'MEASLT', 'HDATXT', 'LDATXT', 'HOATXT', 'LOATXT', 'HHATXT', 'LLATXT'])
          if (String(p[t]).length > 28) I('warning', ref, `${t} is longer than 28 characters.`, `${t} длиннее 28 символов.`, t)
        for (const t of ['MEASPR', 'DEVPRI', 'OUTPRI', 'HHAPRI'])
          if (!(Number(p[t]) >= 1 && Number(p[t]) <= 5)) I('error', ref, `${t} must be 1-5.`, `${t} должен быть 1-5.`, t, '4-45')
      }
      if ('BAT' in p && String(p.BAT).length > 28) I('warning', ref, 'BAT is longer than 28 characters.', 'BAT длиннее 28 символов.', 'BAT')
      if (b.type === 'CALC') {
        for (let s = 1; s <= 20; s++) {
          const k = `STEP${String(s).padStart(2, '0')}`
          const raw = String(p[k] ?? '').trim().toUpperCase()
          if (!raw) continue
          const op = raw.split(/\s+/)[0]
          if (!CALC_OPS.has(op)) I('error', ref, `${k}: unknown instruction "${op}".`, `${k}: неизвестная инструкция "${op}".`, k)
        }
      }
      if (b.type === 'HLBL') {
        const r = compileHlbl(String(p.SOURCE))
        if (r.error) I('error', ref, `HLBL compile error: ${r.error}`, `Ошибка компиляции HLBL: ${r.error}`, 'SOURCE')
      }
    }
  }
  return out
}

/** Rename a block and fix every connection that refers to it. */
export function renameBlock(cfg: CfgDb, compound: string, from: string, to: string) {
  const c = cfg.compounds.find((x) => x.name === compound)
  const b = c?.blocks.find((x) => x.name === from)
  if (!c || !b) return
  b.name = to
  for (const c2 of cfg.compounds)
    for (const b2 of c2.blocks)
      for (const [k, src] of Object.entries(b2.links)) {
        const r = parseRef(src, c2.name)
        if (r && r.c === compound && r.b === from) b2.links[k] = c2.name === compound && src.startsWith(':') ? `:${to}.${r.p}` : `${compound}:${to}.${r.p}`
      }
}

/** Suggest a free block name like PID1, PID2… */
export function freeName(c: CfgCompound, base: string) {
  for (let i = 1; ; i++) if (!c.blocks.some((b) => b.name === `${base}${i}`)) return `${base}${i}`
}
