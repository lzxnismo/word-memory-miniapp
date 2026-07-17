// cloudfunctions/word_sets/index.js - 直连 MySQL 版本
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
  const { action, set_id, word_id, word_data, name, description, color, words } = event
  
  try {
    // 获取 OpenID（用于区分用户数据）
    const { OPENID } = cloud.getWXContext()
    
    switch (action) {
      case 'create':
        return await createWordSet(name, description, color, OPENID)
      
      case 'list':
        return await listWordSets(OPENID)
      
      case 'getDetail':
        return await getWordSetDetail(set_id, OPENID)
      
      case 'update':
        return await updateWordSet(set_id, name, description, color, OPENID)
      
      case 'delete':
        return await deleteWordSet(set_id, OPENID)
      
      case 'addWord':
        return await addWordToSet(set_id, word_id, OPENID)
      
      case 'removeWord':
        return await removeWordFromSet(set_id, word_id, OPENID)
      
      case 'lookup':
        return await lookupWord(word_id || word_data?.word, OPENID)
      
      default:
        return { code: 400, message: '未知 action', data: null }
    }
  } catch (err) {
    console.error('Error in word_sets:', err)
    return { code: 500, message: err.message || '服务器错误', data: null }
  }
}

/**
 * 创建单词集
 */
async function createWordSet(name, description, color, openid) {
  const conn = await getPool().getConnection()
  
  try {
    const [result] = await conn.execute(`
      INSERT INTO word_sets (name, description, color, owner_openid, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [name.trim(), description || null, color || '#667eea', openid])
    
    // 返回新创建的单词集详情
    const [sets] = await conn.execute(`
      SELECT id, name, description, color, created_at 
      FROM word_sets WHERE id = ?
    `, [result.insertId])
    
    return {
      code: 201,
      message: '创建成功',
      data: sets[0]
    }
  } finally {
    conn.release()
  }
}

/**
 * 获取单词集列表
 */
async function listWordSets(openid) {
  const conn = await getPool().getConnection()
  
  try {
    const [sets] = await conn.execute(`
      SELECT ws.id, ws.name, ws.description, ws.color, ws.created_at,
             COUNT(wsw.word_id) as word_count
      FROM word_sets ws
      LEFT JOIN word_set_words wsw ON ws.id = wsw.word_set_id
      WHERE ws.owner_openid = ?
      GROUP BY ws.id
      ORDER BY ws.created_at DESC
    `, [openid])
    
    return {
      code: 200,
      message: '获取成功',
      data: sets.map(set => ({
        ...set,
        progress: Math.round((set.word_count / 771) * 100) || 0 // 基于总词数估算
      }))
    }
  } finally {
    conn.release()
  }
}

/**
 * 获取单词集详情（含进度统计）
 */
async function getWordSetDetail(setId, openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 获取单词集基本信息
    const [sets] = await conn.execute(`
      SELECT id, name, description, color, created_at
      FROM word_sets WHERE id = ? AND owner_openid = ?
    `, [setId, openid])
    
    if (sets.length === 0) {
      return { code: 404, message: '单词集不存在或无权限', data: null }
    }
    
    // 获取所属单词
    const [words] = await conn.execute(`
      SELECT w.id, w.word, w.phonetic, w.meaning, w.part_of_speech,
             w.difficulty, wm.mastery_score, wm.memory_level
      FROM word_set_words wsw
      JOIN words w ON wsw.word_id = w.id
      LEFT JOIN user_word_memories wmw ON w.id = wmw.word_id AND wmw.user_openid = ?
      WHERE wsw.word_set_id = ?
      ORDER BY wsw.order_index ASC
    `, [openid, setId])
    
    // 计算进度
    const learnedCount = words.filter(w => (w.mastery_score || 0) > 50).length
    const totalWords = words.length
    
    return {
      code: 200,
      message: '获取成功',
      data: {
        ...sets[0],
        words: words,
        stats: {
          total: totalWords,
          learned: learnedCount,
          progress: totalWords > 0 ? Math.round((learnedCount / totalWords) * 100) : 0
        }
      }
    }
  } finally {
    conn.release()
  }
}

/**
 * 更新单词集
 */
async function updateWordSet(setId, name, description, color, openid) {
  const conn = await getPool().getConnection()
  
  try {
    const [result] = await conn.execute(`
      UPDATE word_sets
      SET name = ?, description = ?, color = ?
      WHERE id = ? AND owner_openid = ?
    `, [name.trim(), description || null, color || '#667eea', setId, openid])
    
    if (result.affectedRows === 0) {
      return { code: 404, message: '单词集不存在或无权限', data: null }
    }
    
    return {
      code: 200,
      message: '更新成功',
      data: { id: setId }
    }
  } finally {
    conn.release()
  }
}

/**
 * 删除单词集
 */
async function deleteWordSet(setId, openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 先删除关联关系，再删除单词集
    await conn.execute('DELETE FROM word_set_words WHERE word_set_id = ?', [setId])
    
    const [result] = await conn.execute(`
      DELETE FROM word_sets WHERE id = ? AND owner_openid = ?
    `, [setId, openid])
    
    if (result.affectedRows === 0) {
      return { code: 404, message: '单词集不存在或无权限', data: null }
    }
    
    return {
      code: 200,
      message: '删除成功',
      data: { id: setId }
    }
  } finally {
    conn.release()
  }
}

/**
 * 添加单词到单词集
 */
async function addWordToSet(setId, wordId, openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 检查单词集是否存在且属于当前用户
    const [sets] = await conn.execute(`
      SELECT id FROM word_sets WHERE id = ? AND owner_openid = ?
    `, [setId, openid])
    
    if (sets.length === 0) {
      return { code: 404, message: '单词集不存在或无权限', data: null }
    }
    
    // 检查单词是否存在于基础词库中
    const [words] = await conn.execute(`
      SELECT id FROM words WHERE id = ?
    `, [wordId])
    
    if (words.length === 0) {
      return { code: 404, message: '单词不存在于词库中', data: null }
    }
    
    // 插入关联关系
    const [result] = await conn.execute(`
      INSERT IGNORE INTO word_set_words (word_set_id, word_id, order_index, added_at)
      VALUES (?, ?, (SELECT COALESCE(MAX(order_index), 0) + 1 FROM word_set_words WHERE word_set_id = ?), NOW())
    `, [setId, wordId, setId])
    
    if (result.affectedRows === 0) {
      return { code: 400, message: '该单词已在集合中', data: null }
    }
    
    return {
      code: 201,
      message: '添加成功',
      data: { word_set_id: setId, word_id: wordId }
    }
  } finally {
    conn.release()
  }
}

/**
 * 从单词集中移除单词
 */
async function removeWordFromSet(setId, wordId, openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 验证权限
    const [sets] = await conn.execute(`
      SELECT id FROM word_sets WHERE id = ? AND owner_openid = ?
    `, [setId, openid])
    
    if (sets.length === 0) {
      return { code: 404, message: '单词集不存在或无权限', data: null }
    }
    
    const [result] = await conn.execute(`
      DELETE FROM word_set_words 
      WHERE word_set_id = ? AND word_id = ?
    `, [setId, wordId])
    
    if (result.affectedRows === 0) {
      return { code: 404, message: '单词不在集合中', data: null }
    }
    
    return {
      code: 200,
      message: '移除成功',
      data: { word_set_id: setId, word_id: wordId }
    }
  } finally {
    conn.release()
  }
}

/**
 * 单词查缺补漏（从基础词库找词）
 */
async function lookupWord(wordText, openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 在基础词库中查找
    const [words] = await conn.execute(`
      SELECT id, word, phonetic, meaning, part_of_speech, 
             example_en, example_cn, grade, unit, book, difficulty
      FROM words 
      WHERE word = ? AND is_active = 1
      LIMIT 1
    `, [wordText])
    
    if (words.length === 0) {
      return {
        code: 404,
        message: '未在词库中找到该单词',
        data: null
      }
    }
    
    // 获取用户学习记录（如果有）
    const [memories] = await conn.execute(`
      SELECT mastery_score, memory_level, streak, dictation_count
      FROM user_word_memories
      WHERE word_id = ? AND user_openid = ?
    `, [words[0].id, openid])
    
    return {
      code: 200,
      message: '查询成功',
      data: {
        ...words[0],
        user_progress: memories.length > 0 ? memories[0] : null
      }
    }
  } finally {
    conn.release()
  }
}
