import type { BlockTypeDef, ParamDef } from '../types'
import { ALARM_OUT, AM, COMMON, P, bool, clamp, initMA, num, resolveMA } from './common'

const NSTEPS = 20

const range = (n: number, f: (i: string) => ParamDef) => Array.from({ length: n }, (_, i) => f(String(i + 1).padStart(2, '0')))

/**
 * CALC — stack-based calculator block. Each STEPnn holds one instruction,
 * executed in order every scan, like the Foxboro CALC/CALCA program steps.
 *
 * Instructions (training subset):
 *   IN RIxx | BIxx | ROxx | <constant>   push a value
 *   ADD SUB MUL DIV MAX MIN              pop 2, push result
 *   ABS SQRT CHS NOT                     pop 1, push result
 *   AND OR GT LT GE LE EQ                pop 2, push 1/0
 *   OUT ROxx | BOxx                      store top of stack (keeps it)
 *   CLR                                  clear the stack
 *   END                                  stop
 */
export const CALC: BlockTypeDef = {
  type: 'CALC',
  family: 'calc',
  desc: {
    en: 'Calculator: a program of up to 20 RPN steps (IN, ADD, MUL, OUT…) over real inputs RI01-RI08 and Boolean inputs BI01-BI04.',
    ru: 'Calculator: программа до 20 шагов в обратной польской записи (IN, ADD, MUL, OUT…) над входами RI01-RI08 и BI01-BI04.',
  },
  params: [
    ...COMMON,
    ...range(8, (i) => P(`RI${i}`, 'R', 0, 'in', `Real input ${i}`, { settable: true, group: 'control' })),
    ...range(4, (i) => P(`BI${i}`, 'B', false, 'in', `Boolean input ${i}`, { settable: true, group: 'control' })),
    ...range(NSTEPS, (i) => P(`STEP${i}`, 'S', '', 'cfg', `Program step ${i}`, { group: 'tune' })),
    ...AM.slice(0, 2),
    ...range(4, (i) => P(`RO${i}`, 'R', 0, 'out', `Real output ${i}`, { settable: true, group: 'control' })),
    ...range(4, (i) => P(`BO${i}`, 'B', false, 'out', `Boolean output ${i}`, { settable: true, group: 'control' })),
    P('PERROR', 'S', '', 'out', 'Program error (step and reason)', { group: 'status' }),
    ...ALARM_OUT,
  ],
  init: initMA,
  exec(b, ctx) {
    const auto = resolveMA(b, ctx)
    let anyBad = false
    for (let i = 1; i <= 8; i++) {
      const k = `RI${String(i).padStart(2, '0')}`
      if (b.links[k]) {
        const r = ctx.input(b, k)
        b.p[k] = num(r.v)
        anyBad ||= r.bad
      }
    }
    for (let i = 1; i <= 4; i++) {
      const k = `BI${String(i).padStart(2, '0')}`
      if (b.links[k]) b.p[k] = bool(ctx.input(b, k).v)
    }
    if (!auto) return ctx.alarm(b, [])
    const stack: number[] = []
    const pop = () => stack.pop() ?? 0
    let err = ''
    for (let s = 1; s <= NSTEPS && !err; s++) {
      const raw = String(b.p[`STEP${String(s).padStart(2, '0')}`] ?? '').trim().toUpperCase()
      if (!raw) continue
      const [op, arg] = raw.split(/\s+/)
      const two = (f: (a: number, c: number) => number) => {
        const c = pop()
        const a = pop()
        stack.push(f(a, c))
      }
      switch (op) {
        case 'IN':
          if (arg && /^(RI|BI|RO|BO)\d\d$/.test(arg)) stack.push(num(b.p[arg]))
          else if (arg && !isNaN(+arg)) stack.push(+arg)
          else err = `STEP${s}: bad operand ${arg ?? ''}`
          break
        case 'ADD': two((a, c) => a + c); break
        case 'SUB': two((a, c) => a - c); break
        case 'MUL': two((a, c) => a * c); break
        case 'DIV': two((a, c) => (c === 0 ? 0 : a / c)); break
        case 'MAX': two(Math.max); break
        case 'MIN': two(Math.min); break
        case 'AND': two((a, c) => (a && c ? 1 : 0)); break
        case 'OR': two((a, c) => (a || c ? 1 : 0)); break
        case 'GT': two((a, c) => (a > c ? 1 : 0)); break
        case 'LT': two((a, c) => (a < c ? 1 : 0)); break
        case 'GE': two((a, c) => (a >= c ? 1 : 0)); break
        case 'LE': two((a, c) => (a <= c ? 1 : 0)); break
        case 'EQ': two((a, c) => (a === c ? 1 : 0)); break
        case 'ABS': stack.push(Math.abs(pop())); break
        case 'SQRT': stack.push(Math.sqrt(Math.max(0, pop()))); break
        case 'CHS': stack.push(-pop()); break
        case 'NOT': stack.push(pop() ? 0 : 1); break
        case 'CLR': stack.length = 0; break
        case 'OUT':
          if (arg && /^RO\d\d$/.test(arg)) b.p[arg] = stack[stack.length - 1] ?? 0
          else if (arg && /^BO\d\d$/.test(arg)) b.p[arg] = !!stack[stack.length - 1]
          else err = `STEP${s}: bad output ${arg ?? ''}`
          break
        case 'END': s = NSTEPS + 1; break
        default: err = `STEP${s}: unknown instruction ${op}`
      }
    }
    b.p.PERROR = err
    for (let i = 1; i <= 4; i++) b.bad[`RO0${i}`] = anyBad
    ctx.alarm(b, [])
  },
}

/** CHARC — characterizer: piecewise-linear OUT = f(MEAS). */
export const CHARC: BlockTypeDef = {
  type: 'CHARC',
  family: 'calc',
  desc: { en: 'Characterizer: piecewise-linear curve through up to 9 X/Y points (e.g. tank volume vs level, valve characteristic).', ru: 'Characterizer: кусочно-линейная кривая по 9 точкам X/Y (например, объём резервуара от уровня).' },
  params: [
    ...COMMON,
    P('MEAS', 'R', 0, 'in', 'Input'),
    P('NUMPTS', 'I', 2, 'cfg', 'Number of points used (2-9)', { group: 'tune' }),
    ...range(9, (i) => P(`X${i}`, 'R', i === '01' ? 0 : i === '02' ? 100 : 0, 'cfg', `Breakpoint X${i}`, { group: 'tune' })),
    ...range(9, (i) => P(`Y${i}`, 'R', i === '01' ? 0 : i === '02' ? 100 : 0, 'cfg', `Breakpoint Y${i}`, { group: 'tune' })),
    P('OUT', 'R', 0, 'out', 'Characterized output', { group: 'control' }),
    ...ALARM_OUT,
  ],
  exec(b, ctx) {
    const m = ctx.input(b, 'MEAS')
    const n = clamp(num(b.p.NUMPTS), 2, 9)
    const pts = Array.from({ length: n }, (_, i) => [num(b.p[`X0${i + 1}`]), num(b.p[`Y0${i + 1}`])])
    const x = num(m.v)
    let y = pts[0][1]
    if (x >= pts[n - 1][0]) y = pts[n - 1][1]
    else
      for (let i = 0; i < n - 1; i++) {
        const [x0, y0] = pts[i]
        const [x1, y1] = pts[i + 1]
        if (x >= x0 && x <= x1) {
          y = x1 === x0 ? y0 : y0 + ((x - x0) * (y1 - y0)) / (x1 - x0)
          break
        }
      }
    b.p.OUT = y
    b.bad.OUT = m.bad
    ctx.alarm(b, [])
  },
}

/** SWCH — select one of two inputs. */
export const SWCH: BlockTypeDef = {
  type: 'SWCH',
  family: 'calc',
  desc: { en: 'Switch: OUT = IN_1 when TOGGLE is false, IN_2 when TOGGLE is true.', ru: 'Switch: OUT = IN_1 при TOGGLE = false, IN_2 при TOGGLE = true.' },
  params: [
    ...COMMON,
    P('IN_1', 'R', 0, 'in', 'Input 1'),
    P('IN_2', 'R', 0, 'in', 'Input 2'),
    P('TOGGLE', 'B', false, 'in', 'Selector', { settable: true, group: 'control' }),
    P('OUT', 'R', 0, 'out', 'Selected value', { group: 'control' }),
    ...ALARM_OUT,
  ],
  exec(b, ctx) {
    if (b.links.TOGGLE) b.p.TOGGLE = bool(ctx.input(b, 'TOGGLE').v)
    const r = ctx.input(b, bool(b.p.TOGGLE) ? 'IN_2' : 'IN_1')
    b.p.OUT = num(r.v)
    b.bad.OUT = r.bad
    ctx.alarm(b, [])
  },
}
