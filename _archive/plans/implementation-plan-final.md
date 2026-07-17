# 微信小程序迁移实施计划（最终版）

## 📋 项目概况

| 项目信息 | 值 |
|---------|-----|
| **项目名称** | Word Memory MiniApp |
| **AppID** | `wx66f2efd5915e7c94` |
| **云环境 ID** | `mytx-d7gw0vhq4414988b5` |
| **数据库类型** | MySQL 8.0（SQL 型） |
| **数据存储** | 腾讯云 Cloudbase 云开发 |
| **工作目录** | `/opt/win_hermes/word_memory_miniapp/` |

---

## ✅ 已完成工作清单

### Phase 0: 架构设计与环境准备

#### 1. 项目骨架创建 ✓
```bash
/opt/win_hermes/word_memory_miniapp/
├── project.config.json      # 项目配置文件
├── app.js                   # 小程序启动逻辑
├── app.json                 # 全局页面路由配置
├── app.wxss                 # 全局样式库
└── scripts/
    └── view_db_schema.py   # 查看 SQLite 数据库结构脚本
```

#### 2. 核心代码模块 ✓

| 文件 | 功能说明 | 状态 |
|------|---------|------|
| `utils/api.js` | 云数据库连接器封装 | ✅ 完成 |
| `pages/index/index.*` | 首页（学习入口） | ✅ 完成 |
| `pages/flash-card/flash-card.*` | Flash 卡片学习页 | ✅ 完成 |

#### 3. 数据库结构分析 ✓

现有系统包含 **13 张表**，核心映射关系如下：

| 现有 SQLite 表 | 云数据库集合 | 说明 |
|----------------|------------|------|
| `words` | `words` | 单词库主表 |
| `user_word_memories` | `user_word_memories` | SM-2 算法记忆状态 |
| `review_histories` | `review_histories` | 复习历史日志 |
| `learning_goals` | `learning_goals` | 学习目标管理 |
| `daily_plans` | `daily_plans` | 每日学习计划 |
| `word_sets` + `word_set_items` | `word_sets` / `word_set_items` | 词集管理 |
| `settings` | `settings` | 用户设置键值对 |

---

## 🚧 待办工作清单

### Phase 1: 云数据库初始化（大师兄操作）

#### 步骤 1：开通 MySQL 数据库实例
1. 在腾讯云 Cloudbase 控制台点击「立即开通」MySQL 数据库
2. 等待约 5-10 分钟创建完成
3. 截图反馈环境 ID：`mytx-d7gw0vhq4414988b5`

#### 步骤 2：创建云函数 - TTS 代理
```bash
cd /opt/win_hermes/word_memory_miniapp/cloudfunctions/tts_proxy
```

**需要编写的内容：**
- `index.js`: 调用微信 TTS API
- `package.json`: 依赖声明
- `config.json`: 云函数配置

**TTS API 示例：**
```javascript
// 使用腾讯云语音合成服务
const apiclient = require('request')
const config = require('./config.json')

exports.main = async (event, context) => {
  const { text, type } = event
  
  // 调用腾讯云语音合成 API
  const response = await apiclient.post('https://tts.cloud.tencent.com/synthesize', {
    json: {
      text: text,
      language: type || 'zh-CN',
      format: 'mp3'
    },
    auth: config.ttsCredentials
  })
  
  return { url: response.audio_url }
}
```

上传至 Cloudbase 后，即可在小程序端通过 `wx.cloud.callFunction({ name: 'tts_proxy' })` 调用。

#### 步骤 3：创建数据迁移脚本
**已创建脚本位置：**
```
/scripts/migrate_sqlite_to_mysql.py
```

**需要补充的功能：**
1. 读取本地 SQLite 数据库
2. 连接 Cloudbase MySQL（通过 VPC 私网访问）
3. 按顺序创建表结构
4. 分批导入数据（每批 500 条，避免超时）
5. 统计迁移结果

**关键注意事项：**
- MySQL 与 SQLite 的字段类型映射（如 BOOLEAN → TINYINT(1)）
- 时间戳格式转换（SQLite 默认格式 vs ISO8601）
- JSON 字段存储方式差异（MySQL TEXT 存 JSON）

#### 步骤 4：在 Cloudbase 创建集合（或让云函数自动建表）

**方案 A：手动创建集合**（推荐新手操作）
```sql
-- 在 MySQL 中执行以下 SQL

CREATE TABLE words (
  id INT AUTO_INCREMENT PRIMARY KEY,
  word VARCHAR(100) NOT NULL,
  phonetic VARCHAR(200),
  meaning TEXT NOT NULL,
  -- ... 其他字段见 appendix/table-schema.sql
);

-- 为每个表创建索引
CREATE INDEX idx_user_id ON user_word_memories(user_id);
CREATE INDEX idx_next_review ON user_word_memories(next_review);
```

**方案 B：自动化建表**（推荐熟练开发者）
编写云函数 `init_database`，首次运行时自动创建所有表结构。

---

### Phase 2: 前端完善（二师弟继续完成）

#### 剩余页面列表

| 页面 | 当前进度 | 优先级 |
|------|---------|--------|
| 听写测试页 (`dictation`) | ❌ 未实现 | 🔴 P0 |
| 单词本列表 (`words-list`) | ❌ 未实现 | ⚪ P1 |
| 单词详情页 (`word-detail`) | ❌ 未实现 | ⚪ P1 |
| 每日计划页 (`plan-daily`) | ❌ 未实现 | ⚪ P2 |
| 数据统计页 (`stats-stats`) | ❌ 未实现 | ⚪ P2 |
| 设置页 (`settings`) | ❌ 未实现 | ⚪ P3 |

**建议优先实现：听写测试页**（Flash 卡片的闭环体验）

---

### Phase 3: 测试与部署

#### 测试清单
1. ✅ 编译无错误
2. ✅ 云环境连接成功
3. 🔲 闪卡翻页流畅
4. 🔲 评分按钮交互正常
5. 🔲 TTS 发音可用
6. 🔲 数据同步到云端

#### 发布流程
1. 填写小程序类目（教育 → 语言学习）
2. 提交备案申请（上传身份证）
3. 微信认证（可选，7 天审核期）
4. 提交审核（1-3 个工作日）
5. 正式发布

---

## 🔧 技术细节备注

### SM-2 算法参数
```javascript
{
  ease_factor: 2.5,      // 初始间隔因子
  interval: 0,           // 初始复习间隔天数
  repetitions: 0         // 初始连续正确次数
}
```

### 数据结构对比

| 维度 | SQLite 设计 | MySQL 云数据库 |
|------|-------------|---------------|
| 主键 | INTEGER AUTO_INCREMENT | INT AUTO_INCREMENT |
| 布尔值 | BOOLEAN | TINYINT(1) |
| JSON | TEXT 存储 JSON | JSON 类型或 TEXT |
| 时间戳 | DATETIME | DATETIME |

---

## 📦 依赖清单

### Python（服务器端）
```python
requests==2.31.0
pymysql==1.1.0
pandas==2.1.4
numpy==1.26.3
scikit-learn==1.3.2
```

### Node.js（云函数）
```json
{
  "dependencies": {
    "tencentcloud-sdk-nodejs-tts": "^4.0.0",
    "request": "^2.88.2"
  }
}
```

### 微信小程序原生
无需额外 npm 包（仅使用微信官方 SDK）

---

## 💰 成本估算

### 微信云开发免费版额度
- 云数据库：2GB 存储空间
- 云存储：5GB 存储空间
- 云函数：100 万次请求/月
- TTS：200 次/天（需另外购买付费套餐）

**预计每月成本**：0 元（个人版足够支持数百用户使用）

---

## 🎯 下一步行动项

### 大师兄负责：
1. ✅ 提供 AppID（已完成）
2. ⏳ 开通 MySQL 数据库实例
3. ⏳ 提供 TTS 账号凭证（如需）
4. ⏳ 补充小程序类目信息

### 二师弟负责：
1. ✅ 编写项目骨架代码
2. ✅ 实现核心页面（首页、Flash 卡片）
3. ⏳ 完成剩余功能页面
4. ⏳ 编写数据库迁移脚本
5. ⏳ 编写云函数代码

### 共同协作：
- 🔲 测试环境连通性
- 🔲 验证数据迁移效果
- 🔲 联调 TTS 接口

---

## 📝 附录

### 1. 完整表结构定义
详见：`/opt/win_hermes/word_memory_miniapp/docs/schema.sql`

### 2. 代码规范
- JavaScript: ESLint (微信规则)
- Python: PEP8 + isort + black
- CSS: BEM 命名 + 变量复用

### 3. 参考链接
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [SM-2 算法详解](https://en.wikipedia.org/wiki/SuperMemo)
- [腾讯云 TTS 接口](https://cloud.tencent.com/document/product/1054/45469)
