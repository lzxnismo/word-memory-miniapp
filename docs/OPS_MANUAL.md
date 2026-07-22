# 🔧 运维手册

> **项目**: Word Memory — 微信小程序版单词记忆系统  
> **工作室**: 一帮人马工作室（QQ691481548）  
> **最后更新**: 2026-07-22

---

## 1. 环境变量配置

### 1.1 所有环境变量一览

| 变量名 | 用途 | 配置位置 | 当前值 | 默认值 |
|--------|------|----------|--------|--------|
| `PORT` | 后端服务端口 | 云托管设置 | 自动注入 | 3000 |
| `NODE_ENV` | 运行环境 | 云托管设置 | production | development |
| `DATABASE_HOST` | MySQL 主机 | 云托管设置 | 10.40.109.26 | 10.40.109.26 |
| `DATABASE_PORT` | MySQL 端口 | 云托管设置 | 3306 | 3306 |
| `DATABASE_USER` | MySQL 用户名 | 云托管设置 | word_memory_app | word_memory_app |
| `DATABASE_PASSWORD` | MySQL 密码 | 云托管设置 | Root_123 | Root_123 |
| `DATABASE_NAME` | MySQL 数据库名 | 云托管设置 | word_memory_db | word_memory_db |
| `APPID` | 微信小程序 AppID | 云托管设置 | 为空（开发模式） | — |
| `APPSECRET` | 微信小程序 AppSecret | 云托管设置 | 为空（开发模式） | — |

### 1.2 云托管控制台配置

**路径**: 微信云托管控制台 → 环境 `prod-d2g668gku1c36b430` → 服务 `express-yoq0` → 设置 → 环境变量

**必填环境变量**:
```bash
DATABASE_HOST=10.40.109.26
DATABASE_PORT=3306
DATABASE_USER=word_memory_app
DATABASE_PASSWORD=Root_123
DATABASE_NAME=word_memory_db
NODE_ENV=production
```

**可选环境变量**（上线后配置）:
```bash
APPID=wx123456789...   # 从微信小程序后台获取
APPSECRET=abcdef123...  # 从微信小程序后台获取
```

> ⚠️ 如果 `APPID`/`APPSECRET` 未配置，`POST /auth/login` 会返回模拟 OpenID。当前 `callContainer` 模式下此接口不会被调用，无需配置。

---

## 2. 连接信息

### 2.1 云托管

| 项目 | 值 |
|------|-----|
| 环境 ID | `prod-d2g668gku1c36b430` |
| 服务名称 | `express-yoq0` |
| 公网域名 | `https://express-yoq0-283362-9-1453336058.sh.run.tcloudbase.com` |
| 内网端口 | 3000 |
| 健康检查 | `GET /health` → `{"status":"healthy",...}` |
| 基础路径 | `/api/v1` |

### 2.2 数据库 (MySQL)

| 项目 | 值 |
|------|-----|
| 主机 | `10.40.109.26`（微信云内网） |
| 端口 | 3306 |
| 数据库名 | `word_memory_db` |
| 用户名 | `word_memory_app` |
| 密码 | `Root_123` |
| 连接方式 | 仅云托管内网可达，不可公网直连 |
| 外网管理地址 | `sh-cynosdbmysql-grp-pftyzw6w.sql.tencentcdb.com:24073` |

### 2.3 代码仓库

| 项目 | 值 |
|------|-----|
| 仓库地址 | `git@github.com:lzxnismo/word-memory-miniapp.git` |
| 分支 | `master` |
| 前端目录 | `word_memory_miniapp/` |
| 后端目录 | `word_memory_miniapp/server/` |

---

## 3. 部署流程

### 3.1 后端部署（云托管自动部署）

```bash
# 1. 修改后端代码
cd /opt/win_hermes/word_memory_miniapp/server
# 编辑文件 ...

# 2. 提交并推送
git add -A
git commit -m "修改说明"
git push origin master

# 3. 云托管自动触发构建部署（约 2-5 分钟）
# 可在云托管控制台查看部署状态
```

### 3.2 前端部署（开发者工具上传）

```
1. 打开微信开发者工具
2. 项目目录: /opt/win_hermes/word_memory_miniapp
3. 工具栏 → 上传
4. 填写版本号（如 2.0.1）
5. 登录小程序管理后台 → 提交审核
6. 审核通过 → 发布
```

### 3.3 Docker 手动构建（本地测试）

```bash
cd /opt/win_hermes/word_memory_miniapp/server
docker build -t word-memory-server .
docker run -p 3000:3000 \
  -e DATABASE_HOST=10.40.109.26 \
  -e DATABASE_USER=word_memory_app \
  -e DATABASE_PASSWORD=Root_123 \
  word-memory-server
```

---

## 4. 开发环境配置

### 4.1 微信开发者工具

| 设置项 | 值 |
|--------|-----|
| AppID | 你的小程序 AppID |
| 基础库版本 | 3.16.2+ |
| 不校验合法域名 | ✅ 勾选 |
| 调试模式 | ✅ 建议开启 |
| ES6 转 ES5 | ✅ 开启 |
| 增强编译 | ✅ 开启 |

### 4.2 前端关键配置

**文件**: `utils/request.js`

```javascript
const CLOUD_CONFIG = {
  env: 'prod-d2g668gku1c36b430',   // 云托管环境 ID
  service: 'express-yoq0',           // 云托管服务名称
  timeout: 15000                     // 超时时间 15s
}

const CONFIG = {
  debug: true    // 开发环境开启调试日志，上线前改为 false
}
```

**文件**: `app.js`

```javascript
wx.cloud.init({
  env: ''  // 留空，实际环境在 callContainer 中指定
})
```

### 4.3 后端测试

```bash
# 健康检查
curl https://express-yoq0-283362-9-1453336058.sh.run.tcloudbase.com/health

# 测试接口
curl -X POST \
  https://express-yoq0-283362-9-1453336058.sh.run.tcloudbase.com/api/v1/word_sets \
  -H "Content-Type: application/json" \
  -H "x-test-openid: test_user" \
  -d '{"name":"测试单词集"}'
```

---

## 5. 监控与日志

### 5.1 云托管日志

```
云托管控制台 → 环境 prod-d2g668gku1c36b430
  → 服务 express-yoq0
  → 日志
```

### 5.2 后端健康检查

```bash
# 健康检查接口
curl https://express-yoq0-283362-9-1453336058.sh.run.tcloudbase.com/health

# 预期返回
{"status":"healthy","version":"2.0.0","app":"Word Memory System","uptime":12345,"timestamp":"2026-07-22T10:00:00.000Z"}
```

### 5.3 数据库监控

```sql
-- 查看连接数
SHOW STATUS LIKE 'Threads_connected';

-- 查看数据量
SELECT table_name, table_rows, ROUND(data_length/1024/1024,2) as size_mb
FROM information_schema.tables
WHERE table_schema = 'word_memory_db'
ORDER BY table_rows DESC;
```

---

## 6. 常见运维问题

### Q: 云托管部署后接口返回 404
**原因**: 新代码尚未部署完成，或路由未注册。
**检查**: 云托管控制台 → 部署状态 → 是否已完成。

### Q: 云托管 callContainer 返回 -601031
**原因**: 缺少 `X-WX-SERVICE` 头或服务名错误。
**修复**: 确认 `request.js` 中 `service: 'express-yoq0'` 正确。

### Q: 数据库连接失败
**原因**: 云托管内网 IP 变更或密码错误。
**检查**: 云托管控制台 → 环境变量 → `DATABASE_HOST`/`DATABASE_PASSWORD`。

### Q: 开发者工具请求正常，真机/线上失败
**原因**: 未配置合法域名（当前 `callContainer` 模式不需要）。
**确认**: 确认使用 `wx.cloud.callContainer()` 而非 `wx.request()`。

---

> **更新**: 2026-07-22 | **维护者**: 一帮人马工作室（QQ691481548）