import { familyOf, isStation, nodeIndex, otherEnd, type HwNode, type Topology } from './model'
import type { Bilingual } from './catalog'

/** Ethernet graph over the MESH (switches + stations), skipping failed nodes. */
export function ethernetAdjacency(t: Topology, failed: Set<string>): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const n of t.nodes) if (!failed.has(n.id) && (isStation(n) || familyOf(n) === 'switch')) adj.set(n.id, [])
  for (const l of t.links) {
    if (l.kind !== 'mesh' && l.kind !== 'uplink') continue
    if (!adj.has(l.a) || !adj.has(l.b)) continue
    adj.get(l.a)!.push(l.b)
    adj.get(l.b)!.push(l.a)
  }
  return adj
}

/** BFS shortest path (node ids) on the Ethernet graph. Stations are not allowed as transit hops. */
export function ethernetPath(t: Topology, failed: Set<string>, from: string, to: string): string[] | undefined {
  const adj = ethernetAdjacency(t, failed)
  if (!adj.has(from) || !adj.has(to)) return undefined
  const byId = nodeIndex(t)
  const prev = new Map<string, string | null>([[from, null]])
  const q = [from]
  while (q.length) {
    const cur = q.shift()!
    if (cur === to) break
    // only switches forward traffic
    if (cur !== from && familyOf(byId[cur]) !== 'switch') continue
    for (const nx of adj.get(cur)!) {
      if (!prev.has(nx)) {
        prev.set(nx, cur)
        q.push(nx)
      }
    }
  }
  if (!prev.has(to)) return undefined
  const path: string[] = []
  for (let c: string | null = to; c; c = prev.get(c) ?? null) path.unshift(c)
  return path
}

export type TopologyKind = 'none' | 'single' | 'linear' | 'ring' | 'star' | 'tree' | 'hybrid' | 'disconnected'

export const TOPOLOGY_LABEL: Record<TopologyKind, Bilingual> = {
  none: { en: 'No switches', ru: 'Нет коммутаторов' },
  single: { en: 'Single switch (no network redundancy)', ru: 'Один коммутатор (нет резервирования сети)' },
  linear: { en: 'Linear', ru: 'Linear (линейная)' },
  ring: { en: 'Ring', ru: 'Ring (кольцо)' },
  star: { en: 'Star', ru: 'Star (звезда)' },
  tree: { en: 'Inverted Tree', ru: 'Inverted Tree (перевёрнутое дерево)' },
  hybrid: { en: 'Hybrid / custom', ru: 'Гибридная / нестандартная' },
  disconnected: { en: 'Disconnected switch groups', ru: 'Несвязанные группы коммутаторов' },
}

export interface NetworkReport {
  switchCount: number
  topology: TopologyKind
  /** stations with fewer than two independent switch connections */
  nonRedundant: HwNode[]
  /** switches whose single failure isolates at least one station pair */
  spof: { sw: HwNode; isolated: HwNode[] }[]
  /** max number of switches between any two stations */
  maxHops: number
  /** station pairs that cannot reach each other right now */
  unreachable: [HwNode, HwNode][]
}

function switchGraph(t: Topology) {
  const sws = t.nodes.filter((n) => familyOf(n) === 'switch')
  const ids = new Set(sws.map((s) => s.id))
  const deg = new Map(sws.map((s) => [s.id, 0]))
  const adj = new Map<string, string[]>(sws.map((s) => [s.id, []]))
  let edges = 0
  for (const l of t.links) {
    if (l.kind === 'uplink' && ids.has(l.a) && ids.has(l.b)) {
      edges++
      deg.set(l.a, deg.get(l.a)! + 1)
      deg.set(l.b, deg.get(l.b)! + 1)
      adj.get(l.a)!.push(l.b)
      adj.get(l.b)!.push(l.a)
    }
  }
  return { sws, deg, adj, edges }
}

export function detectTopology(t: Topology): TopologyKind {
  const { sws, deg, adj, edges } = switchGraph(t)
  const n = sws.length
  if (n === 0) return 'none'
  if (n === 1) return 'single'
  // connectivity
  const seen = new Set([sws[0].id])
  const q = [sws[0].id]
  while (q.length) for (const nx of adj.get(q.shift()!)!) if (!seen.has(nx)) (seen.add(nx), q.push(nx))
  if (seen.size !== n) return 'disconnected'
  const degs = sws.map((s) => deg.get(s.id)!)
  if (n === 2) return 'linear'
  if (edges === n - 1 && degs.filter((d) => d === 1).length === 2 && degs.every((d) => d <= 2)) return 'linear'
  if (edges === n && degs.every((d) => d === 2)) return 'ring'
  // star: two roots linked together, every other switch linked to both roots and only to them
  const sorted = [...sws].sort((a, b) => deg.get(b.id)! - deg.get(a.id)!)
  const [r1, r2] = sorted
  const rootsLinked = adj.get(r1.id)!.includes(r2.id)
  const edgesOk = sorted.slice(2).every((s) => {
    const nb = adj.get(s.id)!
    return nb.length === 2 && nb.includes(r1.id) && nb.includes(r2.id)
  })
  if (rootsLinked && edgesOk) return 'star'
  // inverted tree: roots linked, every non-root has exactly two uplinks to switches closer to the roots
  if (rootsLinked) {
    const level = new Map<string, number>([[r1.id, 0], [r2.id, 0]])
    const qq = [r1.id, r2.id]
    while (qq.length) {
      const c = qq.shift()!
      for (const nx of adj.get(c)!) if (!level.has(nx)) (level.set(nx, level.get(c)! + 1), qq.push(nx))
    }
    const treeOk = sorted.slice(2).every((s) => adj.get(s.id)!.filter((nx) => level.get(nx)! < level.get(s.id)!).length === 2)
    const tiers = Math.max(...level.values()) + 1
    if (treeOk && tiers <= 4) return 'tree'
  }
  return 'hybrid'
}

export function analyzeNetwork(t: Topology, failed: Set<string>): NetworkReport {
  const byId = nodeIndex(t)
  const stations = t.nodes.filter(isStation)
  const sws = t.nodes.filter((n) => familyOf(n) === 'switch')

  const nonRedundant = stations.filter((s) => {
    const swLinks = t.links.filter((l) => l.kind === 'mesh' && (l.a === s.id || l.b === s.id))
    return new Set(swLinks.map((l) => otherEnd(l, s.id))).size < 2
  })

  const reachPairs = (f: Set<string>) => {
    const bad: [HwNode, HwNode][] = []
    let maxHops = 0
    const alive = stations.filter((s) => !f.has(s.id))
    for (let i = 0; i < alive.length; i++)
      for (let j = i + 1; j < alive.length; j++) {
        const p = ethernetPath(t, f, alive[i].id, alive[j].id)
        if (!p) bad.push([alive[i], alive[j]])
        else maxHops = Math.max(maxHops, p.filter((id) => familyOf(byId[id]) === 'switch').length)
      }
    return { bad, maxHops }
  }

  const now = reachPairs(failed)
  const spof: NetworkReport['spof'] = []
  for (const sw of sws) {
    if (failed.has(sw.id)) continue
    const f = new Set(failed)
    f.add(sw.id)
    const r = reachPairs(f)
    if (r.bad.length > now.bad.length) {
      const iso = new Set<string>()
      r.bad.forEach(([a, b]) => (iso.add(a.id), iso.add(b.id)))
      spof.push({ sw, isolated: [...iso].map((id) => byId[id]) })
    }
  }

  return {
    switchCount: sws.length,
    topology: detectTopology(t),
    nonRedundant,
    spof,
    maxHops: now.maxHops,
    unreachable: now.bad,
  }
}
