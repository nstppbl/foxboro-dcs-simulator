import type { Bilingual } from '../../domain/hardware/catalog'

/** Short theory notes for Module 1, condensed from manual 2001V8 chapter 2. */
export const THEORY: { title: Bilingual; src: string; points: Bilingual[] }[] = [
  {
    title: { en: 'Signal chain of a loop', ru: 'Цепочка сигнала контура' },
    src: '4-14',
    points: [
      { en: 'Transmitter → TA → FBM converts the field signal to digital.', ru: 'Датчик → TA → FBM преобразует полевой сигнал в цифровой.' },
      { en: 'The CP polls the FBM through an Equipment Control Block (ECB).', ru: 'CP опрашивает FBM через Equipment Control Block (ECB).' },
      { en: 'AIN converts counts to engineering units → PID compares with SPT → AOUT → ECB → FBM → valve.', ru: 'AIN переводит counts в инженерные единицы → PID сравнивает с SPT → AOUT → ECB → FBM → клапан.' },
    ],
  },
  {
    title: { en: 'FCP270 vs ZCP270', ru: 'FCP270 и ZCP270' },
    src: '2-45',
    points: [
      { en: 'FCP270: DIN form factor, field-mounted, talks to FBMs directly (32 200-Series FBMs, 128 with FEM).', ru: 'FCP270: DIN-форм-фактор, монтаж в поле, работает с FBM напрямую (32 FBM 200-й серии, 128 с FEM).' },
      { en: 'ZCP270: Z form factor, Cellbus-mounted, reaches FBMs only via FCM100Et (max 128 FBMs, 32 FBMs per FCM).', ru: 'ZCP270: форм-фактор Z, на Cellbus, работает с FBM только через FCM100Et (до 128 FBM, 32 FBM на FCM).' },
      { en: 'Both: up to 4000 blocks, optional fault-tolerant pair, reboot < 10 s from memory-resident image.', ru: 'Оба: до 4000 блоков, опционально FT-пара, перезагрузка < 10 с.' },
    ],
  },
  {
    title: { en: 'Letterbugs', ru: 'Letterbug' },
    src: '2-73',
    points: [
      { en: 'Each station/module has a unique 6-character letterbug.', ru: 'Каждая станция/модуль имеет уникальный 6-символьный letterbug.' },
      { en: 'FBM: first four characters come from the host (FCP/FCM), 5th = baseplate, 6th = position.', ru: 'FBM: первые четыре символа задаёт хост (FCP/FCM), 5-й = базовая плата, 6-й = позиция.' },
      { en: 'Controllers are assigned via the infrared Letterbug Configurator.', ru: 'Контроллерам letterbug назначается через ИК Letterbug Configurator.' },
    ],
  },
  {
    title: { en: 'MESH Control Network', ru: 'Сеть MESH Control Network' },
    src: '2-99',
    points: [
      { en: 'Switched Fast/Gigabit Ethernet with managed switches only; RSTP manages redundant paths.', ru: 'Коммутируемый Fast/Gigabit Ethernet только на управляемых коммутаторах; RSTP управляет резервными путями.' },
      { en: 'Each station connects to two switches (A and B) so one failure does not interrupt communication.', ru: 'Каждая станция подключается к двум коммутаторам (A и B), чтобы один отказ не прерывал связь.' },
      { en: 'Topologies: Linear (≤ 2 switches), Ring (3-7), Star (preferred for medium/large), Inverted Tree (≤ 4 tiers).', ru: 'Топологии: Linear (≤ 2 коммутаторов), Ring (3-7), Star (предпочтительна), Inverted Tree (≤ 4 уровней).' },
      { en: 'No more than seven switches between any two stations (RSTP limit).', ru: 'Не более семи коммутаторов между любыми двумя станциями (ограничение RSTP).' },
    ],
  },
]
