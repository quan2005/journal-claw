import { ConfigService } from '../config/service.js'

export interface OnboardingStatus {
  completed: boolean
  last_step: number | null
}

export class OnboardingService {
  constructor(private readonly configService: ConfigService) {}

  getStatus(): OnboardingStatus {
    return this.configService.getOnboardingStatus()
  }

  complete(): void {
    this.configService.setOnboardingStatus({ completed: true, last_step: null })
  }

  setStep(step: number): void {
    this.configService.setOnboardingStatus({ completed: false, last_step: step })
  }

  reset(): void {
    this.configService.setOnboardingStatus({ completed: false, last_step: null })
  }
}
