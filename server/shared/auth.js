/**
 * shared/auth.js — OpenID 认证中间件
 * 
 * 微信云托管会在请求头中注入 x-wx-openid
 * 开发环境可通过 x-test-openid 模拟
 * 
 * © 一帮人马工作室（QQ691481548）
 */

/**
 * 从请求中提取 OpenID
 * 优先级: x-wx-openid > x-test-openid > query.openid
 */
function getOpenId(req) {
  return req.headers['x-wx-openid'] ||
    req.headers['x-test-openid'] ||
    req.query.openid ||
    req.body?.openid
}

/**
 * OpenID 认证中间件
 * 如果请求没有 OpenID，返回 401
 * 如果请求有 OpenID，注入到 req.openid
 */
function authMiddleware(req, res, next) {
  const openid = getOpenId(req)
  if (!openid) {
    return res.status(401).json({
      code: 401,
      message: '缺少用户身份标识（OpenID）'
    })
  }
  req.openid = openid
  next()
}

module.exports = { getOpenId, authMiddleware }