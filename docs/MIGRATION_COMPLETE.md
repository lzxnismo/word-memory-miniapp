# ✅ 微信云托管迁移完成报告

**最终更新**: 2026-07-22  
**状态**: ✅ 全部完成，callContainer 内网通信验证通过

## 📊 迁移概览

| 项目 | 状态 | 说明 |
|------|------|------|
| **后端数据库** | ✅ 已迁移 | 腾讯云 CynosDB → 微信云 MySQL |
| **后端服务** | ✅ 运行中 | `express-yoq0` 容器健康状态正常 |
| **前端所有页面** | ✅ 已改造 | 全部改用 `wx.cloud.callContainer()` |
| **通信方式** | ✅ 微信内网 | `wx.cloud.callContainer()` 内网直连，无需域名 |
| **OpenID 认证** | ✅ 自动注入 | 云托管网关自动注入 `x-wx-openid`，无需手动登录 |
| **开发工具** | ✅ 验证通过 | 所有页面功能正常，无报错 |

## 🎯 最终架构

```
小程序 → wx.cloud.callContainer() → 微信私有协议 → 云托管网关
                                                    ↓
                                          x-wx-openid 自动注入
                                                    ↓
                                          express-yoq0 容器
                                          prod-d2g668gku1c36b430
```

## 🔑 关键配置

| 参数 | 值 |
|------|-----|
| 云托管环境 ID | `prod-d2g668gku1c36b430` |
| 服务名称 | `express-yoq0` |
| 通信方式 | `wx.cloud.callContainer()` |
| `X-WX-SERVICE` 头 | 必须传，否则报 `-601031` |
| `wx.cloud.init` | env 可留空，实际环境在 `callContainer.config.env` 指定 |

## 📝 本次修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `app.js` | 恢复 `wx.cloud.init()`，去除手动 `wx.login()` |
| `utils/request.js` | `wx.request()` → `wx.cloud.callContainer()`，加 `X-WX-SERVICE` 头 |
| `pages/flash-card/flash-card.js` | GET→POST、响应格式修复、单词集学习模式 |
| `pages/dictation/dictation.js` | GET→POST、TTS 参数修复 |
| `pages/words-list/words-list.js` | TTS 参数修复 |
| `pages/wordset-list/wordset-list.js` | POST→GET |
| `pages/wordset-detail/wordset-detail.js` | 查找接口路径、参数名、删除状态码修复 |
| `server/routes/auth.js` | 新增微信登录认证路由（保留备用） |

## ⚠️ 注意事项

1. **`X-WX-SERVICE: 'express-yoq0'`** 是必须的头，否则云托管找不到服务
2. **不需要配置合法域名** — `callContainer` 走微信内网，不触发域名校验
3. **`wx.cloud.init` 的 env 可以留空** — 实际环境在 `callContainer.config.env` 指定
4. **线上用户** — OpenID 由云托管网关自动注入，数据隔离，无需手动登录

---

© 一帮人马工作室（QQ691481548）