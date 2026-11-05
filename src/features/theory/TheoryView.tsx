import { BookOpen, CheckCircle2, ChevronRight, GraduationCap, Library, MessagesSquare, Play, RefreshCcw, Trophy } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useLang } from '../../i18n/i18n'
import { useEng } from '../../store/engineering'
import { useNav } from '../../store/nav'
import { dueIds, useTheory } from '../../store/theory'
import { useTopology } from '../../store/topology'
import { ALL_INTERVIEW, ALL_QUESTIONS, GLOSSARY, MODULES, PLANNED, coveredPoints, lessonById, questionById, ruOnly, shuffle, tx } from '../../theory'
import { Md } from '../../theory/Md'
import type { Lesson, Module, Practice, Question } from '../../theory/types'
import { Quiz } from './Quiz'

type Pane = { k: 'home' } | { k: 'lesson'; id: string } | { k: 'quiz'; id: string } | { k: 'exam'; m: string } | { k: 'final' } | { k: 'review' } | { k: 'interview' } | { k: 'glossary' }

const SECTIONS: { key: 'base' | 'classic' | 'modern' | 'field'; ru: string; en: string; cls: string }[] = [
  { key: 'base', ru: 'База', en: 'Fundamentals', cls: 'bg-fox-navy text-white' },
  { key: 'classic', ru: 'Как было: I/A Series V8', en: 'Then: I/A Series V8', cls: 'bg-[#5b6470] text-white' },
  { key: 'modern', ru: 'Как сейчас: EcoStruxure Foxboro DCS', en: 'Now: EcoStruxure Foxboro DCS', cls: 'bg-[#3dcd58] text-black' },
  { key: 'field', ru: 'Как говорят на объекте', en: 'How people say it on site', cls: 'bg-amber-200 text-black' },
]

export function TheoryView() {
  const { lang } = useLang()
  const T = (ru: string, en: string) => (lang === 'ru' ? ru : en)
  const s = useTheory()
  const [pane, setPaneRaw] = useState<Pane>(() => (s.lesson && lessonById(s.lesson) ? { k: 'lesson', id: s.lesson } : { k: 'home' }))
  const setPane = (p: Pane) => {
    setPaneRaw(p)
    if (p.k === 'lesson') s.open(p.id)
    document.getElementById('theory-main')?.scrollTo(0, 0)
  }
  const due = dueIds(s.srs)
  const lessonsTotal = MODULES.reduce((n, m) => n + m.lessons.length, 0)
  const lessonsRead = Object.keys(s.read).length

  return (
    <div className="h-full flex flex-col lg:flex-row min-h-0 bg-fox-canvas">
      {/* course tree */}
      <aside className="lg:w-72 shrink-0 bg-fox-panel border-b lg:border-b-0 lg:border-r border-fox-edge overflow-y-auto max-h-64 lg:max-h-none">
        <div className="titlebar">
          <GraduationCap size={13} /> {T('Курс Foxboro DCS', 'Foxboro DCS course')}
        </div>
        <div className="p-2 space-y-1 text-xs">
          <NavBtn on={pane.k === 'home'} onClick={() => setPane({ k: 'home' })} icon={<BookOpen size={13} />} testid="th-home">
            {T('Обзор и прогресс', 'Overview & progress')}
          </NavBtn>
          <NavBtn on={pane.k === 'review'} onClick={() => setPane({ k: 'review' })} icon={<RefreshCcw size={13} />} testid="th-review">
            {T('Повторение ошибок', 'Review mistakes')} {due.length > 0 && <span className="ml-1 px-1 bg-fox-alarm text-white rounded">{due.length}</span>}
          </NavBtn>
          <NavBtn on={pane.k === 'interview'} onClick={() => setPane({ k: 'interview' })} icon={<MessagesSquare size={13} />} testid="th-interview">
            {T('Собеседование', 'Interview mode')}
          </NavBtn>
          <NavBtn on={pane.k === 'glossary'} onClick={() => setPane({ k: 'glossary' })} icon={<Library size={13} />} testid="th-glossary">
            {T('Глоссарий «старое ↔ новое»', 'Glossary: old ↔ new')}
          </NavBtn>
          <NavBtn on={pane.k === 'final'} onClick={() => setPane({ k: 'final' })} icon={<Trophy size={13} />} testid="th-final">
            {T('Итоговый экзамен', 'Final exam')} {s.examBest.final !== undefined && <span className="text-gray-500">· {s.examBest.final}%</span>}
          </NavBtn>
        </div>
        {MODULES.map((m) => (
          <div key={m.id} className="border-t border-fox-edge/50">
            <div className="px-2 pt-2 text-[11px] font-semibold text-fox-navy uppercase tracking-wide">
              {m.n}. {tx(m.title, lang)}
            </div>
            <div className="p-1 space-y-0.5">
              {m.lessons.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setPane({ k: 'lesson', id: l.id })}
                  className={`w-full text-left px-2 py-1 text-xs flex items-start gap-1.5 ${(pane.k === 'lesson' || pane.k === 'quiz') && pane.id === l.id ? 'bg-fox-navy text-white' : 'hover:bg-white'}`}
                  data-testid={`th-l-${l.id}`}
                >
                  <span className="w-3.5 shrink-0 mt-px">{s.read[l.id] ? <CheckCircle2 size={13} className={(s.quizBest[l.id] ?? 0) >= 80 ? 'text-fox-ok' : 'text-gray-400'} /> : '•'}</span>
                  <span className="flex-1">{tx(l.title, lang)}</span>
                  {s.quizBest[l.id] !== undefined && <span className="opacity-70">{s.quizBest[l.id]}%</span>}
                </button>
              ))}
              <button
                onClick={() => setPane({ k: 'exam', m: m.id })}
                className={`w-full text-left px-2 py-1 text-xs flex items-center gap-1.5 ${pane.k === 'exam' && pane.m === m.id ? 'bg-fox-navy text-white' : 'hover:bg-white text-fox-navy'}`}
                data-testid={`th-exam-${m.id}`}
              >
                <Trophy size={12} /> {T('Экзамен по модулю', 'Module exam')}
                {s.examBest[m.id] !== undefined && <span className="ml-auto opacity-70">{s.examBest[m.id]}%</span>}
              </button>
            </div>
          </div>
        ))}
        <div className="border-t border-fox-edge/50 p-2 text-[11px] text-gray-600">
          <div className="font-semibold uppercase tracking-wide mb-1">{T('Готовятся', 'Coming next')}</div>
          {PLANNED.map((p) => (
            <div key={p.n}>
              {p.n}. {p.title}
            </div>
          ))}
        </div>
      </aside>

      <main id="theory-main" className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6">
        {pane.k === 'home' && <Home lessonsRead={lessonsRead} lessonsTotal={lessonsTotal} due={due.length} go={setPane} />}
        {pane.k === 'lesson' && lessonById(pane.id) && <LessonView l={lessonById(pane.id)!} go={setPane} />}
        {pane.k === 'quiz' && lessonById(pane.id) && (
          <div className="space-y-3">
            <button className="text-xs text-fox-navy underline" onClick={() => setPane({ k: 'lesson', id: pane.id })}>
              ← {T('к уроку', 'back to lesson')}
            </button>
            <Quiz key={pane.id} title={T('Тест: ', 'Quiz: ') + tx(lessonById(pane.id)!.title, lang)} questions={lessonById(pane.id)!.quiz} onDone={(p) => s.quizDone(pane.id, p, 'quiz')} />
          </div>
        )}
        {pane.k === 'exam' && <Exam key={pane.m} m={MODULES.find((m) => m.id === pane.m)!} />}
        {pane.k === 'final' && <Final />}
        {pane.k === 'review' && <Review ids={due} />}
        {pane.k === 'interview' && <Interview />}
        {pane.k === 'glossary' && <Glossary />}
      </main>
    </div>
  )
}

function NavBtn({ on, onClick, icon, children, testid }: { on: boolean; onClick: () => void; icon: ReactNode; children: ReactNode; testid?: string }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-2 py-1.5 flex items-center gap-2 ${on ? 'bg-fox-navy text-white' : 'hover:bg-white'}`} data-testid={testid}>
      {icon}
      <span className="flex-1">{children}</span>
    </button>
  )
}

function Home({ lessonsRead, lessonsTotal, due, go }: { lessonsRead: number; lessonsTotal: number; due: number; go: (p: Pane) => void }) {
  const { lang } = useLang()
  const T = (ru: string, en: string) => (lang === 'ru' ? ru : en)
  const s = useTheory()
  const next = MODULES.flatMap((m) => m.lessons).find((l) => !s.read[l.id])
  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-xl font-semibold text-fox-navy">{T('Теория Foxboro DCS', 'Foxboro DCS theory')}</h2>
      <Md
        src={T(
          `Курс построен так, чтобы вы могли говорить со специалистами Foxboro на их языке. Каждый урок идёт по одной схеме:
1. **База** — суть без привязки к версии.
2. **Как было** — I/A Series V8 (курс 2001V8).
3. **Как сейчас** — EcoStruxure Foxboro DCS.
4. **Как говорят на объекте** — термины и фразы.
5. **Практика** — кнопка открывает нужный экран тренажёра.
6. **Тест** — 5–9 вопросов. Ошибки возвращаются на повторение через 1, 3 и 7 дней.

После модуля — **экзамен по модулю**, в конце — **итоговый экзамен**. Режим **«Собеседование»** задаёт вопросы как опытный инженер: отвечайте своими словами, тренажёр покажет, какие ключевые пункты вы назвали.`,
          `Each lesson follows the same pattern: fundamentals, then the classic I/A Series V8 way, then the modern EcoStruxure Foxboro DCS way, site vocabulary, a practice link into the simulator and a quiz. Mistakes come back for review after 1, 3 and 7 days. Most lesson texts are in Russian for now; Foxboro terms are in English.`,
        )}
      />
      <div className="grid sm:grid-cols-3 gap-2 text-sm">
        <Stat label={T('Уроков пройдено', 'Lessons read')} value={`${lessonsRead} / ${lessonsTotal}`} />
        <Stat label={T('Экзаменов сдано (≥80 %)', 'Exams passed (≥80%)')} value={`${MODULES.filter((m) => (s.examBest[m.id] ?? 0) >= 80).length} / ${MODULES.length}`} />
        <Stat label={T('На повторение сегодня', 'Due for review')} value={String(due)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {next && (
          <button className="btn btn-on !text-sm !px-3 !py-1.5" onClick={() => go({ k: 'lesson', id: next.id })} data-testid="th-continue">
            <Play size={13} /> {T('Продолжить: ', 'Continue: ')}
            {tx(next.title, lang)}
          </button>
        )}
        {due > 0 && (
          <button className="btn !text-sm !px-3 !py-1.5" onClick={() => go({ k: 'review' })}>
            <RefreshCcw size={13} /> {T('Повторить ошибки', 'Review mistakes')}
          </button>
        )}
      </div>
      <div className="text-xs text-gray-600">
        {T(
          'Источники: курс 2001V8 «I/A Series Configuration Essentials» (V8.x) и открытые описания EcoStruxure Foxboro DCS. Места, где детали зависят от версии, помечены «смотрите руководство».',
          'Sources: course 2001V8 (I/A Series V8.x) and public EcoStruxure Foxboro DCS descriptions.',
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-2">
      <div className="text-[11px] text-gray-600">{label}</div>
      <div className="text-lg font-semibold font-mono">{value}</div>
    </div>
  )
}

function usePractice() {
  const go = useNav((s) => s.go)
  return (p: Practice) => {
    if (p.exercise) useTopology.getState().loadExercise(p.exercise)
    if (p.preset) useTopology.getState().loadPreset(p.preset)
    if (p.scenario && useEng.getState().scenario !== p.scenario) useEng.getState().loadScenario(p.scenario)
    go(p.view)
  }
}

function LessonView({ l, go }: { l: Lesson & { module: Module }; go: (p: Pane) => void }) {
  const { lang } = useLang()
  const T = (ru: string, en: string) => (lang === 'ru' ? ru : en)
  const s = useTheory()
  const practice = usePractice()
  const all = MODULES.flatMap((m) => m.lessons)
  const idx = all.findIndex((x) => x.id === l.id)
  const nextL = all[idx + 1]
  const english = lang === 'en' && ruOnly(l.base)
  return (
    <article className="max-w-3xl space-y-4" data-testid="lesson">
      <div>
        <div className="text-xs text-gray-600">
          {T('Модуль', 'Module')} {l.module.n} · {tx(l.module.title, lang)} · ~{l.minutes} {T('мин', 'min')}
        </div>
        <h2 className="text-xl font-semibold text-fox-navy">{tx(l.title, lang)}</h2>
        {l.module.lessons[0].id === l.id && <p className="text-sm text-gray-700 mt-1 italic">{tx(l.module.goal, lang)}</p>}
        {english && <div className="md-note text-xs mt-2">This lesson is written in Russian; an English version is planned. Foxboro terms are already in English.</div>}
      </div>
      {SECTIONS.map((sec) =>
        l[sec.key] ? (
          <section key={sec.key} className="bg-white border border-fox-edge/50">
            <div className={`px-3 py-1 text-xs font-semibold uppercase tracking-wide ${sec.cls}`}>{lang === 'ru' ? sec.ru : sec.en}</div>
            <div className="p-3">
              <Md src={tx(l[sec.key], lang)} />
            </div>
          </section>
        ) : null,
      )}
      {l.practice && (
        <section className="bg-white border border-fox-edge/50">
          <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-fox-cyan text-white">{T('Практика в тренажёре', 'Practice in the simulator')}</div>
          <div className="p-3 flex flex-col gap-1.5">
            {l.practice.map((p, i) => (
              <button key={i} className="btn justify-start !text-sm" onClick={() => practice(p)}>
                <ChevronRight size={13} /> {tx(p.label, lang)}
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="flex flex-wrap gap-2 items-center border-t border-fox-edge pt-3">
        <button
          className="btn btn-on !text-sm !px-3 !py-1.5"
          onClick={() => {
            s.markRead(l.id)
            go({ k: 'quiz', id: l.id })
          }}
          data-testid="lesson-quiz"
        >
          {T('Пройти тест', 'Take the quiz')} ({l.quiz.length})
        </button>
        {nextL && (
          <button
            className="btn !text-sm !px-3 !py-1.5"
            onClick={() => {
              s.markRead(l.id)
              go({ k: 'lesson', id: nextL.id })
            }}
          >
            {T('Следующий урок', 'Next lesson')} →
          </button>
        )}
        {s.quizBest[l.id] !== undefined && (
          <span className="text-xs text-gray-600">
            {T('лучший результат', 'best')} {s.quizBest[l.id]}%
          </span>
        )}
      </div>
    </article>
  )
}

function Exam({ m }: { m: Module }) {
  const { lang } = useLang()
  const done = useTheory((s) => s.quizDone)
  const qs = useMemo(() => m.lessons.flatMap((l) => l.quiz), [m])
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-fox-navy">
        {lang === 'ru' ? 'Экзамен: ' : 'Exam: '}
        {m.n}. {tx(m.title, lang)}
      </h2>
      <p className="text-xs text-gray-600">{lang === 'ru' ? `Все вопросы модуля в случайном порядке. Зачёт — 80 %.` : 'All module questions in random order. Pass mark 80%.'}</p>
      <Quiz title={tx(m.title, lang)} questions={qs} shuffleQ onDone={(p) => done(m.id, p, 'exam')} />
    </div>
  )
}

function Final() {
  const { lang } = useLang()
  const done = useTheory((s) => s.quizDone)
  // 3 random questions from every lesson
  const qs = useMemo(() => MODULES.flatMap((m) => m.lessons.flatMap((l) => shuffle(l.quiz).slice(0, 3))), [])
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-fox-navy">{lang === 'ru' ? 'Итоговый экзамен' : 'Final exam'}</h2>
      <p className="text-xs text-gray-600">
        {lang === 'ru' ? `${qs.length} вопросов: по 3 случайных из каждого урока. Зачёт — 80 %.` : `${qs.length} questions, 3 random ones from each lesson. Pass mark 80%.`}
      </p>
      <Quiz title={lang === 'ru' ? 'Итоговый' : 'Final'} questions={qs} shuffleQ onDone={(p) => done('final', p, 'exam')} />
    </div>
  )
}

function Review({ ids }: { ids: string[] }) {
  const { lang } = useLang()
  const [frozen] = useState(ids)
  const qs = frozen.map(questionById).filter(Boolean) as Question[]
  if (!qs.length)
    return (
      <div className="max-w-2xl space-y-2">
        <h2 className="text-lg font-semibold text-fox-navy">{lang === 'ru' ? 'Повторение' : 'Review'}</h2>
        <p className="text-sm">
          {lang === 'ru'
            ? 'Сейчас повторять нечего. Вопросы, на которых вы ошиблись, появятся здесь через 1 день, затем через 3 и 7 дней. Ответили верно три раза подряд — вопрос считается выученным.'
            : 'Nothing is due. Questions you got wrong come back after 1, 3 and 7 days.'}
        </p>
        <p className="text-xs text-gray-600">
          {lang === 'ru' ? 'В очереди всего: ' : 'Queued in total: '}
          {Object.keys(useTheory.getState().srs).length} · {lang === 'ru' ? 'всего вопросов в курсе: ' : 'questions in the course: '}
          {ALL_QUESTIONS.length}
        </p>
      </div>
    )
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-fox-navy">{lang === 'ru' ? 'Повторение ошибок' : 'Review mistakes'}</h2>
      <Quiz title={lang === 'ru' ? 'Повторение' : 'Review'} questions={qs} shuffleQ />
    </div>
  )
}

function Interview() {
  const { lang } = useLang()
  const T = (ru: string, en: string) => (lang === 'ru' ? ru : en)
  const s = useTheory()
  const [i, setI] = useState(0)
  const [text, setText] = useState('')
  const [shown, setShown] = useState(false)
  const q = ALL_INTERVIEW[i]
  const cov = coveredPoints(q.points, text)
  const pct = Math.round((cov.filter(Boolean).length / q.points.length) * 100)
  const goTo = (n: number) => {
    setI((n + ALL_INTERVIEW.length) % ALL_INTERVIEW.length)
    setText('')
    setShown(false)
  }
  return (
    <div className="max-w-3xl space-y-3" data-testid="interview">
      <h2 className="text-lg font-semibold text-fox-navy">{T('Собеседование', 'Interview mode')}</h2>
      <p className="text-xs text-gray-600">
        {T(
          'Вопрос как от опытного инженера Foxboro. Ответьте своими словами (текстом или вслух, потом кратко запишите), затем нажмите «Сравнить». Тренажёр ищет в ответе ключевые понятия; сверяйтесь и с эталонным ответом.',
          'A question as an experienced Foxboro engineer would ask it. Answer in your own words, then compare with the key points and the model answer.',
        )}
      </p>
      <div className="flex items-center gap-2 text-xs">
        <button className="btn" onClick={() => goTo(i - 1)}>
          ←
        </button>
        <span>
          {i + 1} / {ALL_INTERVIEW.length} · {T('модуль', 'module')} {q.module.n}
        </span>
        <button className="btn" onClick={() => goTo(i + 1)}>
          →
        </button>
        {s.interviewBest[q.id] !== undefined && (
          <span className="text-gray-600">
            {T('лучший', 'best')} {s.interviewBest[q.id]}%
          </span>
        )}
      </div>
      <div className="bg-white border-l-4 border-fox-navy p-3 text-[15px] font-medium">{tx(q.q, lang)}</div>
      <textarea className="field !text-sm !font-sans h-36" value={text} onChange={(e) => setText(e.target.value)} placeholder={T('Ваш ответ…', 'Your answer…')} data-testid="iv-text" />
      <button
        className="btn btn-on"
        disabled={!text.trim()}
        onClick={() => {
          setShown(true)
          s.interviewDone(q.id, pct)
        }}
        data-testid="iv-compare"
      >
        {T('Сравнить', 'Compare')}
      </button>
      {shown && (
        <div className="space-y-2" data-testid="iv-result">
          <div className="font-semibold">
            {T('Названо ключевых пунктов: ', 'Key points covered: ')}
            {cov.filter(Boolean).length} / {q.points.length} ({pct}%)
          </div>
          <ul className="space-y-1 text-sm">
            {q.points.map((p, j) => (
              <li key={j} className="flex gap-1.5 items-start">
                {cov[j] ? <CheckCircle2 size={15} className="text-fox-ok shrink-0 mt-0.5" /> : <span className="w-[15px] h-[15px] border border-gray-400 shrink-0 mt-0.5" />}
                {tx(p.t, lang)}
              </li>
            ))}
          </ul>
          <div className="md-tip text-sm">
            <b>{T('Эталонный ответ: ', 'Model answer: ')}</b>
            {tx(q.model, lang)}
          </div>
        </div>
      )}
    </div>
  )
}

function Glossary() {
  const { lang } = useLang()
  const T = (ru: string, en: string) => (lang === 'ru' ? ru : en)
  const [f, setF] = useState('')
  const rows = GLOSSARY.filter((g) => !f || [g.term, g.old, g.now, tx(g.def, lang)].some((x) => x?.toLowerCase().includes(f.toLowerCase())))
  const changed = rows.filter((g) => g.old || g.now)
  const terms = rows.filter((g) => !g.old && !g.now)
  return (
    <div className="max-w-4xl space-y-3 md" data-testid="glossary">
      <h2 className="text-lg font-semibold text-fox-navy">{T('Глоссарий', 'Glossary')}</h2>
      <input className="field !w-72 !text-sm" placeholder={T('Поиск…', 'Search…')} value={f} onChange={(e) => setF(e.target.value)} />
      <h4>{T('Старое ↔ новое: шпаргалка для разговора', 'Old ↔ new: cheat sheet')}</h4>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>{T('Что', 'What')}</th>
              <th>I/A Series V8</th>
              <th>EcoStruxure Foxboro DCS</th>
              <th>{T('Пояснение', 'Note')}</th>
            </tr>
          </thead>
          <tbody>
            {changed.map((g) => (
              <tr key={g.term}>
                <td className="whitespace-nowrap">{g.term}</td>
                <td>
                  <b>{g.old ?? '—'}</b>
                </td>
                <td>
                  <b>{g.now ?? '—'}</b>
                </td>
                <td>{tx(g.def, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4>{T('Термины', 'Terms')}</h4>
      <div className="overflow-x-auto">
        <table>
          <tbody>
            {terms.map((g) => (
              <tr key={g.term}>
                <td className="whitespace-nowrap font-semibold">{g.term}</td>
                <td>{tx(g.def, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
