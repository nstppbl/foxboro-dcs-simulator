import { CheckCircle2, Circle } from 'lucide-react'
import { blockParams, compoundState, type CfgDb } from '../../engine/config'
import { bool, num } from '../../engine/blocks/common'
import { useEng } from '../../store/engineering'
import { useSim } from '../../store/sim'
import { useL } from '../control/ui'

interface Step {
  en: string
  ru: string
  ok: boolean
}

function steps(cfg: CfgDb, cp: CfgDb, live: { auto: boolean; err: number } | undefined): Step[] {
  const t = cfg.compounds.find((c) => c.name === 'TANK2_COMP')
  const b = (n: string) => t?.blocks.find((x) => x.name === n)
  const lt = b('LT100')
  const lc = b('LC100')
  const lv = b('LV100')
  const P = (x: typeof lt) => (x ? blockParams(x) : {})
  const lk = (x: typeof lt, p: string) => x?.links[p]?.toUpperCase()
  const eq = (a: unknown, v: number) => Math.abs(Number(a) - v) < 1e-6
  const dead = cfg.compounds.find((c) => c.name === 'PROCESS_2')?.blocks.find((x) => x.name === 'DEAD_TM')
  const order = t?.blocks.map((x) => x.name).filter((n) => ['LT100', 'LC100', 'LV100'].includes(n)).join(',')
  return [
    { en: 'Table 8: add AIN block LT100 to TANK2_COMP', ru: 'Таблица 8: добавьте блок AIN с именем LT100 в TANK2_COMP', ok: lt?.type === 'AIN' },
    {
      en: 'LT100: IOMOPT 2, HSCO1 10, EO1 INCHES, MEAS = PROCESS_2:LAG_TM.OUT',
      ru: 'LT100: IOMOPT 2, HSCO1 10, EO1 INCHES, MEAS = PROCESS_2:LAG_TM.OUT',
      ok: !!lt && eq(P(lt).IOMOPT, 2) && eq(P(lt).HSCO1, 10) && String(P(lt).EO1).toUpperCase() === 'INCHES' && lk(lt, 'MEAS') === 'PROCESS_2:LAG_TM.OUT',
    },
    { en: 'Table 9: add PID block LC100', ru: 'Таблица 9: добавьте блок PID с именем LC100', ok: lc?.type === 'PID' || lc?.type === 'PIDA' },
    {
      en: 'LC100: MEAS = :LT100.PNT, HSCI1 10, EI1 INCHES, SPT 5',
      ru: 'LC100: MEAS = :LT100.PNT, HSCI1 10, EI1 INCHES, SPT 5',
      ok: !!lc && lk(lc, 'MEAS') === ':LT100.PNT' && eq(P(lc).HSCI1, 10) && String(P(lc).EI1).toUpperCase() === 'INCHES' && eq(P(lc).SPT, 5),
    },
    { en: 'LC100 tuning: MODOPT 4 (PI), PBAND 30, INT 0.2', ru: 'Настройка LC100: MODOPT 4 (PI), PBAND 30, INT 0.2', ok: !!lc && eq(P(lc).MODOPT, 4) && eq(P(lc).PBAND, 30) && eq(P(lc).INT, 0.2) },
    { en: 'Table 10: add AOUT block LV100 with IOMOPT 2 and MEAS = :LC100.OUT', ru: 'Таблица 10: добавьте блок AOUT с именем LV100, IOMOPT 2 и MEAS = :LC100.OUT', ok: lv?.type === 'AOUT' && eq(P(lv).IOMOPT, 2) && lk(lv, 'MEAS') === ':LC100.OUT' },
    { en: 'Bumpless transfer: LC100.BCALCI and LC100.FBK = :LV100.BCALCO', ru: 'Безударный переход: LC100.BCALCI и LC100.FBK = :LV100.BCALCO', ok: lk(lc, 'BCALCI') === ':LV100.BCALCO' && lk(lc, 'FBK') === ':LV100.BCALCO' },
    { en: 'Cross-compound link: PROCESS_2:DEAD_TM.MEAS = TANK2_COMP:LV100.OUT', ru: 'Связь между compounds: PROCESS_2:DEAD_TM.MEAS = TANK2_COMP:LV100.OUT', ok: dead?.links.MEAS?.toUpperCase() === 'TANK2_COMP:LV100.OUT' },
    { en: 'Execution order: LT100, LC100, LV100', ru: 'Порядок исполнения: LT100, LC100, LV100', ok: order === 'LT100,LC100,LV100' },
    {
      en: 'Validate without errors and Download to CP2701',
      ru: 'Validate без ошибок и Download в CP2701',
      ok: !!t && t.blocks.length >= 3 && compoundState(t, cp) === 'Downloaded' && cfg.compounds.every((c) => compoundState(c, cp) === 'Downloaded'),
    },
    { en: 'Control screen: LC100 in AUTO holds the level at SPT (±0.2 in)', ru: 'Экран «Управление»: LC100 в AUTO держит уровень на SPT (±0.2 дюйма)', ok: !!live && live.auto && Math.abs(live.err) <= 0.2 },
  ]
}

export function Lab1Panel() {
  const L = useL()
  const { cfg, cp } = useEng()
  const station = useSim((s) => s.station)
  useSim((s) => s.version)
  const lc = station.block('TANK2_COMP', 'LC100')
  const live = lc && lc.type.startsWith('PID') ? { auto: bool(lc.p.MA), err: num(lc.p.MEAS) - num(lc.p.SPT) } : undefined
  const st = steps(cfg, cp, live)
  const done = st.filter((s) => s.ok).length
  return (
    <div className="text-[12px]">
      <div className="titlebar">LAB 1 · TANK2_COMP ({done}/{st.length})</div>
      <div className="p-2 space-y-1">
        <p className="text-[11px] text-gray-700">
          {L(
            'Build the TANK2 level loop from the manual\'s LAB 1. PROCESS_2 (the simulated tank and pump) is already in the CP. Use either editor.',
            'Соберите контур уровня TANK2 из LAB 1 руководства. PROCESS_2 (модель бака и насоса) уже загружен в CP. Можно работать в любом редакторе.',
          )}
        </p>
        {st.map((s, i) => (
          <div key={i} className="flex gap-1.5 items-start">
            {s.ok ? <CheckCircle2 size={14} className="text-fox-ok shrink-0 mt-0.5" /> : <Circle size={14} className="text-gray-400 shrink-0 mt-0.5" />}
            <span className={s.ok ? 'text-gray-500' : ''}>{L(s.en, s.ru)}</span>
          </div>
        ))}
        {done === st.length && <div className="mt-2 p-2 bg-green-100 border border-green-600 text-green-800">{L('Lab complete. Well done!', 'Лаба выполнена. Отлично!')}</div>}
      </div>
    </div>
  )
}
