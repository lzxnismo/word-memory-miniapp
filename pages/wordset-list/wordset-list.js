// pages/wordset-list/wordset-list.js - 微信云托管版
const requestLib = require('../../utils/request')

Page({
  data: {
    sets: [],
    showCreate: false,
    newName: '',
    newDesc: '',
    newColor: '#667eea',
    colors: ['#667eea', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e02', '#3498db']
  },

  onShow() {
    this.loadSets()
  },

  // 加载单词集列表
  async loadSets() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await requestLib.request('/word_sets')
      if (res && res.data) {
        this.setData({ sets: res.data })
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
      const res = await requestLib.request('/word_sets', {
        method: 'POST',
        data: {
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          color: newColor
        }
      })
      
      if (res && res.code === 201) {
        wx.showToast({ title: '创建成功', icon: 'success' })
        this.hideCreateDialog()
        this.loadSets()
      } else {
        wx.showToast({ title: res.message || '创建失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})