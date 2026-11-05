import { Cable, MousePointer2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { analyzeNetwork } from '../../domain/hardware/network'
import { PRESETS } from '../../domain/hardware/presets'
import { validateTopology } from '../../domain/hardware/rules'
import { traceSignal } from '../../domain/hardware/trace'
import { useT } from '../../i18n/i18n'
import { useTopology } from '../../store/topology'
import { BottomPanel } from './BottomPanel'
import { Inspector } from './Inspector'
import { Palette } from './Palette'
import { TopologyCanvas } from './TopologyCanvas'

export function ArchitectureBuilder() {
  const { t, tb } = useT()
  const s = useTopology()
  const topo = useMemo(() => ({ nodes: s.nodes, links: s.links }), [s.nodes, s.links])
  const failed = useMemo(() => new Set(s.failed), [s.failed])
  const issues = useMemo(() => validateTopology(topo, failed), [topo, failed])
  const net = useMemo(() => analyzeNetwork(topo, failed), [topo, failed])
  const trace = useMemo(() => (s.traceFrom ? traceSignal(topo, s.traceFrom, failed) : null), [topo, s.traceFrom, failed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'Escape') s.setMode('select')
      if (e.key === 'Delete') s.removeSelected()
      if (e.key.toLowerCase() === 'w') s.setMode(s.mode === 'connect' ? 'select' : 'connect')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s])

  useEffect(() => {
    if (!s.toast) return
    const h = setTimeout(s.clearToast, 4500)
    return () => clearTimeout(h)
  }, [s.toast, s.clearToast])

  return (
    <div className="h-full grid grid-cols-[210px_1fr_290px] grid-rows-[auto_1fr_190px] gap-1 p-1 min-h-0">
      {/* toolbar */}
      <div className="col-span-3 panel flex items-center gap-2 px-2 py-1 flex-wrap">
        <span className="lbl">{t('preset')}:</span>
        <select
          className="field !w-auto"
          value={s.presetId}
          onChange={(e) => s.loadPreset(e.target.value)}
          data-testid="preset"
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {tb(p.name)}
            </option>
          ))}
        </select>
        <span className="mx-2 h-5 border-l border-fox-edge" />
        <button className={`btn ${s.mode === 'select' ? 'btn-on' : ''}`} onClick={() => s.setMode('select')}>
          <MousePointer2 size={12} /> {t('mode_select')}
        </button>
        <button className={`btn ${s.mode === 'connect' ? 'btn-on' : ''}`} onClick={() => s.setMode('connect')} data-testid="wire-mode">
          <Cable size={12} /> {t('mode_connect')} (W)
        </button>
        <span className="mx-2 h-5 border-l border-fox-edge" />
        <span className="lbl">{t('era')}:</span>
        {(['all', 'classic', 'modern'] as const).map((e) => (
          <button key={e} className={`btn ${s.eraFilter === e ? 'btn-on' : ''}`} onClick={() => s.setEra(e)}>
            {t(e === 'all' ? 'era_all' : e === 'classic' ? 'era_classic' : 'era_modern')}
          </button>
        ))}
        <span className="flex-1" />
        <span className="text-[11px] text-gray-700 max-w-[420px] truncate" title={tb(PRESETS.find((p) => p.id === s.presetId)?.desc)}>
          {tb(PRESETS.find((p) => p.id === s.presetId)?.desc)}
        </span>
      </div>

      <div className="min-h-0 row-span-2">
        <Palette />
      </div>
      <div className="panel min-h-0 relative">
        <TopologyCanvas issues={issues} traceIds={trace?.nodeIds ?? []} traceBroken={!!trace?.broken} />
        {s.mode === 'connect' && (
          <div className="absolute top-2 left-2 bg-fox-navy text-white text-xs px-2 py-1 rounded shadow">{t('connect_hint')}</div>
        )}
        {s.toast && (
          <div
            className={`absolute bottom-10 left-1/2 -translate-x-1/2 text-xs px-3 py-2 rounded shadow max-w-[560px] ${s.toast.ok ? 'bg-fox-ok text-white' : 'bg-fox-alarm text-white'}`}
            data-testid="toast"
          >
            {tb(s.toast.text)}
          </div>
        )}
      </div>
      <div className="min-h-0 row-span-2">
        <Inspector />
      </div>
      <div className="min-h-0">
        <BottomPanel issues={issues} trace={trace} net={net} />
      </div>
    </div>
  )
}
