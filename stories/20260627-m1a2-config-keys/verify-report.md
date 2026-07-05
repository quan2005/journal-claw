# M1a-2 验收报告（Leader 独立验收）：PASS

- 越界：仅 daemon config/ + server.ts + 前端 tauri.ts/httpRuntimeClient + 测试 + story
- 加密：AES-256-GCM（createCipheriv + randomBytes(12) IV），secret.key chmod 0o600
- **密文实证**：探针 setApiKey('sk-SUPERSECRET…') 后扫描 configDir 所有文件，明文不出现；getApiKey 解密一致 → 确证非明文存储
- Gate G 迁移：getWorkspacePath 在本地无值时读 Rust 旧 config.json workspace_path（只读不改）
- platform capabilities：音频/whisperkit/apple_stt 恒 false（M0 已下线）
- daemon 334 passed/46 files（基线 325，+9，零回退）；web tsc clean
