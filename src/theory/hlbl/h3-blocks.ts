import { iq, many, num, one, tf } from '../q'
import type { Module } from '../types'

const S = 'HLBL / 2001V8 4-9'

export const H3: Module = {
  id: 'h3',
  n: 3,
  course: 'hlbl',
  title: { ru: 'Блоки IND, DEP, EXC, MON, TIM и как они работают вместе', en: 'IND, DEP, EXC, MON, TIM blocks working together' },
  goal: {
    ru: 'Выбирать тип блока под задачу, понимать взаимодействие нормальной (IND/DEP) и аварийной (MON/EXC) логики, SSTATE compound, и как последовательность командует непрерывными блоками.',
    en: 'Pick the right sequence block, understand how normal (IND/DEP) and abnormal (MON/EXC) logic interact, the compound SSTATE, and how a sequence drives continuous blocks.',
  },
  lessons: [
    {
      id: 'h3l1',
      title: { ru: 'Роли блоков и разделение нормальной и аварийной логики', en: 'Block roles and normal vs abnormal logic' },
      minutes: 25,
      base: `
### Пять блоков домена последовательностей
| Блок | Роль | Пример на R-401 |
|---|---|---|
| **IND** (Independent) | **супервизор**, работает независимо | вызывает фазы по рецепту; постоянный расчёт |
| **DEP** (Dependent) | **нормальные операции**, «зависит» от состояния compound | фазы CHARGE_A, HEAT, REACT |
| **MON** (Monitor) | **следит** за набором условий | «мешалка встала», «TT401 > HH», «давление высокое» |
| **EXC** (Exception) | **аварийная/альтернативная** стратегия | безопасное удержание: пар закрыть, вода на рубашку, подачи закрыть |
| **TIM** (Timer) | **4 таймера** для стратегий | время выдержки, тайм-ауты |

### Почему логику делят
Если в каждой фазе писать проверки «а вдруг мешалка встала», код раздувается, проверки забывают, их трудно тестировать. Foxboro предлагает:
- нормальный путь — **IND + DEP**, чистый и линейный;
- контроль ненормальных условий — **MON**, в одном месте;
- реакция — **EXC**, одна на всё оборудование.

### Как это работает (общая схема)
1. **MON** проверяет свои условия каждый скан.
2. Условие наступило → MON **активирует** заданный блок (обычно **EXC**).
3. Пока **EXC активен**, **DEP**-последовательности compound **приостанавливаются**; **IND** продолжают работать.
4. EXC приводит оборудование в безопасное состояние, сообщает оператору.
5. Дальше — по FDS: оператор устраняет причину и даёт restart (DEP продолжают) или abort.
Точные правила (что именно приостанавливается, как возобновляется) — в описании блоков B0193AX / HLBL B0400DF для вашей версии.

### SSTATE compound
| SSTATE | Значение |
|---|---|
| **0** | все MON/IND/DEP/EXC неактивны |
| **1** | активен хотя бы один MON, IND или DEP, EXC не активен |
| **2** | активен хотя бы один **EXC** |
SSTATE удобно выводить на мнемосхему: «реактор в нормальной работе / в обработке исключения».

### Последовательность командует непрерывными блоками
- **Режимы**: перевести PID в Auto/Manual (MA), Local/Remote (LR).
- **Задания**: SPT (в Local).
- **Выходы**: OUT в Manual (например, 0 % — закрыть).
- **Дискретные**: команды мотору/клапану (в тренажёре — DOUT.IN), чтение подтверждений (DIN.CIN).
- **Блокировки (interlocks)** лучше держать **в непрерывной/ladder-логике** (CALC, логические блоки, ladder в FBM), а не только в HLBL: они должны работать, даже если последовательность остановлена. В R-401 так и сделано: ILK401 (CALC) по HH температуры переключает рубашку на полное охлаждение независимо от фаз.

### Тренажёр
В тренажёре один HLBL-блок (по смыслу DEP/IND). Связку MON → EXC в лабе 5 вы моделируете проверкой условий в цикле выдержки.
`,
      classic: `
### В I/A Series V8
Блоки последовательностей создают на CSD рядом с непрерывными. В ICC у них своя зона в списке блоков compound. MON настраивается списком условий и ссылкой на блок, который запускать.
`,
      modern: `
### В EcoStruxure Foxboro DCS
Те же блоки; в Control Editors есть SFC-редактор. В больших batch-проектах фазы вызывает пакет batch management (по ISA-88), а блоки в CP реализуют логику фаз.
`,
      field: `
### Как говорят на объекте
- «Сработал **MON**, ушли в **EXC**».
- «**SSTATE 2** — реактор в эксепшене».
- «Блокировка должна быть **в CALC**, а не в последовательности».
`,
      practice: [
        { label: 'Лаба 5: REACT — выдержка с мониторингом (как MON → EXC)', view: 'curriculum', lab: 'h5-react' },
        { label: 'R-401: блокировка ILK401 и SW402 работают без последовательности', view: 'control', scenario: 'batch' },
      ],
      quiz: [
        one('h3l1q1', 'Какой блок запускает аварийную стратегию?', ['IND', 'DEP', 'EXC', 'TIM'], 2, 'EXC — exception sequence.', S),
        one('h3l1q2', 'Что обычно происходит с DEP-блоками compound, пока активен EXC?', ['Ничего', 'Приостанавливаются', 'Удаляются', 'Переходят в IND'], 1, 'DEP приостанавливаются, IND продолжают (сверяйте с версией).', S),
        num('h3l1q3', 'Чему равен SSTATE, если активен хотя бы один EXC?', 2, '0 — все неактивны, 1 — активны MON/IND/DEP без EXC, 2 — активен EXC.', S),
        tf('h3l1q4', 'Блокировку по HH температуры достаточно реализовать только в HLBL-фазе.', false, 'Блокировки — в непрерывной/ladder-логике, они должны работать и без последовательности.', S),
        many('h3l1q5', 'Что последовательность обычно делает с PID-регулятором?', ['Переводит Auto/Manual', 'Меняет SPT', 'Ставит OUT в Manual', 'Меняет PBAND на ходу'], [0, 1, 2], 'Тюнинг из фазы — плохая практика (кроме особых случаев).', S),
        num('h3l1q6', 'Сколько таймеров в одном блоке TIM?', 4, '4 таймера.', S),
      ],
      interview: [
        iq(
          'h3l1i1',
          'Explain IND, DEP, MON and EXC and how they work together on a batch reactor.',
          [
            ['IND supervisor, DEP normal phases', 'ind', 'dep'],
            ['MON watches abnormal conditions', 'mon'],
            ['EXC runs the safe/alternative strategy', 'exc'],
            ['DEP suspended while EXC active, IND keeps running', 'suspend'],
            ['Interlocks stay in continuous/ladder logic', 'interlock'],
          ],
          'IND is the supervisor: it runs independently, for example it calls the phases in recipe order. DEP blocks do the normal operations: charge, heat, react. MON watches abnormal conditions such as agitator stopped or temperature high, and when one is true it activates an EXC block. EXC runs the alternative strategy: close steam, full cooling, close feeds, message the operator. While EXC is active the DEP sequences are suspended, IND keeps running; SSTATE of the compound becomes 2. Hard interlocks stay in continuous or ladder logic so they work even if the sequence is stopped.',
        ),
      ],
    },
  ],
}
