import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // ── 架构护栏（WS-3）：lib/ 之外（消费层）禁止绕过 runtimeClient / hostBridge。
  // 见 docs/ARCH.md「依赖方向规则」。覆盖整个 src/，排除 lib/（hostBridge/runtimeClient 等合法实现）
  // 与 tests/（合法 mock）。单一 block 避免 no-restricted-syntax 被后续 block 覆盖（flat-config 同名规则后值覆盖前值）。
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/**', 'src/tests/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message:
                "禁止直接 import 'electron' — 宿主能力走 lib/hostBridge.ts（docs/ARCH.md 依赖方向规则）。",
            },
            {
              name: 'tauri',
              message:
                "Tauri 后端已下线（M8-b）— 直接消费 runtimeClient / hostBridge（docs/ARCH.md 已下线能力）。",
            },
          ],
          patterns: [
            {
              group: ['**/lib/tauri', '**/lib/tauri.*'],
              message:
                'lib/tauri.ts 兼容 shim 已于 2026-07-03 拆除 — 直接消费 runtimeClient / hostBridge（docs/ARCH.md 历史注记）。',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='window'][property.name='electronAPI']",
          message:
            '禁止直接访问 window.electronAPI — 走 lib/hostBridge.ts 包装（docs/ARCH.md 依赖方向规则）。',
        },
        {
          selector: 'Literal[value=/localhost|127\\.0\\.0\\.1/]',
          message:
            '禁止硬编码 daemon URL（localhost/127.0.0.1）— 业务调用走 runtimeClient（docs/ARCH.md 依赖方向规则）。',
        },
        {
          selector:
            "MemberExpression[object.name='localStorage'], MemberExpression[property.name='localStorage']",
          message:
            '禁止在消费层用 localStorage 持久化业务状态 — 业务状态归 daemon；纯 UI/布局状态（面板宽度等 ARCH.md 白名单）如需豁免，加 // eslint-disable-next-line 并注明理由。',
        },
      ],
    },
  },
)
