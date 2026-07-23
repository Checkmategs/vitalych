/** Typed object instances in project.yaml (module → function, extensible later). */

export type ChildAttrKind = 'text' | 'list'

export type ChildAttrDef = {
  code: string
  label: string
  kind: ChildAttrKind
}

export type ObjectTypeDef = {
  key: string
  label: string
  childKey: string
  childLabel: string
  childAttrs: ChildAttrDef[]
}

export const OBJECT_TYPES: ObjectTypeDef[] = [
  {
    key: 'module',
    label: 'Модуль',
    childKey: 'function',
    childLabel: 'Функция',
    childAttrs: [
      { code: 'name', label: 'Название функции', kind: 'text' },
      { code: 'available_features', label: 'Доступная функциональность', kind: 'list' },
    ],
  },
]

export const MODULE_TYPE = OBJECT_TYPES.find((t) => t.key === 'module')!

export type Selection =
  | { kind: 'type'; typeKey: string }
  | { kind: 'parent'; typeKey: string; parentIndex: number }
  | { kind: 'child'; typeKey: string; parentIndex: number; childIndex: number }

export function getObjectType(key: string): ObjectTypeDef | undefined {
  return OBJECT_TYPES.find((t) => t.key === key)
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
  for (const t of OBJECT_TYPES) {
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

export function blankChild(type: ObjectTypeDef): Record<string, unknown> {
  const blank: Record<string, unknown> = {}
  for (const attr of type.childAttrs) {
    blank[attr.code] = attr.kind === 'list' ? [] : ''
  }
  return blank
}

export function blankParent(type: ObjectTypeDef): Record<string, unknown> {
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

export const JINJA_HINT = `{% for mod in module %}
{% for func in mod.function %}
- {{ func.name }}.
{% endfor %}
{% endfor %}`
