// pages/wordset-detail/wordset-detail.js
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
    // 每次显示时刷新数据
    if (this.data.setId) {
      this.loadDetail()
    }
  },

  // 加载详情
  async loadDetail() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await wx.cloud.callContainer({
        path: '/api/v1/word_sets',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { action: 'getDetail', set_id: parseInt(this.data.setId) }
      })
      if (res.statusCode === 200 && res.data && res.data.code === 200) {
        this.setData({
          setInfo: res.data.data,
          words: res.data.data.words || []
        })
      } else {
        wx.showToast({ title: res.data.message || '加载失败', icon: 'none' })
      }
    } catch (err) {
      console.error('加载失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 显示添加对话框
  addWords() {
    this.setData({ showAdd: true, searchWord: '', lookupResult: null })
  },

  hideAddDialog() {
    this.setData({ showAdd: false })
  },

  onSearchInput(e) {
    this.setData({ searchWord: e.detail.value })
  },

  // 查词
  async searchWord() {
    const word = this.data.searchWord.trim()
    if (!word) return

    wx.showLoading({ title: '查找中...' })
    try {
      const res = await wx.cloud.callContainer({
        path: '/api/v1/word_sets',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { action: 'lookup', word_id: word }
      })
      if (res.statusCode === 200 && res.data && res.data.code === 200) {
        this.setData({ lookupResult: res.data.data })
      } else {
        wx.showToast({ title: res.data.message || '查找失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '查找失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 确认添加
  async confirmAddWord() {
    const result = this.data.lookupResult
    if (!result) return

    wx.showLoading({ title: '添加中...' })
    try {
      const res = await wx.cloud.callContainer({
        path: '/api/v1/word_sets',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: {
          action: 'addWord',
          set_id: parseInt(this.data.setId),
          word_id: result.word_id,
          word: result.word
        }
      })
      if (res.statusCode === 200 && res.data && res.data.code === 201) {
        wx.showToast({ title: '添加成功', icon: 'success' })
        this.hideAddDialog()
        this.loadDetail()
      } else {
        wx.showToast({ title: res.data.message || '添加失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '添加失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 打开单词详情
  openWord(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/word-detail/word-detail?id=${id}` })
  },

  // 开始学习
  startLearning() {
    wx.navigateTo({ url: `/pages/flash-card/flash-card?source=wordset&sourceId=${this.data.setId}` })
  },

  // 删除单词集
  deleteSet() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个单词集吗？操作不可撤销。',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          try {
            const result = await wx.cloud.callContainer({
              path: '/api/v1/word_sets',
              method: 'POST',
              header: { 'content-type': 'application/json' },
              data: { action: 'delete', set_id: parseInt(this.data.setId) }
            })
            if (result.statusCode === 200 && result.data && result.data.code === 204) {
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