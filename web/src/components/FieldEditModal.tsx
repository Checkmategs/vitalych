import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  appendListItem,
  isValidSlug,
  listToStrings,
  removeListItem,
  updateListItemLabel,
  type FieldDef,
} from '../schema/fields'

type CreateDraft = {
  slug: string
  label: string
  kind: FieldDef['kind']
}

type EditProps = {
  mode?: 'edit'
  field: FieldDef
  value: unknown
  onChange: (value: unknown) => void
  onClose: () => void
  /** When true, label settings are editable (custom fields). */
  labelEditable?: boolean
  onLabelChange?: (label: string) => void
}

type CreateProps = {
  mode: 'create'
  initialKind: FieldDef['kind']
  existingSlugs: Set<string>
  onCreate: (def: FieldDef, initialValue: unknown) => void
  onClose: () => void
}

type Props = EditProps | CreateProps

function ModalAccordion({
  title,
  icon,
  defaultOpen,
  children,
}: {
  title: string
  icon: string
  defaultOpen: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="field-modal-section">
      <button
        type="button"
        className="field-modal-section-header"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="field-modal-section-icon" aria-hidden>
          {icon}
        </span>
        <span className="field-modal-section-title">{title}</span>
        <span className="field-modal-section-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open ? <div className="field-modal-section-body">{children}</div> : null}
    </div>
  )
}

function StubLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={className ?? 'field-modal-stub'}
      title="Скоро"
      onClick={(e) => e.preventDefault()}
    >
      {children}
    </button>
  )
}

function blankListItem(previous: unknown): unknown {
  const list = Array.isArray(previous) ? previous : []
  const first = list.find((item) => item != null && typeof item === 'object' && !Array.isArray(item))
  if (first != null && typeof first === 'object' && !Array.isArray(first)) {
    const blank: Record<string, unknown> = {}
    for (const key of Object.keys(first as Record<string, unknown>)) {
      blank[key] = ''
    }
    blank.name = ''
    return blank
  }
  return ''
}

function TextValueEditor({
  value,
  onChange,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  return (
    <div className="field-modal-value">
      <textarea
        className="field-modal-textarea"
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
      />
      <div className="field-modal-value-footer">
        <StubLink>Настроить падежи</StubLink>
        <StubLink className="field-modal-stub field-modal-stub--history">↻ История</StubLink>
      </div>
    </div>
  )
}

function ListValueEditor({
  rawList,
  onChangeRaw,
}: {
  rawList: unknown
  onChangeRaw: (next: unknown[]) => void
}) {
  const items = listToStrings(rawList)
  const [numbered, setNumbered] = useState(false)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const workingRaw: unknown[] =
    items.length === 0 ? appendListItem([]) : Array.isArray(rawList) ? (rawList as unknown[]) : []
  const displayItems = listToStrings(workingRaw)

  useEffect(() => {
    if (focusIndex == null) return
    const el = inputRefs.current[focusIndex]
    if (el) {
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
    setFocusIndex(null)
  }, [focusIndex, displayItems.length])

  const insert = () => {
    const next = appendListItem(workingRaw)
    onChangeRaw(next)
    setFocusIndex(listToStrings(next).length - 1)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(displayItems.join('\n'))
    } catch {
      /* ignore */
    }
  }

  const clear = () => onChangeRaw([])

  const insertAfter = (index: number) => {
    const next = [...workingRaw]
    next.splice(index + 1, 0, blankListItem(workingRaw))
    onChangeRaw(next)
    setFocusIndex(index + 1)
  }

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      insertAfter(index)
      return
    }
    if (e.key === 'Backspace' && e.currentTarget.value === '') {
      e.preventDefault()
      if (displayItems.length <= 1) {
        onChangeRaw(updateListItemLabel(workingRaw, 0, ''))
        setFocusIndex(0)
        return
      }
      onChangeRaw(removeListItem(workingRaw, index))
      setFocusIndex(Math.max(0, index - 1))
    }
  }

  return (
    <div className="field-modal-value">
      <div className="field-modal-list-toolbar">
        <button type="button" className="field-modal-tool-btn" onClick={insert}>
          + Вставить
        </button>
        <button type="button" className="field-modal-tool-btn" onClick={() => void copy()}>
          ▤ Копировать
        </button>
        <button
          type="button"
          className="field-modal-tool-btn field-modal-tool-btn--danger"
          onClick={clear}
        >
          ⌫ Очистить
        </button>
        <label className="field-modal-numbering">
          <input
            type="checkbox"
            checked={numbered}
            onChange={(e) => setNumbered(e.target.checked)}
          />
          Нумерация
        </label>
      </div>

      <div className="field-modal-list-editor">
        <ul className={numbered ? 'field-modal-list field-modal-list--numbered' : 'field-modal-list'}>
          {displayItems.map((item, i) => (
            <li key={i}>
              <span className="field-modal-list-marker" aria-hidden>
                {numbered ? `${i + 1}.` : '•'}
              </span>
              <input
                ref={(el) => {
                  inputRefs.current[i] = el
                }}
                className="field-modal-list-input"
                type="text"
                value={item}
                onChange={(e) => onChangeRaw(updateListItemLabel(workingRaw, i, e.target.value))}
                onKeyDown={(e) => onKeyDown(i, e)}
                autoFocus={i === 0}
              />
            </li>
          ))}
        </ul>
        <div className="field-modal-list-hint">
          Enter — новый элемент, Backspace в пустом — удалить
        </div>
      </div>

      <div className="field-modal-value-footer field-modal-value-footer--end">
        <StubLink className="field-modal-stub field-modal-stub--history">↻ История</StubLink>
      </div>
    </div>
  )
}

function FieldSettings({
  kind,
  slug,
  label,
  kindDisabled,
  slugDisabled,
  labelDisabled,
  onKindChange,
  onSlugChange,
  onLabelChange,
  defaultOpen,
}: {
  kind: FieldDef['kind']
  slug: string
  label: string
  kindDisabled: boolean
  slugDisabled: boolean
  labelDisabled: boolean
  onKindChange?: (k: FieldDef['kind']) => void
  onSlugChange?: (s: string) => void
  onLabelChange?: (s: string) => void
  defaultOpen: boolean
}) {
  return (
    <ModalAccordion title="Настройки поля" icon="⚙" defaultOpen={defaultOpen}>
      <label className="field-modal-field">
        <span className="field-modal-label">Тип данных</span>
        <select
          className="field-modal-input"
          value={kind}
          disabled={kindDisabled}
          onChange={(e) => onKindChange?.(e.target.value as FieldDef['kind'])}
        >
          <option value="text">Текст</option>
          <option value="textarea">Многострочный текст</option>
          <option value="list">Список</option>
        </select>
      </label>
      <div className="field-modal-row">
        <label className="field-modal-field">
          <span className="field-modal-label">
            Код поля <span className="field-modal-req">*</span>
          </span>
          <input
            className="field-modal-input"
            type="text"
            value={slug}
            disabled={slugDisabled}
            onChange={(e) => onSlugChange?.(e.target.value)}
            placeholder="custom.my_field"
            autoFocus={!slugDisabled}
          />
          <span className="field-modal-help">Латиница, цифры, нижнее подчёркивание, точки</span>
        </label>
        <label className="field-modal-field">
          <span className="field-modal-label">
            Название <span className="field-modal-req">*</span>
          </span>
          <input
            className="field-modal-input"
            type="text"
            value={label}
            disabled={labelDisabled}
            onChange={(e) => onLabelChange?.(e.target.value)}
          />
        </label>
      </div>
    </ModalAccordion>
  )
}

function CreateFieldModal({
  initialKind,
  existingSlugs,
  onCreate,
  onClose,
}: {
  initialKind: FieldDef['kind']
  existingSlugs: Set<string>
  onCreate: (def: FieldDef, initialValue: unknown) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<CreateDraft>({
    slug: '',
    label: '',
    kind: initialKind === 'list' ? 'list' : 'text',
  })
  const [value, setValue] = useState<unknown>(initialKind === 'list' ? [] : '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const setKind = (kind: FieldDef['kind']) => {
    setDraft((d) => ({ ...d, kind }))
    setValue(kind === 'list' ? [] : typeof value === 'string' ? value : '')
  }

  const submit = () => {
    const slug = draft.slug.trim()
    const label = draft.label.trim()
    if (!label) {
      setError('Укажите название')
      return
    }
    if (!isValidSlug(slug)) {
      setError('Код: латиница, цифры, _, сегменты через точку')
      return
    }
    if (existingSlugs.has(slug)) {
      setError('Поле с таким кодом уже есть')
      return
    }
    const path = slug.split('.').filter(Boolean)
    const def: FieldDef = { slug, label, path, kind: draft.kind }
    const initial =
      draft.kind === 'list'
        ? Array.isArray(value)
          ? value
          : []
        : value == null
          ? ''
          : String(value)
    onCreate(def, initial)
  }

  const textValue = value == null ? '' : String(value)

  return (
    <div className="field-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="field-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="field-modal-header">
          <h2 id="field-modal-title" className="field-modal-title">
            Новое поле
          </h2>
          {draft.slug.trim() ? (
            <span className="field-modal-slug-pill">{draft.slug.trim()}</span>
          ) : null}
          <button type="button" className="field-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="field-modal-body">
          <FieldSettings
            kind={draft.kind}
            slug={draft.slug}
            label={draft.label}
            kindDisabled={false}
            slugDisabled={false}
            labelDisabled={false}
            onKindChange={setKind}
            onSlugChange={(s) => {
              setDraft((d) => ({ ...d, slug: s }))
              setError(null)
            }}
            onLabelChange={(s) => {
              setDraft((d) => ({ ...d, label: s }))
              setError(null)
            }}
            defaultOpen
          />

          <ModalAccordion title="Значение" icon="✎" defaultOpen>
            {draft.kind === 'list' ? (
              <ListValueEditor rawList={value} onChangeRaw={(next) => setValue(next)} />
            ) : (
              <TextValueEditor value={textValue} onChange={setValue} />
            )}
          </ModalAccordion>

          {error ? <div className="field-modal-error">{error}</div> : null}

          <div className="field-modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="btn btn-primary" onClick={submit}>
              Создать
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditFieldModal({
  field,
  value,
  onChange,
  onClose,
  labelEditable = false,
  onLabelChange,
}: {
  field: FieldDef
  value: unknown
  onChange: (value: unknown) => void
  onClose: () => void
  labelEditable?: boolean
  onLabelChange?: (label: string) => void
}) {
  const settingsOpen = field.kind !== 'list'
  const textValue = value == null ? '' : String(value)
  const [labelDraft, setLabelDraft] = useState(field.label)

  useEffect(() => {
    setLabelDraft(field.label)
  }, [field.label, field.slug])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="field-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="field-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="field-modal-header">
          <h2 id="field-modal-title" className="field-modal-title">
            Редактирование поля
          </h2>
          <span className="field-modal-slug-pill">{field.slug}</span>
          <button type="button" className="field-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="field-modal-body">
          <FieldSettings
            kind={field.kind}
            slug={field.slug}
            label={labelEditable ? labelDraft : field.label}
            kindDisabled
            slugDisabled
            labelDisabled={!labelEditable}
            onLabelChange={
              labelEditable
                ? (s) => {
                    setLabelDraft(s)
                    onLabelChange?.(s)
                  }
                : undefined
            }
            defaultOpen={settingsOpen}
          />

          <ModalAccordion title="Значение" icon="✎" defaultOpen>
            {field.kind === 'list' ? (
              <ListValueEditor rawList={value} onChangeRaw={(next) => onChange(next)} />
            ) : (
              <TextValueEditor value={textValue} onChange={(v) => onChange(v)} autoFocus />
            )}
          </ModalAccordion>
        </div>
      </div>
    </div>
  )
}

export function FieldEditModal(props: Props) {
  if (props.mode === 'create') {
    return (
      <CreateFieldModal
        initialKind={props.initialKind}
        existingSlugs={props.existingSlugs}
        onCreate={props.onCreate}
        onClose={props.onClose}
      />
    )
  }
  return (
    <EditFieldModal
      field={props.field}
      value={props.value}
      onChange={props.onChange}
      onClose={props.onClose}
      labelEditable={props.labelEditable}
      onLabelChange={props.onLabelChange}
    />
  )
}
