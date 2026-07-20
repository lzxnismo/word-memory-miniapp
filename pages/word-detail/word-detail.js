// pages/word-detail/word-detail.js - 微信云托管版
const requestLib = require('../../utils/request')

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

  async loadWordDetail(wordId) {
    this.setData({ loading: true })
    
    try {
      const results = await Promise.all([
        requestLib.request('/word_query', { method: 'POST', data: { wordId } }),
        requestLib.request(`/user_memory/${wordId}`, { method: 'GET' })
      ])
      const wordRes = results[0]
      const memoryRes = results[1]
      
      if (wordRes && wordRes.code === 200 && wordRes.data) {
        const words = Array.isArray(wordRes.data) ? wordRes.data : [wordRes.data]
        
        if (words.length > 0) {
          const wordData = words[0]
          
          let wordMemory = null
          let isLearned = false
          let isDue = false
          
          if (memoryRes && memoryRes.code === 200 && memoryRes.data) {
            wordMemory = memoryRes.data
            isLearned = true
            
            const now = new Date()
            const nextReviewTime = new Date(wordMemory.nextReviewTime)
            isDue = now >= nextReviewTime
            
            let statusText
            switch(wordMemory.status) {
              case 'mastered': statusText = '已掌握'; break
              case 'learning': statusText = '学习中'; break
              default: statusText = '待学习'
            }
            
            this.setData({ 
              wordMemory, isLearned, isDue, statusText 
            })
          }
          
          this.setData({ wordData, loading: false })
        } else {
          this.setData({ loading: false, wordData: null })
        }
      }
    } catch (err) {
      console.error('❌ 加载失败:', err)
      this.setData({ loading: false })
    }
  },

  async playAudio() {
    if (!this.data.wordData) return
    
    const word = this.data.wordData.word
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

  markWrong() { this.submitReview(1) },
  markFuzzy() { this.submitReview(2) },
  markKnown() { this.submitReview(4) },

  async submitReview(quality) {
    if (!this.data.wordData) return
    
    wx.showLoading({ title: '提交中...' })
    
    try {
      const res = await requestLib.request('/record_review', {
        method: 'POST',
        data: {
          wordId: this.data.wordData.id,
          quality,
          reviewedAt: new Date().toISOString()
        }
      })
      
      wx.hideLoading()
      
      if (res && res.code === 200) {
        wx.vibrateShort({ type: 'light' })
        this.loadWordDetail(this.data.wordData.id)
        wx.showToast({ title: res.message || '已更新', icon: 'success' })
      } else {
        wx.showToast({ title: res.message || '提交失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('❌ 提交失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
    }
  },

  async doLookup() {
    if (!this.data.wordData) return
    this.setData({ lookupLoading: true })
    
    try {
      const res = await requestLib.request(`/word_lookup/${this.data.wordData.word}`, { method: 'GET' })
      if (res && res.code === 200 && res.data) {
        this.setData({ lookupResult: res.data })
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

  clearLookup() { this.setData({ lookupResult: null }) },

  formatDate(dateStr) {
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
  },

  goToFlashCard() {
    if (!this.data.wordData) return
    wx.navigateTo({ url: `/pages/flash-card/flash-card?mode=quick&wordId=${this.data.wordData.id}` })
  },

  goBack() { wx.navigateBack() },
  
  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
