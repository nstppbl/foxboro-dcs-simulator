import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { bool, num } from '../../engine/blocks/common'
import { key } from '../../engine/types'
import { useSim } from '../../store/sim'
import { priColor, useL } from './ui'

/** FoxSelect-style tree: station → compounds → blocks, with ON state and alarm criticality. */
export function FoxSelect() {
  const L = useL()
  const station = useSim((s) => s.station)
  const sel = useSim((s) => s.sel)
  useSim((s) => s.version)
  const select = useSim.getState().select
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const db = station.db
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="titlebar">FoxSelect</div>
      <div className="overflow-auto flex-1 bg-white font-mono text-[12px] py-1">
        <div
          onClick={() => select({ kind: 'process' })}
          className={`px-2 mb-1 cursor-pointer border-b border-fox-edge/40 ${sel.kind === 'process' ? 'bg-fox-navy text-white' : 'hover:bg-fox-panel2 text-fox-ok font-semibold'}`}
        >
          ▣ {L('PROCESS (plant model)', 'ПРОЦЕСС (модель установки)')}
        </div>
        <div className="px-2 font-semibold text-fox-navy">{db.letterbug}</div>
        {db.compounds.map((cn) => {
          const cmp = db.cmp[cn]
          const on = bool(cmp.p.ON)
          const crit = Math.min(...cmp.blocks.map((b) => num(db.blk[key(cn, b)]?.p.CRIT) || 9))
          const isSel = sel.kind === 'compound' && sel.c === cn
          return (
            <div key={cn}>
              <div className={`flex items-center gap-1 pl-2 pr-1 cursor-pointer ${isSel ? 'bg-fox-navy text-white' : 'hover:bg-fox-panel2'}`}>
                <button onClick={() => setClosed({ ...closed, [cn]: !closed[cn] })} aria-label="toggle">
                  {closed[cn] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>
                <span className="flex-1 truncate" onClick={() => select({ kind: 'compound', c: cn })} style={{ color: !on && !isSel ? '#00a3b4' : undefined }}>
                  {cn}
                </span>
                {!on && <span className="text-[10px]">OFF</span>}
                {crit < 9 && <span className="w-2.5 h-2.5 inline-block" style={{ background: priColor(crit) }} title={`CRIT ${crit}`} />}
              </div>
              {!closed[cn] &&
                cmp.blocks.map((bn) => {
                  const b = db.blk[key(cn, bn)]
                  const bs = sel.kind === 'block' && sel.c === cn && sel.b === bn
                  const c = num(b?.p.CRIT)
                  return (
                    <div
                      key={bn}
                      onClick={() => select({ kind: 'block', c: cn, b: bn })}
                      data-help={b ? `block:${b.type}` : undefined}
                      className={`flex items-center gap-2 pl-7 pr-1 cursor-pointer ${bs ? 'bg-fox-navy text-white' : 'hover:bg-fox-panel2'}`}
                    >
                      <span className="flex-1 truncate">{bn}</span>
                      <span className="text-[10px] opacity-70">{b?.type}</span>
                      {'MA' in (b?.p ?? {}) && <span className="text-[10px] w-3">{bool(b.p.MA) ? 'A' : 'M'}</span>}
                      <span className={`w-2.5 h-2.5 inline-block ${bool(b?.p.UNACK) ? 'animate-pulse' : ''}`} style={{ background: c ? priColor(c) : 'transparent' }} />
                    </div>
                  )
                })}
            </div>
          )
        })}
        <div className="border-t border-fox-edge/40 mt-2 pt-1">
          <div onClick={() => select({ kind: 'cad' })} className={`px-2 cursor-pointer ${sel.kind === 'cad' ? 'bg-fox-navy text-white' : 'hover:bg-fox-panel2'}`}>
            Current Alarms (CAD)
          </div>
          <div onClick={() => select({ kind: 'journal' })} className={`px-2 cursor-pointer ${sel.kind === 'journal' ? 'bg-fox-navy text-white' : 'hover:bg-fox-panel2'}`}>
            {L('Alarm history', 'История аварий')}
          </div>
        </div>
      </div>
    </div>
  )
}
