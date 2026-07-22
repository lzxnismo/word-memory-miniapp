// app.js - 单词记忆助手（微信云托管版）
// 通过 wx.cloud.callContainer() 走微信内网直达云托管
// 云托管自动注入 x-wx-openid，无需手动登录

App({
  onLaunch() {
    console.log('🚀 单词记忆助手 - 微信小程序启动')

    // 初始化云托管（不需要云开发环境，只需云托管环境名称）
    wx.cloud.init({
      env: ''  // 云托管环境在 callContainer 的 config.env 中指定
    })

    console.log('✅ 云托管初始化完成')
    console.log('✅ OpenID 由云托管网关自动注入，无需手动登录')
  },

  globalData: {
    userInfo: null,
    currentWordCount: 0,
    streak: 0,
    openId: '',  // 云托管自动注入，无需手动设置
    needAuth: false
  }
})