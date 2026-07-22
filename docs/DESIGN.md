# 🎨 设计文档

> **项目**: Word Memory — 微信小程序版单词记忆系统  
> **工作室**: 一帮人马工作室（QQ691481548）  
> **最后更新**: 2026-07-22

---

## 1. SM-2 间隔重复算法

### 1.1 算法公式

SM-2 算法基于每次复习的质量评分（0-5）调整记忆参数：

```
质量评分标准:
0 = 完全忘记，没有任何印象
1 = 看到后感觉陌生，但能回忆部分
2 = 看到后感觉熟悉，但回答错误
3 = 勉强答对，但需要较多思考
4 = 答对，但有些犹豫
5 = 答对，完全正确，无需思考

质量 < 3（答错）:
  - repetitions = 0
  - interval = 1（明天重学）
  
质量 >= 3（答对）:
  - repetitions += 1
  - 计算间隔:
    * repetitions = 1: interval = 1
    * repetitions = 2: interval = 6
    * repetitions >= 3: interval = round(interval * ease_factor)
  - 更新易度因子:
    * ease_factor = max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
```

### 1.2 掌握度计算

```
mastery_score = min(100, (total_reviews * 20 + correct_rate * 0.5 + memory_level * 10))
```

### 1.3 复习队列查询

```sql
SELECT uwm.word_id, w.word, w.phonetic, w.meaning,
       uwm.next_review, uwm.memory_level, uwm.total_reviews, uwm.mastery_score
FROM user_word_memories uwm
JOIN words w ON uwm.word_id = w.id
WHERE uwm.user_id = ? 
  AND uwm.review_status = 'active'
  AND uwm.next_review <= NOW()
ORDER BY uwm.next_review ASC
LIMIT ?
```

## 2. 学习模式设计

### 2.1 闪卡学习 (Flash Card)

```
流程:
1. 显示单词 + 音标
2. 用户思考 → 点击"显示答案"
3. 显示释义 + 例句
4. 用户自评质量 (0-5)
5. SM-2 更新记忆状态
6. 下一张卡片
```

### 2.2 听写模式 (Dictation)

```
流程:
1. 播放单词音频（或显示拼写提示）
2. 用户输入拼写
3. 对比正确答案
4. 如果正确 → SM-2 质量 ≥ 4
5. 如果错误 → SM-2 质量 = 0，显示正确答案
6. 下一题
```

### 2.3 单词集学习

```
流程:
1. 进入单词集详情
2. 点击"开始学习"
3. 加载该单词集的所有单词
4. 以闪卡模式逐个学习
5. 学习进度记录到 user_word_memories
```

## 3. 每日学习计划

```
设计原则:
- 新词: 复习词 = 1:3 比例（默认）
- 复习队列: 从 user_word_memories 中 next_review <= NOW() 的单词
- 计划上限: 由 settings 表中的 daily_limit 控制
- 进度追踪: daily_plans 表记录每日完成情况
```

## 4. 统计设计

### 4.1 首页统计

| 指标 | 数据来源 | 计算方式 |
|------|----------|----------|
| 总复习次数 | review_histories | COUNT(*) |
| 已学单词数 | user_word_memories | COUNT(DISTINCT word_id) |
| 已掌握单词数 | user_word_memories | COUNT WHERE mastery_score >= 80 |
| 正确率 | review_histories | COUNT(quality >= 4) / COUNT(*) |
| 待复习数 | user_word_memories | COUNT WHERE next_review <= NOW() AND status = 'active' |

### 4.2 学习日历

```sql
SELECT DATE(review_time) as date, COUNT(*) as review_count,
       SUM(CASE WHEN quality >= 4 THEN 1 ELSE 0 END) as correct_count,
       AVG(quality) as avg_quality
FROM review_histories
WHERE user_id = ? AND review_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
GROUP BY DATE(review_time) ORDER BY date ASC
```

## 5. 认证设计

### 5.1 微信云托管自动认证

```
前端 → wx.cloud.callContainer() → 微信内网 → 云托管网关
                                                    ↓
   云托管网关自动校验用户身份，注入 x-wx-openid 头
                                                    ↓
   后端 authMiddleware 读取 req.headers['x-wx-openid']
                                                    ↓
   注入 req.openid，后续查询以此隔离数据
```

**无需手动 `wx.login()`**，无需 `jscode2session`。

### 5.2 兼容性设计

`routes/auth.js` 保留 `POST /auth/login` 接口（支持 `wx.request()` 公网调用场景），但 `callContainer` 模式下不会被调用。

## 6. 前端组件设计

### 6.1 统一请求封装 utils/request.js

```
request(url, options)
  ├── method: GET/POST/PUT/DELETE（默认 POST）
  ├── data: 请求参数
  └── auth: 是否需要认证（默认 true）

返回: response.data（直接返回后端 JSON 的 data 字段）
```

### 6.2 错误处理链

```
wx.cloud.callContainer fail → 网络层错误提示
  ↓
response.statusCode 404 → 接口不存在
  ↓
response.statusCode 401 → 未授权
  ↓
response.statusCode >= 500 → 服务器繁忙
  ↓
response.data.code !== 200 → 业务错误
  ↓
默认 → 返回 response.data
```

---

> **更新**: 2026-07-22 | **维护者**: 一帮人马工作室（QQ691481548）