import { bool, num } from '../../engine/blocks/common'
import { key } from '../../engine/types'
import { useSim } from '../../store/sim'
import { fmt, priColor, useL } from './ui'

const MAIN: Record<string, string> = { PID: 'MEAS', PIDA: 'MEAS', AIN: 'PNT', AOUT: 'OUT', CALC: 'RO01', LLAG: 'OUT', DTIME: 'OUT', MTR: 'MSTAT', HLBL: 'STATE', DIN: 'CIN', DOUT: 'COUT', RATIO: 'OUT', CHARC: 'OUT', SWCH: 'OUT' }

/** Compound detail: ON/OFF, CINHIB, block overview (Block View). */
export function CompoundDetail({ c }: { c: string }) {
  const L = useL()
  const station = useSim((s) => s.station)
  useSim((s) => s.version)
  const { setCompound, ackCompound, select } = useSim.getState()
  const cmp = station.compound(c)
  if (!cmp) return null
  const on = bool(cmp.p.ON)
  const cinhib = num(cmp.p.CINHIB)
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="titlebar" data-help="screen:compound">
        {station.db.letterbug} · COMPOUND {c}
        <span className="normal-case font-normal opacity-80">{String(cmp.p.DESCRP)}</span>
      </div>
      <div className="p-3 space-y-3 overflow-auto">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">ON</span>
          <button className={`btn ${on ? 'btn-on' : ''}`} onClick={() => setCompound(c, 'ON', true)}>
            Compound ON
          </button>
          <button className={`btn ${!on ? 'btn-on' : ''}`} onClick={() => setCompound(c, 'ON', false)}>
            Compound OFF
          </button>
          <span className="w-4" />
          <span className="font-mono text-xs">CINHIB</span>
          <select className="field !w-auto" value={cinhib} onChange={(e) => setCompound(c, 'CINHIB', +e.target.value)}>
            <option value={0}>0 · {L('none inhibited', 'ничего не подавлено')}</option>
            <option value={1}>1 · {L('all priorities', 'все приоритеты')}</option>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} · {L(`priorities ${n}–5`, `приоритеты ${n}–5`)}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => ackCompound(c)}>
            {L('Ack compound', 'Квитировать compound')}
          </button>
        </div>
        <p className="text-[11px] text-gray-700">
          {L(
            'A compound that is OFF stops executing all its blocks; their outputs go BAD for other compounds (cyan on displays). CINHIB suppresses alarm reporting of the chosen priorities for the whole compound.',
            'Compound в состоянии OFF не исполняет свои блоки; для других compounds их выходы становятся BAD (на дисплеях — голубой цвет). CINHIB подавляет оповещение об авариях выбранных приоритетов для всего compound.',
          )}
        </p>
        <table className="w-full text-[12px] font-mono bg-white border border-fox-edge">
          <thead className="bg-fox-panel2">
            <tr className="text-left">
              <th className="px-2">Block</th>
              <th className="px-2">Type</th>
              <th className="px-2">Status</th>
              <th className="px-2">Alarm</th>
              <th className="px-2">Value</th>
              <th className="px-2">PERIOD / PHASE</th>
              <th className="px-2">DESCRP</th>
            </tr>
          </thead>
          <tbody>
            {cmp.blocks.map((bn) => {
              const b = station.db.blk[key(c, bn)]
              const crit = num(b.p.CRIT)
              const main = MAIN[b.type]
              return (
                <tr key={bn} className="border-t border-fox-edge/30 hover:bg-fox-panel2 cursor-pointer" onClick={() => select({ kind: 'block', c, b: bn })}>
                  <td className="px-2 font-semibold">{bn}</td>
                  <td className="px-2">{b.type}</td>
                  <td className="px-2">{'MA' in b.p ? (bool(b.p.MA) ? 'Auto' : 'Man') : ''}</td>
                  <td className="px-2">{crit ? <span style={{ color: priColor(crit) }}>■ {crit}</span> : ''}</td>
                  <td className="px-2">{main ? `${main} ${fmt(b.p[main])}` : ''}</td>
                  <td className="px-2">
                    {fmt(b.p.PERIOD)} / {fmt(b.p.PHASE)}
                  </td>
                  <td className="px-2 truncate max-w-[220px]">{String(b.p.DESCRP)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
