import { iq, many, num, one, tf } from '../q'
import type { Module } from '../types'

const S = 'Hardware Overview'

export const O1: Module = {
  id: 'o1',
  n: 1,
  course: 'ops',
  title: { ru: 'Обзор оборудования I/A Series', en: 'I/A Series hardware overview' },
  goal: {
    ru: 'Знать, из чего состоит система: рабочие станции, Control Processors, FBM, baseplates, TA и MESH; что делает каждый компонент и что пропадает при его отказе.',
    en: 'Know the building blocks: workstations, Control Processors, FBMs, baseplates, TAs and the MESH; what each one does and what is lost when it fails.',
  },
  lessons: [
    {
      id: 'o1l1',
      title: { ru: 'Станции и Control Processors', en: 'Workstations and Control Processors' },
      minutes: 20,
      base: `
### Место DCS среди систем завода
DCS Foxboro — **мастер-система** площадки. К ней подключаются:
- **ESD/FGS** (противоаварийная защита, пожар и газ) — обычно **Triconex**, связь по **TSAA** (TCP/IP);
- **PLC** сторонних фирм (Siemens, Allen-Bradley) — по **Modbus TCP/IP** или **Modbus RS-485** через FBM;
- **SCADA** и верхние системы — по **OPC**.

### Пять базовых компонентов I/A Series
| Компонент | Что делает |
|---|---|
| **Workstations** (рабочие станции и серверы) | мониторинг и управление, тревоги, хостинг CP, Historian |
| **Processor modules** (станции: CP, FCM) | выполняют управление |
| **Field module baseplates** | несущие платы на DIN-рейке для FCP, FCM, FBM |
| **Termination Assembly (TA)** | клеммы полевых кабелей, согласование сигналов |
| **MESH Control Network** | коммутируемый Ethernet между всеми станциями |

### Рабочие станции: AW и WP
- **AW (Application Workstation)** — обычно сервер. **Хостит CP** (каждый CP должен иметь хост-AW: хранит его базу и checkpoint), держит **Historian**, системные тревоги, инженерные инструменты.
- **WP (Workstation Processor)** — «окно в процесс» для оператора: все операторские дисплеи, но обычно без инженерных конфигураторов. Исторические данные и системные тревоги WP получает от AW.
- Аппаратные платформы (модели Dell и т. п.) меняются по поколениям: старые H90 (Windows Server 2016), H92 и D96 (Windows 10), V91 (Server 2016); новые H94 и V95 (Windows Server 2022). Модель запоминать не нужно, важно понимать роль: сервер/хост или клиент оператора.
- К станции оператора подключают **Annunciator Keyboard** (панель с кнопками дисплеев, лампами тревог и сиреной).

### Control Processors
| Модуль | Ёмкость по I/O |
|---|---|
| **FCP270** (Field Control Processor) | 32 FBM 200-й серии без FEM; до **128 с FEM100**; 64 FBM 100-й серии |
| **ZCP270** (Z-module Control Processor) | 128 FBM 200-й серии (через **FCM100**); 128 FBM 100-й серии |
| **FCP280** | 128 FBM 200-й серии на **4 независимых канала I/O**; 64 FBM 100-й серии |
| **FDC280** (Field Device Controller) | до 256 полевых устройств (Modbus, EtherNet/IP и т. п.), без FBM |

Что делает CP:
- регулирование, логику, таймеры, последовательности (непрерывное, дискретное, batch-управление);
- сбор данных, **обнаружение тревог и оповещение**;
- база CP хранится в памяти (memory-resident image): перезагрузка базы занимает меньше 10 с;
- синхронизация времени (опционально от GPS); у ZCP270 время для FCM приходит от ZCP;
- letterbug задаётся через **инфракрасный Letterbug Configurator**.

### Fault-tolerant (FT) пара
Два одинаковых модуля стоят **рядом** (соседние позиции baseplate), каждый со своим подключением к MESH (два коммутатора). Оба выполняют одну программу, сравнивают результаты; наружу пишет **Primary**, **Shadow** готов.
- При отказе Primary — переход на Shadow **без удара** (bumpless), в поле не уходят плохие значения;
- **скрытые отказы** (latent flaws) обнаруживаются, потому что модули постоянно сравниваются.

Кабели FT-пары FCP270: оранжевая дуплексная оптика 100 Мбит/с к коммутаторам через пару splitter/combiner; FCP280/FDC280 подключаются похоже, но со своей схемой.

### FEM100
**Fieldbus Expansion Module** ставится на свою baseplate и даёт FCP270 до **4 расширенных fieldbus по 32 FBM** (итого 128). FEM100 можно ставить парой для резервированного fieldbus.

### Шины к FBM
- **2 Мбит/с Module Fieldbus** — к 200-й серии (резервирован A/B);
- **268 кбит/с Fieldbus** — к старой 100-й серии через **FBI100** (модули миграции).
`,
      classic: `
### В I/A Series V8
Стандартный набор на проекте 2010-х: AW (сервер) хостит FCP270 FT-пары, WP — пульты операторов, MESH на коммутаторах Foxboro. ZCP270 + FCM100Et встречается на расширениях старых систем. Хост и letterbug каждого CP задаются в **System Definition**.
`,
      modern: `
### В EcoStruxure Foxboro DCS
Контроллер по умолчанию — **FCP280** (4 порта HDLC fieldbus, встроенный self-hosting), для полевых протоколов — **FDC280**. AW/WP называются по ролям: серверы, EWS (инженерные), OWS (операторские). Ядро ПО — **Control Core Services**.
`,
      field: `
### Как говорят на объекте
- «CP на **шэдоу** перешёл» — сработал FT, работает бывший Shadow.
- «Пара **рассинхронилась**» — модули FT не в синхроне, один надо заменить или переучить (reboot).
- «Кто **хост** у этого CP?» — какая AW хранит базу и checkpoint.
`,
      practice: [
        { label: 'Конструктор архитектуры: соберите AW + FCP280 FT + FBM', view: 'architecture' },
      ],
      quiz: [
        one('o1l1q1', 'Что обязательно должно быть у каждого CP?', ['Свой принтер', 'Хост-AW, хранящая его базу', 'Подключение к Triconex', 'Собственный Historian'], 1, 'Каждый CP хостится AW: база, checkpoint, загрузка при старте.', S),
        num('o1l1q2', 'Сколько FBM 200-й серии поддерживает FCP270 без FEM100?', 32, 'До 32; с FEM100 — до 128.', S),
        one('o1l1q3', 'Сколько расширенных fieldbus даёт FEM100 и сколько FBM на каждом?', ['2 × 64', '4 × 32', '8 × 16', '1 × 128'], 1, '4 расширенных fieldbus по 32 FBM.', S),
        one('o1l1q4', 'Какой контроллер работает с полевыми устройствами по протоколам, без FBM (до 256 устройств)?', ['FCP270', 'ZCP270', 'FDC280', 'FEM100'], 2, 'FDC280 — Field Device Controller.', S),
        many('o1l1q5', 'Преимущества fault-tolerant пары CP:', ['Переключение без удара', 'В поле не уходят плохие значения', 'Обнаружение скрытых отказов', 'Вдвое больше блоков'], [0, 1, 2], 'Пара выполняет одну программу; ёмкость не удваивается.', S),
        tf('o1l1q6', 'WP обычно даёт доступ к инженерным конфигураторам так же, как AW.', false, 'WP — операторская станция; инженерные инструменты обычно на AW.', S),
        one('o1l1q7', 'Через что FCP270 работает со старыми FBM 100-й серии?', ['FCM100', 'FBI100 (268 кбит/с fieldbus)', 'ATS', 'FEM100'], 1, 'FBI100 — модули миграции на 268 кбит/с fieldbus.', S),
      ],
      interview: [
        iq(
          'o1l1i1',
          'Что произойдёт при отказе одиночного (не FT) CP?',
          [
            ['FBM уходят в fail-safe или держат последнее значение', 'fail-safe', 'последн'],
            ['Пропадает только функция этого CP, остальная система работает', 'остальн', 'распредел'],
            ['Оператор видит системную тревогу в System Manager', 'system manager', 'системн'],
            ['Поэтому критичные CP ставят FT-парой', 'ft', 'fault'],
          ],
          'Система распределённая, поэтому остальные CP и станции продолжают работать, теряется только управление этого CP. FBM по своей настройке уходят в fail-safe (например, клапан закрыт) или держат последнее значение. Оператор видит системную тревогу: кнопка System красная, в System Manager станция красная. Поэтому критичные CP ставят fault-tolerant парой (FT): Shadow подхватывает без удара.',
        ),
      ],
    },
    {
      id: 'o1l2',
      title: { ru: 'FBM, baseplates, TA и сеть MESH', en: 'FBMs, baseplates, TAs and the MESH network' },
      minutes: 25,
      base: `
### Fieldbus Modules (FBM)
FBM преобразуют сигналы поля в цифровые сигналы I/A и обратно. Кроме преобразования, дискретные FBM могут выполнять **ladder logic** и **SOE** (Sequence of Events, разрешение 1 мс); аналоговые — **TDR** (Transient Data Recorder, 10 мс).

**Аналоговые FBM**
| FBM | Каналы |
|---|---|
| **FBM201** | 8 AI 0–20 мА (201b — 0–100 мВ, 201c — 0–5 В, 201d — 0–10 В) |
| **FBM202** | 8 термопар/мВ |
| **FBM203** | 8 RTD (0–320 Ом; 203b — 0–640, 203c — 0–30) |
| **FBM204** | 4 AI + 4 AO 0–20 мА (**FBM205** — то же, redundant ready) |
| **FBM206** | 8 импульсных входов (10 Гц – 25 кГц) |
| **FBM208** | резервированный 4 AI + 4 AO с readback |
| **FBM211** | 16 AI 0–20 мА |
| **FBM212** | 14 термопар/мВ |
| **FBM237** | 8 AO 0–20 мА, redundant ready |

**Дискретные FBM**
| FBM | Каналы |
|---|---|
| **FBM207** | 16 DI (voltage monitor; 207b — 24 В контакты, 207c — 48 В) |
| **FBM217** | 32 DI |
| **FBM219** | 24 DI + 8 DO |
| **FBM241** | 8 DI + 8 DO (**FBM240** — резервированный) |
| **FBM242** | 16 DO |

**Коммуникационные FBM**: FoxCom, **HART**, **FOUNDATION Fieldbus**, **Profibus-DP**, **Modbus**.
**FDSI** (Field Device System Integrator) для сторонних устройств:
- **FBM230** — 4 последовательных порта RS-232/422/485 (Modbus, AB…); **FBM231** — резервированный;
- **FBM232** — Ethernet 10/100 (Modbus TCP, OPC…); **FBM233** — резервированный.

### Baseplates
DIN-рейка, на **2, 4 или 8 позиций**, горизонтально или вертикально. Дают разъёмы резервированного питания, fieldbus, **time strobe** (синхронизация времени) и кабелей к TA.

### Идентификация FBM (MID / letterbug)
- FBM под FCP: letterbug = **4 символа хоста + позиция**, например CP с префиксом WXYZ: WXYZ01 … WXYZ38 (цифры: baseplate и слот).
- Под ZCP270: FBM подключены через **FCM100**; MID FCM **оканчивается на 00** (MNOP00), FBM за ним берут первые 4 символа FCM: MNOP01 … MNOP38.
- Все FBM одного Module Fieldbus имеют **одинаковые первые 4 символа**.
- По MID можно сказать, что за модуль: оканчивается на 00 — FCM/процессор; иначе — FBM на позиции baseplate.

### Termination Assemblies (TA)
TA связывает FBM с полевыми приборами: согласование сигналов, заземление, защита (предохранители, барьеры).
- Цвет корпуса: **аналоговые — малиновый (raspberry red)**, **дискретные — тёмно-синий**, **коммуникационные — зелёный**.
- Клеммы: **compression screw**, **knife disconnect** (с размыкателем, удобно для проверки петли), **ring lug**.

### MESH Control Network
Коммутируемый Ethernet (Fast Ethernet 100 Мбит/с, магистрали Gigabit 1000 Мбит/с), **IEEE 802.3**. Каждая станция подключена к **двум** коммутаторам. Петли и резервные пути разруливает **RSTP** (IEEE 802.1w): блокирует лишние пути и быстро переключается при обрыве. Параллельные магистрали — **link aggregation (IEEE 802.3ad)**.

**Топологии**
| Топология | Когда | Особенности |
|---|---|---|
| **Linear** | малая, 2 коммутатора | отказ одного компонента не валит остальных |
| **Ring** | 3–7 коммутаторов | при отказе коммутатора кольцо становится линией |
| **Star** | средние и большие | edge-коммутаторы к двум root; до 40 edge (Gold blades), 166 (Platinum) |
| **Double Star** | средние и большие | две звезды; основной peer-to-peer трафик держите внутри своей звезды |
| **Inverted Tree** | большие | root сверху, до 3 уровней под root, до 250 коммутаторов |
`,
      classic: `
### В I/A Series V8
Подбор FBM — типичная задача проектировщика: посчитать сигналы по типам (AI 4–20 мА, AI HART, RTD, DI, DO), выбрать FBM с запасом 10–20 %, решить, какие сигналы требуют резервированных модулей (FBM205/FBM237/FBM240), и разложить по baseplates.
`,
      modern: `
### В EcoStruxure Foxboro DCS
FBM 200-й серии продолжают использоваться. Новое поколение — **Edge I/O / Compact 200** и универсальные каналы. Сеть — та же коммутируемая архитектура (PCN), обычно топология Star.
`,
      field: `
### Как говорят на объекте
- «Модуль **201-й**» — FBM201, 8 токовых входов.
- «Разомкни **ножевую** клемму и посмотри ток» — knife disconnect на TA.
- «Корень звезды», «**root** и **edge**» — коммутаторы MESH.
`,
      practice: [
        { label: 'Конструктор архитектуры: подберите FBM под список сигналов', view: 'architecture' },
      ],
      quiz: [
        one('o1l2q1', 'Какой FBM — 8 входов RTD?', ['FBM201', 'FBM202', 'FBM203', 'FBM206'], 2, 'FBM203 — RTD; 202 — термопары.', S),
        one('o1l2q2', 'Какой FBM — 16 дискретных выходов?', ['FBM207', 'FBM217', 'FBM241', 'FBM242'], 3, 'FBM242 — 16 DO.', S),
        one('o1l2q3', 'Какого цвета аналоговые TA?', ['Зелёные', 'Малиновые (raspberry red)', 'Тёмно-синие', 'Серые'], 1, 'Аналоговые — малиновые, дискретные — тёмно-синие, коммуникационные — зелёные.', S),
        tf('o1l2q4', 'MID модуля FCM100 должен оканчиваться на 00.', true, 'FBM за ним берут его первые 4 символа.', S),
        one('o1l2q5', 'Какой FBM — резервированный Ethernet для сторонних устройств (Modbus TCP, OPC)?', ['FBM230', 'FBM231', 'FBM232', 'FBM233'], 3, '232 — одиночный, 233 — резервированный.', S),
        one('o1l2q6', 'Какой протокол управляет резервными путями в MESH?', ['OSPF', 'RSTP (IEEE 802.1w)', 'VRRP', 'Modbus'], 1, 'RSTP убирает петли и быстро переключает путь.', S),
        num('o1l2q7', 'Максимум коммутаторов в топологии Ring?', 7, 'Ring — от 3 до 7 коммутаторов.', S),
        one('o1l2q8', 'Сколько всего коммутаторов допускает Inverted Tree?', ['40', '128', '166', '250'], 3, 'До 250, root сверху и до 3 уровней под ними.', S),
      ],
      interview: [
        iq(
          'o1l2i1',
          'How would you select I/O modules for a new skid with 40 AI (4–20 mA HART), 12 RTD, 30 DI and 20 DO?',
          [
            ['Count signals by type and add spare', 'spare', 'запас'],
            ['FBM214/FBM211 or HART-capable for AI; FBM203 for RTD', 'fbm203', 'rtd'],
            ['FBM207/FBM217 for DI, FBM242/FBM241 for DO', 'fbm242', 'fbm241', 'fbm217'],
            ['Redundant modules for critical loops', 'redundant', 'резерв'],
            ['Baseplate positions and TA types', 'baseplate', 'ta'],
          ],
          'First I count signals by type and add 10–20 % spare. For 40 HART AI I need a HART-capable analog module (for example FBM214, or FBM211 if HART is not needed), for 12 RTD two FBM203, for 30 DI one FBM217 (32 inputs) or two FBM207, for 20 DO two FBM242 or FBM241. Critical control loops go on redundant modules (FBM205, FBM237, FBM240). Then I place the modules on baseplates, pick TA types (knife disconnect helps loop checks) and check the controller capacity.',
        ),
      ],
    },
  ],
}
