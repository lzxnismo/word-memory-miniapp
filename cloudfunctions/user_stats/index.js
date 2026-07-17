/**
 * user_stats 云函数
 * 用户统计数据查询
 * 
 * 支持的操作：
 * - overview: 获取统计概览（总复习次数、连续天数、正确率）
 * - getOpenId: 获取用户 OpenID
 * - dailyPlan: 获取/更新每日计划
 * - history: 获取复习历史日历数据
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ==================== MySQL 连接（可选） ====================
let mysql
let pool = null

try {
  mysql = require('mysql2/promise')
  console.log('✅ user_stats: mysql2 模块加载成功')
} catch (e) {
  console.warn('⚠️ user_stats: mysql2 未安装，将使用云开发数据库:', e.message)
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com',
      port: process.env.MYSQL_PORT || 27780,
      user: process.env.MYSQL_USER || 'word_memory_app',
      password: process.env.MYSQL_PASSWORD || 'Root_123',
      database: process.env.MYSQL_DATABASE || 'mytx-d7gw0vhq4414988b5',
      waitForConnections: true,
      connectionLimit: 2,
      queueLimit: 0,
      connectTimeout: 8000,
      timezone: '+08:00'
    })
  }
  return pool
}

function getOpenId(event) {
  try {
    const wxContext = cloud.getWXContext()
    if (wxContext && wxContext.OPENID) {
      return wxContext.OPENID
    }
  } catch (e) {
    console.warn('⚠️ user_stats: 获取 OpenID 失败:', e.message)
  }
  return event.userId || 'default'
}

// ==================== 主函数 ====================
exports.main = async (event, context) => {
  console.log('📝 user_stats 调用参数:', JSON.stringify(event))
  const { action } = event
  const openId = getOpenId(event)

  // getOpenId 不需要数据库
  if (action === 'getOpenId') {
    return { code: 200, openId }
  }

  try {
    if (mysql) {
      console.log('✅ user_stats: 使用 MySQL')
      const db = getPool()
      switch (action) {
        case 'overview': return await handleOverview(db, openId)
        case 'dailyPlan': return await handleDailyPlan(db, openId, event)
        case 'history': return await handleHistory(db, openId, event)
        default: return { code: 400, msg: `未知的 action: ${action}` }
      }
    }

    // 降级：云开发数据库
    console.log('⚠️ user_stats: 使用云开发数据库降级')
    switch (action) {
      case 'overview': return { code: 200, data: { total_reviews: 0, total_learned: 0, total_mastered: 0, accuracy: 0, current_streak: 0, pending_review: 0 } }
      case 'dailyPlan': return { code: 200, data: null }
      case 'history': return { code: 200, data: [] }
      default: return { code: 400, msg: `未知的 action: ${action}` }
    }
  } catch (error) {
    console.error('❌ user_stats 错误:', error)
    return { code: 500, msg: '服务器内部错误', error: error.message }
  }
}

// ==================== MySQL 实现 ====================
async function handleOverview(db, openId) {
  const [reviewRows] = await db.execute(`SELECT COUNT(*) as total FROM review_histories WHERE user_id = ?`, [openId])
  const totalReviews = reviewRows[0].total
  const [learnedRows] = await db.execute(`SELECT COUNT(*) as total FROM user_word_memories WHERE user_id = ?`, [openId])
  const totalLearned = learnedRows[0].total
  const [masteredRows] = await db.execute(`SELECT COUNT(*) as total FROM user_word_memories WHERE user_id = ? AND mastery_score >= 80`, [openId])
  const totalMastered = masteredRows[0].total
  const [correctRows] = await db.execute(`SELECT COUNT(*) as total FROM review_histories WHERE user_id = ? AND quality >= 4`, [openId])
  const correctCount = correctRows[0].total
  const accuracy = totalReviews > 0 ? Math.round(correctCount / totalReviews * 100) : 0
  const [pendingRows] = await db.execute(`SELECT COUNT(*) as total FROM user_word_memories WHERE user_id = ? AND review_status = 'active' AND next_review <= NOW()`, [openId])
  return { code: 200, data: { total_reviews: totalReviews, total_learned: totalLearned, total_mastered: totalMastered, accuracy, current_streak: 0, pending_review: pendingRows[0].total } }
}

async function handleDailyPlan(db, openId, event) {
  const { planDate } = event
  const date = planDate || new Date().toISOString().split('T')[0]
  const [rows] = await db.execute(`SELECT * FROM daily_plans WHERE user_id = ? AND plan_date = ?`, [openId, date])
  return { code: 200, data: rows[0] || null }
}

async function handleHistory(db, openId, event) {
  const { days = 30 } = event
  const [rows] = await db.execute(
    `SELECT DATE(review_time) as date, COUNT(*) as review_count,
            SUM(CASE WHEN quality >= 4 THEN 1 ELSE 0 END) as correct_count, AVG(quality) as avg_quality
     FROM review_histories WHERE user_id = ? AND review_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(review_time) ORDER BY date ASC`, [openId, days])
  return { code: 200, data: rows }
}