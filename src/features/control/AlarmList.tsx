import { Check } from 'lucide-react'
import { useSim } from '../../store/sim'
import { fmt, priColor, simTime, useL } from './ui'

/** Current Alarms Display (CAD): active unacked → active acked → returned unacked. */
export function AlarmList({ compact = false }: { compact?: boolean }) {
  const L = useL()
  const station = useSim((s) => s.station)
  useSim((s) => s.version)
  const { ack, ackAll, select } = useSim.getState()
  const cad = station.alarms.cad()
  const rows = compact ? cad.slice(0, 6) : cad
  return (
    <div className="flex flex-col min-h-0">
      <div className="titlebar">
        Current Alarms ({cad.length})<span className="flex-1" />
        <button className="btn !py-0 text-black normal-case" onClick={ackAll} disabled={!cad.some((a) => !a.acked)}>
          <Check size={12} /> {L('Ack all', 'Квит. все')}
        </button>
        {compact && (
          <button className="btn !py-0 text-black normal-case" onClick={() => select({ kind: 'cad' })}>
            CAD
          </button>
        )}
      </div>
      <div className="overflow-auto bg-black font-mono text-[11px] min-h-[60px]">
        {rows.length === 0 && <div className="text-gray-500 px-2 py-2">{L('No current alarms', 'Нет текущих аварий')}</div>}
        <table className="w-full">
          <tbody>
            {rows.map((a) => (
              <tr
                key={a.id}
                className={`cursor-pointer hover:bg-gray-800 ${a.active && !a.acked ? 'animate-pulse' : ''}`}
                style={{ color: a.active ? priColor(a.pri) : '#9a9a9a' }}
                onClick={() => select({ kind: 'block', c: a.compound, b: a.block })}
              >
                <td className="px-1 whitespace-nowrap">{simTime(a.t)}</td>
                <td className="px-1">{a.pri}</td>
                <td className="px-1 whitespace-nowrap">{a.compound}:{a.block}</td>
                <td className="px-1">{a.type}</td>
                <td className="px-1">{a.text}</td>
                <td className="px-1 text-right whitespace-nowrap">{a.value !== undefined ? fmt(a.value) : ''} {a.eu ?? ''}</td>
                <td className="px-1">{a.acked ? '' : 'UNACK'}{!a.active ? ' RTN' : ''}</td>
                <td className="px-1">
                  {!a.acked && (
                    <button
                      className="text-white border border-gray-500 px-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        ack(a.ref)
                      }}
                    >
                      ACK
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Alarm & message history (journal). */
export function Journal() {
  const L = useL()
  const station = useSim((s) => s.station)
  useSim((s) => s.version)
  const h = station.alarms.history.slice(-300).reverse()
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="titlebar">{L('Alarm history & messages', 'История аварий и сообщения')}</div>
      <div className="overflow-auto bg-black font-mono text-[11px] flex-1">
        {h.map((e, i) => (
          <div key={i} className="px-2 whitespace-nowrap" style={{ color: e.type === 'MSG' ? '#7fd4ff' : e.type === 'ACK' ? '#8f8' : e.type === 'RTN' ? '#aaa' : priColor(e.pri) }}>
            {simTime(e.t)} {e.ref.padEnd(22)} {e.type.padEnd(6)} {e.pri || ' '} {e.text} {e.value !== undefined ? fmt(e.value) : ''}
          </div>
        ))}
      </div>
    </div>
  )
}
