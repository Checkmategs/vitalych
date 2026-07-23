import { useState, type ReactNode } from 'react'
import {
  LIST_FIELDS,
  TEXT_FIELDS,
  appendListItem,
  getByPath,
  listToStrings,
  removeListItem,
  setByPath,
  updateListItemLabel,
  type FieldDef,
} from '../schema/fields'

type Props = {
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
}

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

function TextFieldCard({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="var-card">
      <div className="var-card-header">
        <span className="var-card-label">{field.label}</span>
        <span className="var-card-slug">{field.slug}</span>
      </div>
      {field.kind === 'textarea' ? (
        <textarea
          className="var-input var-textarea"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="var-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

function ListFieldCard({
  field,
  rawList,
  onChangeRaw,
}: {
  field: FieldDef
  rawList: unknown
  onChangeRaw: (next: unknown[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const items = listToStrings(rawList)
  const preview = items.slice(0, 3)
  const rest = Math.max(0, items.length - preview.length)

  return (
    <div
      className={['var-card', 'var-card--list', editing ? 'var-card--active' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="var-card-hit"
        onClick={() => setEditing((v) => !v)}
        title="Нажмите для редактирования"
      >
        <div className="var-card-header">
          <span className="var-card-label">{field.label}</span>
          <span className="var-card-slug">{field.slug}</span>
        </div>
        {!editing ? (
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
        ) : null}
      </button>
      {editing ? (
        <div className="list-editor">
          {items.map((item, i) => (
            <div className="list-editor-row" key={i}>
              <input
                className="var-input"
                type="text"
                value={item}
                onChange={(e) => onChangeRaw(updateListItemLabel(rawList, i, e.target.value))}
              />
              <button
                type="button"
                className="btn-icon"
                title="Удалить"
                onClick={() => onChangeRaw(removeListItem(rawList, i))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-link"
            onClick={() => onChangeRaw(appendListItem(rawList))}
          >
            + Добавить
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function VariablesPanel({ data, onChange }: Props) {
  const textFields = TEXT_FIELDS
  const listFields = LIST_FIELDS

  const setField = (field: FieldDef, value: unknown) => {
    onChange(setByPath(data, field.path, value) as Record<string, unknown>)
  }

  return (
    <aside className="variables-panel">
      <div className="panel-title">Переменные</div>
      <div className="variables-panel-scroll">
        <Accordion title="Простые поля" count={textFields.length} icon="⬚">
          <Accordion title="Текст" count={textFields.length} defaultOpen>
            {textFields.map((field) => {
              const raw = getByPath(data, field.path)
              const value = raw == null ? '' : String(raw)
              return (
                <TextFieldCard
                  key={field.slug}
                  field={field}
                  value={value}
                  onChange={(v) => setField(field, v)}
                />
              )
            })}
          </Accordion>
        </Accordion>

        <Accordion title="Списки" count={listFields.length} icon="☰">
          <Accordion title="Простые списки" count={listFields.length} defaultOpen>
            {listFields.map((field) => (
              <ListFieldCard
                key={field.slug}
                field={field}
                rawList={getByPath(data, field.path)}
                onChangeRaw={(next) => setField(field, next)}
              />
            ))}
          </Accordion>
        </Accordion>
      </div>
    </aside>
  )
}
