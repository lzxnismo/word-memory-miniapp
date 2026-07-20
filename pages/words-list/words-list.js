// pages/words-list/words-list.js - 微信云托管版
const requestLib = require('../../utils/request')

Page({
  data: {
    searchKeyword: '',
    filterCategory: 'all', // all | mastered | learning | new
    totalWords: 0,
    learnedCount: 0,
    masteredCount: 0,
    accuracy: 0,
    
    words: [],
    filteredWords: [],
    loadingMore: false
  },

  onLoad() {
    this.loadWords()
  },

  onShow() {
    this.loadWords()
  },

  async loadWords() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      const res = await requestLib.request('/word_query?limit=100&offset=0')
      
      console.log('📋 word_query 返回:', JSON.stringify(res))
      
      if (res && res.code === 200) {
        const words = res.data || []
        
        this.setData({
          words: words,
          totalWords: res.total || words.length,
          filteredWords: this.applyFilter(words)
        })
        
        this.updateStats(words)
      } else {
        const errMsg = res?.message || '加载失败'
        wx.showToast({ 
          title: errMsg, 
          icon: 'none',
          duration: 3000
        })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('❌ API 调用失败:', err)
      wx.showToast({ 
        title: err.message || 'API 调用失败', 
        icon: 'none', 
        duration: 3000 
      })
    } finally {
      wx.hideLoading()
    }
  },

  applyFilter(words) {
    const keyword = this.data.searchKeyword.toLowerCase().trim()
    let filtered = words.filter(word => {
      const matchesSearch = !keyword || 
        word.word.toLowerCase().includes(keyword) ||
        word.meaning.toLowerCase().includes(keyword)
      
      return matchesSearch
    })
    
    // 分类筛选需要根据用户的记忆记录来判断状态
    const category = this.data.filterCategory
    if (category !== 'all') {
      filtered = filtered.filter(word => {
        const status = word.userStatus || 'new'
        return status === category
      })
    }
    
    return filtered
  },

  updateStats(words) {
    const learnedCount = words.filter(w => (w.userStatus === 'learning' || w.userStatus === 'mastered')).length
    const masteredCount = words.filter(w => w.userStatus === 'mastered').length
    
    let accuracy = 0
    if (learnedCount > 0) {
      accuracy = Math.round((masteredCount / learnedCount) * 100)
    }
    
    this.setData({
      learnedCount: learnedCount,
      masteredCount: masteredCount,
      accuracy: accuracy
    })
  },

  onSearchInput(e) {
    this.setData({ 
      searchKeyword: e.detail.value.trim(),
      filteredWords: this.applyFilter(this.data.words)
    })
  },

  setFilter(e) {
    const filter = e.currentTarget.dataset.filter
    
    this.setData({ 
      filterCategory: filter,
      filteredWords: this.applyFilter(this.data.words)
    })
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    
    wx.navigateTo({
      url: `/pages/word-detail/word-detail?id=${id}`
    })
  },

  async playWordAudio(e) {
    const word = e.currentTarget.dataset.word
    const audio = e.currentTarget.dataset.audio || ''
    
    if (audio) {
      const innerAudioContext = wx.createInnerAudioContext()
      innerAudioContext.src = audio
      innerAudioContext.play()
      innerAudioContext.onError(err => console.error('❌ 音频播放失败:', err))
      return
    }
    
    try {
      const res = await requestLib.request('/word_query', {
        method: 'POST',
        data: { word }
      })
      
      if (res && res.code === 200 && res.data && res.data.audioUrl) {
        const innerAudioContext = wx.createInnerAudioContext()
        innerAudioContext.src = res.data.audioUrl
        innerAudioContext.play()
        innerAudioContext.onError(err => console.error('❌ 音频播放失败:', err))
      } else {
        wx.showToast({ title: '发音加载失败', icon: 'none' })
      }
    } catch (err) {
      console.error('❌ TTS 调用失败:', err)
      wx.showToast({ title: 'API 错误', icon: 'none' })
    }
  }
})
