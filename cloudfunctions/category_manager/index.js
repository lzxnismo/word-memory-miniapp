// cloudfunctions/category_manager/index.js - 直连 MySQL 版本
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const mysql = require('mysql2/promise')

// MySQL 数据库配置（腾讯云 CynosDB）
const MYSQL_CONFIG = {
  host: 'sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com',
  port: 27780,
  user: 'word_memory_app',
  password: 'Root_123',
  database: 'mytx-d7gw0vhq4414988b5',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}

// 创建连接池
let pool = null

function getPool() {
  if (!pool) {
    pool = mysql.createPool(MYSQL_CONFIG)
  }
  return pool
}

/**
 * 主入口函数
 */
exports.main = async (event, context) => {
  const { action, category_id, name } = event
  
  try {
    // 获取 OpenID
    const { OPENID } = cloud.getWXContext()
    
    switch (action) {
      case 'list':
        return await listCategories(OPENID)
      
      case 'create':
        return await createCategory(name, OPENID)
      
      case 'rename':
        return await renameCategory(category_id, name, OPENID)
      
      case 'delete':
        return await deleteCategory(category_id, OPENID)
      
      default:
        return { code: 400, message: '未知 action', data: null }
    }
  } catch (err) {
    console.error('Error in category_manager:', err)
    return { code: 500, message: err.message || '服务器错误', data: null }
  }
}

/**
 * 获取分类列表（含单词计数）
 */
async function listCategories(openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 获取用户自定义分类
    const [customCategories] = await conn.execute(`
      SELECT c.id, c.name, c.created_at,
             (SELECT COUNT(*) FROM words WHERE book = c.name AND is_active = 1) as word_count
      FROM categories c
      WHERE c.owner_openid IS NULL OR c.owner_openid = ?
      ORDER BY c.id ASC
    `, [openid])
    
    // 获取基础年级分类（教材内置）
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
    
    // 智能补全：将已有分类与基础分类合并
    const existingNames = customCategories.map(c => c.name)
    const mergedCategories = [
      ...gradeCategories.filter(g => !existingNames.includes(g.name)).map(g => ({
        id: -g.word_count, // 负数 ID 表示内置分类
        name: g.name,
        word_count: g.word_count,
        is_builtin: true,
        created_at: null
      })),
      ...customCategories.map(c => ({ ...c, is_builtin: false }))
    ]
    
    return {
      code: 200,
      message: '获取成功',
      data: mergedCategories
    }
  } finally {
    conn.release()
  }
}

/**
 * 创建新分类
 */
async function createCategory(name, openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 检查是否已存在同名分类
    const [existing] = await conn.execute(`
      SELECT id FROM categories WHERE name = ? AND (owner_openid IS NULL OR owner_openid = ?)
    `, [name.trim(), openid, openid])
    
    if (existing.length > 0) {
      return { code: 400, message: '该分类名称已存在', data: null }
    }
    
    const [result] = await conn.execute(`
      INSERT INTO categories (name, owner_openid, created_at)
      VALUES (?, ?, NOW())
    `, [name.trim(), openid])
    
    return {
      code: 201,
      message: '创建成功',
      data: { id: result.insertId, name: name.trim() }
    }
  } finally {
    conn.release()
  }
}

/**
 * 重命名分类
 */
async function renameCategory(categoryId, newName, openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 检查是否有同名分类
    const [existing] = await conn.execute(`
      SELECT id FROM categories WHERE name = ? AND id != ? AND (owner_openid IS NULL OR owner_openid = ?)
    `, [newName.trim(), categoryId, openid])
    
    if (existing.length > 0) {
      return { code: 400, message: '该分类名称已存在', data: null }
    }
    
    // 检查分类是否属于当前用户
    const [result] = await conn.execute(`
      UPDATE categories SET name = ? WHERE id = ? AND (owner_openid IS NULL OR owner_openid = ?)
    `, [newName.trim(), categoryId, openid])
    
    if (result.affectedRows === 0) {
      return { code: 404, message: '分类不存在或无权限修改', data: null }
    }
    
    return {
      code: 200,
      message: '重命名成功',
      data: { id: categoryId, name: newName.trim() }
    }
  } finally {
    conn.release()
  }
}

/**
 * 删除分类
 */
async function deleteCategory(categoryId, openid) {
  const conn = await getPool().getConnection()
  
  try {
    const [result] = await conn.execute(`
      DELETE FROM categories WHERE id = ? AND owner_openid = ?
    `, [categoryId, openid])
    
    if (result.affectedRows === 0) {
      return { code: 404, message: '分类不存在或无权限', data: null }
    }
    
    return {
      code: 200,
      message: '删除成功',
      data: { id: categoryId }
    }
  } finally {
    conn.release()
  }
}