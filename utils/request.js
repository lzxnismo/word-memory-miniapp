/**
 * utils/request.js — 统一 HTTP 请求封装
 * 
 * 使用 wx.cloud.callContainer() 走微信内网直达云托管
 * 云托管网关自动注入 x-wx-openid，无需手动登录
 * 
 * © 一帮人马工作室（QQ691481548）
 */

// 云托管环境配置
const CLOUD_CONFIG = {
  env: 'prod-d2g668gku1c36b430',   // 云托管环境 ID
  service: 'express-yoq0',           // 云托管服务名称（从控制台服务列表获取）
  timeout: 15000                     // 超时时间 15s
}

// 全局配置
const CONFIG = {
  debug: true         // 开启调试日志
}

/**
 * 发送 HTTP 请求（通过微信内网 callContainer）
 * @param {string} url - 请求路径（不含 /api/v1/ 前缀）
 * @param {object} options - 请求选项
 * @param {string} options.method - GET/POST/PUT/DELETE（默认 POST）
 * @param {object} options.data - 请求参数
 * @param {boolean} options.auth - 是否需要用户认证（默认 true，云托管自动注入）
 * @returns {Promise<object>} 响应结果
 */
async function request(url, options = {}) {
  const { method = 'POST', data = {}, auth = true } = options

  // 规范化路径
  const path = url.startsWith('/') ? url : '/' + url

  try {
    // 使用 wx.cloud.callContainer 走微信内网
    const response = await new Promise((resolve, reject) => {
      wx.cloud.callContainer({
        config: {
          env: CLOUD_CONFIG.env
        },
        path: '/api/v1' + path,
        method: method.toUpperCase(),
        data: data,
        header: {
          'Content-Type': 'application/json',
          'X-WX-SERVICE': CLOUD_CONFIG.service  // 云托管服务名称，必须指定
        },
        timeout: CLOUD_CONFIG.timeout,
        success: (res) => resolve(res),
        fail: (err) => {
          console.error(`❌ callContainer 失败: ${path}`, err)
          reject(new Error(err.errMsg || err.message || '网络请求失败'))
        }
      })
    })

    // 调试日志
    if (CONFIG.debug) {
      console.log(`🔹 ${method} ${path}`, {
        params: data,
        status: response.statusCode,
        data: response.data
      })
    }

    // 检查响应是否有效
    if (!response.statusCode) {
      throw new Error('网络连接失败，请检查网络设置或云托管服务状态')
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
    console.error(`❌ 请求失败：${path}`, err)

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

  // 兼容方法（保留空实现，防止页面调用报错）
  getOpenId: () => {
    const app = getApp()
    return app?.globalData?.openId || ''
  }
}
