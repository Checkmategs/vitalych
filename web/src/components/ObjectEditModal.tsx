import { useEffect, useState } from 'react'
import {
  addChild,
  addParent,
  asObjectList,
  createObjectType,
  deleteObjectType,
  featuresToStrings,
  getChildList,
  getObjectType,
  jinjaForObjectAttr,
  jinjaHintForType,
  removeChild,
  removeParent,
  updateChildAttr,
  updateFlatAttr,
  updateObjectType,
  updateParentName,
  validateObjectTypeDraft,
  type ChildAttrDef,
  type ObjectTypeDef,
  type ObjectTypeMode,
  type Selection,
} from '../schema/objects'
import { copyTextToClipboard } from '../utils/clipboard'

type EditableSelection = Extract<Selection, { kind: 'parent' | 'child' }>

type Props = {
  data: Record<string, unknown>
  selection: EditableSelection
  onChange: (data: Record<string, unknown>) => void
  onClose: () => void
  onDeleted: () => void
  onSelectChild?: (sel: Extract<Selection, { kind: 'child' }>) => void
}

function FeaturesEditor({
  value,
  onChange,
}: {
  value: unknown
  onChange: (next: string[]) => void
}) {
  const items = featuresToStrings(value)

  return (
    <div className="obj-attr-list">
      {items.length === 0 ? <div className="obj-attr-list-empty">пусто</div> : null}
      {items.map((item, i) => (
        <div className="obj-attr-list-row" key={i}>
          <input
            className="var-input"
            type="text"
            value={item}
            onChange={(e) => {
              const next = [...items]
              next[i] = e.target.value
              onChange(next)
            }}
          />
          <button
            type="button"
            className="btn-icon"
            title="Удалить"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn-link" onClick={() => onChange([...items, ''])}>
        + Добавить
      </button>
    </div>
  )
}

function CopyTextButton({ text, label }: { text: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  return (
    <button
      type="button"
      className={['var-card-copy', status === 'error' ? 'var-card-copy--error' : '']
        .filter(Boolean)
        .join(' ')}
      title={
        status === 'copied'
          ? 'Скопировано'
          : status === 'error'
            ? 'Не удалось скопировать'
            : label ?? `Копировать ${text}`
      }
      aria-label={label ?? `Копировать ${text}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void (async () => {
          const ok = await copyTextToClipboard(text)
          setStatus(ok ? 'copied' : 'error')
          window.setTimeout(() => setStatus('idle'), ok ? 1500 : 2500)
        })()
      }}
    >
      <span className="var-card-copy-icon" aria-hidden>
        {status === 'copied' ? '✓' : status === 'error' ? '!' : '⧉'}
      </span>
    </button>
  )
}

function AttrFields({
  attrs,
  item,
  onAttrChange,
  typeKey,
}: {
  attrs: ChildAttrDef[]
  item: Record<string, unknown>
  onAttrChange: (code: string, value: unknown) => void
  typeKey: string
}) {
  return (
    <div className="obj-attrs-table">
      {attrs.map((attr) => (
        <div className="obj-attr" key={attr.code}>
          <div className="obj-attr-head">
            <span className="obj-attr-label">{attr.label}</span>
            <span className="obj-attr-code">{attr.code}</span>
            <CopyTextButton text={jinjaForObjectAttr(typeKey, attr.code)} />
            <span className="obj-attr-kind">{attr.kind === 'list' ? 'list' : 'string'}</span>
          </div>
          {attr.kind === 'list' ? (
            <FeaturesEditor
              value={item[attr.code]}
              onChange={(next) => onAttrChange(attr.code, next)}
            />
          ) : (
            <input
              className="var-input"
              type="text"
              value={String(item[attr.code] ?? '')}
              onChange={(e) => onAttrChange(attr.code, e.target.value)}
              autoFocus={attr.code === 'name' || attrs[0]?.code === attr.code}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function ObjectEditModal({
  data,
  selection,
  onChange,
  onClose,
  onDeleted,
  onSelectChild,
}: Props) {
  const type = getObjectType(data, selection.typeKey)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!type) return null

  const parents = asObjectList(data[type.key])
  const parent = parents[selection.parentIndex]
  if (!parent) {
    return (
      <div className="field-modal-overlay" role="presentation" onClick={onClose}>
        <div className="field-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="field-modal-header">
            <h2 className="field-modal-title">Экземпляр не найден</h2>
            <button type="button" className="field-modal-close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (type.mode === 'flat' && selection.kind === 'parent') {
    return (
      <div className="field-modal-overlay" role="presentation" onClick={onClose}>
        <div
          className="field-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="object-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="field-modal-header">
            <h2 id="object-modal-title" className="field-modal-title">
              {type.label}
            </h2>
            <span className="field-modal-slug-pill">
              {type.label} ({type.key})
            </span>
            <button type="button" className="field-modal-close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
          <div className="field-modal-body">
            <AttrFields
              attrs={type.attrs}
              item={parent}
              typeKey={type.key}
              onAttrChange={(code, value) =>
                onChange(updateFlatAttr(data, type.key, selection.parentIndex, code, value))
              }
            />
            <div className="obj-editor-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onChange(removeParent(data, type.key, selection.parentIndex))
                  onDeleted()
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (selection.kind === 'parent') {
    const childCount = getChildList(parent, type.childKey).length
    return (
      <div className="field-modal-overlay" role="presentation" onClick={onClose}>
        <div
          className="field-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="object-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="field-modal-header">
            <h2 id="object-modal-title" className="field-modal-title">
              {type.label}
            </h2>
            <span className="field-modal-slug-pill">
              {type.label} ({type.key})
            </span>
            <button type="button" className="field-modal-close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
          <div className="field-modal-body">
            <label className="obj-attr">
              <span className="obj-attr-label">Название</span>
              <span className="obj-attr-code">name</span>
              <input
                className="var-input"
                type="text"
                value={String(parent.name ?? '')}
                onChange={(e) =>
                  onChange(updateParentName(data, type.key, selection.parentIndex, e.target.value))
                }
                autoFocus
              />
            </label>
            <p className="obj-editor-meta">
              {type.childLabel}: {childCount}
            </p>
            <div className="obj-editor-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const { data: next, childIndex } = addChild(data, type, selection.parentIndex)
                  onChange(next)
                  if (childIndex >= 0 && onSelectChild) {
                    onSelectChild({
                      kind: 'child',
                      typeKey: type.key,
                      parentIndex: selection.parentIndex,
                      childIndex,
                    })
                  }
                }}
              >
                + {type.childLabel}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onChange(removeParent(data, type.key, selection.parentIndex))
                  onDeleted()
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const children = getChildList(parent, type.childKey)
  const child = children[selection.childIndex]
  if (!child) {
    return (
      <div className="field-modal-overlay" role="presentation" onClick={onClose}>
        <div className="field-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="field-modal-header">
            <h2 className="field-modal-title">Экземпляр не найден</h2>
            <button type="button" className="field-modal-close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="field-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="field-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="object-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="field-modal-header">
          <h2 id="object-modal-title" className="field-modal-title">
            {type.childLabel}
          </h2>
          <span className="field-modal-slug-pill">
            {type.childLabel} ({type.childKey})
          </span>
          <button type="button" className="field-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="field-modal-body">
          <AttrFields
            attrs={type.childAttrs}
            item={child}
            typeKey={type.childKey}
            onAttrChange={(code, value) =>
              onChange(
                updateChildAttr(
                  data,
                  type,
                  selection.parentIndex,
                  selection.childIndex,
                  code,
                  value,
                ),
              )
            }
          />
          <div className="obj-editor-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                onChange(removeChild(data, type, selection.parentIndex, selection.childIndex))
                onDeleted()
              }}
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AttrDraftEditor({
  attrs,
  onChange,
}: {
  attrs: ChildAttrDef[]
  onChange: (attrs: ChildAttrDef[]) => void
}) {
  return (
    <div className="obj-type-attrs">
      {attrs.map((attr, i) => (
        <div className="obj-type-attr-row" key={i}>
          <input
            className="var-input"
            type="text"
            placeholder="code"
            value={attr.code}
            onChange={(e) => {
              const next = [...attrs]
              next[i] = { ...next[i], code: e.target.value }
              onChange(next)
            }}
          />
          <input
            className="var-input"
            type="text"
            placeholder="Название"
            value={attr.label}
            onChange={(e) => {
              const next = [...attrs]
              next[i] = { ...next[i], label: e.target.value }
              onChange(next)
            }}
          />
          <select
            className="var-input"
            value={attr.kind}
            onChange={(e) => {
              const next = [...attrs]
              next[i] = { ...next[i], kind: e.target.value as ChildAttrDef['kind'] }
              onChange(next)
            }}
          >
            <option value="text">text</option>
            <option value="list">list</option>
          </select>
          <button
            type="button"
            className="btn-icon"
            title="Удалить атрибут"
            onClick={() => onChange(attrs.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn-link"
        onClick={() => onChange([...attrs, { code: '', label: '', kind: 'text' }])}
      >
        + Атрибут
      </button>
    </div>
  )
}

type TypeDraft = {
  key: string
  label: string
  mode: ObjectTypeMode
  attrs: ChildAttrDef[]
  childKey: string
  childLabel: string
  childAttrs: ChildAttrDef[]
}

const emptyDraft = (): TypeDraft => ({
  key: '',
  label: '',
  mode: 'flat',
  attrs: [
    { code: 'name', label: 'Название', kind: 'text' },
    { code: 'definition', label: 'Определение', kind: 'text' },
  ],
  childKey: 'item',
  childLabel: 'Элемент',
  childAttrs: [{ code: 'name', label: 'Название', kind: 'text' }],
})

function draftFromType(type: ObjectTypeDef): TypeDraft {
  return {
    key: type.key,
    label: type.label,
    mode: type.mode,
    attrs:
      type.attrs.length > 0
        ? type.attrs
        : [{ code: 'name', label: 'Название', kind: 'text' }],
    childKey: type.childKey || 'item',
    childLabel: type.childLabel || 'Элемент',
    childAttrs:
      type.childAttrs.length > 0
        ? type.childAttrs
        : [{ code: 'name', label: 'Название', kind: 'text' }],
  }
}

function errorMessage(err: ReturnType<typeof validateObjectTypeDraft>): string {
  if (err === 'label') return 'Укажите название'
  if (err === 'key') return 'Код: латиница, цифры, _'
  if (err === 'duplicate') return 'Тип с таким кодом уже есть'
  if (err === 'attrs') return 'Добавьте корректные атрибуты'
  if (err === 'child') return 'Укажите код и название дочернего элемента'
  return 'Ошибка'
}

export function ObjectTypeFormModal({
  data,
  mode,
  initial,
  onChange,
  onClose,
  onSaved,
}: {
  data: Record<string, unknown>
  mode: 'create' | 'edit'
  initial?: ObjectTypeDef
  onChange: (data: Record<string, unknown>) => void
  onClose: () => void
  onSaved: (type: ObjectTypeDef) => void
}) {
  const [draft, setDraft] = useState<TypeDraft>(() =>
    mode === 'edit' && initial ? draftFromType(initial) : emptyDraft(),
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    const err = validateObjectTypeDraft(
      data,
      draft,
      mode === 'edit' && initial ? initial.key : undefined,
    )
    if (err) {
      setError(errorMessage(err))
      return
    }
    if (mode === 'create') {
      const result = createObjectType(data, draft)
      if (!result) {
        setError('Не удалось создать тип')
        return
      }
      onChange(result.data)
      onSaved(result.type)
      return
    }
    if (!initial) return
    const result = updateObjectType(data, initial.key, draft)
    if (!result) {
      setError('Не удалось обновить тип')
      return
    }
    onChange(result.data)
    onSaved(result.type)
  }

  return (
    <div className="field-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="field-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="object-type-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="field-modal-header">
          <h2 id="object-type-modal-title" className="field-modal-title">
            {mode === 'create' ? 'Новый тип объекта' : 'Редактирование типа'}
          </h2>
          <button type="button" className="field-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="field-modal-body">
          <label className="field-modal-field">
            <span className="field-modal-label">Код *</span>
            <input
              className="field-modal-input"
              type="text"
              value={draft.key}
              onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
              placeholder="terms"
              autoFocus
            />
          </label>
          <label className="field-modal-field">
            <span className="field-modal-label">Название *</span>
            <input
              className="field-modal-input"
              type="text"
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="Термины"
            />
          </label>
          <fieldset className="obj-mode-fieldset">
            <legend className="field-modal-label">Режим</legend>
            <label className="obj-mode-option">
              <input
                type="radio"
                name="obj-mode"
                checked={draft.mode === 'flat'}
                onChange={() => setDraft((d) => ({ ...d, mode: 'flat' }))}
              />
              Плоский список
            </label>
            <label className="obj-mode-option">
              <input
                type="radio"
                name="obj-mode"
                checked={draft.mode === 'hierarchical'}
                onChange={() => setDraft((d) => ({ ...d, mode: 'hierarchical' }))}
              />
              С дочерними
            </label>
          </fieldset>

          {draft.mode === 'flat' ? (
            <>
              <div className="field-modal-label">Атрибуты экземпляра</div>
              <AttrDraftEditor
                attrs={draft.attrs}
                onChange={(attrs) => setDraft((d) => ({ ...d, attrs }))}
              />
            </>
          ) : (
            <>
              <div className="field-modal-row">
                <label className="field-modal-field">
                  <span className="field-modal-label">Код дочернего</span>
                  <input
                    className="field-modal-input"
                    type="text"
                    value={draft.childKey}
                    onChange={(e) => setDraft((d) => ({ ...d, childKey: e.target.value }))}
                  />
                </label>
                <label className="field-modal-field">
                  <span className="field-modal-label">Название дочернего</span>
                  <input
                    className="field-modal-input"
                    type="text"
                    value={draft.childLabel}
                    onChange={(e) => setDraft((d) => ({ ...d, childLabel: e.target.value }))}
                  />
                </label>
              </div>
              <div className="field-modal-label">Атрибуты дочернего</div>
              <AttrDraftEditor
                attrs={draft.childAttrs}
                onChange={(childAttrs) => setDraft((d) => ({ ...d, childAttrs }))}
              />
            </>
          )}

          {error ? <div className="field-modal-error">{error}</div> : null}

          <div className="field-modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="btn btn-primary" onClick={submit}>
              {mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ObjectTypeAddCard({
  type,
  data,
  onChange,
  onCreated,
  onEditType,
  onDeleteType,
}: {
  type: ObjectTypeDef
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  onCreated: (sel: Extract<Selection, { kind: 'parent' }>) => void
  onEditType?: () => void
  onDeleteType?: () => void
}) {
  const parents = asObjectList(data[type.key])
  const hint = jinjaHintForType(type)

  return (
    <div className="objects-detail objects-detail--compact">
      <div className="obj-editor-title">Тип объекта</div>
      <p className="obj-editor-hint">
        {type.label} ({type.key})
        {type.mode === 'flat' ? ' — плоский список' : ' — с дочерними'}.
        Выберите экземпляр в дереве или добавьте новый.
      </p>
      <button
        type="button"
        className="btn"
        onClick={() => {
          const { data: next, index } = addParent(data, type)
          onChange(next)
          onCreated({ kind: 'parent', typeKey: type.key, parentIndex: index })
        }}
      >
        + Добавить {type.label.toLowerCase()}
      </button>
      <p className="obj-editor-meta">Экземпляров: {parents.length}</p>
      <div className="obj-type-actions">
        <CopyTextButton text={hint} label="Копировать Jinja" />
        {!type.builtin && onEditType ? (
          <button type="button" className="btn" onClick={onEditType}>
            Редактировать тип
          </button>
        ) : null}
        {!type.builtin && onDeleteType ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (!window.confirm(`Удалить тип «${type.label}» и все экземпляры?`)) return
              onChange(deleteObjectType(data, type.key))
              onDeleteType()
            }}
          >
            Удалить тип
          </button>
        ) : null}
      </div>
      <pre className="obj-jinja-code obj-jinja-code--compact">{hint}</pre>
    </div>
  )
}
