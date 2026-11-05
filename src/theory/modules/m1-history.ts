import type { Module } from '../types'

export const M1: Module = {
  id: 'm1',
  n: 1,
  title: { ru: 'Foxboro: история, поколения и словарь', en: 'Foxboro: history, generations and vocabulary' },
  goal: 'Понимать, откуда взялись названия I/A Series, Foxboro Evo и EcoStruxure Foxboro DCS, что из старого живёт в новом, и говорить на одном языке со специалистами.',
  lessons: [
    {
      id: 'm1l1',
      title: 'От I/A Series до EcoStruxure Foxboro DCS',
      minutes: 15,
      base: `
Foxboro — одна из старейших марок КИПиА. Компания основана в 1908 году в городе Foxboro (Массачусетс, США). DCS этой марки называется по-разному в зависимости от эпохи, но **ядро идеи не менялось с 1987 года**: распределённые контроллеры, общая сеть, единая база блоков управления и операторские станции, которые видят всё.

### Главная мысль урока
Когда специалист говорит «I/A», «Evo» или «Foxboro DCS», он почти всегда говорит об **одной и той же линии продуктов**. Новые версии совместимы со старыми: контроллер FCP270 из 2005 года и FCP280 из 2020-х работают в одной сети, а блок PID настраивается теми же параметрами PBAND и INT.

### Линия времени
| Годы | Владелец | Название системы | Что важно |
|---|---|---|---|
| 1987 | The Foxboro Company | **I/A Series** (Intelligent Automation) | Первая «открытая» DCS: Nodebus, CP10/CP30, станции на UNIX |
| 1990 | Siebe plc | I/A Series | Foxboro покупает британская Siebe |
| 1999 | **Invensys** (Siebe + BTR) | I/A Series V6–V8 | CP40/CP60 → FCP270/ZCP270, сеть MESH (V8, около 2005), станции на Windows |
| 1998 | Invensys покупает Wonderware | — | Отсюда ArchestrA и InTouch, будущая основа нового ПО |
| ~2013 | Invensys | **Foxboro Evo** Process Automation System | I/A Series V9.x переименована, FCP280, Foxboro Control Software (FCS) |
| 2014 | **Schneider Electric** | Foxboro Evo | Schneider покупает Invensys |
| ~2019 | Schneider Electric | **EcoStruxure Foxboro DCS** | Новое имя линии, ПО на платформе AVEVA System Platform |

> Точные годы выпуска отдельных версий отличаются по источникам на 1–2 года. На собеседовании важен порядок: **I/A Series → Foxboro Evo → EcoStruxure Foxboro DCS**.

### Что такое «ядро» и что такое «надстройка»
Систему удобно делить на два слоя:
- **Control Core Services (CCS)**: ядро, которое досталось от I/A Series. Это контроллеры, блоки, сеть, System Manager, тревоги, IPC-обмен между станциями. В старых документах это просто «I/A Series software».
- **Control Software**: инженерные и операторские инструменты. В V8 это **IACC/ICC** и **FoxView/FoxDraw**. В новой системе это **Control Editors** (на базе Galaxy, AVEVA System Platform) и **Control HMI** (на базе InTouch).

Отсюда главное правило: **блоки, параметры и логика CP одинаковы, меняются инструменты вокруг них.**
`,
      classic: `
### I/A Series V8.x (курс 2001V8)
- Контроллеры **FCP270** и **ZCP270** (с FCM100Et). Старые CP40/CP60 на Nodebus в курсе упоминаются только для совместимости.
- Сеть **MESH Control Network**: коммутируемый Ethernet 100 Мбит/1 Гбит с резервированием и RSTP.
- Станции: рабочие станции **P92/H92** и серверы **P90/H90, P91/H91** под Windows XP / Server 2003. Буква P означает Dell, H означает HP.
- Инжиниринг: **IACC** (графический редактор Control Strategy Diagram) и старый табличный **ICC**.
- Оператор: **FoxView** (дисплеи), **FoxDraw** (рисование мнемосхем), **FoxSelect** (дерево compound/block), Alarm Manager.
- Диагностика: **System Management Displays (SMDH)**, позже **System Manager**.
- Конфигурация системы: **System Definition** (SysDef) создаёт Commit-файлы, по которым устанавливается ПО на станции.
`,
      modern: `
### EcoStruxure Foxboro DCS (версии 2020-х)
- Контроллеры **FCP280** (основной) и **FDC280** (для интеграции цифровых устройств по Modbus TCP, OPC UA и т. п.). FCP270 и ZCP270 поддерживаются в той же сети.
- Сеть **PCN** (Process Control Network), то же самое, что MESH, просто новое название в проектной документации.
- Ввод-вывод: те же **FBM 200-й серии** и новое **Edge I/O** с универсальными каналами.
- Ядро: **Control Core Services (CCS)** версии 9.x.
- Инжиниринг: **Control Editors** (Foxboro DCS Control Software). Вся конфигурация хранится в **Galaxy** (база AVEVA System Platform). Вместо Download говорят **Deploy**.
- Оператор: **Control HMI** (на базе InTouch): Framer, Detail Display, Alarm Window.
- Диагностика: **System Manager**.
- Конфигурация системы: **System Definition** (новые версии, Commit + Install).
`,
      field: `
### Как говорят на объекте
- «У нас **Evo**» или «у нас **Foxboro DCS**» обычно означает одну и ту же систему. «У нас **I/A**» означает старую систему V8 и ниже.
- «**CP**» означает любой контроллер (Control Processor): FCP270, ZCP270, FCP280. Даже если стоит FCP280, говорят «залить в CP», «CP2701 упал».
- «**Галактика**» (Galaxy) означает базу конфигурации Control Software.
- «**Задеплоить**» означает загрузить изменения из Control Editors в CP. В V8 говорили «**даунлоад**» (Download) из IACC.
- «**Чекпойнт**» (checkpoint) означает сохранённый образ базы CP на хосте. Без него после перезагрузки CP поднимется со старой базой.
- «**Летербаг**» (letterbug) означает 6-символьное имя станции или модуля.

!> Частая ошибка новичка: говорить «Foxboro» как о программе. Foxboro — это марка. Говорите конкретно: Control Editors, Control HMI, System Manager, FCP280.
`,
      practice: [{ label: 'Посмотреть оборудование обоих поколений в палитре Архитектуры', view: 'architecture' }],
      quiz: [
        {
          id: 'm1l1q1',
          kind: 'single',
          q: 'В каком порядке менялось название системы?',
          options: [
            'Foxboro Evo → I/A Series → EcoStruxure Foxboro DCS',
            'I/A Series → Foxboro Evo → EcoStruxure Foxboro DCS',
            'I/A Series → EcoStruxure Foxboro DCS → Foxboro Evo',
            'Foxboro DCS → I/A Series → Foxboro Evo',
          ],
          answer: 1,
          explain: 'I/A Series (с 1987) → Foxboro Evo (около 2013, I/A V9.x) → EcoStruxure Foxboro DCS (около 2019, Schneider Electric).',
        },
        {
          id: 'm1l1q2',
          kind: 'single',
          q: 'Какая компания сейчас владеет Foxboro?',
          options: ['Siebe', 'Invensys', 'Schneider Electric', 'Emerson'],
          answer: 2,
          explain: 'Schneider Electric купила Invensys в 2014 году. Siebe и Invensys были предыдущими владельцами.',
        },
        {
          id: 'm1l1q3',
          kind: 'tf',
          q: 'Блок PID в FCP280 настраивается совсем другими параметрами, чем в FCP270.',
          answer: false,
          explain: 'Библиотека блоков общая: PBAND, INT, DERIV, MODOPT и т. д. одинаковы. Меняются инструменты (IACC → Control Editors), а не блоки.',
        },
        {
          id: 'm1l1q4',
          kind: 'single',
          q: 'На какой платформе построены Control Editors в EcoStruxure Foxboro DCS?',
          options: ['FoxDraw', 'AVEVA System Platform (Galaxy, ArchestrA)', 'Microsoft Excel', 'Solaris CDE'],
          answer: 1,
          explain: 'Control Editors хранят конфигурацию в Galaxy (AVEVA System Platform, бывшая ArchestrA от Wonderware).',
        },
        {
          id: 'm1l1q5',
          kind: 'single',
          q: 'Что такое Control Core Services (CCS)?',
          options: ['Графический редактор мнемосхем', 'Ядро системы: контроллеры, блоки, сеть, тревоги, System Manager', 'Сервер истории', 'Лицензия на Windows'],
          answer: 1,
          explain: 'CCS — ядро, унаследованное от I/A Series. Control Software (Control Editors, Control HMI) — надстройка над ним.',
        },
        {
          id: 'm1l1q6',
          kind: 'multi',
          q: 'Что из этого — инструменты эпохи I/A Series V8? (несколько ответов)',
          options: ['IACC', 'FoxView', 'Control HMI', 'FoxDraw', 'Control Editors'],
          answer: [0, 1, 3],
          explain: 'IACC, FoxView и FoxDraw — инструменты V8. Control HMI и Control Editors — их современные преемники.',
        },
        {
          id: 'm1l1q7',
          kind: 'single',
          q: 'Как в проектной документации EcoStruxure обычно называют сеть, которая в V8 называлась MESH?',
          options: ['Nodebus', 'PCN (Process Control Network)', 'Fieldbus', 'PROFIBUS'],
          answer: 1,
          explain: 'MESH и PCN — одна и та же коммутируемая сеть управления. Nodebus — старая шина до V8.',
        },
      ],
      interview: [
        {
          id: 'm1i1',
          q: 'Расскажите коротко, чем Foxboro Evo / EcoStruxure Foxboro DCS отличается от I/A Series.',
          points: [
            { t: 'Ядро (CCS, блоки, CP, сеть) осталось совместимым', kw: ['ядро', 'ccs', 'core', 'совмест', 'те же блок'] },
            { t: 'Новые контроллеры FCP280 / FDC280', kw: ['fcp280', 'fdc280'] },
            { t: 'Инжиниринг: IACC → Control Editors на Galaxy', kw: ['control editor', 'galaxy', 'галакт', 'iacc'] },
            { t: 'Оператор: FoxView → Control HMI', kw: ['control hmi', 'foxview', 'intouch'] },
            { t: 'Смена владельца: Invensys → Schneider Electric', kw: ['schneider', 'invensys'] },
          ],
          model:
            'Это одна линия продуктов. Ядро — Control Core Services, контроллеры, библиотека блоков и сеть MESH/PCN — совместимо, FCP270 и FCP280 работают в одной системе. Новое — контроллеры FCP280 и FDC280, Edge I/O, а главное — Control Software: Control Editors на базе Galaxy (AVEVA System Platform) вместо IACC и Control HMI на базе InTouch вместо FoxView. Владелец сменился с Invensys на Schneider Electric, отсюда имя EcoStruxure.',
        },
      ],
    },
    {
      id: 'm1l2',
      title: 'Карта системы: из чего состоит любая Foxboro DCS',
      minutes: 15,
      base: `
Любая Foxboro DCS, от маленькой установки до завода, состоит из одних и тех же **пяти слоёв**. Если вы держите в голове эту карту, вы можете обсуждать любую систему.

\`\`\`
  [ Операторские и инженерные станции, серверы ]  ← HMI, инжиниринг, история
                      │  A/B
  [ Сеть управления MESH / PCN (резервированные коммутаторы) ]
                      │  A/B
  [ Контроллеры CP: FCP270 / ZCP270 / FCP280 / FDC280 ]  ← здесь работают блоки
                      │  Fieldbus (HDLC 2 Мбит/с, A/B)
  [ Модули ввода-вывода: FBM 200-й серии, Edge I/O ]
                      │  кабели
  [ Клеммные сборки TA → полевые приборы (4–20 мА, HART, дискреты) ]
\`\`\`

### Путь сигнала
Любой вопрос о неисправности сводится к пути сигнала. Например, уровень в ёмкости:
1. Датчик **LT101** выдаёт 4–20 мА.
2. Кабель приходит на клеммник **TA** (Termination Assembly).
3. TA кабелем соединён с модулем **FBM201** (8 аналоговых входов). FBM превращает ток в цифровое значение.
4. FBM по резервированной шине Fieldbus отдаёт значение контроллеру **CP**.
5. В CP блок **AIN** (через ECB модуля) читает канал, масштабирует в 0–5 м и проверяет тревоги.
6. Блок **PID** сравнивает с заданием и считает выход.
7. Блок **AOUT** отправляет выход на модуль **FBM204/FBM237** → TA → клапан **LV101**.
8. По сети MESH значения уходят на операторские станции: мнемосхема, faceplate, тревоги, тренды.

### Ключевые свойства, которыми гордится Foxboro
- **Резервирование везде**: две сети A/B, отказоустойчивые пары контроллеров (fault-tolerant, FT), резервированные FBM и блоки питания.
- **Блочная модель управления**: всё управление собирается из стандартных блоков (AIN, PID, AOUT, CALC…), сгруппированных в **compounds**.
- **Глобальные имена**: любая станция может прочитать любой параметр в формате **COMPOUND:BLOCK.PARAMETER**, не зная, в каком CP он находится.
- **Обновление без остановки**: блоки можно менять в работающем CP, а пары FT позволяют менять модуль без потери управления.
`,
      classic: `
### Как это выглядело в V8
- Станции **AW** (Application Workstation) и **WP** (Workstation Processor). AW хранит базы и хостит контроллеры, WP — чисто операторская.
- На один CP есть **хост AW**: на нём лежит checkpoint-файл и образ загрузки CP.
- В курсе 2001V8 у каждой системы должна быть хотя бы одна станция класса AW.
`,
      modern: `
### Как это выглядит сейчас
- Роли станций в проектах обычно обозначают кодами: **EWS** (инженерная), **OWS** (операторская), серверы истории, серверы Galaxy Repository, домен-контроллеры.
- Хосты CP и домены System Monitor задаются в **System Definition**.
- Многие станции работают как **виртуальные машины** на резервированных серверах, а операторы сидят за тонкими клиентами.
- Между сетью управления и офисной сетью ставят отдельную сеть **PIN** (Plant Information Network) и **DMZ** с межсетевыми экранами.
`,
      field: `
### Фразы, которые стоит уметь сказать
- «Сигнал идёт с TA на FBM201 в слоте 3, дальше по fieldbus на CP, блок AIN в compound TANK101.»
- «У нас FT-пара, отказ одного модуля оператор не заметит, будет только системная тревога.»
- «Проверь путь A и путь B, похоже, один коммутатор потерян.»
`,
      practice: [
        { label: 'Пройти задание 1: собрать минимальную систему', view: 'architecture', exercise: 'ex1-first' },
        { label: 'Трассировка сигнала на готовой системе (двойной щелчок по прибору)', view: 'architecture' },
      ],
      quiz: [
        {
          id: 'm1l2q1',
          kind: 'single',
          q: 'Где выполняется блок PID?',
          options: ['В модуле FBM', 'В контроллере CP', 'На операторской станции', 'В клеммной сборке TA'],
          answer: 1,
          explain: 'Блоки управления работают в CP. FBM только преобразует сигналы (дискретные FBM могут ещё выполнять ladder logic).',
        },
        {
          id: 'm1l2q2',
          kind: 'single',
          q: 'Что делает TA (Termination Assembly)?',
          options: ['Выполняет алгоритмы', 'Служит клеммником для полевых кабелей и соединяет их с FBM', 'Коммутирует сеть MESH', 'Хранит checkpoint'],
          answer: 1,
          explain: 'TA — клеммная сборка: на неё заходят полевые кабели, а кабелем она соединяется с FBM.',
        },
        {
          id: 'm1l2q3',
          kind: 'single',
          q: 'Как в Foxboro записывается полный адрес параметра?',
          options: ['CP.BLOCK.PARAM', 'COMPOUND:BLOCK.PARAMETER', 'BLOCK/PARAM@CP', 'FBM:CHANNEL'],
          answer: 1,
          explain: 'Формат COMPOUND:BLOCK.PARAMETER, например TANK101:LIC101.SPT. Имя CP в адресе не нужно.',
        },
        {
          id: 'm1l2q4',
          kind: 'tf',
          q: 'Чтобы прочитать параметр блока, операторская станция должна знать, в каком CP он находится.',
          answer: false,
          explain: 'Имена compounds уникальны в сети, поэтому достаточно COMPOUND:BLOCK.PARAMETER.',
        },
        {
          id: 'm1l2q5',
          kind: 'single',
          q: 'Каждая система I/A Series V8 должна иметь хотя бы одну станцию класса…',
          options: ['WP', 'AW', 'FCM', 'ATS'],
          answer: 1,
          explain: 'AW (Application Workstation) хранит базы и хостит контроллеры.',
          src: '2001V8 2-123',
        },
        {
          id: 'm1l2q6',
          kind: 'single',
          q: 'По какой шине FBM 200-й серии связан с контроллером?',
          options: ['По сети MESH', 'По резервированной шине Fieldbus (HDLC, 2 Мбит/с)', 'По USB', 'По Wi-Fi'],
          answer: 1,
          explain: 'FBM подключаются к CP по резервированной шине Fieldbus (A/B, 2 Мбит/с HDLC). Сеть MESH соединяет станции и CP.',
        },
      ],
    },
  ],
}
