import { useCallback, useEffect, useState } from 'react'
import { StructureTree } from './components/StructureTree'
import { TemplateEditor } from './components/TemplateEditor'
import { VariablesPanel } from './components/VariablesPanel'
import {
  ProjectBar,
  persistProjectId,
  readStoredProjectId,
} from './components/ProjectBar'
import {
  createProject,
  createVersion,
  fetchDocxBlob,
  getProject,
  listProjects,
  listVersions,
  putProject,
  renderProject,
  restoreVersion,
  saveDocxAs,
  type Project,
  type ProjectData,
  type ProjectSummary,
  type TemplateKey,
  type VersionItem,
} from './api/client'
import { findNode, outlineForDoc } from './schema/outline'
import './App.css'

/** Shared across Strict Mode double-mount so only one default project is created. */
let ensureDefaultProjectInFlight: Promise<ProjectSummary[]> | null = null

/**
 * List projects; if empty, re-list then create at most once (module lock).
 * Concurrent callers share the same in-flight promise and get the resulting list.
 */
async function listOrCreateDefaultProject(): Promise<ProjectSummary[]> {
  let list = await listProjects()
  if (list.length > 0) return list

  if (!ensureDefaultProjectInFlight) {
    ensureDefaultProjectInFlight = (async () => {
      // Re-list immediately before create — another request may have won the race.
      const again = await listProjects()
      if (again.length > 0) return again
      const created = await createProject({ name: 'Новый проект' })
      return [
        {
          id: created.id,
          slug: created.slug,
          name: created.name,
          updated_at: created.updated_at,
        },
      ]
    })().finally(() => {
      ensureDefaultProjectInFlight = null
    })
  }
  return ensureDefaultProjectInFlight
}

export default function App() {
  const [doc, setDoc] = useState<TemplateKey>('tz')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [project, setProject] = useState<ProjectData>({})
  const [template, setTemplate] = useState('')
  const [templateTz, setTemplateTz] = useState('')
  const [templatePz, setTemplatePz] = useState('')
  const [styleProfile, setStyleProfile] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scrollToHeading, setScrollToHeading] = useState<string | undefined>()
  const [scrollNonce, setScrollNonce] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const syncFromProject = useCallback((full: Project, activeDoc: TemplateKey) => {
    setProjectId(full.id)
    persistProjectId(full.id)
    setProject(full.data)
    setTemplateTz(full.template_tz)
    setTemplatePz(full.template_pz)
    setStyleProfile(full.style_profile)
    setTemplate(activeDoc === 'tz' ? full.template_tz : full.template_pz)
  }, [])

  const applyProject = useCallback(
    (full: Project, activeDoc: TemplateKey) => {
      syncFromProject(full, activeDoc)
      setSelectedId(null)
      setScrollToHeading(undefined)
      setScrollNonce(0)
    },
    [syncFromProject],
  )

  const refreshVersions = useCallback(async (id: string) => {
    const items = await listVersions(id)
    setVersions(items)
  }, [])

  const openProject = useCallback(
    async (id: string, activeDoc: TemplateKey) => {
      const full = await getProject(id)
      applyProject(full, activeDoc)
      await refreshVersions(id)
    },
    [applyProject, refreshVersions],
  )

  const loadBootstrap = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const list = await listOrCreateDefaultProject()
      if (signal?.cancelled) return
      setProjects(list)
      const stored = readStoredProjectId()
      const pick = list.find((p) => p.id === stored)?.id ?? list[0].id
      await openProject(pick, 'tz')
      if (signal?.cancelled) return
    } catch (e) {
      if (signal?.cancelled) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (!signal?.cancelled) setLoading(false)
    }
  }, [openProject])

  useEffect(() => {
    const signal = { cancelled: false }
    void loadBootstrap(signal)
    return () => {
      signal.cancelled = true
    }
  }, [loadBootstrap])

  const templatesForPut = (activeDoc: TemplateKey, activeTemplate: string) => ({
    template_tz: activeDoc === 'tz' ? activeTemplate : templateTz,
    template_pz: activeDoc === 'pz' ? activeTemplate : templatePz,
  })

  const switchDoc = (next: TemplateKey) => {
    if (next === doc) return
    const nextTz = doc === 'tz' ? template : templateTz
    const nextPz = doc === 'pz' ? template : templatePz
    setTemplateTz(nextTz)
    setTemplatePz(nextPz)
    setDoc(next)
    setTemplate(next === 'tz' ? nextTz : nextPz)
    setSelectedId(null)
    setScrollToHeading(undefined)
    setScrollNonce(0)
  }

  const onSelectSection = (id: string) => {
    setSelectedId(id)
    const node = findNode(outlineForDoc(doc), id)
    if (node?.heading) {
      setScrollToHeading(node.heading)
      setScrollNonce((n) => n + 1)
    }
  }

  const selectProject = async (id: string) => {
    if (id === projectId) return
    setLoading(true)
    setError(null)
    setStatus('')
    try {
      await openProject(id, doc)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const onCreated = async (created: Project) => {
    setProjects((prev) => {
      const summary = {
        id: created.id,
        slug: created.slug,
        name: created.name,
        updated_at: created.updated_at,
      }
      if (prev.some((p) => p.id === created.id)) {
        return prev.map((p) => (p.id === created.id ? summary : p))
      }
      return [...prev, summary]
    })
    applyProject(created, doc)
    setVersions([])
    setStatus(`Проект «${created.name}» создан`)
  }

  const onSaveVersion = async (label?: string) => {
    if (!projectId) return
    setStatus('Сохранение версии…')
    try {
      const tpl = templatesForPut(doc, template)
      const saved = await putProject(projectId, {
        data: project,
        ...tpl,
        style_profile: styleProfile,
      })
      syncFromProject(saved, doc)
      await createVersion(projectId, label ? { label } : {})
      await refreshVersions(projectId)
      setStatus(label ? `Версия «${label}» сохранена` : 'Версия сохранена')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  const onRestore = async (versionId: string) => {
    if (!projectId) return
    if (!window.confirm('Откатить проект к выбранной версии? Текущие несохранённые правки будут потеряны.')) {
      return
    }
    setStatus('Откат…')
    try {
      const restored = await restoreVersion(projectId, versionId)
      applyProject(restored, doc)
      setProjects((prev) =>
        prev.map((p) =>
          p.id === restored.id
            ? { id: restored.id, slug: restored.slug, name: restored.name, updated_at: restored.updated_at }
            : p,
        ),
      )
      setStatus('Версия восстановлена')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  const saveProject = async () => {
    if (!projectId) return
    setStatus('Сохранение проекта…')
    try {
      const tpl = templatesForPut(doc, template)
      const saved = await putProject(projectId, {
        data: project,
        ...tpl,
        style_profile: styleProfile,
      })
      syncFromProject(saved, doc)
      setProjects((prev) =>
        prev.map((p) =>
          p.id === saved.id
            ? { id: saved.id, slug: saved.slug, name: saved.name, updated_at: saved.updated_at }
            : p,
        ),
      )
      setStatus('Проект сохранён')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  const saveTemplate = async () => {
    if (!projectId) return
    setStatus('Сохранение шаблона…')
    try {
      const tpl = templatesForPut(doc, template)
      const saved = await putProject(projectId, {
        data: project,
        ...tpl,
        style_profile: styleProfile,
      })
      syncFromProject(saved, doc)
      setStatus(`Шаблон ${doc.toUpperCase()} сохранён`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  const generate = async () => {
    if (!projectId) return
    setStatus('Сохранение и генерация…')
    try {
      const tpl = templatesForPut(doc, template)
      const saved = await putProject(projectId, {
        data: project,
        ...tpl,
        style_profile: styleProfile,
      })
      syncFromProject(saved, doc)
      const result = await renderProject(projectId, doc, 'both')
      const docxPaths = result.written.filter((p) => p.endsWith('.docx'))
      if (docxPaths.length === 0) {
        setStatus('Сгенерировано, но .docx не найден')
        return
      }
      setStatus('Выберите, куда сохранить .docx…')
      const outcomes: string[] = []
      for (const path of docxPaths) {
        const name = path.split('/').pop() ?? path
        const blob = await fetchDocxBlob(projectId, name)
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
        <ProjectBar
          projectId={projectId}
          projects={projects}
          versions={versions}
          onSelect={(id) => void selectProject(id)}
          onCreated={(p) => void onCreated(p)}
          onSaveVersion={(label) => void onSaveVersion(label)}
          onRestore={(vid) => void onRestore(vid)}
          disabled={loading}
        />
        <div className="topbar-switch">
          <button
            type="button"
            className={doc === 'tz' ? 'seg active' : 'seg'}
            onClick={() => switchDoc('tz')}
          >
            ТЗ
          </button>
          <button
            type="button"
            className={doc === 'pz' ? 'seg active' : 'seg'}
            onClick={() => switchDoc('pz')}
          >
            ПЗ
          </button>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn" onClick={() => void saveProject()} disabled={loading || !projectId}>
            Сохранить проект
          </button>
          <button type="button" className="btn" onClick={() => void saveTemplate()} disabled={loading || !projectId}>
            Сохранить шаблон
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void generate()}
            disabled={loading || !projectId}
          >
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
          <button type="button" className="btn" onClick={() => void loadBootstrap()}>
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
