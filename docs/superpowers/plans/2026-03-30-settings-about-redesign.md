# Settings About Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将设置页"关于"升级为品牌名片，融入应用 slogan、理念信念、微信二维码联系方式，同时保留版本元信息。

**Architecture:** 仅修改 `SectionAbout.tsx` 一个文件。图片通过 Vite 静态资源 import 打包（`src/assets/wechat-qrcode.png` 已就绪）。Skeleton loading 与其他 Section 保持一致模式。

**Tech Stack:** React, TypeScript, Vite (static asset import), Tauri (`getAppVersion`)

---

### Task 1: 重写 SectionAbout 组件

**Files:**
- Modify: `src/settings/components/SectionAbout.tsx`

- [ ] **Step 1: 确认图片资源已就绪**

```bash
ls -lh src/assets/wechat-qrcode.png
```

Expected: 文件存在，约 29KB。

- [ ] **Step 2: 重写 SectionAbout.tsx**

完整替换文件内容：

```tsx
import { useState, useEffect } from 'react'
import { getAppVersion } from '../../lib/tauri'
import qrCode from '../../assets/wechat-qrcode.png'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px' }

function SkeletonRow({ width = '100%', height = 28, mb = 14 }: { width?: string | number; height?: number; mb?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 6, marginBottom: mb,
      background: 'linear-gradient(90deg, var(--detail-case-bg) 25%, var(--divider) 50%, var(--detail-case-bg) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  )
}

const beliefs = [
  {
    main: '你只管输入，剩下的交给谨迹。',
    sub: '拖入零散的会议讨论，它会替你把散的拼完整。',
  },
  {
    main: '你的时间应该花在决策上，不是整理上。',
    sub: '整理是谨迹的事，你的精力值得更好的去处。',
  },
]

export default function SectionAbout() {
  const [version, setVersion] = useState('…')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAppVersion().then(v => {
      setVersion(v)
      setLoading(false)
    })
  }, [])

  return (
    <div style={sectionStyle}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes section-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>关于</div>

      {loading ? (
        <>
          {/* 应用名区块 skeleton */}
          <div style={{
            background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
            borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <SkeletonRow height={18} width={60} mb={0} />
            <SkeletonRow height={12} width={160} mb={0} />
          </div>

          {/* 理念 skeleton */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ paddingLeft: 12 }}>
              <SkeletonRow height={13} width="80%" mb={4} />
              <SkeletonRow height={11} width="60%" mb={0} />
            </div>
            <div style={{ paddingLeft: 12 }}>
              <SkeletonRow height={13} width="85%" mb={4} />
              <SkeletonRow height={11} width="65%" mb={0} />
            </div>
          </div>

          {/* 联系作者 skeleton */}
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <SkeletonRow height={120} width={120} mb={0} />
            <SkeletonRow height={10} width={80} mb={0} />
          </div>

          {/* 底部元信息 skeleton */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
            <SkeletonRow height={10} width={240} mb={0} />
          </div>
        </>
      ) : (
        <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
          {/* 应用名区块 */}
          <div style={{
            background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
            borderRadius: 8, padding: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, color: 'var(--item-text)', fontWeight: 500 }}>谨迹</div>
            <div style={{ fontSize: 12, color: 'var(--item-meta)', marginTop: 6 }}>每一次思考，都值得被谨迹</div>
          </div>

          {/* 理念信念 */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {beliefs.map((b, i) => (
              <div key={i} style={{
                borderLeft: '2px solid var(--record-btn)',
                paddingLeft: 12,
              }}>
                <div style={{ fontSize: 13, color: 'var(--item-text)', fontWeight: 600 }}>{b.main}</div>
                <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 3 }}>{b.sub}</div>
              </div>
            ))}
          </div>

          {/* 联系作者 */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>联系作者</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img
                src={qrCode}
                alt="微信二维码"
                style={{ width: 120, height: 120, borderRadius: 8, display: 'block' }}
              />
              <div style={{ fontSize: 10, color: 'var(--duration-text)', marginTop: 8 }}>扫码添加微信</div>
            </div>
          </div>

          {/* 底部元信息 */}
          <div style={{ fontSize: 10, color: 'var(--duration-text)', textAlign: 'center', marginTop: 24 }}>
            版本 {version} · macOS · Tauri · React · Rust · Claude
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 验证编译无报错**

```bash
npm run build
```

Expected: 编译成功，无 TypeScript 错误。若报 `Cannot find module '../../assets/wechat-qrcode.png'`，需在 `src/vite-env.d.ts` 或全局 `d.ts` 中添加：

```ts
declare module '*.png' {
  const src: string
  export default src
}
```

- [ ] **Step 4: 启动开发模式验证视觉效果**

```bash
npm run dev
```

打开设置页 → 关于，检查：
- 应用名卡片居中显示
- 两条信念左侧有金色竖线
- 微信二维码 120px 居中展示
- 底部版本信息一行展示
- 深色/浅色模式切换均正常

- [ ] **Step 5: Commit**

```bash
git add src/settings/components/SectionAbout.tsx src/assets/wechat-qrcode.png
git commit -m "feat(settings): redesign About section with brand narrative and WeChat QR contact"
```
