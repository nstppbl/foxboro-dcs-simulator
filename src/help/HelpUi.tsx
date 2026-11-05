import { BookOpen, HelpCircle, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CATALOG, CATALOG_BY_ID, FAMILY_LABEL, FAMILY_ORDER, type Bilingual } from '../domain/hardware/catalog'
import { BLOCK_TYPES } from '../engine/registry'
import { useLang } from '../i18n/i18n'
import { BLOCK_HELP, PARAM_RU, SCREEN_HELP, type HelpDoc } from './content'
import { resolve, useHelp } from './help'

const useB = () => {
  const { lang } = useLang()
  return (b?: Bilingual) => (b ? (lang === 'ru' ? b.ru : b.en) : '')
}

/** Small "?" button that opens one help topic. */
export function HelpButton({ topic, className = '', light = false }: { topic: string; className?: string; light?: boolean }) {
  const open = useHelp((s) => s.open)
  return (
    <button
      type="button"
      title="?"
      aria-label="help"
      data-help={topic}
      onClick={(e) => {
        e.stopPropagation()
        open(topic)
      }}
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none shrink-0 ${light ? 'bg-white/20 text-white hover:bg-white/40' : 'bg-fox-navy/15 text-fox-navy hover:bg-fox-navy hover:text-white'} ${className}`}
    >
      ?
    </button>
  )
}

/** Header controls: help mode toggle and Reference. Also handles F1, Esc and the help-mode click capture. */
export function HelpControls() {
  const { lang } = useLang()
  const mode = useHelp((s) => s.mode)
  const { setMode, open, openIndex } = useHelp.getState()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        setMode(!useHelp.getState().mode)
      } else if (e.key === 'Escape') {
        if (useHelp.getState().mode) setMode(false)
        else useHelp.getState().close()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (!useHelp.getState().mode) return
      const el = (e.target as HTMLElement).closest('[data-help]')
      // clicks on the help controls themselves are let through
      if ((e.target as HTMLElement).closest('[data-help-ui]')) return
      e.preventDefault()
      e.stopPropagation()
      if (el) open(el.getAttribute('data-help')!)
      else setMode(false)
    }
    const block = (e: Event) => {
      if (useHelp.getState().mode && !(e.target as HTMLElement).closest('[data-help-ui]')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick, true)
    window.addEventListener('pointerdown', block, true)
    window.addEventListener('mousedown', block, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('pointerdown', block, true)
      window.removeEventListener('mousedown', block, true)
    }
  }, [open, setMode])

  useEffect(() => {
    document.body.classList.toggle('help-mode', mode)
  }, [mode])

  return (
    <div className="flex border border-gray-400" data-help-ui>
      <button
        onClick={() => setMode(!mode)}
        className={`flex items-center gap-1 px-2 text-xs ${mode ? 'bg-yellow-300 text-black' : 'hover:bg-gray-600'}`}
        title={lang === 'ru' ? 'Режим справки: щёлкните по любому элементу (F1)' : 'Help mode: click any element (F1)'}
        data-testid="help-mode"
      >
        <HelpCircle size={13} /> {lang === 'ru' ? 'Справка' : 'Help'}
      </button>
      <button onClick={openIndex} className="flex items-center gap-1 px-2 text-xs border-l border-gray-400 hover:bg-gray-600" data-testid="help-index">
        <BookOpen size={13} /> {lang === 'ru' ? 'Справочник' : 'Reference'}
      </button>
    </div>
  )
}

function DocView({ doc, block }: { doc: HelpDoc; block?: string }) {
  const B = useB()
  const { lang } = useLang()
  const open = useHelp((s) => s.open)
  const T = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const def = block ? BLOCK_TYPES[block] : undefined
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">{B(doc.title)}</h2>
      <p>{B(doc.what)}</p>
      {doc.how && (
        <div>
          <h3 className="help-h">{T('How it works', 'Как это работает')}</h3>
          <ul className="list-disc pl-5 space-y-1">
            {doc.how.map((h, i) => (
              <li key={i}>{B(h)}</li>
            ))}
          </ul>
        </div>
      )}
      {doc.use && (
        <div>
          <h3 className="help-h">{T('Typical use', 'Где применяется')}</h3>
          <p>{B(doc.use)}</p>
        </div>
      )}
      {doc.keys && (
        <div>
          <h3 className="help-h">{T('Key parameters', 'Ключевые параметры')}</h3>
          <table className="w-full text-[12px]">
            <tbody>
              {doc.keys.map((k) => {
                const d = def?.params.find((p) => p.name === k)
                return (
                  <tr key={k} className="border-b border-fox-edge/20 align-top cursor-pointer hover:bg-fox-panel" onClick={() => open(`param:${block ? `${block}.` : ''}${k}`)}>
                    <td className="font-mono font-semibold pr-2 py-0.5 whitespace-nowrap text-fox-navy underline decoration-dotted">{k}</td>
                    <td className="py-0.5">{lang === 'ru' ? (PARAM_RU[k] ?? d?.desc) : (d?.desc ?? PARAM_RU[k])}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {doc.pitfalls && (
        <div>
          <h3 className="help-h">{T('Common mistakes', 'Частые ошибки')}</h3>
          <ul className="list-disc pl-5 space-y-1">
            {doc.pitfalls.map((h, i) => (
              <li key={i}>{B(h)}</li>
            ))}
          </ul>
        </div>
      )}
      {doc.tryIt && (
        <div className="bg-yellow-50 border border-yellow-300 p-2">
          <b>{T('Try it: ', 'Попробуйте: ')}</b>
          {B(doc.tryIt)}
        </div>
      )}
      {def && (
        <details>
          <summary className="cursor-pointer help-h">
            {T('All parameters', 'Все параметры')} ({def.params.length})
          </summary>
          <div className="flex flex-wrap gap-1 mt-1">
            {def.params.map((p) => (
              <button key={p.name} className="font-mono text-[11px] border border-fox-edge/50 px-1 hover:bg-fox-navy hover:text-white" onClick={() => open(`param:${block}.${p.name}`)}>
                {p.name}
              </button>
            ))}
          </div>
        </details>
      )}
      {doc.src && (
        <div className="text-[11px] text-gray-500">
          {T('Manual 2001V8, p. ', 'Руководство 2001V8, стр. ')}
          {doc.src}
        </div>
      )}
    </div>
  )
}

function Content({ topic }: { topic: string }) {
  const B = useB()
  const { lang } = useLang()
  const open = useHelp((s) => s.open)
  const T = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const r = resolve(topic)
  if (r.kind === 'doc') return <DocView doc={r.doc} block={r.block} />
  if (r.kind === 'param') {
    const p = r.p
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold font-mono">{p.name}</h2>
        {lang === 'ru' && p.ru && <p>{p.ru}</p>}
        {p.en && <p className={lang === 'ru' ? 'text-gray-600 italic' : ''}>{p.en}</p>}
        <table className="text-[12px]">
          <tbody>
            {p.kind && (
              <tr>
                <td className="pr-3 text-gray-500">{T('Kind', 'Вид')}</td>
                <td>{p.kind === 'in' ? T('input', 'вход') : p.kind === 'out' ? T('output', 'выход') : T('configuration', 'конфигурация')}</td>
              </tr>
            )}
            {p.def !== undefined && (
              <tr>
                <td className="pr-3 text-gray-500">{T('Default', 'По умолчанию')}</td>
                <td className="font-mono">{String(p.def) || '""'}</td>
              </tr>
            )}
            <tr>
              <td className="pr-3 text-gray-500">{T('Connectable', 'Можно подключить C:B.P')}</td>
              <td>{p.conn ? T('yes', 'да') : T('no', 'нет')}</td>
            </tr>
            <tr>
              <td className="pr-3 text-gray-500">{T('Operator can change', 'Оператор может менять')}</td>
              <td>{p.settable ? T('yes (if not connected)', 'да (если не подключён)') : T('no, configuration only', 'нет, только в конфигурации')}</td>
            </tr>
          </tbody>
        </table>
        <div>
          <h3 className="help-h">{T('Found in blocks', 'Есть в блоках')}</h3>
          <div className="flex flex-wrap gap-1">
            {p.types.map((t) => (
              <button key={t} className="font-mono text-[11px] border border-fox-edge/50 px-1 hover:bg-fox-navy hover:text-white" onClick={() => open(`block:${t}`)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {p.src && (
          <div className="text-[11px] text-gray-500">
            {T('Manual 2001V8, p. ', 'Руководство 2001V8, стр. ')}
            {p.src}
          </div>
        )}
      </div>
    )
  }
  if (r.kind === 'hw') {
    const c = CATALOG_BY_ID[r.id]
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold">{c.label}</h2>
        <div className="text-[11px] text-gray-500">
          {B(FAMILY_LABEL[c.family])} · {c.era === 'classic' ? 'I/A Series v8' : c.era === 'modern' ? 'Foxboro DCS (modern)' : 'I/A Series + Foxboro DCS'}
        </div>
        <p>{B(c.desc)}</p>
        <table className="text-[12px]">
          <tbody>
            {c.channels && (
              <tr>
                <td className="pr-3 text-gray-500">{T('Channels', 'Каналы')}</td>
                <td>{c.channels.map((g) => `${g.count} × ${g.signal}`).join(', ')}</td>
              </tr>
            )}
            {c.maxFbms !== undefined && (
              <tr>
                <td className="pr-3 text-gray-500">{T('FBMs (direct)', 'FBM (напрямую)')}</td>
                <td>{c.maxFbms}</td>
              </tr>
            )}
            {c.maxBlocks !== undefined && (
              <tr>
                <td className="pr-3 text-gray-500">{T('Max blocks', 'Макс. блоков')}</td>
                <td>{c.maxBlocks}</td>
              </tr>
            )}
            {c.ports !== undefined && (
              <tr>
                <td className="pr-3 text-gray-500">{T('Ports', 'Порты')}</td>
                <td>{c.ports}</td>
              </tr>
            )}
          </tbody>
        </table>
        {c.src && (
          <div className="text-[11px] text-gray-500">
            {T('Manual 2001V8, p. ', 'Руководство 2001V8, стр. ')}
            {c.src}
          </div>
        )}
      </div>
    )
  }
  return (
    <p className="text-gray-500">
      {T('No help for this element yet: ', 'Для этого элемента справки пока нет: ')}
      {r.topic}
    </p>
  )
}

function Index() {
  const B = useB()
  const { lang } = useLang()
  const open = useHelp((s) => s.open)
  const [q, setQ] = useState('')
  const T = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const Q = q.trim().toUpperCase()
  const match = (...s: string[]) => !Q || s.some((x) => x.toUpperCase().includes(Q))
  const params = useMemo(() => {
    const s = new Set<string>()
    for (const t of Object.values(BLOCK_TYPES)) for (const p of t.params) s.add(p.name)
    return [...s].sort()
  }, [])
  const Item = ({ k, label, sub }: { k: string; label: string; sub?: string }) => (
    <button className="block w-full text-left px-2 py-1 hover:bg-fox-panel border-b border-fox-edge/20" onClick={() => open(k)}>
      <span className="font-semibold">{label}</span>
      {sub && <span className="block text-[11px] text-gray-600 truncate">{sub}</span>}
    </button>
  )
  const blocks = Object.keys(BLOCK_TYPES).filter((t) => match(t, B(BLOCK_HELP[t]?.title), B(BLOCK_TYPES[t].desc)))
  const screens = Object.entries(SCREEN_HELP).filter(([, d]) => match(B(d.title), B(d.what)))
  const hw = FAMILY_ORDER.flatMap((f) => CATALOG.filter((c) => c.family === f)).filter((c) => match(c.id, c.label, B(c.desc)))
  const prm = Q ? params.filter((p) => match(p, PARAM_RU[p] ?? '')).slice(0, 80) : []
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 border border-fox-edge px-1 bg-white">
        <Search size={13} className="text-gray-500" />
        <input
          autoFocus
          className="flex-1 outline-none py-1 text-[12px]"
          placeholder={T('Search: PID, PBAND, FBM…', 'Поиск: PID, PBAND, FBM…')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="help-search"
        />
      </div>
      {blocks.length > 0 && (
        <section>
          <h3 className="help-h">{T('Control blocks', 'Блоки управления')}</h3>
          {blocks.map((t) => (
            <Item key={t} k={`block:${t}`} label={BLOCK_HELP[t] ? B(BLOCK_HELP[t].title) : t} sub={B(BLOCK_TYPES[t].desc)} />
          ))}
        </section>
      )}
      {screens.length > 0 && (
        <section>
          <h3 className="help-h">{T('Screens and concepts', 'Экраны и понятия')}</h3>
          {screens.map(([k, d]) => (
            <Item key={k} k={`screen:${k}`} label={B(d.title)} />
          ))}
        </section>
      )}
      {hw.length > 0 && (
        <section>
          <h3 className="help-h">{T('Equipment', 'Оборудование')}</h3>
          {hw.map((c) => (
            <Item key={c.id} k={`hw:${c.id}`} label={c.label} sub={B(FAMILY_LABEL[c.family])} />
          ))}
        </section>
      )}
      {prm.length > 0 && (
        <section>
          <h3 className="help-h">{T('Parameters', 'Параметры')}</h3>
          <div className="flex flex-wrap gap-1">
            {prm.map((p) => (
              <button key={p} className="font-mono text-[11px] border border-fox-edge/50 px-1 hover:bg-fox-navy hover:text-white" onClick={() => open(`param:${p}`)}>
                {p}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Right-hand help drawer. */
export function HelpDrawer() {
  const { lang } = useLang()
  const { topic, index, mode } = useHelp()
  const { close, openIndex } = useHelp.getState()
  const [hist, setHist] = useState<string[]>([])
  useEffect(() => {
    if (topic) setHist((h) => (h[h.length - 1] === topic ? h : [...h.slice(-20), topic]))
  }, [topic])
  const T = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  return (
    <>
      {mode && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[60] bg-yellow-300 text-black text-xs px-3 py-1 shadow pointer-events-none" data-testid="help-banner">
          {T('Help mode: click any element to learn about it · Esc to exit', 'Режим справки: щёлкните по любому элементу, чтобы узнать о нём · Esc — выход')}
        </div>
      )}
      {(topic || index) && (
        <aside className="fixed right-0 top-[34px] bottom-0 z-50 w-full sm:w-[420px] bg-white border-l-2 border-fox-navy shadow-2xl flex flex-col text-[13px]" data-help-ui data-testid="help-drawer">
          <div className="flex items-center gap-2 bg-fox-navy text-white px-2 py-1">
            <HelpCircle size={14} />
            <span className="font-semibold flex-1">{T('Help', 'Справка')}</span>
            {hist.length > 1 && topic && (
              <button
                className="text-xs hover:underline"
                onClick={() => {
                  const h = hist.slice(0, -1)
                  setHist(h)
                  useHelp.getState().open(h[h.length - 1])
                }}
              >
                ← {T('Back', 'Назад')}
              </button>
            )}
            {topic && (
              <button className="text-xs hover:underline" onClick={openIndex}>
                {T('Reference', 'Справочник')}
              </button>
            )}
            <button onClick={close} aria-label="close">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">{index ? <Index /> : topic ? <Content topic={topic} /> : null}</div>
        </aside>
      )}
    </>
  )
}
