/**
 * routes/user_stats.js — 用户统计路由
 *
 * 从云函数 user_stats 迁移，3 个 action 转为 RESTful 端点
 * GET /overview          -> overview 统计概览
 * GET /daily-plan        -> dailyPlan 获取/更新每日计划
 * GET /history?days=30   -> history 复习历史日历数据
 *
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const { getPool } = require('../shared/db')
const { authMiddleware } = require('../shared/auth')

router.use(authMiddleware)

// GET /overview
router.get('/overview', async (req, res) => {
  try {
    const db = getPool()
    const [reviewRows] = await db.execute(
      `SELECT COUNT(*) as total FROM review_histories WHERE user_id = ?`,
      [req.openid]
    )
    const totalReviews = reviewRows[0].total

    const [learnedRows] = await db.execute(
      `SELECT COUNT(*) as total FROM user_word_memories WHERE user_id = ?`,
      [req.openid]
    )
    const totalLearned = learnedRows[0].total

    const [masteredRows] = await db.execute(
      `SELECT COUNT(*) as total FROM user_word_memories WHERE user_id = ? AND mastery_score >= 80`,
      [req.openid]
    )
    const totalMastered = masteredRows[0].total

    const [correctRows] = await db.execute(
      `SELECT COUNT(*) as total FROM review_histories WHERE user_id = ? AND quality >= 4`,
      [req.openid]
    )
    const correctCount = correctRows[0].total
    const accuracy = totalReviews > 0 ? Math.round((correctCount / totalReviews) * 100) : 0

    const [pendingRows] = await db.execute(
      `SELECT COUNT(*) as total FROM user_word_memories 
       WHERE user_id = ? AND review_status = 'active' AND next_review <= NOW()`,
      [req.openid]
    )
    const currentStreak = 0 // TODO: 实现连续学习天数计算

    res.json({
      code: 200,
      data: {
        total_reviews: totalReviews,
        total_learned: totalLearned,
        total_mastered: totalMastered,
        accuracy,
        current_streak: currentStreak,
        pending_review: pendingRows[0].total
      }
    })
  } catch (err) {
    console.error('❌ user_stats overview:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// GET /daily-plan?planDate=2026-07-15
router.get('/daily-plan', async (req, res) => {
  try {
    const { planDate } = req.query
    const date = planDate || new Date().toISOString().split('T')[0]
    const db = getPool()
    const [rows] = await db.execute(
      `SELECT * FROM daily_plans WHERE user_id = ? AND plan_date = ?`,
      [req.openid, date]
    )
    res.json({ code: 200, data: rows[0] || null })
  } catch (err) {
    console.error('❌ user_stats dailyPlan:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// GET /history?days=30
router.get('/history', async (req, res) => {
  try {
    const { days = 30 } = req.query
    const db = getPool()
    const [rows] = await db.execute(
      `SELECT DATE(review_time) as date, COUNT(*) as review_count,
              SUM(CASE WHEN quality >= 4 THEN 1 ELSE 0 END) as correct_count, 
              AVG(quality) as avg_quality
       FROM review_histories 
       WHERE user_id = ? AND review_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(review_time) ORDER BY date ASC`,
      [req.openid, parseInt(days)]
    )
    res.json({ code: 200, data: rows })
  } catch (err) {
    console.error('❌ user_stats history:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// GET /review-queue?limit=50 — 待复习队列
router.get('/review-queue', async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const db = getPool()
    
    // 获取今日待复习单词（SM-2 状态活跃且到期）
    const [rows] = await db.execute(`
      SELECT uwm.word_id, w.word, w.phonetic, w.meaning,
             uwm.next_review, uwm.memory_level, uwm.total_reviews, uwm.mastery_score
      FROM user_word_memories uwm
      JOIN words w ON uwm.word_id = w.id
      WHERE uwm.user_id = ? 
        AND uwm.review_status = 'active'
        AND uwm.next_review <= NOW()
      ORDER BY uwm.next_review ASC
      LIMIT ?
    `, [req.openid, parseInt(limit)])
    
    res.json({ code: 200, data: rows })
  } catch (err) {
    console.error('❌ user_stats review-queue:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

module.exports = router
