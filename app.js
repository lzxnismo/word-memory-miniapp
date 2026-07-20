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
      // 开发环境：使用测试 OpenID（避免 401）
      const testOpenId = 'test_openid_mock_' + Date.now()
      this.globalData.openId = testOpenId
      wx.setStorageSync('wx_openId', testOpenId)
      console.log('✅ 使用测试 OpenID:', testOpenId.substring(0, 8) + '...')
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
