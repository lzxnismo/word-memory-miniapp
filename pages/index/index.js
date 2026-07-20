// pages/index/index.js - 微信云托管版
const permission = require('../../utils/permission')
const requestLib = require('../../utils/request')

Page({
  data: {
    welcomeText: '',
    reviewCount: 0,      // 今日待复习数
    learnedCount: 0,     // 已学习总数
    todayWords: [],      // 今日推荐单词
    currentTime: '',
    needAuth: false      // 是否需要授权
  },

  onLoad() {
    this.initGreeting()
    this.updateCurrentTime()
    
    // 检查授权状态
    const checkAuth = permission.checkAuth
    const showAuthRequiredTip = permission.showAuthRequiredTip
    const auth = checkAuth()
    if (!auth.authorized) {
      this.setData({ needAuth: true })
    } else {
      this.loadData()
    }
    
    // 每小时更新一次时间
    setInterval(() => this.updateCurrentTime(), 3600000)
  },

  onShow() {
    // 每次显示时刷新数据
    if (!this.data.needAuth) {
      this.loadData()
    }
  },

  initGreeting() {
    const hour = new Date().getHours()
    if (hour < 6) {
      this.setData({ welcomeText: '晚安' })
    } else if (hour < 9) {
      this.setData({ welcomeText: '早上好' })
    } else if (hour < 12) {
      this.setData({ welcomeText: '上午好' })
    } else if (hour < 14) {
      this.setData({ welcomeText: '下午好' })
    } else if (hour < 18) {
      this.setData({ welcomeText: '下午好' })
    } else if (hour < 22) {
      this.setData({ welcomeText: '晚上好' })
    } else {
      this.setData({ welcomeText: '夜深了' })
    }
  },

  updateCurrentTime() {
    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    this.setData({ currentTime: timeStr })
  },

  async loadData() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      // 并行加载待复习数量和今日推荐单词
      const results = await Promise.all([
        requestLib.request('/user_stats/review-queue?limit=50'),
        requestLib.request('/word_query/recommend?limit=5')
      ])
      const reviewRes = results[0]
      const todayRes = results[1]
      
      let reviewCount = 0
      if (reviewRes && reviewRes.data) {
        reviewCount = Array.isArray(reviewRes.data) ? reviewRes.data.length : 0
      }
      
      let todayWords = []
      if (todayRes && todayRes.data) {
        todayWords = Array.isArray(todayRes.data) ? todayRes.data : [todayRes.data].filter(Boolean)
      }
      
      this.setData({
        reviewCount,
        learnedCount: 0,  // 暂时不显示已学总数
        todayWords
      })
    } catch (err) {
      console.error('数据加载失败:', err)
      const errMsg = err.message || ''
      
      // 如果是认证失败，提示用户去授权
      if (errMsg.includes('登录') || errMsg.includes('授权')) {
        this.setData({ needAuth: true })
        wx.hideLoading()
        showAuthRequiredTip()
      } else {
        wx.showToast({ 
          title: '加载失败：' + errMsg, 
          icon: 'none',
          duration: 3000
        })
      }
    } finally {
      wx.hideLoading()
    }
  },

  loadRecommendWords() {
    wx.showLoading({ title: '加载中...' })
    
    requestLib.request('/word_query?limit=5&offset=0')
      .then(res => {
        wx.hideLoading()
        if (res && res.data && Array.isArray(res.data)) {
          this.setData({ todayWords: res.data })
        } else {
          this.setData({ todayWords: [] })
        }
      })
      .catch(err => {
        wx.hideLoading()
        console.error('❌ 获取推荐单词失败:', err)
        this.setData({ todayWords: [] })
      })
  },

  // 开始复习 - 需要授权
  startReview() {
    if (this.data.needAuth) {
      showAuthRequiredTip()
      return
    }
    
    if (this.data.reviewCount <= 0) {
      wx.showToast({
        title: '暂无待复习单词',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: '/pages/flash-card/flash-card?mode=review'
    })
  },

  // 开始学习 - 需要授权
  startLearning() {
    if (this.data.needAuth) {
      showAuthRequiredTip()
      return
    }
    
    wx.navigateTo({
      url: '/pages/stats-stats/stats?type=learning_history'
    })
  },

  // 快速复习单个单词 - 需要授权
  quickReview(e) {
    if (this.data.needAuth) {
      showAuthRequiredTip()
      return
    }
    
    const word = e.currentTarget.dataset.word
    wx.setStorageSync('quick_review_word', word)
    
    wx.navigateTo({
      url: `/pages/flash-card/flash-card?mode=quick&wordId=${word.id}`
    })
  },

  // 闪卡学习 - 需要授权
  startFlashCard() {
    if (this.data.needAuth) {
      showAuthRequiredTip()
      return
    }
    
    wx.navigateTo({
      url: '/pages/flash-card/flash-card?mode=new'
    })
  },

  // 听写测试 - 需要授权
  startDictation() {
    if (this.data.needAuth) {
      showAuthRequiredTip()
      return
    }
    
    wx.navigateTo({
      url: '/pages/dictation/dictation'
    })
  },

  // 打开单词本列表 - 无需授权，可浏览
  openWordsList() {
    wx.navigateTo({
      url: '/pages/words-list/words-list'
    })
  },

  // 打开每日计划 - 需要授权
  openPlan() {
    if (this.data.needAuth) {
      showAuthRequiredTip()
      return
    }
    
    wx.navigateTo({
      url: '/pages/plan-daily/plan-daily'
    })
  },

  // 打开单词集列表
  openWordSets() {
    wx.switchTab({
      url: '/pages/wordset-list/wordset-list'
    })
  },

  // 打开学习目标 - 需要授权
  openGoals() {
    if (this.data.needAuth) {
      showAuthRequiredTip()
      return
    }
    
    wx.navigateTo({
      url: '/pages/goal-manager/goal-manager'
    })
  }
})
