// pages/settings/settings.js - 微信云托管版
const requestLib = require('../../utils/request')

Page({
  data: {
    userId: '',
    statsReady: false,
    totalLearned: 0,
    masteredCount: 0,
    accuracy: 0,
    soundEnabled: true
  },

  onLoad() {
    this.setData({ userId: 'user_xxx...' })
    this.loadStats()
    
    const sound = wx.getStorageSync('sound_enabled')
    if (sound !== undefined) {
      this.setData({ soundEnabled: sound })
    }
  },

  async loadStats() {
    try {
      const res = await requestLib.request('/user_stats/overview', { method: 'GET' })
      if (res && res.code === 200 && res.data) {
        this.setData({
          statsReady: true,
          totalLearned: res.data.total_learned_new || 0,
          masteredCount: res.data.total_mastered || 0,
          accuracy: res.data.accuracy || 0
        })
      }
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  },

  goToDailyPlan() {
    wx.navigateTo({ url: '/pages/plan-daily/plan-daily' })
  },

  onSoundChange(e) {
    const enabled = e.detail.value
    this.setData({ soundEnabled: enabled })
    wx.setStorageSync('sound_enabled', enabled)
  },

  resetProgress() {
    wx.showModal({
      title: '确认重置',
      content: '此操作将清空所有学习记录，不可恢复！请慎重考虑。',
      confirmColor: '#ff6b6b',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          
          try {
            const response = await requestLib.request('/user_reset', { method: 'POST' })
            
            wx.hideLoading()
            
            if (response && response.code === 200) {
              wx.showToast({ title: '进度已重置', icon: 'success', duration: 2000 })
              setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 1500)
            } else {
              wx.showToast({ title: response.message || '重置失败', icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            console.error('❌ 重置失败:', err)
            wx.showToast({ title: 'API 错误', icon: 'none' })
          }
        }
      }
    })
  },

  showAbout() {
    wx.showModal({
      title: '关于 Word Memory',
      content: `版本：v1.0.0\n\n基于艾宾浩斯记忆曲线的智能单词记忆系统。\n\n功能特色：\n• 智能复习计划\n• Flash 卡片学习\n• 听写测试模式\n• 数据统计分析\n\n设计者：一帮人马工作室（QQ691481548）`,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  checkUpdate() {
    wx.showToast({ title: '已是最新版本', icon: 'success' })
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '清理本地缓存数据？这不会影响云端同步的学习进度。',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          wx.showToast({ title: '缓存已清除', icon: 'success' })
        }
      }
    })
  },

  feedback() {
    wx.showToast({ title: '反馈功能开发中', icon: 'none' })
  }
})
