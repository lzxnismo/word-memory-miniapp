// cloudfunctions/goal_manager/index.js - 直连 MySQL 版本
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const mysql = require('mysql2/promise')

// MySQL 数据库配置（腾讯云 CynosDB）
const MYSQL_CONFIG = {
  host: 'sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com',
  port: 27780,
  user: 'word_memory_app',
  password: 'Root_123',
  database: 'mytx-d7gw0vhq4414988b5',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}

// 创建连接池
let pool = null

function getPool() {
  if (!pool) {
    pool = mysql.createPool(MYSQL_CONFIG)
  }
  return pool
}

/**
 * 主入口函数
 */
exports.main = async (event, context) => {
  const { action, goal_id, goal_type, target_count, start_date, end_date } = event
  
  try {
    // 获取 OpenID
    const { OPENID } = cloud.getWXContext()
    
    switch (action) {
      case 'create':
        return await createGoal(goal_type, target_count, start_date, end_date || null, OPENID)
      
      case 'list':
        return await listGoals(OPENID)
      
      case 'getProgress':
        return await getGoalProgress(goal_id, OPENID)
      
      case 'update':
        return await updateGoal(goal_id, target_count, end_date, OPENID)
      
      case 'delete':
        return await deleteGoal(goal_id, OPENID)
      
      default:
        return { code: 400, message: '未知 action', data: null }
    }
  } catch (err) {
    console.error('Error in goal_manager:', err)
    return { code: 500, message: err.message || '服务器错误', data: null }
  }
}

/**
 * 创建学习目标
 */
async function createGoal(goalType, targetCount, startDate, endDate, openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 如果未指定开始日期，默认为今天
    if (!startDate) {
      const today = new Date()
      startDate = today.toISOString().split('T')[0]
    }
    
    const [result] = await conn.execute(`
      INSERT INTO learning_goals (user_id, owner_openid, goal_type, target_count, current_count, status, start_date, end_date, created_at)
      VALUES (?, ?, ?, ?, 0, 'active', ?, ?, NOW())
    `, [openid, openid, goalType, targetCount, startDate, endDate])
    
    const [goals] = await conn.execute(`
      SELECT * FROM learning_goals WHERE id = ?
    `, [result.insertId])
    
    return {
      code: 201,
      message: '目标创建成功',
      data: goals[0]
    }
  } finally {
    conn.release()
  }
}

/**
 * 获取目标列表
 */
async function listGoals(openid) {
  const conn = await getPool().getConnection()
  
  try {
    const [goals] = await conn.execute(`
      SELECT 
        id,
        goal_type,
        target_count,
        current_count,
        ROUND(COALESCE(current_count / target_count, 0) * 100) as progress_percent,
        start_date,
        end_date,
        status,
        word_scope,
        CASE 
          WHEN status = 'completed' THEN '已完成'
          WHEN status = 'active' THEN '进行中'
          WHEN status = 'paused' THEN '已暂停'
          ELSE '未知'
        END as status_cn
      FROM learning_goals
      WHERE owner_openid = ?
      ORDER BY created_at DESC
    `, [openid])
    
    return {
      code: 200,
      message: '获取成功',
      data: goals
    }
  } finally {
    conn.release()
  }
}

/**
 * 获取目标进度（详细统计）
 */
async function getGoalProgress(goalId, openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 获取目标基本信息
    const [goals] = await conn.execute(`
      SELECT * FROM learning_goals WHERE id = ? AND owner_openid = ?
    `, [goalId, openid])
    
    if (goals.length === 0) {
      return { code: 404, message: '学习目标不存在或无权限', data: null }
    }
    
    const goal = goals[0]
    const progressPercent = Math.round((goal.current_count / goal.target_count) * 100) || 0
    
    // 根据目标类型计算实际学习数据
    let actualCount = 0
    let learnedWords = 0
    let totalWords = 0
    
    if (goal.goal_type === 'daily') {
      // 日标：查询今日学习记录
      const today = new Date().toISOString().split('T')[0]
      const [todayStats] = await conn.execute(`
        SELECT COUNT(DISTINCT word_id) as learned_today
        FROM review_histories
        WHERE user_openid = ? AND DATE(reviewed_at) = ?
      `, [openid, today])
      
      actualCount = todayStats[0].learned_today
      learnedWords = actualCount
      
    } else if (goal.goal_type === 'weekly') {
      // 周目标：查询本周学习记录
      const [weekStats] = await conn.execute(`
        SELECT COUNT(DISTINCT word_id) as learned_this_week
        FROM review_histories
        WHERE user_openid = ? 
          AND reviewed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `, [openid])
      
      actualCount = weekStats[0].learned_this_week
      learnedWords = actualCount
      
    } else {
      // 长期目标：累计总学习量
      const [allStats] = await conn.execute(`
        SELECT 
          COUNT(*) as total_learned_records,
          COUNT(DISTINCT word_id) as unique_words_learned
        FROM user_word_memories
        WHERE user_openid = ? AND mastery_score > 50
      `, [openid])
      
      actualCount = allStats[0].total_learned_records
      learnedWords = allStats[0].unique_words_learned
    }
    
    return {
      code: 200,
      message: '获取成功',
      data: {
        ...goal,
        progress_percent: progressPercent,
        actual_count: actualCount,
        remaining: Math.max(0, goal.target_count - actualCount),
        learned_words: learnedWords,
        is_complete: actualCount >= goal.target_count
      }
    }
  } finally {
    conn.release()
  }
}

/**
 * 更新学习目标
 */
async function updateGoal(goalId, targetCount, endDate, openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 验证目标是否属于当前用户
    const [existing] = await conn.execute(`
      SELECT id FROM learning_goals WHERE id = ? AND owner_openid = ?
    `, [goalId, openid])
    
    if (existing.length === 0) {
      return { code: 404, message: '目标不存在或无权限', data: null }
    }
    
    const [result] = await conn.execute(`
      UPDATE learning_goals 
      SET target_count = ?, end_date = COALESCE(?, end_date)
      WHERE id = ?
    `, [targetCount, endDate, goalId])
    
    return {
      code: 200,
      message: '更新成功',
      data: { id: goalId }
    }
  } finally {
    conn.release()
  }
}

/**
 * 删除学习目标
 */
async function deleteGoal(goalId, openid) {
  const conn = await getPool().getConnection()
  
  try {
    const [result] = await conn.execute(`
      DELETE FROM learning_goals WHERE id = ? AND owner_openid = ?
    `, [goalId, openid])
    
    if (result.affectedRows === 0) {
      return { code: 404, message: '目标不存在或无权限', data: null }
    }
    
    return {
      code: 200,
      message: '删除成功',
      data: { id: goalId }
    }
  } finally {
    conn.release()
  }
}