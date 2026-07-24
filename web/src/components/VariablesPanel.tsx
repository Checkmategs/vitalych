import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import {
  allFields,
  createCustomField,
  deleteCustomField,
  getByPath,
  isCustomField,
  jinjaForSlug,
  listFieldsOf,
  listToStrings,
  setByPath,
  textFieldsOf,
  updateCustomField,
  validateFieldUpdate,
  type FieldDef,
} from '../schema/fields'
import { countObjectInstances } from '../schema/objects'
import { FieldEditModal } from './FieldEditModal'
import { ObjectsSection } from './ObjectsSection'
import { copyTextToClipboard } from '../utils/clipboard'

type Props = {
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
}

type ModalState =
  | { mode: 'edit'; field: FieldDef }
  | { mode: 'create'; initialKind: FieldDef['kind'] }
  | null

function Accordion({
  title,
  count,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string
  count: number
  icon?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="accordion">
      <button type="button" className="accordion-header" onClick={() => setOpen((v) => !v)}>
        {icon ? <span className="accordion-icon">{icon}</span> : null}
        <span className="accordion-title">
          {title} <span className="accordion-count">({count})</span>
        </span>
        <span className="accordion-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open ? <div className="accordion-body">{children}</div> : null}
    </div>
  )
}

function CopySlugButton({ slug }: { slug: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  const onCopy = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const text = jinjaForSlug(slug)
    const ok = await copyTextToClipboard(text)
    if (ok) {
      setStatus('copied')
      window.setTimeout(() => setStatus('idle'), 1500)
    } else {
      setStatus('error')
      window.setTimeout(() => setStatus('idle'), 2500)
    }
  }

  const title =
    status === 'copied'
      ? 'Скопировано'
      : status === 'error'
        ? 'Не удалось скопировать'
        : `Копировать ${jinjaForSlug(slug)}`

  return (
    <button
      type="button"
      className={['var-card-copy', status === 'error' ? 'var-card-copy--error' : '']
        .filter(Boolean)
        .join(' ')}
      onClick={(e) => void onCopy(e)}
      title={title}
      aria-label={title}
    >
      <span className="var-card-copy-icon" aria-hidden>
        {status === 'copied' ? '✓' : status === 'error' ? '!' : '⧉'}
      </span>
    </button>
  )
}

function openOnActivate(onOpen: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen()
    }
  }
}

function TextFieldCard({
  field,
  value,
  active,
  onOpen,
}: {
  field: FieldDef
  value: string
  active: boolean
  onOpen: () => void
}) {
  const preview = value.trim()
  return (
    <div
      className={['var-card', active ? 'var-card--active' : ''].filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={openOnActivate(onOpen)}
      title="Нажмите для редактирования"
    >
      <div className="var-card-header">
        <span className="var-card-label">{field.label}</span>
        <span className="var-card-slug-row">
          <span className="var-card-slug">{field.slug}</span>
          <CopySlugButton slug={field.slug} />
        </span>
      </div>
      <div className="text-preview">
        {preview ? (
          <span className="text-preview-value">{preview}</span>
        ) : (
          <span className="text-preview-empty">пусто</span>
        )}
      </div>
    </div>
  )
}

function ListFieldCard({
  field,
  rawList,
  active,
  onOpen,
}: {
  field: FieldDef
  rawList: unknown
  active: boolean
  onOpen: () => void
}) {
  const items = listToStrings(rawList)
  const preview = items.slice(0, 3)
  const rest = Math.max(0, items.length - preview.length)

  return (
    <div
      className={['var-card', 'var-card--list', active ? 'var-card--active' : '']
        .filter(Boolean)
        .join(' ')}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={openOnActivate(onOpen)}
      title="Нажмите для редактирования"
    >
      <div className="var-card-header">
        <span className="var-card-label">{field.label}</span>
        <span className="var-card-slug-row">
          <span className="var-card-slug">{field.slug}</span>
          <CopySlugButton slug={field.slug} />
        </span>
      </div>
      <div className="list-preview">
        {preview.length === 0 ? (
          <div className="list-preview-empty">пусто</div>
        ) : (
          <ul>
            {preview.map((item, i) => (
              <li key={i}>{item || '—'}</li>
            ))}
          </ul>
        )}
        {rest > 0 ? <div className="list-preview-more">и ещё {rest}</div> : null}
      </div>
    </div>
  )
}

function AddFieldButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="var-add-btn" onClick={onClick} title="Добавить поле" aria-label="Добавить поле">
      <span className="var-add-btn-plus" aria-hidden>
        +
      </span>
    </button>
  )
}

export function VariablesPanel({ data, onChange }: Props) {
  const textFields = textFieldsOf(data)
  const listFields = listFieldsOf(data)
  const [modal, setModal] = useState<ModalState>(null)

  const setField = (field: FieldDef, value: unknown) => {
    onChange(setByPath(data, field.path, value) as Record<string, unknown>)
  }

  const editingField = modal?.mode === 'edit' ? modal.field : null
  const existingSlugs = new Set(allFields(data).map((f) => f.slug))

  return (
    <aside className="variables-panel">
      <div className="panel-title">Переменные</div>
      <div className="variables-panel-scroll">
        <Accordion title="Простые поля" count={textFields.length}>
          <Accordion title="Текст" count={textFields.length} defaultOpen>
            <AddFieldButton onClick={() => setModal({ mode: 'create', initialKind: 'text' })} />
            {textFields.map((field) => {
              const raw = getByPath(data, field.path)
              const value = raw == null ? '' : String(raw)
              return (
                <TextFieldCard
                  key={field.slug}
                  field={field}
                  value={value}
                  active={editingField?.slug === field.slug}
                  onOpen={() => setModal({ mode: 'edit', field })}
                />
              )
            })}
          </Accordion>
        </Accordion>

        <Accordion title="Списки" count={listFields.length}>
          <Accordion title="Простые списки" count={listFields.length} defaultOpen>
            <AddFieldButton onClick={() => setModal({ mode: 'create', initialKind: 'list' })} />
            {listFields.map((field) => (
              <ListFieldCard
                key={field.slug}
                field={field}
                rawList={getByPath(data, field.path)}
                active={editingField?.slug === field.slug}
                onOpen={() => setModal({ mode: 'edit', field })}
              />
            ))}
          </Accordion>
        </Accordion>

        <Accordion title="Объекты" count={countObjectInstances(data)} defaultOpen={false}>
          <ObjectsSection data={data} onChange={onChange} />
        </Accordion>
      </div>

      {modal?.mode === 'create' ? (
        <FieldEditModal
          mode="create"
          initialKind={modal.initialKind}
          existingSlugs={existingSlugs}
          onCreate={(def, initialValue) => {
            const { data: next } = createCustomField(
              data,
              { slug: def.slug, label: def.label, kind: def.kind },
              initialValue,
            )
            onChange(next)
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      ) : null}

      {modal?.mode === 'edit' ? (
        <FieldEditModal
          field={modal.field}
          value={getByPath(data, modal.field.path)}
          onChange={(v) => setField(modal.field, v)}
          settingsEditable={isCustomField(data, modal.field.slug)}
          onMetaChange={(draft) => {
            const err = validateFieldUpdate(data, modal.field.slug, draft)
            if (err === 'label') return 'Укажите название'
            if (err === 'slug') return 'Код: латиница, цифры, _, сегменты через точку'
            if (err === 'duplicate') return 'Поле с таким кодом уже есть'
            const result = updateCustomField(data, modal.field.slug, draft)
            if (!result) return 'Не удалось обновить поле'
            onChange(result.data)
            setModal({ mode: 'edit', field: result.field })
            return null
          }}
          onDelete={
            isCustomField(data, modal.field.slug)
              ? () => {
                  onChange(deleteCustomField(data, modal.field.slug))
                  setModal(null)
                }
              : undefined
          }
          onClose={() => setModal(null)}
        />
      ) : null}
    </aside>
  )
}
