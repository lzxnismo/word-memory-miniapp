// utils/permission.js - 权限检查工具函数
const app = getApp()

/**
 * 检查用户是否已授权（拥有有效的 OpenID）
 */
export function checkAuth() {
  const openId = app.globalData.openId
  
  // 如果已有有效的 OpenID，说明已授权
  if (openId && typeof openId === 'string' && openId.length >= 20) {
    return { authorized: true, openId }
  }
  
  // 未授权状态
  return { authorized: false, openId: '' }
}

/**
 * 需要授权后才能使用的功能提示
 */
export function showAuthRequiredTip() {
  wx.showModal({
    title: '⚠️ 需要授权',
    content: '为了保存您的学习进度和复习记录，请先完成授权\n\n稍后您可以从【设置】中完成授权',
    confirmText: '去授权',
    cancelText: '知道了',
    success(res) {
      if (res.confirm) {
        // 跳转到设置页引导授权
        wx.navigateTo({
          url: '/pages/settings/settings'
        })
      }
    }
  })
}

/**
 * 尝试静默获取 OpenID
 * @param {Function} onSuccess - 获取成功回调
 * @param {Function} onError - 获取失败回调
 */
export function tryGetOpenId(onSuccess, onError) {
  const savedOpenId = wx.getStorageSync('wx_openId')
  
  if (savedOpenId && app.isValidOpenId(savedOpenId)) {
    app.globalData.openId = savedOpenId
    console.log('✅ 从缓存恢复 OpenID:', savedOpenId.substring(0, 8) + '...')
    if (onSuccess) onSuccess(savedOpenId)
    return true
  }
  
  // 缓存失效，尝试重新获取
  if (app.getOpenId) {
    app.getOpenId()
      .then(openId => {
        wx.setStorageSync('wx_openId', openId)
        app.globalData.openId = openId
        console.log('✅ 重新获取 OpenID:', openId.substring(0, 8) + '...')
        if (onSuccess) onSuccess(openId)
        return true
      })
      .catch(err => {
        console.warn('⚠️ 重新获取 OpenID 失败:', err.message)
        if (onError) onError(err)
        return false
      })
    return false
  }
  
  return false
}
