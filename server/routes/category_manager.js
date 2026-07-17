/**
 * routes/category_manager.js — 分类管理
 *
 * 从云函数 category_manager 迁移，4 个 action 转为 RESTful 端点
 * GET  /            -> list 获取分类列表（含单词计数）
 * POST  /           -> create 创建新分类
 * PUT  /:id         -> rename 重命名分类
 * DELETE /:id       -> delete 删除分类
 *
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const { getPool } = require('../shared/db')
const { authMiddleware } = require('../shared/auth')

router.use(authMiddleware)

// GET /
router.get('/', async (req, res) => {
  try {
    const db = getPool()
    const conn = await db.getConnection()
    try {
      // 用户自定义分类
      const [customCategories] = await conn.execute(`
        SELECT c.id, c.name, c.created_at,
               (SELECT COUNT(*) FROM words WHERE book = c.name AND is_active = 1) as word_count
        FROM categories c
        WHERE c.owner_openid IS NULL OR c.owner_openid = ?
        ORDER BY c.id ASC
      `, [req.openid])

      // 基础年级分类
      const [gradeCategories] = await conn.execute(`
        SELECT 
          CASE 
            WHEN grade = 7 THEN '七年级'
            WHEN grade = 8 THEN '八年级'
            WHEN grade = 9 THEN '九年级'
            ELSE '其他'
          END as name,
          COUNT(*) as word_count
        FROM words
        GROUP BY grade
        ORDER BY grade ASC
      `)

      // 合并分类
      const existingNames = customCategories.map(c => c.name)
      const mergedCategories = [
        ...gradeCategories.filter(g => !existingNames.includes(g.name)).map(g => ({
          id: -g.word_count,
          name: g.name,
          word_count: g.word_count,
          is_builtin: true,
          created_at: null
        })),
        ...customCategories.map(c => ({ ...c, is_builtin: false }))
      ]

      res.json({ code: 200, message: '获取成功', data: mergedCategories })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ category_manager list:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

// POST /
router.post('/', async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ code: 400, message: '分类名称不能为空', data: null })
    }
    const db = getPool()
    const conn = await db.getConnection()
    try {
      // 检查是否已存在
      const [existing] = await conn.execute(`
        SELECT id FROM categories WHERE name = ? AND (owner_openid IS NULL OR owner_openid = ?)
      `, [name.trim(), req.openid])
      if (existing.length > 0) {
        return res.status(400).json({ code: 400, message: '该分类名称已存在', data: null })
      }

      const [result] = await conn.execute(`
        INSERT INTO categories (name, owner_openid, created_at)
        VALUES (?, ?, NOW())
      `, [name.trim(), req.openid])

      res.status(201).json({
        code: 201,
        message: '创建成功',
        data: { id: result.insertId, name: name.trim() }
      })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ category_manager create:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

// PUT /:id
router.put('/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id)
    const { name } = req.body
    if (!categoryId || !name || !name.trim()) {
      return res.status(400).json({ code: 400, message: '缺少参数', data: null })
    }

    const db = getPool()
    const conn = await db.getConnection()
    try {
      // 检查同名
      const [existing] = await conn.execute(`
        SELECT id FROM categories WHERE name = ? AND id != ? AND (owner_openid IS NULL OR owner_openid = ?)
      `, [name.trim(), categoryId, req.openid])
      if (existing.length > 0) {
        return res.status(400).json({ code: 400, message: '该分类名称已存在', data: null })
      }

      // 更新
      const [result] = await conn.execute(`
        UPDATE categories SET name = ? WHERE id = ? AND (owner_openid IS NULL OR owner_openid = ?)
      `, [name.trim(), categoryId, req.openid])
      if (result.affectedRows === 0) {
        return res.status(404).json({ code: 404, message: '分类不存在或无权限修改', data: null })
      }

      res.json({ code: 200, message: '重命名成功', data: { id: categoryId, name: name.trim() } })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ category_manager rename:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id)
    if (!categoryId) {
      return res.status(400).json({ code: 400, message: '缺少分类 ID', data: null })
    }

    const db = getPool()
    const conn = await db.getConnection()
    try {
      const [result] = await conn.execute(`
        DELETE FROM categories WHERE id = ? AND owner_openid = ?
      `, [categoryId, req.openid])
      if (result.affectedRows === 0) {
        return res.status(404).json({ code: 404, message: '分类不存在或无权限', data: null })
      }

      res.json({ code: 200, message: '删除成功', data: { id: categoryId } })
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('❌ category_manager delete:', err)
    res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null })
  }
})

module.exports = router
