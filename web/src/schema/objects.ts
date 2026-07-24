/** Typed object instances in project.yaml (builtin module + user types in `_ui.object_types`). */

export type ChildAttrKind = 'text' | 'list'

export type ChildAttrDef = {
  code: string
  label: string
  kind: ChildAttrKind
}

export type ObjectTypeMode = 'flat' | 'hierarchical'

export type ObjectTypeDef = {
  key: string
  label: string
  mode: ObjectTypeMode
  builtin?: boolean
  /** Hierarchical: child collection key on parent. */
  childKey: string
  childLabel: string
  childAttrs: ChildAttrDef[]
  /** Flat: attributes on each list item. */
  attrs: ChildAttrDef[]
}

const UI_KEY = '_ui'
const OBJECT_TYPES_KEY = 'object_types'

export const KEY_PATTERN = /^[a-z][a-z0-9_]*$/
export const ATTR_CODE_PATTERN = /^[a-z][a-z0-9_]*$/

export const BUILTIN_OBJECT_TYPES: ObjectTypeDef[] = [
  {
    key: 'module',
    label: 'Модуль',
    mode: 'hierarchical',
    builtin: true,
    childKey: 'function',
    childLabel: 'Функция',
    childAttrs: [
      { code: 'name', label: 'Название функции', kind: 'text' },
      { code: 'available_features', label: 'Доступная функциональность', kind: 'list' },
    ],
    attrs: [],
  },
]

/** @deprecated use BUILTIN_OBJECT_TYPES / readObjectTypes */
export const OBJECT_TYPES = BUILTIN_OBJECT_TYPES

export const MODULE_TYPE = BUILTIN_OBJECT_TYPES.find((t) => t.key === 'module')!

export type Selection =
  | { kind: 'type'; typeKey: string }
  | { kind: 'parent'; typeKey: string; parentIndex: number }
  | { kind: 'child'; typeKey: string; parentIndex: number; childIndex: number }

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function parseAttr(raw: unknown): ChildAttrDef | null {
  const obj = asRecord(raw)
  if (!obj) return null
  const code = typeof obj.code === 'string' ? obj.code.trim() : ''
  const label = typeof obj.label === 'string' ? obj.label.trim() : ''
  const kind = obj.kind
  if (!code || !ATTR_CODE_PATTERN.test(code) || !label) return null
  if (kind !== 'text' && kind !== 'list') return null
  return { code, label, kind }
}

function parseObjectType(raw: unknown): ObjectTypeDef | null {
  const obj = asRecord(raw)
  if (!obj) return null
  const key = typeof obj.key === 'string' ? obj.key.trim() : ''
  const label = typeof obj.label === 'string' ? obj.label.trim() : ''
  if (!key || !KEY_PATTERN.test(key) || !label) return null

  const mode: ObjectTypeMode = obj.mode === 'hierarchical' ? 'hierarchical' : 'flat'
  const attrsRaw = Array.isArray(obj.attrs) ? obj.attrs : []
  const attrs = attrsRaw.map(parseAttr).filter((a): a is ChildAttrDef => a != null)
  const childAttrsRaw = Array.isArray(obj.childAttrs) ? obj.childAttrs : []
  const childAttrs = childAttrsRaw.map(parseAttr).filter((a): a is ChildAttrDef => a != null)
  const childKey =
    typeof obj.childKey === 'string' && ATTR_CODE_PATTERN.test(obj.childKey.trim())
      ? obj.childKey.trim()
      : 'item'
  const childLabel =
    typeof obj.childLabel === 'string' && obj.childLabel.trim()
      ? obj.childLabel.trim()
      : 'Элемент'

  if (mode === 'flat' && attrs.length === 0) return null
  if (mode === 'hierarchical' && childAttrs.length === 0) return null

  return {
    key,
    label,
    mode,
    builtin: false,
    childKey,
    childLabel,
    childAttrs,
    attrs,
  }
}

function writeUserTypes(data: Record<string, unknown>, types: ObjectTypeDef[]): Record<string, unknown> {
  const serializable = types.map((t) => {
    if (t.mode === 'flat') {
      return {
        key: t.key,
        label: t.label,
        mode: 'flat',
        attrs: t.attrs,
      }
    }
    return {
      key: t.key,
      label: t.label,
      mode: 'hierarchical',
      childKey: t.childKey,
      childLabel: t.childLabel,
      childAttrs: t.childAttrs,
    }
  })
  const ui = { ...(asRecord(data[UI_KEY]) ?? {}), [OBJECT_TYPES_KEY]: serializable }
  return { ...data, [UI_KEY]: ui }
}

export function readUserObjectTypes(data: Record<string, unknown>): ObjectTypeDef[] {
  const ui = asRecord(data[UI_KEY])
  if (!ui) return []
  const list = ui[OBJECT_TYPES_KEY]
  if (!Array.isArray(list)) return []
  const builtinKeys = new Set(BUILTIN_OBJECT_TYPES.map((t) => t.key))
  const seen = new Set<string>()
  const result: ObjectTypeDef[] = []
  for (const item of list) {
    const def = parseObjectType(item)
    if (!def || builtinKeys.has(def.key) || seen.has(def.key)) continue
    seen.add(def.key)
    result.push(def)
  }
  return result
}

/** Builtin + user types; builtin wins on key collision. */
export function readObjectTypes(data: Record<string, unknown>): ObjectTypeDef[] {
  return [...BUILTIN_OBJECT_TYPES, ...readUserObjectTypes(data)]
}

export function getObjectType(
  data: Record<string, unknown>,
  key: string,
): ObjectTypeDef | undefined {
  return readObjectTypes(data).find((t) => t.key === key)
}

export function isValidObjectKey(key: string): boolean {
  return KEY_PATTERN.test(key)
}

export type ObjectTypeError = 'key' | 'label' | 'duplicate' | 'attrs' | 'child' | null

export function validateObjectTypeDraft(
  data: Record<string, unknown>,
  draft: {
    key: string
    label: string
    mode: ObjectTypeMode
    attrs: ChildAttrDef[]
    childKey: string
    childLabel: string
    childAttrs: ChildAttrDef[]
  },
  excludeKey?: string,
): ObjectTypeError {
  const key = draft.key.trim()
  const label = draft.label.trim()
  if (!label) return 'label'
  if (!isValidObjectKey(key)) return 'key'
  const existing = readObjectTypes(data)
  if (existing.some((t) => t.key === key && t.key !== excludeKey)) return 'duplicate'
  if (draft.mode === 'flat') {
    if (draft.attrs.length === 0) return 'attrs'
    if (draft.attrs.some((a) => !ATTR_CODE_PATTERN.test(a.code) || !a.label.trim())) return 'attrs'
  } else {
    if (!ATTR_CODE_PATTERN.test(draft.childKey.trim())) return 'child'
    if (!draft.childLabel.trim()) return 'child'
    if (draft.childAttrs.length === 0) return 'attrs'
    if (draft.childAttrs.some((a) => !ATTR_CODE_PATTERN.test(a.code) || !a.label.trim())) return 'attrs'
  }
  return null
}

export function createObjectType(
  data: Record<string, unknown>,
  draft: {
    key: string
    label: string
    mode: ObjectTypeMode
    attrs: ChildAttrDef[]
    childKey: string
    childLabel: string
    childAttrs: ChildAttrDef[]
  },
): { data: Record<string, unknown>; type: ObjectTypeDef } | null {
  if (validateObjectTypeDraft(data, draft) != null) return null
  const type: ObjectTypeDef = {
    key: draft.key.trim(),
    label: draft.label.trim(),
    mode: draft.mode,
    builtin: false,
    childKey: draft.mode === 'hierarchical' ? draft.childKey.trim() : '',
    childLabel: draft.mode === 'hierarchical' ? draft.childLabel.trim() : '',
    childAttrs: draft.mode === 'hierarchical' ? draft.childAttrs : [],
    attrs: draft.mode === 'flat' ? draft.attrs : [],
  }
  const users = [...readUserObjectTypes(data), type]
  let next = writeUserTypes(data, users)
  if (!(type.key in next) || next[type.key] == null) {
    next = { ...next, [type.key]: [] }
  }
  return { data: next, type }
}

export function updateObjectType(
  data: Record<string, unknown>,
  oldKey: string,
  draft: {
    key: string
    label: string
    mode: ObjectTypeMode
    attrs: ChildAttrDef[]
    childKey: string
    childLabel: string
    childAttrs: ChildAttrDef[]
  },
): { data: Record<string, unknown>; type: ObjectTypeDef } | null {
  const users = readUserObjectTypes(data)
  const idx = users.findIndex((t) => t.key === oldKey)
  if (idx < 0) return null
  if (validateObjectTypeDraft(data, draft, oldKey) != null) return null

  const type: ObjectTypeDef = {
    key: draft.key.trim(),
    label: draft.label.trim(),
    mode: draft.mode,
    builtin: false,
    childKey: draft.mode === 'hierarchical' ? draft.childKey.trim() : '',
    childLabel: draft.mode === 'hierarchical' ? draft.childLabel.trim() : '',
    childAttrs: draft.mode === 'hierarchical' ? draft.childAttrs : [],
    attrs: draft.mode === 'flat' ? draft.attrs : [],
  }

  const nextUsers = [...users]
  nextUsers[idx] = type
  let next = writeUserTypes(data, nextUsers)

  if (oldKey !== type.key) {
    const instances = next[oldKey]
    const { [oldKey]: _removed, ...rest } = next
    next = { ...rest, [type.key]: instances ?? [] }
  }
  return { data: next, type }
}

export function deleteObjectType(
  data: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const users = readUserObjectTypes(data)
  if (!users.some((t) => t.key === key)) return data
  const nextUsers = users.filter((t) => t.key !== key)
  let next = writeUserTypes(data, nextUsers)
  const { [key]: _removed, ...rest } = next
  return rest
}

export function asObjectList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (item != null && typeof item === 'object' && !Array.isArray(item)) {
      return { ...(item as Record<string, unknown>) }
    }
    return { name: String(item ?? '') }
  })
}

export function countObjectInstances(data: Record<string, unknown>): number {
  let n = 0
  for (const t of readObjectTypes(data)) {
    n += asObjectList(data[t.key]).length
  }
  return n
}

export function parentDisplayName(parent: Record<string, unknown>): string {
  const name = parent.name
  return name == null || String(name).trim() === '' ? 'Без названия' : String(name)
}

export function childDisplayName(child: Record<string, unknown>): string {
  return parentDisplayName(child)
}

export function getChildList(
  parent: Record<string, unknown>,
  childKey: string,
): Record<string, unknown>[] {
  return asObjectList(parent[childKey])
}

export function featuresToStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? ''))
}

function blankFromAttrs(attrs: ChildAttrDef[]): Record<string, unknown> {
  const blank: Record<string, unknown> = {}
  for (const attr of attrs) {
    blank[attr.code] = attr.kind === 'list' ? [] : ''
  }
  return blank
}

export function blankChild(type: ObjectTypeDef): Record<string, unknown> {
  return blankFromAttrs(type.childAttrs)
}

export function blankParent(type: ObjectTypeDef): Record<string, unknown> {
  if (type.mode === 'flat') {
    return blankFromAttrs(type.attrs)
  }
  return {
    name: '',
    [type.childKey]: [] as Record<string, unknown>[],
  }
}

/** Replace entire object-type list at root key. */
export function setObjectList(
  data: Record<string, unknown>,
  typeKey: string,
  list: Record<string, unknown>[],
): Record<string, unknown> {
  return { ...data, [typeKey]: list }
}

export function addParent(
  data: Record<string, unknown>,
  type: ObjectTypeDef,
): { data: Record<string, unknown>; index: number } {
  const list = asObjectList(data[type.key])
  list.push(blankParent(type))
  return { data: setObjectList(data, type.key, list), index: list.length - 1 }
}

export function removeParent(
  data: Record<string, unknown>,
  typeKey: string,
  parentIndex: number,
): Record<string, unknown> {
  const list = asObjectList(data[typeKey]).filter((_, i) => i !== parentIndex)
  return setObjectList(data, typeKey, list)
}

export function updateParentName(
  data: Record<string, unknown>,
  typeKey: string,
  parentIndex: number,
  name: string,
): Record<string, unknown> {
  const list = asObjectList(data[typeKey])
  if (parentIndex < 0 || parentIndex >= list.length) return data
  list[parentIndex] = { ...list[parentIndex], name }
  return setObjectList(data, typeKey, list)
}

export function updateFlatAttr(
  data: Record<string, unknown>,
  typeKey: string,
  parentIndex: number,
  code: string,
  value: unknown,
): Record<string, unknown> {
  const list = asObjectList(data[typeKey])
  if (parentIndex < 0 || parentIndex >= list.length) return data
  list[parentIndex] = { ...list[parentIndex], [code]: value }
  return setObjectList(data, typeKey, list)
}

export function addChild(
  data: Record<string, unknown>,
  type: ObjectTypeDef,
  parentIndex: number,
): { data: Record<string, unknown>; childIndex: number } {
  const list = asObjectList(data[type.key])
  if (parentIndex < 0 || parentIndex >= list.length) {
    return { data, childIndex: -1 }
  }
  const parent = { ...list[parentIndex] }
  const children = getChildList(parent, type.childKey)
  children.push(blankChild(type))
  parent[type.childKey] = children
  list[parentIndex] = parent
  return {
    data: setObjectList(data, type.key, list),
    childIndex: children.length - 1,
  }
}

export function removeChild(
  data: Record<string, unknown>,
  type: ObjectTypeDef,
  parentIndex: number,
  childIndex: number,
): Record<string, unknown> {
  const list = asObjectList(data[type.key])
  if (parentIndex < 0 || parentIndex >= list.length) return data
  const parent = { ...list[parentIndex] }
  const children = getChildList(parent, type.childKey).filter((_, i) => i !== childIndex)
  parent[type.childKey] = children
  list[parentIndex] = parent
  return setObjectList(data, type.key, list)
}

export function updateChildAttr(
  data: Record<string, unknown>,
  type: ObjectTypeDef,
  parentIndex: number,
  childIndex: number,
  code: string,
  value: unknown,
): Record<string, unknown> {
  const list = asObjectList(data[type.key])
  if (parentIndex < 0 || parentIndex >= list.length) return data
  const parent = { ...list[parentIndex] }
  const children = getChildList(parent, type.childKey)
  if (childIndex < 0 || childIndex >= children.length) return data
  children[childIndex] = { ...children[childIndex], [code]: value }
  parent[type.childKey] = children
  list[parentIndex] = parent
  return setObjectList(data, type.key, list)
}

export function jinjaHintForType(type: ObjectTypeDef): string {
  if (type.mode === 'flat') {
    const loopVar = type.key.slice(0, 1) || 't'
    const firstAttr = type.attrs[0]?.code ?? 'name'
    return `{% for ${loopVar} in ${type.key} %}
- {{ ${loopVar}.${firstAttr} }}
{% endfor %}`
  }
  const loopParent = type.key.slice(0, 3) || 'p'
  const loopChild = type.childKey.slice(0, 4) || 'c'
  const firstAttr = type.childAttrs[0]?.code ?? 'name'
  return `{% for ${loopParent} in ${type.key} %}
{% for ${loopChild} in ${loopParent}.${type.childKey} %}
- {{ ${loopChild}.${firstAttr} }}
{% endfor %}
{% endfor %}`
}

export function jinjaForObjectAttr(typeKey: string, attrCode: string): string {
  return `{{ ${typeKey}.${attrCode} }}`
}

export const JINJA_HINT = jinjaHintForType(MODULE_TYPE)
