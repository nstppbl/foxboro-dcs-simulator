import { Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect } from 'react'
import { useEng } from '../../store/engineering'
import { useSim } from '../../store/sim'
import { AlarmList, Journal } from './AlarmList'
import { BlockDetail } from './BlockDetail'
import { CompoundDetail } from './CompoundDetail'
import { FoxSelect } from './FoxSelect'
import { simTime, useL } from './ui'

const SPEEDS = [1, 2, 5, 10, 30]

export function ControlView() {
  const L = useL()
  const s = useSim()
  const sel = s.sel
  const block = sel.kind === 'block' ? s.station.block(sel.c, sel.b) : undefined
  const toast = s.toast
  useEffect(() => {
    if (!toast) return
    const h = setTimeout(() => useSim.setState({ toast: undefined }), 4000)
    return () => clearTimeout(h)
  }, [toast])

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-2 py-1 bg-fox-panel border-b border-fox-edge text-xs">
        <span className="font-mono font-semibold">CP {s.station.db.letterbug}</span>
        <button className={`btn ${s.running ? 'btn-on' : ''}`} onClick={() => s.setRunning(!s.running)}>
          {s.running ? <Pause size={12} /> : <Play size={12} />} {s.running ? L('Running', 'Работает') : L('Paused', 'Пауза')}
        </button>
        <span>{L('Speed', 'Скорость')}</span>
        {SPEEDS.map((v) => (
          <button key={v} className={`btn !px-1.5 ${s.speed === v ? 'btn-on' : ''}`} onClick={() => s.setSpeed(v)}>
            {v}×
          </button>
        ))}
        <span className="font-mono">t = {simTime(s.station.time)}</span>
        <span className="flex-1" />
        <button
          className="btn"
          onClick={() => {
            if (confirm(L('Reload the TANK2 lab database? All changes are lost.', 'Перезагрузить базу лабы TANK2? Все изменения будут потеряны.'))) useEng.getState().resetLab('full')
          }}
        >
          <RotateCcw size={12} /> {L('Reload TANK2 lab', 'Перезагрузить лабу TANK2')}
        </button>
      </div>
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <div className="md:w-56 shrink-0 h-56 md:h-auto border-r border-fox-edge">
          <FoxSelect />
        </div>
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 bg-fox-canvas">
            {block && <BlockDetail b={block} />}
            {sel.kind === 'compound' && <CompoundDetail c={sel.c} />}
            {sel.kind === 'cad' && <AlarmList />}
            {sel.kind === 'journal' && <Journal />}
          </div>
          {sel.kind !== 'cad' && (
            <div className="max-h-44 flex flex-col border-t border-fox-edge">
              <AlarmList compact />
            </div>
          )}
        </div>
      </div>
      {toast && (
        <div className={`fixed bottom-4 right-4 max-w-md px-3 py-2 text-xs shadow-lg border ${toast.err ? 'bg-red-50 border-red-500 text-red-800' : 'bg-white border-fox-edge'}`}>{toast.text}</div>
      )}
    </div>
  )
}
