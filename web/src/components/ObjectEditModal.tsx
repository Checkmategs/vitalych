import { useEffect } from 'react'
import {
  addChild,
  addParent,
  asObjectList,
  featuresToStrings,
  getChildList,
  getObjectType,
  removeChild,
  removeParent,
  updateChildAttr,
  updateParentName,
  type Selection,
} from '../schema/objects'

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

export function ObjectEditModal({
  data,
  selection,
  onChange,
  onClose,
  onDeleted,
  onSelectChild,
}: Props) {
  const type = getObjectType(selection.typeKey)

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
                Удалить модуль
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
          <div className="obj-attrs-table">
            {type.childAttrs.map((attr) => (
              <div className="obj-attr" key={attr.code}>
                <div className="obj-attr-head">
                  <span className="obj-attr-label">{attr.label}</span>
                  <span className="obj-attr-code">{attr.code}</span>
                  <span className="obj-attr-kind">{attr.kind === 'list' ? 'list' : 'string'}</span>
                </div>
                {attr.kind === 'list' ? (
                  <FeaturesEditor
                    value={child[attr.code]}
                    onChange={(next) =>
                      onChange(
                        updateChildAttr(
                          data,
                          type,
                          selection.parentIndex,
                          selection.childIndex,
                          attr.code,
                          next,
                        ),
                      )
                    }
                  />
                ) : (
                  <input
                    className="var-input"
                    type="text"
                    value={String(child[attr.code] ?? '')}
                    onChange={(e) =>
                      onChange(
                        updateChildAttr(
                          data,
                          type,
                          selection.parentIndex,
                          selection.childIndex,
                          attr.code,
                          e.target.value,
                        ),
                      )
                    }
                    autoFocus={attr.code === 'name'}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="obj-editor-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                onChange(removeChild(data, type, selection.parentIndex, selection.childIndex))
                onDeleted()
              }}
            >
              Удалить функцию
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ObjectTypeAddCard({
  typeKey,
  data,
  onChange,
  onCreated,
}: {
  typeKey: string
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  onCreated: (sel: Extract<Selection, { kind: 'parent' }>) => void
}) {
  const type = getObjectType(typeKey)
  if (!type) return null
  const parents = asObjectList(data[type.key])

  return (
    <div className="objects-detail objects-detail--compact">
      <div className="obj-editor-title">Тип объекта</div>
      <p className="obj-editor-hint">
        {type.label} ({type.key}). Выберите экземпляр в дереве или добавьте новый.
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
    </div>
  )
}
