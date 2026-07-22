// pages/wordset-detail/wordset-detail.js - 微信云托管版
const requestLib = require('../../utils/request')

Page({
  data: {
    setId: null,
    setInfo: {},
    words: [],
    showAdd: false,
    searchWord: '',
    lookupResult: null
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ setId: options.id })
      this.loadDetail()
    }
  },

  onShow() {
    if (this.data.setId) this.loadDetail()
  },

  async loadDetail() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await requestLib.request(`/word_sets/${this.data.setId}`, { method: 'GET' })
      if (res && res.code === 200) {
        this.setData({
          setInfo: res.data,
          words: res.data.words || []
        })
      } else {
        wx.showToast({ title: res.message || '加载失败', icon: 'none' })
      }
    } catch (err) {
      console.error('加载失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  addWords() {
    this.setData({ showAdd: true, searchWord: '', lookupResult: null })
  },

  hideAddDialog() {
    this.setData({ showAdd: false })
  },

  onSearchInput(e) {
    this.setData({ searchWord: e.detail.value })
  },

  async searchWord() {
    const word = this.data.searchWord.trim()
    if (!word) return

    wx.showLoading({ title: '查找中...' })
    try {
      const res = await requestLib.request(`/word_sets/lookup/${encodeURIComponent(word)}`, { method: 'GET' })
      if (res && res.code === 200) {
        this.setData({ lookupResult: res.data })
      } else {
        wx.showToast({ title: res.message || '查找失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '查找失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async confirmAddWord() {
    const result = this.data.lookupResult
    if (!result) return

    wx.showLoading({ title: '添加中...' })
    try {
      const res = await requestLib.request(`/word_sets/${this.data.setId}/words`, {
        method: 'POST',
        data: {
          wordId: result.word_id || result.id
        }
      })
      if (res && (res.code === 200 || res.code === 201)) {
        wx.showToast({ title: '添加成功', icon: 'success' })
        this.hideAddDialog()
        this.loadDetail()
      } else {
        wx.showToast({ title: res.message || '添加失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  openWord(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/word-detail/word-detail?id=${id}` })
  },

  startLearning() {
    wx.navigateTo({ url: `/pages/flash-card/flash-card?source=wordset&sourceId=${this.data.setId}` })
  },

  deleteSet() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个单词集吗？操作不可撤销。',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          try {
            const result = await requestLib.request(`/word_sets/${this.data.setId}`, { method: 'DELETE' })
            if (result && result.code === 200) {
              wx.showToast({ title: '已删除', icon: 'success' })
              setTimeout(() => wx.navigateBack(), 1000)
            } else {
              wx.showToast({ title: '删除失败', icon: 'none' })
            }
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  }
})