import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Bilingual } from '../domain/hardware/catalog'

export type Lang = 'en' | 'ru'

interface LangState {
  lang: Lang
  setLang: (l: Lang) => void
}

export const useLang = create<LangState>()(
  persist((set) => ({ lang: 'ru', setLang: (lang) => set({ lang }) }), { name: 'fox.lang' }),
)

/**
 * UI strings. Foxboro product names, block names and parameter names are
 * intentionally kept in English in both languages.
 */
const UI = {
  appTitle: { en: 'Foxboro DCS Training Simulator', ru: 'Тренажёр Foxboro DCS' },
  nav_architecture: { en: 'Architecture', ru: 'Архитектура' },
  nav_control: { en: 'Control (Compounds & Blocks)', ru: 'Управление (Compounds & Blocks)' },
  nav_engineering: { en: 'Engineering (ICC / Control Editors)', ru: 'Инжиниринг (ICC / Control Editors)' },
  nav_operator: { en: 'Operator (FoxView / Control HMI)', ru: 'Оператор (FoxView / Control HMI)' },
  nav_faults: { en: 'Faults & System Manager', ru: 'Неисправности и System Manager' },
  nav_curriculum: { en: 'Theory & tests', ru: 'Теория и тесты' },
  soon: { en: 'next stage', ru: 'следующий этап' },
  era: { en: 'Era', ru: 'Поколение' },
  era_classic: { en: 'I/A Series', ru: 'I/A Series' },
  era_modern: { en: 'Foxboro DCS', ru: 'Foxboro DCS' },
  era_all: { en: 'All', ru: 'Все' },
  palette: { en: 'Hardware palette', ru: 'Палитра оборудования' },
  palette_hint: { en: 'Drag onto the canvas', ru: 'Перетащите на холст' },
  canvas: { en: 'System topology', ru: 'Топология системы' },
  inspector: { en: 'Properties', ru: 'Свойства' },
  noSelection: { en: 'Select a node or a link to see its properties.', ru: 'Выберите узел или связь, чтобы увидеть свойства.' },
  preset: { en: 'Load system', ru: 'Загрузить систему' },
  mode_select: { en: 'Select / move', ru: 'Выбор / перемещение' },
  mode_connect: { en: 'Wire', ru: 'Соединить' },
  connect_hint: { en: 'Wire mode: click the source node, then the target node. Esc cancels.', ru: 'Режим соединения: щёлкните исходный узел, затем целевой. Esc — отмена.' },
  delete: { en: 'Delete', ru: 'Удалить' },
  fail: { en: 'Fail', ru: 'Отказ' },
  restore: { en: 'Restore', ru: 'Восстановить' },
  trace: { en: 'Trace signal', ru: 'Трассировка сигнала' },
  tab_validation: { en: 'Validation', ru: 'Проверка' },
  tab_trace: { en: 'Signal trace', ru: 'Трассировка' },
  tab_network: { en: 'MESH analysis', ru: 'Анализ MESH' },
  tab_info: { en: 'Theory', ru: 'Теория' },
  noIssues: { en: 'No issues: configuration is valid.', ru: 'Ошибок нет: конфигурация корректна.' },
  traceHint: { en: 'Select an instrument and press "Trace signal" (or double-click it).', ru: 'Выберите прибор и нажмите «Трассировка сигнала» (или дважды щёлкните его).' },
  traceBroken: { en: 'Signal path is BROKEN', ru: 'Путь сигнала ПРЕРВАН' },
  traceOk: { en: 'Signal path is healthy', ru: 'Путь сигнала исправен' },
  type: { en: 'Type', ru: 'Тип' },
  letterbug: { en: 'Letterbug', ru: 'Letterbug' },
  tag: { en: 'Tag', ru: 'Тег' },
  side: { en: 'Network side', ru: 'Сторона сети' },
  role: { en: 'Switch role', ru: 'Роль коммутатора' },
  range: { en: 'Range (LO / HI / EU)', ru: 'Диапазон (LO / HI / EU)' },
  channels: { en: 'Channels', ru: 'Каналы' },
  capacity: { en: 'Capacity', ru: 'Загрузка' },
  connections: { en: 'Connections', ru: 'Соединения' },
  manualRef: { en: 'Manual 2001V8, page', ru: 'Руководство 2001V8, стр.' },
  topology: { en: 'Detected topology', ru: 'Определённая топология' },
  switches: { en: 'Switches', ru: 'Коммутаторы' },
  maxHops: { en: 'Max switches between stations (RSTP limit 7)', ru: 'Макс. коммутаторов между станциями (лимит RSTP 7)' },
  spof: { en: 'Single points of failure', ru: 'Единые точки отказа' },
  none: { en: 'none', ru: 'нет' },
  unreachable: { en: 'Stations that cannot communicate now', ru: 'Станции без связи сейчас' },
  nonRedundant: { en: 'Stations without A/B redundancy', ru: 'Станции без резервирования A/B' },
  failedNodes: { en: 'Failed components', ru: 'Отказавшие компоненты' },
  restoreAll: { en: 'Restore all', ru: 'Восстановить все' },
  link: { en: 'Link', ru: 'Связь' },
  channel: { en: 'Channel', ru: 'Канал' },
  reset: { en: 'Reset view', ru: 'Сбросить вид' },
  confirmLoad: { en: 'Replace the current topology?', ru: 'Заменить текущую топологию?' },
  stageNote: {
    en: 'This area arrives in a later stage of the build plan.',
    ru: 'Этот раздел появится на одном из следующих этапов плана.',
  },
} satisfies Record<string, Bilingual>

export type UiKey = keyof typeof UI

export function useT() {
  const lang = useLang((s) => s.lang)
  const t = (k: UiKey) => UI[k][lang]
  const tb = (b: Bilingual | undefined) => (b ? b[lang] : '')
  return { t, tb, lang }
}
