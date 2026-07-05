import { describe, expect, it } from 'vitest'
import { PermissionsService } from './service.js'

describe('PermissionsService', () => {
  it('returns daemon-safe permission defaults', () => {
    const service = new PermissionsService()
    expect(service.checkAppPermissions().speech_recognition).toBe('unknown')
    expect(service.requestPermission('speech_recognition')).toBe('unknown')
    expect(() => service.requestPermission('camera')).toThrow('unknown permission')
  })
})
