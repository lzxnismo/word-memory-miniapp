// app.js - 单词记忆助手（宽松授权版）
App({
  onLaunch() {
    console.log('🚀 单词记忆助手 - 微信小程序启动')
    
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('❌ 微信开发者工具未启用云开发功能，请检查设置 → 详情 → 本地设置 → 启用云开发')
      return
    }
    
    wx.cloud.init({
      env: 'mytx-d7gw0vhq4414988b5',
      traceUser: true
    })
    
    console.log('✅ 云开发环境初始化成功')
    
    // 尝试从缓存恢复 OpenID（优先使用本地缓存）
    const savedOpenId = wx.getStorageSync('wx_openId')
    if (savedOpenId && this.isValidOpenId(savedOpenId)) {
      this.globalData.openId = savedOpenId
      console.log('✅ 从缓存恢复 OpenID:', savedOpenId.substring(0, 8) + '...')
    } else {
      // 缓存失效或未找到，异步获取新 OpenID
      this.getOpenId().then(openId => {
        this.globalData.openId = openId
        wx.setStorageSync('wx_openId', openId)
        console.log('✅ 用户 OpenID:', openId.substring(0, 8) + '...')
      }).catch(err => {
        console.warn('⚠️ 获取 OpenID 失败:', err.message)
        // 不再生成 mock ID，保留空字符串状态
        this.globalData.openId = ''
        console.log('⚠️ OpenID 为空，后续需要提示用户授权')
      })
    }
  },

  // 验证 OpenID 是否有效（至少 20 个字符的 base32 编码）
  isValidOpenId(openId) {
    if (!openId || typeof openId !== 'string') return false
    return openId.length >= 20
  },

  // 通过云托管获取 OpenID
  getOpenId() {
    return new Promise((resolve, reject) => {
      wx.cloud.callContainer({
        path: '/api/v1/user_stats',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { action: 'getOpenId' }
      }).then(res => {
        if (res.statusCode === 200 && res.data && res.data.code === 200 && res.data.openId) {
          resolve(res.data.openId)
        } else {
          reject(new Error('云托管返回错误'))
        }
      }).catch(err => {
        reject(err)
      })
    })
  },

  globalData: {
    userInfo: null,
    currentWordCount: 0,
    streak: 0,
    openId: '',  // 初始为空，成功后会赋值；如果失败则保持空
    needAuth: false  // 是否需要授权标识
  }
})
