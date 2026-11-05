import { CheckCircle2, ClipboardList, Lightbulb, Trophy, X, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EXERCISES, exercise, grade } from '../../domain/hardware/exercises'
import { useLang } from '../../i18n/i18n'
import { useTopology } from '../../store/topology'

const useB = () => {
  const { lang } = useLang()
  return (b?: { en: string; ru: string }) => (b ? b[lang] : '')
}

/** Task statement (ТЗ) with live requirement checks. */
export function ExercisePanel() {
  const B = useB()
  const { lang } = useLang()
  const T = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const s = useTopology()
  const ex = exercise(s.exerciseId)
  const topo = useMemo(() => ({ nodes: s.nodes, links: s.links }), [s.nodes, s.links])
  const g = useMemo(() => (ex ? grade(ex, topo) : undefined), [ex, topo])
  const [submitted, setSubmitted] = useState<number | undefined>()
  if (!ex || !g) return null
  const best = s.exBest[ex.id]

  return (
    <div className="panel h-full flex flex-col min-h-0" data-testid="exercise-panel">
      <div className="titlebar flex items-center gap-1">
        <ClipboardList size={13} />
        <span className="truncate flex-1">
          {T('Task', 'Задание')} {EXERCISES.indexOf(ex) + 1} · {'★'.repeat(ex.level)}
        </span>
        <button onClick={s.quitExercise} title={T('Close task', 'Закрыть задание')} className="hover:text-yellow-200">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 text-xs space-y-2">
        <h3 className="font-semibold text-[13px] leading-snug">{B(ex.title)}</h3>
        {ex.brief.map((p, i) => (
          <p key={i} className="leading-snug">
            {B(p)}
          </p>
        ))}
        {ex.table && (
          <table className="w-full text-[11px] border border-fox-edge/50">
            <thead className="bg-fox-panel2">
              <tr>
                {ex.table.head.map((h) => (
                  <th key={h} className="px-1 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ex.table.rows.map((r, i) => (
                <tr key={i} className="border-t border-fox-edge/30">
                  {r.map((c, j) => (
                    <td key={j} className={`px-1 ${j === 0 ? 'font-mono font-semibold' : ''}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {ex.src && (
          <p className="text-[10px] text-gray-500">
            {T('Manual 2001V8, p. ', 'Руководство 2001V8, стр. ')}
            {ex.src}
          </p>
        )}
        <div className="border-t border-fox-edge pt-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="help-h !mb-0 flex-1">{T('Requirements', 'Требования')}</span>
            <span className="font-mono">
              {g.score}/{g.max}
            </span>
          </div>
          <div className="h-1.5 bg-fox-panel2 mb-2">
            <div className="h-full bg-fox-ok transition-all" style={{ width: `${g.pct}%` }} />
          </div>
          <ul className="space-y-1">
            {g.results.map(({ r, res }) => (
              <li key={r.id} className="flex gap-1.5 items-start" data-testid={`req-${r.id}`} data-ok={res.ok}>
                {res.ok ? <CheckCircle2 size={14} className="text-fox-ok shrink-0 mt-px" /> : <XCircle size={14} className="text-gray-400 shrink-0 mt-px" />}
                <div className="flex-1">
                  <div className={res.ok ? 'text-gray-600' : ''}>
                    {B(r.text)}
                    {(r.w ?? 1) > 1 && <span className="text-gray-400"> ×{r.w}</span>}
                  </div>
                  {!res.ok && res.detail && <div className="text-[11px] text-amber-800">{B(res.detail)}</div>}
                  {!res.ok &&
                    r.hint &&
                    (s.exHints.includes(r.id) ? (
                      <div className="text-[11px] text-fox-navy bg-yellow-50 border border-yellow-200 px-1 mt-0.5">{B(r.hint)}</div>
                    ) : (
                      <button className="text-[11px] text-fox-navy underline decoration-dotted flex items-center gap-0.5" onClick={() => s.showHint(r.id)}>
                        <Lightbulb size={11} /> {T('Hint', 'Подсказка')}
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-fox-edge p-2 flex items-center gap-2 text-xs">
        <button
          className="btn btn-on"
          onClick={() => {
            s.recordScore(ex.id, g.pct)
            setSubmitted(g.pct)
          }}
          data-testid="ex-submit"
        >
          <Trophy size={12} /> {T('Submit', 'Сдать')}
        </button>
        {submitted !== undefined && (
          <span className={submitted === 100 ? 'text-fox-ok font-semibold' : 'text-amber-800'} data-testid="ex-result">
            {submitted}% {submitted === 100 ? T('— done!', '— выполнено!') : T('— not all requirements met', '— выполнено не всё')}
          </span>
        )}
        <span className="flex-1" />
        {best !== undefined && (
          <span className="text-gray-500">
            {T('best', 'лучший')} {best}%
          </span>
        )}
      </div>
    </div>
  )
}

/** List of exercises (modal). */
export function ExercisePicker({ onClose }: { onClose: () => void }) {
  const B = useB()
  const { lang } = useLang()
  const T = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const s = useTopology()
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border-2 border-fox-navy w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()} data-testid="ex-picker">
        <div className="titlebar flex items-center">
          <span className="flex-1">{T('Architecture tasks', 'Задания по архитектуре')}</span>
          <button onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-gray-600 px-3 pt-2">
          {T(
            'Each task is a short specification. Build the system on the canvas; the checklist on the right updates as you work. Loading a task replaces the current canvas.',
            'Каждое задание — короткое ТЗ. Собирайте систему на холсте, список требований справа обновляется по ходу работы. Загрузка задания заменяет текущую схему.',
          )}
        </p>
        <div className="overflow-y-auto p-3 space-y-2">
          {EXERCISES.map((e, i) => (
            <button
              key={e.id}
              className="w-full text-left border border-fox-edge/60 hover:bg-fox-panel p-2 flex gap-3 items-start"
              onClick={() => {
                s.loadExercise(e.id)
                onClose()
              }}
              data-testid={`ex-${e.id}`}
            >
              <span className="font-mono text-lg text-fox-navy w-6">{i + 1}</span>
              <span className="flex-1">
                <span className="block font-semibold text-sm">{B(e.title)}</span>
                <span className="block text-xs text-gray-600 line-clamp-2">{B(e.brief[0])}</span>
              </span>
              <span className="text-xs text-right whitespace-nowrap">
                <span className="block text-amber-600">{'★'.repeat(e.level)}</span>
                {s.exBest[e.id] !== undefined && <span className={s.exBest[e.id] === 100 ? 'text-fox-ok font-semibold' : 'text-gray-500'}>{s.exBest[e.id]}%</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
