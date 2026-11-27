import { iq, many, num, one, tf } from '../q'
import type { Module } from '../types'

const S = '2300v8 M2'

export const O3: Module = {
  id: 'o3',
  n: 3,
  course: 'ops',
  title: { ru: 'Рабочее место оператора (FoxView)', en: 'Operator workstation (FoxView)' },
  goal: {
    ru: 'Уверенно работать с устройствами станции и окном FoxView: вызывать дисплеи и overlays, узнавать pickable-объекты, менять окружение (environment), пользоваться меню File, display bar, кнопками System и Process.',
    en: 'Use the workstation devices and the FoxView window: call up displays and overlays, recognise pickable objects, change environments, use the File menu, display bar and the System and Process keys.',
  },
  lessons: [
    {
      id: 'o3l1',
      title: { ru: 'Устройства станции и навигация в FoxView', en: 'Workstation devices and FoxView navigation' },
      minutes: 20,
      base: `
### Устройства рабочего места
- **Picking devices** (указатели): трекбол, мышь, **тачскрин**, цифровая клавиатура. Чтобы выбрать объект: навести курсор и выбрать (pick).
- **Annunciator Keyboard** (панель аннунциатора): к кнопкам назначены дисплеи, рядом лампы, которые **мигают при тревогах** своего участка; есть кнопка **сирены** (Silence Horn) и проверка ламп (Test Lights).
- **Принтеры**: цветной (копия экрана) и **принтер тревог** (печатает сообщение о каждой тревоге). Могут быть локальными или общими в сети.

### Pickable (выбираемые) объекты
Объекты мнемосхемы, настроенные выполнять действие при выборе. Обычно это:
- пункты **меню** сверху;
- кнопки **display bar**;
- **прямоугольники с текстом** (TO SHIPPING, FROM GRINDING — переход на соседнюю схему);
- **символы оборудования**: клапаны, насосы, шнеки, конвейеры (открывают faceplate).
Чаще всего выбор объекта **вызывает другой дисплей** или overlay.

### Окно FoxView
- **Menu bar** сверху: доступ к Plant Overview и дисплеям участков, меню **File**.
- **Display bar** слева: быстрый доступ к часто нужным дисплеям, печать экрана, программы; **8 или 18 кнопок**; содержимое можно менять.
- **Кнопки тревог**:
  - **System** — системные (аппаратные) тревоги, открывает **System Manager**;
  - **Process** — тревоги процесса, открывает **Current Alarms** (CAD), там же квитирование.
- Значок FoxView — меню окна; справа сверху: свернуть, развернуть, **X** (FoxView **перезапустится**, а не просто закроется).

### Меню File — главное
| Пункт | Что делает |
|---|---|
| **Change Environment** | сменить окружение (то же, что Change Env; **Ctrl+E**) |
| **FoxSelect** | список всех CP и их compounds/блоков: поиск, включить/выключить compound, детали |
| **Proc_Summary** | печать отчётов Process Summary |
| **Print** | печать текущего дисплея |
| **Additional FoxView** | ещё один экземпляр FoxView |
| **Select Point** / **Select Trend** | для тачскрина (правая кнопка недоступна): назначить точку на перо тренда / открыть настройку тренда |
| **1, 2, 3, 4** | последние 4 вызванных дисплея (клавиши 1–4) |

### Окружения (Environments) и пароли
| Environment | Для кого |
|---|---|
| **Initial** | появляется при старте, персоналом обычно не используется |
| **Operator** | нормальная работа: задания, квитирование тревог |
| **Process_Eng** | всё, что у оператора, + инструменты конфигурации (FoxDraw и т. п.) |
| **Softw_Eng** | всё выше + системное ПО и программирование |

Вход в защищённое окружение — по **паролю**; пароли **чувствительны к регистру**; неверный пароль — сообщение **Incorrect Password**.

### Current Alarms Display
Открывается кнопкой **Process**: показывает тревоги с высшим приоритетом, новые и неквитированные сверху (подробно — модуль O4).
`,
      classic: `
### В I/A Series V8
Всё это — FoxView. Display bar и окружения настраиваются инженером (файлы окружений, права). На многих объектах окружение Operator без пароля, Process_Eng и Softw_Eng — с паролем.
`,
      modern: `
### В EcoStruxure Foxboro DCS
В Control HMI вместо display bar и menu bar — **Framer** (навигация, панель тревог), вместо FoxSelect — Navigation/Block Select Browser. Роли пользователей вместо окружений, вход по учётной записи (для GMP — персональной).
`,
      field: `
### Как говорят на объекте
- «Перейди в **инженерное окружение**» — Process_Eng.
- «**Кликабельный**» объект — pickable.
- «Нажми **Process**, посмотри CAD».
- «FoxView **респавнится**» — закрыли X, окно перезапустилось.
`,
      practice: [
        { label: 'Оператор: найдите pickable-объекты на мнемосхеме и откройте faceplate', view: 'operator', scenario: 'tank' },
        { label: 'Оператор: кнопка Process → Alarm Manager', view: 'operator', scenario: 'batch' },
      ],
      quiz: [
        one('o3l1q1', 'Что открывает кнопка System?', ['Current Alarms', 'System Manager', 'FoxSelect', 'FoxDraw'], 1, 'System — аппаратные тревоги, System Manager. Process — Current Alarms.', S),
        one('o3l1q2', 'Какое сочетание клавиш меняет окружение?', ['Ctrl+A', 'Ctrl+E', 'Alt+F4', 'F1'], 1, 'Change Environment, Ctrl+E.', S),
        many('o3l1q3', 'Что обычно является pickable-объектом?', ['Пункты menu bar', 'Кнопки display bar', 'Прямоугольник «TO SHIPPING»', 'Символ насоса', 'Фоновая заливка'], [0, 1, 2, 3], 'Фон обычно не выбирается.', S),
        one('o3l1q4', 'Какое окружение даёт FoxDraw, но не системное программирование?', ['Initial', 'Operator', 'Process_Eng', 'Softw_Eng'], 2, 'Process_Eng = Operator + конфигурационные инструменты.', S),
        tf('o3l1q5', 'Пароли окружений нечувствительны к регистру.', false, 'Чувствительны; неверный — Incorrect Password.', S),
        one('o3l1q6', 'Что произойдёт, если нажать X в правом верхнем углу FoxView?', ['Станция выключится', 'FoxView перезапустится', 'CP остановится', 'Ничего'], 1, 'X — FoxView re-spawn.', S),
        num('o3l1q7', 'Сколько последних дисплеев доступно в меню File по номерам?', 4, 'Пункты 1–4.', S),
        one('o3l1q8', 'Как назначить точку на перо тренда с тачскрина (правой кнопки нет)?', ['File → Select Point', 'File → Print', 'Ctrl+E', 'Двойной тап по фону'], 0, 'Select Point, затем точка, затем появившийся бокс.', S),
      ],
      interview: [
        iq(
          'o3l1i1',
          'Как в FoxView разграничить, что может оператор и что инженер?',
          [
            ['Окружения Operator / Process_Eng / Softw_Eng', 'окружен', 'environment'],
            ['Пароль на инженерные окружения', 'пароль'],
            ['Что оператор может менять на faceplate (settable)', 'settable', 'faceplate'],
            ['Для GMP — персональные учётные записи и audit trail', 'audit', 'gmp'],
          ],
          'В FoxView права задаются окружениями (environment): Operator — нормальная работа, Process_Eng — плюс конфигурация, Softw_Eng — плюс системное ПО. На инженерные окружения ставят пароль. Что оператор может менять на faceplate, определяется параметрами блоков (settable/secured) и доступом окружения. Для GMP этого мало: нужны персональные учётные записи, audit trail изменений, — в новой системе это делается ролями пользователей.',
        ),
      ],
    },
  ],
}
