import { bool, num } from '../../engine/blocks/common'
import type { Block } from '../../engine/types'
import { key } from '../../engine/types'
import { useSim } from '../../store/sim'
import { fmt, priColor, useL } from './ui'

function Bar({ value, lo, hi, color, marker, label }: { value: number; lo: number; hi: number; color: string; marker?: number; label: string }) {
  const f = (v: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)))
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-8 h-48 bg-[#111] border border-gray-600">
        <div className="absolute bottom-0 left-0 right-0" style={{ height: `${f(value) * 100}%`, background: color }} />
        {marker !== undefined && (
          <div className="absolute -left-2 w-0 h-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-yellow-300" style={{ bottom: `calc(${f(marker) * 100}% - 6px)` }} />
        )}
      </div>
      <div className="text-[10px] text-gray-300">{label}</div>
    </div>
  )
}

const status = (b: Block) => {
  const out: string[] = []
  if (bool(b.p.TRACK)) out.push('T')
  if (bool(b.p.HOLDST)) out.push('H')
  if (b.links.MA || b.links.MANSW || b.links.AUTSW) out.push('W')
  return out.join(' ')
}

/** FoxView-like faceplate for the selected block. */
export function Faceplate({ b }: { b: Block }) {
  const L = useL()
  const { set, ack } = useSim.getState()
  const ref = key(b.compound, b.name)
  const crit = num(b.p.CRIT)
  const isPid = b.type === 'PID' || b.type === 'PIDA'
  const hasMA = 'MA' in b.p
  const auto = bool(b.p.MA)
  const remote = bool(b.p.LR)
  const lo = num(b.p.LSCI1 ?? b.p.LSCO1 ?? 0)
  const hi = num(b.p.HSCI1 ?? b.p.HSCO1 ?? 100)
  const eu = String(b.p.EI1 ?? b.p.EO1 ?? '')
  // ramp target: SPT in Auto/Local, OUT in Manual
  const target = isPid ? (auto ? 'SPT' : 'OUT') : b.type === 'AOUT' || b.type === 'AIN' ? (b.type === 'AIN' ? 'PNT' : 'OUT') : undefined
  const span = target === 'SPT' ? hi - lo : num(b.p.HSCO1 ?? 100) - num(b.p.LSCO1 ?? 0)
  const ramp = (pct: number) => target && set(b.compound, b.name, target, num(b.p[target]) + (pct / 100) * span)
  const meas = isPid ? num(b.p.MEAS) : b.type === 'AIN' ? num(b.p.PNT) : num(b.p.OUT ?? b.p.MEAS)
  const outLo = num(b.p.LSCO1 ?? 0)
  const outHi = num(b.p.HSCO1 ?? 100)
  const out = num(b.p.OUT)
  const cyan = !bool(useSim.getState().station.compound(b.compound)?.p.ON)

  return (
    <div className="bg-black text-white font-mono text-[12px] w-[230px] shrink-0 border-2 border-gray-500 select-none">
      <div className="px-2 py-1 border-b border-gray-700" style={{ background: crit ? priColor(crit) : '#1d3b6e', color: crit === 5 ? '#000' : '#fff' }}>
        <div className="font-bold">{b.name}</div>
        <div className="text-[10px] truncate">{String(b.p.DESCRP || b.type)}</div>
      </div>
      {cyan && <div className="text-center text-black bg-[#00c8d8] text-[11px]">COMPOUND OFF</div>}
      <div className="flex justify-center gap-4 py-3">
        {isPid && (
          <>
            <Bar value={meas} lo={lo} hi={hi} color={crit ? priColor(crit) : '#e8e8e8'} marker={num(b.p.SPT)} label="MEAS" />
            <Bar value={out} lo={outLo} hi={outHi} color="#00b050" label="OUT" />
          </>
        )}
        {b.type === 'AIN' && <Bar value={meas} lo={num(b.p.LSCO1)} hi={num(b.p.HSCO1)} color={bool(b.p.BAD) ? '#00c8d8' : '#e8e8e8'} label="PNT" />}
        {b.type === 'AOUT' && <Bar value={out} lo={outLo} hi={outHi} color="#00b050" label="OUT" />}
        {b.type === 'MTR' && (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="w-16 h-16 rounded-full border-4" style={{ borderColor: bool(b.p.MSTAT) ? '#00d060' : '#e01010', background: bool(b.p.MSTAT) ? '#004818' : '#400' }} />
            <div>{bool(b.p.MSTAT) ? 'RUNNING' : 'STOPPED'}</div>
            {bool(b.p.TRIP) && <div className="text-red-400">TRIP</div>}
          </div>
        )}
      </div>
      <div className="px-2 space-y-0.5">
        {isPid && (
          <>
            <Row k="MEAS" v={`${fmt(meas)} ${eu}`} />
            <Row k="SPT" v={`${fmt(b.p.SPT)} ${eu}`} />
            <Row k="OUT" v={`${fmt(out)} ${String(b.p.EO1 ?? '%')}`} />
          </>
        )}
        {b.type === 'AIN' && <Row k="PNT" v={`${fmt(b.p.PNT)} ${String(b.p.EO1)}`} />}
        {b.type === 'AOUT' && <Row k="OUT" v={`${fmt(out)} ${String(b.p.EO1)}`} />}
        <div className="flex gap-2 text-[11px] pt-1">
          {hasMA && <span className={auto ? 'text-green-400' : 'text-yellow-300'}>{auto ? 'AUTO' : 'MANUAL'}</span>}
          {isPid && <span className={remote ? 'text-cyan-300' : 'text-gray-300'}>{remote ? 'REMOTE' : 'LOCAL'}</span>}
          <span className="text-orange-300">{status(b)}</span>
          {bool(b.p.UNACK) && <span className="text-red-400 animate-pulse">UNACK</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 p-2">
        {hasMA && (
          <>
            <FpBtn on={auto} onClick={() => set(b.compound, b.name, 'MA', true)}>AUTO</FpBtn>
            <FpBtn on={!auto} onClick={() => set(b.compound, b.name, 'MA', false)}>MAN</FpBtn>
          </>
        )}
        {isPid && (
          <>
            <FpBtn on={!remote} onClick={() => set(b.compound, b.name, 'LR', false)}>LOCAL</FpBtn>
            <FpBtn on={remote} onClick={() => set(b.compound, b.name, 'LR', true)}>REMOTE</FpBtn>
          </>
        )}
        {b.type === 'MTR' && (
          <>
            <FpBtn on={bool(b.p.MANRUN)} onClick={() => set(b.compound, b.name, 'MANRUN', true)}>START</FpBtn>
            <FpBtn on={!bool(b.p.MANRUN)} onClick={() => set(b.compound, b.name, 'MANRUN', false)}>STOP</FpBtn>
          </>
        )}
      </div>
      {target && (
        <div className="px-2 pb-2">
          <div className="text-[10px] text-gray-400 mb-1">
            {L('Ramp', 'Изменить')} {target} (▲▲ 5 %, ▲ 1 %)
          </div>
          <div className="grid grid-cols-4 gap-1">
            <FpBtn onClick={() => ramp(-5)}>▼▼</FpBtn>
            <FpBtn onClick={() => ramp(-1)}>▼</FpBtn>
            <FpBtn onClick={() => ramp(1)}>▲</FpBtn>
            <FpBtn onClick={() => ramp(5)}>▲▲</FpBtn>
          </div>
        </div>
      )}
      <div className="p-2 pt-0">
        <FpBtn onClick={() => ack(ref)} disabled={!bool(b.p.UNACK)}>
          ACK
        </FpBtn>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{k}</span>
      <span>{v}</span>
    </div>
  )
}

function FpBtn({ children, on, onClick, disabled }: { children: React.ReactNode; on?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full border text-[11px] py-1 disabled:opacity-30 ${on ? 'bg-gray-200 text-black border-white' : 'bg-[#333] border-gray-500 hover:bg-[#555]'}`}
    >
      {children}
    </button>
  )
}
