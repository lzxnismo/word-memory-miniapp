/**
 * word_query 云函数
 * 单词查询/搜索/列表 - 核心数据库操作
 * 
 * 支持的操作：
 * - search: 关键词搜索单词
 * - getById: 根据 ID 获取单词详情
 * - getAll: 获取单词列表（分页）
 * - getReviewQueue: 获取待复习单词队列
 * - getNewWords: 获取新词（未学过的）
 * 
 * 数据源兼容：MySQL（腾讯云 CynosDB）| 微信云开发数据库 | Mock 数据
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ==================== MySQL 连接（可选） ====================
let mysql
let pool = null

try {
  mysql = require('mysql2/promise')
  console.log('✅ mysql2 模块加载成功')
} catch (e) {
  console.warn('⚠️ mysql2 未安装，将使用云开发数据库或 Mock 数据:', e.message)
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com',
      port: process.env.MYSQL_PORT || 27780,
      user: process.env.MYSQL_USER || 'word_memory_app',
      password: process.env.MYSQL_PASSWORD || 'Root_123',
      database: process.env.MYSQL_DATABASE || 'mytx-d7gw0vhq4414988b5',
      waitForConnections: true,
      connectionLimit: 2,
      queueLimit: 0,
      connectTimeout: 8000,
      timezone: '+08:00'
    })
  }
  return pool
}

// ==================== 获取用户 OpenID ====================
function getOpenId(event) {
  try {
    const wxContext = cloud.getWXContext()
    if (wxContext && wxContext.OPENID) {
      return wxContext.OPENID
    }
  } catch (e) {
    console.warn('⚠️ 获取 OpenID 失败:', e.message)
  }
  return event.userId || 'default'
}

// ==================== 模拟单词数据（开发调试用） ====================
const MOCK_WORDS = [
  { id: 1, word: 'hello', phonetic: '/həˈləʊ/', meaning: '你好；问候', part_of_speech: 'interjection', grade: '初中', unit: 'Unit 1', tags: ['基础','高频'], userStatus: 'new' },
  { id: 2, word: 'world', phonetic: '/wɜːld/', meaning: '世界；地球', part_of_speech: 'noun', grade: '初中', unit: 'Unit 1', tags: ['基础'], userStatus: 'new' },
  { id: 3, word: 'learning', phonetic: '/ˈlɜːnɪŋ/', meaning: '学习；学会', part_of_speech: 'verb', grade: '高中', unit: 'Unit 3', tags: ['教育'], userStatus: 'learning' },
  { id: 4, word: 'memory', phonetic: '/ˈmeməri/', meaning: '记忆；记忆力', part_of_speech: 'noun', grade: '高中', unit: 'Unit 4', tags: ['心理'], userStatus: 'mastered' },
  { id: 5, word: 'hall', phonetic: '/hɔːl/', meaning: '大厅；礼堂', part_of_speech: 'noun', grade: '初中', unit: 'Unit 3', tags: ['建筑'], userStatus: 'new' },
  { id: 6, word: 'dining hall', phonetic: '/ˌdaɪnɪŋ hɔːl/', meaning: '餐厅；食堂', part_of_speech: 'noun phrase', grade: '小学', unit: 'Unit 3', tags: ['场所'], userStatus: 'new' },
  { id: 7, word: 'building', phonetic: '/ˈbɪldɪŋ/', meaning: '建筑物；大楼', part_of_speech: 'noun', grade: '初中', unit: 'Unit 3', tags: ['建筑'], userStatus: 'learning' },
  { id: 8, word: 'across', phonetic: '/əˈkrɒs/', meaning: '穿过；横过', part_of_speech: 'preposition', grade: '初中', unit: 'Unit 3', tags: ['方位'], userStatus: 'new' },
  { id: 9, word: 'center', phonetic: '/ˈsentə(r)/', meaning: '中心；中央', part_of_speech: 'noun', grade: '初中', unit: 'Unit 3', tags: ['方位'], userStatus: 'new' },
  { id: 10, word: 'gym', phonetic: '/dʒɪm/', meaning: '体育馆；健身房', part_of_speech: 'noun', grade: '初中', unit: 'Unit 3', tags: ['运动'], userStatus: 'new' },
]

// ==================== 云开发数据库（微信原生 NoSQL） ====================
const db = cloud.database()
const _ = db.command

// ==================== 主函数 ====================
exports.main = async (event, context) => {
  console.log('📝 word_query 调用参数:', JSON.stringify(event))
  
  const { action } = event
  const openId = getOpenId(event)

  // === DEBUG MODE: 模拟数据测试 ===
  if (process.env.DEBUG_MODE === 'true') {
    console.log('✅ 已启用 DEBUG 模式，返回 Mock 数据')
    switch (action) {
      case 'getAll':
        return { code: 200, data: MOCK_WORDS, total: MOCK_WORDS.length }
      case 'search':
        const keyword = (event.keyword || '').toLowerCase()
        const filtered = MOCK_WORDS.filter(w => 
          w.word.toLowerCase().includes(keyword) || 
          w.meaning.includes(keyword)
        )
        return { code: 200, data: filtered, total: filtered.length }
      default:
        return { code: 200, data: [] }
    }
  }

  // === 诊断接口：不需要数据库 ===
  if (action === 'ping') {
    return { 
      code: 200, 
      msg: 'pong', 
      data: { 
        time: new Date().toISOString(),
        openId: openId,
        mysqlAvailable: !!mysql,
        env: process.env.MYSQL_HOST ? 'custom' : 'default'
      }
    }
  }

  try {
    // === 优先使用 MySQL（如果可用） ===
    if (mysql) {
      console.log('✅ 使用 MySQL 数据源')
      
      // 诊断接口：测试 MySQL 连接
      if (action === 'testConnection') {
        const conn = getPool()
        const [rows] = await conn.execute('SELECT COUNT(*) as total FROM words WHERE is_active = 1')
        return { 
          code: 200, 
          msg: 'MySQL 连接成功',
          data: { word_count: rows[0].total }
        }
      }
      
      const conn = getPool()
      
      switch (action) {
        case 'search':
          return await handleSearch(conn, event)
        case 'getById':
          return await handleGetById(conn, event)
        case 'getAll':
          return await handleGetAll(conn, event)
        case 'getReviewQueue':
          return await handleGetReviewQueue(conn, openId, event)
        case 'getNewWords':
          return await handleGetNewWords(conn, openId, event)
        default:
          return { code: 400, msg: `未知的 action: ${action}` }
      }
    }

    // === 降级：使用云开发数据库（微信原生 NoSQL） ===
    console.log('⚠️ 使用云开发数据库降级方案')
    
    switch (action) {
      case 'search':
        return await handleSearchCloud(event)
      case 'getById':
        return await handleGetByIdCloud(event)
      case 'getAll':
        return await handleGetAllCloud(event)
      case 'getReviewQueue':
        return await handleGetReviewQueueCloud(openId, event)
      case 'getNewWords':
        return await handleGetNewWordsCloud(openId, event)
      case 'testConnection':
        return { code: 200, msg: '云开发数据库可用', data: { source: 'cloud-db' } }
      default:
        return { code: 400, msg: `未知的 action: ${action}` }
    }
  } catch (error) {
    console.error('❌ word_query 错误:', error)
    return {
      code: 500,
      msg: '服务器内部错误',
      error: error.message,
      errorType: error.constructor.name,
      errno: error.errno || null,
      stack: error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : null
    }
  }
}

// ==================== MySQL 查询实现 ====================

async function handleSearch(conn, event) {
  const { keyword, limit = 10 } = event
  if (!keyword || !keyword.trim()) return { code: 200, data: [] }
  const [rows] = await conn.execute(
    `SELECT id, word, phonetic, meaning, part_of_speech, 
            example_en, example_cn, grade, unit, book, tags,
            difficulty, audio_url, is_active
     FROM words 
     WHERE word LIKE ? AND is_active = 1
     ORDER BY word ASC`,
    [`%${keyword}%`]
  )
  // 手动截断结果
  const limitedRows = rows.slice(0, parseInt(limit))
  return { code: 200, data: limitedRows }
}

async function handleGetById(conn, event) {
  const { wordId } = event
  if (!wordId) return { code: 400, msg: '缺少 wordId 参数' }
  const [rows] = await conn.execute(
    `SELECT id, word, phonetic, meaning, part_of_speech,
            example_en, example_cn, grade, unit, book, tags,
            difficulty, audio_url, is_active, created_at, updated_at
     FROM words WHERE id = ?`,
    [wordId]
  )
  if (rows.length === 0) return { code: 404, msg: '单词不存在' }
  return { code: 200, data: rows[0] }
}

async function handleGetAll(conn, event) {
  const { limit = 50, offset = 0, grade, book, userId } = event
  let sql = `SELECT w.id, w.word, w.phonetic, w.meaning, w.part_of_speech,
                    w.example_en, w.example_cn, w.grade, w.unit, w.tags,
                    w.difficulty, w.audio_url
             FROM words w WHERE w.is_active = 1`
  const params = []
  
  // 构建 WHERE 条件
  if (grade) { sql += ' AND w.grade = ?'; params.push(grade) }
  if (book) { sql += ' AND w.book = ?'; params.push(book) }
  
  // LIMIT/OFFSET 需要作为数字（不能是占位符）
  const safeLimit = Math.max(1, Math.min(parseInt(limit), 100))
  const safeOffset = Math.max(0, parseInt(offset))
  sql += ` ORDER BY w.id ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`
  
  const [rows] = await conn.execute(sql, params)
  
  // 如果传了 userId，查询每个单词的用户记忆状态
  if (userId && rows.length > 0) {
    const wordIds = rows.map(r => r.id)
    if (wordIds.length > 0) {
      // 使用 string interpolation 构建 IN 子句（只接受纯数字 ID）
      const safeWordIds = wordIds.map(id => String(parseInt(id)).replace(/[^0-9]/g, ''))
      const placeholders = safeWordIds.map(() => '?').join(',')
      const [memories] = await conn.execute(
        `SELECT word_id, memory_level, mastery_score FROM user_word_memories 
         WHERE user_id = ? AND word_id IN (${placeholders})`,
        [userId, ...safeWordIds]
      )
      
      const memoryMap = {}
      memories.forEach(m => { memoryMap[m.word_id] = m })
      
      rows.forEach(word => {
        const mem = memoryMap[word.id]
        if (mem) {
          word.userStatus = mem.mastery_score >= 80 ? 'mastered' : 'learning'
        } else {
          word.userStatus = 'new'
        }
      })
    }
  }
  
  // 获取总数
  let countSql = 'SELECT COUNT(*) as total FROM words WHERE is_active = 1'
  const countParams = []
  if (grade) { countSql += ' AND grade = ?'; countParams.push(grade) }
  if (book) { countSql += ' AND book = ?'; countParams.push(book) }
  
  const [countRows] = await conn.execute(countSql, countParams)
  
  return { code: 200, data: rows, total: countRows[0].total }
}

async function handleGetReviewQueue(conn, openId, event) {
  const { limit = 50 } = event
  const safeLimit = Math.max(1, Math.min(parseInt(limit), 100))
  
  const [rows] = await conn.execute(
    `SELECT w.id, w.word, w.phonetic, w.meaning, w.part_of_speech,
            w.example_en, w.example_cn, w.grade, w.unit, w.tags,
            u.memory_level, u.ease_factor, u.interval, u.repetitions,
            u.next_review, u.last_review, u.total_reviews,
            u.correct_count, u.wrong_count, u.streak, u.mastery_score
     FROM user_word_memories u
     JOIN words w ON u.word_id = w.id
     WHERE u.user_id = ? AND u.review_status = 'active' AND u.next_review <= NOW()
     ORDER BY u.next_review ASC LIMIT ?`,
    [openId, safeLimit]
  )
  return { code: 200, data: rows }
}

async function handleGetNewWords(conn, openId, event) {
  const { limit = 30, grade, book } = event
  let sql = `SELECT w.id, w.word, w.phonetic, w.meaning, w.part_of_speech,
                    w.example_en, w.example_cn, w.grade, w.unit, w.tags,
                    w.difficulty, w.audio_url
             FROM words w
             WHERE w.is_active = 1 
               AND w.id NOT IN (
                 SELECT word_id FROM user_word_memories WHERE user_id = ?
               )`
  const params = [openId]
  
  if (grade) { sql += ' AND w.grade = ?'; params.push(grade) }
  if (book) { sql += ' AND w.book = ?'; params.push(book) }
  
  const safeLimit = Math.max(1, Math.min(parseInt(limit), 100))
  sql += ` ORDER BY w.id ASC LIMIT ${safeLimit}`
  
  const [rows] = await conn.execute(sql, params)
  return { code: 200, data: rows }
}

// ==================== 云开发数据库降级实现 ====================

async function handleSearchCloud(event) {
  const { keyword, limit = 10 } = event
  if (!keyword || !keyword.trim()) return { code: 200, data: [] }
  const res = await db.collection('words')
    .where({ word: db.RegExp({ regexp: keyword, options: 'i' }) })
    .limit(limit).get()
  return { code: 200, data: res.data || [] }
}

async function handleGetByIdCloud(event) {
  const { wordId } = event
  if (!wordId) return { code: 400, msg: '缺少 wordId 参数' }
  const res = await db.collection('words').doc(wordId).get()
  return { code: 200, data: res.data || null }
}

async function handleGetAllCloud(event) {
  const { limit = 50, offset = 0, userId } = event
  const query = db.collection('words').where({ is_active: true })
    .skip(offset).limit(limit).orderBy('created_at', 'desc')
  const [result, count] = await Promise.all([
    query.get(),
    db.collection('words').where({ is_active: true }).count()
  ])
  const words = result.data || []
  if (userId) {
    words.forEach(w => { w.userStatus = 'new' })
  }
  return { code: 200, data: words, total: count.total }
}

async function handleGetReviewQueueCloud(openId, event) {
  const { limit = 50 } = event
  const now = new Date()
  const res = await db.collection('user_word_memories')
    .where({ user_id: openId, review_status: 'active', next_review: _.lte(now) })
    .orderBy('next_review', 'asc').limit(limit).get()
  const wordIds = res.data.map(item => item.word_id)
  if (wordIds.length > 0) {
    const wordRes = await db.collection('words').where({ _id: _.in(wordIds) }).get()
    const memoryMap = {}
    res.data.forEach(memory => { memoryMap[memory.word_id] = memory })
    const words = wordRes.data.map(word => ({ ...word, sm2_state: memoryMap[word.id] }))
    return { code: 200, data: words }
  }
  return { code: 200, data: [] }
}

async function handleGetNewWordsCloud(openId, event) {
  const { limit = 30 } = event
  const learnedRes = await db.collection('user_word_memories')
    .where({ user_id: openId }).get()
  const learnedIds = learnedRes.data.map(item => item.word_id)
  let whereClause = {}
  if (learnedIds.length > 0) whereClause = { id: _.nin(learnedIds) }
  const res = await db.collection('words')
    .where(whereClause).orderBy('created_at', 'asc').limit(limit).get()
  return { code: 200, data: res.data || [] }
}