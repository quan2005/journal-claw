import { useTheme } from '../hooks/useTheme'
import { SettingsLayout } from './SettingsLayout'

export default function SettingsApp() {
  useTheme()

  return <SettingsLayout height="100vh" />
}
