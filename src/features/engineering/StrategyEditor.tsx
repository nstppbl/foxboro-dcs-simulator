import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { blockState, PORTS, type CfgBlock, type CfgCompound, type CfgDb } from '../../engine/config'
import { BLOCK_TYPES, paramDef } from '../../engine/registry'
import { parseRef } from '../../engine/station'
import { useLang } from '../../i18n/i18n'
import { useEng } from '../../store/engineering'
import { useL } from '../control/ui'
import { BlockSheet, CompoundSheet, STATE_COLOR } from './CfgSheet'

const W = 200
const HEAD = 36
const ROW = 18

const FAMILIES: { f: string; en: string; ru: string }[] = [
  { f: 'io', en: 'Input / Output', ru: 'Ввод / вывод' },
  { f: 'control', en: 'Control', ru: 'Регулирование' },
  { f: 'calc', en: 'Calculation', ru: 'Вычисления' },
  { f: 'logic', en: 'Logic / motor', ru: 'Логика / двигатели' },
  { f: 'sequence', en: 'Sequence', ru: 'Последовательности' },
  { f: 'process', en: 'Process simulation', ru: 'Моделирование процесса' },
]

interface Geo {
  b: CfgBlock
  ins: string[]
  outs: string[]
  h: number
}

/** Outputs of a block that something in the station reads. */
function readOutputs(cfg: CfgDb, c: string, b: string): string[] {
  const out = new Set<string>()
  for (const c2 of cfg.compounds)
    for (const b2 of c2.blocks)
      for (const src of Object.values(b2.links)) {
        const r = parseRef(src, c2.name)
        if (r && r.c === c && r.b === b) out.add(r.p)
      }
  return [...out]
}

function geometry(cfg: CfgDb, c: CfgCompound): Record<string, Geo> {
  const g: Record<string, Geo> = {}
  for (const b of c.blocks) {
    const ports = PORTS[b.type] ?? { in: [], out: [] }
    const ins = [...new Set([...ports.in, ...Object.keys(b.links)])]
    const outs = [...new Set([...ports.out, ...readOutputs(cfg, c.name, b.name)])]
    g[b.name] = { b, ins, outs, h: HEAD + Math.max(ins.length, outs.length, 1) * ROW + 6 }
  }
  return g
}

const inY = (geo: Geo, p: string) => geo.b.y + HEAD + geo.ins.indexOf(p) * ROW + ROW / 2
const outY = (geo: Geo, p: string) => geo.b.y + HEAD + geo.outs.indexOf(p) * ROW + ROW / 2

const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = Math.max(40, Math.abs(x2 - x1) / 2)
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
}

type Drag = { kind: 'move'; b: string; dx: number; dy: number } | { kind: 'wire'; b: string; p: string; x: number; y: number }

/** Strategy Editor (Control Editors / IACC CSD style) for one compound. */
export function StrategyEditor() {
  const L = useL()
  const { lang } = useLang()
  const { cfg, cp, selC, selB, selectBlock, addBlock, moveBlock, setLink, deleteBlock } = useEng()
  const c = cfg.compounds.find((x) => x.name === selC)
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag>()
  const [selEdge, setSelEdge] = useState<{ b: string; p: string }>()
  const [menu, setMenu] = useState<{ x: number; y: number; target: string; src: string }>()
  const geo = useMemo(() => (c ? geometry(cfg, c) : {}), [cfg, c])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (selEdge && c) {
        setLink(c.name, selEdge.b, selEdge.p, '')
        setSelEdge(undefined)
      } else if (selB && c) deleteBlock(c.name, selB)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selEdge, selB, c, setLink, deleteBlock])

  if (!c) return <div className="p-4 text-sm">{L('Select or create a compound.', 'Выберите или создайте compound.')}</div>


  const maxY = Math.max(620, ...Object.values(geo).map((g) => g.b.y + g.h + 120))

  const edges: { from: Geo; fp: string; to: Geo; tp: string }[] = []
  const stubsIn: { to: Geo; tp: string; src: string }[] = []
  const stubsOut: { from: Geo; fp: string; dst: string }[] = []
  for (const g of Object.values(geo)) {
    for (const [tp, src] of Object.entries(g.b.links)) {
      const r = parseRef(src, c.name)
      if (r && r.c === c.name && geo[r.b] && geo[r.b].outs.includes(r.p)) edges.push({ from: geo[r.b], fp: r.p, to: g, tp })
      else stubsIn.push({ to: g, tp, src })
    }
  }
  for (const c2 of cfg.compounds) {
    if (c2.name === c.name) continue
    for (const b2 of c2.blocks)
      for (const [p2, src] of Object.entries(b2.links)) {
        const r = parseRef(src, c2.name)
        if (r && r.c === c.name && geo[r.b]) stubsOut.push({ from: geo[r.b], fp: r.p, dst: `${c2.name}:${b2.name}.${p2}` })
      }
  }

  // left margin so that incoming cross-compound connection labels stay visible
  const OX = Math.max(20, ...stubsIn.map((x) => x.src.length * 6.3 + 40 - x.to.b.x))
  const pt = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!
    const m = svg.getScreenCTM()!.inverse()
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m)
    return { x: p.x - OX, y: p.y }
  }

  const maxX = Math.max(900, ...Object.values(geo).map((g) => g.b.x + W + 260)) + OX
  const finishWire = (e: React.PointerEvent, d: Extract<Drag, { kind: 'wire' }>) => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null
    const port = el?.closest('[data-in]')
    const body = el?.closest('[data-block]')
    const src = `:${d.b}.${d.p}`
    if (port) {
      const [tb, tp] = port.getAttribute('data-in')!.split('.')
      if (tb === d.b) return
      setLink(c.name, tb, tp, src)
    } else if (body) {
      const tb = body.getAttribute('data-block')!
      if (tb === d.b) return
      const r = svgRef.current!.parentElement!.getBoundingClientRect()
      setMenu({ x: e.clientX - r.left + svgRef.current!.parentElement!.scrollLeft, y: e.clientY - r.top + svgRef.current!.parentElement!.scrollTop, target: tb, src })
    }
  }

  const sel = selB ? c.blocks.find((b) => b.name === selB) : undefined

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* palette */}
      <div className="lg:w-44 shrink-0 bg-fox-panel border-r border-fox-edge overflow-auto max-h-40 lg:max-h-none select-none">
        <div className="titlebar">{L('Palette', 'Палитра')}</div>
        {FAMILIES.map((f) => {
          const types = Object.values(BLOCK_TYPES).filter((t) => t.family === f.f)
          if (!types.length) return null
          return (
            <div key={f.f} className="px-2 py-1">
              <div className="text-[10px] uppercase text-gray-600">{lang === 'ru' ? f.ru : f.en}</div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {types.map((t) => (
                  <button
                    key={t.type}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/fox-block', t.type)}
                    onClick={() => addBlock(t.type)}
                    title={t.desc[lang]}
                    className="btn !px-1.5 font-mono cursor-grab"
                  >
                    {t.type}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        <p className="text-[10px] text-gray-600 px-2 py-2">
          {L('Drag a block onto the sheet (or click it). Drag from an output port (right) to an input port (left) to connect. Select a block or a wire and press Delete to remove it.', 'Перетащите блок на лист (или щёлкните). Тяните от выходного порта (справа) к входному (слева), чтобы соединить. Выделите блок или связь и нажмите Delete, чтобы удалить.')}
        </p>
      </div>

      {/* sheet */}
      <div
        className="flex-1 min-w-0 min-h-[300px] overflow-auto relative bg-white"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const t = e.dataTransfer.getData('text/fox-block')
          if (!t) return
          const p = pt(e)
          addBlock(t, p.x - W / 2, p.y - 15)
        }}
      >
        <svg
          ref={svgRef}
          width={maxX}
          height={maxY}
          className="block select-none"
          style={{ backgroundImage: 'radial-gradient(#d0d4d8 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          onPointerMove={(e) => {
            if (!drag) return
            const p = pt(e)
            if (drag.kind === 'move') moveBlock(c.name, drag.b, p.x - drag.dx, p.y - drag.dy)
            else setDrag({ ...drag, x: p.x, y: p.y })
          }}
          onPointerUp={(e) => {
            if (drag?.kind === 'wire') finishWire(e, drag)
            setDrag(undefined)
          }}
          onPointerDown={(e) => {
            if (e.target === svgRef.current) {
              selectBlock(undefined)
              setSelEdge(undefined)
              setMenu(undefined)
            }
          }}
        >
          <g transform={`translate(${OX},0)`}>
          {/* wires */}
          {edges.map((ed) => {
            const x1 = ed.from.b.x + W
            const y1 = outY(ed.from, ed.fp)
            const x2 = ed.to.b.x
            const y2 = inY(ed.to, ed.tp)
            const on = selEdge?.b === ed.to.b.name && selEdge.p === ed.tp
            const d = curve(x1, y1, x2, y2)
            return (
              <g key={`${ed.to.b.name}.${ed.tp}`} className="cursor-pointer" onPointerDown={() => (setSelEdge({ b: ed.to.b.name, p: ed.tp }), selectBlock(undefined))}>
                <path d={d} stroke="transparent" strokeWidth={10} fill="none" />
                <path d={d} stroke={on ? '#d01c1c' : '#1d3b6e'} strokeWidth={on ? 2.5 : 1.5} fill="none" />
              </g>
            )
          })}
          {stubsIn.map((s) => {
            const y = inY(s.to, s.tp)
            const x = s.to.b.x
            const on = selEdge?.b === s.to.b.name && selEdge.p === s.tp
            const text = s.src
            const w = text.length * 6.3 + 12
            return (
              <g key={`in-${s.to.b.name}.${s.tp}`} className="cursor-pointer" onPointerDown={() => (setSelEdge({ b: s.to.b.name, p: s.tp }), selectBlock(undefined))}>
                <line x1={x - 18} x2={x} y1={y} y2={y} stroke={on ? '#d01c1c' : '#2c5597'} strokeWidth={1.5} />
                <rect x={x - 18 - w} y={y - 8} width={w} height={16} fill="#e8eef8" stroke={on ? '#d01c1c' : '#2c5597'} />
                <text x={x - 18 - w + 6} y={y + 4} fontSize={10.5} fontFamily="monospace" fill="#1d3b6e">
                  {text}
                </text>
              </g>
            )
          })}
          {stubsOut.map((s) => {
            const y = outY(s.from, s.fp)
            const x = s.from.b.x + W
            const w = s.dst.length * 6.3 + 18
            return (
              <g key={`out-${s.from.b.name}.${s.fp}-${s.dst}`}>
                <line x1={x} x2={x + 18} y1={y} y2={y} stroke="#2c5597" strokeWidth={1.5} />
                <rect x={x + 18} y={y - 8} width={w} height={16} fill="#eef6ee" stroke="#2c7a3c" />
                <text x={x + 24} y={y + 4} fontSize={10.5} fontFamily="monospace" fill="#1f5f2f">
                  → {s.dst}
                </text>
              </g>
            )
          })}

          {/* blocks */}
          {c.blocks.map((b, idx) => {
            const g = geo[b.name]
            const st = blockState(c, b, cp)
            const on = selB === b.name
            return (
              <g key={b.name} data-block={b.name}>
                <rect x={b.x} y={b.y} width={W} height={g.h} fill="#f4f5f6" stroke={on ? '#d01c1c' : '#5a636b'} strokeWidth={on ? 2.5 : 1.2} />
                <g
                  className="cursor-move"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    const p = pt(e)
                    ;(e.target as Element).setPointerCapture?.(e.pointerId)
                    setDrag({ kind: 'move', b: b.name, dx: p.x - b.x, dy: p.y - b.y })
                    selectBlock(b.name)
                    setSelEdge(undefined)
                    setMenu(undefined)
                  }}
                >
                  <rect x={b.x} y={b.y} width={W} height={HEAD - 4} fill="#1d3b6e" />
                  <rect x={b.x} y={b.y} width={5} height={HEAD - 4} fill={STATE_COLOR[st]} />
                  <text x={b.x + 10} y={b.y + 14} fill="#fff" fontSize={12} fontWeight={700} fontFamily="monospace">
                    {b.name}
                  </text>
                  <text x={b.x + 10} y={b.y + 27} fill="#c8d4e8" fontSize={10} fontFamily="monospace">
                    {b.type} · {st}
                  </text>
                  <text x={b.x + W - 8} y={b.y + 14} fill="#c8d4e8" fontSize={10} textAnchor="end" fontFamily="monospace">
                    #{idx + 1}
                  </text>
                </g>
                {g.ins.map((p) => {
                  const y = inY(g, p)
                  const linked = !!b.links[p]
                  return (
                    <g key={`i${p}`} data-in={`${b.name}.${p}`}>
                      <rect x={b.x - 6} y={y - 5} width={10} height={10} fill={linked ? '#1d3b6e' : '#fff'} stroke="#1d3b6e" />
                      <rect x={b.x} y={y - ROW / 2} width={W / 2} height={ROW} fill="transparent" />
                      <text x={b.x + 9} y={y + 4} fontSize={11} fontFamily="monospace" fill="#222">
                        {p}
                      </text>
                    </g>
                  )
                })}
                {g.outs.map((p) => {
                  const y = outY(g, p)
                  return (
                    <g
                      key={`o${p}`}
                      className="cursor-crosshair"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const q = pt(e)
                        setDrag({ kind: 'wire', b: b.name, p, x: q.x, y: q.y })
                        setMenu(undefined)
                      }}
                    >
                      <rect x={b.x + W / 2} y={y - ROW / 2} width={W / 2} height={ROW} fill="transparent" />
                      <text x={b.x + W - 9} y={y + 4} fontSize={11} fontFamily="monospace" textAnchor="end" fill="#222">
                        {p}
                      </text>
                      <polygon points={`${b.x + W - 2},${y - 5} ${b.x + W + 8},${y} ${b.x + W - 2},${y + 5}`} fill="#2c7a3c" />
                    </g>
                  )
                })}
              </g>
            )
          })}

          {drag?.kind === 'wire' && geo[drag.b] && (
            <path d={curve(geo[drag.b].b.x + W, outY(geo[drag.b], drag.p), drag.x, drag.y)} stroke="#d01c1c" strokeDasharray="5 3" strokeWidth={1.5} fill="none" pointerEvents="none" />
          )}
          </g>
        </svg>

        {menu && (
          <div className="absolute z-10 bg-white border border-fox-edge shadow-lg text-[12px] max-h-64 overflow-auto" style={{ left: menu.x, top: menu.y }}>
            <div className="titlebar">
              {menu.src} → {menu.target}
            </div>
            {BLOCK_TYPES[c.blocks.find((b) => b.name === menu.target)?.type ?? '']?.params
              .filter((d) => d.conn)
              .map((d) => (
                <button
                  key={d.name}
                  className="block w-full text-left px-2 py-0.5 hover:bg-fox-panel2 font-mono"
                  onClick={() => {
                    setLink(c.name, menu.target, d.name, menu.src)
                    setMenu(undefined)
                  }}
                >
                  {d.name} <span className="text-gray-500 font-sans">{d.desc}</span>
                </button>
              ))}
          </div>
        )}
        {c.blocks.length === 0 && (
          <div className="absolute top-24 left-0 right-0 text-center text-gray-500 text-sm pointer-events-none">
            {L('Empty strategy: drag blocks here from the palette.', 'Пустая стратегия: перетащите сюда блоки из палитры.')}
          </div>
        )}
      </div>

      {/* properties */}
      <div className="lg:w-[320px] shrink-0 border-l border-fox-edge bg-fox-panel2 overflow-auto max-h-[50vh] lg:max-h-none">
        <div className="titlebar">
          {L('Properties', 'Свойства')}
          <span className="flex-1" />
          {sel && (
            <button className="btn !py-0 text-black normal-case" onClick={() => deleteBlock(c.name, sel.name)}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
        <div className="p-2">
          {selEdge ? (
            <div className="text-xs space-y-2">
              <div className="font-mono">
                {selEdge.b}.{selEdge.p} ← {c.blocks.find((b) => b.name === selEdge.b)?.links[selEdge.p]}
              </div>
              <div className="text-gray-600">{paramDef(c.blocks.find((b) => b.name === selEdge.b)?.type ?? '', selEdge.p)?.desc}</div>
              <button
                className="btn"
                onClick={() => {
                  setLink(c.name, selEdge.b, selEdge.p, '')
                  setSelEdge(undefined)
                }}
              >
                <Trash2 size={12} /> {L('Delete connection', 'Удалить связь')}
              </button>
            </div>
          ) : sel ? (
            <BlockSheet c={c} b={sel} compact />
          ) : (
            <CompoundSheet c={c} />
          )}
        </div>
      </div>
    </div>
  )
}
