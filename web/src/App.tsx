import { useCallback, useEffect, useState } from 'react'
import { StructureTree } from './components/StructureTree'
import { TemplateEditor } from './components/TemplateEditor'
import { VariablesPanel } from './components/VariablesPanel'
import {
  fetchDocxBlob,
  getProject,
  getTemplate,
  putProject,
  putTemplate,
  render,
  saveDocxAs,
  type ProjectData,
  type TemplateKey,
} from './api/client'
import { findNode, outlineForDoc } from './schema/outline'
import './App.css'

export default function App() {
  const [doc, setDoc] = useState<TemplateKey>('tz')
  const [project, setProject] = useState<ProjectData>({})
  const [template, setTemplate] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scrollToHeading, setScrollToHeading] = useState<string | undefined>()
  const [scrollNonce, setScrollNonce] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(async (key: TemplateKey) => {
    setLoading(true)
    setError(null)
    try {
      const [proj, tpl] = await Promise.all([getProject(), getTemplate(key)])
      setProject(proj)
      setTemplate(tpl.content)
      setSelectedId(null)
      setScrollToHeading(undefined)
      setScrollNonce(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll(doc)
  }, [doc, loadAll])

  const onSelectSection = (id: string) => {
    setSelectedId(id)
    const node = findNode(outlineForDoc(doc), id)
    if (node?.heading) {
      setScrollToHeading(node.heading)
      setScrollNonce((n) => n + 1)
    }
  }

  const saveProject = async () => {
    setStatus('Сохранение проекта…')
    try {
      const saved = await putProject(project)
      setProject(saved)
      setStatus('Проект сохранён')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  const saveTemplate = async () => {
    setStatus('Сохранение шаблона…')
    try {
      const saved = await putTemplate(doc, template)
      setTemplate(saved.content)
      setStatus(`Шаблон ${doc.toUpperCase()} сохранён`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  const generate = async () => {
    setStatus('Сохранение и генерация…')
    try {
      const savedProj = await putProject(project)
      setProject(savedProj)
      const savedTpl = await putTemplate(doc, template)
      setTemplate(savedTpl.content)
      // On server we still write both; browser offers Save As only for .docx
      const result = await render(doc, 'both')
      const docxPaths = result.written.filter((p) => p.endsWith('.docx'))
      if (docxPaths.length === 0) {
        setStatus('Сгенерировано, но .docx не найден')
        return
      }
      setStatus('Выберите, куда сохранить .docx…')
      const outcomes: string[] = []
      for (const path of docxPaths) {
        const name = path.split('/').pop() ?? path
        const blob = await fetchDocxBlob(name)
        const outcome = await saveDocxAs(blob, name)
        if (outcome === 'cancelled') {
          outcomes.push(`${name}: отменено`)
        } else if (outcome === 'saved') {
          outcomes.push(`${name}: сохранено`)
        } else {
          outcomes.push(`${name}: скачано`)
        }
      }
      setStatus(`Готово — ${outcomes.join('; ')}`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">Vitalych</div>
        <div className="topbar-switch">
          <button
            type="button"
            className={doc === 'tz' ? 'seg active' : 'seg'}
            onClick={() => setDoc('tz')}
          >
            ТЗ
          </button>
          <button
            type="button"
            className={doc === 'pz' ? 'seg active' : 'seg'}
            onClick={() => setDoc('pz')}
          >
            ПЗ
          </button>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn" onClick={() => void saveProject()} disabled={loading}>
            Сохранить проект
          </button>
          <button type="button" className="btn" onClick={() => void saveTemplate()} disabled={loading}>
            Сохранить шаблон
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void generate()} disabled={loading}>
            Сгенерировать
          </button>
        </div>
        <div className="topbar-status" title={status}>
          {status}
        </div>
      </header>

      {error ? (
        <div className="app-error">
          Не удалось загрузить данные: {error}
          <button type="button" className="btn" onClick={() => void loadAll(doc)}>
            Повторить
          </button>
        </div>
      ) : null}

      <div className="app-columns">
        <StructureTree doc={doc} selectedId={selectedId} onSelect={onSelectSection} />
        <main className="center-pane">
          {loading ? (
            <div className="pane-placeholder">Загрузка…</div>
          ) : (
            <TemplateEditor
              value={template}
              onChange={setTemplate}
              scrollToHeading={scrollToHeading}
              scrollNonce={scrollNonce}
            />
          )}
        </main>
        <VariablesPanel data={project} onChange={setProject} />
      </div>
    </div>
  )
}
