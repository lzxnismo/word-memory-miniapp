/**
 * utils/request.js — 统一 HTTP 请求封装
 * 
 * 替换 wx.cloud.callContainer，直接使用 wx.request
 * 微信云托管 REST API 专用
 * 
 * © 一帮人马工作室（QQ691481548）
 */

const BASE_URL = 'https://express-yoq0-283362-9-1453336058.sh.run.tcloudbase.com/api/v1'

// 全局配置
const CONFIG = {
  timeout: 15000,     // 超时时间 15s
  debug: true         // 开启调试日志 ✨
}

/**
 * 获取用户 OpenID
 * @returns {Promise<string>} 用户唯一标识
 */
async function getOpenId() {
  const app = getApp()
  
  // 优先使用缓存的 OpenID
  if (app.globalData?.openId) {
    return app.globalData.openId
  }
  
  // 从本地缓存读取
  try {
    const cached = wx.getStorageSync('wx_openId')
    if (cached) {
      app.globalData.openId = cached
      return cached
    }
  } catch (err) {
    console.warn('⚠️ 读取 OpenID 缓存失败:', err.message)
  }
  
  // 降级：返回空字符串（后端会返回 401）
  // 注意：不再依赖云函数获取，改用本地缓存或授权流程
  return ''
}

/**
 * 发送 HTTP 请求（推荐方式）
 * @param {string} url - 请求路径（不含 /api/v1/ 前缀）
 * @param {object} options - 请求选项
 * @param {string} options.method - GET/POST（默认 POST）
 * @param {object} options.data - 请求参数
 * @param {boolean} options.auth - 是否需要用户认证（默认 true）
 * @returns {Promise<object>} 响应结果
 */
async function request(url, options = {}) {
  const { method = 'POST', data = {}, auth = true } = options
  
  // 构建完整 URL
  const fullUrl = `${BASE_URL}${url.startsWith('/') ? url : '/' + url}`
  
  // 准备请求头
  const headers = {
    'Content-Type': 'application/json'
  }
  
  // 认证：如果需要且不是 test 模式
  if (auth) {
    const openid = await getOpenId()
    
    if (!openid) {
      console.warn('⚠️ 未获取到 OpenID，后续调用将返回 401')
      throw new Error('登录失效，请重新登录')
    }
    
    headers['x-wx-openid'] = openid
  }
  
  // 发起网络请求
  try {
    const response = await wx.request({
      url: fullUrl,
      method: method.toUpperCase(),
      data: method === 'GET' ? undefined : data,
      header: headers,
      dataType: 'json',
      timeout: CONFIG.timeout
    })
    
    // 调试日志
    if (CONFIG.debug) {
      console.log(`🔹 ${method} ${fullUrl}`, {
        params: data,
        status: response.statusCode,
        data: response.data
      })
    }
    
    // 业务状态码判断
    if (response.statusCode === 200 && response.data && response.data.code !== 200) {
      throw new Error(response.data.message || '请求失败')
    }
    
    if (response.statusCode === 401) {
      throw new Error('未授权，请重新登录')
    }
    
    if (response.statusCode >= 500) {
      throw new Error('服务器繁忙，请稍后重试')
    }
    
    // 直接返回 data 字段的内容（后端标准格式）
    return response.data
    
  } catch (err) {
    console.error(`❌ 请求失败：${fullUrl}`, err)
    
    wx.showToast({
      title: err.message.includes('网络') ? '网络连接失败' : err.message,
      icon: 'none',
      duration: 2000
    })
    
    throw err
  }
}

/**
 * 便捷方法：简化常用请求
 */
module.exports = {
  // 通用方法
  request,
  
  // GET 请求
  get: (url, data = {}, auth = true) => request(url, { method: 'GET', data, auth }),
  
  // POST 请求
  post: (url, data = {}, auth = true) => request(url, { method: 'POST', data, auth }),
  
  // PUT 请求
  put: (url, data = {}, auth = true) => request(url, { method: 'PUT', data, auth }),
  
  // DELETE 请求
  delete: (url, data = {}, auth = true) => request(url, { method: 'DELETE', data, auth }),
  
  // 不需要认证的公共接口
  publicGet: (url, data = {}) => request(url, { method: 'GET', data, auth: false }),
  
  // 获取 OpenID 的方法（供外部调用）
  getOpenId
}
