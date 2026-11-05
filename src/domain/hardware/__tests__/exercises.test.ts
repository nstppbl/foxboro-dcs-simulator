import { describe, expect, it } from 'vitest'
import { baseSystem, EXERCISES, exercise, grade } from '../exercises'
import { canConnect, type HwNode, type Topology } from '../model'

/** Builds a topology the way the UI does: every wire goes through canConnect. */
function build(start?: Topology) {
  const t: Topology = start ? structuredClone(start) : { nodes: [], links: [] }
  let i = 0
  const add = (typeId: string, extra: Partial<HwNode> = {}) => {
    const id = `n${++i}`
    t.nodes.push({ id, typeId, x: 0, y: 0, ...extra })
    return id
  }
  const wire = (a: string, b: string) => {
    const na = t.nodes.find((n) => n.id === a)!
    const nb = t.nodes.find((n) => n.id === b)!
    const r = canConnect(t, na, nb)
    if (!r.ok) throw new Error(`${a}-${b}: ${r.reason?.en}`)
    t.links.push({ id: `l${t.links.length + 1}`, a, b, kind: r.kind!, channel: r.channel, signal: r.signal })
  }
  /** FBM + TA under a host, letterbug from host */
  const io = (host: string, fbmType: string, lb: string) => {
    const f = add(fbmType, { letterbug: lb })
    wire(f, host)
    const ta = add('TA')
    wire(f, ta)
    return ta
  }
  const inst = (ta: string, typeId: string, tag: string, lo = 0, hi = 100) => wire(ta, add(typeId, { tag, lo, hi }))
  const dual = (st: string, a: string, b: string) => (wire(st, a), wire(st, b))
  return { t, add, wire, io, inst, dual }
}

const pct = (id: string, t: Topology) => grade(exercise(id)!, t)

describe('architecture exercises', () => {
  it('an empty canvas does not pass any exercise', () => {
    for (const e of EXERCISES) expect(grade(e, { nodes: [], links: [] }).pct, e.id).toBeLessThan(100)
  })

  it('ex1: the base system solves it', () => {
    const g = pct('ex1-first', baseSystem())
    expect(g.results.filter((r) => !r.res.ok).map((r) => r.r.id)).toEqual([])
  })

  it('ex1: a single-attached station fails "dual"', () => {
    const t = baseSystem()
    t.links = t.links.filter((l) => l.id !== 'b5')
    expect(pct('ex1-first', t).results.find((r) => r.r.id === 'dual')!.res.ok).toBe(false)
  })

  it('ex2: level loop', () => {
    const b = build(baseSystem())
    const ta = b.io('cp1', 'FBM204', 'CP0111')
    b.inst(ta, 'LT', 'LT101', 0, 5)
    b.inst(ta, 'FV', 'LV101')
    const g = pct('ex2-level', b.t)
    expect(g.results.filter((r) => !r.res.ok).map((r) => [r.r.id, r.res.detail?.en])).toEqual([])
  })

  it('ex3: ZCP270 with FCM100Et', () => {
    const b = build(baseSystem())
    const zcp = b.add('ZCP270', { letterbug: 'CP0201' })
    const fcm = b.add('FCM100Et', { letterbug: 'FC0201' })
    b.dual(zcp, 'swA', 'swB')
    b.dual(fcm, 'swA', 'swB')
    b.wire(fcm, zcp)
    b.inst(b.io(fcm, 'FBM203', 'FC0211'), 'TE_RTD', 'TE301', 0, 150)
    b.inst(b.io(fcm, 'FBM237', 'FC0212'), 'FV', 'TV301')
    const g = pct('ex3-zcp', b.t)
    expect(g.results.filter((r) => !r.res.ok).map((r) => [r.r.id, r.res.detail?.en])).toEqual([])
  })

  it('ex4: R-401 I/O with ≤ 6 FBMs and 20 % spare', () => {
    const b = build()
    const a = b.add('SW24', { side: 'A', role: 'root', letterbug: 'SWA001' })
    const s = b.add('SW24', { side: 'B', role: 'root', letterbug: 'SWB001' })
    b.wire(a, s)
    const cp = b.add('FCP280', { letterbug: 'CP0101' })
    b.dual(cp, a, s)
    b.dual(b.add('H92', { letterbug: 'EW0001' }), a, s)
    b.dual(b.add('H92', { letterbug: 'OW0001' }), a, s)
    const ai = b.io(cp, 'FBM201', 'CP0111')
    for (const tag of ['LT401', 'PT403', 'FT404', 'FT405']) b.inst(ai, tag.startsWith('L') ? 'LT' : tag.startsWith('P') ? 'PT' : 'FT', tag)
    const rtd = b.io(cp, 'FBM203', 'CP0112')
    b.inst(rtd, 'TE_RTD', 'TT401')
    b.inst(rtd, 'TE_RTD', 'TT402')
    const ao = b.io(cp, 'FBM237', 'CP0113')
    for (const tag of ['FV404', 'FV405', 'TV402']) b.inst(ao, 'FV', tag)
    const dio = b.io(cp, 'FBM241', 'CP0114')
    b.inst(dio, 'PUMP', 'M407')
    b.inst(dio, 'XV', 'XV406')
    b.inst(dio, 'ZS', 'YS407')
    b.inst(dio, 'ZS', 'ZSO406')
    const g = pct('ex4-reactor', b.t)
    expect(g.results.filter((r) => !r.res.ok).map((r) => [r.r.id, r.res.detail?.en])).toEqual([])
  })

  it('ex5: star network without SPOF', () => {
    const b = build()
    const rA = b.add('SW24', { side: 'A', role: 'root', letterbug: 'SWA001' })
    const rB = b.add('SW24', { side: 'B', role: 'root', letterbug: 'SWB001' })
    b.wire(rA, rB)
    for (const lbx of ['OW0001', 'OW0002', 'EW0001']) b.dual(b.add('H92', { letterbug: lbx }), rA, rB)
    b.dual(b.add('H91', { letterbug: 'HS0001' }), rA, rB)
    for (const room of [1, 2]) {
      const eA = b.add('SW24', { side: 'A', role: 'edge', letterbug: `SWA${room}01` })
      const eB = b.add('SW24', { side: 'B', role: 'edge', letterbug: `SWB${room}01` })
      for (const e of [eA, eB]) (b.wire(e, rA), b.wire(e, rB))
      for (const k of [1, 2]) b.dual(b.add('FCP280', { letterbug: `CP0${room}0${k}` }), eA, eB)
    }
    const g = pct('ex5-network', b.t)
    expect(g.results.filter((r) => !r.res.ok).map((r) => [r.r.id, r.res.detail?.en])).toEqual([])
  })

  it('ex6: naming convention', () => {
    const b = build()
    const rA = b.add('SW24', { side: 'A', role: 'root', letterbug: 'B501SW' })
    const rB = b.add('SW24', { side: 'B', role: 'root', letterbug: 'B502SW' })
    b.wire(rA, rB)
    for (const lbx of ['B501OW', 'B502OW', 'B501EW']) b.dual(b.add('H92', { letterbug: lbx }), rA, rB)
    b.dual(b.add('H91', { letterbug: 'B501HS' }), rA, rB)
    const eA = b.add('SW24', { side: 'A', role: 'edge', letterbug: 'D701SW' })
    const eB = b.add('SW24', { side: 'B', role: 'edge', letterbug: 'D702SW' })
    for (const e of [eA, eB]) (b.wire(e, rA), b.wire(e, rB))
    for (const lbx of ['D701FC', 'D702FC']) b.dual(b.add('FCP280', { letterbug: lbx }), eA, eB)
    b.dual(b.add('FDC280', { letterbug: 'D701FD' }), eA, eB)
    b.dual(b.add('H92', { letterbug: 'D701EW' }), eA, eB)
    let g = pct('ex6-plant', b.t)
    expect(g.results.filter((r) => !r.res.ok).map((r) => [r.r.id, r.res.detail?.en])).toEqual([])
    // a wrong code is caught
    b.t.nodes.find((n) => n.letterbug === 'D702FC')!.letterbug = 'D702CP'
    g = pct('ex6-plant', b.t)
    expect(g.results.find((r) => r.r.id === 'lb')!.res.ok).toBe(false)
  })
})
