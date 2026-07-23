import { useEffect, useRef } from 'react'
import {
  EditorView,
  keymap,
  lineNumbers,
  Decoration,
  MatchDecorator,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { EditorState, type Extension } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

type Props = {
  value: string
  onChange: (value: string) => void
  /** Heading text to scroll to (e.g. "1. Общие сведения") */
  scrollToHeading?: string
  /** Bump to re-scroll when the same heading is selected again */
  scrollNonce?: number
}

class VariableChip extends WidgetType {
  text: string
  variant: 'normal' | 'filter'

  constructor(text: string, variant: 'normal' | 'filter') {
    super()
    this.text = text
    this.variant = variant
  }

  eq(other: VariableChip) {
    return this.text === other.text && this.variant === other.variant
  }

  toDOM() {
    const el = document.createElement('span')
    el.className =
      this.variant === 'filter' ? 'cm-var-chip cm-var-chip--filter' : 'cm-var-chip'
    el.textContent = this.text
    return el
  }

  ignoreEvent() {
    return false
  }
}

function chipVariant(raw: string): 'normal' | 'filter' {
  const inner = raw.slice(2, -2).trim()
  if (inner.includes('|')) return 'filter'
  // Simple loop-style identifier (no dots / underscores)
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(inner)) return 'filter'
  return 'normal'
}

const variableMatcher = new MatchDecorator({
  regexp: /\{\{[^{}]+\}\}/g,
  decoration: (match) =>
    Decoration.replace({
      widget: new VariableChip(match[0], chipVariant(match[0])),
    }),
})

const variableChips = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = variableMatcher.createDeco(view)
    }
    update(update: ViewUpdate) {
      this.decorations = variableMatcher.updateDeco(update, this.decorations)
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  },
)

const jinjaMatcher = new MatchDecorator({
  regexp: /\{%[\s\S]*?%\}/g,
  decoration: Decoration.mark({ class: 'cm-jinja-tag' }),
})

const jinjaTags = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = jinjaMatcher.createDeco(view)
    }
    update(update: ViewUpdate) {
      this.decorations = jinjaMatcher.updateDeco(update, this.decorations)
    }
  },
  { decorations: (v) => v.decorations },
)

const commentMatcher = new MatchDecorator({
  regexp: /<!--[\s\S]*?-->/g,
  decoration: Decoration.mark({ class: 'cm-html-comment' }),
})

const htmlComments = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = commentMatcher.createDeco(view)
    }
    update(update: ViewUpdate) {
      this.decorations = commentMatcher.updateDeco(update, this.decorations)
    }
  },
  { decorations: (v) => v.decorations },
)

const headingStyle = HighlightStyle.define([
  { tag: tags.heading, color: '#1565C0', fontWeight: '600' },
  { tag: tags.heading1, color: '#1565C0', fontWeight: '700' },
  { tag: tags.heading2, color: '#1565C0', fontWeight: '700' },
  { tag: tags.heading3, color: '#1976D2', fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.monospace, fontFamily: '"IBM Plex Mono", monospace' },
])

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
  },
  '.cm-scroller': {
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
    lineHeight: '1.55',
  },
  '.cm-content': {
    caretColor: '#212121',
    paddingBottom: '40vh',
  },
  '.cm-gutters': {
    backgroundColor: '#f5f5f5',
    color: '#9e9e9e',
    border: 'none',
    borderRight: '1px solid #e0e0e0',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#eeeeee',
  },
  '.cm-var-chip': {
    display: 'inline-block',
    background: '#FFF59D',
    borderRadius: '3px',
    padding: '0 4px',
    margin: '0 1px',
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '12px',
    lineHeight: '1.4',
    verticalAlign: 'baseline',
    border: '1px solid #FBC02D',
    cursor: 'default',
  },
  '.cm-var-chip--filter': {
    background: '#A5D6A7',
    borderColor: '#66BB6A',
  },
  '.cm-jinja-tag': {
    color: '#7B1FA2',
    fontWeight: '500',
  },
  '.cm-html-comment': {
    color: '#9e9e9e',
  },
})

function wrapSelection(view: EditorView, before: string, after: string = before) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: before + selected + after },
    selection: {
      anchor: from + before.length,
      head: from + before.length + selected.length,
    },
  })
  view.focus()
}

function prefixLines(view: EditorView, prefix: string) {
  const { from, to } = view.state.selection.main
  const startLine = view.state.doc.lineAt(from)
  const endLine = view.state.doc.lineAt(to)
  const changes = []
  for (let n = startLine.number; n <= endLine.number; n++) {
    const line = view.state.doc.line(n)
    changes.push({ from: line.from, insert: prefix })
  }
  view.dispatch({ changes })
  view.focus()
}

function buildExtensions(onDocChange: (text: string) => void): Extension[] {
  return [
    lineNumbers(),
    history(),
    markdown(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    syntaxHighlighting(headingStyle),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    variableChips,
    jinjaTags,
    htmlComments,
    editorTheme,
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onDocChange(update.state.doc.toString())
    }),
  ]
}

export function TemplateEditor({ value, onChange, scrollToHeading, scrollNonce = 0 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!hostRef.current) return
    const state = EditorState.create({
      doc: value,
      extensions: buildExtensions((text) => onChangeRef.current(text)),
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !scrollToHeading) return
    const doc = view.state.doc.toString()
    const escaped = scrollToHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^#{1,6}\\s+${escaped}\\s*$`, 'm')
    const match = re.exec(doc)
    if (!match || match.index == null) return
    const pos = match.index
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'start' }),
    })
  }, [scrollToHeading, scrollNonce])

  const run = (fn: (view: EditorView) => void) => {
    const view = viewRef.current
    if (view) fn(view)
  }

  return (
    <div className="template-editor">
      <div className="editor-toolbar">
        <button type="button" title="Жирный" onClick={() => run((v) => wrapSelection(v, '**'))}>
          <strong>B</strong>
        </button>
        <button type="button" title="Курсив" onClick={() => run((v) => wrapSelection(v, '*'))}>
          <em>I</em>
        </button>
        <button
          type="button"
          title="Вставить {{ }}"
          onClick={() => run((v) => wrapSelection(v, '{{ ', ' }}'))}
        >
          {'{ }'}
        </button>
        <button type="button" title="Маркированный список" onClick={() => run((v) => prefixLines(v, '- '))}>
          •≡
        </button>
        <button type="button" title="Нумерованный список" onClick={() => run((v) => prefixLines(v, '1. '))}>
          1.
        </button>
        <span className="toolbar-sep" />
        <button type="button" title="Отменить" onClick={() => run((v) => undo(v))}>
          ↶
        </button>
        <button type="button" title="Повторить" onClick={() => run((v) => redo(v))}>
          ↷
        </button>
      </div>
      <div className="editor-host" ref={hostRef} />
    </div>
  )
}
