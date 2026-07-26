import { useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { IconChevron, IconPencil } from './HeaderIcons'

export type HeaderSelectOption = {
  value: string
  label: string
}

type Props = {
  value: string
  options: HeaderSelectOption[]
  placeholder?: string
  disabled?: boolean
  ariaLabel: string
  onChange: (value: string) => void
  onRenameOption?: (value: string) => void
}

export function HeaderSelect({
  value,
  options,
  placeholder = '—',
  disabled = false,
  ariaLabel,
  onChange,
  onRenameOption,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const label = selected?.label ?? placeholder

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onRenameClick = (e: ReactMouseEvent, optionValue: string) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    // Defer so the menu unmounts before the blocking prompt.
    window.setTimeout(() => onRenameOption?.(optionValue), 0)
  }

  return (
    <div className={`mh-dropdown${open ? ' open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="mh-dropdown-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mh-dropdown-label">{label}</span>
        <span className="mh-dropdown-chevron">
          <IconChevron />
        </span>
      </button>
      {open ? (
        <ul className="mh-dropdown-menu" id={listId} role="listbox">
          {options.length === 0 ? (
            <li className="mh-dropdown-empty" role="presentation">
              {placeholder}
            </li>
          ) : (
            options.map((o) => (
              <li
                key={o.value}
                className="mh-dropdown-option-row"
                role="option"
                aria-selected={o.value === value}
              >
                <button
                  type="button"
                  className={
                    o.value === value ? 'mh-dropdown-option active' : 'mh-dropdown-option'
                  }
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  {o.label}
                </button>
                {onRenameOption ? (
                  <button
                    type="button"
                    className="mh-dropdown-rename"
                    aria-label="Переименовать"
                    title="Переименовать"
                    onClick={(e) => onRenameClick(e, o.value)}
                  >
                    <IconPencil />
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
