import { useCallback, useEffect, useState } from 'react'
import { StructureTree } from './components/StructureTree'
import { TemplateEditor } from './components/TemplateEditor'
import { VariablesPanel } from './components/VariablesPanel'
import {
  MainHeader,
  persistProjectId,
  readStoredProjectId,
} from './components/MainHeader'
import { ToastHost, useToasts } from './components/ToastHost'
import {
  activateVersion,
  createProject,
  createVersion,
  deleteProject,
  deleteVersion,
  fetchDocxBlob,
  getProject,
  getVersion,
  listProjects,
  listVersions,
  putProject,
  putVersion,
  renderProject,
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

async function listOrCreateDefaultProject(): Promise<ProjectSummary[]> {
  let list = await listProjects()
  if (list.length > 0) return list

  if (!ensureDefaultProjectInFlight) {
    ensureDefaultProjectInFlight = (async () => {
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
  const toasts = useToasts()
  const [doc, setDoc] = useState<TemplateKey>('tz')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [project, setProject] = useState<ProjectData>({})
  const [template, setTemplate] = useState('')
  const [templateTz, setTemplateTz] = useState('')
  const [templatePz, setTemplatePz] = useState('')
  const [styleProfile, setStyleProfile] = useState('')
  const [dirty, setDirty] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scrollToHeading, setScrollToHeading] = useState<string | undefined>()
  const [scrollNonce, setScrollNonce] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const syncFromProject = useCallback((full: Project, activeDoc: TemplateKey) => {
    setProjectId(full.id)
    persistProjectId(full.id)
    setActiveVersionId(full.active_version_id)
    setProject(full.data)
    setTemplateTz(full.template_tz)
    setTemplatePz(full.template_pz)
    setStyleProfile(full.style_profile)
    setTemplate(activeDoc === 'tz' ? full.template_tz : full.template_pz)
    setDirty(false)
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

  const loadBootstrap = useCallback(
    async (signal?: { cancelled: boolean }) => {
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
    },
    [openProject],
  )

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

  const editorPayload = (activeDoc: TemplateKey = doc, activeTemplate: string = template) => {
    const tpl = templatesForPut(activeDoc, activeTemplate)
    return {
      data: project,
      ...tpl,
      style_profile: styleProfile,
    }
  }

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

  const markDirtyProject = (data: ProjectData) => {
    setProject(data)
    setDirty(true)
  }

  const markDirtyTemplate = (value: string) => {
    setTemplate(value)
    setDirty(true)
  }

  const flushDirtyVersion = async () => {
    if (!projectId || !activeVersionId || !dirty) return
    const payload = editorPayload()
    await putVersion(projectId, activeVersionId, payload)
    setDirty(false)
  }

  const selectProject = async (id: string) => {
    if (id === projectId) return
    setLoading(true)
    setError(null)
    try {
      if (dirty && projectId && activeVersionId) {
        await flushDirtyVersion()
      }
      await openProject(id, doc)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toasts.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const selectVersion = async (versionId: string) => {
    if (!projectId || versionId === activeVersionId) return
    setLoading(true)
    try {
      if (dirty && activeVersionId) {
        await putVersion(projectId, activeVersionId, editorPayload())
        setDirty(false)
      }
      const full = await activateVersion(projectId, versionId)
      applyProject(full, doc)
      await refreshVersions(projectId)
      toasts.success('Версия загружена')
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const onCreateProject = async () => {
    const name = window.prompt('Название проекта', 'Новый проект')
    if (name == null) return
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      if (dirty && projectId && activeVersionId) {
        await flushDirtyVersion()
      }
      const created = await createProject({ name: trimmed })
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
      await refreshVersions(created.id)
      toasts.success(`Проект «${created.name}» создан`)
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const onRenameProject = async (id: string) => {
    const current = projects.find((p) => p.id === id)
    const name = window.prompt('Название проекта', current?.name ?? '')
    if (name == null) return
    const trimmed = name.trim()
    if (!trimmed) {
      toasts.error('Укажите название проекта')
      return
    }
    if (current && trimmed === current.name) return
    try {
      const payload =
        id === projectId
          ? { ...editorPayload(), name: trimmed }
          : await (async () => {
              const full = await getProject(id)
              return {
                data: full.data,
                template_tz: full.template_tz,
                template_pz: full.template_pz,
                style_profile: full.style_profile,
                name: trimmed,
              }
            })()
      const saved = await putProject(id, payload)
      setProjects((prev) =>
        prev.map((p) =>
          p.id === saved.id
            ? { id: saved.id, slug: saved.slug, name: saved.name, updated_at: saved.updated_at }
            : p,
        ),
      )
      if (projectId === saved.id && dirty) {
        setDirty(false)
      }
      toasts.success(`Проект переименован в «${saved.name}»`)
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : String(e))
    }
  }

  const onRenameVersion = async (versionId: string) => {
    if (!projectId) return
    const current = versions.find((v) => v.id === versionId)
    const label = window.prompt('Метка версии', current?.label ?? '')
    if (label == null) return
    const trimmed = label.trim()
    if ((current?.label ?? '') === trimmed) return
    try {
      const payload =
        versionId === activeVersionId
          ? { ...editorPayload(), label: trimmed }
          : await (async () => {
              const full = await getVersion(projectId, versionId)
              return {
                data: full.data,
                template_tz: full.template_tz,
                template_pz: full.template_pz,
                style_profile: full.style_profile,
                label: trimmed,
              }
            })()
      await putVersion(projectId, versionId, payload)
      if (versionId === activeVersionId && dirty) setDirty(false)
      await refreshVersions(projectId)
      toasts.success(trimmed ? `Версия «${trimmed}»` : 'Метка версии снята')
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : String(e))
    }
  }

  const onSaveProject = async () => {
    if (!projectId) return
    try {
      const saved = await putProject(projectId, editorPayload())
      syncFromProject(saved, doc)
      setProjects((prev) =>
        prev.map((p) =>
          p.id === saved.id
            ? { id: saved.id, slug: saved.slug, name: saved.name, updated_at: saved.updated_at }
            : p,
        ),
      )
      await refreshVersions(projectId)
      toasts.success('Проект сохранён')
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : String(e))
    }
  }

  const onSaveVersion = async () => {
    if (!projectId || !activeVersionId) return
    try {
      await putVersion(projectId, activeVersionId, editorPayload())
      const full = await getProject(projectId)
      syncFromProject(full, doc)
      await refreshVersions(projectId)
      toasts.success('Версия сохранена')
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : String(e))
    }
  }

  const onCreateVersion = async () => {
    if (!projectId) return
    const label = window.prompt('Метка версии (необязательно)', '')
    if (label == null) return
    setLoading(true)
    try {
      if (dirty && activeVersionId) {
        await putVersion(projectId, activeVersionId, editorPayload())
      }
      const payload = editorPayload()
      const created = await createVersion(projectId, {
        label: label.trim() || undefined,
        ...payload,
        activate: true,
      })
      const full = await getProject(projectId)
      applyProject(full, doc)
      await refreshVersions(projectId)
      setActiveVersionId(created.id)
      toasts.success(label.trim() ? `Версия «${label.trim()}» создана` : 'Версия создана')
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const onDeleteProject = async () => {
    if (!projectId) return
    const name = projects.find((p) => p.id === projectId)?.name ?? 'проект'
    if (!window.confirm(`Удалить проект «${name}»?`)) return
    setLoading(true)
    try {
      await deleteProject(projectId)
      const list = await listOrCreateDefaultProject()
      setProjects(list)
      const nextId = list[0]?.id
      if (!nextId) {
        setError('Нет проектов')
        return
      }
      await openProject(nextId, doc)
      toasts.success('Проект удалён')
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const onDeleteVersion = async () => {
    if (!projectId || !activeVersionId) return
    if (!window.confirm('Удалить выбранную версию?')) return
    setLoading(true)
    try {
      const result = await deleteVersion(projectId, activeVersionId)
      await refreshVersions(projectId)
      if (result.active_version_id) {
        const full = await getProject(projectId)
        applyProject(full, doc)
      } else {
        setActiveVersionId(null)
        setDirty(false)
      }
      toasts.success('Версия удалена')
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const onDownload = async () => {
    if (!projectId) return
    try {
      if (dirty) {
        const saved = await putProject(projectId, editorPayload())
        syncFromProject(saved, doc)
      }
      toasts.info('Генерация docx…')
      const result = await renderProject(projectId, doc, 'docx')
      const docxPaths = result.written.filter((p) => p.endsWith('.docx'))
      if (docxPaths.length === 0) {
        toasts.error('Сгенерировано, но .docx не найден')
        return
      }
      for (const path of docxPaths) {
        const name = path.split('/').pop() ?? path
        const blob = await fetchDocxBlob(projectId, name)
        const outcome = await saveDocxAs(blob, name)
        if (outcome === 'cancelled') {
          toasts.info(`${name}: отменено`)
        } else if (outcome === 'saved') {
          toasts.success(`${name}: сохранено`)
        } else {
          toasts.success(`${name}: скачано`)
        }
      }
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="app-shell">
      <MainHeader
        doc={doc}
        onDocChange={switchDoc}
        projectId={projectId}
        projects={projects}
        versions={versions}
        activeVersionId={activeVersionId}
        onSelectProject={(id) => void selectProject(id)}
        onSelectVersion={(id) => void selectVersion(id)}
        onRenameProject={(id) => void onRenameProject(id)}
        onRenameVersion={(id) => void onRenameVersion(id)}
        onCreateProject={() => void onCreateProject()}
        onSaveProject={() => void onSaveProject()}
        onDeleteProject={() => void onDeleteProject()}
        onCreateVersion={() => void onCreateVersion()}
        onSaveVersion={() => void onSaveVersion()}
        onDeleteVersion={() => void onDeleteVersion()}
        onDownload={() => void onDownload()}
        disabled={loading}
      />

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
              onChange={markDirtyTemplate}
              scrollToHeading={scrollToHeading}
              scrollNonce={scrollNonce}
            />
          )}
        </main>
        <VariablesPanel data={project} onChange={markDirtyProject} />
      </div>

      <ToastHost toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </div>
  )
}
