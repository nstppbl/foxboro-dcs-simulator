import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CATALOG_BY_ID, type Era } from '../domain/hardware/catalog'
import { canConnect, familyOf, neighbors, nodeIndex, type ConnectResult, type HwNode, type Topology } from '../domain/hardware/model'
import { PRESETS } from '../domain/hardware/presets'

export type Mode = 'select' | 'connect'

interface TopologyState extends Topology {
  selected: { kind: 'node' | 'link'; id: string } | null
  failed: string[]
  traceFrom: string | null
  mode: Mode
  connectFrom: string | null
  eraFilter: Era | 'all'
  presetId: string
  fitNonce: number
  toast: { text: { en: string; ru: string }; ok: boolean; at: number } | null

  loadPreset: (id: string) => void
  addNode: (typeId: string, x: number, y: number) => void
  moveNode: (id: string, x: number, y: number) => void
  updateNode: (id: string, patch: Partial<HwNode>) => void
  removeSelected: () => void
  select: (s: TopologyState['selected']) => void
  setMode: (m: Mode) => void
  clickForConnect: (id: string) => void
  toggleFail: (id: string) => void
  restoreAll: () => void
  setTrace: (id: string | null) => void
  setEra: (e: Era | 'all') => void
  clearToast: () => void
}

let seq = Date.now() % 100000
const uid = (p: string) => `${p}${(++seq).toString(36)}`

/** Suggest a letterbug for a freshly placed node. */
function suggestLetterbug(t: Topology, typeId: string): string | undefined {
  const fam = CATALOG_BY_ID[typeId].family
  const used = new Set(t.nodes.map((n) => n.letterbug))
  const prefix: Record<string, string> = { workstation: 'AW', server: 'AP', controller: 'CP', fcm: 'FC', switch: 'SW' }
  if (!prefix[fam]) return undefined
  for (let i = 1; i < 9999; i++) {
    const lb = `${prefix[fam]}${String(i).padStart(4, '0')}`
    if (!used.has(lb)) return lb
  }
}

/** FBM letterbug = host's first 4 chars + baseplate (1..) + position (1..8). */
function fbmLetterbug(t: Topology, host: HwNode): string {
  const p4 = (host.letterbug ?? 'XXXX').slice(0, 4).toUpperCase().padEnd(4, 'X')
  const used = new Set(t.nodes.map((n) => n.letterbug))
  for (let bp = 1; bp <= 9; bp++)
    for (let pos = 1; pos <= 8; pos++) {
      const lb = `${p4}${bp}${pos}`
      if (!used.has(lb)) return lb
    }
  return `${p4}99`
}

export const useTopology = create<TopologyState>()(
  persist(
    (set, get) => ({
      ...PRESETS[0].build(),
      selected: null,
      failed: [],
      traceFrom: null,
      mode: 'select',
      connectFrom: null,
      eraFilter: 'all',
      presetId: PRESETS[0].id,
      fitNonce: 0,
      toast: null,

      loadPreset: (id) => {
        const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0]
        set((st) => ({ ...p.build(), presetId: p.id, fitNonce: st.fitNonce + 1, selected: null, failed: [], traceFrom: null, connectFrom: null }))
      },

      addNode: (typeId, x, y) => {
        const s = get()
        const t = CATALOG_BY_ID[typeId]
        const node: HwNode = { id: uid('n'), typeId, x, y, letterbug: suggestLetterbug(s, typeId) }
        if (t.family === 'switch') node.side = s.nodes.filter((n) => familyOf(n) === 'switch' && n.side === 'A').length <= s.nodes.filter((n) => familyOf(n) === 'switch' && n.side === 'B').length ? 'A' : 'B'
        if (t.family === 'instrument') {
          const prefix = typeId.startsWith('TE') ? 'TE' : typeId === 'PUMP' ? 'P' : typeId
          node.tag = `${prefix}${100 + s.nodes.filter((n) => familyOf(n) === 'instrument').length + 1}`
          if (t.signal === 'AI' || t.signal === 'AO' || t.signal === 'TC' || t.signal === 'RTD') Object.assign(node, { lo: 0, hi: 100, eu: t.signal === 'AO' ? '%' : 'EU' })
        }
        set({ nodes: [...s.nodes, node], selected: { kind: 'node', id: node.id } })
      },

      moveNode: (id, x, y) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) })),

      updateNode: (id, patch) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),

      removeSelected: () => {
        const { selected } = get()
        if (!selected) return
        if (selected.kind === 'link') set((s) => ({ links: s.links.filter((l) => l.id !== selected.id), selected: null }))
        else
          set((s) => ({
            nodes: s.nodes.filter((n) => n.id !== selected.id),
            links: s.links.filter((l) => l.a !== selected.id && l.b !== selected.id),
            failed: s.failed.filter((f) => f !== selected.id),
            traceFrom: s.traceFrom === selected.id ? null : s.traceFrom,
            selected: null,
          }))
      },

      select: (selected) => set({ selected }),

      setMode: (mode) => set({ mode, connectFrom: null }),

      clickForConnect: (id) => {
        const s = get()
        if (!s.connectFrom) return set({ connectFrom: id, selected: { kind: 'node', id } })
        const idx = nodeIndex(s)
        const a = idx[s.connectFrom]
        const b = idx[id]
        const r: ConnectResult = canConnect(s, a, b)
        if (!r.ok) return set({ connectFrom: null, toast: { text: r.reason!, ok: false, at: Date.now() } })
        const link = { id: uid('L'), a: a.id, b: b.id, kind: r.kind!, channel: r.channel, signal: r.signal }
        let nodes = s.nodes
        // auto-assign FBM letterbug from its host
        if (r.kind === 'fieldbus') {
          const fbm = familyOf(a) === 'fbm' ? a : b
          const host = fbm === a ? b : a
          const lb = fbmLetterbug({ nodes: s.nodes.filter((n) => n.id !== fbm.id), links: s.links }, host)
          nodes = nodes.map((n) => (n.id === fbm.id ? { ...n, letterbug: lb } : n))
        }
        const msg =
          r.kind === 'field'
            ? { en: `Wired to channel ${r.channel} (${r.signal}).`, ru: `Подключено к каналу ${r.channel} (${r.signal}).` }
            : { en: `Connected (${r.kind}).`, ru: `Соединено (${r.kind}).` }
        set({ nodes, links: [...s.links, link], connectFrom: null, selected: { kind: 'link', id: link.id }, toast: { text: msg, ok: true, at: Date.now() } })
      },

      toggleFail: (id) => set((s) => ({ failed: s.failed.includes(id) ? s.failed.filter((f) => f !== id) : [...s.failed, id] })),
      restoreAll: () => set({ failed: [] }),
      setTrace: (traceFrom) => set({ traceFrom }),
      setEra: (eraFilter) => set({ eraFilter }),
      clearToast: () => set({ toast: null }),
    }),
    {
      name: 'fox.topology.v1',
      partialize: (s) => ({ nodes: s.nodes, links: s.links, failed: s.failed, eraFilter: s.eraFilter, presetId: s.presetId }),
    },
  ),
)

/** Helper used by the inspector. */
export function fbmCountOf(t: Topology, id: string) {
  return neighbors(t, id, 'fieldbus').length
}
