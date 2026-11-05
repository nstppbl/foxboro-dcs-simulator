import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLang } from '../../i18n/i18n'
import { useTheory } from '../../store/theory'
import { isRight, shuffle, tx } from '../../theory'
import type { Question } from '../../theory/types'

type Given = number | number[] | boolean | undefined

/** Runs a set of questions one by one, then shows the score and a review of mistakes. */
export function Quiz({ title, questions, onDone, shuffleQ = false }: { title: string; questions: Question[]; onDone?: (pct: number) => void; shuffleQ?: boolean }) {
  const { lang } = useLang()
  const T = (ru: string, en: string) => (lang === 'ru' ? ru : en)
  const answer = useTheory((s) => s.answer)
  const [nonce, setNonce] = useState(0)
  const qs = useMemo(() => (shuffleQ ? shuffle(questions) : questions), [questions, shuffleQ, nonce]) // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0)
  const [given, setGiven] = useState<Given>()
  const [numText, setNumText] = useState('')
  const [checked, setChecked] = useState(false)
  const [log, setLog] = useState<{ q: Question; ok: boolean; given: Given }[]>([])

  if (!qs.length) return <p className="text-sm text-gray-600">{T('Нет вопросов.', 'No questions.')}</p>

  const finished = log.length === qs.length
  if (finished) {
    const right = log.filter((l) => l.ok).length
    const pct = Math.round((right / qs.length) * 100)
    return (
      <div className="space-y-3" data-testid="quiz-result">
        <div className={`text-lg font-semibold ${pct >= 80 ? 'text-fox-ok' : 'text-amber-700'}`}>
          {right} / {qs.length} · {pct}% {pct >= 80 ? T('— зачёт', '— passed') : T('— повторите материал', '— review the material')}
        </div>
        {log.some((l) => !l.ok) && (
          <div className="space-y-2">
            <div className="help-h">{T('Разбор ошибок (вернутся на повторение через 1 день)', 'Mistakes (they come back for review in 1 day)')}</div>
            {log
              .filter((l) => !l.ok)
              .map((l) => (
                <div key={l.q.id} className="border border-fox-edge/50 bg-white p-2 text-sm">
                  <div className="font-medium">{tx(l.q.q, lang)}</div>
                  <div className="text-fox-ok mt-1">
                    {T('Правильно: ', 'Correct: ')}
                    {answerText(l.q, lang)}
                  </div>
                  <div className="text-gray-700 mt-1">{tx(l.q.explain, lang)}</div>
                </div>
              ))}
          </div>
        )}
        <button
          className="btn"
          onClick={() => {
            setLog([])
            setI(0)
            setGiven(undefined)
            setNumText('')
            setChecked(false)
            setNonce((n) => n + 1)
          }}
        >
          <RotateCcw size={12} /> {T('Пройти ещё раз', 'Try again')}
        </button>
      </div>
    )
  }

  const q = qs[i]
  const ok = checked && isRight(q, given)
  const check = () => {
    const g = q.kind === 'num' ? (numText.trim() === '' ? undefined : Number(numText.replace(',', '.'))) : given
    setGiven(g)
    const r = isRight(q, g)
    answer(q.id, r)
    setChecked(true)
  }
  const next = () => {
    const nl = [...log, { q, ok: isRight(q, given), given }]
    setLog(nl)
    setChecked(false)
    setGiven(undefined)
    setNumText('')
    if (nl.length === qs.length) onDone?.(Math.round((nl.filter((l) => l.ok).length / qs.length) * 100))
    else setI(i + 1)
  }
  const opts = q.kind === 'tf' ? [T('Верно', 'True'), T('Неверно', 'False')] : (q.options ?? []).map((o) => tx(o, lang))
  const isSel = (j: number) => (q.kind === 'tf' ? given === (j === 0) : q.kind === 'multi' ? Array.isArray(given) && given.includes(j) : given === j)
  const correctJ = (j: number) => (q.kind === 'tf' ? q.answer === (j === 0) : q.kind === 'multi' ? (q.answer as number[]).includes(j) : q.answer === j)
  const pick = (j: number) => {
    if (checked) return
    if (q.kind === 'tf') setGiven(j === 0)
    else if (q.kind === 'multi') {
      const cur = Array.isArray(given) ? given : []
      setGiven(cur.includes(j) ? cur.filter((x) => x !== j) : [...cur, j])
    } else setGiven(j)
  }

  return (
    <div className="space-y-3 max-w-3xl" data-testid="quiz">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span className="font-semibold text-fox-navy">{title}</span>
        <span className="flex-1" />
        {T('Вопрос', 'Question')} {i + 1} / {qs.length}
      </div>
      <div className="h-1 bg-fox-panel2">
        <div className="h-full bg-fox-navy" style={{ width: `${(i / qs.length) * 100}%` }} />
      </div>
      <div className="text-[15px] font-medium leading-snug" data-testid="quiz-q">
        {tx(q.q, lang)}
      </div>
      {q.kind === 'multi' && <div className="text-xs text-gray-500">{T('Отметьте все правильные варианты', 'Select all correct options')}</div>}
      {q.kind === 'num' ? (
        <input
          className="field !w-40 !text-sm"
          inputMode="decimal"
          value={numText}
          disabled={checked}
          onChange={(e) => setNumText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !checked && check()}
          placeholder={T('число', 'number')}
          data-testid="quiz-num"
        />
      ) : (
        <div className="space-y-1.5">
          {opts.map((o, j) => {
            const sel = isSel(j)
            const cls = !checked
              ? sel
                ? 'border-fox-navy bg-blue-50'
                : 'border-fox-edge/60 bg-white hover:bg-fox-panel2'
              : correctJ(j)
                ? 'border-fox-ok bg-green-50'
                : sel
                  ? 'border-fox-alarm bg-red-50'
                  : 'border-fox-edge/40 bg-white opacity-70'
            return (
              <button key={j} className={`w-full text-left border px-3 py-2 text-sm flex gap-2 items-start ${cls}`} onClick={() => pick(j)} data-testid={`opt-${j}`}>
                <span className="font-mono text-xs mt-0.5 w-4">{q.kind === 'multi' ? (sel ? '☑' : '☐') : String.fromCharCode(65 + j)}</span>
                <span className="flex-1">{o}</span>
              </button>
            )
          })}
        </div>
      )}
      {checked && (
        <div className={`border-l-4 px-3 py-2 text-sm ${ok ? 'border-fox-ok bg-green-50' : 'border-fox-alarm bg-red-50'}`} data-testid="quiz-feedback">
          <div className="flex items-center gap-1 font-semibold">
            {ok ? <CheckCircle2 size={15} className="text-fox-ok" /> : <XCircle size={15} className="text-fox-alarm" />}
            {ok ? T('Верно', 'Correct') : T('Неверно. Правильно: ', 'Wrong. Correct: ') + (ok ? '' : answerText(q, lang))}
          </div>
          <div className="mt-1">{tx(q.explain, lang)}</div>
          {q.src && <div className="text-[11px] text-gray-500 mt-1">{q.src}</div>}
        </div>
      )}
      <div className="flex gap-2">
        {!checked ? (
          <button className="btn btn-on" onClick={check} disabled={q.kind === 'num' ? numText.trim() === '' : given === undefined || (Array.isArray(given) && !given.length)} data-testid="quiz-check">
            {T('Проверить', 'Check')}
          </button>
        ) : (
          <button className="btn btn-on" onClick={next} data-testid="quiz-next">
            {i + 1 === qs.length ? T('Результат', 'Result') : T('Дальше', 'Next')}
          </button>
        )}
      </div>
    </div>
  )
}

function answerText(q: Question, lang: 'ru' | 'en') {
  if (q.kind === 'tf') return q.answer ? (lang === 'ru' ? 'Верно' : 'True') : lang === 'ru' ? 'Неверно' : 'False'
  if (q.kind === 'num') return String(q.answer)
  if (q.kind === 'multi') return (q.answer as number[]).map((j) => tx(q.options?.[j], lang)).join('; ')
  return tx(q.options?.[q.answer as number], lang)
}
