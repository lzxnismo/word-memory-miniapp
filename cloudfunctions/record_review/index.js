/**
 * record_review 云函数
 * 记录复习结果 + SM-2 算法核心
 * 
 * 支持的操作：
 * - record: 记录一次复习并更新 SM-2 状态
 * - getMemory: 获取用户在某单词上的记忆状态
 * - upsertMemory: 创建/更新记忆状态
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

let mysql
let pool = null

try {
  mysql = require('mysql2/promise')
  console.log('✅ record_review: mysql2 模块加载成功')
} catch (e) {
  console.warn('⚠️ record_review: mysql2 未安装:', e.message)
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
    if (wxContext && wxContext.OPENID) return wxContext.OPENID
  } catch (e) {}
  return event.userId || 'default'
}

// ==================== SM-2 算法核心 ====================
function calculateSM2(sm2State, quality) {
  const { ease_factor = 2.5, interval = 0, repetitions = 0, correct_count = 0, wrong_count = 0, streak = 0 } = sm2State || {}
  const q = Math.max(1, Math.min(5, quality))
  let newEaseFactor, newInterval, newRepetitions, newStreak
  if (q >= 3) {
    newRepetitions = repetitions + 1
    newStreak = streak + 1
    newEaseFactor = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    if (newEaseFactor < 1.3) newEaseFactor = 1.3
    newInterval = repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.round(interval * newEaseFactor)
  } else {
    newRepetitions = 0
    newStreak = 0
    newEaseFactor = ease_factor
    newInterval = 1
  }
  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + newInterval)
  const nextReviewStr = nextReview.toISOString().slice(0, 19).replace('T', ' ')
  const baseScore = q / 5 * 40
  const streakBonus = Math.min(60, newRepetitions * 5)
  const masteryScore = Math.min(100, Math.round(baseScore + streakBonus))
  return {
    memory_level: q, ease_factor: Math.round(newEaseFactor * 100) / 100,
    interval: newInterval, repetitions: newRepetitions, streak: newStreak,
    next_review: nextReviewStr,
    last_review: new Date().toISOString().slice(0, 19).replace('T', ' '),
    total_reviews: repetitions + 1,
    correct_count: q >= 3 ? correct_count + 1 : correct_count,
    wrong_count: q < 3 ? wrong_count + 1 : wrong_count,
    mastery_score: masteryScore, review_status: 'active'
  }
}

exports.main = async (event, context) => {
  console.log('📝 record_review 调用参数:', JSON.stringify(event))
  const { action } = event
  const openId = getOpenId(event)
  if (!mysql) return { code: 500, msg: 'MySQL 不可用，请先安装 mysql2 依赖', source: 'fallback' }
  try {
    const db = getPool()
    switch (action) {
      case 'record': return await handleRecord(db, openId, event)
      case 'getMemory': return await handleGetMemory(db, openId, event)
      case 'upsertMemory': return await handleUpsertMemory(db, openId, event)
      default: return { code: 400, msg: `未知的 action: ${action}` }
    }
  } catch (error) {
    console.error('❌ record_review 错误:', error)
    return { code: 500, msg: '服务器内部错误', error: error.message }
  }
}

async function handleRecord(db, openId, event) {
  const { wordId, quality, responseTimeMs = 0, reviewType = 'flashcard' } = event
  if (!wordId || quality === undefined) return { code: 400, msg: '缺少 wordId 或 quality 参数' }
  const [existing] = await db.execute(`SELECT * FROM user_word_memories WHERE user_id = ? AND word_id = ?`, [openId, wordId])
  const currentState = existing[0] || {}
  const newState = calculateSM2(currentState, quality)
  if (existing.length > 0) {
    await db.execute(
      `UPDATE user_word_memories SET memory_level=?, ease_factor=?, interval=?, repetitions=?,
       next_review=?, last_review=?, total_reviews=?, correct_count=?, wrong_count=?,
       streak=?, mastery_score=?, review_status='active', updated_at=NOW()
       WHERE user_id=? AND word_id=?`,
      [newState.memory_level, newState.ease_factor, newState.interval, newState.repetitions,
       newState.next_review, newState.last_review, newState.total_reviews,
       newState.correct_count, newState.wrong_count, newState.streak, newState.mastery_score,
       openId, wordId])
  } else {
    await db.execute(
      `INSERT INTO user_word_memories (user_id, word_id, memory_level, ease_factor, interval, repetitions,
       next_review, last_review, total_reviews, correct_count, wrong_count,
       streak, mastery_score, review_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [openId, wordId, newState.memory_level, newState.ease_factor, newState.interval, newState.repetitions,
       newState.next_review, newState.last_review, newState.total_reviews,
       newState.correct_count, newState.wrong_count, newState.streak, newState.mastery_score])
  }
  await db.execute(
    `INSERT INTO review_histories (user_id, word_id, review_time, quality, response_time_ms, review_type)
     VALUES (?, ?, NOW(), ?, ?, ?)`,
    [openId, wordId, quality, responseTimeMs, reviewType])
  const today = new Date().toISOString().split('T')[0]
  const [planExists] = await db.execute(`SELECT id, completed_review FROM daily_plans WHERE user_id=? AND plan_date=?`, [openId, today])
  if (planExists.length > 0) {
    await db.execute(`UPDATE daily_plans SET completed_review=completed_review+1, updated_at=NOW() WHERE user_id=? AND plan_date=?`, [openId, today])
  }
  return { code: 200, msg: '复习记录保存成功', data: { wordId, quality, newState } }
}

async function handleGetMemory(db, openId, event) {
  const { wordId } = event
  if (!wordId) return { code: 400, msg: '缺少 wordId 参数' }
  const [rows] = await db.execute(`SELECT * FROM user_word_memories WHERE user_id=? AND word_id=?`, [openId, wordId])
  return { code: 200, data: rows[0] || null }
}

async function handleUpsertMemory(db, openId, event) {
  const { wordId, memoryData } = event
  if (!wordId || !memoryData) return { code: 400, msg: '缺少 wordId 或 memoryData 参数' }
  const [existing] = await db.execute(`SELECT id FROM user_word_memories WHERE user_id=? AND word_id=?`, [openId, wordId])
  if (existing.length > 0) {
    await db.execute(
      `UPDATE user_word_memories SET memory_level=?, ease_factor=?, interval=?, repetitions=?,
       next_review=?, last_review=?, total_reviews=?, correct_count=?, wrong_count=?,
       streak=?, mastery_score=?, updated_at=NOW()
       WHERE user_id=? AND word_id=?`,
      [memoryData.memory_level || 0, memoryData.ease_factor || 2.5, memoryData.interval || 0,
       memoryData.repetitions || 0, memoryData.next_review || null, memoryData.last_review || null,
       memoryData.total_reviews || 0, memoryData.correct_count || 0, memoryData.wrong_count || 0,
       memoryData.streak || 0, memoryData.mastery_score || 0, openId, wordId])
  } else {
    await db.execute(
      `INSERT INTO user_word_memories (user_id, word_id, memory_level, ease_factor, interval, repetitions,
       next_review, last_review, total_reviews, correct_count, wrong_count,
       streak, mastery_score, review_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [openId, wordId, memoryData.memory_level || 0, memoryData.ease_factor || 2.5,
       memoryData.interval || 0, memoryData.repetitions || 0, memoryData.next_review || null,
       memoryData.last_review || null, memoryData.total_reviews || 0, memoryData.correct_count || 0,
       memoryData.wrong_count || 0, memoryData.streak || 0, memoryData.mastery_score || 0])
  }
  return { code: 200, msg: '记忆状态更新成功' }
}