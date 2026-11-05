/**
 * Hardware catalog for the Architecture Builder.
 *
 * Facts marked `src` come from the 2001V8 "I/A Series Configuration Essentials"
 * participant guide (chapter 2). Items for the modern Foxboro DCS
 * (FCP280, FDC280) come from public Schneider Electric product specs.
 */

export type Family =
  | 'workstation'
  | 'server'
  | 'switch'
  | 'controller'
  | 'fcm'
  | 'fbm'
  | 'ta'
  | 'instrument'

/** Era filter: classic I/A Series v8.x, modern Foxboro DCS (Evo / Control Software), or both. */
export type Era = 'classic' | 'modern' | 'both'

/** Signal type carried by a field channel. */
export type SignalType = 'AI' | 'AO' | 'TC' | 'RTD' | 'DI' | 'DO' | 'PULSE' | 'HART_AI' | 'HART_AO'

export interface Bilingual {
  en: string
  ru: string
}

export interface ChannelGroup {
  signal: SignalType
  count: number
}

export interface ComponentType {
  id: string
  family: Family
  label: string
  era: Era
  desc: Bilingual
  /** Manual page reference, e.g. "2-76". */
  src?: string
  /** I/O channels (FBMs) */
  channels?: ChannelGroup[]
  /** Signal produced/consumed (instruments) */
  signal?: SignalType
  /** Max directly attached FBMs (controllers / FCMs) */
  maxFbms?: number
  /** Max total FBMs reachable (e.g. ZCP270 via FCMs) */
  maxFbmsTotal?: number
  /** Max control blocks (controllers) */
  maxBlocks?: number
  /** Port count (switches) */
  ports?: number
  /** True if the controller talks to FBMs directly over the 2 Mbps module fieldbus */
  directFieldbus?: boolean
  /** True if the instrument is an output device (valve/pump) */
  isOutput?: boolean
}

export const FAMILY_ORDER: Family[] = [
  'workstation',
  'server',
  'switch',
  'controller',
  'fcm',
  'fbm',
  'ta',
  'instrument',
]

export const FAMILY_LABEL: Record<Family, Bilingual> = {
  workstation: { en: 'Workstations', ru: 'Рабочие станции' },
  server: { en: 'Servers', ru: 'Серверы' },
  switch: { en: 'MESH Ethernet switches', ru: 'Коммутаторы MESH' },
  controller: { en: 'Control Processors', ru: 'Контроллеры (CP)' },
  fcm: { en: 'Fieldbus Communication Modules', ru: 'Модули связи Fieldbus (FCM)' },
  fbm: { en: 'Fieldbus Modules (FBM)', ru: 'Модули ввода-вывода (FBM)' },
  ta: { en: 'Termination Assemblies', ru: 'Клеммные сборки (TA)' },
  instrument: { en: 'Field instruments', ru: 'Полевые приборы' },
}

export const SIGNAL_LABEL: Record<SignalType, string> = {
  AI: '4-20 mA in',
  AO: '4-20 mA out',
  TC: 'Thermocouple / mV',
  RTD: 'RTD',
  DI: 'Discrete in',
  DO: 'Discrete out',
  PULSE: 'Pulse in',
  HART_AI: 'HART in',
  HART_AO: 'HART out',
}

/** Which FBM channel signal can serve a given instrument signal. */
export function signalCompatible(channel: SignalType, instrument: SignalType): boolean {
  if (channel === instrument) return true
  if (channel === 'HART_AI' && instrument === 'AI') return true
  if (channel === 'HART_AO' && instrument === 'AO') return true
  return false
}

export const CATALOG: ComponentType[] = [
  // ---------------- Workstations / servers ----------------
  {
    id: 'H92',
    family: 'workstation',
    label: 'P/H92 Workstation',
    era: 'both',
    src: '2-33',
    desc: {
      en: 'Windows operator/engineering workstation (P = Dell, H = HP). Software suites by S-code: S01 base, S02 visualization, S03 engineering. Runs FoxView (classic) or Control HMI (modern).',
      ru: 'Рабочая станция оператора/инженера на Windows (P = Dell, H = HP). Лицензии S-code: S01 базовая, S02 визуализация, S03 инжиниринг. Запускает FoxView (classic) или Control HMI (modern).',
    },
  },
  {
    id: 'H91',
    family: 'server',
    label: 'P/H91 Server',
    era: 'both',
    src: '2-24',
    desc: {
      en: 'Application server: software, application and database storage. Hosts controller checkpoint files (boot host) and historian.',
      ru: 'Сервер приложений: хранение ПО, приложений и баз данных. Хранит checkpoint-файлы контроллеров (boot host) и историю.',
    },
  },
  {
    id: 'H90',
    family: 'server',
    label: 'P/H90 Server',
    era: 'both',
    src: '2-31',
    desc: {
      en: 'Rack/tower server used as application or Galaxy Repository server in larger systems.',
      ru: 'Сервер, используемый как сервер приложений или Galaxy Repository в крупных системах.',
    },
  },

  // ---------------- Switches ----------------
  {
    id: 'SW8',
    family: 'switch',
    label: '8-Port Switch (P0972MF)',
    era: 'both',
    ports: 8,
    src: '2-114',
    desc: {
      en: '8-port copper managed switch with built-in 100 Mb MMF uplink. Unmanaged switches are NOT supported on MESH.',
      ru: '8-портовый управляемый медный коммутатор с оптическим аплинком 100 Мб MMF. Неуправляемые коммутаторы в MESH не поддерживаются.',
    },
  },
  {
    id: 'SW24',
    family: 'switch',
    label: '24-Port Switch (P0972WP)',
    era: 'both',
    ports: 24,
    src: '2-114',
    desc: {
      en: '24-port copper managed switch with up to two 1 GB uplinks. Typical edge or root switch.',
      ru: '24-портовый управляемый медный коммутатор, до двух аплинков 1 ГБ. Типичный edge- или root-коммутатор.',
    },
  },
  {
    id: 'SWCH',
    family: 'switch',
    label: 'Chassis Switch (P0972MK)',
    era: 'both',
    ports: 336,
    src: '2-114',
    desc: {
      en: 'Chassis managed switch, up to 336 ports. Used as root switch in Star topology (up to 40 edge switches with Gold blades).',
      ru: 'Модульный (шасси) коммутатор, до 336 портов. Root-коммутатор в топологии Star (до 40 edge-коммутаторов с Gold blades).',
    },
  },

  // ---------------- Controllers ----------------
  {
    id: 'FCP270',
    family: 'controller',
    label: 'FCP270',
    era: 'classic',
    maxFbms: 32,
    maxBlocks: 4000,
    directFieldbus: true,
    src: '2-46',
    desc: {
      en: 'Field Control Processor 270. DIN-rail, field-mounted, optionally fault-tolerant. Talks to up to 32 200-Series FBMs directly over the 2 Mbps module fieldbus (128 with FEM). Up to 4000 blocks, 10,000 block executions/s. 100 Mbps fiber to MESH.',
      ru: 'Field Control Processor 270. Монтаж на DIN-рейку в поле, опционально отказоустойчивый (FT). Напрямую работает с 32 FBM 200-й серии по 2 Мбит/с fieldbus (128 с FEM). До 4000 блоков, 10 000 исполнений блоков/с. Оптика 100 Мбит/с к MESH.',
    },
  },
  {
    id: 'ZCP270',
    family: 'controller',
    label: 'ZCP270',
    era: 'classic',
    maxBlocks: 4000,
    maxFbmsTotal: 128,
    directFieldbus: false,
    src: '2-45',
    desc: {
      en: 'Z-Module Control Processor 270. Z-form factor, Cellbus-mounted. Does NOT talk to FBMs directly: uses FCM100Et pairs (max 32 pairs, 128 FBMs total).',
      ru: 'Z-Module Control Processor 270. Форм-фактор Z, монтаж на Cellbus. НЕ работает с FBM напрямую: только через пары FCM100Et (до 32 пар, всего 128 FBM).',
    },
  },
  {
    id: 'FCP280',
    family: 'controller',
    label: 'FCP280',
    era: 'modern',
    maxFbms: 256,
    maxBlocks: 8000,
    directFieldbus: true,
    desc: {
      en: 'Field Control Processor 280 (Foxboro Evo / Foxboro DCS). Four HDLC fieldbus ports for up to 256 200-Series FBMs, fault-tolerant pair, self-hosting, 100 Mbps MESH.',
      ru: 'Field Control Processor 280 (Foxboro Evo / Foxboro DCS). Четыре порта HDLC fieldbus, до 256 FBM 200-й серии, FT-пара, self-hosting, MESH 100 Мбит/с.',
    },
  },
  {
    id: 'FDC280',
    family: 'controller',
    label: 'FDC280',
    era: 'modern',
    maxFbms: 0,
    maxBlocks: 8000,
    directFieldbus: false,
    desc: {
      en: 'Field Device Controller 280. Integrates Ethernet/serial field devices (Modbus TCP, EtherNet/IP, PROFINET...) directly; no FBMs.',
      ru: 'Field Device Controller 280. Подключает Ethernet/serial устройства (Modbus TCP, EtherNet/IP, PROFINET...) напрямую, без FBM.',
    },
  },

  // ---------------- FCM ----------------
  {
    id: 'FCM100Et',
    family: 'fcm',
    label: 'FCM100Et',
    era: 'classic',
    maxFbms: 32,
    src: '2-71',
    desc: {
      en: 'Fieldbus Communications Module 100Et. Interfaces 100 Mbps MESH to the 2 Mbps module fieldbus for a ZCP270. Max 32 FBMs per FCM. Mounted on the first modular baseplate.',
      ru: 'Fieldbus Communications Module 100Et. Связывает MESH 100 Мбит/с с 2 Мбит/с fieldbus для ZCP270. До 32 FBM на FCM. Ставится на первую модульную базовую плату.',
    },
  },

  // ---------------- FBMs ----------------
  {
    id: 'FBM201',
    family: 'fbm',
    label: 'FBM201',
    era: 'both',
    channels: [{ signal: 'AI', count: 8 }],
    src: '2-76',
    desc: { en: 'Eight analog inputs, 0-20 mA dc.', ru: 'Восемь аналоговых входов 0-20 мА.' },
  },
  {
    id: 'FBM202',
    family: 'fbm',
    label: 'FBM202',
    era: 'both',
    channels: [{ signal: 'TC', count: 8 }],
    src: '2-76',
    desc: { en: 'Eight thermocouple/mV inputs (-10.5 to 69.5 mV dc).', ru: 'Восемь входов термопар/мВ (-10.5…69.5 мВ).' },
  },
  {
    id: 'FBM203',
    family: 'fbm',
    label: 'FBM203',
    era: 'both',
    channels: [{ signal: 'RTD', count: 8 }],
    src: '2-76',
    desc: { en: 'Eight RTD inputs (0-320 ohm).', ru: 'Восемь входов термосопротивлений RTD (0-320 Ом).' },
  },
  {
    id: 'FBM204',
    family: 'fbm',
    label: 'FBM204',
    era: 'both',
    channels: [
      { signal: 'AI', count: 4 },
      { signal: 'AO', count: 4 },
    ],
    src: '2-76',
    desc: { en: 'Four 0-20 mA inputs and four 0-20 mA outputs. Classic choice for a single loop.', ru: 'Четыре входа и четыре выхода 0-20 мА. Классический выбор для контура.' },
  },
  {
    id: 'FBM211',
    family: 'fbm',
    label: 'FBM211',
    era: 'both',
    channels: [{ signal: 'AI', count: 16 }],
    src: '2-76',
    desc: { en: '16 analog inputs, 0-20 mA dc.', ru: '16 аналоговых входов 0-20 мА.' },
  },
  {
    id: 'FBM237',
    family: 'fbm',
    label: 'FBM237',
    era: 'both',
    channels: [{ signal: 'AO', count: 8 }],
    src: '2-76',
    desc: { en: 'Eight analog outputs 0-20 mA, redundant ready.', ru: 'Восемь аналоговых выходов 0-20 мА, с возможностью резервирования.' },
  },
  {
    id: 'FBM206',
    family: 'fbm',
    label: 'FBM206',
    era: 'both',
    channels: [{ signal: 'PULSE', count: 8 }],
    src: '2-76',
    desc: { en: 'Eight pulse inputs, 10 Hz to 25 kHz (turbine / PD flowmeters).', ru: 'Восемь импульсных входов 10 Гц…25 кГц (турбинные расходомеры).' },
  },
  {
    id: 'FBM207',
    family: 'fbm',
    label: 'FBM207',
    era: 'both',
    channels: [{ signal: 'DI', count: 16 }],
    src: '2-77',
    desc: { en: '16 discrete inputs, voltage monitor 0-80 V dc (207b: 24 V contact sense).', ru: '16 дискретных входов, контроль напряжения 0-80 В (207b: 24 В сухой контакт).' },
  },
  {
    id: 'FBM217',
    family: 'fbm',
    label: 'FBM217',
    era: 'both',
    channels: [{ signal: 'DI', count: 32 }],
    src: '2-77',
    desc: { en: '32 discrete inputs.', ru: '32 дискретных входа.' },
  },
  {
    id: 'FBM241',
    family: 'fbm',
    label: 'FBM241',
    era: 'both',
    channels: [
      { signal: 'DI', count: 8 },
      { signal: 'DO', count: 8 },
    ],
    src: '2-77',
    desc: { en: 'Eight discrete inputs and eight discrete outputs (motor/pump start-stop with feedback).', ru: '8 дискретных входов и 8 выходов (пуск/стоп насоса с обратной связью).' },
  },
  {
    id: 'FBM242',
    family: 'fbm',
    label: 'FBM242',
    era: 'both',
    channels: [{ signal: 'DO', count: 16 }],
    src: '2-77',
    desc: { en: '16 discrete outputs.', ru: '16 дискретных выходов.' },
  },
  {
    id: 'FBM214',
    family: 'fbm',
    label: 'FBM214',
    era: 'both',
    channels: [{ signal: 'HART_AI', count: 8 }],
    src: '2-78',
    desc: { en: 'HART communication inputs (4-20 mA + digital HART).', ru: 'Входы с HART (4-20 мА + цифровой HART).' },
  },
  {
    id: 'FBM215',
    family: 'fbm',
    label: 'FBM215',
    era: 'both',
    channels: [{ signal: 'HART_AO', count: 8 }],
    src: '2-78',
    desc: { en: 'HART communication outputs.', ru: 'Выходы с HART.' },
  },

  // ---------------- TA ----------------
  {
    id: 'TA',
    family: 'ta',
    label: 'Termination Assembly',
    era: 'both',
    src: '2-95',
    desc: {
      en: 'Field signal connection unit linking one FBM with its field devices. Provides signal conditioning, grounding and safety. Connected to the baseplate by a dedicated cable.',
      ru: 'Клеммная сборка: связывает один FBM с полевыми приборами. Обеспечивает согласование сигналов, заземление и защиту. Подключается к базовой плате отдельным кабелем.',
    },
  },

  // ---------------- Instruments ----------------
  {
    id: 'FT',
    family: 'instrument',
    label: 'Flow transmitter (FT)',
    era: 'both',
    signal: 'AI',
    desc: { en: '4-20 mA flow transmitter (DP or magnetic).', ru: 'Датчик расхода 4-20 мА (перепад давления или электромагнитный).' },
  },
  {
    id: 'LT',
    family: 'instrument',
    label: 'Level transmitter (LT)',
    era: 'both',
    signal: 'AI',
    desc: { en: '4-20 mA level transmitter.', ru: 'Датчик уровня 4-20 мА.' },
  },
  {
    id: 'PT',
    family: 'instrument',
    label: 'Pressure transmitter (PT)',
    era: 'both',
    signal: 'AI',
    desc: { en: '4-20 mA pressure transmitter.', ru: 'Датчик давления 4-20 мА.' },
  },
  {
    id: 'TE_TC',
    family: 'instrument',
    label: 'Thermocouple (TE)',
    era: 'both',
    signal: 'TC',
    desc: { en: 'Type K/J thermocouple, mV signal.', ru: 'Термопара типа K/J, сигнал мВ.' },
  },
  {
    id: 'TE_RTD',
    family: 'instrument',
    label: 'RTD Pt100 (TE)',
    era: 'both',
    signal: 'RTD',
    desc: { en: 'Pt100 resistance thermometer.', ru: 'Термосопротивление Pt100.' },
  },
  {
    id: 'AT',
    family: 'instrument',
    label: 'Analyzer (AT: pH / DO)',
    era: 'both',
    signal: 'AI',
    desc: { en: '4-20 mA analyzer, e.g. pH or dissolved oxygen in a bioreactor.', ru: 'Анализатор 4-20 мА, например pH или растворённый кислород в биореакторе.' },
  },
  {
    id: 'FV',
    family: 'instrument',
    label: 'Control valve (FV/LV/TV)',
    era: 'both',
    signal: 'AO',
    isOutput: true,
    desc: { en: '4-20 mA control valve with I/P positioner.', ru: 'Регулирующий клапан 4-20 мА с позиционером.' },
  },
  {
    id: 'XV',
    family: 'instrument',
    label: 'On/off valve (XV)',
    era: 'both',
    signal: 'DO',
    isOutput: true,
    desc: { en: 'Solenoid on/off valve, discrete output.', ru: 'Отсечной клапан с соленоидом, дискретный выход.' },
  },
  {
    id: 'ZS',
    family: 'instrument',
    label: 'Limit switch (ZS)',
    era: 'both',
    signal: 'DI',
    desc: { en: 'Valve position / limit switch, discrete input.', ru: 'Концевой выключатель положения, дискретный вход.' },
  },
  {
    id: 'PUMP',
    family: 'instrument',
    label: 'Pump motor (start/stop)',
    era: 'both',
    signal: 'DO',
    isOutput: true,
    desc: { en: 'Pump motor starter command (discrete output).', ru: 'Команда пуска насоса (дискретный выход).' },
  },
]

export const CATALOG_BY_ID: Record<string, ComponentType> = Object.fromEntries(CATALOG.map((c) => [c.id, c]))

export function totalChannels(t: ComponentType, signal?: SignalType): number {
  return (t.channels ?? []).filter((g) => !signal || g.signal === signal).reduce((a, g) => a + g.count, 0)
}
