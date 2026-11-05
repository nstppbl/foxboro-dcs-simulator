import type { TrendBuf } from '../../store/sim'

const PEN_COLORS = ['#ffffff', '#ffd400', '#00e05a', '#00c8ff']

/** Black-background FoxView-style trend, 15 min window, up to 4 pens. */
export function TrendChart({ buf, pens, lo, hi, height = 220 }: { buf?: TrendBuf; pens: { name: string; scale?: [number, number] }[]; lo: number; hi: number; height?: number }) {
  const W = 600
  const H = height
  const n = buf?.t.length ?? 0
  const path = (arr: number[], scale?: [number, number]) => {
    const [l, h] = scale ?? [lo, hi]
    const sp = h - l || 1
    return arr
      .map((v, i) => {
        const x = (i / Math.max(1, 899)) * W + (900 - arr.length) * (W / 899)
        const y = H - ((v - l) / sp) * H
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${Math.max(-2, Math.min(H + 2, y)).toFixed(1)}`
      })
      .join('')
  }
  return (
    <div className="bg-black border border-fox-edge">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ height }} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#333" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        ))}
        {[1, 2, 3, 4].map((i) => (
          <line key={i} y1={0} y2={H} x1={(W / 5) * i} x2={(W / 5) * i} stroke="#333" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        ))}
        {pens.map((p, i) => {
          const arr = buf?.v[p.name]
          return arr && arr.length ? <path key={p.name} d={path(arr, p.scale)} fill="none" stroke={PEN_COLORS[i]} strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> : null
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-3 px-2 py-1 text-[11px] font-mono text-gray-300">
        {pens.map((p, i) => (
          <span key={p.name} style={{ color: PEN_COLORS[i] }}>
            ■ {p.name}
            {p.scale ? ` (${p.scale[0]}–${p.scale[1]})` : ''}
          </span>
        ))}
        <span className="flex-1" />
        <span>
          {lo} – {hi} · {Math.round(n / 60)} / 15 min
        </span>
      </div>
    </div>
  )
}
