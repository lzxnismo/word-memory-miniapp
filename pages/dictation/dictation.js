// pages/dictation/dictation.js - 微信云托管版
const requestLib = require('../../utils/request')

Page({
  data: {
    loading: false,
    learningComplete: false,
    
    words: [],
    currentRound: [],
    currentIndex: 0,
    currentWord: null,
    
    userInput: '',
    hasAnswered: false,
    isCorrect: false,
    showHints: false,
    
    countingDown: false,
    remainingSeconds: 60,
    
    score: 0,
    totalWords: 0,
    accuracy: 0,
    performanceMessage: ''
  },

  onLoad() {
    this.startDictation()
  },

  async startDictation() {
    this.setData({ loading: true })
    
    try {
      const res = await requestLib.request('/user_stats/review-queue', { method: 'GET' })
      
      if (res && res.code === 200 && res.data && res.data.words) {
        const words = res.data.words.slice(0, 20)
        
        this.setData({
          words: words,
          currentRound: words,
          totalWords: words.length,
          currentIndex: 0,
          loading: false
        })
        
        setTimeout(() => this.loadCurrentQuestion(), 500)
      } else {
        wx.showToast({ title: '暂无待听写单词', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
      }
    } catch (err) {
      console.error('❌ 加载失败:', err)
      this.setData({ loading: false })
    }
  },

  loadCurrentQuestion() {
    if (this.data.currentIndex >= this.data.currentRound.length) {
      this.completeDictation()
      return
    }
    
    const word = this.data.currentRound[this.data.currentIndex]
    
    this.setData({
      currentWord: word,
      userInput: '',
      hasAnswered: false,
      isCorrect: false,
      showHints: false,
      countingDown: false,
      remainingSeconds: 60
    })
    
    setTimeout(() => this.playAudio(true), 300)
  },

  onInput(e) {
    this.setData({ userInput: e.detail.value.trim().toLowerCase() })
  },

  async playAudio(isAutoPlay = false) {
    if (!this.data.currentWord) return
    
    const word = this.data.currentWord.word
    
    if (isAutoPlay) wx.showLoading({ title: '加载中...' })
    
    try {
      const res = await requestLib.request('/word_query', {
        method: 'POST',
        data: { word }
      })
      
      if (isAutoPlay) wx.hideLoading()
      
      if (res && res.code === 200 && res.data && res.data.audioUrl) {
        const innerAudioContext = wx.createInnerAudioContext()
        innerAudioContext.src = res.data.audioUrl
        innerAudioContext.play()
        
        if (isAutoPlay) {
          innerAudioContext.onEnded(() => this.startTimer())
        }
        
        innerAudioContext.onError(err => console.error('❌ 音频播放失败:', err))
      } else if (isAutoPlay) {
        wx.showToast({ title: '发音加载失败', icon: 'none' })
      }
    } catch (err) {
      if (isAutoPlay) {
        console.error('❌ TTS 调用失败:', err)
        wx.showToast({ title: '网络错误', icon: 'none' })
        this.startTimer()
      }
    }
  },

  startTimer() {
    this.setData({ 
      countingDown: true,
      remainingSeconds: 60
    })
    
    const timer = setInterval(() => {
      const seconds = this.data.remainingSeconds - 1
      
      if (seconds <= 0) {
        clearInterval(timer)
        this.submitAnswer(true)
      } else {
        this.setData({ remainingSeconds: seconds })
      }
    }, 1000)
  },

  showHintFirst() {
    if (!this.data.currentWord || !this.data.userInput) return
    
    this.setData({ showHints: true })
    const hintLetter = this.data.currentWord.word.charAt(0)
    this.setData({ userInput: hintLetter })
    
    wx.vibrateShort({ type: 'light' })
  },

  showHintMeaning() {
    if (!this.data.currentWord) return
    
    this.setData({ showHints: true })
    
    wx.showModal({
      title: '提示',
      content: this.data.currentWord.meaning,
      showCancel: false,
      confirmText: '知道了',
      success: () => wx.vibrateShort({ type: 'medium' })
    })
  },

  submitAnswer(autoSubmit = false) {
    if (!this.data.currentWord) return
    
    const userSpelling = this.data.userInput.toLowerCase().trim()
    const correctSpelling = this.data.currentWord.word.toLowerCase()
    const isCorrect = userSpelling === correctSpelling
    
    this.setData({
      hasAnswered: true,
      isCorrect: isCorrect,
      countingDown: false,
      showHints: true
    })
    
    if (isCorrect) {
      wx.vibrateShort({ type: 'light' })
      this.setData({ score: this.data.score + 1 })
    } else {
      wx.vibrateShort({ type: 'heavy' })
    }
    
    this.recordToCloud(userSpelling, isCorrect)
  },

  async recordToCloud(spelling, isCorrect) {
    const reviewData = {
      wordId: this.data.currentWord.id,
      quality: isCorrect ? 4 : 1,
      spellingAttempt: spelling,
      reviewedAt: new Date().toISOString()
    }
    
    try {
      await requestLib.request('/record', {
        method: 'POST',
        data: reviewData
      })
    } catch (err) {
      console.error('⚠️ 记录失败:', err.message)
    }
  },

  nextQuestion() {
    this.setData({ currentIndex: this.data.currentIndex + 1 })
    this.loadCurrentQuestion()
  },

  completeDictation() {
    this.setData({ learningComplete: true })
    
    const accuracy = Math.round((this.data.score / this.data.totalWords) * 100)
    this.setData({ accuracy: accuracy })
    
    let message
    if (accuracy >= 90) message = '太棒了！你是听力王者🏆'
    else if (accuracy >= 70) message = '很棒！继续保持💪'
    else if (accuracy >= 50) message = '不错，还有提升空间📈'
    else message = '加油，多听多练才能进步🌟'
    
    this.setData({ performanceMessage: message })
  },

  retryDictation() {
    this.startDictation()
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  onSliderChange(e) {
    this.setData({ currentIndex: Number(e.detail.value) })
    this.loadCurrentQuestion()
  },

  onUnload() {
    if (!this.learningComplete && !this.loading) {
      wx.setStorageSync('current_session', {
        dictation: {
          round: this.data.currentRound,
          index: this.data.currentIndex,
          score: this.data.score
        }
      })
    }
  }
})
