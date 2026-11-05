import { BookOpen, Cpu, Network, Monitor, Wrench, Workflow } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ArchitectureBuilder } from './features/architecture/ArchitectureBuilder'
import { useLang, useT, type UiKey } from './i18n/i18n'

type View = 'architecture' | 'control' | 'engineering' | 'operator' | 'faults' | 'curriculum'

const NAV: { id: View; key: UiKey; icon: typeof Network; ready: boolean }[] = [
  { id: 'architecture', key: 'nav_architecture', icon: Network, ready: true },
  { id: 'control', key: 'nav_control', icon: Cpu, ready: false },
  { id: 'engineering', key: 'nav_engineering', icon: Workflow, ready: false },
  { id: 'operator', key: 'nav_operator', icon: Monitor, ready: false },
  { id: 'faults', key: 'nav_faults', icon: Wrench, ready: false },
  { id: 'curriculum', key: 'nav_curriculum', icon: BookOpen, ready: false },
]

export default function App() {
  const { t } = useT()
  const { lang, setLang } = useLang()
  const [view, setView] = useState<View>('architecture')
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const h = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(h)
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* FoxView-style system bar */}
      <header className="flex items-center gap-3 bg-[#3a4450] text-white px-3 py-1 border-b-2 border-black">
        <div className="font-semibold tracking-wide">{t('appTitle')}</div>
        <div className="text-[11px] text-gray-300 font-mono">ENV: Initial · USER: trainee</div>
        <div className="flex-1" />
        <div className="font-mono text-xs">{now.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB')}</div>
        <div className="flex border border-gray-400">
          {(['ru', 'en'] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`px-2 text-xs uppercase ${lang === l ? 'bg-white text-black' : 'hover:bg-gray-600'}`} data-lang={l}>
              {l}
            </button>
          ))}
        </div>
      </header>
      <div className="flex-1 flex min-h-0">
        <nav className="w-52 bg-fox-panel border-r border-fox-edge flex flex-col">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`flex items-start gap-2 text-left px-3 py-2 border-b border-fox-edge/40 text-xs ${view === n.id ? 'bg-fox-navy text-white' : 'hover:bg-white'}`}
            >
              <n.icon size={16} className="shrink-0 mt-0.5" />
              <span>
                {t(n.key)}
                {!n.ready && <span className="block text-[10px] opacity-70">{t('soon')}</span>}
              </span>
            </button>
          ))}
        </nav>
        <main className="flex-1 min-w-0 min-h-0">
          {view === 'architecture' ? (
            <ArchitectureBuilder />
          ) : (
            <div className="p-8 text-sm text-gray-800">{t('stageNote')}</div>
          )}
        </main>
      </div>
    </div>
  )
}
