import { M1 } from './modules/m1-history'
import { M2 } from './modules/m2-network'
import { M3 } from './modules/m3-controllers'
import { M4 } from './modules/m4-io'
import { M5 } from './modules/m5-naming'
import { M6 } from './modules/m6-concepts'
import { M7 } from './modules/m7-blocks'
import type { GlossaryEntry, Lesson, Module, Question, Tx } from './types'

export const MODULES: Module[] = [M1, M2, M3, M4, M5, M6, M7]

/** Modules in the programme that are not written yet. */
export const PLANNED: { n: number; title: string }[] = [
  { n: 8, title: 'Исполнение и состояния: Hold/Track, OOS, BAD, статусы' },
  { n: 9, title: 'Тревоги и Alarm Management: от CAD до Alarm Window, ISA-18.2' },
  { n: 10, title: 'Последовательности: HLBL, SFC, batch-фазы' },
  { n: 11, title: 'Инжиниринг: IACC/ICC → Control Editors, Galaxy, Deploy, Checkpoint' },
  { n: 12, title: 'HMI: FoxView/FoxDraw → Control HMI, Framer, права' },
  { n: 13, title: 'Тренды и история' },
  { n: 14, title: 'System Management: System Manager, SMON-домены' },
  { n: 15, title: 'System Definition: Commit, Install, хосты' },
  { n: 16, title: 'Интеграция и безопасность: FDC280, Triconex, IEC 62443, FAT/SAT' },
]

export const tx = (t: Tx | undefined, lang: 'ru' | 'en') => (t === undefined ? '' : typeof t === 'string' ? t : t[lang])
/** true when the text has no English version yet */
export const ruOnly = (t: Tx | undefined) => typeof t === 'string'

export const ALL_LESSONS: (Lesson & { module: Module })[] = MODULES.flatMap((m) => m.lessons.map((l) => ({ ...l, module: m })))
export const lessonById = (id?: string) => ALL_LESSONS.find((l) => l.id === id)
export const ALL_QUESTIONS: (Question & { lesson: string })[] = ALL_LESSONS.flatMap((l) => l.quiz.map((q) => ({ ...q, lesson: l.id })))
export const questionById = (id: string) => ALL_QUESTIONS.find((q) => q.id === id)
export const ALL_INTERVIEW = ALL_LESSONS.flatMap((l) => (l.interview ?? []).map((q) => ({ ...q, lesson: l.id, module: l.module })))

/** Is the answer right? `given` is index / indexes / boolean / number. */
export function isRight(q: Question, given: number | number[] | boolean | undefined): boolean {
  if (given === undefined) return false
  switch (q.kind) {
    case 'single':
      return given === q.answer
    case 'tf':
      return given === q.answer
    case 'num':
      return typeof given === 'number' && Math.abs(given - (q.answer as number)) <= (q.tol ?? 1e-9)
    case 'multi': {
      const a = [...(q.answer as number[])].sort().join(',')
      const g = Array.isArray(given) ? [...given].sort().join(',') : ''
      return a === g
    }
  }
}

/** Which key points an interview answer covers (keyword match, case-insensitive). */
export function coveredPoints(points: { kw: string[] }[], answer: string): boolean[] {
  const a = answer.toLowerCase().replace(/ё/g, 'е')
  return points.map((p) => p.kw.some((k) => a.includes(k.toLowerCase().replace(/ё/g, 'е'))))
}

/** Fisher–Yates with a seedable random (tests pass their own). */
export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'Control network', old: 'MESH Control Network', now: 'PCN (Process Control Network)', def: 'Коммутируемый Ethernet с резервированием A/B и RSTP, связывающий станции и CP.', module: 'm2' },
  { term: 'Old network', old: 'Nodebus', now: '— (через ATS)', def: 'Шина станций до V8. Подключается к MESH через ATS.', module: 'm2' },
  { term: 'Controller', old: 'FCP270 / ZCP270', now: 'FCP280 / FDC280', def: 'Control Processor, где выполняются блоки.', module: 'm3' },
  { term: 'Engineering tool', old: 'IACC (CSD), ICC', now: 'Control Editors (Strategy Editor, Galaxy)', def: 'Где создаются compounds, блоки и связи.', module: 'm6' },
  { term: 'Diagram', old: 'CSD (Control Strategy Diagram)', now: 'Strategy', def: 'Рисунок блоков и связей. Strategy поддерживает шаблоны и вложенность.', module: 'm6' },
  { term: 'Load to CP', old: 'Download (Validate & Download)', now: 'Deploy', def: 'Передача изменений базы в контроллер.' },
  { term: 'Config database', old: 'IACC database / ICC', now: 'Galaxy (Galaxy Repository)', def: 'Где хранится конфигурация управления.' },
  { term: 'Operator HMI', old: 'FoxView', now: 'Control HMI (InTouch)', def: 'Мнемосхемы, faceplates, тревоги, тренды.' },
  { term: 'Graphics builder', old: 'FoxDraw', now: 'WindowMaker / Window Construction', def: 'Редактор мнемосхем.' },
  { term: 'Navigation', old: 'FoxSelect, display bar', now: 'Framer, Navigation Browser, Block Select Browser', def: 'Как оператор находит дисплеи и блоки.' },
  { term: 'Alarm display', old: 'Alarm Manager / CAD', now: 'Alarm Window, Framer alarm panel', def: 'Текущие тревоги, квитирование, история.', module: 'm7' },
  { term: 'Block detail', old: 'Block Detail Display', now: 'Detail Display / Detail View', def: 'Все параметры одного блока.' },
  { term: 'System health', old: 'SMDH / System Management Displays', now: 'System Manager', def: 'Состояние станций, модулей, сети; системные тревоги.' },
  { term: 'System config', old: 'System Definition (Commit diskette)', now: 'System Definition (Commit + Install)', def: 'Описание станций, хостов, пакетов ПО и доменов SMON.' },
  { term: 'Core software', old: 'I/A Series software', now: 'Control Core Services (CCS)', def: 'Ядро системы: CP, блоки, сеть, тревоги.', module: 'm1' },
  { term: 'Workstation roles', old: 'AW / WP', now: 'EWS / OWS / серверы', def: 'AW хранит базы и хостит CP; WP — только оператор.', module: 'm2' },
  { term: 'Letterbug', def: '6-символьное уникальное имя станции или модуля.', module: 'm5' },
  { term: 'Checkpoint', def: 'Сохранённая копия базы CP на хосте (и во flash). Из неё CP загружается.', module: 'm2' },
  { term: 'BPC', def: 'Basic Processing Cycle — такт CP, по умолчанию 0,5 с.', module: 'm3' },
  { term: 'FT pair', def: 'Отказоустойчивая пара CP: два модуля выполняют одну программу, одна станция.', module: 'm3' },
  { term: 'Self-hosting', def: 'CP хранит checkpoint во flash и загружается без хоста (с V8.4; по умолчанию выключен).', module: 'm3' },
  { term: 'FBM', def: 'Fieldbus Module — модуль ввода-вывода 200-й серии.', module: 'm4' },
  { term: 'TA', def: 'Termination Assembly — клеммная сборка для полевых кабелей.', module: 'm4' },
  { term: 'ECB', def: 'Equipment Control Block — блок, представляющий FBM в CP.', module: 'm4' },
  { term: 'Edge I/O (UIO, SCM)', now: 'Edge I/O', def: 'Новое поколение ввода-вывода с универсальными каналами.', module: 'm4' },
  { term: 'FEM100', def: 'Модуль расширения fieldbus FCP270 до 128 FBM.', module: 'm3' },
  { term: 'FCM100Et', def: 'Коммуникационный модуль между ZCP270 (по Ethernet) и FBM.', module: 'm3' },
  { term: 'ATS', def: 'Address Translation Station — мост Nodebus ↔ MESH.', module: 'm2' },
  { term: 'FDSI', def: 'Field Device Systems Integrator — FBM230–233 для внешних устройств.', module: 'm4' },
  { term: 'RSTP', def: 'Rapid Spanning Tree Protocol: убирает петли, быстро переключает путь; лимит 7 коммутаторов.', module: 'm2' },
  { term: 'Compound', def: 'Логическая группа блоков, уникальное имя в сети, выполняется в одном CP.', module: 'm6' },
  { term: 'Connectable / Settable / Secured', def: 'Можно связать / можно изменить с дисплея / связан и защищён от ручного изменения.', module: 'm6' },
  { term: 'PERIOD / PHASE', def: 'Индекс периода выполнения (1 = 0,5 с, 3 = 2 с) и сдвиг по тактам.', module: 'm6' },
  { term: 'INITMA / INITLR / INITON', def: 'Режим блока, задания и compound после инициализации (0/1/2 = из checkpoint).', module: 'm6' },
  { term: 'BCALCI / BCALCO / FBK', def: 'Обратный расчёт и внешняя обратная связь интеграла (anti-windup, безударность).', module: 'm7' },
  { term: 'MA / LR', def: 'Manual/Auto и Local/Remote; MANSW > AUTSW, LOCSW > REMSW.', module: 'm7' },
  { term: 'CINHIB', def: 'Подавление тревог compound с приоритетом ≥ значения.', module: 'm7' },
  { term: 'PIN / DMZ', now: 'PIN', def: 'Информационная сеть завода, отделённая от PCN межсетевыми экранами.', module: 'm2' },
  { term: 'HLBL', def: 'High Level Batch Language — язык последовательных блоков (IND, DEP, EXC, MON).' },
  { term: 'SFC', now: 'FoxSFC / Sequence Block SFC Editor', def: 'Последовательности в виде шагов и переходов.' },
]
