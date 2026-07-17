/**
 * routes/stats_advanced.js — 高级统计与成就
 *
 * 从云函数 stats_advanced 迁移，3 个 action 转为 RESTful 端点
 * GET /stats           -> getStats 综合统计数据
 * GET /trends?days=30  -> getTrends 学习趋势数据
 * GET /achievements    -> getAchievements 成就徽章
 *
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const { getPool } = require('../shared/db')
const { authMiddleware } = require('../shared/auth')

router.use(authMiddleware)

// GET /stats
router.get('/stats', async (req, res) => {
  try {
    const db = getPool()
    const conn = await db.getConnection()
    try {
      // 总词数
      const [totalWords] = await conn.execute('SELECT COUNT(*) AS cnt FROM words WHERE is_active = 1')

      // 用户学习进度
      const [progress] = await conn.execute(`
        SELECT 
          COUNT(*) AS learned_count,
          COALESCE(SUM(CASE WHEN mastery_score > 80 THEN 1 ELSE 0 END), 0) AS mastered_count,
          COALESCE(AVG(mastery_score), 0) AS avg_mastery
        FROM user_word_memories
        WHERE user_id = ?
      `, [req.openid])

      // 今日复习统计
      const [todayStats] = await conn.execute(`
        SELECT 
          COUNT(DISTINCT word_id) AS reviewed_today,
          COALESCE(AVG(quality), 0) AS avg_quality
        FROM review_histories
        WHERE user_id = ? AND DATE(review_time) = CURDATE()
      `, [req.openid])

      // 连续学习天数
      const [streakData] = await conn.execute(`
        WITH review_dates AS (
          SELECT DISTINCT DATE(review_time) AS rdate
          FROM review_histories
          WHERE user_id = ?
          ORDER BY rdate DESC
        ),
        date_gaps AS (
          SELECT rdate, DATEDIFF(CURDATE(), rdate) AS days_ago, ROW_NUMBER() OVER (ORDER BY rdate DESC) AS rn
          FROM review_dates
        ),
        gap_check AS (
          SELECT rdate, days_ago, rn, days_ago - rn AS gap_group
          FROM date_gaps
        )
        SELECT COUNT(*) AS streak FROM gap_check WHERE gap_group = 0
      `, [req.openid])

      // 复习类型分布
      const [typeDist] = await conn.execute(`
        SELECT review_type, COUNT(*) AS cnt
        FROM review_histories
        WHERE user_id = ?
        GROUP BY review_type
      `, [req.openid])

      // 今日计划
      const [plan] = await conn.execute(`
        SELECT new_words_count, review_words_count,
               COALESCE(completed_new, 0) AS completed_new,
               COALESCE(completed_review, 0) AS completed_review
        FROM daily_plans
        WHERE user_id = ? AND plan_date = CURDATE()
      `, [req.openid])

      // 今日正确率
      const [accuracy] = await conn.execute(`
        SELECT 
          COALESCE(SUM(CASE WHEN quality >= 3 THEN 1 ELSE 0 END), 0) AS correct,
          COUNT(*) AS total
        FROM review_histories
        WHERE user_id = ? AND DATE(review_time) = CURDATE()
      `, [req.openid])

      const streak = streakData[0]?.streak || 0
      const correctRate = accuracy.total > 0 ? Math.round((accuracy.correct / accuracy.total) * 100) : 0

      res.json({
        code: 200,
        message: '获取成功',
        data: {
          word_bank: {
            total: totalWords[0].cnt,
            learned: progress[0].learned_count,
            mastered: progress[0].mastered_count,
            avg_mastery: Math.round(progress[0].avg_mastery)
          },
          today: {
            reviewed: todayStats[0].reviewed_today,
            avg_quality: Math.round(todayStats[0].avg_quality * 10) / 10,
            plan: plan.length > 0 ? {
              new: plan[0].new_words_count,
              new_completed: plan[0].completed_new,
              review: plan[0].review_words_count,
              review_completed: plan[0].completed_review,
              new_progress: plan[0].new_words_count > 0 ? Math.round((plan[0].completed_new / plan[0].new_words_count) * 100) : 100,
              review_progress: plan[0].review_words_count > 0 ? Math.round((plan[0].completed_review / plan[0].review_words_count) * 100) : 100
            } : null,
            correct_rate: correctRate
          },
          streak: streak,
          review_type_distribution: typeDist.map(t => ({ type: t.review_type, count: t.cnt }))
        }
      })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ stats_advanced stats:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// GET /trends?days=30
router.get('/trends', async (req, res) => {
  try {
    const { days = 30 } = req.query
    const db = getPool()
    const [rows] = await db.execute(`
      SELECT 
        DATE(review_time) AS review_date,
        COUNT(DISTINCT word_id) AS word_count,
        COUNT(*) AS review_count,
        COALESCE(AVG(quality), 0) AS avg_quality,
        SUM(CASE WHEN quality >= 3 THEN 1 ELSE 0 END) AS correct_count
      FROM review_histories
      WHERE user_id = ? AND review_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(review_time)
      ORDER BY review_date ASC
    `, [req.openid, parseInt(days)])

    res.json({
      code: 200,
      message: '获取成功',
      data: rows.map(r => ({
        date: r.review_date.toISOString().split('T')[0],
        words_learned: r.word_count,
        reviews: r.review_count,
        avg_quality: Math.round(r.avg_quality * 10) / 10,
        accuracy: r.review_count > 0 ? Math.round((r.correct_count / r.review_count) * 100) : 0
      }))
    })
  } catch (err) {
    console.error('❌ stats_advanced trends:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// GET /achievements
router.get('/achievements', async (req, res) => {
  try {
    const db = getPool()
    const conn = await db.getConnection()
    try {
      // 学习统计
      const [totalLearned] = await conn.execute(`
        SELECT COUNT(*) AS cnt FROM user_word_memories WHERE user_id = ?
      `, [req.openid])

      const [mastered] = await conn.execute(`
        SELECT COUNT(*) AS cnt FROM user_word_memories WHERE user_id = ? AND mastery_score > 80
      `, [req.openid])

      const [streakData] = await conn.execute(`
        WITH review_dates AS (
          SELECT DISTINCT DATE(review_time) AS rdate
          FROM review_histories
          WHERE user_id = ?
          ORDER BY rdate DESC
        ),
        date_gaps AS (
          SELECT rdate, DATEDIFF(CURDATE(), rdate) - ROW_NUMBER() OVER (ORDER BY rdate DESC) AS gap_group
          FROM review_dates
        )
        SELECT COUNT(*) AS streak FROM date_gaps WHERE gap_group = 0
      `, [req.openid])

      const [totalReviews] = await conn.execute(`
        SELECT COUNT(*) AS cnt FROM review_histories WHERE user_id = ?
      `, [req.openid])

      const streak = streakData[0]?.streak || 0
      const learned = totalLearned[0]?.cnt || 0
      const reviews = totalReviews[0]?.cnt || 0
      const masteredCount = mastered[0]?.cnt || 0

      // 成就列表
      const achievements = [
        { id: 'first_word', name: '初识单词', description: '学习第一个单词', icon: '🌱', unlocked: learned >= 1, progress: Math.min(learned, 1), target: 1 },
        { id: 'ten_words', name: '词汇小能手', description: '累计学习 10 个单词', icon: '🌟', unlocked: learned >= 10, progress: Math.min(learned, 10), target: 10 },
        { id: 'hundred_words', name: '百词斩', description: '累计学习 100 个单词', icon: '🏆', unlocked: learned >= 100, progress: Math.min(learned, 100), target: 100 },
        { id: 'master_20', name: '初露锋芒', description: '掌握 20 个单词（精通度>80）', icon: '🔥', unlocked: masteredCount >= 20, progress: Math.min(masteredCount, 20), target: 20 },
        { id: 'streak_3', name: '三天打鱼', description: '连续学习 3 天', icon: '📅', unlocked: streak >= 3, progress: Math.min(streak, 3), target: 3 },
        { id: 'streak_7', name: '一周好汉', description: '连续学习 7 天', icon: '⏰', unlocked: streak >= 7, progress: Math.min(streak, 7), target: 7 },
        { id: 'streak_30', name: '月度坚持', description: '连续学习 30 天', icon: '🎯', unlocked: streak >= 30, progress: Math.min(streak, 30), target: 30 },
        { id: 'hundred_reviews', name: '百次复习', description: '完成 100 次复习', icon: '🔄', unlocked: reviews >= 100, progress: Math.min(reviews, 100), target: 100 }
      ]

      const earned = achievements.filter(a => a.unlocked).length

      res.json({
        code: 200,
        message: '获取成功',
        data: {
          total_achievements: achievements.length,
          earned: earned,
          progress_percent: Math.round((earned / achievements.length) * 100),
          list: achievements
        }
      })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ stats_advanced achievements:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

module.exports = router
