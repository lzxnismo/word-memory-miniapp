// pages/plan-daily/plan-daily.js - 微信云托管版
const requestLib = require('../../utils/request')

Page({
  data: {
    dailyLimit: 50,
    newWordRatio: '1:3',
    currentLimitIndex: 2,
    currentRatioIndex: 1,
    reviewCount: 0,
    learnedToday: 0,
    dailyProgress: 0,
    remainingNew: 0
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
    try {
      const settingsRes = await requestLib.request('/user_settings', { method: 'GET' })
      
      if (settingsRes && settingsRes.code === 200 && settingsRes.data) {
        const settings = settingsRes.data
        this.setData({
          dailyLimit: Number(settings.dailyLimit) || 50,
          newWordRatio: settings.newWordRatio || '1:3'
        })
        
        const limitIndex = this.limitOptions.indexOf(String(settings.dailyLimit))
        const ratioIndex = this.ratioOptions.findIndex(opt => opt.startsWith(settings.newWordRatio?.split(' ')[0]))
        this.setData({
          currentLimitIndex: limitIndex >= 0 ? limitIndex : 2,
          currentRatioIndex: ratioIndex >= 0 ? ratioIndex : 1
        })
      }
      
      const statsRes = await requestLib.request('/user_stats/overview', { method: 'GET' })
      
      if (statsRes && statsRes.code === 200 && statsRes.data) {
        const stats = statsRes.data
        
        this.setData({
          reviewCount: stats.pending_review || 0,
          learnedToday: stats.total_learned_new || 0
        })
        
        const maxLearned = this.data.dailyLimit
        const remaining = Math.max(0, maxLearned - (stats.total_learned_new || 0))
        const totalProgress = Math.min((stats.total_learned_new || 0) + (stats.pending_review || 0), maxLearned)
        
        this.setData({ 
          remainingNew: remaining,
          dailyProgress: totalProgress
        })
      }
    } catch (err) {
      console.error('❌ 加载数据失败:', err)
    }
  },

  async saveSettings() {
    wx.showLoading({ title: '保存中...' })
    
    try {
      const res = await requestLib.request('/user_settings', {
        method: 'PUT',
        data: {
          dailyLimit: parseInt(this.limitOptions[this.data.currentLimitIndex]),
          newWordRatio: this.ratioOptions[this.data.currentRatioIndex].split(' ')[0]
        }
      })
      
      if (res && res.code === 200) {
        wx.showToast({ title: '保存成功', icon: 'success' })
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' })
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
    wx.navigateTo({ url: '/pages/flash-card/flash-card?mode=review' })
  },

  startLearning() {
    if (this.data.remainingNew <= 0) {
      wx.showToast({ title: '今日新词已学完', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/flash-card/flash-card?mode=new' })
  }
})
