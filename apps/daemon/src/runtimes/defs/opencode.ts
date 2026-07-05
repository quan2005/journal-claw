/**
 * opencode adapter def — spawns `opencode run --format json` with the prompt streamed over stdin.
 *
 * Real argv, adapted from open-design runtimes/defs/opencode.ts:
 *   opencode run --format json [-m <provider/model>]
 */
import type { RuntimeAgentDef, RuntimeBuildOptions } from '@journal/contracts'

export const opencodeAgentDef: RuntimeAgentDef = {
  id: 'opencode',
  name: 'OpenCode',
  bin: 'opencode',
  fallbackBins: ['opencode-cli'],
  version: { args: ['--version'], timeoutMs: 5000 },
  buildArgs: (
    _prompt: string,
    _imagePaths: string[],
    _extraAllowedDirs: string[] = [],
    options: RuntimeBuildOptions = {},
  ): string[] => {
    const args = ['run', '--format', 'json']
    if (options.model && options.model !== 'default') {
      args.push('-m', options.model)
    }
    return args
  },
  promptViaStdin: true,
  promptInputFormat: 'text',
  streamFormat: 'opencode-json',
  fallbackModels: [
    { id: 'default', label: 'Default' },
    { id: 'anthropic/claude-sonnet-4-5', label: 'anthropic/claude-sonnet-4-5' },
    { id: 'openai/gpt-5', label: 'openai/gpt-5' },
    { id: 'google/gemini-2.5-pro', label: 'google/gemini-2.5-pro' },
  ],
  installUrl: 'https://opencode.ai/docs/',
  docsUrl: 'https://opencode.ai/docs/',
}
