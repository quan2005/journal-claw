import { SettingsLayout } from './SettingsLayout'

interface SettingsPanelProps {
  initialSection?: string
  onSectionConsumed?: () => void
  onClose?: () => void
}

export function SettingsPanel({ initialSection, onSectionConsumed, onClose }: SettingsPanelProps) {
  return (
    <SettingsLayout
      height="100%"
      initialSection={initialSection}
      onSectionConsumed={onSectionConsumed}
      onClose={onClose}
    />
  )
}
