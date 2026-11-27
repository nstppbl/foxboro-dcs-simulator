import { M1 } from './modules/m1-history'
import { M2 } from './modules/m2-network'
import { M3 } from './modules/m3-controllers'
import { M4 } from './modules/m4-io'
import { M5 } from './modules/m5-naming'
import { M6 } from './modules/m6-concepts'
import { M7 } from './modules/m7-blocks'
import { M8 } from './modules/m8-hlbl'
import { M9 } from './modules/m9-testing'
import { O1 } from './ops/o1-hardware'
import { O2 } from './ops/o2-software'
import { O3 } from './ops/o3-workstation'
import { O4 } from './ops/o4-alarms'
import { O5 } from './ops/o5-control'
import { O6 } from './ops/o6-trends'
import { O7 } from './ops/o7-reports'
import { O8 } from './ops/o8-failures'
import { H1 } from './hlbl/h1-structure'
import { H2 } from './hlbl/h2-statements'
import { H3 } from './hlbl/h3-blocks'
import { H4 } from './hlbl/h4-phases'
import { H5 } from './hlbl/h5-testing'
import type { CourseId, GlossaryEntry, Lesson, Module, Question, Tx } from './types'

export const MODULES: Module[] = [M1, M2, M3, M4, M5, M6, M7, M8, M9, O1, O2, O3, O4, O5, O6, O7, O8, H1, H2, H3, H4, H5]

export const COURSES: { id: CourseId; prefix: string; title: Tx; desc: Tx }[] = [
  {
    id: 'eng',
    prefix: '',
    title: { ru: 'Инженер I/A Series', en: 'I/A Series engineer' },
    desc: { ru: 'Архитектура, CP, I/O, имена, блоки, конфигурирование, HLBL-обзор, тестирование и GMP (курс 2001V8).', en: 'Architecture, CPs, I/O, naming, blocks, configuration, HLBL overview, testing and GMP (course 2001V8).' },
  },
  {
    id: 'ops',
    prefix: 'O',
    title: { ru: 'Оператор: 2300v8 Process Operations', en: 'Operator: 2300v8 Process Operations' },
    desc: {
      ru: 'Курс оператора по презентациям 2300v8 + обзоры Hardware и Software: FoxView, тревоги, faceplates, тренды, FoxSelect и отчёты, System Manager и отказы.',
      en: 'Operator course from the 2300v8 decks plus Hardware and Software overviews: FoxView, alarms, faceplates, trends, FoxSelect and reports, System Manager and failures.',
    },
  },
  {
    id: 'hlbl',
    prefix: 'H',
    title: { ru: 'HLBL — языки последовательностей', en: 'HLBL — sequence programming' },
    desc: {
      ru: 'Отдельный курс HLBL: структура программы, операторы, блоки IND/DEP/EXC/MON/TIM, batch-фазы ISA-88, отладка и тестирование, 6 лаб с автопроверкой на реакторе R-401.',
      en: 'Dedicated HLBL course: program layout, statements, IND/DEP/EXC/MON/TIM blocks, ISA-88 phases, debugging and testing, 6 auto-graded labs on reactor R-401.',
    },
  },
]
export const courseOf = (m: Module): CourseId => m.course ?? 'eng'
/** module label as shown in the UI: 7, O3, H2 */
export const moduleNo = (m: Module) => `${COURSES.find((c) => c.id === courseOf(m))!.prefix}${m.n}`

/** Modules in the programme that are not written yet. */
export const PLANNED: { n: number; title: string }[] = [
  { n: 10, title: 'I/A-конфигурирование глубоко: IACC/ICC, Download, Compare/Upload, Checkpoint' },
  { n: 11, title: 'P&ID и control narrative → конфигурация; как писать FDS и DDS' },
  { n: 12, title: 'Состояния блоков: Hold/Track, OOS, BAD, статусы' },
  { n: 13, title: 'Alarm Management для инженера (ISA-18.2, рационализация); операторская часть — в курсе 2300v8' },
  { n: 14, title: 'FoxDraw: построение мнемосхем (работа в FoxView — в курсе 2300v8)' },
  { n: 16, title: 'Интеграция и безопасность: FDC280, SIS, кибербезопасность' },
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
  {
    term: 'IND / DEP / EXC / MON / TIM',
    def: 'Блоки последовательностей: супервизор / нормальные операции / альтернативная (аварийная) стратегия / мониторинг ненормальных условий / таймеры (4 в блоке).',
    module: 'm8',
  },
  { term: 'SSTATE', def: 'Состояние последовательностей compound: 0 все неактивны, 1 активны MON/IND/DEP без EXC, 2 активен EXC.', module: 'm8' },
  { term: 'PLB', def: 'Ladder logic, выполняется в дискретном FBM; PLB — интерфейс в CP.', module: 'm8' },
  { term: 'ISA-88', def: 'Стандарт batch: рецепт → процедура → операция → фаза; состояния и команды фаз.', module: 'm8' },
  { term: 'URS / FDS / DDS', def: 'Требования пользователя / функциональная спецификация / детальная спецификация реализации в Foxboro.', module: 'm9' },
  { term: 'FAT / SAT', def: 'Приёмочные испытания на стенде интегратора / на объекте.', module: 'm9' },
  { term: 'IQ / OQ / PQ', def: 'Квалификация установки / функционирования / эксплуатационная (на процессе).', module: 'm9' },
  { term: 'Loop check', def: 'Проверка каждого сигнала от прибора до HMI (4/8/12/16/20 мА).', module: 'm9' },
  { term: 'GAMP 5', def: 'Руководство по валидации компьютеризированных систем; V-модель, категории ПО (4 — конфигурируемое, 5 — заказное).', module: 'm9' },
  { term: 'Change control', def: 'Порядок изменений валидированной системы: запрос → оценка влияния → утверждение → реализация → тест → закрытие.', module: 'm9' },
  { term: 'Deviation', def: 'Отклонение: запись о несоответствии (например, тест не прошёл) с расследованием и исправлением.', module: 'm9' },
  { term: 'Audit trail', def: 'Журнал изменений: кто, когда, что, старое и новое значение (21 CFR Part 11, Annex 11).', module: 'm9' },
  { term: 'ALCOA+', def: 'Принципы целостности данных: Attributable, Legible, Contemporaneous, Original, Accurate + полные, последовательные, долговечные, доступные.', module: 'm9' },
  { term: 'Environment', def: 'Окружение FoxView: Initial, Operator, Process_Eng, Softw_Eng; смена Ctrl+E, вход по паролю.', module: 'o3' },
  { term: 'Display bar', def: 'Панель кнопок слева в FoxView (8 или 18 кнопок) для частых дисплеев.', module: 'o3' },
  { term: 'Annunciator Keyboard', def: 'Панель с кнопками дисплеев, лампами тревог по участкам и сиреной.', module: 'o3' },
  { term: 'CAD', old: 'Current Alarms Display', now: 'Alarm Window', def: 'Текущие тревоги: неквитированные → квитированные → ушедшие неквитированные; Ack, Top Priority, Block Detail.', module: 'o4' },
  { term: 'AHD', old: 'Alarm History Display', def: 'История тревог: хронология, две записи на тревогу (возврат — R), без квитирования.', module: 'o4' },
  { term: 'Deadband (HLDB)', def: 'Зона, в которой состояние тревоги не меняется; возврат в норму только после прохода зоны.', module: 'o4' },
  { term: 'OSV', def: 'Output Span Variance: запас за шкалой для Range-тревоги; похож на deadband, работает иначе.', module: 'o4' },
  { term: 'CAG', def: 'Common Alarm Group — сирена панели аннунциатора, глушится с любой станции группы.', module: 'o4' },
  { term: 'Hold / Track', def: 'Hold — выход заморожен (например, BAD измерение); Track — выход следует внешнему сигналу.', module: 'o5' },
  { term: 'Scratchpad', def: 'Группы и тренды, которые оператор собирает сам на лету (до 20 трендов), без FoxDraw.', module: 'o6' },
  { term: 'Pause & Pick', def: 'Пауза тренда и линия времени для чтения значений в любой точке.', module: 'o6' },
  { term: 'Process Summary Report', def: 'Отчёт FoxSelect (Configure Report): 9 типов — off-scan, in alarm, inhibited, not in control, in manual, bad I/O.', module: 'o7' },
  { term: 'AIM*AT / AIM*Historian', def: 'Historian I/A: история точек для трендов и тревог.', module: 'o2' },
  { term: 'check_db_sync', def: 'Утилита: расхождения между checkpoint, CSA и рабочей базой ICC.', module: 'o2' },
  { term: 'MTK', def: 'Master Timekeeper — AW, задающая время системы (возможно от GPS).', module: 'o8' },
  { term: 'System Manager colours', def: 'Чёрный OK, красный отказ/off-line, жёлтый — проблема периферии, серый — нет связи, * — неквитировано.', module: 'o8' },
  { term: 'USER_LABELS', def: 'Секция HLBL: имена для параметров (VOL_SP : RI0001).', module: 'h1' },
  { term: 'BI0001 / RI0001 / RO0001', def: 'Пользовательские параметры блока последовательности: булевы, вещественные, целые входы и выходы.', module: 'h1' },
  { term: 'B0400DF', def: 'HLBL User\'s Guide — руководство по языку HLBL.', module: 'h1' },
  { term: 'Permissives', def: 'Условия старта фазы; если не выполнены — фаза ничего не трогает и выходит.', module: 'h4' },
  { term: 'Hold / Restart / Abort', def: 'Команды фазы ISA-88: пауза с продолжением / продолжение с шага / безопасный останов без продолжения.', module: 'h4' },
  { term: 'HLBL', def: 'High Level Batch Language — язык последовательных блоков (IND, DEP, EXC, MON).' },
  { term: 'SFC', now: 'FoxSFC / Sequence Block SFC Editor', def: 'Последовательности в виде шагов и переходов.' },
]
