/**
 * 云数据库连接器封装
 * 基于微信云开发原生 SDK，封装统一 API 调用
 */

const db = wx.cloud.database()
const _ = db.command
const eq = _.eq
const gt = _.gt
const lt = _.lt
const gte = _.gte
const lte = _.lte
const inCommand = _.in
const neq = _.neq
const exists = _.exists
const nin = _.nin

// 工具函数：获取当前用户 OpenID
function getOpenId() {
  return wx.cloud.getWXContext().OPENID
}

// ==================== 单词相关 API ====================

/**
 * 搜索单词
 * @param {string} keyword - 搜索关键词（英文或中文）
 * @param {number} limit - 返回数量限制（默认 10）
 * @returns {Array} 搜索结果数组
 */
async function searchWords(keyword, limit = 10) {
  if (!keyword || !keyword.trim()) {
    return []
  }
  
  const words = await db.collection('words').where({
    word: _.regex(keyword)
  }).limit(limit).get()
  
  return words.data || []
}

/**
 * 根据 ID 获取单个单词详情
 * @param {number} wordId - 单词 ID
 * @returns {Object} 单词详情对象
 */
async function getWordById(wordId) {
  const res = await db.collection('words').doc(wordId).get()
  return res.data || null
}

/**
 * 获取所有单词列表（用于构建词库）
 * @param {number} limit - 每页数量
 * @param {number} offset - 偏移量
 * @returns {Object} 包含数据数组和总数的结果
 */
async function getAllWords(limit = 100, offset = 0) {
  const query = db.collection('words')
    .where({ is_active: true })
    .skip(offset)
    .limit(limit)
    .orderBy('created_at', 'desc')
  
  const [result, count] = await Promise.all([
    query.get(),
    db.collection('words').where({ is_active: true }).count()
  ])
  
  return {
    data: result.data || [],
    total: count.total
  }
}

// ==================== 用户记忆状态 API ====================

/**
 * 获取用户在某个单词上的记忆状态
 * @param {number} wordId - 单词 ID
 * @returns {Object|null} 记忆状态对象或 null
 */
async function getUserWordMemory(wordId) {
  const openId = getOpenId()
  
  const res = await db.collection('user_word_memories').where({
    user_id: openId,
    word_id: wordId
  }).get()
  
  return res.data[0] || null
}

/**
 * 创建或更新用户的记忆状态（SM-2 算法核心）
 * @param {number} wordId - 单词 ID
 * @param {Object} memoryData - 记忆状态数据
 * @returns {boolean} 操作是否成功
 */
async function upsertUserWordMemory(wordId, memoryData) {
  const openId = getOpenId()
  
  // 先检查是否已存在
  const existing = await getUserWordMemory(wordId)
  
  if (existing) {
    // 更新现有记录
    await db.collection('user_word_memories').doc(existing._id).update({
      data: {
        ...memoryData,
        updated_at: new Date()
      }
    })
    return true
  } else {
    // 创建新记录
    const openId = getOpenId()
    
    await db.collection('user_word_memories').add({
      data: {
        user_id: openId,
        word_id: wordId,
        review_status: 'active',
        ...memoryData,
        created_at: new Date(),
        updated_at: new Date()
      }
    })
    return true
  }
}

/**
 * 获取待复习的单词列表（下次复习时间在现在之前）
 * @param {number} limit - 每次最多复习多少单词（默认 50）
 * @returns {Array} 待复习单词数组（包含 SM-2 状态）
 */
async function getReviewQueue(limit = 50) {
  const openId = getOpenId()
  const now = new Date()
  
  const res = await db.collection('user_word_memories')
    .where({
      user_id: openId,
      review_status: 'active',
      next_review: _.lte(now)
    })
    .orderBy('next_review', 'asc')
    .limit(limit)
    .get()
  
  // 同时查询关联的单词信息
  const wordIds = res.data.map(item => item.word_id)
  
  let words = []
  if (wordIds.length > 0) {
    const wordRes = await db.collection('words').where({
      _id: _.in(wordIds)
    }).get()
    
    // 合并数据：将 SM-2 状态附加到单词信息上
    const memoryMap = {}
    res.data.forEach(memory => {
      memoryMap[memory.word_id] = memory
    })
    
    words = wordRes.data.map(word => ({
      ...word,
      sm2_state: memoryMap[word.id]
    }))
  }
  
  return words
}

/**
 * 获取待学习的单词（新词）
 * @param {number} limit - 每次学习多少单词（默认 30）
 * @returns {Array} 待学习单词数组
 */
async function getNewWords(limit = 30) {
  const openId = getOpenId()
  
  // 找到已经学过的单词 ID 列表
  const learnedRes = await db.collection('user_word_memories')
    .where({ user_id: openId })
    .get()
  
  const learnedWordIds = learnedRes.data.map(item => item.word_id)
  
  // 查询还没学过的单词（不在学习中且没有被标记过）
  let whereClause = {}
  if (learnedWordIds.length > 0) {
    whereClause = {
      id: _.notIn(learnedWordIds)
    }
  }
  
  const res = await db.collection('words')
    .where(whereClause)
    .orderBy('created_at', 'asc')
    .limit(limit)
    .get()
  
  return res.data || []
}

// ==================== 复习历史 API ====================

/**
 * 记录一次复习行为
 * @param {number} wordId - 单词 ID
 * @param {number} quality - 质量评分（1-5 分）
 * @param {number} responseTimeMs - 反应时间（毫秒）
 * @param {string} reviewType - 复习类型（flashcard|dictation）
 * @returns {boolean} 操作是否成功
 */
async function recordReview(wordId, quality, responseTimeMs, reviewType = 'flashcard') {
  const openId = getOpenId()
  
  await db.collection('review_histories').add({
    data: {
      user_id: openId,
      word_id: wordId,
      review_time: new Date(),
      quality: quality,
      response_time_ms: responseTimeMs || 0,
      review_type: reviewType
    }
  })
  
  return true
}

// ==================== 每日计划 API ====================

/**
 * 获取当前日期的学习计划
 * @param {Date} date - 日期（默认为今天）
 * @returns {Object|null} 计划对象或 null
 */
async function getDailyPlan(date = new Date()) {
  const openId = getOpenId()
  const planDate = date.toISOString().split('T')[0]
  
  const res = await db.collection('daily_plans').where({
    user_id: openId,
    plan_date: planDate
  }).get()
  
  return res.data[0] || null
}

/**
 * 创建或更新每日计划
 * @param {Date} date - 日期
 * @param {Object} planData - 计划数据
 * @returns {boolean} 操作是否成功
 */
async function upsertDailyPlan(date, planData) {
  const openId = getOpenId()
  const planDate = date.toISOString().split('T')[0]
  
  const existing = await getDailyPlan(date)
  
  if (existing) {
    await db.collection('daily_plans').doc(existing._id).update({
      data: {
        ...planData,
        updated_at: new Date()
      }
    })
    return true
  } else {
    await db.collection('daily_plans').add({
      data: {
        user_id: openId,
        plan_date: planDate,
        new_words_count: 0,
        review_words_count: 0,
        completed_new: 0,
        completed_review: 0,
        correct_rate: 0,
        study_duration_min: 0,
        created_at: new Date(),
        updated_at: new Date(),
        ...planData
      }
    })
    return true
  }
}

/**
 * 更新每日计划的进度
 * @param {Date} date - 日期
 * @param {Object} increments - 要增加的字段值
 * @returns {boolean} 操作是否成功
 */
async function incrementDailyPlanProgress(date, increments) {
  const openId = getOpenId()
  const planDate = date.toISOString().split('T')[0]
  
  await db.collection('daily_plans').where({
    user_id: openId,
    plan_date: planDate
  }).update({
    data: increments
  })
  
  return true
}

// ==================== 数据统计 API ====================

/**
 * 获取统计数据
 * @param {string} type - 统计类型（total_reviews, current_streak, accuracy）
 * @param {Object} options - 可选参数
 * @returns {number} 统计结果
 */
async function getStats(type, options = {}) {
  const openId = getOpenId()
  
  switch (type) {
    case 'total_reviews':
      // 总复习次数
      const res1 = await db.collection('review_histories')
        .where({ user_id: openId })
        .count()
      return res1.total
      
    case 'current_streak':
      // 当前连续打卡天数
      // 简化实现：从最近的学习日志推断
      const res2 = await db.collection('review_histories')
        .where({ user_id: openId })
        .orderBy('review_time', 'desc')
        .limit(30)
        .get()
      
      // 计算连续天数（这里简化为 7 天内的记录数）
      // 实际应该更精确地按天去重
      return res2.data.length
      
    case 'accuracy':
      // 正确率
      const res3 = await db.collection('review_histories')
        .where({ 
          user_id: openId,
          quality: _.gte(4)  // 4 分以上算正确
        })
        .count()
      
      const totalRes = await getStats('total_reviews')
      return totalRes > 0 ? res3.total / totalRes : 0
      
    default:
      return 0
  }
}

// ==================== 导出全部模块 ====================

module.exports = {
  // 基础查询
  searchWords,
  getWordById,
  getAllWords,
  
  // 用户记忆状态
  getUserWordMemory,
  upsertUserWordMemory,
  getReviewQueue,
  getNewWords,
  
  // 复习历史
  recordReview,
  
  // 每日计划
  getDailyPlan,
  upsertDailyPlan,
  incrementDailyPlanProgress,
  
  // 统计
  getStats,
  
  // 常量
  _,
  eq,
  gt,
  lt,
  gte,
  lte,
  inCommand,
  neq,
  exists,
  nin
}
