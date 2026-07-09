---
story: STORY-20260708-restore-app-icon
round: 1
verifier: independent-subagent
date: 2026-07-09
---

# Verify Report — 恢复谨迹应用 icon 与应用名

## result: pass

## 核对范围

| 文件                              | 存在 | 备注                          |
| --------------------------------- | ---- | ----------------------------- |
| `apps/desktop/electron-builder.yml` | ✅   | 22 行，mac 打包配置           |
| `apps/desktop/src/main.ts`          | ✅   | 203 行，dev 模式品牌代码      |
| `apps/desktop/build/icon.icns`      | ✅   | 68131 字节，ic12 类型，有效   |
| `apps/desktop/build/icon.ico`       | ✅   | MS Windows icon，4 sizes 有效 |
| `apps/desktop/build/icon.png`       | ✅   | 512×512 PNG RGBA，有效        |

## AC 逐条核对

### AC-1 — dev 模式品牌正确 → **PASS**

> Given `npm run desktop:dev` 启动；When 查看 Dock icon 并 hover；Then 显示谨迹 icon 与应用名。

| 子项         | 证据                                                                                                                                  | 结论 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 应用名设置   | `apps/desktop/src/main.ts:26` — `app.setName('JournalClaw')`，注释明确为 "Dev-mode branding (AC-1)"，且在 `app.whenReady()` 之前执行 | ✅   |
| Dock icon    | `apps/desktop/src/main.ts:27-29` — `if (!app.isPackaged && process.platform === 'darwin') app.dock?.setIcon(join(__dirname,'..','build','icon.png'))` | ✅   |
| icon 资产    | `apps/desktop/build/icon.png` 存在，512×512，sha256 = `9186b7433f4127140e0fa9a87b06d1f8824ae373b79aaafb57566fe0986212d1`               | ✅   |
| 原样恢复     | 与历史 `bbe354d^:src-tauri/icons/icon.png` sha256 **完全一致**（同一 hash）                                                            | ✅   |

### AC-2 — 打包产物品牌正确 → **PASS**

> Given 安装/打开打包应用；When 查看 Dock、程序切换器、About；Then icon 与名称均为谨迹的。

| 子项              | 证据                                                                                                       | 结论 |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ---- |
| productName       | `apps/desktop/electron-builder.yml:5` — `productName: JournalClaw`                                         | ✅   |
| mac icon 指向     | `apps/desktop/electron-builder.yml:12` — `icon: build/icon.icns`                                           | ✅   |
| icon.icns 资产    | `apps/desktop/build/icon.icns` 存在，68131 字节，sha256 = `dc04c94873edf90b122f97619137ce66fe2bb1d84c4e4d88bad0049cc1199505` | ✅   |
| 原样恢复          | 与历史 `bbe354d^:src-tauri/icons/icon.icns` sha256 **完全一致**                                            | ✅   |
| 实际产物验证      | `release/mac-arm64/JournalClaw.app/Contents/Info.plist`：`CFBundleName=JournalClaw`、`CFBundleDisplayName=JournalClaw`、`CFBundleIconFile=icon.icns` | ✅   |
| 产物 icon 正确    | `release/.../Resources/icon.icns` 存在（取代旧 `electron.icns`），sha256 与源 `build/icon.icns` **完全一致** | ✅   |

## 三类边界（Won't）核对

| Won't 条目                                                 | 结论 | 证据/说明                                                                                                       |
| ---------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| 不重新设计 icon（原样恢复）                                | ✅   | icns/ico/png 三个文件 sha256 与 `bbe354d^:src-tauri/icons/` 中对应文件**逐字节一致**，零修改                    |
| 不做 Windows/Linux 打包适配之外的额外工作                  | ✅   | `electron-builder.yml` 仅配置 `mac` target；icon.ico 虽恢复但未新增 win/linux target，无越界                     |
| 不涉及应用内 UI icon 体系                                  | ✅   | 改动只触及 `apps/desktop/build/`、`apps/desktop/src/main.ts`、`apps/desktop/electron-builder.yml`，无 UI 侧改动 |

## 不漏 / 不重 / 不偏 / 不倚 / 不多 / 不少 自检

- **不漏**：dev 模式（setName + dock.setIcon）+ 打包模式（productName + mac.icon）双路径覆盖；macOS dev 仅 darwin 分支生效，避免污染其他平台。
- **不重**：未发现重复设置；dev 用 `app.setName` + `dock.setIcon`，打包用 builder yml，互不冲突。
- **不偏**：所有改动直接服务于 AC-1/AC-2，无无关重构。
- **不倚**：未依赖实现者自述；所有结论来自文件读取、`file`/`shasum`/`PlistBuddy`/`git show` 的客观输出。
- **不多**：无超额实现（如自作主张加 win/linux target 或新设计 icon）。
- **不少**：menu.ts 使用 `app.name` 作为 macOS 首菜单 label（menu.ts:14），setName 后会自动跟随为 "JournalClaw"，链路完整。

## 附加验证

- `apps/desktop` 包内 `bun run typecheck`（tsc --noEmit）**通过**，无类型错误。
- `apps/desktop/src/menu.ts:14` 使用 `app.name` 作为 macOS 应用菜单首项 label — `setName('JournalClaw')` 后菜单名自动正确，无需硬编码。

## 越界 / 偏差清单

无。

## 待用户裁决项

1. **应用名中文显示**：AC 措辞为「JournalClaw / 谨迹」（斜杠暗示二选一）。当前实现统一为英文 `JournalClaw`（productName、setName、Info.plist 三处一致）。若产品期望 macOS 本地化显示中文「谨迹」，需额外配置 `*.lproj/InfoPlist.strings`，本故事未涉及——但根据 AC 字面「JournalClaw / 谨迹」二者皆可，当前实现**满足** AC，仅作信息性提示。

**裁定：接受英文 `JournalClaw`。** AC 字面允许二选一，且与代码库其余英文命名（productId、包名）一致，不需要额外本地化配置。pending 清零。

SUMMARY: result=pass | fail=0 | pending=0
