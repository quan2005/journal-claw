# verify-report — STORY-20260708-fix-image-preview

- 轮次：1
- 核对范围：apps/daemon/src/files/service.ts, apps/daemon/src/server.ts, apps/web/src/lib/runtimeClient.ts, apps/web/src/lib/httpRuntimeClient.ts, apps/web/src/components/DetailView.tsx, apps/daemon/src/files/service.test.ts, apps/daemon/src/server.test.ts
- design.md：本任务无（核对范围声明）
- 测试运行：daemon 35 files / 220 tests 全过；web 55 files / 392 tests 全过

## result: pass

---

## AC 逐项核对

### AC-1 — PNG 正常显示 → PASS

**Given** workspace 中存在一个有效的 PNG 文件 / **When** 用户在树中点击 / **Then** 详情区完整渲染、无错误、无空白。

端到端链路完整且每一环均有证据：

1. 文件分类：`fileKindFromName('photo.png')` → `'image'`（apps/web/src/lib/fileKind.ts:55-62，PNG 走 `case 'png'`）。
2. 详情区命中图片分支：DetailView.tsx:1797-1802 — `if (fileKind === 'image') { const src = selectRuntimeClient().getWorkspaceFileUrl(file.path); return ... <ImagePreview src={src} .../> }`。
3. URL 构建（同步、纯字符串）：httpRuntimeClient.ts:972-974 — `getWorkspaceFileUrl` 返回 `${baseUrl}/files/content-binary?relativePath=<enc>`。接口契约在 runtimeClient.ts:19-23。
4. daemon 路由：server.ts:1091-1101 — `GET /files/content-binary` 调用 `filesService().getBinaryContent(relativePath)`，`res.type(mimeType).send(data)`，并设 `Cache-Control: no-store`。
5. 字节读取 + MIME 推断：service.ts:173-176 `getBinaryContent` → `readFileSync` + `mimeTypeFromExtension`；PNG 映射 `image/png`（service.ts:622）。
6. 路径安全：`getBinaryContent` → `resolveExistingFile` → `resolveInsideRoot`，workspace 内部约束 + 符号链接拒绝（service.ts:511-555）。

测试证据：
- server.test.ts:93-120 `GET /files/content-binary streams bytes with the right Content-Type (fix-image-preview)`：写入真实 PNG 字节 → fetch 返回 200、`content-type === 'image/png'`、`bytes.equals(png)` 为 true；缺失文件返回 404。
- service.test.ts:105-117 `reads binary content with a MIME type inferred from the extension`：`getBinaryContent('photo.png').mimeType === 'image/png'` 且 `data.equals(png)` 为 true。

无无限 spinner：图片类型在加载 effect 中不会被 `setLoading(true)`（DetailView.tsx:1214-1239 仅对 markdown/text/html/code/csv/特定 other 置 loading），渲染期 `if (loading)` 被跳过直接命中 `if (fileKind === 'image')`。

### AC-2 — 其他常见图片格式同样修复 → PASS

**Given** JPG/GIF/WebP/SVG / **When** 点击 / **Then** 同一根因一并覆盖。

- daemon MIME 表覆盖全格式：service.ts:621-630 — `jpg/jpeg → image/jpeg`、`gif → image/gif`、`webp → image/webp`、`svg → image/svg+xml`、`bmp → image/bmp`（外加 png/pdf）。
- 前端分类覆盖同一组：fileKind.ts:55-62 — png/jpg/jpeg/gif/webp/svg/bmp 均归 `'image'`。
- 渲染路径单一：DetailView.tsx:1797 所有 `fileKind === 'image'` 共用 `<ImagePreview>`，不存在"只修 PNG 路径"的分叉。

测试证据：service.test.ts:115 显式断言 `getBinaryContent('notes.svg').mimeType === 'image/svg+xml'`；service.test.ts:116 断言未知扩展名回退 `application/octet-stream`。jpg/gif/webp 与 png 走同一 `MIME_TYPES_BY_EXTENSION` 查表逻辑，等价覆盖。

### AC-3 — 损坏图片的可理解反馈 → PASS（实现正确，缺自动化 UI 测试）

**Given** 损坏/不完整图片 / **When** 点击 / **Then** 明确"无法预览"反馈而非无限加载或崩溃。

- 组件：DetailView.tsx:258-312 `ImagePreview`，`const [failed, setFailed] = useState(false)`，`<img onError={() => setFailed(true)} />`。
- 失败态渲染：DetailView.tsx:282-295 — 显示 `<span>无法预览此图片</span>` + 文件名，使用结构化 token（`var(--item-meta)` 等）。
- 触发机制：浏览器对无法解码的字节（或 4xx/5xx 响应）触发 `<img>` 的 `onError` → `setFailed(true)` → 切换到失败视图，无崩溃、无挂起 spinner。

证据级别说明：实现路径正确（标准 `onError` 是浏览器检测解码失败的通用机制），但核对范围内无针对 `ImagePreview` 失败态的自动化测试（DetailView.test.tsx 未覆盖 `fileKind === 'image'` 分支）。属测试覆盖缺口，不影响 AC 行为成立。

## Won't 边界核对

- **不涉及 markdown 内嵌图片渲染**：本次改动仅影响"点击树中图片文件"路径（`fileKind === 'image'`）；markdown 内嵌图走 `renderMarkdown`，未改动。✓
- **不涉及图片编辑/标注**：`ImagePreview` 只读，无编辑/标注控件。✓
- **不做缩放/旋转等查看器增强**：仅 `objectFit: 'contain'` + `maxWidth/maxHeight: 100%`，无 zoom/rotate UI。✓
- **不做视频等其他媒体预览**：video/audio 走独立 fileKind 分支，未在本故事范围内。✓

## 越界 / 偏差清单

无。范围内 7 个文件的改动均直接服务于 fix-image-preview：
- service.ts：新增 `getBinaryContent` + `MIME_TYPES_BY_EXTENSION` + `mimeTypeFromExtension`（service.ts:168-176, 621-635）。
- server.ts：新增 `GET /files/content-binary` 路由（server.ts:1087-1101）。
- runtimeClient.ts / httpRuntimeClient.ts：新增 `getWorkspaceFileUrl`（接口 + HTTP 实现）。
- DetailView.tsx：新增 `ImagePreview` 组件 + 图片渲染分支（258-312, 1796-1803）。
- 两个测试文件：新增对应单测。

无可疑无关改动、无调试残留。

## 待用户裁决项

1. **AC-3 自动化测试缺口**：`ImagePreview` 的 `onError → "无法预览此图片"` 路径无前端测试。实现正确但回归保护弱。是否要求补一条 DetailView 图片失败态测试由用户裁决。

**裁定：已补齐。** 新增 `apps/web/src/tests/DetailView.test.tsx` 的 `image file preview` describe 块，覆盖正常渲染（daemon URL，非 `file://`）与 `onError → "无法预览此图片"` 两条路径。全量回归 394/394 通过。pending 清零。

SUMMARY: result=pass | fail=0 | pending=0
