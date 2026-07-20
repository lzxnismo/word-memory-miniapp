// pages/flash-card/flash-card.js - 微信云托管版
const requestLib = require('../../utils/request')

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
    if (options.mode) this.setData({ mode: options.mode })
    
    if (this.data.mode === 'quick' && options.wordId) {
      this.loadSingleWord(options.wordId)
    } else {
      this.loadStudyQueue()
    }
  },

  onUnload() {
    if (!this.data.learningComplete && !this.data.loading) {
      wx.setStorageSync('current_session', {
        queue: this.data.queue,
        currentIndex: this.data.currentIndex,
        mode: this.data.mode
      })
    }
  },

  async loadSingleWord(wordId) {
    this.setData({ loading: true })
    
    try {
      const res = await requestLib.request('/word_query', {
        method: 'POST',
        data: { wordId }
      })
      
      if (res && res.code === 200 && res.data) {
        const words = Array.isArray(res.data) ? res.data : [res.data]
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
      }
    } catch (err) {
      console.error('❌ 获取单词失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async loadStudyQueue() {
    this.setData({ loading: true })
    
    let action, params
    
    switch(this.data.mode) {
      case 'review':
        action = 'getReviewQueue'; params = { limit: 30 }; break
      case 'new':
        action = 'getNewWords'; params = { limit: 30 }; break
      default:
        action = 'getReviewQueue'; params = { limit: 30 }
    }
    
    try {
      const res = await requestLib.request('/user_stats/review-queue', { method: 'GET' })
      
      if (res && res.code === 200 && res.data && res.data.words) {
        this.setData({
          queue: res.data.words.slice(0, params.limit),
          currentIndex: 0,
          currentWord: null,
          totalWords: res.data.words.length,
          loading: false,
          learningComplete: false
        })
        
        setTimeout(() => this.loadNextWord(), 300)
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' })
        this.setData({ queue: [], loading: false })
      }
    } catch (err) {
      console.error('❌ 加载队列失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
      this.setData({ loading: false })
    }
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

  async playAudio() {
    if (!this.data.currentWord) return
    
    const word = this.data.currentWord.word
    
    wx.showLoading({ title: '加载中...' })
    
    try {
      const res = await requestLib.request('/word_query', {
        method: 'POST',
        data: { word }
      })
      
      wx.hideLoading()
      
      if (res && res.code === 200 && res.data && res.data.audioUrl) {
        const innerAudioContext = wx.createInnerAudioContext()
        innerAudioContext.src = res.data.audioUrl
        innerAudioContext.play()
        
        innerAudioContext.onEnded(() => {
          this.setData({ showAudioButton: false })
        })
        
        innerAudioContext.onError(err => console.error('❌ 音频播放失败:', err))
      } else {
        wx.showToast({ title: '发音加载失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('❌ TTS 调用失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
    }
  },

  rateWord(e) {
    const quality = Number(e.currentTarget.dataset.quality)
    if (!this.data.currentWord) return
    this.submitAnswer(quality)
  },

  async submitAnswer(quality) {
    if (!this.data.currentWord) return
    
    const reviewData = {
      wordId: this.data.currentWord.id,
      quality,
      reviewedAt: new Date().toISOString()
    }
    
    wx.showLoading({ title: '提交中...' })
    
    try {
      const res = await requestLib.request('/record_review', {
        method: 'POST',
        data: reviewData
      })
      
      wx.hideLoading()
      
      if (res && res.code === 200) {
        this.setData({ completedCount: this.data.completedCount + 1 })
        wx.vibrateShort({ type: 'light' })
        
        setTimeout(() => {
          this.loadNextWord()
        }, 200)
      } else {
        wx.showToast({ title: res.message || '提交失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('❌ 记录失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
    }
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
