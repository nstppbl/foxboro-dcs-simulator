import { useState } from 'react'
import { compareToCp } from '../../engine/config'
import { useLang } from '../../i18n/i18n'
import { useEng } from '../../store/engineering'
import { useL } from '../control/ui'

const SEV: Record<string, string> = { error: 'text-red-700', warning: 'text-amber-700', info: 'text-sky-700' }

export function EngBottomPanel() {
  const L = useL()
  const { lang } = useLang()
  const { cfg, cp, issues, log, selectCompound, selectBlock } = useEng()
  const [tab, setTab] = useState<'val' | 'log' | 'cmp'>('val')
  const rows = tab === 'cmp' ? compareToCp(cfg, cp).filter((r) => r.where !== 'SAME') : []
  return (
    <div className="flex flex-col min-h-0 h-full bg-white">
      <div className="flex border-b border-fox-edge bg-fox-panel text-xs">
        {(
          [
            ['val', L('Validation', 'Проверка') + (issues ? ` (${issues.length})` : '')],
            ['log', L('Download log', 'Журнал загрузки')],
            ['cmp', 'Compare to CP'],
          ] as const
        ).map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1 border-r border-fox-edge ${tab === k ? 'bg-white font-semibold' : ''}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto text-[12px] p-1">
        {tab === 'val' &&
          (!issues ? (
            <div className="text-gray-500 p-1">{L('Press Validate to check the configuration.', 'Нажмите Validate, чтобы проверить конфигурацию.')}</div>
          ) : issues.length === 0 ? (
            <div className="text-green-700 p-1">{L('Validation passed: no errors, no warnings.', 'Проверка пройдена: ошибок и предупреждений нет.')}</div>
          ) : (
            issues.map((i, n) => (
              <div
                key={n}
                className="flex gap-2 px-1 hover:bg-fox-panel2 cursor-pointer"
                onClick={() => {
                  const [c, b] = i.ref.split(':')
                  selectCompound(c)
                  if (b) selectBlock(b)
                }}
              >
                <span className={`w-16 uppercase font-semibold ${SEV[i.sev]}`}>{i.sev}</span>
                <span className="font-mono w-48 shrink-0">
                  {i.ref}
                  {i.param ? `.${i.param}` : ''}
                </span>
                <span>
                  {i.msg[lang]}
                  {i.page && <span className="text-gray-400"> · p. {i.page}</span>}
                </span>
              </div>
            ))
          ))}
        {tab === 'log' && <pre className="font-mono text-[11px] whitespace-pre-wrap">{log.join('\n') || '—'}</pre>}
        {tab === 'cmp' && (
          <>
            <p className="text-[11px] text-gray-600 mb-1">
              {L('Differences between the configuration database and the CP (only differing objects are listed).', 'Различия между базой конфигурации и CP (показаны только отличающиеся объекты).')}
            </p>
            {rows.length === 0 ? (
              <div className="text-green-700">{L('Configuration and CP match.', 'Конфигурация и CP совпадают.')}</div>
            ) : (
              <table className="font-mono text-[11px]">
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.ref}>
                      <td className="pr-4">{r.ref}</td>
                      <td className={`pr-4 ${r.where === 'DIFFERENT' ? 'text-amber-700' : r.where === 'CP ONLY' ? 'text-red-700' : 'text-sky-700'}`}>{r.where}</td>
                      <td>{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  )
}
