import { SettingsLayout } from './SettingsLayout'

interface SettingsPanelProps {
  initialSection?: string
  onSectionConsumed?: () => void
}

export function SettingsPanel({ initialSection, onSectionConsumed }: SettingsPanelProps) {
  return <SettingsLayout height="100%" initialSection={initialSection} onSectionConsumed={onSectionConsumed} />
}
