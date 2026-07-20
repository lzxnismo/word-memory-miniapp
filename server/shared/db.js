/**
 /**
  * shared/db.js — 统一数据库连接池
  * 
  * 微信云托管环境专用
  * 数据库配置通过环境变量传入
  * 
  * © 一帮人马工作室（QQ691481548）
  */
 const mysql = require('mysql2/promise')

 let pool = null

 /**
  * 获取数据库连接池（单例模式）
  * 配置优先级：环境变量 > 默认值
  */
 function getPool() {
   if (!pool) {
     const config = {
       host: process.env.DATABASE_HOST || '10.40.109.26',      // 微信云内网 MySQL
       port: parseInt(process.env.DATABASE_PORT || '3306'),     // 微信云 MySQL 端口
       user: process.env.DATABASE_USER || 'word_memory_app',
       password: process.env.DATABASE_PASSWORD || 'Root_123',
       database: process.env.DATABASE_NAME || 'word_memory_db', // 微信云数据库名
       waitForConnections: true,
       connectionLimit: 20,
       queueLimit: 0,
       connectTimeout: 10000,
       timezone: '+08:00'
     }

     pool = mysql.createPool(config)
     console.log(`✅ 数据库连接池建立 [${config.database}@${config.host}:${config.port}]`)
   }
   return pool
 }

/**
 * 获取连接（带自动释放）
 * 使用方式: const conn = await getConnection()
 * 必须 finally { conn.release() }
 */
async function getConnection() {
  const p = getPool()
  return p.getConnection()
}

/**
 * 关闭连接池（应用退出时调用）
 */
async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
    console.log('✅ 数据库连接池已关闭')
  }
}

module.exports = { getPool, getConnection, closePool }