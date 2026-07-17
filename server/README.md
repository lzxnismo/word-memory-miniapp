# 微信小程序云托管 API 服务

微信小程序后端服务，基于 Express + MySQL (CynosDB)，Docker 容器化部署到微信云托管。

## 📁 项目结构

```
word-memory-api/
├── app.js                    # Express 主入口
├── package.json              # 依赖配置
├── Dockerfile               # 容器镜像定义
├── docker-compose.yml       # Docker Compose 编排
├── .env.example             # 环境变量模板
├── routes/
│   └── word_sets.js         # RESTful 路由（已验证 9 端点）
├── shared/
│   ├── db.js                # MySQL 连接池
│   └── auth.js              # OpenID 认证中间件
├── middleware/
│   └── errorHandler.js      # 全局错误处理
└── scripts/
    └── check_db.py          # 数据库表检查工具
```

## 🚀 快速启动

### 本地开发
```bash
# 1. 配置环境变量
cp .env.example .env
vim .env  # 修改数据库密码等敏感信息

# 2. 启动服务
docker compose up -d

# 3. 查看日志
docker compose logs -f api

# 4. 停止服务
docker compose down
```

### 微信云托管部署
参考 [微信云托管官方文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloudaa/cloudrun/introduction.html)

## 🧪 API 测试

```bash
# 健康检查
curl http://localhost:3000/health

# 创建单词集
curl -X POST http://localhost:3000/api/v1/word_sets \
  -H "Content-Type: application/json" \
  -H "x-test-openid: test-user-001" \
  -d '{"name":"六级高频","description":"测试","color":"#a8edea"}'

# 添加单词
curl -X POST http://localhost:3000/api/v1/word_sets/1/words \
  -H "Content-Type: application/json" \
  -H "x-test-openid: test-user-001" \
  -d '{"wordId":701}'

# 列表查询
curl -H "x-test-openid: test-user-001" http://localhost:3000/api/v1/word_sets

# 详情查询
curl -H "x-test-openid: test-user-001" http://localhost:3000/api/v1/word_sets/1

# 查词
curl -H "x-test-openid: test-user-001" "http://localhost:3000/api/v1/word_sets/lookup/abandon"

# 更新
curl -X PUT http://localhost:3000/api/v1/word_sets/1 \
  -H "Content-Type: application/json" \
  -H "x-test-openid: test-user-001" \
  -d '{"name":"六级核心词汇","description":"已更新"}'

# 删除单词
curl -X DELETE http://localhost:3000/api/v1/word_sets/1/words/701 \
  -H "x-test-openid: test-user-001"

# 删除集合
curl -X DELETE http://localhost:3000/api/v1/word_sets/1 \
  -H "x-test-openid: test-user-001"
```

## 🏗️ 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 运行时 | Node.js | 18.x Alpine |
| Web 框架 | Express | ^4.18.2 |
| 数据库驱动 | mysql2 | ^3.6.0 |
| 数据库 | CynosDB MySQL | 5.7+ |
| 容器镜像 | node:18-alpine | 140MB |

## ⚠️ 避坑指南

详见 `SKILL.md` 中的完整避坑指南：
1. **表名不一致**: 代码使用 `word_set_words`，实际表名为 `word_set_items`
2. **SQL 聚合函数误用**: `MAX()` 不能在 VALUES 中直接使用
3. **参数命名不匹配**: 前端传 `wordId`，后端需解构为 `wordId` 而非 `word_id`
4. **Docker 缓存**: 强制 `--no-cache` 重新构建解决代码未生效
5. **MySQL 子查询限制**: INSERT 中引用目标表需双层嵌套绕过

## 📊 性能指标

- 镜像大小：140MB
- 启动时间：<3 秒
- 响应延迟：<100ms
- 并发能力：10 连接池

## 🔐 安全建议

1. **环境变量管理**: 所有敏感信息通过环境变量传入，禁止硬编码
2. **OpenID 验证**: 所有业务接口必须通过 OpenID 认证中间件
3. **SQL 注入防护**: 全部使用参数化查询（prepared statements）
4. **HTTPS**: 生产环境强制使用 HTTPS

## 👥 版权信息

一帮人马工作室（QQ691481548）  
License: MIT
