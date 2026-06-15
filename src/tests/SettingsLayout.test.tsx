import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsLayout } from '../settings/SettingsLayout'
import { renderWithProviders as render } from './setup'

vi.mock('../settings/components/SectionGeneral', () => ({
  default: () => <div>General panel</div>,
}))

vi.mock('../settings/components/SectionAiEngine', () => ({
  default: () => <div>Model panel</div>,
}))

vi.mock('../settings/components/SectionVoice', () => ({
  default: () => <div>Voice panel</div>,
}))

vi.mock('../settings/components/SectionPermissions', () => ({
  default: () => <div>Permissions panel</div>,
}))

vi.mock('../settings/components/SectionAutomation', () => ({
  default: () => <div>Automation panel</div>,
}))

vi.mock('../settings/components/SectionAbout', () => ({
  default: () => <div>About panel</div>,
}))

describe('SettingsLayout', () => {
  it('shows one active settings section instead of a long scroll stack', () => {
    render(<SettingsLayout height="600px" />)

    expect(screen.getByText('General panel')).toBeTruthy()
    expect(screen.queryByText('Voice panel')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '语音转写' }))

    expect(screen.getByText('Voice panel')).toBeTruthy()
    expect(screen.queryByText('General panel')).toBeNull()
  })

  it('opens an explicit initial section and consumes the request', () => {
    const onSectionConsumed = vi.fn()

    render(
      <SettingsLayout
        height="600px"
        initialSection="about"
        onSectionConsumed={onSectionConsumed}
      />,
    )

    expect(screen.getByText('About panel')).toBeTruthy()
    expect(onSectionConsumed).toHaveBeenCalledTimes(1)
  })
})
