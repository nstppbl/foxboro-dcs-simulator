import { Bell, BellOff, ExternalLink, LayoutGrid, Pause, Play, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { HelpButton } from '../../help/HelpUi'
import { useLang } from '../../i18n/i18n'
import { useNav } from '../../store/nav'
import { useSim } from '../../store/sim'
import { Faceplate } from '../control/Faceplate'
import { ScenarioPicker } from '../control/ScenarioPicker'
import { priColor, simTime, useL } from '../control/ui'
import { AlarmManager, type AmView } from './AlarmManager'
import { displaysFor } from './displays'
import { setHorn, unlockAudio } from './horn'
import { Mimic } from './mimic'

type Screen = { kind: 'graphic'; id: string } | { kind: 'group'; i: number } | { kind: 'alarms' }

const FP_TYPES = ['PID', 'PIDA', 'AIN', 'AOUT', 'MTR', 'DOUT', 'HLBL']

function loadHornPref() {
  try {
    return localStorage.getItem('fox.horn') !== 'off'
  } catch {
    return true
  }
}

/** FoxView-style operator environment: process graphics, group displays, Alarm Manager. */
export function OperatorView() {
  const L = useL()
  const { lang } = useLang()
  const station = useSim((s) => s.station)
  const running = useSim((s) => s.running)
  useSim((s) => s.version)
  const go = useNav((s) => s.go)
  const displays = displaysFor(station)
  const [screen, setScreen] = useState<Screen>(() => (displays[0] ? { kind: 'graphic', id: displays[0].id } : { kind: 'group', i: 0 }))
  const [amView, setAmView] = useState<AmView>('CAD')
  const [popup, setPopup] = useState<{ c: string; b: string } | undefined>()
  const [hornOn, setHornOn] = useState(loadHornPref)
  const silencedUpTo = useRef(0)

  // when the scenario changes, show its first graphic
  const sig = station.db.compounds.join(',')
  useEffect(() => {
    const d = displaysFor(useSim.getState().station)
    setScreen(d[0] ? { kind: 'graphic', id: d[0].id } : { kind: 'group', i: 0 })
    setPopup(undefined)
  }, [sig])

  // groups: faceplate blocks of each compound, 8 per group
  const groups = useMemo(() => {
    const out: { title: string; refs: [string, string][] }[] = []
    for (const c of station.db.compounds) {
      const refs = station.db.cmp[c].blocks.filter((b) => FP_TYPES.includes(station.db.blk[`${c}:${b}`]?.type)).map((b) => [c, b] as [string, string])
      for (let i = 0; i < refs.length; i += 8) out.push({ title: `${c}${refs.length > 8 ? ` ${i / 8 + 1}` : ''}`, refs: refs.slice(i, i + 8) })
    }
    return out
  }, [station])

  // alarm horn: sounds for unacknowledged alarms newer than the last Silence
  const unacked = station.alarms.entries.filter((e) => !e.acked && !e.inhibited && e.active)
  const newest = unacked.filter((e) => e.id > silencedUpTo.current)
  const tone = !hornOn || !newest.length ? 0 : Math.min(...newest.map((e) => e.pri)) === 1 ? 1 : 2
  useEffect(() => {
    setHorn(tone)
  }, [tone])
  useEffect(() => () => setHorn(0), [])
  const silence = () => {
    silencedUpTo.current = Math.max(0, ...station.alarms.entries.map((e) => e.id))
    setHorn(0)
    useSim.setState({ version: useSim.getState().version + 1 })
  }
  const toggleHorn = () => {
    const v = !hornOn
    setHornOn(v)
    try {
      localStorage.setItem('fox.horn', v ? 'on' : 'off')
    } catch {
      /* ignore */
    }
  }

  const topPri = unacked.length ? Math.min(...unacked.map((e) => e.pri)) : 0
  const pick = (c: string, b: string) => setPopup({ c, b })
  const detail = (c: string, b: string) => {
    useSim.getState().select({ kind: 'block', c, b })
    go('control')
  }
  const popBlock = popup ? station.block(popup.c, popup.b) : undefined
  const disp = screen.kind === 'graphic' ? displays.find((d) => d.id === screen.id) : undefined
  const banner = station.alarms.cad().slice(0, 3)

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#3b434c]" onPointerDown={unlockAudio}>
      {/* FoxView top bar */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1 bg-[#20252b] text-white text-xs border-b border-black">
        <button
          onClick={() => setScreen({ kind: 'alarms' })}
          className={`px-3 py-1 font-bold border-2 ${unacked.length ? 'fox-blink' : ''}`}
          style={{ background: unacked.length ? priColor(topPri) : '#555', borderColor: '#000', color: topPri === 5 ? '#000' : '#fff' }}
          data-help="screen:cad"
          data-testid="process-alarm"
        >
          PROCESS ALARM {unacked.length ? `(${unacked.length})` : ''}
        </button>
        <span className="w-2" />
        {displays.map((d) => (
          <button
            key={d.id}
            onClick={() => setScreen({ kind: 'graphic', id: d.id })}
            className={`px-2 py-1 border ${screen.kind === 'graphic' && screen.id === d.id ? 'bg-gray-200 text-black border-white' : 'border-gray-500 hover:bg-gray-700'}`}
            data-help="screen:graphic"
            data-testid={`disp-${d.id}`}
          >
            {d.id}
          </button>
        ))}
        <button
          onClick={() => setScreen({ kind: 'group', i: 0 })}
          className={`flex items-center gap-1 px-2 py-1 border ${screen.kind === 'group' ? 'bg-gray-200 text-black border-white' : 'border-gray-500 hover:bg-gray-700'}`}
          data-help="screen:group"
          data-testid="disp-group"
        >
          <LayoutGrid size={12} /> GROUP
        </button>
        <button
          onClick={() => setScreen({ kind: 'alarms' })}
          className={`px-2 py-1 border ${screen.kind === 'alarms' ? 'bg-gray-200 text-black border-white' : 'border-gray-500 hover:bg-gray-700'}`}
          data-help="screen:cad"
          data-testid="disp-alarms"
        >
          ALARM MGR
        </button>
        <span className="flex-1" />
        <button onClick={silence} className="px-2 py-1 border border-gray-500 hover:bg-gray-700" data-testid="silence">
          {L('SILENCE', 'ТИШИНА')}
        </button>
        <button onClick={toggleHorn} className="px-2 py-1 border border-gray-500 hover:bg-gray-700" title={L('Alarm horn on/off', 'Звук аварий вкл/выкл')}>
          {hornOn ? <Bell size={13} /> : <BellOff size={13} />}
        </button>
        <button onClick={() => useSim.getState().setRunning(!running)} className="px-2 py-1 border border-gray-500 hover:bg-gray-700">
          {running ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <span className="font-mono px-1">{simTime(station.time)}</span>
        <div className="text-black">
          <ScenarioPicker />
        </div>
      </div>

      {/* display area */}
      <div className="flex-1 min-h-0 relative">
        <Mimic.Provider value={{ st: station, pick }}>
          {screen.kind === 'graphic' && disp && <disp.Svg />}
          {screen.kind === 'graphic' && !disp && <div className="p-6 text-white">{L('No graphic for this configuration: use GROUP.', 'Для этой конфигурации нет мнемосхемы: используйте GROUP.')}</div>}
        </Mimic.Provider>
        {screen.kind === 'group' && (
          <div className="h-full flex flex-col min-h-0">
            <div className="flex flex-wrap gap-1 p-1 bg-[#2b3036]">
              {groups.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setScreen({ kind: 'group', i })}
                  className={`px-2 py-0.5 text-xs border ${screen.i === i ? 'bg-gray-200 text-black border-white' : 'text-white border-gray-500 hover:bg-gray-700'}`}
                >
                  {g.title}
                </button>
              ))}
              <HelpButton topic="screen:group" light className="self-center ml-1" />
            </div>
            <div className="flex-1 overflow-auto p-2 flex flex-wrap gap-2 content-start">
              {(groups[screen.i]?.refs ?? []).map(([c, b]) => {
                const blk = station.block(c, b)
                return blk ? <Faceplate key={`${c}:${b}`} b={blk} /> : null
              })}
            </div>
          </div>
        )}
        {screen.kind === 'alarms' && <AlarmManager view={amView} setView={setAmView} onPick={pick} onDetail={detail} onSilence={silence} />}

        {/* faceplate overlay */}
        {popBlock && (
          <div className="absolute top-2 right-2 z-20 shadow-2xl border border-black" data-testid="fp-popup">
            <div className="flex items-center gap-1 bg-[#20252b] text-white text-[11px] px-1 py-0.5">
              <span className="flex-1 font-mono">
                {popBlock.compound}:{popBlock.name}
              </span>
              <button className="flex items-center gap-0.5 hover:underline" onClick={() => detail(popBlock.compound, popBlock.name)} title="Block Detail">
                <ExternalLink size={11} /> DETAIL
              </button>
              <button onClick={() => setPopup(undefined)} aria-label="close" data-testid="fp-close">
                <X size={14} />
              </button>
            </div>
            <Faceplate b={popBlock} />
          </div>
        )}
      </div>

      {/* alarm banner (3 most important) */}
      <div className="bg-black font-mono text-[11px] border-t border-gray-600 min-h-[54px]">
        {banner.length === 0 && <div className="text-gray-500 px-2 py-1">{lang === 'ru' ? 'Нет текущих аварий' : 'No current alarms'}</div>}
        {banner.map((a) => (
          <div
            key={a.id}
            className={`px-2 whitespace-nowrap cursor-pointer hover:bg-gray-900 ${a.active && !a.acked ? 'fox-blink' : ''}`}
            style={{ color: a.active ? priColor(a.pri) : '#9a9a9a' }}
            onClick={() => pick(a.compound, a.block)}
          >
            {simTime(a.t)} {a.pri} {a.ref.padEnd(22)} {a.type.padEnd(6)} {a.text} {a.acked ? '' : 'UNACK'}
          </div>
        ))}
      </div>
    </div>
  )
}
