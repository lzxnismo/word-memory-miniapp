# SQL 字段映射修复报告

**数据库连接**: `sh-cynosdbmysql-grp-pftyzw6w.sql.tencentcdb.com:24073`  
**数据库名**: `word_memory_db`  
**修复时间**: 2026-07-20  
**作者**: 二师弟 (一帮人马工作室 QQ691481548)

---

## 📊 真实表结构确认

### 1. `settings` 表 (K-V 结构)
```sql
CREATE TABLE settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(50) NOT NULL,
    setting_key VARCHAR(50) NOT NULL,
    setting_value VARCHAR(200) NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```
**字段说明**:
- K-V 模式存储用户设置
- `setting_key`: 'daily_limit', 'new_word_ratio'
- `setting_value`: 对应值的字符串形式

### 2. `categories` 表
```sql
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    owner_openid VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
**注意**: 
- ❌ 无 `description` 字段
- ❌ 无 `word_count` 字段

### 3. `user_word_memories` 表
```sql
CREATE TABLE user_word_memories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(50) NOT NULL,
    user_openid VARCHAR(64),
    word_id INT NOT NULL,
    memory_level INT DEFAULT 0,
    ease_factor FLOAT DEFAULT 2.5,
    interval INT DEFAULT 0,
    repetitions INT DEFAULT 0,
    next_review DATETIME,
    last_review DATETIME,
    total_reviews INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    wrong_count INT DEFAULT 0,
    streak INT DEFAULT 0,
    mastery_score FLOAT DEFAULT 0,
    review_status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```
**✅ 字段完全匹配 SM-2 算法需求**

### 4. `review_histories` 表
```sql
CREATE TABLE review_histories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(50) NOT NULL,
    user_openid VARCHAR(64),
    word_id INT NOT NULL,
    review_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    quality INT NOT NULL,
    response_time_ms INT,
    review_type VARCHAR(20)
);
```

---

## 🔧 修复内容

### 修复 1: `server/routes/user_settings.js`

**问题**: 使用不存在的 `user_settings` 表和错误的列名

**原代码**:
```javascript
SELECT daily_limit, new_word_ratio FROM user_settings WHERE user_id = ?
INSERT INTO user_settings (user_id, daily_limit, new_word_ratio) VALUES (?, ?, ?)
```

**修复后**:
```javascript
// GET - 读取 K-V
SELECT setting_key, setting_value FROM settings WHERE user_id = ?

// 解析
const settingsMap = {}
settingsRows.forEach(row => {
  settingsMap[row.setting_key] = row.setting_value
})
const dailyLimit = parseInt(settingsMap.daily_limit) || 20

// PUT - 写入 K-V
INSERT INTO settings (user_id, setting_key, setting_value) VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE setting_value = ?
```

**影响功能**: ✅ 用户设置保存/加载

---

### 修复 2: `server/routes/category_management.js`

**问题**: 插入语句包含不存在的 `description` 和 `word_count` 字段

**原代码**:
```sql
INSERT INTO categories (name, description, word_count, owner_openid, created_at) 
VALUES (?, ?, 0, NULL, NOW())
```

**修复后**:
```sql
INSERT INTO categories (name, owner_openid, created_at) VALUES (?, NULL, NOW())
```

**影响功能**: ✅ 分类同步

---

### 修复 3: 前端路由路径修正 (Commit 77f14c3)

**文件**:
- `pages/dictation/dictation.js`
- `pages/flash-card/flash-card.js`
- `pages/word-detail/word-detail.js`

**修改**: `/record` → `/record_review/record`

**影响功能**: ✅ 听写、闪卡提交

---

## 🧪 测试验证清单

| 优先级 | 接口 | 方法 | 预期结果 | 当前状态 |
|--------|------|------|---------|---------|
| P0 | `/api/v1/user_settings` | GET | 返回默认设置 {daily_limit: 20} | ⏳ 待部署验证 |
| P0 | `/api/v1/user_settings` | PUT | 保存设置成功 | ⏳ 待部署验证 |
| P0 | `/api/v1/category_manager/sync` | GET | 同步年级分类成功 | ✅ 已测试（但需重新测试） |
| P0 | `/api/v1/record_review/record` | POST | 复习记录保存成功 | ⏳ 待部署验证 |
| P0 | `/api/v1/record_review/memory/:id` | GET | 获取记忆状态 | ✅ 正常 |
| P1 | `/api/v1/stats_advanced/stats` | GET | 高级统计数据 | ⏳ 待测试（CTE 语法） |
| P1 | `/api/v1/user_reset` | POST | 重置用户数据 | ❌ 路由不存在 |

---

## ⚠️ 待解决问题

### 1. CTE 语法兼容性
MySQL 版本可能过低不支持 CTE (Common Table Expressions)

**受影响接口**:
- `GET /api/v1/stats_advanced/stats`
- `GET /api/v1/stats_advanced/achievements`

**解决方案**:
将 `WITH` 子句改写为子查询或临时表

---

### 2. 缺失路由

| 接口 | 原因 | 建议 |
|------|------|------|
| `POST /api/v1/user_reset` | 未实现 | 单独创建 route 文件 |

---

### 3. 部署延迟
当前测试仍返回旧代码错误，说明云托管部署尚未完成。

**建议操作**:
1. 等待 5-10 分钟
2. 检查微信云开发控制台部署日志
3. 如超过 10 分钟仍未完成，手动触发重新部署

---

## 📝 下一步行动

### 立即执行 (阻塞级)
- [ ] 等待云托管部署完成
- [ ] 验证 `GET /user_settings` 是否正常工作
- [ ] 验证 `PUT /user_settings` 是否保存成功

### 高优先级
- [ ] 修复 `stats_advanced.js` 中的 CTE 语法
- [ ] 创建 `user_reset` 路由

### 中优先级
- [ ] 补充导入测试用单词数据
- [ ] 编写单元测试覆盖核心业务逻辑

---

## 🎯 总结

通过**直接连接数据库查询真实表结构**，精准定位到以下问题:

1. ✅ **Settings 表误认**: 以为是固定列结构，实际是 K-V 模式
2. ✅ **Category 表字段误用**: 使用了不存在的 `description` 和 `word_count`
3. ✅ **前端路由路径错误**: `/record` → `/record_review/record`

所有修复已推送至 GitHub，预计 **2-5 分钟** 云托管自动部署完成后即可生效。

---

**生成时间**: 2026-07-20 17:45  
**仓库**: https://github.com/lzxnismo/word-memory-miniapp  
**最新 Commit**: `9cdefbe` - fix: 根据真实表结构修复 SQL 语句
