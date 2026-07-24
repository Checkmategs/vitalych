export type FieldDef = {
  slug: string
  label: string
  path: string[]
  kind: 'text' | 'textarea' | 'list'
}

/** Flat registry: slug → YAML path + Russian label. */
export const FIELD_DEFS: FieldDef[] = [
  // system
  { slug: 'system.name', label: 'Полное наименование АС', path: ['system', 'name'], kind: 'text' },
  { slug: 'system.short_name', label: 'Условное обозначение', path: ['system', 'short_name'], kind: 'text' },
  { slug: 'system.topic_code', label: 'Шифр темы', path: ['system', 'topic_code'], kind: 'text' },

  // parties
  { slug: 'parties.customer', label: 'Заказчик', path: ['parties', 'customer'], kind: 'text' },
  { slug: 'parties.developer', label: 'Разработчик', path: ['parties', 'developer'], kind: 'text' },
  { slug: 'parties.participants', label: 'Участники разработки', path: ['parties', 'participants'], kind: 'list' },

  // basis / schedule / funding
  { slug: 'basis.documents', label: 'Документы-основания', path: ['basis', 'documents'], kind: 'list' },
  { slug: 'schedule.start', label: 'Срок начала', path: ['schedule', 'start'], kind: 'text' },
  { slug: 'schedule.end', label: 'Срок окончания', path: ['schedule', 'end'], kind: 'text' },
  { slug: 'schedule.stages', label: 'Стадии работ', path: ['schedule', 'stages'], kind: 'list' },
  { slug: 'funding', label: 'Финансирование', path: ['funding'], kind: 'textarea' },

  // goals
  { slug: 'goals.objectives', label: 'Цели создания АС', path: ['goals', 'objectives'], kind: 'list' },
  { slug: 'goals.purpose', label: 'Назначение АС', path: ['goals', 'purpose'], kind: 'textarea' },

  // object
  { slug: 'object.description', label: 'Объект автоматизации', path: ['object', 'description'], kind: 'textarea' },
  { slug: 'object.environment', label: 'Условия эксплуатации / среда', path: ['object', 'environment'], kind: 'textarea' },
  { slug: 'object.processes', label: 'Состав процедур (операций)', path: ['object', 'processes'], kind: 'textarea' },

  // requirements
  { slug: 'requirements.structure', label: 'Требования к структуре АС', path: ['requirements', 'structure'], kind: 'textarea' },
  { slug: 'requirements.functions', label: 'Функции (задачи) АС', path: ['requirements', 'functions'], kind: 'list' },
  { slug: 'requirements.support.mathematical', label: 'Математическое обеспечение', path: ['requirements', 'support', 'mathematical'], kind: 'textarea' },
  { slug: 'requirements.support.information', label: 'Информационное обеспечение', path: ['requirements', 'support', 'information'], kind: 'textarea' },
  { slug: 'requirements.support.linguistic', label: 'Лингвистическое обеспечение', path: ['requirements', 'support', 'linguistic'], kind: 'textarea' },
  { slug: 'requirements.support.software', label: 'Программное обеспечение', path: ['requirements', 'support', 'software'], kind: 'textarea' },
  { slug: 'requirements.support.technical', label: 'Техническое обеспечение', path: ['requirements', 'support', 'technical'], kind: 'textarea' },
  { slug: 'requirements.support.metrological', label: 'Метрологическое обеспечение', path: ['requirements', 'support', 'metrological'], kind: 'textarea' },
  { slug: 'requirements.support.organizational', label: 'Организационное обеспечение', path: ['requirements', 'support', 'organizational'], kind: 'textarea' },
  { slug: 'requirements.support.methodological', label: 'Методическое обеспечение', path: ['requirements', 'support', 'methodological'], kind: 'textarea' },
  { slug: 'requirements.support.other', label: 'Прочие виды обеспечения', path: ['requirements', 'support', 'other'], kind: 'textarea' },
  { slug: 'requirements.general.personnel', label: 'Персонал / пользователи', path: ['requirements', 'general', 'personnel'], kind: 'textarea' },
  { slug: 'requirements.general.purpose_metrics', label: 'Показатели назначения', path: ['requirements', 'general', 'purpose_metrics'], kind: 'textarea' },
  { slug: 'requirements.general.reliability', label: 'Надёжность', path: ['requirements', 'general', 'reliability'], kind: 'textarea' },
  { slug: 'requirements.general.safety', label: 'Безопасность', path: ['requirements', 'general', 'safety'], kind: 'textarea' },
  { slug: 'requirements.general.ergonomics', label: 'Эргономика', path: ['requirements', 'general', 'ergonomics'], kind: 'textarea' },
  { slug: 'requirements.general.operation', label: 'Эксплуатация, ТО, ремонт', path: ['requirements', 'general', 'operation'], kind: 'textarea' },
  { slug: 'requirements.general.unauthorized_access', label: 'Защита от НСД', path: ['requirements', 'general', 'unauthorized_access'], kind: 'textarea' },
  { slug: 'requirements.general.information_safety', label: 'Сохранность информации', path: ['requirements', 'general', 'information_safety'], kind: 'textarea' },
  { slug: 'requirements.general.standardization', label: 'Стандартизация и унификация', path: ['requirements', 'general', 'standardization'], kind: 'textarea' },
  { slug: 'requirements.general.additional', label: 'Дополнительные требования', path: ['requirements', 'general', 'additional'], kind: 'textarea' },

  // works / development / acceptance
  { slug: 'works.stages', label: 'Состав и содержание работ', path: ['works', 'stages'], kind: 'list' },
  { slug: 'development.organization', label: 'Порядок организации работ', path: ['development', 'organization'], kind: 'textarea' },
  { slug: 'development.inputs_by_stage', label: 'Исходные данные по этапам', path: ['development', 'inputs_by_stage'], kind: 'textarea' },
  { slug: 'development.warranties', label: 'Гарантии', path: ['development', 'warranties'], kind: 'textarea' },
  { slug: 'acceptance.tests', label: 'Виды и методы испытаний', path: ['acceptance', 'tests'], kind: 'textarea' },
  { slug: 'acceptance.acceptance', label: 'Порядок приёмки', path: ['acceptance', 'acceptance'], kind: 'textarea' },
  { slug: 'acceptance.commission', label: 'Комиссия', path: ['acceptance', 'commission'], kind: 'textarea' },

  // prep / docs / sources
  { slug: 'prep.information', label: 'Приведение информации к виду для СВТ', path: ['prep', 'information'], kind: 'textarea' },
  { slug: 'prep.training', label: 'Обучение персонала', path: ['prep', 'training'], kind: 'textarea' },
  { slug: 'prep.org_staff', label: 'Подразделения и рабочие места', path: ['prep', 'org_staff'], kind: 'textarea' },
  { slug: 'prep.object_changes', label: 'Изменение объекта автоматизации', path: ['prep', 'object_changes'], kind: 'textarea' },
  { slug: 'docs.list', label: 'Перечень документов', path: ['docs', 'list'], kind: 'textarea' },
  { slug: 'docs.standards', label: 'Оформление по стандартам', path: ['docs', 'standards'], kind: 'textarea' },
  { slug: 'sources.entries', label: 'Источники разработки', path: ['sources', 'entries'], kind: 'list' },

  // pz
  { slug: 'pz.safety_compliance', label: 'Соответствие нормам безопасности', path: ['pz', 'safety_compliance'], kind: 'textarea' },
  { slug: 'pz.normative_docs', label: 'Нормативно-технические документы', path: ['pz', 'normative_docs'], kind: 'textarea' },
  { slug: 'pz.research_and_inventions', label: 'НИР, опыт, изобретения', path: ['pz', 'research_and_inventions'], kind: 'textarea' },
  { slug: 'pz.queues', label: 'Очередность создания АС', path: ['pz', 'queues'], kind: 'textarea' },
  { slug: 'pz.work_organization', label: 'Организация работ при функционировании АС', path: ['pz', 'work_organization'], kind: 'textarea' },
  { slug: 'pz.quality_vs_tz', label: 'Качество относительно ТЗ', path: ['pz', 'quality_vs_tz'], kind: 'textarea' },
  { slug: 'pz.illustrations_note', label: 'Иллюстрации смежных документов', path: ['pz', 'illustrations_note'], kind: 'textarea' },
]

export const TEXT_FIELDS = FIELD_DEFS.filter((f) => f.kind === 'text' || f.kind === 'textarea')
export const LIST_FIELDS = FIELD_DEFS.filter((f) => f.kind === 'list')

export const SLUG_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/

const UI_KEY = '_ui'
const CUSTOM_FIELDS_KEY = 'custom_fields'

export function pathFromSlug(slug: string): string[] {
  return slug.split('.').filter(Boolean)
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function parseFieldDef(raw: unknown): FieldDef | null {
  const obj = asRecord(raw)
  if (!obj) return null
  const slug = typeof obj.slug === 'string' ? obj.slug.trim() : ''
  const label = typeof obj.label === 'string' ? obj.label.trim() : ''
  const kind = obj.kind
  if (!slug || !label) return null
  if (kind !== 'text' && kind !== 'textarea' && kind !== 'list') return null
  const path =
    Array.isArray(obj.path) && obj.path.every((p) => typeof p === 'string') && obj.path.length > 0
      ? (obj.path as string[])
      : pathFromSlug(slug)
  if (path.length === 0) return null
  return { slug, label, path, kind }
}

/** Custom field defs persisted under `_ui.custom_fields` in project.yaml. */
export function readCustomFields(data: Record<string, unknown>): FieldDef[] {
  const ui = asRecord(data[UI_KEY])
  if (!ui) return []
  const list = ui[CUSTOM_FIELDS_KEY]
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const result: FieldDef[] = []
  for (const item of list) {
    const def = parseFieldDef(item)
    if (!def || seen.has(def.slug)) continue
    seen.add(def.slug)
    result.push(def)
  }
  return result
}

/** Builtin + custom fields; builtin wins on slug collision. */
export function allFields(data: Record<string, unknown>): FieldDef[] {
  const builtinSlugs = new Set(FIELD_DEFS.map((f) => f.slug))
  const custom = readCustomFields(data).filter((f) => !builtinSlugs.has(f.slug))
  return [...FIELD_DEFS, ...custom]
}

export function textFieldsOf(data: Record<string, unknown>): FieldDef[] {
  return allFields(data).filter((f) => f.kind === 'text' || f.kind === 'textarea')
}

export function listFieldsOf(data: Record<string, unknown>): FieldDef[] {
  return allFields(data).filter((f) => f.kind === 'list')
}

export function isCustomField(data: Record<string, unknown>, slug: string): boolean {
  return readCustomFields(data).some((f) => f.slug === slug)
}

export function findField(data: Record<string, unknown>, slug: string): FieldDef | undefined {
  return allFields(data).find((f) => f.slug === slug)
}

export type FieldCreateError = 'slug' | 'label' | 'duplicate' | null

export function validateNewField(
  data: Record<string, unknown>,
  draft: { slug: string; label: string; kind: FieldDef['kind'] },
): FieldCreateError {
  const slug = draft.slug.trim()
  const label = draft.label.trim()
  if (!label) return 'label'
  if (!isValidSlug(slug)) return 'slug'
  if (allFields(data).some((f) => f.slug === slug)) return 'duplicate'
  return null
}

/** Append custom field def and initial value; returns updated project data. */
export function createCustomField(
  data: Record<string, unknown>,
  draft: { slug: string; label: string; kind: FieldDef['kind'] },
  initialValue?: unknown,
): { data: Record<string, unknown>; field: FieldDef } {
  const slug = draft.slug.trim()
  const label = draft.label.trim()
  const path = pathFromSlug(slug)
  const field: FieldDef = { slug, label, path, kind: draft.kind }
  const existing = readCustomFields(data)
  const nextCustom = [...existing.filter((f) => f.slug !== slug), field]
  const ui = { ...(asRecord(data[UI_KEY]) ?? {}), [CUSTOM_FIELDS_KEY]: nextCustom }
  let next = { ...data, [UI_KEY]: ui } as Record<string, unknown>
  const value =
    initialValue !== undefined
      ? initialValue
      : draft.kind === 'list'
        ? []
        : ''
  next = setByPath(next, path, value) as Record<string, unknown>
  return { data: next, field }
}

/** Update label of an existing custom field (slug/path immutable). */
export function updateCustomFieldLabel(
  data: Record<string, unknown>,
  slug: string,
  label: string,
): Record<string, unknown> {
  const trimmed = label.trim()
  if (!trimmed) return data
  const custom = readCustomFields(data)
  const idx = custom.findIndex((f) => f.slug === slug)
  if (idx < 0) return data
  const nextCustom = [...custom]
  nextCustom[idx] = { ...nextCustom[idx], label: trimmed }
  const ui = { ...(asRecord(data[UI_KEY]) ?? {}), [CUSTOM_FIELDS_KEY]: nextCustom }
  return { ...data, [UI_KEY]: ui }
}

/** Remove leaf key at path; leaves empty parents in place. */
export function deleteByPath(obj: unknown, path: string[]): unknown {
  if (path.length === 0) return obj
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const [head, ...rest] = path
  const base = { ...(obj as Record<string, unknown>) }
  if (rest.length === 0) {
    delete base[head]
    return base
  }
  if (!(head in base)) return base
  base[head] = deleteByPath(base[head], rest)
  return base
}

function coerceFieldValue(value: unknown, fromKind: FieldDef['kind'], toKind: FieldDef['kind']): unknown {
  if (fromKind === toKind) return value
  if (toKind === 'list') {
    if (Array.isArray(value)) return value
    const s = value == null ? '' : String(value).trim()
    return s ? [s] : []
  }
  // text / textarea
  if (Array.isArray(value)) {
    return listToStrings(value)
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n')
  }
  return value == null ? '' : String(value)
}

export type FieldUpdateError = FieldCreateError

/** Validate draft when updating a custom field; allows keeping the same slug. */
export function validateFieldUpdate(
  data: Record<string, unknown>,
  oldSlug: string,
  draft: { slug: string; label: string; kind: FieldDef['kind'] },
): FieldUpdateError {
  const slug = draft.slug.trim()
  const label = draft.label.trim()
  if (!label) return 'label'
  if (!isValidSlug(slug)) return 'slug'
  if (slug !== oldSlug && allFields(data).some((f) => f.slug === slug)) return 'duplicate'
  return null
}

/**
 * Update custom field slug/label/kind; moves value on slug change and coerces on kind change.
 * Returns null if field is not custom.
 */
export function updateCustomField(
  data: Record<string, unknown>,
  oldSlug: string,
  draft: { slug: string; label: string; kind: FieldDef['kind'] },
): { data: Record<string, unknown>; field: FieldDef } | null {
  const custom = readCustomFields(data)
  const idx = custom.findIndex((f) => f.slug === oldSlug)
  if (idx < 0) return null

  const old = custom[idx]
  const slug = draft.slug.trim()
  const label = draft.label.trim()
  const path = pathFromSlug(slug)
  const field: FieldDef = { slug, label, path, kind: draft.kind }

  let value = getByPath(data, old.path)
  value = coerceFieldValue(value, old.kind, draft.kind)

  let next = data
  if (oldSlug !== slug) {
    next = deleteByPath(next, old.path) as Record<string, unknown>
  }
  next = setByPath(next, path, value) as Record<string, unknown>

  const nextCustom = [...custom]
  nextCustom[idx] = field
  const ui = { ...(asRecord(next[UI_KEY]) ?? {}), [CUSTOM_FIELDS_KEY]: nextCustom }
  next = { ...next, [UI_KEY]: ui }
  return { data: next, field }
}

/** Remove custom field def and its value leaf. No-op for unknown / builtin slugs. */
export function deleteCustomField(
  data: Record<string, unknown>,
  slug: string,
): Record<string, unknown> {
  const custom = readCustomFields(data)
  const idx = custom.findIndex((f) => f.slug === slug)
  if (idx < 0) return data
  const field = custom[idx]
  const nextCustom = custom.filter((f) => f.slug !== slug)
  let next = deleteByPath(data, field.path) as Record<string, unknown>
  const ui = { ...(asRecord(next[UI_KEY]) ?? {}), [CUSTOM_FIELDS_KEY]: nextCustom }
  return { ...next, [UI_KEY]: ui }
}

export function jinjaForSlug(slug: string): string {
  return `{{ ${slug} }}`
}

export function getByPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

/** Immutable deep set; returns a new root object. */
export function setByPath(obj: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value
  const [head, ...rest] = path
  const base =
    obj != null && typeof obj === 'object' && !Array.isArray(obj)
      ? { ...(obj as Record<string, unknown>) }
      : ({} as Record<string, unknown>)
  base[head] = setByPath(base[head], rest, value)
  return base
}

/** Preview / edit lists as string[]; object items use `.name` when present. */
export function listToStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (typeof item === 'string') return item
    if (item != null && typeof item === 'object' && 'name' in item) {
      return String((item as { name: unknown }).name ?? '')
    }
    return String(item ?? '')
  })
}

function listMode(previous: unknown): 'string' | 'object' {
  const prev = Array.isArray(previous) ? previous : []
  if (prev.length === 0) return 'string'
  const first = prev[0]
  if (first != null && typeof first === 'object' && !Array.isArray(first)) return 'object'
  return 'string'
}

function asList(previous: unknown): unknown[] {
  return Array.isArray(previous) ? [...previous] : []
}

/** Update display label at index; preserves sibling keys on object items. */
export function updateListItemLabel(previous: unknown, index: number, label: string): unknown[] {
  const next = asList(previous)
  if (index < 0 || index >= next.length) return next
  const old = next[index]
  if (old != null && typeof old === 'object' && !Array.isArray(old)) {
    next[index] = { ...(old as Record<string, unknown>), name: label }
  } else {
    next[index] = label
  }
  return next
}

/** Remove item at index — keeps remaining objects intact (no index remapping). */
export function removeListItem(previous: unknown, index: number): unknown[] {
  return asList(previous).filter((_, i) => i !== index)
}

/** Append empty item matching existing list shape (string vs object with same keys). */
export function appendListItem(previous: unknown, label = ''): unknown[] {
  const next = asList(previous)
  if (listMode(previous) === 'object') {
    const first = next.find((item) => item != null && typeof item === 'object' && !Array.isArray(item))
    if (first != null && typeof first === 'object' && !Array.isArray(first)) {
      const blank: Record<string, unknown> = {}
      for (const key of Object.keys(first as Record<string, unknown>)) {
        blank[key] = ''
      }
      blank.name = label
      next.push(blank)
    } else {
      next.push({ name: label })
    }
  } else {
    next.push(label)
  }
  return next
}
