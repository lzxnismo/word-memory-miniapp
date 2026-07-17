// pages/settings/settings.js
const app = getApp()

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
    const app = getApp()
    this.setData({ userId: (app.globalData.openId || 'mock_').substring(0, 8) + '...' })
    
    this.loadStats()
    
    // 加载设置
    const sound = wx.getStorageSync('sound_enabled')
    if (sound !== undefined) {
      this.setData({ soundEnabled: sound })
    }
  },

  loadStats() {
    wx.cloud.callContainer({
      path: '/api/v1/user_stats',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { action: 'overview' }
    }).then(res => {
      if (res.statusCode === 200 && res.data && res.data.code === 200 && res.data.data) {
        this.setData({
          statsReady: true,
          totalLearned: res.data.data.total_learned || 0,
          masteredCount: res.data.data.total_mastered || 0,
          accuracy: res.data.data.accuracy || 0
        })
      }
    })
  },

  goToDailyPlan() {
    wx.navigateTo({
      url: '/pages/plan-daily/plan-daily'
    })
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
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          
          const app = getApp()
          const openId = app.globalData.openId || 'mock_'
          
          wx.cloud.callContainer({
            path: '/api/v1/word_query',
            method: 'POST',
            header: { 'content-type': 'application/json' },
            data: { 
              action: 'resetUserData',
              userId: openId
            }
          }).then(res => {
            wx.hideLoading()
            
            if (res.statusCode === 200 && res.data && res.data.code === 200) {
              wx.showToast({ 
                title: '进度已重置', 
                icon: 'success',
                duration: 2000
              })
              
              setTimeout(() => {
                wx.reLaunch({ url: '/pages/index/index' })
              }, 1500)
            } else {
              wx.showToast({ title: res.data.message || '重置失败', icon: 'none' })
            }
          }).catch(err => {
            wx.hideLoading()
            console.error('❌ 重置失败:', err)
            wx.showToast({ title: 'API 错误', icon: 'none' })
          })
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
