---
story: ./story.md
design: ./design.md
date: 2026-07-09
round: 7
result: pass
scope: "apps/web/src/settings/components/SectionAiEngine.tsx; apps/web/src/locales/en.ts; apps/web/src/locales/zh.ts; apps/web/src/tests/SectionAiEngine.test.tsx; apps/web/src 同类条件面板扫描"
---

# STORY-20260708-composer-multi-model R7 复验报告

result: pass

## 证据

### 1. 空模型建议时，点击"添加模型"仍展示手动输入框

结论：pass

- `apps/web/src/settings/components/SectionAiEngine.tsx:188-191`：`showDropdown` 已简化为 `open`，不再依赖 `fetching`、`filteredSuggestions.length` 或 `customInput.trim()`。
- `apps/web/src/settings/components/SectionAiEngine.tsx:254-264`：按钮点击时执行 `setOpen((v) => !v)`，且按钮文案为 `t('addModel')`。
- `apps/web/src/settings/components/SectionAiEngine.tsx:265-297`：手动模型 id 的 `<input>` 位于 `{showDropdown && (...)}` 面板内部；因为 `showDropdown === open`，按钮点开后即使 `list_models` 返回空数组，输入框也会渲染。
- `apps/web/src/settings/components/SectionAiEngine.tsx:298-364`：同一面板内部仍保留加载中、候选列表、自定义输入追加三态；本轮修复只纠正外层容器可见性，没有删除原有状态处理。

### 2. `addModel` 翻译键与按钮引用

结论：pass

- `apps/web/src/locales/en.ts:381-382`：保留 `addProvider: 'Add Provider'`，新增 `addModel: 'Add Model'`。
- `apps/web/src/locales/zh.ts:406-407`：保留 `addProvider: '添加供应商'`，新增 `addModel: '添加模型'`。
- `apps/web/src/settings/components/SectionAiEngine.tsx:263`：模型子列表按钮引用 `t('addModel')`，不再误用 `t('addProvider')`。

### 3. 回归测试真实覆盖"空建议情况下仍能添加模型"

结论：pass

- `apps/web/src/tests/SectionAiEngine.test.tsx:15-32`：测试 mock 中 `list_models` 返回 `Promise.resolve([])`，覆盖生产现状下没有建议模型的路径。
- `apps/web/src/tests/SectionAiEngine.test.tsx:74-88`：新增用例点击"添加模型"，随后 `findByPlaceholderText(/model|模型/i)` 等待手动输入框出现，并输入 `claude-test-model` 后回车。
- `apps/web/src/tests/SectionAiEngine.test.tsx:90-94`：断言自定义模型文本出现在界面中，且保存按钮从 disabled 变为可用。
- `apps/web/src/tests/SectionAiEngine.test.tsx:96-105`：点击保存后断言 `set_engine_config` payload 中包含 `providers: [expect.objectContaining({ models: ['claude-test-model'] })]`。这不是只检查按钮存在的弱断言，而是覆盖"打开面板 -> 手动输入 -> 添加到模型列表 -> 保存 models 数组"的完整用户路径。

### 4. 命令验证

结论：pass

```text
cd apps/web && bunx vitest run
Test Files  55 passed (55)
Tests       395 passed (395)
exit code 0
```

```text
cd apps/web && bunx tsc --noEmit
exit code 0
```

## 越界偏差

- 本轮业务代码 diff 限于 `SectionAiEngine.tsx` 的下拉可见性与按钮文案、`en.ts`/`zh.ts` 的新增翻译键、`SectionAiEngine.test.tsx` 的回归测试。均可归属到本次"添加模型按钮无响应"修复。
- 未发现额外功能实现、schema 变更、daemon 路由补齐、`list_models` 协议补齐或输入框以外区域改动。
- 报告文件 `stories/20260708-composer-multi-model/verify-report-r7.md` 为本轮验收产物，不计为业务越界。

## 同类模式排查

结论：未发现需要本轮打回的同类残留。

- `rg` 扫描 `apps/web/src` 中的 `showDropdown`、`showModelDropdown`、`open &&`、`expanded &&` 等条件面板后，未发现另一个与修复前完全一致的"面板容器由 open + 空状态条件共同控制，且必需输入框只存在于该容器内部"模式。
- 最接近候选是 `apps/web/src/components/OnboardingView.tsx:329-332`：`showModelDropdown = modelDropdownOpen && (fetchingModels || filteredModels.length > 0)`；但模型 `<input>` 在下拉外部（`apps/web/src/components/OnboardingView.tsx:478-498`），空建议只会隐藏候选列表，不会藏住手动输入入口，因此不复现本次 bug。
- `apps/web/src/settings/components/SectionAiEngine.tsx:1024-1039` 的添加供应商菜单、`apps/web/src/components/WorkspaceView.tsx:485-514` 的会话下拉均为单纯 `open && (...)`，没有额外空状态门控；不属于本次问题形态。

## 待裁决

- 无。

SUMMARY: result=pass | fail=0 | pending=0
