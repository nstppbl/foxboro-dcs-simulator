import { useState } from 'react'
import type { AlarmEntry } from '../../engine/alarms'
import { useSim } from '../../store/sim'
import { HelpButton } from '../../help/HelpUi'
import { fmt, priColor, simTime, useL } from '../control/ui'

export type AmView = 'CAD' | 'MRA' | 'UNACK' | 'HISTORY'

const TYPES = ['HIABS', 'LOABS', 'HHABS', 'LLABS', 'HIDEV', 'LODEV', 'HIOUT', 'LOOUT', 'BAD', 'OOR', 'STATE']

/** Compound:block filter. "*" and "?" are wildcards; without them it is a substring match. */
export function refMatch(pattern: string, ref: string) {
  const p = pattern.trim().toUpperCase()
  if (!p) return true
  if (!/[*?]/.test(p)) return ref.toUpperCase().includes(p)
  const re = new RegExp(
    '^' +
      p
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
  )
  return re.test(ref.toUpperCase()) || re.test(ref.split(':')[1]?.toUpperCase() ?? '')
}

/** FoxView Alarm Manager: CAD / Most Recent / Unacknowledged / History with filters and softkeys. */
export function AlarmManager({
  view,
  setView,
  onPick,
  onDetail,
  onSilence,
}: {
  view: AmView
  setView: (v: AmView) => void
  onPick: (c: string, b: string) => void
  onDetail: (c: string, b: string) => void
  onSilence: () => void
}) {
  const L = useL()
  const station = useSim((s) => s.station)
  useSim((s) => s.version)
  const { ack } = useSim.getState()
  const [filt, setFilt] = useState('')
  const [maxPri, setMaxPri] = useState(5)
  const [type, setType] = useState('')
  const [sel, setSel] = useState<number | undefined>()

  const keep = (ref: string, pri: number, t: string) => refMatch(filt, ref) && (pri === 0 || pri <= maxPri) && (!type || t === type)
  const all = station.alarms.entries.filter((e) => !e.inhibited)
  let rows: AlarmEntry[] = []
  if (view === 'CAD') rows = station.alarms.cad()
  if (view === 'MRA') rows = all.slice().sort((a, b) => b.t - a.t)
  if (view === 'UNACK') rows = all.filter((e) => !e.acked).sort((a, b) => a.pri - b.pri || b.t - a.t)
  rows = rows.filter((e) => keep(e.ref, e.pri, e.type))
  const hist =
    view === 'HISTORY'
      ? station.alarms.history
          .filter((h) => keep(h.ref, h.pri, h.type))
          .slice(-500)
          .reverse()
      : []
  const selected = rows.find((r) => r.id === sel)

  const ackPage = () => new Set(rows.filter((r) => !r.acked).map((r) => r.ref)).forEach((r) => ack(r))
  const clearRtn = () => new Set(rows.filter((r) => !r.active && !r.acked).map((r) => r.ref)).forEach((r) => ack(r))
  const top = () => {
    const t = station.alarms.cad().find((e) => e.active && !e.acked) ?? station.alarms.cad()[0]
    if (t) {
      setSel(t.id)
      onPick(t.compound, t.block)
    }
  }

  return (
    <div className="h-full flex flex-col bg-black text-white font-mono text-[12px]" data-help="screen:cad">
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#2b3036] border-b border-gray-600">
        {(['CAD', 'MRA', 'UNACK', 'HISTORY'] as AmView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-2 py-0.5 border ${view === v ? 'bg-gray-200 text-black border-white' : 'border-gray-500 hover:bg-gray-700'}`}
            data-testid={`am-${v}`}
          >
            {v === 'CAD' ? 'Current Alarms' : v === 'MRA' ? 'Most Recent' : v === 'UNACK' ? 'Unacknowledged' : 'History'}
          </button>
        ))}
        <HelpButton topic="screen:cad" light className="ml-1" />
        <span className="flex-1" />
        <span className="text-gray-400">{L('Filter', 'Фильтр')}</span>
        <input className="bg-black border border-gray-500 px-1 w-36 text-white" placeholder="REACTOR:* / *:TIC*" value={filt} onChange={(e) => setFilt(e.target.value)} data-testid="am-filter" />
        <select className="bg-black border border-gray-500" value={maxPri} onChange={(e) => setMaxPri(Number(e.target.value))} data-testid="am-pri">
          {[5, 4, 3, 2, 1].map((p) => (
            <option key={p} value={p}>
              {p === 5 ? L('All priorities', 'Все приоритеты') : `PRI 1…${p}`}
            </option>
          ))}
        </select>
        <select className="bg-black border border-gray-500" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{L('All types', 'Все типы')}</option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-auto">
        {view !== 'HISTORY' ? (
          <table className="w-full">
            <thead className="sticky top-0 bg-[#2b3036] text-gray-300 text-left">
              <tr>
                <th className="px-1">{L('Time', 'Время')}</th>
                <th className="px-1">PRI</th>
                <th className="px-1">COMPOUND:BLOCK</th>
                <th className="px-1">{L('Name', 'Имя')}</th>
                <th className="px-1">TYPE</th>
                <th className="px-1">{L('Text', 'Текст')}</th>
                <th className="px-1 text-right">{L('Value', 'Знач.')}</th>
                <th className="px-1">{L('State', 'Сост.')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-3 text-gray-500">
                    {L('No alarms', 'Нет аварий')}
                  </td>
                </tr>
              )}
              {rows.map((a) => (
                <tr
                  key={a.id}
                  className={`cursor-pointer ${sel === a.id ? 'bg-gray-700' : 'hover:bg-gray-900'} ${a.active && !a.acked ? 'fox-blink' : ''}`}
                  style={{ color: a.active ? priColor(a.pri) : '#9a9a9a' }}
                  onClick={() => setSel(a.id)}
                  onDoubleClick={() => onPick(a.compound, a.block)}
                  data-testid="am-row"
                >
                  <td className="px-1 whitespace-nowrap">{simTime(a.t)}</td>
                  <td className="px-1">{a.pri}</td>
                  <td className="px-1 whitespace-nowrap">{a.ref}</td>
                  <td className="px-1 whitespace-nowrap">{a.name}</td>
                  <td className="px-1">{a.type}</td>
                  <td className="px-1">{a.text}</td>
                  <td className="px-1 text-right whitespace-nowrap">
                    {a.value !== undefined ? fmt(a.value) : ''} {a.eu ?? ''}
                  </td>
                  <td className="px-1 whitespace-nowrap">
                    {a.active ? 'ACTIVE' : 'RTN'}
                    {a.acked ? '' : ' UNACK'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div>
            {hist.map((e, i) => (
              <div key={i} className="px-2 whitespace-nowrap" style={{ color: e.type === 'MSG' ? '#7fd4ff' : e.type === 'ACK' ? '#8f8' : e.type === 'RTN' ? '#aaa' : priColor(e.pri) }}>
                {simTime(e.t)} {e.ref.padEnd(22)} {e.type.padEnd(6)} {e.pri || ' '} {e.text} {e.value !== undefined ? fmt(e.value) : ''}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* softkeys */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 p-1 bg-[#2b3036] border-t border-gray-600">
        <Soft onClick={() => selected && ack(selected.ref)} disabled={!selected || selected.acked} t="am-ack">
          {L('ACK ALARM', 'КВИТ. АВАРИЮ')}
        </Soft>
        <Soft onClick={ackPage} disabled={!rows.some((r) => !r.acked)} t="am-ackpage">
          {L('ACK PAGE', 'КВИТ. СТРАНИЦУ')}
        </Soft>
        <Soft onClick={clearRtn} disabled={!rows.some((r) => !r.active && !r.acked)} t="am-clear">
          {L('CLEAR RTN', 'УБРАТЬ RTN')}
        </Soft>
        <Soft onClick={top} t="am-top">
          {L('TOP PRIORITY', 'ВЫСШИЙ ПРИОРИТЕТ')}
        </Soft>
        <Soft onClick={() => selected && onDetail(selected.compound, selected.block)} disabled={!selected} t="am-detail">
          BLOCK DETAIL
        </Soft>
        <Soft onClick={onSilence} t="am-silence">
          {L('SILENCE HORN', 'ВЫКЛ. ЗВУК')}
        </Soft>
      </div>
    </div>
  )
}

function Soft({ children, onClick, disabled, t }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; t?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} data-testid={t} className="border border-gray-400 bg-[#d8d8d8] text-black py-1 text-[11px] disabled:opacity-40 hover:bg-white">
      {children}
    </button>
  )
}
