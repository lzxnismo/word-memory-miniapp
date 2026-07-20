// app.js - 单词记忆助手（微信云托管版）
App({
  onLaunch() {
    console.log('🚀 单词记忆助手 - 微信小程序启动')
    
    // ⚠️ 注意：已移除 wx.cloud.init()，不再使用云开发环境
    // 所有 API 调用通过 utils/request.js 直接请求微信云托管后端
    
    console.log('✅ 小程序初始化完成（云托管模式）')
    
    // 尝试从缓存恢复 OpenID
    const savedOpenId = wx.getStorageSync('wx_openId')
    if (savedOpenId && this.isValidOpenId(savedOpenId)) {
      this.globalData.openId = savedOpenId
      console.log('✅ 从缓存恢复 OpenID:', savedOpenId.substring(0, 8) + '...')
    } else {
      // 延迟获取 OpenID（在页面加载时进行）
      this.getOpenId().then(openId => {
        if (openId) {
          this.globalData.openId = openId
          wx.setStorageSync('wx_openId', openId)
          console.log('✅ 用户 OpenID:', openId.substring(0, 8) + '...')
        } else {
          console.warn('⚠️ OpenID 获取失败，部分功能将不可用')
        }
      }).catch(err => {
        console.warn('⚠️ 获取 OpenID 失败:', err.message)
      })
    }
  },

  // 验证 OpenID 是否有效
  isValidOpenId(openId) {
    if (!openId || typeof openId !== 'string') return false
    return openId.length >= 20
  },

  // 通过 HTTP API 获取 OpenID
  getOpenId() {
    // 返回一个 Promise，稍后由 request.js 实现
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'https://express-yoq0-283362-9-1453336058.sh.run.tcloudbase.com/api/v1/user_stats?action=getOpenId',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        timeout: 5000,
        success: (res) => {
          if (res.statusCode === 200 && res.data?.code === 200 && res.data?.openId) {
            resolve(res.data.openId)
          } else {
            resolve('') // 降级为空字符串
          }
        },
        fail: (err) => {
          console.error('❌ 获取 OpenID 失败:', err)
          resolve('')
        }
      })
    })
  },

  globalData: {
    userInfo: null,
    currentWordCount: 0,
    streak: 0,
    openId: '',  // 运行时获取
    needAuth: false  // 是否需要授权标识
  }
})
