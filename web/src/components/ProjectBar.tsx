import { useEffect, useState } from 'react'
import {
  createProject,
  type Project,
  type ProjectSummary,
  type VersionItem,
} from '../api/client'

const STORAGE_KEY = 'vitalych.projectId'

export function persistProjectId(id: string) {
  localStorage.setItem(STORAGE_KEY, id)
}

export function readStoredProjectId(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

type Props = {
  projectId: string | null
  projects: ProjectSummary[]
  versions: VersionItem[]
  onSelect: (id: string) => void
  onCreated: (project: Project) => void
  onSaveVersion: (label?: string) => void
  onRestore: (versionId: string) => void
  disabled?: boolean
}

function formatVersion(v: VersionItem): string {
  const when = v.created_at ? new Date(v.created_at).toLocaleString() : v.id.slice(0, 8)
  return v.label ? `${v.label} — ${when}` : when
}

export function ProjectBar({
  projectId,
  projects,
  versions,
  onSelect,
  onCreated,
  onSaveVersion,
  onRestore,
  disabled = false,
}: Props) {
  const [versionId, setVersionId] = useState('')

  useEffect(() => {
    if (!versions.some((v) => v.id === versionId)) {
      setVersionId(versions[0]?.id ?? '')
    }
  }, [versions, versionId])

  const createNew = async () => {
    const name = window.prompt('Название проекта', 'Новый проект')
    if (name == null) return
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const project = await createProject({ name: trimmed })
      onCreated(project)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  const saveVersion = () => {
    const label = window.prompt('Метка версии (необязательно)', '')
    if (label == null) return
    const trimmed = label.trim()
    onSaveVersion(trimmed || undefined)
  }

  return (
    <div className="project-bar">
      <select
        className="project-select"
        value={projectId ?? ''}
        disabled={disabled || projects.length === 0}
        onChange={(e) => {
          const id = e.target.value
          if (id) onSelect(id)
        }}
        aria-label="Проект"
      >
        {projects.length === 0 ? <option value="">Нет проектов</option> : null}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn" disabled={disabled} onClick={() => void createNew()}>
        Новый проект
      </button>
      <button type="button" className="btn" disabled={disabled || !projectId} onClick={saveVersion}>
        Сохранить версию
      </button>
      <span className="project-bar-label">История</span>
      <select
        className="project-select"
        value={versionId}
        disabled={disabled || versions.length === 0}
        onChange={(e) => setVersionId(e.target.value)}
        aria-label="История версий"
      >
        {versions.length === 0 ? <option value="">Нет версий</option> : null}
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {formatVersion(v)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn"
        disabled={disabled || !versionId}
        onClick={() => onRestore(versionId)}
      >
        Откатить
      </button>
    </div>
  )
}
