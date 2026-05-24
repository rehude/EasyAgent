# 发布到 npm

本项目已发布:<https://www.npmjs.com/package/rehudex>

---

## 首次发布前的一次性准备

1. 在 <https://www.npmjs.com/signup> 注册账号
2. 终端 `npm login`,按提示完成
3. ⚠️ **必须启用 2FA**(npm 已强制):
   - 登录 npmjs.com → Account → Two-Factor Authentication
   - 选 **Authorization and writes** 模式
   - 用 Authenticator App(Google Authenticator / Microsoft Authenticator / 1Password 等)扫码绑定
   - **务必保存恢复码**,丢手机后只能靠它

---

## 每次发版

```bash
# 1. 升版本号(自动改 package.json + 打 git tag + 创建 commit)
npm version patch       # 0.2.0 → 0.2.1(bug 修复)
npm version minor       # 0.2.0 → 0.3.0(新增功能,向后兼容)
npm version major       # 0.2.0 → 1.0.0(破坏性变更)

# 2. 干跑验证打包内容(可选但推荐)
npm pack --dry-run

# 3. 发布 —— prepublishOnly 钩子会自动 pnpm build
npm publish
# 会问 Enter OTP:_____,打开 Authenticator 输入当前 6 位数字
```

---

## 验证发布成功

```bash
npm view rehudex versions   # 能看到刚发的版本号
```

也可以在 <https://www.npmjs.com/package/rehudex> 直接看页面。

---

## 关于 `files` 字段

`package.json` 的 `files` 字段限定只打 `dist/`、`README.md` 和 `LICENSE` 进 tarball,不会带 `src/`、`.env`、`docs/`、会话 JSONL 等出去。

如果以后新增需要随包发布的资源(比如默认配置模板),记得加进 `files`。

---

## 常见坑

| 现象 | 原因 / 解决 |
|---|---|
| `npm error EBADDEVENGINES` | `package.json` 里有 `devEngines.packageManager` 字段,与当前 npm/pnpm 版本不匹配,删掉该字段 |
| `npm error E403 ... 2FA required` | 没开 2FA,见上文一次性准备 |
| `npm error 403 You do not have permission to publish "xxx"` | 包名被占,改 `package.json` 里的 `name` |
| 发布后 `npx rehudex` 仍是旧版本 | npx 缓存,加 `--ignore-existing` 或 `npm view rehudex` 确认 registry 已更新 |
