// pages/flash-card/flash-card.js
const api = require('../../utils/api.js')

Page({
  data: {
    mode: 'review',           // review | new | quick
    loading: false,
    learningComplete: false,
    
    // 单词队列
    queue: [],
    currentIndex: 0,
    currentWord: null,
    
    // 卡片状态
    isFlipped: false,
    showAudioButton: true,
    
    // 学习统计
    completedCount: 0,
    totalWords: 0
  },

  onLoad(options) {
    // 根据参数决定模式
    if (options.mode) {
      this.setData({ mode: options.mode })
    }
    
    // 如果是快速复习模式，获取特定单词
    if (this.data.mode === 'quick' && options.wordId) {
      this.loadSingleWord(options.wordId)
    } else {
      this.loadStudyQueue()
    }
  },

  onUnload() {
    // 页面卸载时保存学习进度
    if (!this.data.learningComplete && !this.data.loading) {
      wx.setStorageSync('current_session', {
        queue: this.data.queue,
        currentIndex: this.data.currentIndex,
        mode: this.data.mode
      })
    }
  },

  loadSingleWord(wordId) {
    this.setData({ loading: true })
    
    wx.cloud.callContainer({
      path: '/api/v1/word_query',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { 
        action: 'getById',
        wordId: wordId
      }
    }).then(res => {
      if (res.statusCode === 200 && res.data && res.data.code === 200 && res.data.data) {
        const words = Array.isArray(res.data.data) ? res.data.data : [res.data.data]
        if (words.length > 0) {
          this.setData({
            queue: words,
            currentIndex: 0,
            currentWord: words[0],
            totalWords: 1,
            loading: false,
            showAudioButton: true
          })
        } else {
          wx.showToast({ title: '单词不存在', icon: 'none' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' })
        this.setData({ loading: false })
      }
    }).catch(err => {
      console.error('❌ 获取单词失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
      this.setData({ loading: false })
    })
  },

  loadStudyQueue() {
    this.setData({ loading: true })
    
    let action
    let params
    
    switch(this.data.mode) {
      case 'review':
        action = 'getReviewQueue'
        params = { limit: 30 }
        break
      case 'new':
        action = 'getNewWords'
        params = { limit: 30 }
        break
      default:
        action = 'getReviewQueue'
        params = { limit: 30 }
    }
    
    wx.cloud.callContainer({
      path: '/api/v1/user_stats',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { action }
    }).then(res => {
      if (res.statusCode === 200 && res.data && res.data.code === 200 && res.data.words) {
        this.setData({
          queue: res.data.words.slice(0, params.limit),
          currentIndex: 0,
          currentWord: null,
          totalWords: res.data.words.length,
          loading: false,
          learningComplete: false
        })
        
        // 延迟加载第一个词（避免初始化冲突）
        setTimeout(() => this.loadNextWord(), 300)
      } else {
        wx.showToast({ title: res.data.message || '加载失败', icon: 'none' })
        this.setData({ 
          queue: [],
          loading: false 
        })
      }
    }).catch(err => {
      console.error('❌ 加载队列失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
      this.setData({ loading: false })
    })
  },

  loadNextWord() {
    const nextIndex = this.data.currentIndex
    if (nextIndex >= this.data.queue.length) {
      this.completeLearning()
      return
    }
    
    this.setData({
      currentWord: this.data.queue[nextIndex],
      currentIndex: nextIndex,
      isFlipped: false,
      showAudioButton: true
    })
  },

  flipCard() {
    this.setData({ isFlipped: !this.data.isFlipped })
  },

  playTts() {
    const word = this.data.currentWord.word
    
    // 使用云函数 TTS 代理
    wx.showLoading({ title: '加载中...' })
    
    wx.cloud.callContainer({
      path: '/api/v1/word_query',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        action: 'tts',
        word: word
      }
    }).then(res => {
      wx.hideLoading()
      
      if (res.statusCode === 200 && res.data && res.data.code === 200 && res.data.audioUrl) {
        // 播放音频
        const innerAudioContext = wx.createInnerAudioContext()
        innerAudioContext.src = res.data.audioUrl
        innerAudioContext.play()
        
        // 播放完成后显示评分按钮
        innerAudioContext.onEnded(() => {
          this.setData({ showAudioButton: false })
        })
        
        innerAudioContext.onError(err => {
          console.error('❌ 音频播放失败:', err)
        })
      } else {
        wx.showToast({ title: '发音加载失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('❌ TTS 调用失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
    })
  },

  rateWord(e) {
    const quality = Number(e.currentTarget.dataset.quality)
    
    if (!this.data.currentWord) return
    
    this.submitAnswer(quality)
  },

  submitAnswer(quality) {
    const currentWord = this.data.currentWord
    const index = this.data.currentIndex
    const app = getApp()
    const openId = app.globalData.openId || 'mock_'
    
    // 准备提交数据
    const reviewData = {
      wordId: currentWord.id,
      userId: openId,
      quality: quality,
      reviewedAt: new Date().toISOString()
    }
    
    wx.showLoading({ title: '提交中...' })
    
    wx.cloud.callContainer({
      path: '/api/v1/record_review',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: reviewData
    }).then(res => {
      wx.hideLoading()
      
      if (res.statusCode === 200 && res.data && res.data.code === 200) {
        this.setData({ completedCount: this.data.completedCount + 1 })
        
        // 震动反馈
        wx.vibrateShort({ type: 'light' })
        
        // 跳转到下一个单词
        setTimeout(() => {
          this.loadNextWord()
        }, 200)
      } else {
        wx.showToast({ title: res.data.message || '提交失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('❌ 记录失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
    })
  },

  skipWord() {
    // 稍后复习：标记为跳过，不改变记忆状态
    wx.showToast({ title: '已加入待复习列表', icon: 'none' })
    this.loadNextWord()
  },

  completeLearning() {
    this.setData({ 
      learningComplete: true,
      isFlipped: false
    })
  },

  continueReview() {
    wx.navigateBack()
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    })
  },

  onSliderChange(e) {
    // 滑动进度条跳转
    const progress = e.detail.value
    const newIndex = Math.floor(progress * this.data.queue.length)
    
    if (newIndex !== this.data.currentIndex) {
      this.setData({
        currentIndex: newIndex,
        currentWord: this.data.queue[newIndex],
        isFlipped: false
      })
    }
  }
})
