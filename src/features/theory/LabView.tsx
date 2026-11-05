import { CheckCircle2, Eye, FlaskConical, Play, RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { compileHlbl } from '../../engine/blocks/hlbl'
import { gradeLab, type Lab } from '../../theory/labs'
import { Md } from '../../theory/Md'
import { useTheory } from '../../store/theory'

type Graded = ReturnType<typeof gradeLab>

/** HLBL lab: brief, code editor, run the test cases on the process model. */
export function LabView({ lab }: { lab: Lab }) {
  const s = useTheory()
  const [code, setCode] = useState(() => s.labCode[lab.id] ?? lab.starter)
  const [res, setRes] = useState<Graded | undefined>()
  const [busy, setBusy] = useState(false)
  const [showSol, setShowSol] = useState(false)
  const err = compileHlbl(code).error
  const run = () => {
    setBusy(true)
    s.saveLab(lab.id, code)
    // let the button repaint before the simulation blocks the thread
    setTimeout(() => {
      const g = gradeLab(lab, code)
      setRes(g)
      const all = g.flatMap((c) => c.results)
      s.labDone(lab.id, Math.round((all.filter((x) => x.ok).length / all.length) * 100))
      setBusy(false)
    }, 20)
  }
  return (
    <div className="max-w-5xl space-y-3" data-testid="lab">
      <div>
        <div className="text-xs text-gray-600">
          Лаба HLBL · {'★'.repeat(lab.level)} · реактор R-401
          {s.labBest[lab.id] !== undefined && <> · лучший результат {s.labBest[lab.id]}%</>}
        </div>
        <h2 className="text-xl font-semibold text-fox-navy">{lab.title}</h2>
      </div>
      <div className="bg-white border border-fox-edge/50 p-3">
        <Md src={lab.brief} />
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="help-h !mb-0">Программа HLBL</div>
          <textarea
            className="w-full h-80 font-mono text-[12.5px] bg-[#1f252b] text-[#d8e2ea] p-2 border border-black"
            spellCheck={false}
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setRes(undefined)
            }}
            data-testid="lab-code"
          />
          {err && <div className="text-xs text-fox-alarm font-mono">Ошибка компиляции: {err}</div>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-on !text-sm !px-3 !py-1.5" disabled={busy || !!err} onClick={run} data-testid="lab-run">
              <Play size={13} /> {busy ? 'Идут тесты…' : 'Запустить тест-кейсы'}
            </button>
            <button
              className="btn"
              onClick={() => {
                setCode(lab.starter)
                setRes(undefined)
              }}
            >
              <RotateCcw size={12} /> Сначала
            </button>
            <button className="btn" onClick={() => setShowSol(!showSol)}>
              <Eye size={12} /> {showSol ? 'Скрыть решение' : 'Показать решение'}
            </button>
          </div>
          {showSol && <pre className="font-mono text-[12px] bg-fox-panel2 border border-fox-edge/50 p-2 overflow-x-auto">{lab.solution}</pre>}
        </div>
        <div className="space-y-2">
          <div className="help-h !mb-0">Тест-кейсы</div>
          {lab.cases.map((c, i) => {
            const g = res?.[i]
            return (
              <div key={c.id} className={`border p-2 text-sm bg-white ${g ? (g.ok ? 'border-fox-ok' : 'border-fox-alarm') : 'border-fox-edge/50'}`} data-testid={`lab-case-${c.id}`} data-ok={g?.ok}>
                <div className="font-semibold flex items-center gap-1.5">
                  {g ? g.ok ? <CheckCircle2 size={15} className="text-fox-ok" /> : <XCircle size={15} className="text-fox-alarm" /> : <FlaskConical size={14} className="text-gray-500" />}
                  TC{i + 1}. {c.title}
                </div>
                <div className="text-xs text-gray-600 mb-1">Предусловие: {c.setup}</div>
                <ul className="space-y-0.5 text-[13px]">
                  {c.checks.map((k, j) => {
                    const r = g?.results[j]
                    return (
                      <li key={j} className="flex gap-1.5 items-start">
                        <span className="w-4 shrink-0">{r ? (r.ok ? '✔' : '✘') : '·'}</span>
                        <span className={r && !r.ok ? 'text-fox-alarm' : ''}>
                          {k.text}
                          {r && !r.ok && r.why && <span className="block text-xs text-amber-800">факт: {r.why}</span>}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                {g && (
                  <div className="mt-1 text-[11px] font-mono text-gray-600 border-t border-fox-edge/30 pt-1">
                    STATE {g.r.state} · {g.r.t} с{g.r.error ? ` · ${g.r.error}` : ''}
                    {g.r.msgs.map((m, k) => (
                      <div key={k}>MSG: {m}</div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {res && (
            <div className={`text-sm font-semibold ${res.every((g) => g.ok) ? 'text-fox-ok' : 'text-amber-800'}`} data-testid="lab-verdict">
              {res.every((g) => g.ok) ? 'Все тест-кейсы пройдены: фаза готова к FAT.' : 'Есть непройденные проверки: исправьте программу и запустите снова.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
