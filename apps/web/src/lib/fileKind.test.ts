import { describe, expect, it } from 'vitest'
import { fileKindFromName } from './fileKind'

describe('fileKindFromName', () => {
  it('classifies json/yaml/toml as config', () => {
    expect(fileKindFromName('settings.json')).toBe('config')
    expect(fileKindFromName('ci.yaml')).toBe('config')
    expect(fileKindFromName('ci.yml')).toBe('config')
    expect(fileKindFromName('Cargo.toml')).toBe('config')
  })

  it('still classifies general source files as code', () => {
    expect(fileKindFromName('index.ts')).toBe('code')
    expect(fileKindFromName('main.py')).toBe('code')
  })
})
