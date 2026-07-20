/**
 * routes/word_query.js — 单词查询路由
 *
 * 从云函数 word_query 迁移，5 个 action 转为 RESTful 端点
 * GET  /search          -> search 搜索单词
 * GET  /:id             -> getById 获取单词详情
 * GET  /                -> getAll 单词列表（分页）
 * GET  /review-queue    -> getReviewQueue 待复习队列
 * GET  /new-words       -> getNewWords 获取新词
 *
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const { getPool } = require('../shared/db')
const { authMiddleware } = require('../shared/auth')

// 所有查询路由需要认证
router.use(authMiddleware)

// GET /search?keyword=xxx&limit=10
router.get('/search', async (req, res) => {
  try {
    const { keyword, limit = 10 } = req.query
    if (!keyword || !keyword.trim()) {
      return res.json({ code: 200, data: [] })
    }
    const db = getPool()
    const [rows] = await db.execute(
      `SELECT id, word, phonetic, meaning, part_of_speech,
              example_en, example_cn, grade, unit, book, tags,
              difficulty, audio_url, is_active
       FROM words
       WHERE word LIKE ? AND is_active = 1
       ORDER BY word ASC`,
      [`%${keyword}%`]
    )
    const limitedRows = rows.slice(0, parseInt(limit))
    res.json({ code: 200, data: limitedRows })
  } catch (err) {
    console.error('❌ word_query search:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// GET /review-queue?limit=50
router.get('/review-queue', async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const safeLimit = Math.max(1, Math.min(parseInt(limit), 100))
    const db = getPool()
    const [rows] = await db.execute(
      `SELECT w.id, w.word, w.phonetic, w.meaning, w.part_of_speech,
              w.example_en, w.example_cn, w.grade, w.unit, w.tags,
              u.memory_level, u.ease_factor, u.interval, u.repetitions,
              u.next_review, u.last_review, u.total_reviews,
              u.correct_count, u.wrong_count, u.streak, u.mastery_score
       FROM user_word_memories u
       JOIN words w ON u.word_id = w.id
       WHERE u.user_id = ? AND u.review_status = 'active' AND u.next_review <= NOW()
       ORDER BY u.next_review ASC LIMIT ?`,
      [req.openid, safeLimit]
    )
    res.json({ code: 200, data: rows })
  } catch (err) {
    console.error('❌ word_query review-queue:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// GET /new-words?limit=30&grade=7&book=xxx
router.get('/new-words', async (req, res) => {
  try {
    const { limit = 30, grade, book } = req.query
    let sql = `SELECT w.id, w.word, w.phonetic, w.meaning, w.part_of_speech,
                      w.example_en, w.example_cn, w.grade, w.unit, w.tags,
                      w.difficulty, w.audio_url
               FROM words w
               WHERE w.is_active = 1
                 AND w.id NOT IN (
                   SELECT word_id FROM user_word_memories WHERE user_id = ?
                 )`
    const params = [req.openid]
    if (grade) { sql += ' AND w.grade = ?'; params.push(grade) }
    if (book) { sql += ' AND w.book = ?'; params.push(book) }
    const safeLimit = Math.max(1, Math.min(parseInt(limit), 100))
    sql += ` ORDER BY w.id ASC LIMIT ${safeLimit}`
    const db = getPool()
    const [rows] = await db.execute(sql, params)
    res.json({ code: 200, data: rows })
  } catch (err) {
    console.error('❌ word_query new-words:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const wordId = req.params.id
    const db = getPool()
    const [rows] = await db.execute(
      `SELECT id, word, phonetic, meaning, part_of_speech,
              example_en, example_cn, grade, unit, book, tags,
              difficulty, audio_url, is_active, created_at, updated_at
       FROM words WHERE id = ?`,
      [wordId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '单词不存在' })
    }
    res.json({ code: 200, data: rows[0] })
  } catch (err) {
    console.error('❌ word_query getById:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// GET /?limit=50&offset=0&grade=7&book=xxx
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, grade, book } = req.query
    let sql = `SELECT w.id, w.word, w.phonetic, w.meaning, w.part_of_speech,
                      w.example_en, w.example_cn, w.grade, w.unit, w.tags,
                      w.difficulty, w.audio_url
               FROM words w WHERE w.is_active = 1`
    const params = []
    if (grade) { sql += ' AND w.grade = ?'; params.push(grade) }
    if (book) { sql += ' AND w.book = ?'; params.push(book) }
    const safeLimit = Math.max(1, Math.min(parseInt(limit), 100))
    const safeOffset = Math.max(0, parseInt(offset))
    sql += ` ORDER BY w.id ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`
    const db = getPool()
    const [rows] = await db.execute(sql, params)

    // 附加用户记忆状态
    if (req.openid && rows.length > 0) {
      const wordIds = rows.map(r => r.id)
      const safeWordIds = wordIds.map(id => String(parseInt(id)).replace(/[^0-9]/g, ''))
      const placeholders = safeWordIds.map(() => '?').join(',')
      const [memories] = await db.execute(
        `SELECT word_id, memory_level, mastery_score FROM user_word_memories
         WHERE user_id = ? AND word_id IN (${placeholders})`,
        [req.openid, ...safeWordIds]
      )
      const memoryMap = {}
      memories.forEach(m => { memoryMap[m.word_id] = m })
      rows.forEach(word => {
        const mem = memoryMap[word.id]
        word.userStatus = mem ? (mem.mastery_score >= 80 ? 'mastered' : 'learning') : 'new'
      })
    }

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM words WHERE is_active = 1'
    const countParams = []
    if (grade) { countSql += ' AND grade = ?'; countParams.push(grade) }
    if (book) { countSql += ' AND book = ?'; countParams.push(book) }
    const [countRows] = await db.execute(countSql, countParams)
    res.json({ code: 200, data: rows, total: countRows[0].total })
  } catch (err) {
    console.error('❌ word_query getAll:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

// GET /recommend?limit=5 — 智能推荐今日学习单词（基于 SM-2 算法）
router.get('/recommend', async (req, res) => {
  try {
    const { limit = 5 } = req.query
    const db = getPool()
    
    // 优先推荐新学但未掌握且临近复习的单词
    const [rows] = await db.execute(`
      SELECT w.id, w.word, w.phonetic, w.meaning, w.part_of_speech,
             w.example_en, w.example_cn, w.grade, w.unit, w.tags,
             u.ease_factor, u.interval, u.ladder, u.next_review, u.mastery_score
      FROM user_word_memories u
      JOIN words w ON u.word_id = w.id
      WHERE u.user_id = ? 
        AND u.review_status = 'active'
        AND u.last_review <= NOW()
        AND (u.next_review > NOW() OR u.interval = 0)
      ORDER BY u.next_review ASC, u.mastery_score ASC
      LIMIT ?
    `, [req.openid, parseInt(limit)])
    
    res.json({ code: 200, data: rows })
  } catch (err) {
    console.error('❌ word_query recommend:', err)
    res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message })
  }
})

module.exports = router
