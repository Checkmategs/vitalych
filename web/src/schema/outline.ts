export type OutlineNode = {
  id: string
  label: string
  /** Type tag shown in parentheses, e.g. section */
  tag?: string
  /** Markdown heading text used to scroll the editor */
  heading?: string
  children?: OutlineNode[]
}

/** ТЗ outline — 10 top-level sections matching templates/tz.md.j2 */
export const TZ_OUTLINE: OutlineNode = {
  id: 'tz-root',
  label: 'ТЗ',
  tag: 'document',
  heading: 'Техническое задание на создание автоматизированной системы',
  children: [
    {
      id: 'tz-1',
      label: '1. Общие сведения',
      tag: 'section',
      heading: '1. Общие сведения',
      children: [
        { id: 'tz-1-basis', label: 'Документы-основания', tag: 'section', heading: 'Документы-основания' },
        { id: 'tz-1-funding', label: 'Финансирование', tag: 'section', heading: 'Финансирование' },
      ],
    },
    {
      id: 'tz-2',
      label: '2. Цели и назначение',
      tag: 'section',
      heading: '2. Цели и назначение создания автоматизированной системы',
      children: [
        { id: 'tz-2-1', label: '2.1. Цели создания АС', tag: 'section', heading: '2.1. Цели создания АС' },
        { id: 'tz-2-2', label: '2.2. Назначение АС', tag: 'section', heading: '2.2. Назначение АС' },
      ],
    },
    {
      id: 'tz-3',
      label: '3. Характеристика объектов',
      tag: 'section',
      heading: '3. Характеристика объектов автоматизации',
    },
    {
      id: 'tz-4',
      label: '4. Требования к АС',
      tag: 'section',
      heading: '4. Требования к автоматизированной системе',
      children: [
        { id: 'tz-4-1', label: '4.1. Структура АС', tag: 'section', heading: '4.1. Требования к структуре АС в целом' },
        { id: 'tz-4-2', label: '4.2. Функции (задачи)', tag: 'section', heading: '4.2. Требования к функциям (задачам), выполняемым АС' },
        { id: 'tz-4-3', label: '4.3. Виды обеспечения', tag: 'section', heading: '4.3. Требования к видам обеспечения АС' },
        { id: 'tz-4-4', label: '4.4. Общие технические требования', tag: 'section', heading: '4.4. Общие технические требования к АС' },
      ],
    },
    {
      id: 'tz-5',
      label: '5. Состав и содержание работ',
      tag: 'section',
      heading: '5. Состав и содержание работ по созданию автоматизированной системы',
    },
    {
      id: 'tz-6',
      label: '6. Порядок разработки',
      tag: 'section',
      heading: '6. Порядок разработки автоматизированной системы',
    },
    {
      id: 'tz-7',
      label: '7. Контроль и приёмка',
      tag: 'section',
      heading: '7. Порядок контроля и приёмки автоматизированной системы',
    },
    {
      id: 'tz-8',
      label: '8. Подготовка объекта',
      tag: 'section',
      heading:
        '8. Требования к составу и содержанию работ по подготовке объекта автоматизации к вводу автоматизированной системы в действие',
    },
    {
      id: 'tz-9',
      label: '9. Документирование',
      tag: 'section',
      heading: '9. Требования к документированию',
    },
    {
      id: 'tz-10',
      label: '10. Источники разработки',
      tag: 'section',
      heading: '10. Источники разработки',
    },
  ],
}

/** ПЗ outline — 4 top-level sections matching templates/pz.md.j2 */
export const PZ_OUTLINE: OutlineNode = {
  id: 'pz-root',
  label: 'ПЗ',
  tag: 'document',
  heading: 'Пояснительная записка к эскизному (техническому) проекту',
  children: [
    {
      id: 'pz-1',
      label: '1. Общие положения',
      tag: 'section',
      heading: '1. Общие положения',
      children: [
        { id: 'pz-1-1', label: '1.1. Наименование и основания', tag: 'section', heading: '1.1. Наименование АС и основания проектирования' },
        { id: 'pz-1-2', label: '1.2. Организации и сроки', tag: 'section', heading: '1.2. Организации и сроки стадий' },
        { id: 'pz-1-3', label: '1.3. Цели и назначение', tag: 'section', heading: '1.3. Цели, назначение и области использования' },
        { id: 'pz-1-4', label: '1.4. Нормы безопасности', tag: 'section', heading: '1.4. Соответствие нормам безопасности' },
        { id: 'pz-1-5', label: '1.5. НТД', tag: 'section', heading: '1.5. Нормативно-технические документы' },
        { id: 'pz-1-6', label: '1.6. НИР и изобретения', tag: 'section', heading: '1.6. НИР, передовой опыт, изобретения' },
        { id: 'pz-1-7', label: '1.7. Очередность создания', tag: 'section', heading: '1.7. Очередность создания АС' },
      ],
    },
    {
      id: 'pz-2',
      label: '2. Процессы объекта',
      tag: 'section',
      heading: '2. Описание процессов деятельности объекта автоматизации',
      children: [
        { id: 'pz-2-1', label: '2.1. Объект автоматизации', tag: 'section', heading: '2.1. Объект автоматизации' },
        { id: 'pz-2-2', label: '2.2. Состав процедур', tag: 'section', heading: '2.2. Состав процедур (операций)' },
        { id: 'pz-2-3', label: '2.3. Организация работ', tag: 'section', heading: '2.3. Организация работ в условиях функционирования АС' },
      ],
    },
    {
      id: 'pz-3',
      label: '3. Технические решения',
      tag: 'section',
      heading: '3. Основные технические решения',
      children: [
        { id: 'pz-3-1', label: '3.1. Структура АС', tag: 'section', heading: '3.1. Структура АС и взаимодействие компонентов' },
        { id: 'pz-3-2', label: '3.2. Персонал АС', tag: 'section', heading: '3.2. Персонал АС' },
        { id: 'pz-3-3', label: '3.3. Качество относительно ТЗ', tag: 'section', heading: '3.3. Обеспечение потребительских характеристик (качество относительно ТЗ)' },
        { id: 'pz-3-4', label: '3.4. Состав функций', tag: 'section', heading: '3.4. Состав функций, комплексов задач' },
        { id: 'pz-3-5', label: '3.5. Технические средства', tag: 'section', heading: '3.5. Комплекс технических средств' },
        { id: 'pz-3-6', label: '3.6. Информационное обеспечение', tag: 'section', heading: '3.6. Информационное обеспечение' },
        { id: 'pz-3-7', label: '3.7. Программное обеспечение', tag: 'section', heading: '3.7. Программное обеспечение' },
        { id: 'pz-3-8', label: '3.8. Иллюстрации', tag: 'section', heading: '3.8. Иллюстрации смежных документов проекта' },
      ],
    },
    {
      id: 'pz-4',
      label: '4. Подготовка объекта',
      tag: 'section',
      heading: '4. Мероприятия по подготовке объекта автоматизации к вводу АС в действие',
      children: [
        { id: 'pz-4-1', label: '4.1. Приведение информации', tag: 'section', heading: '4.1. Приведение информации к виду для СВТ' },
        { id: 'pz-4-2', label: '4.2. Обучение персонала', tag: 'section', heading: '4.2. Обучение и проверка квалификации персонала' },
        { id: 'pz-4-3', label: '4.3. Подразделения и рабочие места', tag: 'section', heading: '4.3. Создание подразделений и рабочих мест' },
        { id: 'pz-4-4', label: '4.4. Изменение объекта', tag: 'section', heading: '4.4. Изменение объекта автоматизации' },
        { id: 'pz-4-5', label: '4.5. Иные мероприятия', tag: 'section', heading: '4.5. Иные мероприятия' },
      ],
    },
  ],
}

export function outlineForDoc(doc: 'tz' | 'pz'): OutlineNode {
  return doc === 'tz' ? TZ_OUTLINE : PZ_OUTLINE
}

export function countLeaves(node: OutlineNode): number {
  if (!node.children?.length) return 1
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0)
}

export function findNode(root: OutlineNode, id: string): OutlineNode | undefined {
  if (root.id === id) return root
  for (const child of root.children ?? []) {
    const found = findNode(child, id)
    if (found) return found
  }
  return undefined
}
