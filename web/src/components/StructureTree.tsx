import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type OutlineNode,
  outlineForDoc,
} from '../schema/outline'

type Props = {
  doc: 'tz' | 'pz'
  selectedId: string | null
  onSelect: (id: string) => void
  outline?: OutlineNode
}

function Chevron({ open }: { open: boolean }) {
  return <span className="tree-chevron">{open ? '▾' : '▸'}</span>
}

function TreeRow({
  node,
  depth,
  selectedId,
  onSelect,
  expanded,
  toggle,
}: {
  node: OutlineNode
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
  expanded: Set<string>
  toggle: (id: string) => void
}) {
  const hasChildren = Boolean(node.children?.length)
  const isOpen = expanded.has(node.id)
  const isSelected = selectedId === node.id
  const isRoot = depth === 0

  return (
    <div className="tree-node">
      <button
        type="button"
        className={[
          'tree-row',
          isRoot ? 'tree-row--group' : '',
          isSelected && !isRoot ? 'tree-row--selected' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => {
          if (hasChildren) toggle(node.id)
          onSelect(node.id)
        }}
        title={node.label}
      >
        {hasChildren ? <Chevron open={isOpen} /> : <span className="tree-chevron tree-chevron--spacer" />}
        <span className="tree-label">{node.label}</span>
        {node.tag ? <span className="tree-tag">({node.tag})</span> : null}
        {isRoot ? (
          <span className="tree-count">[{node.children?.length ?? 0}]</span>
        ) : null}
      </button>
      {hasChildren && isOpen
        ? node.children!.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expanded={expanded}
              toggle={toggle}
            />
          ))
        : null}
    </div>
  )
}

function defaultExpanded(root: OutlineNode): Set<string> {
  const ids = new Set<string>([root.id])
  for (const child of root.children ?? []) ids.add(child.id)
  return ids
}

export function StructureTree({ doc, selectedId, onSelect, outline }: Props) {
  const root = useMemo(() => outline ?? outlineForDoc(doc), [doc, outline])
  const [expanded, setExpanded] = useState<Set<string>>(() => defaultExpanded(root))

  useEffect(() => {
    setExpanded(defaultExpanded(outline ?? outlineForDoc(doc)))
  }, [doc, outline])

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <aside className="structure-tree">
      <div className="panel-title">Структура</div>
      <div className="structure-tree-scroll">
        <TreeRow
          node={root}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          expanded={expanded}
          toggle={toggle}
        />
      </div>
    </aside>
  )
}
