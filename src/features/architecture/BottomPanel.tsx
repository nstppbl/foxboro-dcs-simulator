import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { useState } from 'react'
import { nodeIndex, nodeName } from '../../domain/hardware/model'
import { TOPOLOGY_LABEL, type NetworkReport } from '../../domain/hardware/network'
import type { Issue } from '../../domain/hardware/rules'
import type { TraceResult } from '../../domain/hardware/trace'
import { useT } from '../../i18n/i18n'
import { useTopology } from '../../store/topology'
import { THEORY } from './theory'

type Tab = 'validation' | 'trace' | 'network' | 'theory'

export function BottomPanel({ issues, trace, net }: { issues: Issue[]; trace: TraceResult | null; net: NetworkReport }) {
  const { t } = useT()
  const traceFrom = useTopology((s) => s.traceFrom)
  const [tab, setTab] = useState<Tab>('validation')
  const [lastTrace, setLastTrace] = useState(traceFrom)
  if (traceFrom !== lastTrace) {
    setLastTrace(traceFrom)
    if (traceFrom) setTab('trace')
  }
  const errs = issues.filter((i) => i.severity === 'error').length
  const warns = issues.filter((i) => i.severity === 'warning').length

  return (
    <div className="panel h-full flex flex-col min-h-0">
      <div className="flex bg-fox-navy text-white text-xs">
        {(
          [
            ['validation', `${t('tab_validation')} (${errs}/${warns})`],
            ['trace', t('tab_trace')],
            ['network', t('tab_network')],
            ['theory', t('tab_info')],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1 ${tab === k ? 'bg-fox-panel text-black' : 'hover:bg-fox-navy2'}`} data-tab={k}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 text-xs">
        {tab === 'validation' && <Validation issues={issues} />}
        {tab === 'trace' && <Trace trace={trace} />}
        {tab === 'network' && <Network net={net} />}
        {tab === 'theory' && <Theory />}
      </div>
    </div>
  )
}

function Validation({ issues }: { issues: Issue[] }) {
  const { t, tb } = useT()
  const select = useTopology((s) => s.select)
  if (!issues.length)
    return (
      <div className="flex items-center gap-2 text-fox-ok font-semibold">
        <CheckCircle2 size={16} /> {t('noIssues')}
      </div>
    )
  const order = { error: 0, warning: 1, info: 2 }
  return (
    <ul className="space-y-0.5">
      {[...issues]
        .sort((a, b) => order[a.severity] - order[b.severity])
        .map((i, k) => (
          <li
            key={k}
            className="flex gap-2 items-start hover:bg-white cursor-pointer px-1"
            onClick={() => i.nodeIds[0] && select({ kind: 'node', id: i.nodeIds[0] })}
          >
            {i.severity === 'error' ? (
              <XCircle size={14} className="text-fox-alarm shrink-0" />
            ) : i.severity === 'warning' ? (
              <AlertTriangle size={14} className="text-fox-warn shrink-0" />
            ) : (
              <Info size={14} className="text-fox-navy shrink-0" />
            )}
            <span className="flex-1">{tb(i.msg)}</span>
            {i.src && <span className="text-[10px] text-gray-500 shrink-0">p. {i.src}</span>}
          </li>
        ))}
    </ul>
  )
}

const LAYER_COLOR: Record<string, string> = {
  field: 'bg-red-100 border-red-300',
  io: 'bg-amber-100 border-amber-300',
  network: 'bg-blue-100 border-blue-300',
  control: 'bg-emerald-100 border-emerald-300',
  hmi: 'bg-indigo-100 border-indigo-300',
}

function Trace({ trace }: { trace: TraceResult | null }) {
  const { t, tb } = useT()
  if (!trace) return <p className="text-gray-600">{t('traceHint')}</p>
  return (
    <div>
      <div className={`font-semibold mb-1 ${trace.broken ? 'text-fox-alarm' : 'text-fox-ok'}`}>{trace.broken ? t('traceBroken') : t('traceOk')}</div>
      <div className="flex flex-wrap items-stretch gap-1" data-testid="trace-steps">
        {trace.steps.map((st, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`border rounded px-2 py-1 max-w-[260px] ${st.ok ? LAYER_COLOR[st.layer] : 'bg-red-200 border-red-600'}`}>
              <div className="text-[9px] uppercase text-gray-600">{st.layer}</div>
              <div className="font-mono font-semibold">{st.title}</div>
              <div className="text-[11px] leading-tight">{tb(st.detail)}</div>
            </div>
            {i < trace.steps.length - 1 && <span className="text-gray-500">→</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Network({ net }: { net: NetworkReport }) {
  const { t, tb } = useT()
  const s = useTopology()
  const idx = nodeIndex(s)
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
      <div>
        <b>{t('topology')}:</b> {tb(TOPOLOGY_LABEL[net.topology])}
      </div>
      <div>
        <b>{t('switches')}:</b> {net.switchCount}
      </div>
      <div>
        <b>{t('maxHops')}:</b> <span className={net.maxHops > 7 ? 'text-fox-alarm font-bold' : ''}>{net.maxHops}</span>
      </div>
      <div>
        <b>{t('nonRedundant')}:</b> {net.nonRedundant.map(nodeName).join(', ') || t('none')}
      </div>
      <div className="col-span-2">
        <b>{t('spof')}:</b>{' '}
        {net.spof.length ? net.spof.map((x) => `${nodeName(x.sw)} → ${x.isolated.map(nodeName).join(', ')}`).join('; ') : t('none')}
      </div>
      <div className="col-span-2">
        <b>{t('unreachable')}:</b>{' '}
        <span className={net.unreachable.length ? 'text-fox-alarm' : ''}>
          {net.unreachable.length ? net.unreachable.map(([a, b]) => `${nodeName(a)} ⇹ ${nodeName(b)}`).join(', ') : t('none')}
        </span>
      </div>
      <div className="col-span-2 flex items-center gap-2 mt-1">
        <b>{t('failedNodes')}:</b> {s.failed.map((id) => (idx[id] ? nodeName(idx[id]) : id)).join(', ') || t('none')}
        {s.failed.length > 0 && (
          <button className="btn" onClick={s.restoreAll}>
            {t('restoreAll')}
          </button>
        )}
      </div>
      <p className="col-span-2 text-gray-600 mt-1">
        {tb({
          en: 'Tip: select a switch and press "Fail" to see RSTP convergence. Stations with both A and B connections keep communicating.',
          ru: 'Подсказка: выберите коммутатор и нажмите «Отказ», чтобы увидеть переключение RSTP. Станции с подключениями A и B сохраняют связь.',
        })}
      </p>
    </div>
  )
}

function Theory() {
  const { tb } = useT()
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {THEORY.map((sec) => (
        <div key={sec.title.en}>
          <div className="font-semibold text-fox-navy">
            {tb(sec.title)} <span className="text-[10px] text-gray-500 font-normal">p. {sec.src}</span>
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            {sec.points.map((p, i) => (
              <li key={i}>{tb(p)}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
