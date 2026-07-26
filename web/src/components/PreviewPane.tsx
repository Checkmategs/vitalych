import type { PreviewWarning } from '../api/client'

type Props = {
  html: string
  markdown: string
  warnings: PreviewWarning[]
  error: string | null
  loading: boolean
  onRefresh: () => void
  onCopyMarkdown: () => void
}

export function PreviewPane({
  html,
  markdown,
  warnings,
  error,
  loading,
  onRefresh,
  onCopyMarkdown,
}: Props) {
  return (
    <div className="preview-pane">
      <div className="preview-toolbar">
        <button type="button" className="btn preview-toolbar-btn" onClick={onRefresh} disabled={loading}>
          Обновить
        </button>
        <button
          type="button"
          className="btn preview-toolbar-btn"
          onClick={onCopyMarkdown}
          disabled={loading || !markdown}
        >
          Скопировать MD
        </button>
        {loading ? <span className="preview-toolbar-status">Рендер…</span> : null}
      </div>

      {error ? (
        <div className="preview-error" role="alert">
          <strong>Ошибка шаблона</strong>
          <pre>{error}</pre>
        </div>
      ) : null}

      {!error && warnings.length > 0 ? (
        <ul className="preview-warnings">
          {warnings.map((w, i) => (
            <li key={`${w.code}-${w.path ?? ''}-${i}`}>
              {w.message}
              {w.path ? <span className="preview-warning-path"> ({w.path})</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!error ? (
        <div
          className="preview-html"
          // Server-rendered HTML from our own Jinja→markdown pipeline (trusted local content).
          dangerouslySetInnerHTML={{ __html: html || '<p class="preview-empty">Нет содержимого</p>' }}
        />
      ) : null}
    </div>
  )
}
