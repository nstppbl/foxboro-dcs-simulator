import { useState } from 'react'
import { BLOCK_TYPES } from '../../engine/registry'
import type { Block, ParamDef } from '../../engine/types'
import { useSim } from '../../store/sim'
import { fmt, useL } from './ui'

function Cell({ b, d, config }: { b: Block; d: ParamDef; config: boolean }) {
  const set = useSim.getState().set
  const [edit, setEdit] = useState<string | undefined>(undefined)
  const v = b.p[d.name]
  const linked = !!b.links[d.name]
  const editable = !linked && (config || d.settable)
  if (!editable) return <span className={linked ? 'text-fox-navy' : 'text-gray-800'}>{fmt(v)}</span>
  if (d.type === 'B')
    return (
      <button className="btn !py-0" onClick={() => set(b.compound, b.name, d.name, !v, config)}>
        {fmt(v)}
      </button>
    )
  const commit = () => {
    if (edit !== undefined && edit !== String(v)) set(b.compound, b.name, d.name, edit, config)
    setEdit(undefined)
  }
  return (
    <input
      className="field !w-40"
      value={edit ?? (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(3) : String(v))}
      onFocus={() => setEdit(String(v))}
      onChange={(e) => setEdit(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setEdit(undefined)
      }}
    />
  )
}

function LinkCell({ b, d }: { b: Block; d: ParamDef }) {
  const link = useSim.getState().link
  const [edit, setEdit] = useState<string | undefined>(undefined)
  if (!d.conn) return null
  const cur = b.links[d.name] ?? ''
  return (
    <input
      className="field !w-48 text-fox-navy"
      placeholder="C:B.P"
      value={edit ?? cur}
      onFocus={() => setEdit(cur)}
      onChange={(e) => setEdit(e.target.value)}
      onBlur={() => {
        if (edit !== undefined && edit.trim().toUpperCase() !== cur) link(b.compound, b.name, d.name, edit.trim())
        setEdit(undefined)
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

/** Parameter list of a block (detail display pages). */
export function ParamTable({ b, groups, config = false, showLinks = false }: { b: Block; groups?: ParamDef['group'][]; config?: boolean; showLinks?: boolean }) {
  const L = useL()
  useSim((s) => s.version)
  const defs = BLOCK_TYPES[b.type].params.filter((d) => !groups || groups.includes(d.group ?? 'general'))
  return (
    <table className="w-full text-[12px]">
      <thead className="bg-fox-panel2 sticky top-0">
        <tr className="text-left">
          <th className="px-2 py-1">{L('Parameter', 'Параметр')}</th>
          <th className="px-2">{L('Value', 'Значение')}</th>
          {showLinks && <th className="px-2">{L('Connection', 'Связь')}</th>}
          <th className="px-2">{L('Description', 'Описание')}</th>
        </tr>
      </thead>
      <tbody>
        {defs.map((d) => (
          <tr key={d.name} className="border-b border-fox-edge/20 hover:bg-white/60">
            <td className="px-2 py-0.5 font-mono font-semibold whitespace-nowrap">
              {d.name}
              <span className="ml-1 text-[10px] text-gray-500">{d.type}</span>
            </td>
            <td className="px-2 font-mono">
              <Cell b={b} d={d} config={config} />
            </td>
            {showLinks && (
              <td className="px-2">
                <LinkCell b={b} d={d} />
              </td>
            )}
            <td className="px-2 text-gray-700">
              {d.desc}
              {d.src && <span className="text-gray-400"> · p. {d.src}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
