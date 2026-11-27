import { iq, many, num, one, tf } from '../q'
import type { Module } from '../types'

const S = '2300v8 M5'

export const O6: Module = {
  id: 'o6',
  n: 6,
  course: 'ops',
  title: { ru: 'Тренды процесса', en: 'Process control trends' },
  goal: {
    ru: 'Читать и настраивать тренды FoxView: перья, duration и scan rate, Pause & Pick, история, Online и Advanced Trend Configuration, шкалы, scratchpad trends.',
    en: 'Read and configure FoxView trends: pens, duration and scan rate, Pause & Pick, history, Online and Advanced Trend Configuration, scaling, scratchpad trends.',
  },
  lessons: [
    {
      id: 'o6l1',
      title: { ru: 'Чтение трендов, Pause & Pick, история', en: 'Reading trends, Pause & Pick, history' },
      minutes: 20,
      base: `
### Виды трендов
- **1/8-screen trend** — маленький тренд на overlay (например, при выборе парового клапана в Water Heating открывается half-screen overlay с 1/8 трендом).
- **Half-screen trend** — больше информации: **имя блока**, **описание**, **шкала (High/Low)**, единицы.
- Также 1/4 и full-screen (для scratchpad trends).

### Что на тренде
- до **4 перьев** (переменных) на тренд;
- текущие значения над графиком, **цвет значения = цвет линии**;
- **Duration** (длительность окна) в формате **Дни:Часы:Минуты:Секунды** и **scan rate** (как часто обновляется, например 3S);
- время идёт **справа налево**: **правый край — текущий момент**.

Пример: duration 15 мин, scan rate 3 с — линии обновляются каждые 3 с. Half-screen: FC102 (пар, 0–60 000 LBS/HR), TC102 (выход, 0–250 DEGF), TE101 (вход, 0–100 DEGF), duration 12 ч, scan 12 с. Закрыть overlay — **красный знак STOP**.

### Режимы Update и Paused
- **Update** — тренд обновляется со scan rate, значения — текущие.
- **Paused** (кнопка Pause) — тренд заморожен, вместо duration и scan rate показаны дата и время паузы.

### Pause & Pick
После паузы зажмите левую кнопку на графике: появится вертикальная линия времени. Двигайте её — над трендом меняются **время и значения** в этой точке.

### История
Если точка собирается **Historian**, можно смотреть любой период:
- кнопки **◀ / ▶** листают на **половину duration** назад/вперёд;
- клик по **дате/времени под графиком** (после паузы) открывает **History Start Time**: задать начало и duration;
- кнопка **Update** возвращает в реальное время.
`,
      classic: `
### В I/A Series V8
Тренды FoxView строятся по данным CP (реальное время) и **AIM*Historian** (история). Если точка не в Historian — истории нет, только то, что тренд накопил на экране.
`,
      modern: `
### В EcoStruxure Foxboro DCS
В Control HMI — тренды на базе Historian Client: перья, паузы, история похожи. Названия кнопок другие.
`,
      field: `
### Как говорят на объекте
- «Поставь тренд на **паузу** и **пикни**, что было в 10:15».
- «Точки нет в **хисториане**, истории не будет».
`,
      practice: [
        { label: 'Теплообменник: тренд, нагрузка, найдите момент возмущения', view: 'control', scenario: 'hex' },
        { label: 'R-401: тренд температуры реактора и рубашки', view: 'control', scenario: 'batch' },
      ],
      quiz: [
        num('o6l1q1', 'Сколько перьев (переменных) максимум на одном тренде?', 4, 'До 4.', S),
        one('o6l1q2', 'Какой край тренда — текущее время?', ['Левый', 'Правый', 'Верхний', 'Любой'], 1, 'Время идёт справа налево; правый край — сейчас.', S),
        one('o6l1q3', 'Scan rate = 3S. Что это значит?', ['Тренд на 3 секунды', 'Обновление каждые 3 с', '3 пера', '3 страницы истории'], 1, 'Частота обновления.', S),
        one('o6l1q4', 'На сколько листает кнопка ◀ в режиме истории?', ['На всю duration', 'На половину duration', 'На 1 минуту', 'На 1 час'], 1, 'Половина duration.', S),
        tf('o6l1q5', 'Pause & Pick работает только после паузы тренда.', true, 'Сначала Pause, затем линия времени.', S),
        one('o6l1q6', 'Что нужно, чтобы смотреть тренд за прошлую неделю?', ['Ничего', 'Точка должна собираться Historian', 'Перезапустить FoxView', 'Права Softw_Eng'], 1, 'История — из Historian.', S),
      ],
    },
    {
      id: 'o6l2',
      title: { ru: 'Настройка трендов и scratchpad trends', en: 'Trend configuration and scratchpad trends' },
      minutes: 20,
      base: `
### Online Trend Configuration
**Правый клик** в области сетки тренда (с тачскрина — File → Select Trend). Без FoxDraw можно:
- назначить переменную на любое перо и удалить назначение;
- изменить **duration** и **scan rate**;
- выбрать вид: **merged** (все линии на одной сетке) или **banded** (полосами);
- выбрать шкалу пера:
  - **Auto** — по текущим максимумам/минимумам (лучшее разрешение);
  - **User Entered** — max/min вводит пользователь;
  - **CP Values** — шкала как в блоке CP;
  - **Use Current Limits** — однократно взять текущие max/min.
- сохранить **Temporary** (после закрытия тренд вернётся к исходному) или **Permanent** (сохранить в дисплей — если позволяет доступ).

### Advanced Trend Configuration (кнопка Advanced)
**Вкладка графика**: duration и scan rate; **Off-Normal** полосы сверху/снизу; видимость сетки и число делений (1–10); маркеры на линиях; цвета фона, полос, сетки; стиль merged/banded; Temporary/Permanent; метка времени **local/relative**.

**Вкладки перьев**: назначить/удалить переменную, шкала (Auto, User Entered, CP Values, Current Limits), тип данных:
- **Numeric**: **Delta** (минимальное изменение, которое появится на тренде), **единицы**, **Guard Band** (запас для автошкалы: половина добавляется сверху и снизу, меньше пересчётов), **Minimum Span** (минимальный диапазон автошкалы);
- **Boolean**: имена состояний 0 и 1 (Stopped/Running, Closed/Open);
- цвет линии, маркер.

### Назначение пера через Select Point
1. На мнемосхеме правый клик по объекту → список связанных C:B.P → выбрать нужный (копируется в буфер).
2. Открыть тренд, нажать белую кнопку **A** (assign) у пера — точка из буфера назначена.

### Scratchpad trends
Тренды, которые оператор создаёт сам:
- меню **Scratchpad → Trend list**;
- до **20** трендов (кнопки списка); размеры **1/8, 1/4, 1/2, full**; можно задать позицию (ROW/COLUMN или ползунки) и тип (стационарный/перемещаемый);
- кнопка A в списке → ввести label, размер, тип → Save; вызвать — по label;
- перья назначаются так же, как в обычных трендах (Temporary или Permanent).
`,
      classic: `
### В I/A Series V8
Permanent-изменение тренда меняет файл дисплея FoxView. В GMP-среде это изменение конфигурации HMI: часто Permanent запрещён оператору правами окружения.
`,
      modern: `
### В EcoStruxure Foxboro DCS
Ad-hoc тренды в Control HMI / Historian Client. Права на сохранение — по ролям.
`,
      field: `
### Как говорят на объекте
- «Кинь на тренд **TIC401 и TT402**, **бэндед**, 2 часа».
- «Шкала **по CP**, а не авто, а то прыгает».
`,
      practice: [{ label: 'Контроль: тренд и выбор переменных (теплообменник)', view: 'control', scenario: 'hex' }],
      quiz: [
        one('o6l2q1', 'Как открыть Online Trend Configuration мышью?', ['Двойной клик по заголовку', 'Правый клик в области сетки', 'Ctrl+E', 'File → Print'], 1, 'Правый клик в gridded area.', S),
        one('o6l2q2', 'Какая шкала пера берёт диапазон из блока CP?', ['Auto', 'User Entered', 'CP Values', 'Use Current Limits'], 2, 'CP Values.', S),
        tf('o6l2q3', 'Temporary-изменения сохраняются после закрытия тренда.', false, 'После закрытия тренд вернётся к исходному; сохраняет Permanent.', S),
        num('o6l2q4', 'Сколько scratchpad trends можно создать?', 20, 'До 20 в Trend list.', S),
        one('o6l2q5', 'Что делает Guard Band при автошкале?', ['Задаёт цвет', 'Добавляет запас к диапазону, чтобы реже пересчитывать шкалу', 'Ограничивает число перьев', 'Включает тревоги'], 1, 'Половина guard band сверху и снизу.', S),
        many('o6l2q6', 'Что можно сделать в Online Trend Configuration?', ['Назначить/удалить перо', 'Изменить duration и scan rate', 'Merged/banded', 'Изменить алгоритм PID'], [0, 1, 2], 'Алгоритм PID — не здесь.', S),
      ],
      interview: [
        iq(
          'o6l2i1',
          'How would you use trends to troubleshoot an oscillating temperature loop?',
          [
            ['Trend PV, SP and OUT together', 'pv', 'out'],
            ['Pause & Pick / history to find when it started', 'history', 'pause'],
            ['Check valve: OUT oscillates but PV lags, or valve stiction', 'valve', 'stiction'],
            ['Check related variables (cascade secondary, load)', 'cascade', 'secondary'],
          ],
          'I would put PV, SP and OUT of the loop on one trend, plus the cascade secondary and the main load variable. With Pause & Pick and history I find when the oscillation started and whether it lines up with a change (tuning, SP change, a load change). If OUT moves in steps and PV follows late, I suspect valve stiction; a smooth sine with OUT and PV in phase points to tuning that is too aggressive. Then I test in Manual: if the oscillation stops, it is the loop, not the process.',
        ),
      ],
    },
  ],
}
