// pages/test-auth/test-auth.js
import { checkAuth, tryGetOpenId } from '../../utils/permission.js'

Page({
  data: {
    needAuth: true,
    openId: '',
    testing: false
  },

  onLoad() {
    this.checkStatus()
  },

  onShow() {
    // 每次显示时刷新状态
    setTimeout(() => this.checkStatus(), 500)
  },

  checkStatus() {
    const auth = checkAuth()
    if (auth.authorized) {
      this.setData({ 
        needAuth: false,
        openId: auth.openId.substring(0, 16) + '...'
      })
    } else {
      this.setData({ 
        needAuth: true,
        openId: ''
      })
    }
  },

  // 测试闪卡学习
  testFlashCard() {
    if (this.data.testing) return
    
    wx.navigateTo({
      url: '/pages/flash-card/flash-card?mode=new'
    })
  },

  // 测试听写测试
  testDictation() {
    if (this.data.testing) return
    
    wx.navigateTo({
      url: '/pages/dictation/dictation'
    })
  },

  // 测试每日计划
  testPlan() {
    if (this.data.testing) return
    
    wx.navigateTo({
      url: '/pages/plan-daily/plan-daily'
    })
  },

  // 测试单词本（无需授权）
  testWordsList() {
    wx.navigateTo({
      url: '/pages/words-list/words-list'
    })
  },

  // 强制授权
  forceAuthorize() {
    if (this.data.testing) return
    this.setData({ testing: true })
    
    wx.showLoading({ title: '获取 OpenID...' })
    
    const app = getApp()
    if (app.getOpenId) {
      app.getOpenId()
        .then(openId => {
          wx.setStorageSync('wx_openId', openId)
          app.globalData.openId = openId
          
          wx.hideLoading()
          wx.showToast({
            title: '✅ 授权成功！',
            icon: 'success'
          })
          
          // 延迟后跳转回首页，体验完整功能
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/index/index'
            })
          }, 1500)
        })
        .catch(err => {
          wx.hideLoading()
          wx.showToast({
            title: '❌ 授权失败：' + err.message,
            icon: 'none'
          })
          this.setData({ testing: false })
        })
    } else {
      wx.hideLoading()
      this.setData({ testing: false })
    }
  },

  // 重置授权（清除缓存）
  resetAuth() {
    wx.showModal({
      title: '确认重置？',
      content: '这将清除本地缓存的 OpenID，重新模拟未授权状态\n\n注意：不会删除云开发数据库中的数据',
      success(res) {
        if (res.confirm) {
          wx.removeStorageSync('wx_openId')
          const app = getApp()
          app.globalData.openId = ''
          
          wx.showToast({
            title: '✅ 已重置为未授权状态',
            icon: 'success'
          })
          
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/test-auth/test-auth'
            })
          }, 1500)
        }
      }
    })
  }
})
