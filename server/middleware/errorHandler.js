/**
 * middleware/errorHandler.js — 统一错误处理中间件
 * 
 * 所有路由抛出的错误都会汇聚到这里
 * 统一返回 { code, message, data } 格式
 * 
 * © 一帮人马工作室（QQ691481548）
 */

function errorHandler(err, req, res, next) {
  console.error(`❌ [${req.method}] ${req.path}:`, err.message)

  const status = err.status || 500
  const response = {
    code: status,
    message: err.message || '服务器内部错误',
    data: null
  }

  // 开发环境返回错误堆栈
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack
  }

  res.status(status).json(response)
}

/**
 * 404 处理中间件（匹配不到路由时）
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    code: 404,
    message: `接口不存在: ${req.method} ${req.path}`,
    data: null
  })
}

module.exports = { errorHandler, notFoundHandler }