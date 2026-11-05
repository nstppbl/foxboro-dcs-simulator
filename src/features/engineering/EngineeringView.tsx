import { CheckSquare, Download, FlaskConical, Plus, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useEffect } from 'react'
import { compoundState } from '../../engine/config'
import { useEng } from '../../store/engineering'
import { useSim } from '../../store/sim'
import { useL } from '../control/ui'
import { EngBottomPanel } from './BottomPanel'
import { StateBadge } from './CfgSheet'
import { IccEditor } from './IccEditor'
import { Lab1Panel } from './Lab1Panel'
import { StrategyEditor } from './StrategyEditor'

export function EngineeringView() {
  const L = useL()
  const e = useEng()
  const toast = useSim((s) => s.toast)
  useEffect(() => {
    if (!toast) return
    const h = setTimeout(() => useSim.setState({ toast: undefined }), 4000)
    return () => clearTimeout(h)
  }, [toast])
  const modified = e.cfg.compounds.some((c) => compoundState(c, e.cp) !== 'Downloaded') || e.cp.compounds.some((c) => !e.cfg.compounds.find((x) => x.name === c.name))

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-2 py-1 bg-fox-panel border-b border-fox-edge text-xs">
        <div className="flex border border-fox-edge">
          <button className={`px-2 py-1 ${e.editor === 'csd' ? 'bg-fox-navy text-white' : 'bg-fox-panel2'}`} onClick={() => e.setEditor('csd')}>
            Strategy Editor (Control Editors)
          </button>
          <button className={`px-2 py-1 ${e.editor === 'icc' ? 'bg-fox-navy text-white' : 'bg-fox-panel2'}`} onClick={() => e.setEditor('icc')}>
            ICC ({L('classic', 'классический')})
          </button>
        </div>
        <button className="btn" onClick={() => e.validate()}>
          <CheckSquare size={12} /> Validate
        </button>
        <button className="btn btn-on" onClick={() => e.download()}>
          <Download size={12} /> Download → {e.cfg.letterbug}
        </button>
        <button className="btn" onClick={() => e.upload()} title={L('Copy the current CP values (for example, tuning changed from displays) into the configuration', 'Скопировать текущие значения CP (например, настройку, изменённую с дисплеев) в конфигурацию')}>
          <Upload size={12} /> Upload
        </button>
        {modified && <span className="text-amber-700 font-semibold">{L('Configuration differs from the CP: download required', 'Конфигурация отличается от CP: нужен Download')}</span>}
        <span className="flex-1" />
        <button
          className="btn"
          onClick={() => confirm(L('Start LAB 1? The configuration and the CP are reloaded with an empty TANK2_COMP.', 'Начать LAB 1? Конфигурация и CP будут перезагружены с пустым TANK2_COMP.')) && e.resetLab('lab1')}
        >
          <FlaskConical size={12} /> LAB 1: {L('build TANK2_COMP', 'собрать TANK2_COMP')}
        </button>
        <button className="btn" onClick={() => confirm(L('Reload the complete TANK2 lab database? Your changes are lost.', 'Загрузить полную базу лабы TANK2? Ваши изменения будут потеряны.')) && e.resetLab('full')}>
          <RotateCcw size={12} /> {L('Reload TANK2 lab', 'Перезагрузить лабу TANK2')}
        </button>
      </div>

      {/* compound tabs */}
      <div className="flex flex-wrap items-center gap-0 bg-fox-panel2 border-b border-fox-edge text-xs">
        <span className="px-2 font-mono text-gray-600">{e.cfg.letterbug}:</span>
        {e.cfg.compounds.map((c) => (
          <button key={c.name} onClick={() => e.selectCompound(c.name)} className={`px-3 py-1 font-mono border-r border-fox-edge flex items-center gap-1 ${c.name === e.selC ? 'bg-white font-bold' : 'hover:bg-white/60'}`}>
            {c.name}
            <StateBadge s={compoundState(c, e.cp)} />
          </button>
        ))}
        <button
          className="px-2 py-1 hover:bg-white/60 flex items-center gap-1"
          onClick={() => {
            const n = prompt(L('New compound name (≤12 characters):', 'Имя нового compound (≤12 символов):'))
            if (n) e.addCompound(n)
          }}
        >
          <Plus size={12} /> compound
        </button>
        {e.selC && (
          <button className="px-2 py-1 hover:bg-white/60 flex items-center gap-1 text-gray-600" onClick={() => confirm(`Delete ${e.selC}?`) && e.deleteCompound(e.selC)}>
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">{e.editor === 'csd' ? <StrategyEditor /> : <IccEditor />}</div>
          <div className="h-40 shrink-0 border-t border-fox-edge">
            <EngBottomPanel />
          </div>
        </div>
        {e.lab === 'lab1' && (
          <div className="hidden md:block w-72 shrink-0 border-l border-fox-edge bg-fox-panel2 overflow-auto">
            <Lab1Panel />
          </div>
        )}
      </div>
      {toast && (
        <div className={`fixed bottom-4 right-4 max-w-md px-3 py-2 text-xs shadow-lg border z-50 ${toast.err ? 'bg-red-50 border-red-500 text-red-800' : 'bg-white border-fox-edge'}`}>{toast.text}</div>
      )}
    </div>
  )
}
