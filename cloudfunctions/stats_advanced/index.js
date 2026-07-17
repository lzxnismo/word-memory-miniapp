// cloudfunctions/stats_advanced/index.js - 直连 MySQL 版本
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
  const { action, days = 30 } = event
  
  try {
    const { OPENID } = cloud.getWXContext()
    
    switch (action) {
      case 'getStats':
        return await getStats(OPENID)
      case 'getTrends':
        return await getTrends(days, OPENID)
      case 'getAchievements':
        return await getAchievements(OPENID)
      default:
        return { code: 400, message: '未知 action', data: null }
    }
  } catch (err) {
    console.error('Error in stats_advanced:', err)
    return { code: 500, message: err.message || '服务器错误', data: null }
  }
}

/**
 * 获取综合统计数据
 */
async function getStats(openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 1. 总词数
    const [totalWords] = await conn.execute(
      'SELECT COUNT(*) AS cnt FROM words WHERE is_active = 1'
    )
    
    // 2. 用户学习进度
    const [progress] = await conn.execute(`
      SELECT 
        COUNT(*) AS learned_count,
        COALESCE(SUM(CASE WHEN mastery_score > 80 THEN 1 ELSE 0 END), 0) AS mastered_count,
        COALESCE(AVG(mastery_score), 0) AS avg_mastery
      FROM user_word_memories
      WHERE user_openid = ?
    `, [openid])
    
    // 3. 今日复习统计
    const [todayStats] = await conn.execute(`
      SELECT 
        COUNT(DISTINCT word_id) AS reviewed_today,
        COALESCE(AVG(quality), 0) AS avg_quality
      FROM review_histories
      WHERE user_openid = ? AND DATE(review_time) = CURDATE()
    `, [openid])
    
    // 4. 连续学习天数 (streak)
    const [streakData] = await conn.execute(`
      WITH review_dates AS (
        SELECT DISTINCT DATE(review_time) AS rdate
        FROM review_histories
        WHERE user_openid = ?
        ORDER BY rdate DESC
      ),
      date_gaps AS (
        SELECT rdate, 
          DATEDIFF(CURDATE(), rdate) AS days_ago,
          ROW_NUMBER() OVER (ORDER BY rdate DESC) AS rn
        FROM review_dates
      ),
      gap_check AS (
        SELECT rdate, days_ago, rn,
          days_ago - rn AS gap_group
        FROM date_gaps
      )
      SELECT COUNT(*) AS streak
      FROM gap_check
      WHERE gap_group = 0
    `, [openid])
    
    // 5. 复习类型分布
    const [typeDist] = await conn.execute(`
      SELECT review_type, COUNT(*) AS cnt
      FROM review_histories
      WHERE user_openid = ?
      GROUP BY review_type
    `, [openid])
    
    // 6. 今日学习计划
    const [plan] = await conn.execute(`
      SELECT new_words_count, review_words_count, 
             COALESCE(completed_new, 0) AS completed_new,
             COALESCE(completed_review, 0) AS completed_review
      FROM daily_plans
      WHERE user_openid = ? AND plan_date = CURDATE()
    `, [openid])
    
    // 7. 正确率统计
    const [accuracy] = await conn.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN quality >= 3 THEN 1 ELSE 0 END), 0) AS correct,
        COUNT(*) AS total
      FROM review_histories
      WHERE user_openid = ? AND DATE(review_time) = CURDATE()
    `, [openid])
    
    const streak = streakData[0]?.streak || 0
    const correctRate = accuracy.total > 0 
      ? Math.round((accuracy.correct / accuracy.total) * 100) 
      : 0
    
    return {
      code: 200,
      message: '获取成功',
      data: {
        word_bank: {
          total: totalWords[0].cnt,
          learned: progress[0].learned_count,
          mastered: progress[0].mastered_count,
          avg_mastery: Math.round(progress[0].avg_mastery)
        },
        today: {
          reviewed: todayStats[0].reviewed_today,
          avg_quality: Math.round(todayStats[0].avg_quality * 10) / 10,
          plan: plan.length > 0 ? {
            new: plan[0].new_words_count,
            new_completed: plan[0].completed_new,
            review: plan[0].review_words_count,
            review_completed: plan[0].completed_review,
            new_progress: plan[0].new_words_count > 0 
              ? Math.round((plan[0].completed_new / plan[0].new_words_count) * 100) 
              : 100,
            review_progress: plan[0].review_words_count > 0 
              ? Math.round((plan[0].completed_review / plan[0].review_words_count) * 100) 
              : 100
          } : null,
          correct_rate: correctRate
        },
        streak: streak,
        review_type_distribution: typeDist.map(t => ({
          type: t.review_type,
          count: t.cnt
        }))
      }
    }
  } finally {
    conn.release()
  }
}

/**
 * 获取学习趋势数据
 */
async function getTrends(days, openid) {
  const conn = await getPool().getConnection()
  
  try {
    const [rows] = await conn.execute(`
      SELECT 
        DATE(review_time) AS review_date,
        COUNT(DISTINCT word_id) AS word_count,
        COUNT(*) AS review_count,
        COALESCE(AVG(quality), 0) AS avg_quality,
        SUM(CASE WHEN quality >= 3 THEN 1 ELSE 0 END) AS correct_count
      FROM review_histories
      WHERE user_openid = ? AND review_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(review_time)
      ORDER BY review_date ASC
    `, [openid, days])
    
    return {
      code: 200,
      message: '获取成功',
      data: rows.map(r => ({
        date: r.review_date.toISOString().split('T')[0],
        words_learned: r.word_count,
        reviews: r.review_count,
        avg_quality: Math.round(r.avg_quality * 10) / 10,
        accuracy: r.review_count > 0 
          ? Math.round((r.correct_count / r.review_count) * 100) 
          : 0
      }))
    }
  } finally {
    conn.release()
  }
}

/**
 * 获取成就徽章
 */
async function getAchievements(openid) {
  const conn = await getPool().getConnection()
  
  try {
    // 1. 获取学习统计数据
    const [totalLearned] = await conn.execute(`
      SELECT COUNT(*) AS cnt FROM user_word_memories WHERE user_openid = ?
    `, [openid])
    
    const [mastered] = await conn.execute(`
      SELECT COUNT(*) AS cnt FROM user_word_memories 
      WHERE user_openid = ? AND mastery_score > 80
    `, [openid])
    
    const [streakData] = await conn.execute(`
      WITH review_dates AS (
        SELECT DISTINCT DATE(review_time) AS rdate
        FROM review_histories
        WHERE user_openid = ?
        ORDER BY rdate DESC
      ),
      date_gaps AS (
        SELECT rdate, DATEDIFF(CURDATE(), rdate) - ROW_NUMBER() OVER (ORDER BY rdate DESC) AS gap_group
        FROM review_dates
      )
      SELECT COUNT(*) AS streak FROM date_gaps WHERE gap_group = 0
    `, [openid])
    
    const [totalReviews] = await conn.execute(`
      SELECT COUNT(*) AS cnt FROM review_histories WHERE user_openid = ?
    `, [openid])
    
    const streak = streakData[0]?.streak || 0
    const learned = totalLearned[0]?.cnt || 0
    const reviews = totalReviews[0]?.cnt || 0
    
    // 2. 计算成就
    const achievements = [
      {
        id: 'first_word',
        name: '初识单词',
        description: '学习第一个单词',
        icon: '🌱',
        unlocked: learned >= 1,
        progress: Math.min(learned, 1),
        target: 1
      },
      {
        id: 'ten_words',
        name: '词汇小能手',
        description: '累计学习 10 个单词',
        icon: '🌟',
        unlocked: learned >= 10,
        progress: Math.min(learned, 10),
        target: 10
      },
      {
        id: 'hundred_words',
        name: '百词斩',
        description: '累计学习 100 个单词',
        icon: '🏆',
        unlocked: learned >= 100,
        progress: Math.min(learned, 100),
        target: 100
      },
      {
        id: 'master_20',
        name: '初露锋芒',
        description: '掌握 20 个单词（精通度>80）',
        icon: '🔥',
        unlocked: mastered >= 20,
        progress: Math.min(mastered, 20),
        target: 20
      },
      {
        id: 'streak_3',
        name: '三天打鱼',
        description: '连续学习 3 天',
        icon: '📅',
        unlocked: streak >= 3,
        progress: Math.min(streak, 3),
        target: 3
      },
      {
        id: 'streak_7',
        name: '一周好汉',
        description: '连续学习 7 天',
        icon: '⏰',
        unlocked: streak >= 7,
        progress: Math.min(streak, 7),
        target: 7
      },
      {
        id: 'streak_30',
        name: '月度坚持',
        description: '连续学习 30 天',
        icon: '🎯',
        unlocked: streak >= 30,
        progress: Math.min(streak, 30),
        target: 30
      },
      {
        id: 'hundred_reviews',
        name: '百次复习',
        description: '完成 100 次复习',
        icon: '🔄',
        unlocked: reviews >= 100,
        progress: Math.min(reviews, 100),
        target: 100
      }
    ]
    
    const earned = achievements.filter(a => a.unlocked).length
    
    return {
      code: 200,
      message: '获取成功',
      data: {
        total_achievements: achievements.length,
        earned: earned,
        progress_percent: Math.round((earned / achievements.length) * 100),
        list: achievements
      }
    }
  } finally {
    conn.release()
  }
}