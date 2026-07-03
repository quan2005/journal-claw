import { useState, useEffect, useCallback } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'
import type { OnboardingStatus } from '../lib/apiTypes'

const getOnboardingStatus = (): Promise<OnboardingStatus> =>
  selectRuntimeClient().invoke<OnboardingStatus>('get_onboarding_status')

const completeOnboarding = (): Promise<void> =>
  selectRuntimeClient().invoke<void>('complete_onboarding')

const setOnboardingStep = (step: number): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_onboarding_step', { step })

export type OnboardingStep = 0 | 1

export interface OnboardingState {
  loading: boolean
  show: boolean
  step: OnboardingStep
  workspacePath: string
  dismiss: () => Promise<void>
  setStep: (step: OnboardingStep, path?: string) => void
  setWorkspacePath: (path: string) => void
}

export function useOnboarding(defaultWorkspacePath: string): OnboardingState {
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)
  const [step, setStepState] = useState<OnboardingStep>(0)
  const [workspacePath, setWorkspacePath] = useState(defaultWorkspacePath)

  useEffect(() => {
    getOnboardingStatus()
      .then((status) => {
        if (!status.completed) {
          setShow(true)
          if (status.last_step !== null && status.last_step !== undefined) {
            setStepState(status.last_step as OnboardingStep)
          }
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const setStep = useCallback((s: OnboardingStep, path?: string) => {
    setStepState(s)
    if (path) setWorkspacePath(path)
    setOnboardingStep(s).catch(console.error)
  }, [])

  const dismiss = useCallback(async () => {
    await completeOnboarding()
    setShow(false)
  }, [])

  return { loading, show, step, workspacePath, dismiss, setStep, setWorkspacePath }
}
