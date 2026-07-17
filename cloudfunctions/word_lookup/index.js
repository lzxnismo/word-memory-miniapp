// cloudfunctions/word_lookup/index.js - 直连 MySQL 版本
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const mysql = require('mysql2/promise')

// MySQL 配置（腾讯云 CynosDB）
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

let pool = null
function getPool() {
  if (!pool) pool = mysql.createPool(MYSQL_CONFIG)
  return pool
}

/**
 * 主入口函数
 */
exports.main = async (event, context) => {
  const { action, word, word_id, grade } = event
  
  try {
    const { OPENID } = cloud.getWXContext()
    
    switch (action) {
      case 'lookup':
        return await lookupWord(word, OPENID)
      case 'getOnlineDetail':
        return await getOnlineDetail(word_id, OPENID)
      case 'getByGrade':
        return await getByGrade(grade)
      default:
        return { code: 400, message: '未知 action', data: null }
    }
  } catch (err) {
    console.error('Error in word_lookup:', err)
    return { code: 500, message: err.message || '服务器错误', data: null }
  }
}

/**
 * 查词：在词库中查找单词及其用户进度
 */
async function lookupWord(wordText, openid) {
  if (!wordText) {
    return { code: 400, message: '缺少 word 参数', data: null }
  }
  
  const conn = await getPool().getConnection()
  
  try {
    // 精确匹配
    const [words] = await conn.execute(`
      SELECT id, word, phonetic, meaning, part_of_speech,
             example_en, example_cn, grade, unit, book,
             tags, difficulty, audio_url
      FROM words
      WHERE word = ? AND is_active = 1
      LIMIT 1
    `, [wordText.trim()])
    
    if (words.length === 0) {
      // 模糊匹配（大小写不敏感）
      const [fuzzy] = await conn.execute(`
        SELECT id, word, phonetic, meaning, part_of_speech, 
               example_en, example_cn, grade, unit, book, difficulty
        FROM words
        WHERE LOWER(word) LIKE ? AND is_active = 1
        LIMIT 5
      `, [`%${wordText.toLowerCase()}%`])
      
      return {
        code: 200,
        message: fuzzy.length > 0 ? '找到近似匹配' : '未找到匹配单词',
        data: {
          exact_match: null,
          fuzzy_matches: fuzzy.length > 0 ? fuzzy : null
        }
      }
    }
    
    // 获取用户对该词的学习记录
    const [memory] = await conn.execute(`
      SELECT mastery_score, memory_level, ease_factor, interval,
             streak, total_reviews, correct_count, wrong_count,
             next_review, last_review
      FROM user_word_memories
      WHERE word_id = ? AND user_openid = ?
    `, [words[0].id, openid])
    
    return {
      code: 200,
      message: '查询成功',
      data: {
        word: {
          ...words[0],
          tags: words[0].tags ? JSON.parse(words[0].tags) : []
        },
        user_progress: memory.length > 0 ? memory[0] : null
      }
    }
  } finally {
    conn.release()
  }
}

/**
 * 获取单词详情（含同年级关联词）
 */
async function getOnlineDetail(wordId, openid) {
  if (!wordId) {
    return { code: 400, message: '缺少 word_id 参数', data: null }
  }
  
  const conn = await getPool().getConnection()
  
  try {
    // 获取单词基本信息
    const [words] = await conn.execute(`
      SELECT id, word, phonetic, meaning, part_of_speech,
             example_en, example_cn, grade, unit, book,
             tags, difficulty, audio_url
      FROM words WHERE id = ? AND is_active = 1
    `, [wordId])
    
    if (words.length === 0) {
      return { code: 404, message: '单词不存在', data: null }
    }
    
    const word = words[0]
    
    // 获取该单词的用户进度
    const [memories] = await conn.execute(`
      SELECT mastery_score, memory_level, total_reviews, streak,
             correct_count, wrong_count, next_review
      FROM user_word_memories
      WHERE word_id = ? AND user_openid = ?
    `, [wordId, openid])
    
    // 获取同年级的关联词（前3后3）
    const [relatedWords] = await conn.execute(`
      SELECT id, word, phonetic, meaning, part_of_speech
      FROM words
      WHERE grade = ? AND is_active = 1 AND id != ?
      ORDER BY ABS(id - ?)
      LIMIT 6
    `, [word.grade, wordId, wordId])
    
    return {
      code: 200,
      message: '获取成功',
      data: {
        word: {
          ...word,
          tags: word.tags ? JSON.parse(word.tags) : []
        },
        user_progress: memories.length > 0 ? memories[0] : null,
        related_words: relatedWords
      }
    }
  } finally {
    conn.release()
  }
}

/**
 * 按年级获取单词列表
 */
async function getByGrade(grade) {
  if (!grade) {
    return { code: 400, message: '缺少 grade 参数', data: null }
  }
  
  const conn = await getPool().getConnection()
  
  try {
    const [words] = await conn.execute(`
      SELECT id, word, phonetic, meaning, part_of_speech, unit, difficulty
      FROM words
      WHERE grade = ? AND is_active = 1
      ORDER BY unit, id
    `, [grade])
    
    return {
      code: 200,
      message: '获取成功',
      data: words
    }
  } finally {
    conn.release()
  }
}