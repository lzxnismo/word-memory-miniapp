/**
 * routes/record_review.js — 复习记录路由（SM-2 核心算法）
 *
 * 从云函数 record_review 迁移，3 个 action 转为 RESTful 端点
 * POST /record            -> record 记录一次复习并更新 SM-2 状态
 * GET  /memory/:wordId    -> getMemory 获取记忆状态
 * PUT  /memory/:wordId    -> upsertMemory 创建/更新记忆状态
 *
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const { getPool } = require('../shared/db')
const { authMiddleware } = require('../shared/auth')

router.use(authMiddleware)

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
    memory_level: q,
    ease_factor: Math.round(newEaseFactor * 100) / 100,
    interval: newInterval,
    repetitions: newRepetitions,
    streak: newStreak,
    next_review: nextReviewStr,
    last_review: new Date().toISOString().slice(0, 19).replace('T', ' '),
    total_reviews: (repetitions + 1),
    correct_count: q >= 3 ? correct_count + 1 : correct_count,
    wrong_count: q < 3 ? wrong_count + 1 : wrong_count,
    mastery_score: masteryScore,
    review_status: 'active'
  }
}

// POST /record
router.post('/record', async (req, res) => {
  try {
    const { wordId, quality, responseTimeMs = 0, reviewType = 'flashcard' } = req.body
    if (!wordId || quality === undefined) {
      return res.status(400).json({ code: 400, msg: '缺少 wordId 或 quality 参数' })
    }
    const db = getPool()
    const [existing] = await db.execute(
      `SELECT * FROM user_word_memories WHERE user_id = ? AND word_id = ?`,
      [req.openid, wordId]
    )
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
         req.openid, wordId]
      )
    } else {
      await db.execute(
        `INSERT INTO user_word_memories (user_id, word_id, memory_level, ease_factor, interval, repetitions,
         next_review, last_review, total_reviews, correct_count, wrong_count,
         streak, mastery_score, review_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
        [req.openid, wordId, newState.memory_level, newState.ease_factor, newState.interval,
         newState.repetitions, newState.next_review, newState.last_review, newState.total_reviews,
         newState.correct_count, newState.wrong_count, newState.streak, newState.mastery_score]
      )
    }

    // 记录复习历史
    await db.execute(
      `INSERT INTO review_histories (user_id, word_id, review_time, quality, response_time_ms, review_type)
       VALUES (?, ?, NOW(), ?, ?, ?)`,
      [req.openid, wordId, quality, responseTimeMs, reviewType]
    )

    // 更新每日计划
    const today = new Date().toISOString().split('T')[0]
    const [planExists] = await db.execute(
      `SELECT id, completed_review FROM daily_plans WHERE user_id=? AND plan_date=?`,
      [req.openid, today]
    )
    if (planExists.length > 0) {
      await db.execute(
        `UPDATE daily_plans SET completed_review=completed_review+1, updated_at=NOW() WHERE user_id=? AND plan_date=?`,
        [req.openid, today]
      )
    }

    res.json({ code: 200, msg: '复习记录保存成功', data: { wordId, quality, newState } })
  } catch (err) {
    console.error('❌ record_review record:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// GET /memory/:wordId
router.get('/memory/:wordId', async (req, res) => {
  try {
    const { wordId } = req.params
    const db = getPool()
    const [rows] = await db.execute(
      `SELECT * FROM user_word_memories WHERE user_id=? AND word_id=?`,
      [req.openid, wordId]
    )
    res.json({ code: 200, data: rows[0] || null })
  } catch (err) {
    console.error('❌ record_review getMemory:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// PUT /memory/:wordId
router.put('/memory/:wordId', async (req, res) => {
  try {
    const { wordId } = req.params
    const memoryData = req.body.memoryData || req.body
    if (!wordId || !memoryData) {
      return res.status(400).json({ code: 400, msg: '缺少 wordId 或 memoryData 参数' })
    }
    const db = getPool()
    const [existing] = await db.execute(
      `SELECT id FROM user_word_memories WHERE user_id=? AND word_id=?`,
      [req.openid, wordId]
    )
    if (existing.length > 0) {
      await db.execute(
        `UPDATE user_word_memories SET memory_level=?, ease_factor=?, interval=?, repetitions=?,
         next_review=?, last_review=?, total_reviews=?, correct_count=?, wrong_count=?,
         streak=?, mastery_score=?, updated_at=NOW()
         WHERE user_id=? AND word_id=?`,
        [memoryData.memory_level || 0, memoryData.ease_factor || 2.5, memoryData.interval || 0,
         memoryData.repetitions || 0, memoryData.next_review || null, memoryData.last_review || null,
         memoryData.total_reviews || 0, memoryData.correct_count || 0, memoryData.wrong_count || 0,
         memoryData.streak || 0, memoryData.mastery_score || 0, req.openid, wordId]
      )
    } else {
      await db.execute(
        `INSERT INTO user_word_memories (user_id, word_id, memory_level, ease_factor, interval, repetitions,
         next_review, last_review, total_reviews, correct_count, wrong_count,
         streak, mastery_score, review_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
        [req.openid, wordId, memoryData.memory_level || 0, memoryData.ease_factor || 2.5,
         memoryData.interval || 0, memoryData.repetitions || 0, memoryData.next_review || null,
         memoryData.last_review || null, memoryData.total_reviews || 0, memoryData.correct_count || 0,
         memoryData.wrong_count || 0, memoryData.streak || 0, memoryData.mastery_score || 0]
      )
    }
    res.json({ code: 200, msg: '记忆状态更新成功' })
  } catch (err) {
    console.error('❌ record_review upsertMemory:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

module.exports = router
