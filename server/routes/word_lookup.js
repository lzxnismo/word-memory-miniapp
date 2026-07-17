/**
 * routes/word_lookup.js — 单词查词与详情
 *
 * 从云函数 word_lookup 迁移，3 个 action 转为 RESTful 端点
 * GET /lookup?word=xxx          -> lookup 精确/模糊匹配查词
 * GET /detail/:wordId           -> getOnlineDetail 单词详情 + 关联词
 * GET /by-grade/:grade          -> getByGrade 按年级获取单词列表
 *
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const { getPool } = require('../shared/db')
const { authMiddleware } = require('../shared/auth')

router.use(authMiddleware)

// GET /lookup?word=hello&grade=7
router.get('/lookup', async (req, res) => {
  try {
    const { word, grade } = req.query
    if (!word) {
      return res.status(400).json({ code: 400, message: '缺少 word 参数', data: null })
    }
    const db = getPool()
    const conn = await db.getConnection()
    try {
      // 精确匹配
      const [words] = await conn.execute(`
        SELECT id, word, phonetic, meaning, part_of_speech,
               example_en, example_cn, grade, unit, book,
               tags, difficulty, audio_url
        FROM words
        WHERE word = ? AND is_active = 1
        LIMIT 1
      `, [word.trim()])

      if (words.length === 0) {
        // 模糊匹配
        const [fuzzy] = await conn.execute(`
          SELECT id, word, phonetic, meaning, part_of_speech,
                 example_en, example_cn, grade, unit, book, difficulty
          FROM words
          WHERE LOWER(word) LIKE ? AND is_active = 1
          LIMIT 5
        `, [`%${word.toLowerCase()}%`])
        return res.json({
          code: 200,
          message: fuzzy.length > 0 ? '找到近似匹配' : '未找到匹配单词',
          data: { exact_match: null, fuzzy_matches: fuzzy.length > 0 ? fuzzy : null }
        })
      }

      // 获取用户进度
      const [memory] = await conn.execute(`
        SELECT mastery_score, memory_level, ease_factor, interval,
               streak, total_reviews, correct_count, wrong_count,
               next_review, last_review
        FROM user_word_memories
        WHERE word_id = ? AND user_id = ?
      `, [words[0].id, req.openid])

      const wordData = { ...words[0], tags: words[0].tags ? JSON.parse(words[0].tags) : [] }
      return res.json({
        code: 200,
        message: '查询成功',
        data: { word: wordData, user_progress: memory.length > 0 ? memory[0] : null }
      })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ word_lookup:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

// GET /detail/:wordId
router.get('/detail/:wordId', async (req, res) => {
  try {
    const wordId = req.params.wordId
    if (!wordId) {
      return res.status(400).json({ code: 400, message: '缺少 wordId 参数', data: null })
    }
    const db = getPool()
    const conn = await db.getConnection()
    try {
      // 获取单词基本信息
      const [words] = await conn.execute(`
        SELECT id, word, phonetic, meaning, part_of_speech,
               example_en, example_cn, grade, unit, book,
               tags, difficulty, audio_url
        FROM words WHERE id = ? AND is_active = 1
      `, [wordId])

      if (words.length === 0) {
        return res.status(404).json({ code: 404, message: '单词不存在', data: null })
      }
      const word = { ...words[0], tags: words[0].tags ? JSON.parse(words[0].tags) : [] }

      // 用户进度
      const [memories] = await conn.execute(`
        SELECT mastery_score, memory_level, total_reviews, streak,
               correct_count, wrong_count, next_review
        FROM user_word_memories
        WHERE word_id = ? AND user_id = ?
      `, [wordId, req.openid])

      // 同年级关联词
      const [relatedWords] = await conn.execute(`
        SELECT id, word, phonetic, meaning, part_of_speech
        FROM words
        WHERE grade = ? AND is_active = 1 AND id != ?
        ORDER BY ABS(id - ?)
        LIMIT 6
      `, [word.grade, wordId, wordId])

      return res.json({
        code: 200,
        message: '获取成功',
        data: {
          word: word,
          user_progress: memories.length > 0 ? memories[0] : null,
          related_words: relatedWords
        }
      })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ word_lookup detail:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

// GET /by-grade/:grade
router.get('/by-grade/:grade', async (req, res) => {
  try {
    const grade = req.params.grade
    if (!grade) {
      return res.status(400).json({ code: 400, message: '缺少 grade 参数', data: null })
    }
    const db = getPool()
    const [words] = await db.execute(`
      SELECT id, word, phonetic, meaning, part_of_speech, unit, difficulty
      FROM words
      WHERE grade = ? AND is_active = 1
      ORDER BY unit, id
    `, [grade])
    res.json({ code: 200, message: '获取成功', data: words })
  } catch (err) {
    console.error('❌ word_lookup by-grade:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

module.exports = router
