// pages/plan-daily/plan-daily.js
Page({
  data: {
    dailyLimit: 50,       // 每日学习上限
    newWordRatio: '1:3',   // 新词与复习比例
    currentLimitIndex: 2,  // 默认 50
    currentRatioIndex: 1,
    
    // 今日进度
    reviewCount: 0,      // 待复习数
    learnedToday: 0,     // 今日已学新词
    dailyProgress: 0,    // 今日总进度（复习 + 新学）
    remainingNew: 0,     // 剩余可学新词
    
    // 任务列表
    completedTasks: [],
    activeTasks: []
  },

  limitOptions: ['10', '30', '50', '100'],
  ratioOptions: ['1:1 (大量新词)', '1:3 (推荐)', '1:5 (复习为主)'],

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    const app = getApp()
    const openId = app.globalData.openId || 'mock_'
    
    try {
      // 加载用户设置
      const settingsRes = await wx.cloud.callContainer({
        path: '/api/v1/word_query',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { 
          action: 'getUserSettings',
          userId: openId
        }
      })
      
      if (settingsRes.statusCode === 200 && settingsRes.data && settingsRes.data.code === 200 && settingsRes.data.settings) {
        const settings = settingsRes.data.settings
        this.setData({
          dailyLimit: Number(settings.dailyLimit) || 50,
          newWordRatio: settings.newWordRatio || '1:3'
        })
        
        // 计算当前选中索引
        const limitIndex = this.limitOptions.indexOf(String(settings.dailyLimit))
        const ratioIndex = this.ratioOptions.indexOf(settings.newWordRatio)
        this.setData({
          currentLimitIndex: limitIndex >= 0 ? limitIndex : 2,
          currentRatioIndex: ratioIndex >= 0 ? ratioIndex : 1
        })
      }
      
      // 加载统计数据
      const statsRes = await wx.cloud.callContainer({
        path: '/api/v1/user_stats',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { action: 'overview' }
      })
      
      if (statsRes.statusCode === 200 && statsRes.data && statsRes.data.code === 200) {
        const stats = statsRes.data.data
        
        this.setData({
          reviewCount: stats.pending_review || 0,
          learnedToday: stats.total_learned || 0,
          dailyProgress: Math.min(stats.total_learned + (stats.pending_review || 0), this.data.dailyLimit)
        })
        
        // 计算剩余可学新词
        const maxLearned = this.data.dailyLimit
        const remaining = Math.max(0, maxLearned - stats.total_learned)
        this.setData({ 
          remainingNew: remaining,
          dailyProgress: Math.min(stats.total_learned + (stats.pending_review || 0), maxLearned)
        })
      }
    } catch (err) {
      console.error('❌ 加载数据失败:', err)
    }
  },

  async saveSettings() {
    wx.showLoading({ title: '保存中...' })
    
    try {
      const app = getApp()
      const openId = app.globalData.openId || 'mock_'
      
      const data = {
        action: 'saveSettings',
        userId: openId,
        dailyLimit: this.limitOptions[this.data.currentLimitIndex],
        newWordRatio: this.ratioOptions[this.data.currentRatioIndex].split(' ')[0]
      }
      
      const res = await wx.cloud.callContainer({
        path: '/api/v1/word_query',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data
      })
      
      if (res.statusCode === 200 && res.data && (res.data.code === 200 || res.data.code === 201)) {
        wx.showToast({ title: '保存成功', icon: 'success' })
      } else {
        wx.showToast({ title: res.data.message || '保存失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onLimitChange(e) {
    this.setData({ currentLimitIndex: e.detail.value })
  },

  onRatioChange(e) {
    this.setData({ currentRatioIndex: e.detail.value })
  },

  startReview() {
    if (this.data.reviewCount <= 0) {
      wx.showToast({ title: '暂无待复习单词', icon: 'none' })
      return
    }
    
    wx.navigateTo({
      url: '/pages/flash-card/flash-card?mode=review'
    })
  },

  startLearning() {
    if (this.data.remainingNew <= 0) {
      wx.showToast({ title: '今日新词已学完', icon: 'none' })
      return
    }
    
    wx.navigateTo({
      url: '/pages/flash-card/flash-card?mode=new'
    })
  }
})
