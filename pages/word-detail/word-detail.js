// pages/word-detail/word-detail.js
const api = require('../../utils/api.js')

Page({
  data: {
    loading: false,
    wordData: null,
    wordMemory: null,
    isLearned: false,
    isDue: false,
    statusText: '',
    lookupLoading: false,
    lookupResult: null
  },

  onLoad(options) {
    if (options.id) {
      this.loadWordDetail(options.id)
    } else {
      wx.showToast({ title: '缺少单词 ID', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  loadWordDetail(wordId) {
    this.setData({ loading: true })
    
    const app = getApp()
    const openId = app.globalData.openId || 'mock_'
    
    // 同时获取单词信息和用户记忆记录
    Promise.all([
      wx.cloud.callContainer({
        path: '/api/v1/word_query',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { 
          action: 'getById',
          wordId: wordId
        }
      }),
      wx.cloud.callContainer({
        path: '/api/v1/word_query',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { 
          action: 'getUserMemory',
          wordId: wordId,
          userId: openId
        }
      })
    ]).then(([wordRes, memoryRes]) => {
      if (wordRes.statusCode === 200 && wordRes.data && wordRes.data.code === 200 && wordRes.data.data) {
        const words = Array.isArray(wordRes.data.data) ? wordRes.data.data : [wordRes.data.data]
        
        if (words.length > 0) {
          const wordData = words[0]
          
          let wordMemory = null
          let isLearned = false
          let isDue = false
          
          if (memoryRes.statusCode === 200 && memoryRes.data && memoryRes.data.code === 200 && memoryRes.data.memory) {
            wordMemory = memoryRes.data.memory
            isLearned = true
            
            // 判断是否需要复习
            const now = new Date()
            const nextReviewTime = new Date(wordMemory.nextReviewTime)
            isDue = now >= nextReviewTime
            
            let statusText
            switch(wordMemory.status) {
              case 'mastered':
                statusText = '已掌握'
                break
              case 'learning':
                statusText = '学习中'
                break
              default:
                statusText = '待学习'
            }
            
            this.setData({ 
              wordMemory: wordMemory,
              isLearned: isLearned,
              isDue: isDue,
              statusText: statusText
            })
          }
          
          this.setData({
            wordData: wordData,
            loading: false
          })
        } else {
          this.setData({ 
            loading: false,
            wordData: null
          })
        }
      } else {
        this.setData({ 
          loading: false,
          wordData: null
        })
      }
    }).catch(err => {
      console.error('❌ 加载失败:', err)
      this.setData({ loading: false })
    })
  },

  playAudio() {
    if (!this.data.wordData) return
    
    const word = this.data.wordData.word
    
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
        const innerAudioContext = wx.createInnerAudioContext()
        innerAudioContext.src = res.data.audioUrl
        innerAudioContext.play()
        
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

  markWrong() {
    this.submitReview(1)
  },

  markFuzzy() {
    this.submitReview(2)
  },

  markKnown() {
    this.submitReview(4)
  },

  submitReview(quality) {
    if (!this.data.wordData) return
    
    const app = getApp()
    const openId = app.globalData.openId || 'mock_'
    
    wx.showLoading({ title: '提交中...' })
    
    wx.cloud.callContainer({
      path: '/api/v1/record_review',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        wordId: this.data.wordData.id,
        userId: openId,
        quality: quality,
        reviewedAt: new Date().toISOString()
      }
    }).then(res => {
      wx.hideLoading()
      
      if (res.statusCode === 200 && res.data && res.data.code === 200) {
        wx.vibrateShort({ type: 'light' })
        
        // 重新加载详情页数据
        this.loadWordDetail(this.data.wordData.id)
        
        wx.showToast({ 
          title: res.data.message || '已更新', 
          icon: 'success'
        })
      } else {
        wx.showToast({ title: res.data.message || '提交失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('❌ 提交失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
    })
  },

  // 在线查词补全
  async doLookup() {
    if (!this.data.wordData) return
    this.setData({ lookupLoading: true })
    try {
      const res = await wx.cloud.callContainer({
        path: '/api/v1/word_lookup',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { word: this.data.wordData.word }
      })
      if (res.statusCode === 200 && res.data && res.data.code === 200 && res.data.data) {
        this.setData({ lookupResult: res.data.data })
      } else {
        wx.showToast({ title: '未找到详细信息', icon: 'none' })
        this.setData({ lookupResult: { definitions: [{ pos: '', definition: '暂无更多数据' }] } })
      }
    } catch (err) {
      console.error('查词失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
    } finally {
      this.setData({ lookupLoading: false })
    }
  },

  clearLookup() {
    this.setData({ lookupResult: null })
  },

  formatDate(dateStr) {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  goToFlashCard() {
    if (!this.data.wordData) return
    
    wx.navigateTo({
      url: `/pages/flash-card/flash-card?mode=quick&wordId=${this.data.wordData.id}`
    })
  },

  goBack() {
    wx.navigateBack()
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    })
  }
})
