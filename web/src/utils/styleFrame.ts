export type FramePreset = 'none' | 'frame_only' | 'stamp_compact' | 'eskd_2_2a'

export const FRAME_PRESETS: { value: FramePreset; label: string }[] = [
  { value: 'none', label: 'Без рамки' },
  { value: 'frame_only', label: 'Только рамка' },
  { value: 'stamp_compact', label: 'Рамка + штамп' },
  { value: 'eskd_2_2a', label: 'ЕСКД 2/2а (позже)' },
]

export function readFramePreset(styleYaml: string): FramePreset {
  const m = styleYaml.match(/^\s*preset:\s*(\S+)\s*$/m)
  if (!m) return 'none'
  const v = m[1].replace(/^["']|["']$/g, '')
  if (v === 'frame_only' || v === 'stamp_compact' || v === 'eskd_2_2a' || v === 'none') {
    return v
  }
  return 'none'
}

/** Update or append `frame.preset` in style-profile YAML text. */
export function setFramePreset(styleYaml: string, preset: FramePreset): string {
  const text = styleYaml ?? ''
  if (/^\s*preset:\s*\S+/m.test(text)) {
    return text.replace(/^(\s*preset:\s*)\S+/m, `$1${preset}`)
  }
  if (/^frame:\s*\n/m.test(text)) {
    return text.replace(/^(frame:\s*\n)/m, `$1  preset: ${preset}\n`)
  }
  return (
    text.replace(/\s*$/, '') +
    `\n\nframe:\n  preset: ${preset}\n  stamp_fields:\n    designation: "{{ system.topic_code }}"\n    title: "{{ system.name }}"\n    developer: "{{ parties.developer }}"\n`
  )
}
