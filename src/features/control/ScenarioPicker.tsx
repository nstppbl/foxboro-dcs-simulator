import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { SCENARIOS } from '../../engine/scenarios'
import { useLang } from '../../i18n/i18n'
import { useEng } from '../../store/engineering'
import { useL } from './ui'

/** Choose the process scenario loaded into CP2701 (configuration + process model). */
export function ScenarioPicker() {
  const L = useL()
  const { lang } = useLang()
  const current = useEng((s) => s.scenario)
  const lab = useEng((s) => s.lab)
  const [pick, setPick] = useState(current)
  return (
    <span className="inline-flex items-center gap-1">
      <FlaskConical size={12} />
      <select className="field !w-auto max-w-[260px]" value={pick} onChange={(e) => setPick(e.target.value)}>
        {SCENARIOS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.pharma ? '⚕ ' : ''}
            {s.title[lang]}
          </option>
        ))}
      </select>
      <button
        className="btn"
        onClick={() => {
          if (confirm(L('Load this scenario into CP2701? The current configuration and CP state are replaced.', 'Загрузить этот сценарий в CP2701? Текущая конфигурация и состояние CP будут заменены.'))) useEng.getState().loadScenario(pick)
        }}
      >
        {pick === current && !lab ? L('Reload', 'Перезагрузить') : L('Load', 'Загрузить')}
      </button>
    </span>
  )
}
