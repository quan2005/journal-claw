import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ConfigService } from '../config/service.js'
import { OnboardingService } from './service.js'

describe('OnboardingService', () => {
  it('persists status in ConfigService', () => {
    const config = new ConfigService({
      configDir: mkdtempSync(join(tmpdir(), 'journal-onboarding-')),
    })
    const service = new OnboardingService(config)
    expect(service.getStatus()).toEqual({ completed: false, last_step: null })
    service.setStep(2)
    expect(service.getStatus()).toEqual({ completed: false, last_step: 2 })
    service.complete()
    expect(service.getStatus()).toEqual({ completed: true, last_step: null })
  })
})
