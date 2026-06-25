import { describe, expect, it } from 'vitest'
import packageJson from '../../package.json'

type PackageJson = {
  scripts?: Record<string, string>
}

const scripts = (packageJson as PackageJson).scripts

describe('package scripts', () => {
  it('prebuilds Magic UI bundles before starting dev', () => {
    expect(scripts?.predev).toBe('npm run build:magicui')
  })
})
