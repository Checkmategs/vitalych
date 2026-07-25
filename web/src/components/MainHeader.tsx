import iconAdd from '../assets/icons/add.svg'
import iconChevron from '../assets/icons/chevron-down.svg'
import iconDownload from '../assets/icons/download.svg'
import iconSave from '../assets/icons/save.svg'
import iconTrash from '../assets/icons/trash.svg'
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
  const when = v.created_at ? new Date(v.created_at).toLocaleString() : v.id.slice(0, 8)
  return v.label ? `${v.label} — ${when}` : when
}

function IconBtn({
  src,
  label,
  onClick,
  disabled,
  danger,
}: {
  src: string
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
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
      <span className="mh-icon">
        <img src={src} alt="" width={14} height={14} />
      </span>
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
        <div className="mh-seg">
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
          <span className="mh-label">Проект:</span>
          <div className="mh-select-wrap">
            <select
              className="mh-select"
              value={projectId ?? ''}
              disabled={disabled || projects.length === 0}
              onChange={(e) => {
                const id = e.target.value
                if (id) onSelectProject(id)
              }}
              aria-label="Проект"
            >
              {projects.length === 0 ? <option value="">—</option> : null}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <img className="mh-select-chevron" src={iconChevron} alt="" width={10} height={10} />
          </div>
          <div className="mh-actions">
            <IconBtn src={iconAdd} label="Новый проект" disabled={disabled} onClick={onCreateProject} />
            <IconBtn
              src={iconSave}
              label="Сохранить проект"
              disabled={disabled || !projectId}
              onClick={onSaveProject}
            />
            <IconBtn
              src={iconTrash}
              label="Удалить проект"
              danger
              disabled={disabled || !projectId}
              onClick={onDeleteProject}
            />
          </div>
        </div>

        <div className="mh-group">
          <span className="mh-label">Версия:</span>
          <div className="mh-select-wrap">
            <select
              className="mh-select"
              value={activeVersionId ?? ''}
              disabled={disabled || versions.length === 0}
              onChange={(e) => {
                const id = e.target.value
                if (id) onSelectVersion(id)
              }}
              aria-label="Версия"
            >
              {versions.length === 0 ? <option value="">—</option> : null}
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatVersion(v)}
                </option>
              ))}
            </select>
            <img className="mh-select-chevron" src={iconChevron} alt="" width={10} height={10} />
          </div>
          <div className="mh-actions">
            <IconBtn
              src={iconAdd}
              label="Новая версия"
              disabled={disabled || !projectId}
              onClick={onCreateVersion}
            />
            <IconBtn
              src={iconSave}
              label="Сохранить версию"
              disabled={disabled || !projectId || !activeVersionId}
              onClick={onSaveVersion}
            />
            <IconBtn
              src={iconTrash}
              label="Удалить версию"
              danger
              disabled={disabled || !projectId || !activeVersionId}
              onClick={onDeleteVersion}
            />
          </div>
        </div>
      </div>

      <div className="mh-right">
        <button
          type="button"
          className="mh-download"
          disabled={disabled || !projectId}
          onClick={onDownload}
        >
          <span className="mh-icon mh-icon-download">
            <img src={iconDownload} alt="" width={16} height={16} />
          </span>
          Скачать docx
        </button>
      </div>
    </header>
  )
}
