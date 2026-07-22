// app.js - 单词记忆助手（微信云托管版）
const requestLib = require('./utils/request')

App({
  onLaunch() {
    console.log('🚀 单词记忆助手 - 微信小程序启动')
    
    // ⚠️ 注意：已移除 wx.cloud.init()，不再使用云开发环境
    // 所有 API 调用通过 utils/request.js 直接请求微信云托管后端
    
    console.log('✅ 小程序初始化完成（云托管模式）')
    
    this.login() // 执行登录流程
  },

  async login() {
    const app = this
    
    try {
      // 先尝试从缓存恢复 OpenID
      const savedOpenId = wx.getStorageSync('wx_openId')
      if (savedOpenId && this.isValidOpenId(savedOpenId)) {
        app.globalData.openId = savedOpenId
        console.log('✅ 从缓存恢复 OpenID:', savedOpenId.substring(0, 8) + '...')
        return
      }

      // 调用 wx.login() 获取 code
      const { code } = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })

      if (!code) {
        throw new Error('获取 code 失败')
      }

      // 调用后端 auth/login 换 OpenID
      const res = await requestLib.request('/auth/login', {
        method: 'POST',
        data: { code },
        auth: false // 登录接口不需要认证
      })

      if (res && res.code === 200 && res.data && res.data.openid) {
        app.globalData.openId = res.data.openid
        wx.setStorageSync('wx_openId', res.data.openid)
        console.log('✅ 登录成功:', res.data.openid.substring(0, 8) + '...')
      } else {
        throw new Error(res?.message || '登录失败')
      }
    } catch (err) {
      console.error('❌ 登录失败:', err.message)
      
      // 降级：缓存失效或网络错误时使用模拟 OpenID
      const mockOpenId = 'mock_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
      app.globalData.openId = mockOpenId
      wx.setStorageSync('wx_openId', mockOpenId)
      console.log('⚠️ 降级为模拟 OpenID:', mockOpenId.substring(0, 15) + '...')
    }
  },

  // 验证 OpenID 是否有效（仅内部使用）
  isValidOpenId(openId) {
    if (!openId || typeof openId !== 'string') return false
    return openId.length >= 20
  },

  globalData: {
    userInfo: null,
    currentWordCount: 0,
    streak: 0,
    openId: '',  // 运行时获取
    needAuth: false  // 是否需要授权标识
  }
})
