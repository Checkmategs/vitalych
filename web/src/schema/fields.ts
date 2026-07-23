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

/** Append empty item matching existing list shape (string vs `{ name }`). */
export function appendListItem(previous: unknown, label = ''): unknown[] {
  const next = asList(previous)
  if (listMode(previous) === 'object') {
    next.push({ name: label })
  } else {
    next.push(label)
  }
  return next
}
