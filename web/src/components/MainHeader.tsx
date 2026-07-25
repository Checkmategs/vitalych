import type { ReactNode } from 'react'
import {
  IconDownload,
  IconPlus,
  IconSave,
  IconTrash,
} from './HeaderIcons'
import { HeaderSelect } from './HeaderSelect'
import type { ProjectSummary, TemplateKey, VersionItem } from '../api/client'

export const STORAGE_KEY = 'vitalych.projectId'

export function persistProjectId(id: string) {
  localStorage.setItem(STORAGE_KEY, id)
}

export function readStoredProjectId(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

type Props = {
  doc: TemplateKey
  onDocChange: (doc: TemplateKey) => void
  projectId: string | null
  projects: ProjectSummary[]
  versions: VersionItem[]
  activeVersionId: string | null
  onSelectProject: (id: string) => void
  onSelectVersion: (id: string) => void
  onRenameProject: (id: string) => void
  onRenameVersion: (id: string) => void
  onCreateProject: () => void
  onSaveProject: () => void
  onDeleteProject: () => void
  onCreateVersion: () => void
  onSaveVersion: () => void
  onDeleteVersion: () => void
  onDownload: () => void
  disabled?: boolean
}

function formatVersion(v: VersionItem): string {
  const stamp = v.updated_at || v.created_at
  const when = stamp ? new Date(stamp).toLocaleString() : v.id.slice(0, 8)
  return v.label ? `${v.label} — ${when}` : when
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={danger ? 'mh-icon-btn mh-icon-btn-danger' : 'mh-icon-btn'}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function MainHeader({
  doc,
  onDocChange,
  projectId,
  projects,
  versions,
  activeVersionId,
  onSelectProject,
  onSelectVersion,
  onRenameProject,
  onRenameVersion,
  onCreateProject,
  onSaveProject,
  onDeleteProject,
  onCreateVersion,
  onSaveVersion,
  onDeleteVersion,
  onDownload,
  disabled = false,
}: Props) {
  return (
    <header className="main-header">
      <div className="mh-left">
        <div className="mh-brand">Vitalych</div>
        <div className="mh-seg" role="group" aria-label="Тип документа">
          <button
            type="button"
            className={doc === 'tz' ? 'mh-seg-btn active' : 'mh-seg-btn'}
            onClick={() => onDocChange('tz')}
            disabled={disabled}
          >
            ТЗ
          </button>
          <button
            type="button"
            className={doc === 'pz' ? 'mh-seg-btn active' : 'mh-seg-btn'}
            onClick={() => onDocChange('pz')}
            disabled={disabled}
          >
            ПЗ
          </button>
        </div>
      </div>

      <div className="mh-center">
        <div className="mh-group">
          <span className="mh-label">Проект</span>
          <HeaderSelect
            ariaLabel="Проект"
            value={projectId ?? ''}
            disabled={disabled || projects.length === 0}
            placeholder={projects.length === 0 ? 'Нет проектов' : '—'}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            onChange={onSelectProject}
            onRenameOption={onRenameProject}
          />
          <div className="mh-actions">
            <IconBtn label="Новый проект" disabled={disabled} onClick={onCreateProject}>
              <IconPlus />
            </IconBtn>
            <IconBtn
              label="Сохранить проект"
              disabled={disabled || !projectId}
              onClick={onSaveProject}
            >
              <IconSave />
            </IconBtn>
            <IconBtn
              label="Удалить проект"
              danger
              disabled={disabled || !projectId}
              onClick={onDeleteProject}
            >
              <IconTrash />
            </IconBtn>
          </div>
        </div>

        <div className="mh-group">
          <span className="mh-label">Версия</span>
          <HeaderSelect
            ariaLabel="Версия"
            value={activeVersionId ?? ''}
            disabled={disabled || versions.length === 0}
            placeholder={versions.length === 0 ? 'Нет версий' : '—'}
            options={versions.map((v) => ({ value: v.id, label: formatVersion(v) }))}
            onChange={onSelectVersion}
            onRenameOption={onRenameVersion}
          />
          <div className="mh-actions">
            <IconBtn
              label="Новая версия"
              disabled={disabled || !projectId}
              onClick={onCreateVersion}
            >
              <IconPlus />
            </IconBtn>
            <IconBtn
              label="Сохранить версию"
              disabled={disabled || !projectId || !activeVersionId}
              onClick={onSaveVersion}
            >
              <IconSave />
            </IconBtn>
            <IconBtn
              label="Удалить версию"
              danger
              disabled={disabled || !projectId || !activeVersionId}
              onClick={onDeleteVersion}
            >
              <IconTrash />
            </IconBtn>
          </div>
        </div>
      </div>

      <div className="mh-right">
        <button
          type="button"
          className="mh-download btn btn-primary"
          disabled={disabled || !projectId}
          onClick={onDownload}
        >
          <IconDownload />
          Скачать docx
        </button>
      </div>
    </header>
  )
}
