# Word Memory MiniApp - 详细开发计划与实施方案

## 📅 项目时间线总览

| 阶段 | 任务 | 预计工时 | 负责人 | 状态 |
|-----|------|---------|--------|------|
| **Phase 1** | 环境准备与账号注册 | 2 天 | 大师兄 | ⏳ 待开始 |
| **Phase 2** | SQLite → MongoDB 数据迁移 | 1 天 | 二师弟 | ⏸️ 等待 Phase1 |
| **Phase 3** | 基础框架搭建 | 0.5 天 | 二师弟 | ⏸️ 等待 Phase2 |
| **Phase 4** | Flash 卡片模块重构 | 1 天 | 二师弟 | ⏸️ 等待 Phase3 |
| **Phase 5** | 听写模块重构 | 1 天 | 二师弟 | ⏸️ 等待 Phase4 |
| **Phase 6** | 单词本/学习计划模块 | 1 天 | 二师弟 | ⏸️ 等待 Phase5 |
| **Phase 7** | 统计模块改造 | 1 天 | 二师弟 | ⏸️ 等待 Phase6 |
| **Phase 8** | TTS 云函数集成 | 0.5 天 | 二师弟 | ⏸️ 等待 Phase7 |
| **Phase 9** | 真机调试与优化 | 1 天 | 双方协作 | ⏸️ 等待 Phase8 |
| **Phase 10** | 备案与发布审核 | 7-10 天 | 大师兄 | ⏸️ 等待 Phase9 |
| **总计** | | ~15 天 + 备案周期 | | |

---

## 🔧 Phase 1: 环境准备（2 天）

### Day 1: 账号注册

#### 步骤 1.1: 注册微信公众平台
```bash
操作网址：https://mp.weixin.qq.com
```

**具体操作：**
1. 微信扫码登录
2. 选择「小程序」→「立即注册」
3. 主体类型选择「个人」（免费版，只能做工具类应用）
4. 填写基本信息：
   - 小程序名称：`记忆单词助手`（或您喜欢的名称）
   - 服务类目：`教育 > 语言学习`
5. 提交邮箱接收验证码
6. 上传身份证照片（个人主体必需）
7. 等待审核（通常 1-2 个工作日）

**⚠️ 注意事项：**
- 个人主体**无法接入支付功能**
- 名称不能重复，提前想好备选名
- 保留好审核通过短信

#### 步骤 1.2: 获取 AppID 和小程序 ID

审核通过后，在小程序后台查看：
```
登录地址：https://mp.weixin.qq.com
路径：开发 → 开发设置 → 开发者 ID
- AppID (小程序 ID): wxxxxxxxxxxxxxx
- 小程序编号：xxxxxxxx
```

### Day 2: 开通云开发环境

#### 步骤 2.1: 申请云开发权限

在小程序后台操作：
```
路径：开发 → 云开发
点击「开通云开发」
选择免费套餐（个人每月可用额度足够）
```

#### 步骤 2.2: 记录云开发环境变量

开通成功后，记住以下关键信息：
```json
{
  "envId": "cloudxxxxxxx",  // 云开发环境 ID（唯一标识）
  "appId": "wx..."          // 小程序 AppID
}
```

---

## 🔄 Phase 2: 数据迁移脚本开发（1 天）

### 目标文件结构

```bash
/opt/win_hermes/word_memory_miniapp/scripts/
├── migrate_sqlite_to_cloud.py    # 主迁移脚本
├── export_sqlite_data.py         # 导出 SQLite 为 JSON Lines
├── verify_migration.py           # 验证数据完整性
└── requirements.txt              # Python 依赖
```

### 核心迁移逻辑

```python
#!/usr/bin/env python3
"""
SQLite to Cloud Database Migration Script
将现有本地数据库转换为云数据库可导入的 JSON Lines 格式
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path

class DataMigrator:
    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
    
    def export_words(self):
        """导出 words 表"""
        self.cursor.execute("""
            SELECT english, chinese, phonetic, example, tags, created_at 
            FROM words
        """)
        
        data = []
        for row in self.cursor.fetchall():
            record = {
                "english": row[0],
                "chinese": row[1],
                "phonetic": row[2],
                "example": row[3],
                "tags": json.loads(row[4]) if row[4] else [],  # 处理 JSON 字段
                "createdAt": row[5].isoformat() if row[5] else datetime.now().isoformat(),
                "updatedAt": datetime.now().isoformat()
            }
            data.append(record)
        
        # 保存为 JSON Lines 格式（每行一个 JSON 对象）
        with open('words.jsonl', 'w', encoding='utf-8') as f:
            for record in data:
                f.write(json.dumps(record, ensure_ascii=False) + '\n')
        
        print(f"✓ 导出 {len(data)} 个单词")
        return len(data)
    
    def export_user_relations(self):
        """导出用户 - 单词关系表"""
        # ... 类似实现 ...
        pass
    
    def export_all_collections(self):
        """批量导出所有 9 个集合"""
        collections = ['words', 'users', 'user_word_relations', 
                       'word_sets', 'set_word_relations', 
                       'study_plans', 'dictations', 'review_logs']
        
        for collection in collections:
            func_name = f'export_{collection.replace("_", "")}'
            if hasattr(self, func_name):
                getattr(self, func_name)()
    
    def close(self):
        self.conn.close()


if __name__ == '__main__':
    migrator = DataMigrator('/root/.hermes/project/word_memory_system/backend/data/word_memory.db')
    try:
        migrator.export_all_collections()
        print("\n✅ 数据迁移完成！生成的 .jsonl 文件可用于云开发控制台导入")
    finally:
        migrator.close()
```

### 导入到云开发控制台

1. 打开云开发控制台
2. 切换到「数据库」标签
3. 新建集合 `words`
4. 点击右上角「导入」按钮
5. 选择刚才生成的 `words.jsonl`
6. 选择冲突处理模式：`Insert`（插入新记录）
7. 点击「导入」等待完成

---

## 💻 Phase 3-8: 前端重构与云函数开发

### 项目目录结构

```bash
/opt/win_hermes/word_memory_miniapp/
├── cloudfunctions/           # 云函数目录
│   ├── tts-proxy/           # TTS 代理服务
│   │   ├── index.js
│   │   └── package.json
│   └── analytics-helper/    # 高级统计辅助
│       ├── index.js
│       └── package.json
├── pages/                   # 页面目录
│   ├── index/              # 首页
│   ├── flash-card/         # 闪卡学习页
│   ├── dictation/          # 听写测试页
│   ├── words/              # 单词本管理
│   ├── plan/               # 学习计划
│   └── stats/              # 数据统计
├── components/             # 自定义组件
│   ├── study-card/
│   └── review-progress/
├── utils/                  # 工具函数
│   ├── api.js             # API 封装
│   ├── storage.js         # 本地存储缓存
│   └── util.js            # 通用工具
├── app.js                 # 入口文件
├── app.json               # 全局配置
├── app.wxss               # 全局样式
└── project.config.json    # 项目配置
```

### 关键页面实现示例

#### 1️⃣ Flash Card（闪卡学习页）

**WXML 模板：**
```html
<!-- pages/flash-card/index.wxml -->
<view class="container">
  <!-- 进度条 -->
  <view class="progress-bar">
    <text>{{currentIndex}}/{{queue.length}}</text>
    <slider value="{{currentIndex / queue.length * 100}}" show-value />
  </view>
  
  <!-- 卡片区域 -->
  <view class="card-area" bindtap="flipCard">
    <view class="flash-card {{isFlipped ? 'flipped' : ''}}">
      <!-- 正面 -->
      <view class="front">
        <text class="english">{{currentWord.english}}</text>
        <text class="phonetic">{{currentWord.phonetic}}</text>
      </view>
      
      <!-- 背面 -->
      <view class="back">
        <text class="chinese">{{currentWord.chinese}}</text>
        <text class="example">{{currentWord.example}}</text>
      </view>
    </view>
  </view>
  
  <!-- 发音按钮 -->
  <view class="audio-control" hidden="{{!showAudio}}">
    <audio src="{{ttsUrl}}" controls bindplay="playAudio" />
  </view>
  
  <!-- 质量评分按钮 -->
  <view class="rating-buttons">
    <button bindtap="rateWord" data-quality="1" class="btn-rate-1">不认识</button>
    <button bindtap="rateWord" data-quality="2" class="btn-rate-2">模糊</button>
    <button bindtap="rateWord" data-quality="4" class="btn-rate-4">认识</button>
  </view>
</view>
```

**JS 逻辑：**
```javascript
// pages/flash-card/index.js
const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    currentIndex: 0,
    queue: [],
    currentWord: null,
    isFlipped: false,
    showAudio: false,
    ttsUrl: '',
    learningHistory: []
  },

  onLoad(options) {
    const planId = options.planId
    this.loadStudyQueue(planId)
  },

  onShow() {
    // 每次显示时检查是否需要刷新
    if (!this.data.currentWord && this.data.queue.length > 0) {
      this.loadNextWord()
    }
  },

  loadStudyQueue(planId) {
    wx.showLoading({ title: '加载中...' })
    
    db.collection('study_plans').doc(planId).get().then(res => {
      const plan = res.data
      const wordSetId = plan.setName
      
      // 查询该词集中的所有单词及其 SM-2 状态
      db.collection('user_word_relations')
        .where({
          userId: wx.cloud.getWXContext().OPENID,
          setId: wordSetId,
          sm2Phase: _.in([0, 1, 2])  // 只取新词、初学、短期
        })
        .orderBy('nextReviewAt', 'asc')
        .limit(50)
        .get()
        .then(wordRes => {
          const queue = wordRes.data.map(item => ({
            ...item.word,
            sm2Data: item
          }))
          
          this.setData({ queue, currentIndex: 0 }, () => {
            wx.hideLoading()
            this.loadNextWord()
          })
        })
    })
  },

  flipCard() {
    this.setData({ isFlipped: !this.data.isFlipped })
    
    // 翻面后自动播放音频
    if (!this.data.isFlipped) {
      this.playTtsAudio(this.data.currentWord.english)
    }
  },

  playTtsAudio(word) {
    wx.cloud.callFunction({
      name: 'tts-proxy',
      data: { word }
    }).then(res => {
      if (res.result.success) {
        this.setData({ 
          ttsUrl: res.result.audioUrl,
          showAudio: true
        })
      }
    })
  },

  rateWord(e) {
    const quality = Number(e.currentTarget.dataset.quality)
    this.submitAnswer(quality)
  },

  submitAnswer(quality) {
    const userWordId = this.data.currentWord.sm2Data._id
    const currentSM2Data = this.data.currentWord.sm2Data
    
    // 调用 SM-2 算法计算新的状态
    const newSM2Data = this.calculateSM2Adjustment(currentSM2Data, quality)
    
    // 更新数据库
    db.collection('user_word_relations').doc(userWordId).update({
      data: {
        sm2Phase: newSM2Data.phase,
        repetitionCount: newSM2Data.repetitionCount,
        consecutiveSuccesses: newSM2Data.consecutiveSuccesses,
        efFactor: newSM2Data.efFactor,
        interval: newSM2Data.interval,
        nextReviewAt: newSM2Data.nextReviewAt
      }
    }).then(() => {
      // 记录学习日志
      this.recordReviewLog(userWordId, quality, newSM2Data)
      
      // 跳转到下一个单词
      this.loadNextWord()
    })
  },

  loadNextWord() {
    const nextIndex = this.data.currentIndex + 1
    if (nextIndex >= this.data.queue.length) {
      // 本期学习完成
      wx.showToast({
        title: '本期学习完成！',
        icon: 'success'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    
    this.setData({
      currentIndex: nextIndex,
      currentWord: this.data.queue[nextIndex],
      isFlipped: false,
      showAudio: false
    })
  }
})
```

#### 2️⃣ 听写测试页（Dictation）

**WXS 模板片段：**
```html
<!-- pages/dictation/index.wxml -->
<view class="dictation-container">
  <view class="question-area">
    <text class="chinese-question">{{currentWord.chinese}}</text>
    <audio autoplay src="{{ttsUrl}}" />
    <text class="hint">请输入英文：</text>
    
    <input 
      class="answer-input"
      type="text"
      value="{{userInput}}"
      bindinput="onInput"
      bindconfirm="submitAnswer"
      placeholder="输入英文单词"
    />
    
    <button class="btn-submit" bindtap="submitAnswer">提交答案</button>
  </view>
  
  <!-- 答案解析 -->
  <view class="explanation" hidden="{{!showAnswer}}">
    <text class="correct-answer">正确答案：{{currentWord.english}}</text>
    <text class="example-sentence">{{currentWord.example}}</text>
    
    <view class="feedback-buttons">
      <button bindtap="markCorrect" class="btn-correct">我记住了 ✅</button>
      <button bindtap="markWrong" class="btn-wrong">需要复习 ❌</button>
    </view>
  </view>
</view>
```

**JS 逻辑片段：**
```javascript
// pages/dictation/index.js
Page({
  data: {
    dictationPlan: null,
    currentWord: null,
    userInput: '',
    showAnswer: false,
    correctCount: 0,
    totalWords: 0,
    startTime: null
  },

  onLoad() {
    this.initDictationSession()
  },

  initDictationSession() {
    const db = wx.cloud.database()
    const openid = wx.cloud.getWXContext().OPENID
    
    // 获取待听写的薄弱词
    db.collection('user_word_relations')
      .where({
        userId: openid,
        sm2Phase: _.eq(1),  // 初学阶段
        errorRate: _.gt(0.4)  // 错误率>40%
      })
      .orderBy('errorRate', 'desc')
      .limit(20)
      .get()
      .then(res => {
        const weakWords = res.data
        
        // 创建临时听写 session
        this.setData({
          dictationPlan: {
            words: weakWords,
            totalWords: weakWords.length,
            startedAt: new Date()
          },
          currentWord: weakWords[0]
        })
      })
  },

  onInput(e) {
    this.setData({ userInput: e.detail.value })
  },

  submitAnswer() {
    const answer = this.data.userInput.trim().toLowerCase()
    const correct = answer === this.data.currentWord.english.toLowerCase()
    
    this.setData({ 
      showAnswer: true,
      correctness: correct
    })
    
    if (correct) {
      this.data.correctCount++
    }
  },

  markCorrect() {
    // 答对：标记为掌握
    this.processAnswer(true)
  },

  markWrong() {
    // 答错：重新加入复习队列
    this.processAnswer(false)
  },

  processAnswer(isCorrect) {
    const db = wx.cloud.database()
    const userWordId = this.data.currentWord._id
    
    if (!isCorrect) {
      // 答错：重置 SM-2 状态
      db.collection('user_word_relations').doc(userWordId).update({
        data: {
          sm2Phase: 0,  // 返回新词
          consecutiveSuccesses: 0,
          lastReviewedAt: new Date(),
          nextReviewAt: new Date()
        }
      })
    }
    
    // 继续下一题
    this.loadNextQuestion()
  }
})
```

#### 3️⃣ TTS Proxy 云函数（Node.js）

```javascript
// cloudfunctions/tts-proxy/index.js
const cloud = require('wx-server-sdk')
const fetch = require('node-fetch')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { word } = event
  const db = cloud.database()
  
  // 1. 查询是否已有缓存
  const cachedResult = await db.collection('tts_cache')
    .where({ word })
    .get()
  
  if (cachedResult.data.length > 0) {
    const cacheItem = cachedResult.data[0]
    
    // 检查是否过期（30 天）
    const expiresAt = new Date(cacheItem.expiresAt)
    if (new Date() < expiresAt) {
      return {
        success: true,
        audioUrl: cacheItem.audioFileId
      }
    }
  }
  
  // 2. 调用有道 TTS API
  const ttsResponse = await fetch(
    `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=0`
  )
  
  if (!ttsResponse.ok) {
    throw new Error('TTS 请求失败')
  }
  
  // 3. 保存到云存储
  const buffer = Buffer.from(await ttsResponse.arrayBuffer())
  const uploadResult = await cloud.uploadFile({
    cloudPath: `tts/${word}.mp3`,
    fileContent: buffer
  })
  
  // 4. 记录缓存
  await db.collection('tts_cache').add({
    data: {
      word,
      audioFileId: uploadResult.fileID,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 天
    }
  })
  
  return {
    success: true,
    audioUrl: uploadResult.fileID
  }
}
```

---

## 🎨 样式优化建议

### 全局样式（app.wxss）

```css
/* 响应式单位 rpx */
.container {
  padding: 40rpx;
  background-color: #f5f5f5;
}

/* 卡片阴影效果 */
.flash-card {
  background: white;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

/* 按钮渐变 */
.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50rpx;
}
```

---

## 🧪 测试与验证

### 单元测试清单

1. **Flash Card**: 翻转、音频播放、评分功能
2. **Dictation**: 答案验证、听写计时
3. **SM-2 Algorithm**: 间隔计算正确性
4. **Cloud DB**: 读写权限、事务一致性
5. **TTS Proxy**: 缓存命中率、API 响应

### 真机调试要点

- 使用「预览」功能生成二维码
- 扫码至手机真实环境测试
- 重点测试弱网场景下的性能
- 验证离线缓存功能

---

## 📊 性能优化方案

### 1. 减少云数据库查询次数

- 合并多表查询为一次 `$lookup`
- 使用聚合管道（Aggregation Pipeline）优化复杂统计

### 2. 缓存策略

```javascript
// 单词列表缓存在本地 Storage
wx.setStorage({
  key: 'word_list_cache',
  data: wordList,
  expire: 3600000  // 1 小时
})
```

### 3. 图片/音频懒加载

- 优先加载首屏内容
- 滚动到视口时才加载远处资源

---

## 📝 备案流程说明（必做！）

### 备案时间表：7-10 个工作日

**Day 1**: 提交备案申请  
**Day 2-5**: 腾讯人工审核（电话核实）  
**Day 6-8**: 管局审批  
**Day 9-10**: 备案成功通知  

**材料准备清单：**
- [ ] 身份证正反面照片
- [ ] 实名认证手机号
- [ ] 小程序名称（需与个人身份一致）
- [ ] 服务描述（100 字以内）

---

## ✅ 验收标准

- [ ] 所有功能在微信开发者工具运行正常
- [ ] 真机扫码测试通过
- [ ] 数据迁移完整性和准确性验证通过
- [ ] SM-2 算法计算结果正确
- [ ] TTS 音频播放流畅
- [ ] 统计图表展示清晰
- [ ] 备案审核通过并正式发布

---

## 💡 经验总结与后续迭代

### Phase 1-5 完成后的经验沉淀

1. **数据迁移教训**：JSON Lines 格式比 CSV 更易处理嵌套数据
2. **云开发坑点**：安全规则配置必须严格（`.openid` 字段名）
3. **前端适配**：rpx 单位在不同机型上的实际像素差异
4. **TTS 缓存策略**：首次调用的延迟问题可通过预加载缓解

### 后续迭代方向

- 支持多个用户账号切换
- 添加每日签到打卡功能
- 引入 AI 语音评测（腾讯云 ASR）
- 社区分享功能（排行榜、学习心得）

---

**设计者**: 一帮人马工作室（QQ691481548）  
**版本**: 1.0.0  
**最后更新**: 2026-07-13
