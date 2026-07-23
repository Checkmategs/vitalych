import { useState } from 'react'
import {
  JINJA_HINT,
  OBJECT_TYPES,
  addChild,
  addParent,
  asObjectList,
  childDisplayName,
  getChildList,
  parentDisplayName,
  type ObjectTypeDef,
  type Selection,
} from '../schema/objects'
import { ObjectEditModal, ObjectTypeAddCard } from './ObjectEditModal'

type Props = {
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
}

type EditableSelection = Extract<Selection, { kind: 'parent' | 'child' }>

function TypeTree({
  type,
  data,
  selection,
  onSelect,
  onChange,
}: {
  type: ObjectTypeDef
  data: Record<string, unknown>
  selection: Selection | null
  onSelect: (sel: Selection) => void
  onChange: (data: Record<string, unknown>) => void
}) {
  const [open, setOpen] = useState(true)
  const parents = asObjectList(data[type.key])
  const typeSelected = selection?.kind === 'type' && selection.typeKey === type.key

  return (
    <div className="obj-tree-type">
      <div className="obj-tree-row-wrap">
        <button
          type="button"
          className="obj-tree-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Свернуть' : 'Развернуть'}
        >
          {open ? '▾' : '▸'}
        </button>
        <button
          type="button"
          className={['obj-tree-row', typeSelected ? 'obj-tree-row--active' : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => onSelect({ kind: 'type', typeKey: type.key })}
        >
          <span className="obj-tree-label">
            {type.label} ({type.key})
          </span>
          <span className="obj-tree-count">[{parents.length}]</span>
        </button>
      </div>
      {open ? (
        <div className="obj-tree-children">
          {parents.map((parent, pi) => {
            const parentSel =
              selection != null &&
              selection.typeKey === type.key &&
              'parentIndex' in selection &&
              selection.parentIndex === pi &&
              selection.kind === 'parent'
            const children = getChildList(parent, type.childKey)
            return (
              <ParentNode
                key={pi}
                type={type}
                parent={parent}
                parentIndex={pi}
                children={children}
                selection={selection}
                parentSelected={Boolean(parentSel)}
                onSelect={onSelect}
                onAddChild={(pIndex) => {
                  const { data: next, childIndex } = addChild(data, type, pIndex)
                  onChange(next)
                  if (childIndex >= 0) {
                    onSelect({
                      kind: 'child',
                      typeKey: type.key,
                      parentIndex: pIndex,
                      childIndex,
                    })
                  }
                }}
              />
            )
          })}
          <button
            type="button"
            className="btn-link obj-tree-add"
            onClick={() => {
              const { data: next, index } = addParent(data, type)
              onChange(next)
              onSelect({ kind: 'parent', typeKey: type.key, parentIndex: index })
            }}
          >
            + {type.label}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ParentNode({
  type,
  parent,
  parentIndex,
  children,
  selection,
  parentSelected,
  onSelect,
  onAddChild,
}: {
  type: ObjectTypeDef
  parent: Record<string, unknown>
  parentIndex: number
  children: Record<string, unknown>[]
  selection: Selection | null
  parentSelected: boolean
  onSelect: (sel: Selection) => void
  onAddChild: (parentIndex: number) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="obj-tree-parent">
      <div className="obj-tree-row-wrap">
        <button
          type="button"
          className="obj-tree-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Свернуть' : 'Развернуть'}
        >
          {open ? '▾' : '▸'}
        </button>
        <button
          type="button"
          className={['obj-tree-row', parentSelected ? 'obj-tree-row--active' : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => onSelect({ kind: 'parent', typeKey: type.key, parentIndex })}
        >
          <span className="obj-tree-label">
            {parentDisplayName(parent)} ({type.key})
          </span>
          <span className="obj-tree-count">[{children.length}]</span>
        </button>
      </div>
      {open ? (
        <div className="obj-tree-children">
          {children.map((child, ci) => {
            const active =
              selection?.kind === 'child' &&
              selection.typeKey === type.key &&
              selection.parentIndex === parentIndex &&
              selection.childIndex === ci
            return (
              <button
                key={ci}
                type="button"
                className={['obj-tree-row', 'obj-tree-row--leaf', active ? 'obj-tree-row--active' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  onSelect({
                    kind: 'child',
                    typeKey: type.key,
                    parentIndex,
                    childIndex: ci,
                  })
                }
              >
                <span className="obj-tree-label">
                  {childDisplayName(child)} ({type.childKey})
                </span>
              </button>
            )
          })}
          <button
            type="button"
            className="btn-link obj-tree-add"
            onClick={() => onAddChild(parentIndex)}
          >
            + {type.childLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function JinjaHint() {
  const [open, setOpen] = useState(false)
  return (
    <div className="obj-jinja-hint">
      <button type="button" className="btn-link" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} Как вставить в шаблон
      </button>
      {open ? <pre className="obj-jinja-code">{JINJA_HINT}</pre> : null}
    </div>
  )
}

export function ObjectsSection({ data, onChange }: Props) {
  const [treeSelection, setTreeSelection] = useState<Selection | null>({
    kind: 'type',
    typeKey: 'module',
  })
  const [modalSelection, setModalSelection] = useState<EditableSelection | null>(null)

  const openSelection = (sel: Selection) => {
    setTreeSelection(sel)
    if (sel.kind === 'parent' || sel.kind === 'child') {
      setModalSelection(sel)
    } else {
      setModalSelection(null)
    }
  }

  const typeKey =
    treeSelection?.kind === 'type'
      ? treeSelection.typeKey
      : treeSelection && 'typeKey' in treeSelection
        ? treeSelection.typeKey
        : 'module'

  return (
    <div className="objects-section">
      <div className="objects-layout objects-layout--tree-only">
        <div className="objects-tree">
          {OBJECT_TYPES.map((type) => (
            <TypeTree
              key={type.key}
              type={type}
              data={data}
              selection={treeSelection}
              onSelect={openSelection}
              onChange={onChange}
            />
          ))}
        </div>
        <ObjectTypeAddCard
          typeKey={typeKey}
          data={data}
          onChange={onChange}
          onCreated={(sel) => openSelection(sel)}
        />
      </div>
      <JinjaHint />

      {modalSelection ? (
        <ObjectEditModal
          data={data}
          selection={modalSelection}
          onChange={onChange}
          onClose={() => setModalSelection(null)}
          onDeleted={() => {
            setModalSelection(null)
            setTreeSelection({ kind: 'type', typeKey: modalSelection.typeKey })
          }}
          onSelectChild={(sel) => {
            setTreeSelection(sel)
            setModalSelection(sel)
          }}
        />
      ) : null}
    </div>
  )
}
