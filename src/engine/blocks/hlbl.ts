import type { Block, BlockTypeDef, ExecCtx, Val } from '../types'
import { ALARM_OUT, COMMON, P, bool, num } from './common'

/**
 * HLBL — High Level Batch Language block (training subset).
 *
 * Statements (one per line, ';' optional):
 *   -- comment
 *   x := expr                       local variable
 *   :LV100.MA := FALSE              parameter of a block in the same compound
 *   PROCESS_2:MTR_CNTRL.MANRUN := TRUE
 *   IF cond THEN … [ELSE …] ENDIF
 *   WHILE cond DO … ENDWHILE
 *   WAIT seconds                    pause the program (other blocks keep running)
 *   WAITUNTIL cond                  pause until the condition is true
 *   SENDMSG "text"                  message to the operator journal
 *   EXIT                            end the program
 *
 * Full-program layout is accepted too (as in Foxboro HLBL, B0400DF):
 *   INDEPENDENT_SEQUENCE / DEPENDENT_SEQUENCE / EXCEPTION_SEQUENCE … ENDSEQUENCE,
 *   CONSTANTS (NAME = value), VARIABLES (NAME : R), USER_LABELS (NAME : C:B.P), STATEMENTS,
 *   { comments }, WAIT UNTIL cond, ELSE_IF, <<LABEL>> and GOTO LABEL, ::C:B.P references.
 *
 * Expressions: numbers, TRUE/FALSE, "strings", variables, :B.P / C:B.P references,
 *   + - * /, = <> < > <= >=, AND OR NOT, parentheses.
 */

type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'var'; name: string }
  | { k: 'ref'; ref: string }
  | { k: 'un'; op: string; a: Expr }
  | { k: 'bin'; op: string; a: Expr; b: Expr }

type Instr =
  | { op: 'set'; target: { var?: string; ref?: string }; e: Expr; line: number }
  | { op: 'jf'; e: Expr; to: number; line: number }
  | { op: 'jmp'; to: number; line: number }
  | { op: 'wait'; e: Expr; line: number }
  | { op: 'until'; e: Expr; line: number }
  | { op: 'msg'; e: Expr; line: number }
  | { op: 'exit'; line: number }

export interface Program {
  code: Instr[]
  error?: string
}

const TOKEN = /\s*(?:(--.*$)|("[^"]*")|(\d+\.?\d*(?:[eE][-+]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)?(:[A-Za-z0-9_]+\.[A-Za-z0-9_]+)|([A-Za-z_][A-Za-z0-9_]*)|(:=|<>|<=|>=|[-+*/()=<>]))/y

function tokenize(line: string): string[] {
  const out: string[] = []
  TOKEN.lastIndex = 0
  let m: RegExpExecArray | null
  let pos = 0
  while (pos < line.length) {
    if (/^\s*;?\s*$/.test(line.slice(pos))) break
    TOKEN.lastIndex = pos
    m = TOKEN.exec(line)
    if (!m) throw new Error(`unexpected "${line.slice(pos).trim()}"`)
    pos = TOKEN.lastIndex
    if (m[1]) break // comment
    if (m[2]) out.push(m[2])
    else if (m[3]) out.push(m[3])
    else if (m[5]) out.push(`${m[4] ?? ''}${m[5]}`)
    else if (m[6]) out.push(m[6])
    else if (m[7]) out.push(m[7])
    const rest = line.slice(pos)
    if (/^\s*;/.test(rest)) pos += rest.indexOf(';') + 1
  }
  return out
}

function parseExpr(toks: string[]): Expr {
  let i = 0
  const peek = () => toks[i]?.toUpperCase()
  const or = (): Expr => {
    let a = and()
    while (peek() === 'OR') (i++, (a = { k: 'bin', op: 'OR', a, b: and() }))
    return a
  }
  const and = (): Expr => {
    let a = not()
    while (peek() === 'AND') (i++, (a = { k: 'bin', op: 'AND', a, b: not() }))
    return a
  }
  const not = (): Expr => (peek() === 'NOT' ? (i++, { k: 'un', op: 'NOT', a: not() }) : cmp())
  const cmp = (): Expr => {
    const a = add()
    if (['=', '<>', '<', '>', '<=', '>='].includes(peek())) {
      const op = toks[i++]
      return { k: 'bin', op, a, b: add() }
    }
    return a
  }
  const add = (): Expr => {
    let a = mul()
    while (peek() === '+' || peek() === '-') {
      const op = toks[i++]
      a = { k: 'bin', op, a, b: mul() }
    }
    return a
  }
  const mul = (): Expr => {
    let a = unary()
    while (peek() === '*' || peek() === '/') {
      const op = toks[i++]
      a = { k: 'bin', op, a, b: unary() }
    }
    return a
  }
  const unary = (): Expr => (peek() === '-' ? (i++, { k: 'un', op: '-', a: unary() }) : atom())
  const atom = (): Expr => {
    const t = toks[i++]
    if (t === undefined) throw new Error('expression expected')
    if (t === '(') {
      const e = or()
      if (toks[i++] !== ')') throw new Error('")" expected')
      return e
    }
    if (/^\d/.test(t)) return { k: 'num', v: parseFloat(t) }
    if (t.startsWith('"')) return { k: 'str', v: t.slice(1, -1) }
    if (t.includes(':')) return { k: 'ref', ref: t.toUpperCase() }
    const u = t.toUpperCase()
    if (u === 'TRUE') return { k: 'num', v: 1 }
    if (u === 'FALSE') return { k: 'num', v: 0 }
    if (/^[A-Z_]/.test(u)) return { k: 'var', name: u }
    throw new Error(`unexpected "${t}"`)
  }
  const e = or()
  if (i < toks.length) throw new Error(`unexpected "${toks[i]}"`)
  return e
}

const SEQ_HEADERS = ['INDEPENDENT_SEQUENCE', 'DEPENDENT_SEQUENCE', 'EXCEPTION_SEQUENCE', 'MONITOR_SEQUENCE', 'ENDSEQUENCE']
const SECTIONS = ['CONSTANTS', 'VARIABLES', 'USER_LABELS', 'STATEMENTS']
const KEYWORDS = new Set(['IF', 'THEN', 'ELSE', 'ELSE_IF', 'ENDIF', 'WHILE', 'DO', 'ENDWHILE', 'WAIT', 'UNTIL', 'WAITUNTIL', 'SENDMSG', 'EXIT', 'GOTO', 'AND', 'OR', 'NOT', 'TRUE', 'FALSE'])

/** Remove { … } comments (they may span lines), keeping line numbers. */
function stripBraces(src: string): string {
  let out = ''
  let depth = 0
  let inStr = false
  for (const ch of src) {
    if (ch === '"' && depth === 0) inStr = !inStr
    if (!inStr && ch === '{') depth++
    if (depth === 0 || ch === '\n') out += ch
    if (!inStr && ch === '}' && depth > 0) depth--
  }
  return out
}

export function compileHlbl(src: string): Program {
  const code: Instr[] = []
  type Frame = { kind: 'IF'; jf?: number; ends: number[]; hasElse: boolean } | { kind: 'WHILE'; jf: number; start: number }
  const stack: Frame[] = []
  const labels: Record<string, number> = {}
  const gotos: { at: number; label: string; line: number }[] = []
  const aliases: Record<string, string> = {}
  let section: string | undefined
  const lines = stripBraces(src).replace(/::(?=[A-Za-z_])/g, '').split(/\r?\n/)
  try {
    lines.forEach((raw, idx) => {
      const line = idx + 1
      try {
        const bare = raw.replace(/--.*$/, '').trim().replace(/;\s*$/, '').trim()
        const up = bare.toUpperCase()
        if (!bare) return
        if (SEQ_HEADERS.includes(up)) return
        if (SECTIONS.includes(up)) {
          section = up
          return
        }
        // declarations (full HLBL program layout)
        if (section === 'CONSTANTS') {
          const m = /^([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(bare)
          if (!m) throw new Error('constant: NAME = value expected')
          code.push({ op: 'set', target: { var: m[1].toUpperCase() }, e: parseExpr(tokenize(m[2])), line })
          return
        }
        if (section === 'VARIABLES') {
          const m = /^([A-Za-z_][\w ,]*)\s*:\s*([A-Za-z]+)(\s*\[\s*\d+\s*\])?\s*(:=\s*(.+))?$/.exec(bare)
          if (!m) throw new Error('variable: NAME : TYPE expected')
          const init = m[5] ? parseExpr(tokenize(m[5])) : { k: 'num' as const, v: 0 }
          for (const n of m[1].split(',')) code.push({ op: 'set', target: { var: n.trim().toUpperCase() }, e: init, line })
          return
        }
        if (section === 'USER_LABELS') {
          const m = /^([A-Za-z_]\w*)\s*:\s*([A-Za-z0-9_]*:[A-Za-z0-9_]+\.[A-Za-z0-9_]+)$/.exec(bare)
          if (!m) throw new Error('user label: NAME : COMPOUND:BLOCK.PARAM expected')
          aliases[m[1].toUpperCase()] = m[2].toUpperCase()
          return
        }
        const lab = /^<<\s*([A-Za-z_]\w*)\s*>>$/.exec(bare)
        if (lab) {
          labels[lab[1].toUpperCase()] = code.length
          return
        }
        let toks = tokenize(raw)
        if (!toks.length) return
        toks = toks.map((t) => aliases[t.toUpperCase()] ?? t)
        let kw = toks[0].toUpperCase()
        if (kw === 'WAIT' && toks[1]?.toUpperCase() === 'UNTIL') {
          kw = 'WAITUNTIL'
          toks = toks.slice(1)
        }
        const top = stack[stack.length - 1]
        if (kw === 'IF' || kw === 'ELSE_IF') {
          const th = toks.findIndex((t) => t.toUpperCase() === 'THEN')
          if (th < 0) throw new Error('THEN expected')
          if (kw === 'ELSE_IF') {
            if (!top || top.kind !== 'IF' || top.hasElse) throw new Error('ELSE_IF without IF')
            code.push({ op: 'jmp', to: -1, line })
            top.ends.push(code.length - 1)
            ;(code[top.jf!] as { to: number }).to = code.length
            code.push({ op: 'jf', e: parseExpr(toks.slice(1, th)), to: -1, line })
            top.jf = code.length - 1
          } else {
            code.push({ op: 'jf', e: parseExpr(toks.slice(1, th)), to: -1, line })
            stack.push({ kind: 'IF', jf: code.length - 1, ends: [], hasElse: false })
          }
        } else if (kw === 'ELSE') {
          if (!top || top.kind !== 'IF' || top.hasElse) throw new Error('ELSE without IF')
          code.push({ op: 'jmp', to: -1, line })
          top.ends.push(code.length - 1)
          ;(code[top.jf!] as { to: number }).to = code.length
          top.jf = undefined
          top.hasElse = true
        } else if (kw === 'ENDIF') {
          const f = stack.pop()
          if (!f || f.kind !== 'IF') throw new Error('ENDIF without IF')
          if (f.jf !== undefined) (code[f.jf] as { to: number }).to = code.length
          for (const j of f.ends) (code[j] as { to: number }).to = code.length
        } else if (kw === 'WHILE') {
          const d = toks.findIndex((t) => t.toUpperCase() === 'DO')
          if (d < 0) throw new Error('DO expected')
          const start = code.length
          code.push({ op: 'jf', e: parseExpr(toks.slice(1, d)), to: -1, line })
          stack.push({ kind: 'WHILE', jf: code.length - 1, start })
        } else if (kw === 'ENDWHILE') {
          const f = stack.pop()
          if (!f || f.kind !== 'WHILE') throw new Error('ENDWHILE without WHILE')
          code.push({ op: 'jmp', to: f.start, line })
          ;(code[f.jf] as { to: number }).to = code.length
        } else if (kw === 'GOTO') {
          if (!toks[1]) throw new Error('label expected')
          code.push({ op: 'jmp', to: -1, line })
          gotos.push({ at: code.length - 1, label: toks[1].toUpperCase(), line })
        } else if (kw === 'WAIT') code.push({ op: 'wait', e: parseExpr(toks.slice(1)), line })
        else if (kw === 'WAITUNTIL') code.push({ op: 'until', e: parseExpr(toks.slice(1)), line })
        else if (kw === 'SENDMSG') code.push({ op: 'msg', e: parseExpr(toks.slice(1)), line })
        else if (kw === 'EXIT') code.push({ op: 'exit', line })
        else if (toks[1] === ':=') {
          const t = toks[0]
          if (!t.includes(':') && KEYWORDS.has(t.toUpperCase())) throw new Error(`"${t}" is a keyword`)
          const target = t.includes(':') ? { ref: t.toUpperCase() } : { var: t.toUpperCase() }
          code.push({ op: 'set', target, e: parseExpr(toks.slice(2)), line })
        } else throw new Error(`unknown statement "${toks[0]}"`)
      } catch (e) {
        throw new Error(`line ${line}: ${(e as Error).message}`)
      }
    })
    if (stack.length) throw new Error(`missing ${stack[stack.length - 1].kind === 'IF' ? 'ENDIF' : 'ENDWHILE'}`)
    for (const g of gotos) {
      if (!(g.label in labels)) throw new Error(`line ${g.line}: label <<${g.label}>> not found`)
      ;(code[g.at] as { to: number }).to = labels[g.label]
    }
  } catch (e) {
    return { code: [], error: (e as Error).message }
  }
  return { code }
}

function evalExpr(e: Expr, b: Block, ctx: ExecCtx, vars: Record<string, Val>): Val {
  switch (e.k) {
    case 'num':
      return e.v
    case 'str':
      return e.v
    case 'var':
      if (!(e.name in vars)) throw new Error(`variable ${e.name} not set`)
      return vars[e.name]
    case 'ref': {
      const r = ctx.read(e.ref, b)
      if (!r) throw new Error(`cannot read ${e.ref}`)
      return typeof r.v === 'boolean' ? (r.v ? 1 : 0) : r.v
    }
    case 'un': {
      const a = evalExpr(e.a, b, ctx, vars)
      return e.op === 'NOT' ? (num(a) ? 0 : 1) : -num(a)
    }
    case 'bin': {
      const a = evalExpr(e.a, b, ctx, vars)
      const c = evalExpr(e.b, b, ctx, vars)
      if (e.op === '+' && (typeof a === 'string' || typeof c === 'string')) return `${a}${c}`
      const x = num(a)
      const y = num(c)
      switch (e.op) {
        case '+': return x + y
        case '-': return x - y
        case '*': return x * y
        case '/': return y === 0 ? 0 : x / y
        case '=': return a === c || x === y ? 1 : 0
        case '<>': return x !== y ? 1 : 0
        case '<': return x < y ? 1 : 0
        case '>': return x > y ? 1 : 0
        case '<=': return x <= y ? 1 : 0
        case '>=': return x >= y ? 1 : 0
        case 'AND': return x && y ? 1 : 0
        case 'OR': return x || y ? 1 : 0
      }
    }
  }
  return 0
}

export const DEFAULT_HLBL = `-- Fill TANK2 to 6 inches, then hand over to the controller
SENDMSG "TANK2 FILL SEQUENCE STARTED"
TANK2_COMP:LC100.MA := FALSE
TANK2_COMP:LC100.OUT := 80
PROCESS_2:MTR_CNTRL.MANRUN := TRUE
WAITUNTIL TANK2_COMP:LT100.PNT >= 6
TANK2_COMP:LC100.SPT := 6
TANK2_COMP:LC100.MA := TRUE
SENDMSG "TANK2 AT LEVEL, LC100 IN AUTO"
`

export const HLBL: BlockTypeDef = {
  type: 'HLBL',
  family: 'sequence',
  desc: {
    en: 'High Level Batch Language: a sequence program (IF, WHILE, WAIT, WAITUNTIL, SENDMSG, assignments to C:B.P). Set ACTIVE to run it; it resumes every scan where it paused.',
    ru: 'High Level Batch Language: программа последовательности (IF, WHILE, WAIT, WAITUNTIL, SENDMSG, присваивания C:B.P). ACTIVE запускает её; каждый скан она продолжает с места паузы.',
  },
  params: [
    ...COMMON,
    P('SOURCE', 'S', DEFAULT_HLBL, 'cfg', 'HLBL source program', { group: 'tune' }),
    P('ACTIVE', 'B', false, 'in', 'Run the program (set true to start, false to abort)', { settable: true, group: 'control' }),
    P('STATE', 'S', 'IDLE', 'out', 'IDLE / RUNNING / WAITING / DONE / ERROR', { group: 'status' }),
    P('STMNO', 'I', 0, 'out', 'Source line being executed', { group: 'status' }),
    P('PERROR', 'S', '', 'out', 'Compile or run-time error', { group: 'status' }),
    P('LASTMSG', 'S', '', 'out', 'Last SENDMSG text', { group: 'status' }),
    ...ALARM_OUT,
  ],
  exec(b, ctx) {
    if (b.links.ACTIVE) b.p.ACTIVE = bool(ctx.input(b, 'ACTIVE').v)
    const src = String(b.p.SOURCE)
    if (b.st.src !== src) {
      b.st.src = src
      b.st.prog = compileHlbl(src)
      b.st.pc = 0
    }
    const prog = b.st.prog as Program
    if (prog.error) {
      b.p.STATE = 'ERROR'
      b.p.PERROR = prog.error
      return ctx.alarm(b, [])
    }
    const active = bool(b.p.ACTIVE)
    if (!active) {
      if (b.st.running) b.p.STATE = 'IDLE'
      b.st.running = false
      b.st.pc = 0
      return ctx.alarm(b, [])
    }
    if (!b.st.running) {
      b.st.running = true
      b.st.pc = 0
      b.st.vars = {}
      b.st.waitUntil = undefined
      b.p.PERROR = ''
    }
    const vars = b.st.vars as Record<string, Val>
    let pc = b.st.pc as number
    try {
      for (let guard = 0; guard < 200; guard++) {
        if (pc >= prog.code.length) {
          b.p.STATE = 'DONE'
          b.p.ACTIVE = false
          b.st.running = false
          break
        }
        const ins = prog.code[pc]
        b.p.STMNO = ins.line
        if (ins.op === 'wait') {
          if (b.st.waitUntil === undefined) b.st.waitUntil = ctx.time + num(evalExpr(ins.e, b, ctx, vars))
          if (ctx.time < (b.st.waitUntil as number)) {
            b.p.STATE = 'WAITING'
            break
          }
          b.st.waitUntil = undefined
          pc++
        } else if (ins.op === 'until') {
          if (!num(evalExpr(ins.e, b, ctx, vars))) {
            b.p.STATE = 'WAITING'
            break
          }
          pc++
        } else if (ins.op === 'set') {
          const v = evalExpr(ins.e, b, ctx, vars)
          if (ins.target.var) vars[ins.target.var] = v
          else if (!ctx.write(ins.target.ref!, v, b)) throw new Error(`cannot write ${ins.target.ref}`)
          pc++
        } else if (ins.op === 'jf') pc = num(evalExpr(ins.e, b, ctx, vars)) ? pc + 1 : ins.to
        else if (ins.op === 'jmp') pc = ins.to
        else if (ins.op === 'msg') {
          const text = String(evalExpr(ins.e, b, ctx, vars))
          b.p.LASTMSG = text
          ctx.message(b, text)
          pc++
        } else if (ins.op === 'exit') {
          pc = prog.code.length
        }
        b.p.STATE = 'RUNNING'
      }
    } catch (e) {
      b.p.STATE = 'ERROR'
      b.p.PERROR = `line ${b.p.STMNO}: ${(e as Error).message}`
      b.p.ACTIVE = false
      b.st.running = false
    }
    b.st.pc = pc
    ctx.alarm(b, [])
  },
}
