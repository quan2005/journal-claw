import { platform } from 'node:os'
import { execFile } from 'node:child_process'

export type PermStatus = 'granted' | 'denied' | 'not_determined' | 'restricted' | 'unknown'

export interface AppPermissions {
  speech_recognition: PermStatus
  notes?: {
    speech_recognition?: string
  }
}

export class PermissionsService {
  checkAppPermissions(): AppPermissions {
    return {
      speech_recognition: 'unknown',
      notes: {
        speech_recognition:
          platform() === 'darwin'
            ? 'macOS SpeechRecognition TCC query remains in host/Tauri layer until M7'
            : 'speech recognition permission is not available in the cross-platform daemon',
      },
    }
  }

  requestPermission(perm: string): PermStatus {
    if (perm !== 'speech_recognition') throw new Error(`unknown permission: ${perm}`)
    return 'unknown'
  }

  openPrivacySettings(pane: string): void {
    if (pane !== 'speech_recognition') throw new Error(`unknown privacy pane: ${pane}`)
    if (platform() !== 'darwin') throw new Error('系统隐私设置跳转仅支持 macOS')
    execFile(
      'open',
      ['x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition'],
      () => undefined,
    )
  }
}
