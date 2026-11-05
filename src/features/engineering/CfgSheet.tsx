import { HelpButton } from '../../help/HelpUi'
import { useEffect, useState } from 'react'
import { blockParams, blockState, compoundState, type CfgBlock, type CfgCompound } from '../../engine/config'
import { BLOCK_TYPES } from '../../engine/registry'
import { PERIOD_SECONDS } from '../../engine/scheduler'
import type { ParamDef, Val } from '../../engine/types'
import { useLang } from '../../i18n/i18n'
import { useEng } from '../../store/engineering'
import { useL } from '../control/ui'

export const STATE_COLOR: Record<string, string> = { Added: '#1e6fd0', Modified: '#c98a00', Downloaded: '#1e8a3c' }

export function StateBadge({ s }: { s: string }) {
  return (
    <span className="text-[10px] font-mono px-1 border" style={{ color: STATE_COLOR[s], borderColor: STATE_COLOR[s] }}>
      {s}
    </span>
  )
}

const show = (v: Val) => (typeof v === 'boolean' ? (v ? '1' : '0') : String(v))

function ValueInput({ value, linked, onCommit, wide }: { value: string; linked: boolean; onCommit: (v: string) => void; wide?: boolean }) {
  const [edit, setEdit] = useState<string | undefined>()
  return (
    <input
      className={`field ${wide ? '' : '!w-44'} ${linked ? 'text-fox-navy font-semibold' : ''}`}
      value={edit ?? value}
      onFocus={() => setEdit(value)}
      onChange={(e) => setEdit(e.target.value)}
      onBlur={() => {
        if (edit !== undefined && edit !== value) onCommit(edit)
        setEdit(undefined)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setEdit(undefined)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}

const GROUPS: { g: NonNullable<ParamDef['group']>; en: string; ru: string }[] = [
  { g: 'general', en: 'General', ru: 'Общие' },
  { g: 'io', en: 'I/O', ru: 'Ввод/вывод' },
  { g: 'control', en: 'Control', ru: 'Управление' },
  { g: 'tune', en: 'Tuning / program', ru: 'Настройка / программа' },
  { g: 'alarm', en: 'Alarming', ru: 'Аварии' },
]

/** Block parameter sheet (ICC-style): value column takes a value, or a C:B.P string for a connection. */
export function BlockSheet({ c, b, compact = false }: { c: CfgCompound; b: CfgBlock; compact?: boolean }) {
  const L = useL()
  const { lang } = useLang()
  const { setValue, rename, cp } = useEng()
  const [name, setName] = useState(b.name)
  useEffect(() => setName(b.name), [b.name])
  const def = BLOCK_TYPES[b.type]
  const p = blockParams(b)
  const [filter, setFilter] = useState('')
  const params = def.params.filter((d) => d.kind !== 'out' && (!filter || d.name.includes(filter.toUpperCase())))
  return (
    <div className="text-[12px]">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="lbl">NAME</span>
        <input
          className="field !w-36 font-semibold"
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          onBlur={() => !rename(c.name, b.name, name) && setName(b.name)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="lbl">TYPE</span>
        <span className="font-mono font-semibold" data-help={`block:${b.type}`}>{b.type}</span>
        <HelpButton topic={`block:${b.type}`} />
        <StateBadge s={blockState(c, b, cp)} />
        <span className="flex-1" />
        <input className="field !w-28" placeholder={L('filter…', 'фильтр…')} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {!compact && <p className="text-[11px] text-gray-700 mb-2">{def.desc[lang]}</p>}
      <p className="text-[11px] text-gray-600 mb-2">
        {L('Enter a value, or a connection such as :LT100.PNT or PROCESS_2:LAG_TM.OUT. Clear a connection by typing a value.', 'Введите значение или связь, например :LT100.PNT или PROCESS_2:LAG_TM.OUT. Чтобы убрать связь, введите значение.')}
      </p>
      <table className="w-full">
        <tbody>
          {GROUPS.map(({ g, en, ru }) => {
            const rows = params.filter((d) => (d.group ?? 'general') === g || (g === 'control' && d.group === 'status'))
            if (!rows.length) return null
            return [
              <tr key={g}>
                <td colSpan={compact ? 2 : 4} className="bg-fox-navy text-white px-2 py-0.5 text-[11px] uppercase">
                  {lang === 'ru' ? ru : en}
                </td>
              </tr>,
              ...rows.map((d) => {
                const linked = !!b.links[d.name]
                const changed = d.name in b.v
                return (
                  <tr key={d.name} className="border-b border-fox-edge/20 align-top">
                    <td className={`px-1 py-0.5 font-mono whitespace-nowrap ${changed || linked ? 'font-bold' : ''}`} title={d.desc} data-help={`param:${b.type}.${d.name}`}>
                      {d.name}
                      {d.conn && <span className="text-[9px] text-fox-navy ml-1">⇠</span>}
                    </td>
                    <td className="px-1 py-0.5">
                      {d.name === 'SOURCE' ? (
                        <span className="text-[11px] text-gray-600">{L('edit in the HLBL page of the Control screen', 'редактируется на странице HLBL экрана «Управление»')}</span>
                      ) : (
                        <ValueInput value={linked ? b.links[d.name] : show(p[d.name])} linked={linked} wide={compact} onCommit={(v) => setValue(c.name, b.name, d.name, v)} />
                      )}
                    </td>
                    {!compact && <td className="px-1 font-mono text-gray-500 whitespace-nowrap">{show(d.def).slice(0, 16)}</td>}
                    {!compact && (
                      <td className="px-1 text-gray-700">
                        {d.desc}
                        {d.src && <span className="text-gray-400"> · p. {d.src}</span>}
                      </td>
                    )}
                  </tr>
                )
              }),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Compound parameter sheet. */
export function CompoundSheet({ c }: { c: CfgCompound }) {
  const L = useL()
  const { setCompound, cp } = useEng()
  const v = (k: string, d: Val) => (k in c.p ? c.p[k] : d)
  return (
    <div className="text-[12px] space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold">{c.name}</span>
        <StateBadge s={compoundState(c, cp)} />
      </div>
      <table>
        <tbody>
          <tr>
            <td className="pr-2 font-mono">DESCRP</td>
            <td>
              <ValueInput value={String(v('DESCRP', ''))} linked={false} onCommit={(x) => setCompound(c.name, 'DESCRP', x)} />
            </td>
          </tr>
          <tr>
            <td className="pr-2 font-mono">PERIOD</td>
            <td>
              <select className="field !w-44" value={Number(v('PERIOD', 1))} onChange={(e) => setCompound(c.name, 'PERIOD', +e.target.value)}>
                {Object.entries(PERIOD_SECONDS).map(([k, s]) => (
                  <option key={k} value={k}>
                    {k} = {s >= 60 ? `${s / 60} min` : `${s} s`}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td className="pr-2 font-mono">PHASE</td>
            <td>
              <ValueInput value={String(v('PHASE', 0))} linked={false} onCommit={(x) => setCompound(c.name, 'PHASE', parseInt(x) || 0)} />
            </td>
          </tr>
          <tr>
            <td className="pr-2 font-mono">CINHIB</td>
            <td>
              <select className="field !w-44" value={Number(v('CINHIB', 0))} onChange={(e) => setCompound(c.name, 'CINHIB', +e.target.value)}>
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td className="pr-2 font-mono">ON</td>
            <td>
              <select className="field !w-44" value={v('ON', true) ? 1 : 0} onChange={(e) => setCompound(c.name, 'ON', e.target.value === '1')}>
                <option value={1}>1 (ON)</option>
                <option value={0}>0 (OFF)</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="text-[11px] text-gray-600">
        {L('The compound PERIOD must be less than or equal to the shortest block PERIOD (manual p. 4-18).', 'PERIOD compound должен быть меньше или равен самому короткому PERIOD блока (руководство, стр. 4-18).')}
      </p>
    </div>
  )
}
