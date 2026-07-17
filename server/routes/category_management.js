/**
 * routes/category_management.js — 分类管理补充接口
 *
 * 从云函数 category_manager 迁移的额外接口
 * GET  /sync          -> syncCategories 同步基础分类
 * POST  :id/add-words -> addWordsToCategory 向分类添加单词
 *
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const { getPool } = require('../shared/db')
const { authMiddleware } = require('../shared/auth')

router.use(authMiddleware)

// GET /sync - 同步基础年级分类到 categories 表
router.get('/sync', async (req, res) => {
  try {
    const db = getPool()
    const conn = await db.getConnection()
    try {
      // 获取已有年级
      const [grades] = await conn.execute(`
        SELECT DISTINCT grade FROM words WHERE is_active = 1 AND grade IS NOT NULL ORDER BY grade ASC
      `)

      // 插入缺失的基础分类
      for (const g of grades) {
        const gradeNames = {
          7: '七年级', 8: '八年级', 9: '九年级',
          10: '高一', 11: '高二', 12: '高三'
        }
        const name = gradeNames[g.grade] || `Grade ${g.grade}`

        const [existing] = await conn.execute(
          'SELECT id FROM categories WHERE owner_openid IS NULL AND name = ?',
          [name]
        )

        if (existing.length === 0) {
          await conn.execute(
            'INSERT INTO categories (name, description, word_count, owner_openid, created_at) VALUES (?, ?, 0, NULL, NOW())',
            [name, `${name}英语词汇`]
          )
        }
      }

      res.json({ code: 200, message: '同步完成', data: { synced_grades: grades.map(g => g.grade) } })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ category_manager sync:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

// POST /:id/add-words - 批量将单词添加到分类（通过修改单词的 book 字段）
router.post('/:id/add-words', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id)
    const { wordIds } = req.body

    if (!categoryId || !wordIds || !Array.isArray(wordIds) || wordIds.length === 0) {
      return res.status(400).json({ code: 400, message: '参数不正确', data: null })
    }

    const db = getPool()
    const conn = await db.getConnection()
    try {
      // 获取分类名称
      const [category] = await conn.execute(
        'SELECT name FROM categories WHERE id = ? AND (owner_openid IS NULL OR owner_openid = ?)',
        [categoryId, req.openid]
      )

      if (category.length === 0) {
        return res.status(404).json({ code: 404, message: '分类不存在或无权限', data: null })
      }

      const categoryName = category[0].name

      // 批量更新单词的 book 字段
      const placeholders = wordIds.map(() => '?').join(',')
      const updateResult = await conn.execute(
        `UPDATE words SET book = ? WHERE id IN (${placeholders})`,
        [categoryName, ...wordIds]
      )

      // 更新分类单词数
      const [newCount] = await conn.execute(
        `SELECT COUNT(*) as count FROM words WHERE book = ?`,
        [categoryName]
      )

      await conn.execute(
        `UPDATE categories SET word_count = ? WHERE id = ?`,
        [newCount[0].count, categoryId]
      )

      res.json({
        code: 200,
        message: `成功添加 ${updateResult.affectedRows} 个单词到"${categoryName}"`,
        data: { updated_count: updateResult.affectedRows, new_word_count: newCount[0].count }
      })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ category_management add_words:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

module.exports = router
