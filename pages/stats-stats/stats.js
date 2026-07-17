// pages/stats-stats/stats.js
Page({
  data: {
    currentStreak: 0,
    totalWordsLearned: 0,
    masteredWords: 0,
    accuracy: 0,
    
    weeklyData: [],
    maxWeekCount: 0,
    
    totalReviews: 0,
    avgDuration: 0,
    longestStreak: 0,
    
    isBadgeUnlocked: {
      morning: false,
      consistent: false,
      master: false,
      perfect: false
    }
  },

  onShow() {
    this.loadStats()
  },

  loadStats() {
    const app = getApp()
    const openId = app.globalData.openId || 'mock_'
    
    // 加载整体统计数据
    wx.cloud.callContainer({
      path: '/api/v1/user_stats',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { action: 'overview' }
    }).then(res => {
      if (res.statusCode === 200 && res.data && res.data.code === 200 && res.data.data) {
        const stats = res.data.data
        
        this.setData({
          currentStreak: Number(stats.current_streak) || 0,
          totalWordsLearned: Number(stats.total_learned) || 0,
          masteredWords: Number(stats.total_mastered) || 0,
          accuracy: Number(stats.accuracy) || 0,
          totalReviews: Number(stats.total_reviews) || 0,
          longestStreak: Number(stats.longest_streak) || 0
        })
        
        // 判断徽章是否解锁
        const badges = this.checkBadges(stats)
        this.setData({
          isBadgeUnlocked: badges
        })
      }
    })
    
    // 加载周数据（这里用模拟数据）
    this.generateWeeklyData()
  },

  generateWeeklyData() {
    // 生成最近 7 天的学习数据（简化为随机数据，实际应从数据库获取）
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    const weekData = []
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayName = days[date.getDay()]
      
      // 模拟数据：周末较多，平时较少
      let count
      if (i <= 1) {
        count = Math.floor(Math.random() * 30) + 20
      } else {
        count = Math.floor(Math.random() * 40) + 10
      }
      
      weekData.push({
        day: dayName,
        count: count
      })
    }
    
    const maxCount = Math.max(...weekData.map(item => item.count))
    
    this.setData({
      weeklyData: weekData,
      maxWeekCount: maxCount > 0 ? maxCount : 50
    })
  },

  checkBadges(stats) {
    return {
      morning: false, // 需要根据学习时间判断
      consistent: stats.current_streak >= 7,
      master: stats.total_learned >= 500,
      perfect: stats.accuracy >= 90
    }
  }
})
