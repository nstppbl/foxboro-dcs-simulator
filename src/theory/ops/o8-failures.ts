import { iq, many, one, tf } from '../q'
import type { Module } from '../types'

const S = '2300v8 M7'

export const O8: Module = {
  id: 'o8',
  n: 8,
  course: 'ops',
  title: { ru: 'Поиск отказавших компонентов', en: 'Locating failed components' },
  goal: {
    ru: 'Понимать, что теряется при отказе AW, WP, CP, FBM, FCM и сети; находить отказ через кнопку System, System Manager, LED и MID; квитировать системные тревоги; знать про master timekeeper.',
    en: 'Know what is lost when an AW, WP, CP, FBM, FCM or the network fails; find the fault via the System key, System Manager, LEDs and the MID; acknowledge system alarms; know the master timekeeper.',
  },
  lessons: [
    {
      id: 'o8l1',
      title: { ru: 'Влияние отказов на систему', en: 'Impact of failures on the system' },
      minutes: 15,
      base: `
### Распределённая архитектура
У каждого компонента своя задача, поэтому **отказ одного компонента не останавливает всю систему** — пропадают только его функции. Но не везде стоит резервирование (fault-tolerant), поэтому надо знать последствия отказа **одиночных** устройств.

| Компонент | Что делает | Что теряется при отказе |
|---|---|---|
| **AW** (Application Workstation) | хост для CP, Historian, системные тревоги, инженерные инструменты | **сбор истории** (если на ней Historian), **системные тревоги**; CP продолжают работать, но без хоста не загрузятся после перезапуска |
| **WP** (Workstation Processor) | окно оператора | этот пульт; оператор переходит на другой WP |
| **CP** | выполняет управление | управление его контурами; **FBM уходят в fail-safe или держат последнее значение** (как настроено) |
| **FBM** | I/O | от **одного канала** до **всего модуля**; блоки получают BAD |
| **FCM** | связь ZCP270 с FBM | все FBM за этим FCM |
| **Сеть MESH** | связь станций | при резервировании (A/B, RSTP) — ничего; без него — связь станций за отказавшим участком |

### AW и WP
AW и WP — по сути одинаковые станции с разным ПО. AW — сервер, может всё (мониторинг, все дисплеи, все конфигураторы). WP — Windows-станция со своим диском, все операторские дисплеи, обычно без инженерных инструментов; историю и системные тревоги берёт у AW.

### Что настраивают инженеры на AW
Сбор истории, управление тревогами, дисплеи, схемы управления: **аналоговые** (непрерывные), **ladder logic**, **sequence** (HLBL).
`,
      classic: `
### В I/A Series V8
Типовое решение: две AW (одна резервирует Historian/хостинг), CP — FT-пары, критичные FBM — резервированные, MESH — два коммутатора на станцию.
`,
      modern: `
### В EcoStruxure Foxboro DCS
FCP280 с self-hosting загружается из своего flash без хоста. Серверы часто виртуализированы (V91/V95), резервирование на уровне виртуальной платформы.
`,
      field: `
### Как говорят на объекте
- «**Упала AW** — истории нет с 2 ночи».
- «Модуль ушёл в **fail-safe**, клапан закрылся».
- «На 201-м **сдох канал**» — отказ одного канала FBM.
`,
      practice: [{ label: 'Архитектура: трассировка пути сигнала и последствия отказа', view: 'architecture' }],
      quiz: [
        one('o8l1q1', 'Отказал одиночный CP. Что с выходами его FBM?', ['Все уходят в 100 %', 'Fail-safe или последнее значение — как настроено', 'Продолжают регулировать', 'Переходят к другому CP'], 1, 'Зависит от настройки fail-safe FBM.', S),
        many('o8l1q2', 'Что теряется при отказе AW с Historian?', ['Сбор исторических данных', 'Системные тревоги', 'Управление всеми CP', 'Хостинг CP при их перезапуске'], [0, 1, 3], 'CP продолжают управлять.', S),
        tf('o8l1q3', 'Отказ FBM всегда означает потерю всех его каналов.', false, 'От одного канала до всего модуля.', S),
        one('o8l1q4', 'Что пропадёт при отказе FCM?', ['Только один канал', 'Все FBM за этим FCM', 'Вся сеть', 'Ничего'], 1, 'FCM — связь ZCP270 с FBM.', S),
        one('o8l1q5', 'Чем AW отличается от WP?', ['Ничем', 'Ролью и ПО: AW — сервер, хост, инженерные инструменты; WP — операторские дисплеи', 'WP — только принтер', 'AW без дисплеев'], 1, 'Аппаратно похожи, ПО разное.', S),
      ],
    },
    {
      id: 'o8l2',
      title: { ru: 'System Manager, системные тревоги, время', en: 'System Manager, system alarms, time' },
      minutes: 20,
      base: `
### Как оператор узнаёт об отказе
- **Кнопка System** в строке тревог (под menu bar): **зелёная / мигает зелёным** — активных нет; **красная / мигает красным** — есть активные системные тревоги. Логика мигания — как у кнопки Process.
- **Светодиоды (LED)** на передней панели модулей.
- **Принтер** тревог печатает системные сообщения.

### System Manager Client
Открывается кнопкой **System**. Три области:
- **Navigation pane** — дерево станций; два вида: **по System Monitor** (по доменам мониторинга) и **по Switch** (по подключению к коммутаторам);
- **Information pane** — подробности выбранной станции/модуля;
- **Accessories pane** — вкладки, в т. ч. **Alarms**.

**Цвета статуса**
| Цвет | Значение |
|---|---|
| **чёрный** | OK |
| **красный** | компонент **off-line или отказал** |
| **жёлтый** | **предупреждение**: отказал/off-line один из его **периферийных** устройств (например, FBM под CP) |
| **серый** | **потеряна связь** компонента с шиной |
| **мигание и/или *** | **неквитированное** изменение состояния |

### Квитирование системных тревог
- в menu bar: **Acknowledge All Station Alarms** и отдельно **Acknowledge Cable Alarms** (только тревоги кабелей);
- во вкладке **Alarms** Accessories pane: **Acknowledge All**, **Acknowledge** (одной), **Inhibit Alarm**, **Refresh**;
- правый клик по станции → Actions → Acknowledge (если есть права).

### Поиск отказа по MID
По **MID / letterbug** определяют тип: модуль с окончанием **00** — FCM/процессор, иначе — FBM на позиции baseplate (первые 4 символа — от хоста). Порядок: System → красная/жёлтая станция → раскрыть до модуля → MID и позиция → LED на модуле в шкафу → замена (FBM меняются на ходу).

### Дата и время
- Одна AW — **Master Timekeeper (MTK)**; время может приходить от **GPS**.
- Многие внутренние значения хранятся в **GMT**.
- При изменении даты/времени меняется и время ПК.
- Точное время важно для **истории тревог, SOE, audit trail** (в GMP — обязательно).
`,
      classic: `
### В I/A Series V8
System Manager заменил старые SMDH (System Management Display Handler). Тревоги приходят от **System Monitor** (домены до 64 станций), который настраивается в System Definition.
`,
      modern: `
### В EcoStruxure Foxboro DCS
Тот же System Manager; добавились диагностика сети и виртуальных станций.
`,
      field: `
### Как говорят на объекте
- «Сисменеджер **жёлтый** по CP» — у CP проблемная периферия, скорее всего FBM.
- «Станция **серая**» — нет связи.
- «Квитни **кабельные**» — тревоги кабелей (A/B).
`,
      practice: [{ label: 'Архитектура: упражнения на поиск отказа и путь сигнала', view: 'architecture' }],
      quiz: [
        one('o8l2q1', 'Станция в System Manager жёлтая. Что это значит?', ['Всё OK', 'Отказала она сама', 'Отказало/off-line её периферийное устройство', 'Нет связи'], 2, 'Жёлтый — warning по периферии.', S),
        one('o8l2q2', 'Станция серая. Что это значит?', ['Off-line', 'Потеряна связь с шиной', 'OK', 'Не квитировано'], 1, 'Серый — потеря связи.', S),
        one('o8l2q3', 'Что значит звёздочка (*) или мигание у станции?', ['Резервированная', 'Неквитированное изменение состояния', 'Мастер времени', 'Отключена оператором'], 1, 'Неквитированное изменение здоровья.', S),
        tf('o8l2q4', 'Тревоги кабелей квитируют отдельной кнопкой Acknowledge Cable Alarms.', true, 'Есть отдельная кнопка в menu bar.', S),
        one('o8l2q5', 'Кто задаёт время в системе?', ['Каждый CP сам', 'AW — Master Timekeeper (возможно от GPS)', 'Оператор вручную на каждой станции', 'FBM'], 1, 'Одна AW — MTK.', S),
        many('o8l2q6', 'Какие виды есть в Navigation pane?', ['По System Monitor', 'По Switch', 'По алфавиту FBM', 'По приоритету тревог'], [0, 1], 'Два вида.', S),
      ],
      interview: [
        iq(
          'o8l2i1',
          'Operator reports: System key is red. Walk me through finding the fault.',
          [
            ['Open System Manager from the System key', 'system manager'],
            ['Find red/yellow station in navigation pane, drill down', 'red', 'yellow'],
            ['Read the module MID/letterbug and position', 'mid', 'letterbug'],
            ['Check LEDs in the cabinet, impact on process, replace', 'led', 'replace'],
            ['Acknowledge and record', 'acknowledge'],
          ],
          'I click the System key to open System Manager and look at the navigation pane: a red station is failed or off-line, a yellow one has a failed peripheral, grey means lost communication. I drill down to the module and read its MID or letterbug and position, so I know if it is an FCM or an FBM and which baseplate slot. Then I check what the failure does to the process (which blocks are BAD, which loops are in Hold), tell the operator, check the LEDs in the cabinet and replace the module if needed. Finally I acknowledge the system alarm and record it (in GMP, as an event or deviation if product was affected).',
        ),
      ],
    },
  ],
}
