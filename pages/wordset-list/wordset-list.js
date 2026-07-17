// pages/wordset-list/wordset-list.js
Page({
  data: {
    sets: [],
    showCreate: false,
    newName: '',
    newDesc: '',
    newColor: '#667eea',
    colors: ['#667eea', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#3498db']
  },

  onShow() {
    this.loadSets()
  },

  // 加载单词集列表
  async loadSets() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await wx.cloud.callContainer({
        path: '/api/v1/word_sets',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { action: 'list' }
      })
      if (res.statusCode === 200 && res.data && res.data.code === 200) {
        this.setData({ sets: res.data.data })
      }
    } catch (err) {
      console.error('加载失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 打开单词集
  openSet(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/wordset-detail/wordset-detail?id=${id}` })
  },

  // 显示创建对话框
  showCreateDialog() {
    this.setData({ showCreate: true, newName: '', newDesc: '' })
  },

  // 隐藏创建对话框
  hideCreateDialog() {
    this.setData({ showCreate: false })
  },

  // 输入处理
  onNameInput(e) {
    this.setData({ newName: e.detail.value })
  },
  onDescInput(e) {
    this.setData({ newDesc: e.detail.value })
  },
  selectColor(e) {
    this.setData({ newColor: e.currentTarget.dataset.color })
  },

  // 创建单词集
  async createSet() {
    const { newName, newDesc, newColor } = this.data
    if (!newName.trim()) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '创建中...' })
    try {
      const res = await wx.cloud.callContainer({
        path: '/api/v1/word_sets',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: {
          action: 'create',
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          color: newColor
        }
      })
      if (res.statusCode === 200 && res.data && res.data.code === 201) {
        wx.showToast({ title: '创建成功', icon: 'success' })
        this.hideCreateDialog()
        this.loadSets()
      } else {
        wx.showToast({ title: res.result.message || '创建失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})