import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { blockState, compoundState } from '../../engine/config'
import { BLOCK_TYPES } from '../../engine/registry'
import { useEng } from '../../store/engineering'
import { useL } from '../control/ui'
import { BlockSheet, CompoundSheet, StateBadge } from './CfgSheet'

/** Legacy Integrated Control Configurator: compound list, block list in execution order, parameter sheet. */
export function IccEditor() {
  const L = useL()
  const { cfg, cp, selC, selB, selectCompound, selectBlock, addBlock, deleteBlock, moveOrder, rename } = useEng()
  const c = cfg.compounds.find((x) => x.name === selC)
  const [type, setType] = useState('AIN')
  const [name, setName] = useState('')
  const b = c && selB ? c.blocks.find((x) => x.name === selB) : undefined
  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 font-mono text-[12px] bg-[#c8ccd0]">
      <div className="lg:w-72 shrink-0 flex flex-col border-r-2 border-gray-500 min-h-0">
        <div className="bg-[#000080] text-white px-2 py-1 text-[11px]">ICC — {cfg.letterbug} · COMPOUNDS</div>
        <div className="bg-white overflow-auto max-h-40">
          {cfg.compounds.map((x) => (
            <div key={x.name} onClick={() => selectCompound(x.name)} className={`flex items-center gap-2 px-2 cursor-pointer ${x.name === selC ? 'bg-[#000080] text-white' : 'hover:bg-gray-200'}`}>
              <span className="flex-1">{x.name}</span>
              <StateBadge s={compoundState(x, cp)} />
            </div>
          ))}
        </div>
        {c && (
          <>
            <div className="bg-[#000080] text-white px-2 py-1 text-[11px] mt-1">
              {c.name} · BLOCKS ({L('execution order', 'порядок исполнения')})
            </div>
            <div className="bg-white overflow-auto flex-1 min-h-[120px]">
              <div className={`px-2 cursor-pointer ${!selB ? 'bg-[#000080] text-white' : 'hover:bg-gray-200'}`} onClick={() => selectBlock(undefined)}>
                {L('[compound parameters]', '[параметры compound]')}
              </div>
              {c.blocks.map((x, i) => (
                <div key={x.name} onClick={() => selectBlock(x.name)} className={`flex items-center gap-1 px-2 cursor-pointer ${x.name === selB ? 'bg-[#000080] text-white' : 'hover:bg-gray-200'}`}>
                  <span className="w-5 text-right opacity-60">{i + 1}</span>
                  <span className="flex-1">{x.name}</span>
                  <span className="w-12 opacity-70">{x.type}</span>
                  <StateBadge s={blockState(c, x, cp)} />
                  <button title="up" onClick={(e) => (e.stopPropagation(), moveOrder(c.name, x.name, -1))}>
                    <ArrowUp size={12} />
                  </button>
                  <button title="down" onClick={(e) => (e.stopPropagation(), moveOrder(c.name, x.name, 1))}>
                    <ArrowDown size={12} />
                  </button>
                  <button title="delete" onClick={(e) => (e.stopPropagation(), deleteBlock(c.name, x.name))}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-2 space-y-1 bg-[#c8ccd0]">
              <div className="text-[11px]">{L('Insert block', 'Вставить блок')}</div>
              <div className="flex gap-1">
                <select className="field !w-24" value={type} onChange={(e) => setType(e.target.value)}>
                  {Object.keys(BLOCK_TYPES).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input className="field" placeholder="NAME" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} />
                <button
                  className="btn"
                  onClick={() => {
                    addBlock(type)
                    const added = useEng.getState().selB
                    if (name && added && rename(c.name, added, name)) setName('')
                  }}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0 overflow-auto p-2 font-sans">
        <div className="bg-[#000080] text-white px-2 py-1 text-[11px] font-mono mb-2">
          {c ? (b ? `${c.name}:${b.name} — ${b.type} PARAMETERS` : `${c.name} — COMPOUND PARAMETERS`) : ''}
        </div>
        {c && (b ? <BlockSheet c={c} b={b} /> : <CompoundSheet c={c} />)}
      </div>
    </div>
  )
}
