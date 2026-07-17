/**
 * routes/word_sets.js — 单词集管理路由
 * 
 * 从云函数 word_sets/index.js 改造而来
 * 
 * 改造要点：
 * 1. exports.main(action switch) → Express Router (RESTful)
 * 2. cloud.getWXContext().OPENID → req.openid (authMiddleware)
 * 3. 本地 getPool() → shared/db.js 统一连接池
 * 4. 返回格式统一 { code, message, data }
 * 5. 核心业务逻辑（SQL查询）零改动 ✅
 * 
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const { getPool } = require('../shared/db')
const { authMiddleware } = require('../shared/auth')

// 所有单词集接口都需要认证
router.use(authMiddleware)

/**
 * GET /word_sets — 获取单词集列表
 * 对应云函数 action: list
 */
router.get('/', async (req, res, next) => {
  const openid = req.openid
  const conn = await getPool().getConnection()
  try {
    const [sets] = await conn.execute(`
      SELECT ws.id, ws.name, ws.description, ws.color, ws.created_at,
             COUNT(wsi.word_id) as word_count
      FROM word_sets ws
      LEFT JOIN word_set_items wsi ON ws.id = wsi.word_set_id
      WHERE ws.owner_openid = ?
      GROUP BY ws.id
      ORDER BY ws.created_at DESC
    `, [openid])

    const data = sets.map(set => ({
      ...set,
      progress: Math.round((set.word_count / 771) * 100) || 0
    }))

    res.json({ code: 200, message: '获取成功', data })
  } finally {
    conn.release()
  }
})

/**
 * POST /word_sets — 创建单词集
 * 对应云函数 action: create
 */
router.post('/', async (req, res, next) => {
  const openid = req.openid
  const { name, description, color } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({ code: 400, message: '单词集名称不能为空', data: null })
  }

  const conn = await getPool().getConnection()
  try {
    // 注意：mysql2 execute() 不支持 null 参数，用 query() 替代
    const [result] = await conn.query(`
      INSERT INTO word_sets (name, description, color, owner_openid, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [name.trim(), description || '', color || '#667eea', openid])

    const [sets] = await conn.query(`
      SELECT id, name, description, color, created_at
      FROM word_sets WHERE id = ?
    `, [result.insertId])

    res.status(201).json({ code: 201, message: '创建成功', data: sets[0] })
  } catch (err) {
    console.error('❌ create word_set:', err.message)
    res.status(500).json({ code: 500, message: '创建失败: ' + err.message, data: null })
  } finally {
    conn.release()
  }
})

/**
 * GET /word_sets/:set_id — 获取单词集详情
 * 对应云函数 action: getDetail
 */
router.get('/:set_id', async (req, res, next) => {
  const openid = req.openid
  const setId = req.params.set_id

  const conn = await getPool().getConnection()
  try {
    const [sets] = await conn.query(`
      SELECT id, name, description, color, created_at
      FROM word_sets WHERE id = ? AND owner_openid = ?
    `, [setId, openid])

    if (sets.length === 0) {
      return res.status(404).json({ code: 404, message: '单词集不存在或无权限', data: null })
    }

    const [words] = await conn.query(`
      SELECT w.id, w.word, w.phonetic, w.meaning, w.part_of_speech,
             w.difficulty, wm.mastery_score, wm.memory_level
      FROM word_set_items wsi
      JOIN words w ON wsi.word_id = w.id
      LEFT JOIN user_word_memories wm ON w.id = wm.word_id AND wm.user_openid = ?
      WHERE wsi.word_set_id = ?
      ORDER BY wsi.sort_order ASC
    `, [openid, setId])

    const learnedCount = words.filter(w => (w.mastery_score || 0) > 50).length
    const totalWords = words.length

    res.json({
      code: 200,
      message: '获取成功',
      data: {
        ...sets[0],
        words,
        stats: {
          total: totalWords,
          learned: learnedCount,
          progress: totalWords > 0 ? Math.round((learnedCount / totalWords) * 100) : 0
        }
      }
    })
  } catch (err) {
    console.error('❌ get word_set detail:', err.message)
    res.status(500).json({ code: 500, message: '获取失败: ' + err.message, data: null })
  } finally {
    conn.release()
  }
})

/**
 * PUT /word_sets/:set_id — 更新单词集
 * 对应云函数 action: update
 */
router.put('/:set_id', async (req, res, next) => {
  const openid = req.openid
  const setId = req.params.set_id
  const { name, description, color } = req.body

  const conn = await getPool().getConnection()
  try {
    // 注意：mysql2 execute() 不支持 null，用 query() + '' 替代
    const [result] = await conn.query(`
      UPDATE word_sets
      SET name = ?, description = ?, color = ?
      WHERE id = ? AND owner_openid = ?
    `, [name.trim(), description || '', color || '#667eea', setId, openid])

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '单词集不存在或无权限', data: null })
    }

    res.json({ code: 200, message: '更新成功', data: { id: parseInt(setId) } })
  } catch (err) {
    console.error('❌ update word_set:', err.message)
    res.status(500).json({ code: 500, message: '更新失败：' + err.message, data: null })
  } finally {
    conn.release()
  }
})

/**
 * DELETE /word_sets/:set_id — 删除单词集
 * 对应云函数 action: delete
 */
router.delete('/:set_id', async (req, res, next) => {
  const openid = req.openid
  const setId = req.params.set_id

  const conn = await getPool().getConnection()
  try {
    await conn.query('DELETE FROM word_set_items WHERE word_set_id = ?', [setId])

    const [result] = await conn.query(`
      DELETE FROM word_sets WHERE id = ? AND owner_openid = ?
    `, [setId, openid])

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '单词集不存在或无权限', data: null })
    }

    res.json({ code: 200, message: '删除成功', data: { id: parseInt(setId) } })
  } catch (err) {
    console.error('❌ delete word_set:', err.message)
    res.status(500).json({ code: 500, message: '删除失败：' + err.message, data: null })
  } finally {
    conn.release()
  }
})

/**
 * POST /word_sets/:set_id/words — 添加单词到单词集
 * 对应云函数 action: addWord
 */
router.post('/:set_id/words', async (req, res, next) => {
  const openid = req.openid
  const setId = req.params.set_id
  const { wordId } = req.body  // 前端传入 camelCase: wordId
  const word_id = parseInt(wordId)  // 转为 int 并赋值给 word_id

  const conn = await getPool().getConnection()
  try {
    const [sets] = await conn.query(`
      SELECT id FROM word_sets WHERE id = ? AND owner_openid = ?
    `, [setId, openid])

    if (sets.length === 0) {
      return res.status(404).json({ code: 404, message: '单词集不存在或无权限', data: null })
    }

    const [words] = await conn.query(`
      SELECT id FROM words WHERE id = ?
    `, [word_id])

    if (words.length === 0) {
      return res.status(404).json({ code: 404, message: '单词不存在于词库中', data: null })
    }

    const [result] = await conn.query(`
      INSERT IGNORE INTO word_set_items (word_set_id, word_id, notes, sort_order, added_at)
      VALUES (?, ?, NULL, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM (SELECT sort_order FROM word_set_items WHERE word_set_id = ?) AS tmp), NOW())
    `, [setId, word_id, setId])

    if (result.affectedRows === 0) {
      return res.status(400).json({ code: 400, message: '该单词已在集合中', data: null })
    }

    res.status(201).json({
      code: 201,
      message: '添加成功',
      data: { word_set_id: parseInt(setId), word_id }
    })
  } catch (err) {
    console.error('❌ add word to set:', err.message)
    res.status(500).json({ code: 500, message: '添加失败：' + err.message, data: null })
  } finally {
    conn.release()
  }
})

/**
 * DELETE /word_sets/:set_id/words/:word_id — 从单词集中移除单词
 * 对应云函数 action: removeWord
 */
router.delete('/:set_id/words/:word_id', async (req, res, next) => {
  const openid = req.openid
  const setId = req.params.set_id
  const wordId = req.params.word_id

  const conn = await getPool().getConnection()
  try {
    const [sets] = await conn.query(`
      SELECT id FROM word_sets WHERE id = ? AND owner_openid = ?
    `, [setId, openid])

    if (sets.length === 0) {
      return res.status(404).json({ code: 404, message: '单词集不存在或无权限', data: null })
    }

    const [result] = await conn.query(`
      DELETE FROM word_set_items 
      WHERE word_set_id = ? AND word_id = ?
    `, [setId, wordId])

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: '单词不在集合中', data: null })
    }

    res.json({ code: 200, message: '移除成功', data: { word_set_id: parseInt(setId), word_id: parseInt(wordId) } })
  } catch (err) {
    console.error('❌ remove word from set:', err.message)
    res.status(500).json({ code: 500, message: '移除失败：' + err.message, data: null })
  } finally {
    conn.release()
  }
})

/**
 * GET /word_sets/lookup/:word — 查词（从基础词库找词并附学习记录）
 * 对应云函数 action: lookup
 */
router.get('/lookup/:word', async (req, res, next) => {
  const openid = req.openid
  const wordText = req.params.word

  const conn = await getPool().getConnection()
  try {
    const [words] = await conn.query(`
      SELECT id, word, phonetic, meaning, part_of_speech, 
             example_en, example_cn, grade, unit, book, difficulty
      FROM words 
      WHERE word = ? AND is_active = 1
      LIMIT 1
    `, [wordText])

    if (words.length === 0) {
      return res.status(404).json({ code: 404, message: '未在词库中找到该单词', data: null })
    }

    const [memories] = await conn.query(`
      SELECT mastery_score, memory_level, streak, total_reviews, correct_count, wrong_count
      FROM user_word_memories
      WHERE word_id = ? AND user_openid = ?
    `, [words[0].id, openid])

    res.json({
      code: 200,
      message: '查询成功',
      data: {
        ...words[0],
        user_progress: memories.length > 0 ? memories[0] : null
      }
    })
  } catch (err) {
    console.error('❌ lookup word:', err.message)
    res.status(500).json({ code: 500, message: '查词失败：' + err.message, data: null })
  } finally {
    conn.release()
  }
})

module.exports = router