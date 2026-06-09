import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Tauri asset protocol', () => {
  it('allows converted local images through the content security policy', () => {
    const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')) as {
      app: { security: { csp: string } }
    }
    const csp = config.app.security.csp

    expect(csp).toContain('img-src')
    expect(csp).toContain('asset:')
    expect(csp).toContain('http://asset.localhost')
  })
})
