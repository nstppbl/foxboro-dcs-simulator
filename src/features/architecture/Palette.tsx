import { useState } from 'react'
import { CATALOG, FAMILY_LABEL, FAMILY_ORDER } from '../../domain/hardware/catalog'
import { useT } from '../../i18n/i18n'
import { useTopology } from '../../store/topology'

export function Palette() {
  const { t, tb } = useT()
  const era = useTopology((s) => s.eraFilter)
  const addNode = useTopology((s) => s.addNode)
  const [q, setQ] = useState('')
  const items = CATALOG.filter((c) => era === 'all' || c.era === 'both' || c.era === era).filter(
    (c) => !q || (c.label + c.id).toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <div className="panel h-full flex flex-col min-h-0">
      <div className="titlebar">{t('palette')}</div>
      <div className="p-1 border-b border-fox-edge">
        <input className="field" placeholder="FBM204, FCP280…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="text-[10px] text-gray-600 mt-0.5">{t('palette_hint')}</div>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        {FAMILY_ORDER.map((fam) => {
          const list = items.filter((c) => c.family === fam)
          if (!list.length) return null
          return (
            <div key={fam}>
              <div className="px-2 py-0.5 bg-fox-edge/30 text-[10px] font-semibold uppercase tracking-wide">{tb(FAMILY_LABEL[fam])}</div>
              {list.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/fox-type', c.id)}
                  onDoubleClick={() => addNode(c.id, 200 + Math.random() * 200, 200 + Math.random() * 100)}
                  title={tb(c.desc)}
                  className="px-2 py-1 border-b border-fox-edge/30 hover:bg-white cursor-grab text-xs flex justify-between gap-2"
                  data-palette={c.id}
                >
                  <span className="font-mono font-semibold">{c.label}</span>
                  {c.era !== 'both' && (
                    <span className={`text-[9px] px-1 rounded ${c.era === 'modern' ? 'bg-fox-cyan/20 text-teal-900' : 'bg-fox-navy/15 text-fox-navy'}`}>
                      {c.era === 'modern' ? 'DCS' : 'I/A'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
