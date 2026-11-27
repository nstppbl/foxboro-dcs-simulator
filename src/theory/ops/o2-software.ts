import { iq, many, one, tf } from '../q'
import type { Module } from '../types'

const S = 'Software Overview'

export const O2: Module = {
  id: 'o2',
  n: 2,
  course: 'ops',
  title: { ru: 'Обзор программного обеспечения', en: 'Software overview' },
  goal: {
    ru: 'Знать программные компоненты системы (HMI, тревоги, Historian, System Manager, System Definition), структуру базы CP (compound, block, STA, ECB) и три базы, которые должны совпадать.',
    en: 'Know the software parts (HMI, alarms, Historian, System Manager, System Definition), the CP database structure (compound, block, STA, ECB) and the three databases that must match.',
  },
  lessons: [
    {
      id: 'o2l1',
      title: { ru: 'HMI, тревоги, Historian, System Manager, System Definition', en: 'HMI, alarms, Historian, System Manager, System Definition' },
      minutes: 15,
      base: `
### HMI: визуализация и разработка графики
| Задача | I/A Series (классика) | Новое поколение |
|---|---|---|
| Операторский интерфейс | **FoxView** | **Foxboro Control HMI** |
| Редактор мнемосхем | **FoxDraw** | **Control HMI Editor** |

HMI оповещает о тревогах процесса, даёт их **квитировать** (acknowledge) и сортировать по **приоритету** и **времени**.

### Архив тревог и событий
- **Alarm** — тревога DCS (из блоков CP).
- **Event / SOE** (Sequence of Events) — события с меткой времени, например от **Triconex**.

### Historian: AIM*AT
**AIM*Historian** (семейство AIM*AT) собирает значения точек реального времени и хранит их для **трендов** и истории тревог. Если AW с Historian отказала — история за это время не пишется.

### System Manager
Следит за **здоровьем и статусом** всего оборудования. Каждая станция сообщает своё состояние программе **System Monitor** (до 64 станций в домене), а **System Manager** показывает это оператору и даёт квитировать системные тревоги (модуль O8).

### System Definition
Описывает систему целиком:
- **Hardware definition** — какие станции, модули, letterbugs;
- **Network definition** — коммутаторы и подключения;
- **Parameter definition** — параметры станций;
- **Software definition** — какие пакеты ПО на каких станциях, кто кому хост.
Результат (**Commit**) устанавливается на станции.
`,
      classic: `
### В I/A Series V8
FoxView + FoxDraw, AIM*AT Historian, SMDH/System Manager. System Definition делается отдельной утилитой; результат commit раньше переносили на дискете/носителе, теперь — файлами.
`,
      modern: `
### В EcoStruxure Foxboro DCS
Control HMI (на базе InTouch), Control HMI Editor, Historian, System Manager, System Definition — те же роли, новые инструменты.
`,
      field: `
### Как говорят на объекте
- «Залезь в **AIM**, посмотри историю за ночь».
- «**СисМенеджер** горит» — есть системная тревога.
- «Сделали **коммит** SysDef и переустановили станцию».
`,
      practice: [{ label: 'Архитектура → System Definition: проверка и Commit', view: 'architecture' }],
      quiz: [
        one('o2l1q1', 'Какой инструмент рисует мнемосхемы для FoxView?', ['FoxSelect', 'FoxDraw', 'AIM*AT', 'ICC'], 1, 'FoxDraw — редактор графики FoxView.', S),
        one('o2l1q2', 'Что хранит Historian AIM*AT?', ['Базу CP', 'Значения точек для трендов и историю', 'Пароли окружений', 'Описание сети'], 1, 'Исторические данные для трендов и тревог.', S),
        one('o2l1q3', 'Кому станции сообщают своё здоровье и статус?', ['FoxSelect', 'System Monitor', 'Alarm printer', 'ICC'], 1, 'System Monitor собирает статус, System Manager показывает.', S),
        many('o2l1q4', 'Из каких частей состоит System Definition?', ['Hardware definition', 'Network definition', 'Parameter definition', 'Software definition', 'Recipe definition'], [0, 1, 2, 3], 'Четыре части; рецептов там нет.', S),
        tf('o2l1q5', 'События SOE от Triconex архивируются вместе с тревогами DCS.', true, 'Alarm — DCS, Event — SOE (Triconex).', S),
      ],
    },
    {
      id: 'o2l2',
      title: { ru: 'Compound, block, STA, ECB и синхронизация баз', en: 'Compounds, blocks, STA, ECB and database sync' },
      minutes: 15,
      base: `
### Compound
**Compound** — набор блоков, выполняющих одну или несколько функций управления.
- имя **до 12 символов**, **уникально во всей сети MESH**;
- в каждом CP два compound создаются автоматически: **Station (STA)** и **ECB**.

### Station compound (STA)
Пример: **000100_STA** (letterbug CP + _STA). **Нельзя удалить**, в него нельзя добавлять блоки. Содержит блок STATION с текущей конфигурацией CP:
- **BPC** (Basic Processing Cycle);
- версия ПО;
- **загрузка и ёмкость** CP;
- включение **автоматического checkpoint**.

### ECB compound
Пример: **000100_ECB**. ECB (Equipment Control Block) — программный интерфейс между CP и FBM. ECB по умолчанию:
- **FCP270**: PRIMARY_ECB;
- **FCP280**: PRIMARY_ECB, PRIMARY_ECB2, PRIMARY_ECB3, PRIMARY_ECB4 (по одному на канал I/O);
- **FDC280**: ENET_PORT1, SERIAL_PORT1 … SERIAL_PORT4.

### Block
**Блок** — запрограммированный алгоритм для конкретной задачи управления (AIN, PID, AOUT, CALC, IND…). У каждого блока свой набор параметров; меняя их, блок настраивают.

### Синтаксис связей
Связь пишется **COMPOUND:BLOCK.PARAMETER**, например TIC101:PID1.OUT. Внутри своего compound можно писать **:BLOCK.PARAMETER**.

### Три базы, которые должны совпадать
1. **Checkpoint-файл** — образ базы CP на хосте (из него CP грузится);
2. **CSA database** на инженерной станции (Control Station Assignment — какие compounds в каком CP);
3. **Сохранённая рабочая база ICC** (то, что инженер редактировал).
Утилита **check_db_sync** сообщает о расхождениях между ними. Расхождение — частая причина «после перезагрузки CP вернулась старая логика» или «изменение пропало».
`,
      classic: `
### В I/A Series V8
Правило: после изменения в ICC — **Download** и **Checkpoint**. Иначе при перезагрузке CP поднимется старая база из checkpoint-файла. check_db_sync запускают перед FAT/SAT и перед изменениями.
`,
      modern: `
### В EcoStruxure Foxboro DCS
Конфигурация хранится в **Galaxy**, загрузка — **Deploy**. Идея та же: конфигурация в репозитории, в контроллере и в checkpoint должна совпадать.
`,
      field: `
### Как говорят на объекте
- «Сделал **чекпойнт**?» — главный вопрос после любого изменения.
- «Базы **разъехались**, прогони check_db_sync».
`,
      practice: [
        { label: 'Контроль: откройте STA и ECB compounds в FoxSelect', view: 'control', scenario: 'tank' },
        { label: 'Инженерный вид: Download и проверка базы', view: 'engineering' },
      ],
      quiz: [
        one('o2l2q1', 'Максимальная длина имени compound?', ['6 символов', '8 символов', '12 символов', '32 символа'], 2, 'До 12 символов, уникально во всей сети.', S),
        tf('o2l2q2', 'В Station compound (STA) можно добавить свои блоки.', false, 'STA нельзя удалить и нельзя в него добавлять блоки.', S),
        one('o2l2q3', 'Сколько PRIMARY_ECB по умолчанию у FCP280?', ['1', '2', '4', '8'], 2, 'PRIMARY_ECB … PRIMARY_ECB4 — по одному на канал I/O.', S),
        one('o2l2q4', 'Что сравнивает check_db_sync?', ['Время на станциях', 'Checkpoint, CSA и рабочую базу ICC', 'Пароли', 'Тренды и историю'], 1, 'Три базы, которые должны совпадать.', S),
        one('o2l2q5', 'Где видны BPC, загрузка CP и включение автоматического checkpoint?', ['В ECB compound', 'В Station compound (STA)', 'В FoxDraw', 'В TA'], 1, 'Блок STATION в compound <letterbug>_STA.', S),
      ],
      interview: [
        iq(
          'o2l2i1',
          'После перезагрузки CP изменение, сделанное вчера, пропало. Почему и как предотвратить?',
          [
            ['CP загрузился из старого checkpoint', 'checkpoint'],
            ['После download не сделали checkpoint', 'download'],
            ['Проверить check_db_sync', 'check_db_sync'],
            ['Процедура изменений: download, checkpoint, проверка', 'процедур', 'change control'],
          ],
          'CP при старте грузит базу из checkpoint-файла на хосте. Скорее всего изменение сделали download в CP, но checkpoint не сделали, и после перезагрузки поднялась старая база. Надо прогнать check_db_sync (сравнивает checkpoint, CSA и рабочую базу ICC), повторить download и сделать checkpoint. Чтобы не повторялось: в процедуре изменений (change control) шаг «checkpoint и проверка» обязателен, можно включить автоматический checkpoint в STA.',
        ),
      ],
    },
  ],
}
