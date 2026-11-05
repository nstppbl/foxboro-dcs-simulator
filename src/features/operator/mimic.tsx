import { createContext, useContext } from 'react'
import { bool, num } from '../../engine/blocks/common'
import type { ControlStation } from '../../engine/station'
import type { Block } from '../../engine/types'
import { fmt, priColor } from '../control/ui'

/** FoxView-style SVG mimic primitives. Values come live from the CP; clicking an object "picks" its block. */
export interface MimicCtx {
  st: ControlStation
  pick: (c: string, b: string) => void
}
export const Mimic = createContext<MimicCtx | null>(null)
const useM = () => useContext(Mimic)!

export const BG = '#5a6470'
const DIM = '#c8ccd0'
const LIQ = '#2f7fd8'
const ON = '#00c050'
const OFF = '#d02020'

function blk(st: ControlStation, c: string, b: string): Block | undefined {
  return st.block(c, b)
}

/** Live value box: tag name, value, units. Colour by block alarm state, cyan when BAD. */
export function Tag({ x, y, c, b, p, dec = 1, label, eu, w = 92 }: { x: number; y: number; c: string; b: string; p?: string; dec?: number; label?: string; eu?: string; w?: number }) {
  const { st, pick } = useM()
  const k = blk(st, c, b)
  const param = p ?? (k ? (k.type === 'AIN' ? 'PNT' : k.type === 'PID' || k.type === 'PIDA' ? 'MEAS' : k.type === 'AOUT' ? 'OUT' : 'OUT') : 'PNT')
  const v = k?.p[param]
  const crit = k ? num(k.p.CRIT) : 0
  const bad = k ? bool(k.p.BAD) : false
  const unit = eu ?? (k ? String(k.p.EO1 ?? k.p.EI1 ?? '') : '')
  const txt = !k ? '----' : typeof v === 'number' ? v.toFixed(dec) : fmt(v)
  const box = !k || bad ? '#00c8d8' : crit ? priColor(crit) : '#000'
  const fg = !k || bad ? '#000' : crit === 5 ? '#000' : crit ? '#fff' : '#7dff7d'
  const unack = k ? bool(k.p.UNACK) : false
  return (
    <g transform={`translate(${x},${y})`} className="cursor-pointer" onClick={() => k && pick(c, b)} data-help={k ? `block:${k.type}` : undefined} data-testid={`tag-${b}`}>
      <text x={0} y={-3} fontSize={11} fill="#fff" fontFamily="monospace">
        {label ?? b}
      </text>
      <rect x={0} y={0} width={w} height={18} fill={box} stroke="#000" className={unack ? 'fox-blink' : ''} />
      <text x={w - 4} y={13} fontSize={12} fill={fg} fontFamily="monospace" textAnchor="end">
        {txt} {unit.slice(0, 6)}
      </text>
    </g>
  )
}

/** Controller bubble with mode letters (A/M, L/R): picks the PID faceplate. */
export function Ctrl({ x, y, c, b }: { x: number; y: number; c: string; b: string }) {
  const { st, pick } = useM()
  const k = blk(st, c, b)
  const crit = k ? num(k.p.CRIT) : 0
  const mode = k ? `${bool(k.p.MA) ? 'A' : 'M'}${bool(k.p.LR) ? 'R' : 'L'}` : '--'
  return (
    <g transform={`translate(${x},${y})`} className="cursor-pointer" onClick={() => k && pick(c, b)} data-help={k ? `block:${k.type}` : undefined} data-testid={`ctrl-${b}`}>
      <circle r={22} fill="#e8e8e8" stroke={crit ? priColor(crit) : '#000'} strokeWidth={crit ? 4 : 1.5} className={k && bool(k.p.UNACK) ? 'fox-blink' : ''} />
      <line x1={-22} x2={22} y1={0} y2={0} stroke="#000" />
      <text y={-5} fontSize={10} textAnchor="middle" fontFamily="monospace">
        {b.replace(/\d+$/, '')}
      </text>
      <text y={12} fontSize={10} textAnchor="middle" fontFamily="monospace">
        {b.match(/\d+$/)?.[0] ?? ''}
      </text>
      <text x={26} y={-10} fontSize={11} fill="#fff" fontFamily="monospace">
        SP {k ? fmt(num(k.p.SPT), 1) : '--'}
      </text>
      <text x={26} y={4} fontSize={11} fill="#fff" fontFamily="monospace">
        OUT {k ? fmt(num(k.p.OUT), 1) : '--'}
      </text>
      <text x={26} y={18} fontSize={11} fill={k && bool(k.p.MA) ? '#7dff7d' : '#ffe14d'} fontFamily="monospace">
        {mode}
      </text>
    </g>
  )
}

/** Vertical vessel with liquid fill and optional setpoint marker (fractions 0..1). */
export function Vessel({
  x,
  y,
  w,
  h,
  fill,
  sp,
  label,
  round = false,
  jacket = false,
  labelDx = 0,
}: {
  x: number
  y: number
  w: number
  h: number
  fill: number
  sp?: number
  label: string
  round?: boolean
  jacket?: boolean
  labelDx?: number
}) {
  const f = Math.max(0, Math.min(1, fill))
  const r = round ? w / 2 : 6
  const id = `clip-${label.replace(/\W/g, '')}`
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <rect x={x} y={y} width={w} height={h} rx={r} />
        </clipPath>
      </defs>
      {jacket && <rect x={x - 10} y={y + h * 0.3} width={w + 20} height={h * 0.72} rx={r + 8} fill="none" stroke="#9aa" strokeWidth={6} />}
      <rect x={x} y={y} width={w} height={h} rx={r} fill="#22272d" />
      <rect x={x} y={y + h * (1 - f)} width={w} height={h * f} fill={LIQ} clipPath={`url(#${id})`} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={DIM} strokeWidth={2} />
      {sp !== undefined && <polygon points={`${x + w},${y + h * (1 - sp)} ${x + w + 10},${y + h * (1 - sp) - 6} ${x + w + 10},${y + h * (1 - sp) + 6}`} fill="#ffe14d" />}
      <text x={x + w / 2 + labelDx} y={y - 8} fontSize={13} fill="#fff" textAnchor="middle" fontWeight="bold">
        {label}
      </text>
    </g>
  )
}

/** Pump symbol. Green = running, red = stopped. */
export function Pump({ x, y, run, label, c, b, flip = false }: { x: number; y: number; run: boolean; label: string; c?: string; b?: string; flip?: boolean }) {
  const { st, pick } = useM()
  const k = c && b ? blk(st, c, b) : undefined
  return (
    <g
      transform={`translate(${x},${y})${flip ? ' scale(-1,1)' : ''}`}
      className={k ? 'cursor-pointer' : ''}
      onClick={() => k && pick(c!, b!)}
      data-help={k ? `block:${k.type}` : undefined}
      data-testid={b ? `pump-${b}` : undefined}
    >
      <circle r={16} fill={run ? ON : OFF} stroke="#000" strokeWidth={1.5} />
      <polygon points="-6,-10 12,0 -6,10" fill="#fff" />
      <text y={32} fontSize={11} fill="#fff" textAnchor="middle" transform={flip ? 'scale(-1,1)' : undefined}>
        {label}
      </text>
    </g>
  )
}

/** Valve bowtie. Analog: shows % open; discrete: green = open, white = closed. */
export function Valve({
  x,
  y,
  open,
  label,
  c,
  b,
  vertical = false,
  analog = false,
}: {
  x: number
  y: number
  open: number
  label: string
  c?: string
  b?: string
  vertical?: boolean
  analog?: boolean
}) {
  const { st, pick } = useM()
  const k = c && b ? blk(st, c, b) : undefined
  const isOpen = open > 1
  const crit = k ? num(k.p.CRIT) : 0
  return (
    <g
      transform={`translate(${x},${y})`}
      className={k ? 'cursor-pointer' : ''}
      onClick={() => k && pick(c!, b!)}
      data-help={k ? `block:${k.type}` : undefined}
      data-testid={b ? `valve-${b}` : undefined}
    >
      <g transform={vertical ? 'rotate(90)' : undefined}>
        <polygon points="-14,-9 14,9 14,-9 -14,9" fill={isOpen ? ON : '#f0f0f0'} stroke={crit ? priColor(crit) : '#000'} strokeWidth={crit ? 3 : 1.5} />
        {analog && <line x1={0} y1={0} x2={0} y2={-18} stroke="#000" strokeWidth={1.5} />}
        {analog && <path d="M -9 -18 A 9 9 0 0 1 9 -18 Z" fill="#ddd" stroke="#000" />}
      </g>
      <text x={vertical ? (analog ? 26 : 16) : 0} y={vertical ? 4 : 24} fontSize={11} fill="#fff" textAnchor={vertical ? 'start' : 'middle'}>
        {label}
        {analog ? ` ${Math.round(open)}%` : ''}
      </text>
    </g>
  )
}

export function Pipe({ d, flow = false, color }: { d: string; flow?: boolean; color?: string }) {
  return <path d={d} fill="none" stroke={color ?? (flow ? '#5fb4ff' : '#9aa3ab')} strokeWidth={5} strokeLinejoin="round" className={flow ? 'fox-flow' : ''} />
}

export function Label({
  x,
  y,
  children,
  size = 12,
  color = '#fff',
  anchor = 'start',
}: {
  x: number
  y: number
  children: React.ReactNode
  size?: number
  color?: string
  anchor?: 'start' | 'middle' | 'end'
}) {
  return (
    <text x={x} y={y} fontSize={size} fill={color} textAnchor={anchor}>
      {children}
    </text>
  )
}

/** Agitator symbol inside a vessel. */
export function Agitator({ x, y, h, run }: { x: number; y: number; h: number; run: boolean }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + h} stroke="#ddd" strokeWidth={3} />
      <g transform={`translate(${x},${y + h})`}>
        <g className={run ? 'fox-spin' : ''}>
          <ellipse cx={-14} cy={0} rx={13} ry={4} fill={run ? ON : '#888'} />
          <ellipse cx={14} cy={0} rx={13} ry={4} fill={run ? ON : '#888'} />
        </g>
      </g>
    </g>
  )
}

/** read helpers */
export const val = (st: ControlStation, c: string, b: string, p: string) => num(st.block(c, b)?.p[p] ?? 0)
export const on = (st: ControlStation, c: string, b: string, p: string) => bool(st.block(c, b)?.p[p] ?? false)
