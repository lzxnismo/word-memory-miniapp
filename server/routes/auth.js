/**
 * routes/auth.js — 微信登录认证路由
 * 
 * 通过 wx.login 返回的 code → jscode2session → 真实 OpenID
 * 开发环境（无 APPID/APPSECRET）自动降级为模拟 OpenID
 * 
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const https = require('https')

/**
 * POST /auth/login — 用 wx.login code 换取 OpenID
 * 开发工具：wx.login 返回模拟 code，后端无 APPID 时返回模拟 OpenID ✅
 * 线上真机：wx.login 返回真实 code，后端用 jscode2session 换真实 OpenID ✅
 */
router.post('/login', async (req, res) => {
  const { code } = req.body

  if (!code) {
    return res.status(400).json({
      code: 400,
      message: '缺少 code 参数',
      data: null
    })
  }

  const appid = process.env.APPID
  const secret = process.env.APPSECRET

  // 开发环境：没有 APPID/APPSECRET 时，返回模拟 OpenID
  if (!appid || !secret) {
    const mockOpenId = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    console.log('🔑 [开发模式] 模拟登录:', mockOpenId.substring(0, 15) + '...')
    return res.json({
      code: 200,
      message: '开发模式模拟登录',
      data: { openid: mockOpenId }
    })
  }

  // 生产环境：调用微信 jscode2session 接口
  try {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`

    const response = await new Promise((resolve, reject) => {
      https.get(url, (resp) => {
        let data = ''
        resp.on('data', chunk => data += chunk)
        resp.on('end', () => {
          try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
        })
      }).on('error', reject)
    })

    if (response.errcode) {
      console.error('❌ jscode2session 失败:', response.errcode, response.errmsg)
      return res.status(400).json({
        code: 400,
        message: '登录凭证无效，请重试',
        data: null
      })
    }

    console.log('🔑 登录成功:', response.openid.substring(0, 8) + '...')
    res.json({
      code: 200,
      message: '登录成功',
      data: { openid: response.openid }
    })
  } catch (err) {
    console.error('❌ jscode2session 网络错误:', err.message)
    res.status(500).json({
      code: 500,
      message: '登录服务异常，请稍后重试',
      data: null
    })
  }
})

module.exports = router