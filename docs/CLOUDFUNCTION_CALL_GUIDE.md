# 微信小程序云函数调用指南

## 📖 使用说明书

**作者**: 一帮人马工作室 (QQ691481548)  
**版本**: v2.0 - MySQL 直连模式  
**最后更新**: 2026-07-14

---

## 🎯 概述

本文档说明如何在小程序前端代码中调用新增的 5 个 MySQL 直连云函数。适用于所有页面的 JavaScript 文件。

---

## 📦 云函数列表

| 云函数名 | 功能 | 调用方式 |
|:---|:---|:---|
| **word_sets** | 单词集 CRUD + 进度统计 | `wx.cloud.callFunction({ name: 'word_sets' })` |
| **category_manager** | 分类管理 | `wx.cloud.callFunction({ name: 'category_manager' })` |
| **goal_manager** | 学习目标管理 | `wx.cloud.callFunction({ name: 'goal_manager' })` |
| **stats_advanced** | 数据统计 + 成就 | `wx.cloud.callFunction({ name: 'stats_advanced' })` |
| **word_lookup** | 查词 + 年级筛选 | `wx.cloud.callFunction({ name: 'word_lookup' })` |

---

## 🔧 word_sets 单词集管理

### **1. 创建单词集**

```javascript
// pages/word-set-create/word-set-create.js
const app = getApp()

Page({
  data: {
    setName: '',
    description: '',
    color: '#667eea' // 默认紫色
  },
  
  async createSet() {
    const { setName, description, color } = this.data
    
    if (!setName.trim()) {
      wx.showToast({ title: '请输入单词集名称', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '创建中...' })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'word_sets',
        data: {
          action: 'create',
          name: setName.trim(),
          description: description.trim(),
          color: color
        }
      })
      
      if (res.result && res.result.code === 200) {
        const setId = res.result.data.set_id
        
        wx.showToast({ title: '创建成功', icon: 'success' })
        
        // 返回单词集列表页
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/word-set-list/word-set-list?selectId=${setId}` })
        }, 1500)
      } else {
        throw new Error(res.result.message || '创建失败')
      }
    } catch (err) {
      console.error('创建单词集失败:', err)
      wx.showToast({ title: err.message, icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },
  
  onColorChange(e) {
    this.setData({ color: e.detail.value })
  }
})
```

---

### **2. 获取单词集列表**

```javascript
// pages/word-set-list/word-set-list.js
const app = getApp()

Page({
  data: {
    wordSets: [],
    loading: true
  },
  
  onLoad() {
    this.loadWordSets()
  },
  
  async loadWordSets() {
    this.setData({ loading: true })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'word_sets',
        data: {
          action: 'list'
        }
      })
      
      if (res.result && res.result.code === 200) {
        this.setData({
          wordSets: res.result.data.word_sets || [],
          total: res.result.data.total || 0
        })
      } else {
        throw new Error(res.result.message || '加载失败')
      }
    } catch (err) {
      console.error('加载单词集失败:', err)
      wx.showToast({ title: err.message, icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
  
  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/word-set-detail/word-set-detail?id=${id}` })
  }
})
```

---

### **3. 获取单词集详情（含单词列表）**

```javascript
// pages/word-set-detail/word-set-detail.js
Page({
  data: {
    setInfo: null,
    words: [],
    totalCount: 0,
    currentPage: 1,
    pageSize: 20
  },
  
  async loadDetail() {
    const { id } = this.options
    const { currentPage, pageSize } = this.data
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'word_sets',
        data: {
          action: 'getDetail',
          set_id: parseInt(id),
          page: currentPage,
          page_size: pageSize
        }
      })
      
      if (res.result && res.result.code === 200) {
        this.setData({
          setInfo: res.result.data.set_info,
          words: res.result.data.words || [],
          totalCount: res.result.data.total_count || 0
        })
      }
    } catch (err) {
      console.error('加载详情失败:', err)
      wx.showToast({ title: err.message, icon: 'none' })
    }
  },
  
  onReachBottom() {
    const { currentPage, words, totalCount } = this.data
    if (words.length < totalCount) {
      this.setData({ currentPage: currentPage + 1 })
      setTimeout(() => this.loadDetail(), 300)
    }
  }
})
```

---

### **4. 添加单词到集合**

```javascript
// pages/word-set-detail/word-set-detail.js
Page({
  async addWords() {
    const { id } = this.options
    
    wx.showActionSheet({
      itemList: ['按年级添加', '搜索单词'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          await this.addByGrade(id)
        } else if (res.tapIndex === 1) {
          await this.searchAndAdd(id)
        }
      }
    })
  },
  
  async addByGrade(setId) {
    const grades = ['七年级', '八年级', '九年级']
    
    wx.showActionSheet({
      itemList: grades
    }).then(async (res) => {
      const gradeText = grades[res.tapIndex]
      
      wx.showLoading({ title: '加载中...' })
      
      try {
        const res = await wx.cloud.callFunction({
          name: 'word_lookup',
          data: {
            action: 'getByGrade',
            grade: gradeText
          }
        })
        
        if (res.result && res.result.code === 200) {
          const words = res.result.data
          
          // 弹出多选框（简化示例，实际需要实现多选逻辑）
          wx.showModal({
            title: `确认添加`,
            content: `将 ${gradeText} 共 ${words.length} 个单词添加到当前集合？`,
            success: async (confirmRes) => {
              if (confirmRes.confirm) {
                await this.batchAddWords(setId, words.map(w => w.id))
              }
            }
          })
        }
      } catch (err) {
        wx.showToast({ title: err.message, icon: 'none' })
      } finally {
        wx.hideLoading()
      }
    })
  },
  
  async batchAddWords(setId, wordIds) {
    wx.showLoading({ title: '添加中...' })
    
    try {
      for (const wordId of wordIds) {
        await wx.cloud.callFunction({
          name: 'word_sets',
          data: {
            action: 'addWord',
            set_id: setId,
            word_id: wordId
          }
        })
      }
      
      wx.showToast({ title: '添加成功', icon: 'success' })
      this.loadDetail() // 刷新列表
    } catch (err) {
      wx.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
```

---

### **5. 删除单词集**

```javascript
// pages/word-set-list/word-set-list.js
async deleteSet(e) {
  const id = e.currentTarget.dataset.id
  
  wx.showModal({
    title: '确认删除',
    content: '确定要删除这个单词集吗？',
    confirmColor: '#ff6b6b',
    success: async (res) => {
      if (res.confirm) {
        wx.showLoading({ title: '删除中...' })
        
        try {
          const res = await wx.cloud.callFunction({
            name: 'word_sets',
            data: {
              action: 'delete',
              set_id: id
            }
          })
          
          if (res.result && res.result.code === 200) {
            wx.showToast({ title: '删除成功', icon: 'success' })
            this.loadWordSets() // 刷新列表
          } else {
            throw new Error(res.result.message || '删除失败')
          }
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    }
  })
}
```

---

## 🏷️ category_manager 分类管理

### **1. 获取分类列表**

```javascript
// utils/category-helper.js
/**
 * 获取所有分类（包含系统分类和自定义分类）
 */
export async function getCategoryList() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'category_manager',
      data: {
        action: 'list'
      }
    })
    
    if (res.result && res.result.code === 200) {
      return res.result.data.categories || []
    }
    return []
  } catch (err) {
    console.error('获取分类失败:', err)
    throw err
  }
}
```

---

### **2. 创建新分类**

```javascript
// pages/category-edit/category-edit.js
async createCategory() {
  const { categoryName } = this.data
  
  if (!categoryName.trim()) {
    wx.showToast({ title: '请输入分类名称', icon: 'none' })
    return
  }
  
  wx.showLoading({ title: '创建中...' })
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'category_manager',
      data: {
        action: 'create',
        name: categoryName.trim()
      }
    })
    
    if (res.result && res.result.code === 200) {
      wx.showToast({ title: '创建成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } else {
      throw new Error(res.result.message || '创建失败')
    }
  } catch (err) {
    wx.showToast({ title: err.message, icon: 'none' })
  } finally {
    wx.hideLoading()
  }
}
```

---

### **3. 重命名分类**

```javascript
async renameCategory(categoryId, newName) {
  wx.showLoading({ title: '保存中...' })
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'category_manager',
      data: {
        action: 'rename',
        category_id: categoryId,
        new_name: newName.trim()
      }
    })
    
    if (res.result && res.result.code === 200) {
      wx.showToast({ title: '保存成功', icon: 'success' })
      return true
    } else {
      throw new Error(res.result.message || '保存失败')
    }
  } catch (err) {
    wx.showToast({ title: err.message, icon: 'none' })
    return false
  } finally {
    wx.hideLoading()
  }
}
```

---

## 🎯 goal_manager 学习目标管理

### **1. 创建每日目标**

```javascript
// pages/goal-setting/goal-setting.js
async createDailyGoal() {
  const { dailyTarget } = this.data
  
  if (!dailyTarget || dailyTarget < 1) {
    wx.showToast({ title: '请输入有效的学习目标', icon: 'none' })
    return
  }
  
  wx.showLoading({ title: '保存中...' })
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'goal_manager',
      data: {
        action: 'create',
        goal_type: 'daily',
        target_count: dailyTarget
      }
    })
    
    if (res.result && res.result.code === 200) {
      wx.showToast({ title: '目标已设置', icon: 'success' })
      this.loadProgress()
    }
  } catch (err) {
    wx.showToast({ title: err.message, icon: 'none' })
  } finally {
    wx.hideLoading()
  }
}
```

---

### **2. 获取学习进度**

```javascript
async loadProgress() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'goal_manager',
      data: {
        action: 'getProgress'
      }
    })
    
    if (res.result && res.result.code === 200) {
      const progress = res.result.data
      
      this.setData({
        currentCount: progress.current_count || 0,
        targetCount: progress.target_count || 0,
        percentage: Math.round((progress.current_count / progress.target_count) * 100),
        remainingCount: progress.target_count - progress.current_count
      })
    }
  } catch (err) {
    console.error('加载进度失败:', err)
  }
}
```

---

## 📊 stats_advanced 数据统计与成就

### **1. 获取综合统计数据**

```javascript
// pages/statistics/statistics.js
async loadStats() {
  wx.showLoading({ title: '加载中...' })
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'stats_advanced',
      data: {
        action: 'getStats'
      }
    })
    
    if (res.result && res.result.code === 200) {
      const { word_bank, today, streak } = res.result.data
      
      this.setData({
        wordBankTotal: word_bank.total,
        wordBankLearned: word_bank.learned,
        wordBankMastered: word_bank.mastered,
        todayReviewed: today.reviewed,
        todayCorrectRate: today.correct_rate,
        streakDays: streak
      })
    }
  } catch (err) {
    wx.showToast({ title: err.message, icon: 'none' })
  } finally {
    wx.hideLoading()
  }
}
```

---

### **2. 获取学习趋势图数据**

```javascript
async loadTrends(days = 30) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'stats_advanced',
      data: {
        action: 'getTrends',
        days: days
      }
    })
    
    if (res.result && res.result.code === 200) {
      const trends = res.result.data
      
      // 准备 ECharts 数据格式
      this.setData({
        chartDates: trends.map(t => t.date),
        chartWords: trends.map(t => t.words_learned),
        chartAccuracy: trends.map(t => t.accuracy)
      })
      
      // 渲染图表
      this.initCharts()
    }
  } catch (err) {
    console.error('加载趋势失败:', err)
  }
}

initCharts() {
  const query = wx.createSelectorQuery()
  query.select('#learning-trend-chart')
    .boundingClientRect(rect => {
      const charts = echarts.init(rect)
      charts.setOption({
        xAxis: { type: 'category', data: this.data.chartDates },
        yAxis: { type: 'value' },
        series: [{ 
          data: this.data.chartWords,
          type: 'line',
          smooth: true
        }]
      })
    }).exec()
}
```

---

### **3. 获取成就徽章**

```javascript
async loadAchievements() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'stats_advanced',
      data: {
        action: 'getAchievements'
      }
    })
    
    if (res.result && res.result.code === 200) {
      this.setData({
        achievements: res.result.data.list,
        earnedCount: res.result.data.earned,
        progressPercent: res.result.data.progress_percent
      })
    }
  } catch (err) {
    console.error('加载成就失败:', err)
  }
}
```

---

## 🔍 word_lookup 查词功能

### **1. 精确查询单词**

```javascript
// pages/search/search.js
async searchWord(keyword) {
  if (!keyword.trim()) {
    wx.showToast({ title: '请输入要查询的单词', icon: 'none' })
    return
  }
  
  wx.showLoading({ title: '查询中...' })
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'word_lookup',
      data: {
        action: 'lookup',
        word: keyword.trim()
      }
    })
    
    if (res.result && res.result.code === 200) {
      const { exact_match, fuzzy_matches } = res.result.data
      
      if (exact_match) {
        // 精确匹配，直接显示详情
        wx.navigateTo({
          url: `/pages/word-detail/word-detail?id=${exact_match.id}`
        })
      } else if (fuzzy_matches && fuzzy_matches.length > 0) {
        // 模糊匹配，显示结果列表
        this.setData({
          searchResults: fuzzy_matches,
          hasExactMatch: false
        })
      } else {
        wx.showToast({ title: '未找到该单词', icon: 'none' })
      }
    }
  } catch (err) {
    wx.showToast({ title: err.message, icon: 'none' })
  } finally {
    wx.hideLoading()
  }
}
```

---

### **2. 获取单词详情（含同年级关联词）**

```javascript
// pages/word-detail/word-detail.js
async loadWordDetail() {
  const { word_id } = this.options
  
  wx.showLoading({ title: '加载中...' })
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'word_lookup',
      data: {
        action: 'getOnlineDetail',
        word_id: parseInt(word_id)
      }
    })
    
    if (res.result && res.result.code === 200) {
      const { word, user_progress, related_words } = res.result.data
      
      this.setData({
        word: word,
        userProgress: user_progress,
        relatedWords: related_words,
        masteryScore: user_progress ? Math.round(user_progress.mastery_score) : 0
      })
    }
  } catch (err) {
    wx.showToast({ title: err.message, icon: 'none' })
  } finally {
    wx.hideLoading()
  }
}
```

---

## 🛡️ 错误处理通用模板

### **统一错误提示组件**

```javascript
// utils/api-helpers.js
/**
 * 统一的云函数调用封装，带错误处理
 */
export async function callCloudFunction(name, data) {
  try {
    wx.showLoading({ title: '加载中...', mask: true })
    
    const res = await wx.cloud.callFunction({ name, data })
    
    wx.hideLoading()
    
    if (res.result && res.result.code === 200) {
      return res.result.data
    } else {
      throw new Error(res.result.message || '请求失败')
    }
  } catch (err) {
    wx.hideLoading()
    
    // 网络错误或超时
    if (err.errMsg && errMsg.includes(':fail')) {
      wx.showToast({
        title: '网络错误，请检查连接',
        icon: 'none',
        duration: 2000
      })
    } else {
      wx.showToast({
        title: err.message,
        icon: 'none'
      })
    }
    
    throw err
  }
}

// 使用示例
try {
  const data = await callCloudFunction('word_sets', {
    action: 'list'
  })
  // 处理返回数据
} catch (err) {
  // 错误已在函数内部处理
}
```

---

## 📱 页面示例代码结构

### **推荐的项目目录结构**

```
/opt/win_hermes/word_memory_miniapp/
├── pages/
│   ├── word-set-list/         # 单词集列表
│   │   ├── word-set-list.js
│   │   ├── word-set-list.wxml
│   │   └── word-set-list.wxss
│   ├── word-set-detail/       # 单词集详情
│   ├── word-set-create/       # 创建单词集
│   ├── statistics/            # 统计页面（整合 stats_advanced）
│   ├── goal-setting/          # 目标设置
│   ├── achievements/          # 成就徽章页面
│   ├── search/                # 查词页面
│   └── word-detail/           # 单词详情
├── components/
│   └── achievement-card/      # 成卡片组件
├── utils/
│   ├── api-helpers.js         # API 调用封装
│   ├── category-helper.js     # 分类工具
│   └── stats-helper.js        # 统计数据处理
└── cloudfunctions/
    ├── word_sets/
    ├── category_manager/
    ├── goal_manager/
    ├── stats_advanced/
    └── word_lookup/
```

---

## ⚠️ 注意事项

### **1. 异步操作建议**

- ✅ 所有云函数调用必须使用 `await`
- ✅ 配合 `wx.showLoading()` 显示加载状态
- ✅ 捕获异常并给用户友好提示

### **2. 用户体验优化**

- 批量操作时分页加载（每批 20-50 条）
- 列表页支持下拉刷新和上拉加载更多
- 长列表使用虚拟滚动或分页渲染

### **3. 性能优化**

- 避免频繁调用云函数（如实时轮询）
- 合理使用本地缓存（`wx.setStorage`）
- 大数据列表使用 `wx.createIntersectionObserver` 懒加载

---

## 📝 更新日志

| 版本 | 日期 | 更新内容 |
|:---|:---|:---|
| v2.0 | 2026-07-14 | 全面升级为 MySQL 直连模式 |
| v1.0 | 2026-06-01 | 初始版本（Web API 代理模式） |

---

**作者**: 一帮人马工作室 (QQ691481548)
