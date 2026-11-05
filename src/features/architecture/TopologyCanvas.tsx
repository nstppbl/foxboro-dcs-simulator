import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Maximize } from 'lucide-react'
import { CATALOG_BY_ID, type Family } from '../../domain/hardware/catalog'
import { familyOf, nodeIndex, typeOf, type HwLink, type HwNode } from '../../domain/hardware/model'
import type { Issue } from '../../domain/hardware/rules'
import { useTopology } from '../../store/topology'
import { useT } from '../../i18n/i18n'

export const NODE_SIZE: Record<Family, [number, number]> = {
  workstation: [130, 50],
  server: [130, 50],
  switch: [180, 40],
  controller: [130, 54],
  fcm: [120, 46],
  fbm: [120, 46],
  ta: [110, 28],
  instrument: [104, 44],
}

const FAMILY_COLOR: Record<Family, { head: string; body: string }> = {
  workstation: { head: '#1d3b6e', body: '#dfe6f1' },
  server: { head: '#33415c', body: '#e2e5ea' },
  switch: { head: '#3d4a57', body: '#d9dee3' },
  controller: { head: '#0b5d4b', body: '#dcefe9' },
  fcm: { head: '#4b5f2a', body: '#e7eedb' },
  fbm: { head: '#6b4a12', body: '#f3ead8' },
  ta: { head: '#5a5a5a', body: '#ececec' },
  instrument: { head: '#7a1f1f', body: '#fbecec' },
}

const LINK_STYLE: Record<HwLink['kind'], { stroke: string; width: number; dash?: string }> = {
  mesh: { stroke: '#2c5597', width: 2 },
  uplink: { stroke: '#222', width: 4 },
  fieldbus: { stroke: '#7b3fa0', width: 2.5, dash: '7 4' },
  host: { stroke: '#666', width: 1.5, dash: '3 3' },
  tacable: { stroke: '#8a5a1c', width: 3 },
  field: { stroke: '#333', width: 1.2 },
}

const center = (n: HwNode) => {
  const [w, h] = NODE_SIZE[familyOf(n)]
  return { x: n.x + w / 2, y: n.y + h / 2 }
}

interface Props {
  issues: Issue[]
  traceIds: string[]
  traceBroken: boolean
}

export function TopologyCanvas({ issues, traceIds, traceBroken }: Props) {
  const s = useTopology()
  const { tb } = useT()
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const drag = useRef<{ kind: 'node' | 'pan'; id?: string; ox: number; oy: number; sx: number; sy: number; moved: boolean } | null>(null)

  const idx = useMemo(() => nodeIndex(s), [s.nodes]) // eslint-disable-line react-hooks/exhaustive-deps
  const failed = useMemo(() => new Set(s.failed), [s.failed])
  const traceSet = useMemo(() => new Set(traceIds), [traceIds])
  const issueBy = useMemo(() => {
    const m = new Map<string, 'error' | 'warning'>()
    for (const i of issues)
      for (const id of i.nodeIds) {
        if (i.severity === 'error') m.set(id, 'error')
        else if (i.severity === 'warning' && !m.has(id)) m.set(id, 'warning')
      }
    return m
  }, [issues])

  const fit = useCallback(() => {
    const el = svgRef.current
    const nodes = useTopology.getState().nodes
    if (!el || !nodes.length) return setView({ x: 0, y: 0, k: 1 })
    const r = el.getBoundingClientRect()
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const n of nodes) {
      const [w, h] = NODE_SIZE[familyOf(n)]
      x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y)
      x1 = Math.max(x1, n.x + w); y1 = Math.max(y1, n.y + h)
    }
    const pad = 30
    const k = Math.min(1.3, Math.max(0.35, Math.min((r.width - 2 * pad) / (x1 - x0), (r.height - 70 - 2 * pad) / (y1 - y0))))
    setView({ k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - 70 - (y1 - y0) * k) / 2 - y0 * k + 10 })
  }, [])

  useEffect(() => {
    const h = requestAnimationFrame(fit)
    return () => cancelAnimationFrame(h)
  }, [s.fitNonce, fit])

  const toWorld = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }
  }

  const onPointerDownNode = (e: React.PointerEvent, n: HwNode) => {
    e.stopPropagation()
    if (s.mode === 'connect') return s.clickForConnect(n.id)
    s.select({ kind: 'node', id: n.id })
    const w = toWorld(e.clientX, e.clientY)
    drag.current = { kind: 'node', id: n.id, ox: w.x - n.x, oy: w.y - n.y, sx: e.clientX, sy: e.clientY, moved: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerDownBg = (e: React.PointerEvent) => {
    s.select(null)
    if (s.mode === 'connect') useTopology.setState({ connectFrom: null })
    drag.current = { kind: 'pan', ox: view.x, oy: view.y, sx: e.clientX, sy: e.clientY, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true
    if (d.kind === 'pan') setView((v) => ({ ...v, x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }))
    else if (d.id && d.moved) {
      const w = toWorld(e.clientX, e.clientY)
      s.moveNode(d.id, Math.round((w.x - d.ox) / 10) * 10, Math.round((w.y - d.oy) / 10) * 10)
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    const k = Math.min(2.5, Math.max(0.35, view.k * (e.deltaY < 0 ? 1.1 : 0.9)))
    setView((v) => ({ k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k }))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const typeId = e.dataTransfer.getData('text/fox-type')
    if (!typeId || !CATALOG_BY_ID[typeId]) return
    const w = toWorld(e.clientX, e.clientY)
    const [nw, nh] = NODE_SIZE[CATALOG_BY_ID[typeId].family]
    s.addNode(typeId, Math.round((w.x - nw / 2) / 10) * 10, Math.round((w.y - nh / 2) / 10) * 10)
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-fox-canvas" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <svg
        ref={svgRef}
        className={`w-full h-full select-none ${s.mode === 'connect' ? 'cursor-crosshair' : 'cursor-grab'}`}
        onPointerDown={onPointerDownBg}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onWheel={onWheel}
        data-testid="topology-canvas"
      >
        <defs>
          <pattern id="grid" width={20} height={20} patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d5d9dd" strokeWidth={1} />
          </pattern>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ffd400" floodOpacity="1" />
          </filter>
        </defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          <rect x={-5000} y={-5000} width={10000} height={10000} fill="url(#grid)" />
          {/* links */}
          {s.links.map((l) => {
            const a = idx[l.a]
            const b = idx[l.b]
            if (!a || !b) return null
            const pa = center(a)
            const pb = center(b)
            const st = LINK_STYLE[l.kind]
            let stroke = st.stroke
            if (l.kind === 'mesh') {
              const sw = familyOf(a) === 'switch' ? a : b
              stroke = sw.side === 'B' ? '#c06a00' : '#2c5597'
            }
            const dead = failed.has(l.a) || failed.has(l.b)
            const hot = traceSet.has(l.a) && traceSet.has(l.b)
            const sel = s.selected?.kind === 'link' && s.selected.id === l.id
            const mx = (pa.x + pb.x) / 2
            const my = (pa.y + pb.y) / 2
            return (
              <g key={l.id} onPointerDown={(e) => (e.stopPropagation(), s.select({ kind: 'link', id: l.id }))} className="cursor-pointer">
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="transparent" strokeWidth={12} />
                {hot && <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={traceBroken ? '#ff6b6b' : '#ffd400'} strokeWidth={st.width + 7} strokeLinecap="round" opacity={0.85} />}
                <line
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke={dead ? '#d01c1c' : sel ? '#00a3b4' : stroke}
                  strokeWidth={sel ? st.width + 1.5 : st.width}
                  strokeDasharray={dead ? '4 4' : st.dash}
                />
                {l.kind === 'field' && (
                  <g transform={`translate(${mx},${my})`}>
                    <rect x={-14} y={-8} width={28} height={16} rx={3} fill="#fff" stroke="#333" strokeWidth={0.8} />
                    <text textAnchor="middle" dy={4} fontSize={10} fontFamily="IBM Plex Mono">
                      {`ch${l.channel}`}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
          {/* nodes */}
          {s.nodes.map((n) => {
            const t = typeOf(n)
            if (!t) return null
            const fam = t.family
            const [w, h] = NODE_SIZE[fam]
            const c = FAMILY_COLOR[fam]
            const isFailed = failed.has(n.id)
            const sel = s.selected?.kind === 'node' && s.selected.id === n.id
            const src = s.connectFrom === n.id
            const iss = issueBy.get(n.id)
            const line1 = fam === 'instrument' ? n.tag || `${t.id.replace(/_.*/, '')} ?` : t.label
            const line2 =
              fam === 'instrument'
                ? `${t.signal}${n.lo !== undefined ? `  ${n.lo}-${n.hi} ${n.eu ?? ''}` : ''}`
                : fam === 'switch'
                  ? `${n.letterbug ?? ''} · side ${n.side ?? '?'}${n.role ? ` · ${n.role}` : ''}`
                  : fam === 'ta'
                    ? ''
                    : n.letterbug ?? ''
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                onPointerDown={(e) => onPointerDownNode(e, n)}
                onDoubleClick={() => fam === 'instrument' && s.setTrace(n.id)}
                className="cursor-pointer"
                filter={traceSet.has(n.id) ? 'url(#glow)' : undefined}
                data-node={n.id}
              >
                <rect width={w} height={h} rx={fam === 'instrument' ? 22 : 3} fill={isFailed ? '#f6c9c9' : c.body} stroke={sel || src ? '#00a3b4' : '#555'} strokeWidth={sel || src ? 3 : 1} />
                {fam !== 'instrument' && fam !== 'ta' && <rect width={w} height={16} rx={3} fill={isFailed ? '#a11' : c.head} />}
                {fam === 'instrument' || fam === 'ta' ? (
                  <>
                    <text x={w / 2} y={fam === 'ta' ? 18 : 19} textAnchor="middle" fontSize={fam === 'ta' ? 10 : 12} fontWeight={600} fontFamily="IBM Plex Mono">
                      {fam === 'ta' ? 'TA' : line1}
                    </text>
                    {line2 && (
                      <text x={w / 2} y={33} textAnchor="middle" fontSize={9} fill="#444">
                        {line2}
                      </text>
                    )}
                  </>
                ) : (
                  <>
                    <text x={6} y={12} fontSize={10} fill="#fff" fontWeight={600}>
                      {line1}
                    </text>
                    <text x={6} y={h / 2 + 12} fontSize={12} fontFamily="IBM Plex Mono" fontWeight={600}>
                      {line2}
                    </text>
                    {n.note && (
                      <text x={w - 4} y={h - 4} fontSize={8} textAnchor="end" fill="#555">
                        {n.note}
                      </text>
                    )}
                  </>
                )}
                {isFailed && (
                  <g stroke="#d01c1c" strokeWidth={3}>
                    <line x1={4} y1={4} x2={w - 4} y2={h - 4} />
                    <line x1={w - 4} y1={4} x2={4} y2={h - 4} />
                  </g>
                )}
                {iss && (
                  <g transform={`translate(${w - 8},-6)`}>
                    <circle r={8} fill={iss === 'error' ? '#d01c1c' : '#c98a00'} stroke="#fff" strokeWidth={1.5} />
                    <text textAnchor="middle" dy={4} fontSize={11} fill="#fff" fontWeight={700}>
                      !
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      {s.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-500">
          {tb({ en: 'Drag hardware from the palette to start building.', ru: 'Перетащите оборудование из палитры, чтобы начать.' })}
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex gap-1">
        <button className="btn" onClick={fit} data-testid="fit">
          <Maximize size={12} /> Fit
        </button>
        <button className="btn" onClick={() => setView((v) => ({ ...v, k: Math.min(2.5, v.k * 1.2) }))}>
          +
        </button>
        <button className="btn" onClick={() => setView((v) => ({ ...v, k: Math.max(0.35, v.k / 1.2) }))}>
          −
        </button>
      </div>
      <Legend />
    </div>
  )
}

function Legend() {
  const { tb } = useT()
  const items: [string, string, string | undefined, string][] = [
    ['MESH A', '#2c5597', undefined, 'Ethernet 100 Mbps'],
    ['MESH B', '#c06a00', undefined, 'Ethernet 100 Mbps'],
    ['Uplink', '#222', undefined, '1 Gbps'],
    ['Fieldbus', '#7b3fa0', '7 4', '2 Mbps'],
    ['FCM→ZCP', '#666', '3 3', tb({ en: 'hosted by', ru: 'хост' })],
    ['TA cable', '#8a5a1c', undefined, ''],
  ]
  return (
    <div className="absolute bottom-2 left-2 panel px-2 py-1 text-[10px] grid grid-cols-2 gap-x-3 gap-y-0.5 opacity-90 pointer-events-none">
      {items.map(([l, c, d, sub]) => (
        <div key={l} className="flex items-center gap-1">
          <svg width={26} height={8}>
            <line x1={0} y1={4} x2={26} y2={4} stroke={c} strokeWidth={l === 'Uplink' ? 4 : 2} strokeDasharray={d} />
          </svg>
          <span className="font-semibold">{l}</span>
          <span className="text-gray-600">{sub}</span>
        </div>
      ))}
    </div>
  )
}
