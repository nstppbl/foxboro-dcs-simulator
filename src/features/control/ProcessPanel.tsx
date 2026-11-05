import { scenario } from '../../engine/scenarios'
import { useLang } from '../../i18n/i18n'
import { useEng } from '../../store/engineering'
import { useSim } from '../../store/sim'
import { fmt, useL } from './ui'

/** The process behind the FBMs: model state, disturbances and field instrument list. */
export function ProcessPanel() {
  const L = useL()
  const { lang } = useLang()
  const plant = useSim((s) => s.plant)
  useSim((s) => s.version)
  const sid = useEng((s) => s.scenario)
  const sc = scenario(sid)
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="titlebar">
        PROCESS · {sc.title[lang]}
      </div>
      <div className="p-3 overflow-auto space-y-3 text-[12px]">
        <p className="text-gray-800">{sc.desc[lang]}</p>
        {!plant ? (
          <p className="text-gray-700">
            {L('This lab simulates the process inside the CP with the PROCESS_2 compound (DEAD_TM, FLOW_CALC, LAG_TM), exactly as the course does. Open those blocks in FoxSelect.', 'Эта лаба моделирует процесс внутри CP с помощью compound PROCESS_2 (DEAD_TM, FLOW_CALC, LAG_TM), как в курсе. Откройте эти блоки в FoxSelect.')}
          </p>
        ) : (
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="space-y-3 xl:w-1/2">
              <div>
                <div className="font-semibold mb-1">{L('Process state (true values)', 'Состояние процесса (истинные значения)')}</div>
                <table className="w-full bg-white border border-fox-edge">
                  <tbody>
                    {plant.vars().map((v, i) => (
                      <tr key={i} className="border-b border-fox-edge/20">
                        <td className="px-2 py-0.5">{v.label[lang]}</td>
                        <td className="px-2 font-mono text-right">{typeof v.value === 'number' ? v.value.toFixed(2) : v.value}</td>
                        <td className="px-2 text-gray-600">{v.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="font-semibold mb-1">{L('Disturbances (instructor)', 'Возмущения (инструктор)')}</div>
                {plant.distDefs.map((d) => (
                  <label key={d.key} className="flex items-center gap-2 py-0.5">
                    <span className="w-56 shrink-0">{d.label[lang]}</span>
                    <input
                      type="range"
                      min={d.min}
                      max={d.max}
                      step={d.step}
                      value={plant.dist[d.key]}
                      onChange={(e) => {
                        plant.dist[d.key] = +e.target.value
                        useSim.getState().refresh()
                      }}
                      className="flex-1"
                    />
                    <span className="font-mono w-20 text-right">
                      {fmt(plant.dist[d.key])} {d.unit}
                    </span>
                  </label>
                ))}
                {plant.actions().length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {plant.actions().map((a) => (
                      <button
                        key={a.key}
                        className="btn"
                        onClick={() => {
                          plant.act(a.key)
                          useSim.getState().refresh()
                        }}
                      >
                        {a.label[lang]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="xl:w-1/2">
              <div className="font-semibold mb-1">{L('Field instruments and FBM points', 'Полевые приборы и точки FBM')}</div>
              <table className="w-full bg-white border border-fox-edge font-mono text-[11px]">
                <thead className="bg-fox-panel2 text-left">
                  <tr>
                    <th className="px-2">Tag</th>
                    <th className="px-2">IOM_ID : PNT_NO</th>
                    <th className="px-2">I/O</th>
                    <th className="px-2 text-right">{L('Value', 'Значение')}</th>
                    <th className="px-2 font-sans">{L('Description', 'Описание')}</th>
                  </tr>
                </thead>
                <tbody>
                  {plant.instruments.map((i) => (
                    <tr key={i.tag} className="border-t border-fox-edge/20">
                      <td className="px-2 font-semibold">{i.tag}</td>
                      <td className="px-2">
                        {i.fbm}:{i.pnt}
                      </td>
                      <td className="px-2 uppercase">{i.kind}</td>
                      <td className="px-2 text-right">
                        {i.kind === 'di' || i.kind === 'do' ? (plant.value(i.tag) ? 'ON' : 'OFF') : `${plant.value(i.tag).toFixed(2)} ${i.eu ?? ''}`}
                      </td>
                      <td className="px-2 font-sans">{i.desc[lang]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-600 mt-1">
                {L('AIN/AOUT/DIN/DOUT blocks with IOMOPT = 1 read and write these points through IOM_ID and PNT_NO.', 'Блоки AIN/AOUT/DIN/DOUT с IOMOPT = 1 читают и пишут эти точки через IOM_ID и PNT_NO.')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
