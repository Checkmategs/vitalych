import {
  FRAME_PRESETS,
  readFramePreset,
  setFramePreset,
  type FramePreset,
} from '../utils/styleFrame'

type Props = {
  styleProfile: string
  onChange: (nextStyleProfile: string) => void
  disabled?: boolean
}

export function FramePresetSelect({ styleProfile, onChange, disabled }: Props) {
  const value = readFramePreset(styleProfile)

  return (
    <label className="frame-preset">
      <span className="frame-preset-label">Рамка</span>
      <select
        className="frame-preset-select"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as FramePreset
          onChange(setFramePreset(styleProfile, next))
        }}
      >
        {FRAME_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  )
}
