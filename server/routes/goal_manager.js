/**
 * routes/goal_manager.js — 学习目标管理
 *
 * 从云函数 goal_manager 迁移，5 个 action 转为 RESTful 端点
 * POST   /            -> create 创建目标
 * GET    /            -> list 获取目标列表
 * GET    /:id         -> getProgress 获取目标进度
 * PUT    /:id         -> update 更新目标
 * DELETE /:id         -> delete 删除目标
 *
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const { getPool } = require('../shared/db')
const { authMiddleware } = require('../shared/auth')

router.use(authMiddleware)

// POST /
router.post('/', async (req, res) => {
  try {
    const { goal_type, target_count, start_date, end_date } = req.body
    if (!goal_type || !target_count) {
      return res.status(400).json({ code: 400, message: '缺少必要参数', data: null })
    }

    const startDate = start_date || new Date().toISOString().split('T')[0]
    const endDate = end_date || null

    const db = getPool()
    const conn = await db.getConnection()
    try {
      const [result] = await conn.execute(`
        INSERT INTO learning_goals (user_id, owner_openid, goal_type, target_count, current_count, status, start_date, end_date, created_at)
        VALUES (?, ?, ?, ?, 0, 'active', ?, ?, NOW())
      `, [req.openid, req.openid, goal_type, target_count, startDate, endDate])

      const [goals] = await conn.execute(`SELECT * FROM learning_goals WHERE id = ?`, [result.insertId])

      res.status(201).json({
        code: 201,
        message: '目标创建成功',
        data: goals[0]
      })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ goal_manager create:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

// GET /
router.get('/', async (req, res) => {
  try {
    const db = getPool()
    const [goals] = await db.execute(`
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
    `, [req.openid])

    res.json({ code: 200, message: '获取成功', data: goals })
  } catch (err) {
    console.error('❌ goal_manager list:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id)
    const db = getPool()
    const conn = await db.getConnection()
    try {
      const [goals] = await conn.execute(`
        SELECT * FROM learning_goals WHERE id = ? AND owner_openid = ?
      `, [goalId, req.openid])

      if (goals.length === 0) {
        return res.status(404).json({ code: 404, message: '学习目标不存在或无权限', data: null })
      }

      const goal = goals[0]
      const progressPercent = Math.round((goal.current_count / goal.target_count) * 100) || 0

      let actualCount = 0
      let learnedWords = 0

      if (goal.goal_type === 'daily') {
        const today = new Date().toISOString().split('T')[0]
        const [todayStats] = await conn.execute(`
          SELECT COUNT(DISTINCT word_id) as learned_today
          FROM review_histories
          WHERE user_openid = ? AND DATE(reviewed_at) = ?
        `, [req.openid, today])
        actualCount = todayStats[0].learned_today
        learnedWords = actualCount
      } else if (goal.goal_type === 'weekly') {
        const [weekStats] = await conn.execute(`
          SELECT COUNT(DISTINCT word_id) as learned_this_week
          FROM review_histories
          WHERE user_openid = ? AND reviewed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `, [req.openid])
        actualCount = weekStats[0].learned_this_week
        learnedWords = actualCount
      } else {
        const [allStats] = await conn.execute(`
          SELECT COUNT(*) as total_learned_records, COUNT(DISTINCT word_id) as unique_words_learned
          FROM user_word_memories
          WHERE user_openid = ? AND mastery_score > 50
        `, [req.openid])
        actualCount = allStats[0].total_learned_records
        learnedWords = allStats[0].unique_words_learned
      }

      res.json({
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
      })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ goal_manager progress:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

// PUT /:id
router.put('/:id', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id)
    const { target_count, end_date } = req.body
    const db = getPool()
    const conn = await db.getConnection()
    try {
      const [existing] = await conn.execute(`
        SELECT id FROM learning_goals WHERE id = ? AND owner_openid = ?
      `, [goalId, req.openid])
      if (existing.length === 0) {
        return res.status(404).json({ code: 404, message: '目标不存在或无权限', data: null })
      }

      const [result] = await conn.execute(`
        UPDATE learning_goals 
        SET target_count = ?, end_date = COALESCE(?, end_date)
        WHERE id = ?
      `, [target_count, end_date || null, goalId])

      res.json({ code: 200, message: '更新成功', data: { id: goalId } })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ goal_manager update:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id)
    const db = getPool()
    const conn = await db.getConnection()
    try {
      const [result] = await conn.execute(`
        DELETE FROM learning_goals WHERE id = ? AND owner_openid = ?
      `, [goalId, req.openid])
      if (result.affectedRows === 0) {
        return res.status(404).json({ code: 404, message: '目标不存在或无权限', data: null })
      }

      res.json({ code: 200, message: '删除成功', data: { id: goalId } })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ goal_manager delete:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

module.exports = router
