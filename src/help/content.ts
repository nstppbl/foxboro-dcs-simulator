import type { Bilingual } from "../domain/hardware/catalog";

export interface HelpDoc {
  title: Bilingual;
  /** what it is / what it does */
  what: Bilingual;
  /** how it works, step by step */
  how?: Bilingual[];
  /** the parameters that matter most */
  keys?: string[];
  /** typical use */
  use?: Bilingual;
  /** frequent mistakes */
  pitfalls?: Bilingual[];
  /** manual 2001V8 pages */
  src?: string;
  /** "try it" hint inside the simulator */
  tryIt?: Bilingual;
}

const b = (en: string, ru: string): Bilingual => ({ en, ru });

/** Block type help. Parameter names stay in English in both languages. */
export const BLOCK_HELP: Record<string, HelpDoc> = {
  AIN: {
    title: b("AIN — Analog Input", "AIN — Analog Input (аналоговый вход)"),
    what: b(
      "Brings one analog measurement into the control strategy: reads an FBM channel (or another block), converts it to engineering units and checks its quality.",
      "Вводит одно аналоговое измерение в стратегию управления: читает канал FBM (или другой блок), переводит в инженерные единицы и проверяет качество сигнала.",
    ),
    how: [
      b(
        "IOMOPT = 1: reads channel PNT_NO of the FBM named in IOM_ID (through its ECB).",
        "IOMOPT = 1: читает канал PNT_NO модуля FBM, указанного в IOM_ID (через его ECB).",
      ),
      b(
        "Signal conditioning SCI converts raw counts (e.g. 4-20 mA) to 0-100 %, then HSCO1/LSCO1 scale it to engineering units EO1.",
        "Преобразование SCI переводит сырые counts (например, 4-20 мА) в 0-100 %, затем HSCO1/LSCO1 масштабируют в инженерные единицы EO1.",
      ),
      b(
        "The result is PNT. Downstream blocks connect to :AIN.PNT.",
        "Результат — PNT. Следующие блоки подключаются к :AIN.PNT.",
      ),
      b(
        "If the channel fails, BAD is set and PNT keeps its last good value; other blocks see the BAD status.",
        "При отказе канала ставится BAD, а PNT сохраняет последнее хорошее значение; другие блоки видят статус BAD.",
      ),
    ],
    keys: [
      "IOMOPT",
      "IOM_ID",
      "PNT_NO",
      "SCI",
      "HSCO1",
      "LSCO1",
      "EO1",
      "PNT",
      "BAD",
      "HLOP",
      "HAL",
      "LAL",
      "BAO",
    ],
    use: b(
      "Every transmitter: level, temperature, pressure, flow.",
      "Любой датчик: уровень, температура, давление, расход.",
    ),
    pitfalls: [
      b(
        "HSCO1/LSCO1 must match the transmitter range, otherwise the controller sees a wrong value.",
        "HSCO1/LSCO1 должны совпадать с диапазоном датчика, иначе регулятор видит неверное значение.",
      ),
      b(
        "IOMOPT 0 or 2 means MEAS comes from a block link, not from the FBM.",
        "IOMOPT 0 или 2 — значение берётся из связи MEAS, а не из FBM.",
      ),
    ],
    src: "4-15, 4-33",
    tryIt: b(
      "In a scenario, open PROCESS and compare the true value with AIN.PNT; then change HSCO1 and watch PNT jump.",
      "В сценарии откройте ПРОЦЕСС и сравните истинное значение с AIN.PNT; затем измените HSCO1 и посмотрите, как прыгнет PNT.",
    ),
  },
  AOUT: {
    title: b("AOUT — Analog Output", "AOUT — Analog Output (аналоговый выход)"),
    what: b(
      "Sends a value (normally a controller OUT) to an FBM analog output, usually a control valve.",
      "Передаёт значение (обычно OUT регулятора) на аналоговый выход FBM, как правило на регулирующий клапан.",
    ),
    how: [
      b(
        "MEAS is linked from :PID.OUT. In Auto, OUT follows MEAS; in Manual the operator sets OUT.",
        "MEAS связан с :PID.OUT. В Auto OUT следует за MEAS; в Manual OUT задаёт оператор.",
      ),
      b(
        "BCALCO returns the actual output to the controller (BCALCI) so A/M transfers are bumpless.",
        "BCALCO возвращает фактический выход регулятору (BCALCI), чтобы переключения A/M были безударными.",
      ),
    ],
    keys: ["MEAS", "OUT", "MA", "BCALCO", "IOMOPT", "IOM_ID", "PNT_NO"],
    use: b(
      "Control valves, VFD speed references, split-range outputs.",
      "Регулирующие клапаны, задание частоты ЧРП, split-range выходы.",
    ),
    pitfalls: [
      b(
        "Forgetting PID.BCALCI ← AOUT.BCALCO: the controller does not know when the valve is in Manual.",
        "Забыть PID.BCALCI ← AOUT.BCALCO: регулятор не узнает, что клапан в Manual.",
      ),
    ],
    src: "4-17, 4-31",
  },
  DIN: {
    title: b("DIN — Digital Input", "DIN — Digital Input (дискретный вход)"),
    what: b(
      "Reads one contact (on/off) from a discrete FBM: limit switch, pump running feedback, level switch.",
      "Читает один контакт (вкл/выкл) с дискретного FBM: концевик, сигнал «насос работает», сигнализатор уровня.",
    ),
    keys: ["IOMOPT", "IOM_ID", "PNT_NO", "CIN", "INVCIN"],
    pitfalls: [
      b(
        'Normally-closed contacts need INVCIN = 1 to read "true = active".',
        "Для нормально замкнутых контактов нужен INVCIN = 1, чтобы «true = активно».",
      ),
    ],
    src: "4-16",
  },
  DOUT: {
    title: b(
      "DOUT — Digital Output",
      "DOUT — Digital Output (дискретный выход)",
    ),
    what: b(
      "Drives one discrete output: solenoid valve, motor starter. In Auto COUT follows IN; in Manual the operator sets COUT.",
      "Управляет одним дискретным выходом: электромагнитный клапан, пускатель двигателя. В Auto COUT следует за IN; в Manual COUT задаёт оператор.",
    ),
    keys: ["IN", "COUT", "MA", "IOM_ID", "PNT_NO"],
    use: b(
      "On/off valves (XV), pump start commands. Sequences (HLBL) write IN.",
      "Отсечные клапаны (XV), команды пуска насосов. Последовательности (HLBL) пишут IN.",
    ),
  },
  PID: {
    title: b(
      "PID — Proportional-Integral-Derivative controller",
      "PID — ПИД-регулятор",
    ),
    what: b(
      "Compares the measurement MEAS with the setpoint SPT and calculates the output OUT that drives the process back to setpoint.",
      "Сравнивает измерение MEAS с заданием SPT и вычисляет выход OUT, который возвращает процесс к заданию.",
    ),
    how: [
      b(
        "Error = SPT − MEAS (in % of span HSCI1-LSCI1). INCOPT 0 = reverse action (MEAS up → OUT down), 1 = direct.",
        "Ошибка = SPT − MEAS (в % от диапазона HSCI1-LSCI1). INCOPT 0 — обратное действие (MEAS растёт → OUT падает), 1 — прямое.",
      ),
      b(
        "P: gain = 100 / PBAND. PBAND 50 % means gain 2.",
        "P: коэффициент = 100 / PBAND. PBAND 50 % — коэффициент 2.",
      ),
      b(
        "I: INT minutes per repeat; smaller INT = stronger integral. Removes steady-state error.",
        "I: INT — минуты на повтор; меньше INT — сильнее интеграл. Убирает статическую ошибку.",
      ),
      b(
        "D: DERIV minutes, acts on MEAS changes (no kick on SPT change). Useful on slow temperature loops.",
        "D: DERIV в минутах, действует на изменение MEAS (без толчка при смене SPT). Полезен на медленных температурных контурах.",
      ),
      b(
        "MODOPT selects the terms: 1 P, 2 I, 3 PD, 4 PI, 5 PID.",
        "MODOPT выбирает составляющие: 1 P, 2 I, 3 PD, 4 PI, 5 PID.",
      ),
      b(
        "MA: Auto/Manual. LR: Local SPT or Remote RSP (cascade secondary).",
        "MA: Auto/Manual. LR: локальное задание SPT или удалённое RSP (ведомый в каскаде).",
      ),
    ],
    keys: [
      "MEAS",
      "SPT",
      "OUT",
      "MA",
      "LR",
      "RSP",
      "MODOPT",
      "PBAND",
      "INT",
      "DERIV",
      "INCOPT",
      "BCALCI",
      "MALOPT",
      "MEASHL",
      "MEASLL",
      "DALOPT",
      "HDALIM",
      "LDALIM",
    ],
    use: b(
      "Every regulating loop: level, flow, pressure, temperature; cascades (primary OUT → secondary RSP).",
      "Любой контур регулирования: уровень, расход, давление, температура; каскады (OUT ведущего → RSP ведомого).",
    ),
    pitfalls: [
      b(
        "Wrong action (INCOPT): the loop runs away instead of correcting.",
        "Неверное направление (INCOPT): контур уходит в разнос вместо коррекции.",
      ),
      b(
        "INT too small on a slow process: oscillation. PBAND too small: oscillation.",
        "Слишком малый INT на медленном объекте — колебания. Слишком малый PBAND — колебания.",
      ),
      b(
        "OUT can be changed only in Manual, SPT only in Local.",
        "OUT меняется только в Manual, SPT — только в Local.",
      ),
    ],
    src: "4-27, 4-37…4-47",
    tryIt: b(
      "Heat exchanger E-301: put TIC301 in Manual, step OUT by 10 %, watch the reaction curve on TREND, then tune PBAND/INT.",
      "Теплообменник E-301: переведите TIC301 в Manual, измените OUT на 10 %, посмотрите кривую разгона на TREND, затем настройте PBAND/INT.",
    ),
  },
  PIDA: {
    title: b("PIDA — advanced PID", "PIDA — расширенный PID"),
    what: b(
      "The newer PID with feedforward, gain scheduling and more alarm options. In this simulator it behaves like PID.",
      "Более новый PID с feedforward, адаптацией коэффициентов и расширенными авариями. В тренажёре работает как PID.",
    ),
    keys: ["MEAS", "SPT", "OUT", "MA", "MODOPT", "PBAND", "INT", "DERIV"],
    src: "4-37",
  },
  RATIO: {
    title: b("RATIO — ratio station", "RATIO — станция соотношения"),
    what: b(
      "OUT = MEAS × RATIO + BIAS. Typically sets the setpoint of a second flow loop in proportion to a wild flow.",
      "OUT = MEAS × RATIO + BIAS. Обычно задаёт уставку второго контура расхода пропорционально «дикому» потоку.",
    ),
    keys: ["MEAS", "RATIO", "BIAS", "OUT"],
  },
  CALC: {
    title: b("CALC — calculator", "CALC — калькулятор"),
    what: b(
      "A small program of up to 20 steps (STEP01…) in reverse Polish notation over real inputs RI01-RI08 and Boolean inputs BI01-BI04, writing RO01-RO04 and BO01-BO04.",
      "Небольшая программа до 20 шагов (STEP01…) в обратной польской записи над входами RI01-RI08 и BI01-BI04, результаты в RO01-RO04 и BO01-BO04.",
    ),
    how: [
      b(
        "IN RI01 pushes a value; ADD/SUB/MUL/DIV take two values from the stack; OUT RO01 stores the top of the stack.",
        "IN RI01 кладёт значение в стек; ADD/SUB/MUL/DIV берут два значения из стека; OUT RO01 сохраняет вершину стека.",
      ),
      b(
        "Example interlock: IN RI01, IN 100, GT, OUT BO01 → BO01 is true when RI01 > 100.",
        "Пример блокировки: IN RI01, IN 100, GT, OUT BO01 → BO01 = true, когда RI01 > 100.",
      ),
      b(
        "Example totalizer: IN RO01, IN RI01, IN 0.00833, MUL, ADD, OUT RO01 (adds flow × 0.5 s / 60 each scan).",
        "Пример сумматора: IN RO01, IN RI01, IN 0.00833, MUL, ADD, OUT RO01 (каждый скан добавляет расход × 0,5 с / 60).",
      ),
    ],
    keys: ["RI01", "BI01", "STEP01", "RO01", "BO01", "PERROR"],
    pitfalls: [
      b(
        "A totalizer constant depends on PERIOD: change PERIOD and the total is wrong.",
        "Константа сумматора зависит от PERIOD: поменяете PERIOD — сумма станет неверной.",
      ),
    ],
  },
  CHARC: {
    title: b("CHARC — characterizer", "CHARC — характеризатор"),
    what: b(
      "Piecewise-linear curve OUT = f(MEAS) through up to 9 X/Y points: tank volume from level, valve linearisation.",
      "Кусочно-линейная функция OUT = f(MEAS) по 9 точкам X/Y: объём бака по уровню, линеаризация клапана.",
    ),
    keys: ["MEAS", "NUMPTS", "X01", "Y01", "OUT"],
  },
  SWCH: {
    title: b("SWCH — switch", "SWCH — переключатель"),
    what: b(
      "Selects IN_1 (TOGGLE = false) or IN_2 (TOGGLE = true). Used for overrides, e.g. the R-401 interlock forces full cooling.",
      "Выбирает IN_1 (TOGGLE = false) или IN_2 (TOGGLE = true). Применяется для переопределения, например блокировка R-401 включает полное охлаждение.",
    ),
    keys: ["IN_1", "IN_2", "TOGGLE", "OUT"],
  },
  LLAG: {
    title: b("LLAG — lead/lag", "LLAG — lead/lag (опережение/запаздывание)"),
    what: b(
      "First-order lag (LAGTIM, minutes) with optional lead. The course uses it to simulate the tank (PROCESS_2:LAG_TM).",
      "Апериодическое звено (LAGTIM, минуты) с опережением. В курсе им моделируют бак (PROCESS_2:LAG_TM).",
    ),
    keys: ["MEAS", "LAGTIM", "LEADTM", "GAIN", "OUT"],
  },
  DTIME: {
    title: b("DTIME — dead time", "DTIME — транспортное запаздывание"),
    what: b(
      "OUT = MEAS delayed by DT minutes. Simulates transport delay in pipes; dead time makes loops harder to tune.",
      "OUT = MEAS с задержкой DT минут. Моделирует транспортное запаздывание в трубах; запаздывание усложняет настройку контура.",
    ),
    keys: ["MEAS", "DT", "OUT"],
  },
  MTR: {
    title: b("MTR — motor control", "MTR — управление двигателем"),
    what: b(
      "Start/stop logic for a motor with run feedback (MSTAT) and trip alarm. MANRUN = operator start, AUTRUN = automatic start.",
      "Логика пуска/останова двигателя с обратной связью MSTAT и аварией отключения. MANRUN — пуск оператором, AUTRUN — автоматический пуск.",
    ),
    keys: ["MANRUN", "AUTRUN", "MSTAT", "TRIP", "MA"],
  },
  HLBL: {
    title: b(
      "HLBL — High Level Batch Language",
      "HLBL — High Level Batch Language (язык последовательностей)",
    ),
    what: b(
      "A sequence program executed step by step inside the CP: it waits for conditions, sets setpoints and modes, opens valves and reports messages. Used for batch phases, start-up and CIP.",
      "Программа последовательности, выполняемая шаг за шагом в CP: ждёт условий, задаёт уставки и режимы, открывает клапаны и выдаёт сообщения. Применяется для фаз batch, пуска установок и CIP.",
    ),
    how: [
      b(
        "ACTIVE := TRUE starts the program from the top; it continues every scan where it paused (WAIT, WAITUNTIL).",
        "ACTIVE := TRUE запускает программу с начала; каждый скан она продолжает с места паузы (WAIT, WAITUNTIL).",
      ),
      b(
        "Assignments to C:B.P write any parameter of any block, e.g. REACTOR:TIC401.MA := TRUE.",
        "Присваивание C:B.P записывает любой параметр любого блока, например REACTOR:TIC401.MA := TRUE.",
      ),
      b(
        "STATE shows IDLE/RUNNING/WAITING/DONE/ERROR, STMNO the current line.",
        "STATE показывает IDLE/RUNNING/WAITING/DONE/ERROR, STMNO — текущую строку.",
      ),
    ],
    keys: ["SOURCE", "ACTIVE", "STATE", "STMNO", "PERROR"],
    tryIt: b(
      "Batch reactor R-401: open R401_SEQ:PHASES, start it and follow the highlighted line while the reactor fills and heats.",
      "Batch-реактор R-401: откройте R401_SEQ:PHASES, запустите и следите за подсвеченной строкой, пока реактор наполняется и греется.",
    ),
    src: "ch. 14 (Sequence blocks)",
  },
};

/** Russian descriptions for the most important parameters (English descriptions are in the block definitions). */
export const PARAM_RU: Record<string, string> = {
  DESCRP: "Описание блока (до 32 символов)",
  LOOPID: "Идентификатор контура под faceplate",
  PERIOD: "Индекс периода исполнения (0 = 0,1 с, 1 = 0,5 с, 2 = 1 с, …)",
  PHASE:
    "Фаза: сдвиг исполнения внутри периода, чтобы распределить нагрузку CP",
  IOMOPT: "0 — связь с блоком, 1 — FBM, 2 — связь без преобразования сигнала",
  IOM_ID: "Letterbug модуля FBM (ECB), откуда берётся точка",
  PNT_NO: "Номер точки (канала) FBM",
  MEAS: "Измерение (вход)",
  SCI: "Индекс преобразования сигнала (3 = линейный 4-20 мА)",
  HSCO1: "Верхняя граница шкалы выхода",
  LSCO1: "Нижняя граница шкалы выхода",
  EO1: "Инженерные единицы выхода",
  HSCI1: "Верхняя граница шкалы измерения",
  LSCI1: "Нижняя граница шкалы измерения",
  EI1: "Инженерные единицы измерения",
  PNT: "Значение точки в инженерных единицах",
  BAD: "Сигнал недостоверен (отказ канала/FBM или связи)",
  OOR: "Выход за диапазон",
  MA: "Manual/Auto: true — Auto, false — Manual",
  INITMA: "Начальный режим: 0 — Manual, 1 — Auto, 2 — из checkpoint",
  MANSW: "Принудительно Manual (сильнее AUTSW)",
  AUTSW: "Принудительно Auto",
  SPT: "Задание (уставка), локальное",
  RSP: "Удалённое задание (от ведущего регулятора в каскаде)",
  LR: "Local/Remote: false — локальное SPT, true — удалённое RSP",
  OUT: "Выход (в Manual задаётся оператором)",
  MODOPT: "Режим: 1 P, 2 I, 3 PD, 4 PI, 5 PID",
  PBAND: "Зона пропорциональности, % (коэффициент = 100 / PBAND)",
  INT: "Время интегрирования, минут на повтор",
  DERIV: "Время дифференцирования, минуты",
  INCOPT: "Направление: 0 — обратное (MEAS ↑ → OUT ↓), 1 — прямое",
  BCALCI:
    "Вход обратного расчёта от нижестоящего блока (BCALCO) — безударность",
  BCALCO: "Выход обратного расчёта для вышестоящего регулятора",
  FBK: "Внешняя обратная связь для интеграла",
  MALOPT: "Абсолютные аварии измерения: 0 нет, 1 обе, 2 верхняя, 3 нижняя",
  MEASHL: "Верхний предел (HIABS)",
  MEASLL: "Нижний предел (LOABS)",
  MEASPR: "Приоритет аварий измерения 1-5 (1 — высший)",
  MEASHT: "Текст верхней аварии (до 28 символов)",
  MEASLT: "Текст нижней аварии (до 28 символов)",
  HHAOPT: "Аварии HH/LL: 0 нет, 1 обе, 2 HH, 3 LL",
  HHALIM: "Предел HH (HHABS)",
  LLALIM: "Предел LL (LLABS)",
  DALOPT: "Аварии отклонения: 0 нет, 1 обе, 2 верхняя, 3 нижняя",
  HDALIM: "Предел отклонения вверх (MEAS − SPT)",
  LDALIM: "Предел отклонения вниз (SPT − MEAS)",
  DEVPRI: "Приоритет аварий отклонения",
  OALOPT: "Аварии выхода: 0 нет, 1 обе, 2 верхняя, 3 нижняя",
  INHIB: "Подавить все аварии блока",
  CRIT: "Критичность: приоритет самой важной активной аварии (0 — нет)",
  PRTYPE: "Тип самой приоритетной активной аварии",
  UNACK: "Есть неквитированная авария",
  BAO: "Авария BAD: 0 выкл, 1 вкл",
  BAT: "Текст аварии BAD",
  BAP: "Приоритет аварии BAD",
  HLOP: "Абсолютные аварии точки: 0 нет, 1 обе, 2 верхняя, 3 нижняя",
  HAL: "Верхний предел точки",
  LAL: "Нижний предел точки",
  HLPR: "Приоритет аварий точки",
  CIN: "Значение контакта",
  INVCIN: "Инвертировать контакт",
  COUT: "Выходной контакт",
  IN: "Входное (запрошенное) состояние",
  TRACK: "Слежение: нижестоящий блок в открытом контуре",
  HOLDST: "Удержание выхода (BAD измерение или HOLD)",
  ERROR: "Рассогласование MEAS − SPT",
  SOURCE: "Текст программы HLBL",
  ACTIVE: "Запуск программы",
  STATE: "Состояние программы",
  STMNO: "Номер выполняемой строки",
  PERROR: "Ошибка программы",
  TOGGLE: "Переключатель: false — IN_1, true — IN_2",
  MANRUN: "Пуск оператором",
  AUTRUN: "Автоматический пуск",
  MSTAT: "Состояние двигателя: true — работает",
  LAGTIM: "Постоянная времени, минуты",
  DT: "Время запаздывания, минуты",
};

/** Help for screens and concepts. */
export const SCREEN_HELP: Record<string, HelpDoc> = {
  faceplate: {
    title: b("Faceplate", "Faceplate (лицевая панель)"),
    what: b(
      "The operator view of one block: bar graphs of MEAS (with the SPT marker) and OUT, mode buttons and ramp keys.",
      "Операторский вид одного блока: столбики MEAS (с маркером SPT) и OUT, кнопки режимов и клавиши изменения.",
    ),
    how: [
      b(
        "Header colour = alarm priority: 1 red, 2 magenta, 3 brown, 4 cyan, 5 grey. Cyan bar = compound OFF / out of service.",
        "Цвет заголовка — приоритет аварии: 1 красный, 2 пурпурный, 3 коричневый, 4 голубой, 5 серый. Голубой столбик — compound OFF / вне работы.",
      ),
      b(
        "Ramp keys: ▲/▼ 1 %, ▲▲/▼▼ 5 %. In Auto they move SPT, in Manual OUT.",
        "Клавиши: ▲/▼ на 1 %, ▲▲/▼▼ на 5 %. В Auto меняют SPT, в Manual — OUT.",
      ),
      b(
        "Status letters: T = tracking, H = hold, W = mode locked by a connection.",
        "Буквы статуса: T — слежение, H — удержание, W — режим заблокирован связью.",
      ),
    ],
    src: "ch. 6",
  },
  cad: {
    title: b(
      "Current Alarms Display (CAD)",
      "Current Alarms Display (CAD) — текущие аварии",
    ),
    what: b(
      "The list of alarms that need attention. Order: active unacknowledged, active acknowledged, returned unacknowledged; inside each group by priority, newest first.",
      "Список аварий, требующих внимания. Порядок: активные неквитированные, активные квитированные, вернувшиеся неквитированные; внутри групп — по приоритету, новые сверху.",
    ),
    how: [
      b(
        'Acknowledge = "I have seen it". The alarm stays while the condition is active.',
        "Квитирование — «я увидел». Авария остаётся, пока условие активно.",
      ),
      b(
        "A returned alarm disappears after it is acknowledged.",
        "Вернувшаяся в норму авария исчезает после квитирования.",
      ),
      b(
        "MRA = most recent alarms in time order; History = journal including acks and returns.",
        "MRA — последние аварии по времени; History — журнал, включая квитирования и возвраты.",
      ),
    ],
    src: "ch. 11-12",
  },
  graphic: {
    title: b("Process graphic", "Графический дисплей процесса"),
    what: b(
      'A mimic of the plant with live values. Click a value or an equipment item to open its faceplate (a "pick").',
      "Мнемосхема установки с живыми значениями. Щелчок по значению или оборудованию открывает faceplate (pick).",
    ),
    how: [
      b(
        "Colours follow the block alarm state (PRTYPE/CRIT); pumps green = running, red = stopped; valves filled = open.",
        "Цвета следуют состоянию аварий блока (PRTYPE/CRIT); насос зелёный — работает, красный — стоит; закрашенный клапан — открыт.",
      ),
    ],
    src: "ch. 7-8",
  },
  group: {
    title: b("Group display", "Групповой дисплей"),
    what: b(
      "Up to 8 faceplates side by side — the classic way to watch a process unit.",
      "До 8 faceplate рядом — классический способ наблюдать за установкой.",
    ),
    src: "ch. 6",
  },
  strategy: {
    title: b(
      "Strategy Editor (Control Editors / IACC CSD)",
      "Strategy Editor (Control Editors / IACC CSD)",
    ),
    what: b(
      "Graphical configuration: blocks are drawn as symbols, connections as wires. One sheet per compound here.",
      "Графическое конфигурирование: блоки — символы, связи — провода. Здесь один лист на compound.",
    ),
    how: [
      b(
        "The number #n on a block is its execution order inside the compound.",
        "Номер #n на блоке — порядок исполнения в compound.",
      ),
      b(
        "Blue labels on the left are connections from other compounds; green labels on the right are readers in other compounds.",
        "Синие метки слева — связи из других compounds; зелёные справа — кто читает этот выход в других compounds.",
      ),
      b(
        "Added / Modified / Downloaded shows whether the CP already has this version.",
        "Added / Modified / Downloaded показывает, есть ли эта версия уже в CP.",
      ),
    ],
    src: "ch. 5",
  },
  icc: {
    title: b(
      "ICC — Integrated Control Configurator",
      "ICC — Integrated Control Configurator",
    ),
    what: b(
      "The classic I/A Series tabular configurator: pick a compound, a block, then fill in the parameter sheet. Typing C:B.P into a parameter makes a connection.",
      "Классический табличный конфигуратор I/A Series: выбрать compound, блок и заполнить лист параметров. Ввод C:B.P в параметр создаёт связь.",
    ),
    src: "ch. 5",
  },
  validate: {
    title: b("Validate and Download", "Validate и Download"),
    what: b(
      "Validate checks the configuration; Download copies it into the running CP. With errors the download is refused.",
      "Validate проверяет конфигурацию; Download копирует её в работающий CP. При ошибках загрузка запрещена.",
    ),
    how: [
      b(
        "Unchanged blocks keep running; modified blocks take the new configuration without a bump.",
        "Неизменённые блоки продолжают работать; изменённые получают новую конфигурацию без толчка.",
      ),
      b(
        "Changes made by the operator (e.g. SPT) are not in the configuration: use Upload to keep them.",
        "Изменения оператора (например, SPT) не попадают в конфигурацию: чтобы сохранить их, нажмите Upload.",
      ),
    ],
    src: "5-…",
  },
  process: {
    title: b("PROCESS (plant model)", "ПРОЦЕСС (модель установки)"),
    what: b(
      "The simulated plant behind the FBMs. You see true values (what really happens) and can play instructor: change load, inject disturbances.",
      "Моделируемая установка за модулями FBM. Здесь видны истинные значения (что происходит на самом деле), и можно играть роль инструктора: менять нагрузку, вносить возмущения.",
    ),
  },
  compound: {
    title: b("Compound", "Compound"),
    what: b(
      "A named group of blocks executed together in one CP — usually one process unit or loop group. ON/OFF starts or stops all its blocks; CINHIB suppresses alarm priorities.",
      "Именованная группа блоков, исполняемых вместе в одном CP, — обычно одна установка или группа контуров. ON/OFF запускает или останавливает все блоки; CINHIB подавляет приоритеты аварий.",
    ),
    keys: ["ON", "CINHIB", "PERIOD", "PHASE", "DESCRP"],
    src: "4-4…4-8",
  },
  connection: {
    title: b("Connections C:B.P", "Связи C:B.P"),
    what: b(
      'A block input gets its value from another parameter: COMPOUND:BLOCK.PARAM, or :BLOCK.PARAM inside the same compound. A connected input is "secured": operators cannot change it.',
      "Вход блока получает значение из другого параметра: COMPOUND:BLOCK.PARAM или :BLOCK.PARAM внутри того же compound. Подключённый вход «защищён»: оператор не может его изменить.",
    ),
    src: "4-11",
  },
};
