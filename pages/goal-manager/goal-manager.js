// pages/goal-manager/goal-manager.js - 微信云托管版
const requestLib = require('../../utils/request')

Page({
  data: {
    activeGoals: [],
    completedGoals: [],
    showDialog: false,
    editingId: null,
    form: {
      title: '',
      type: 'daily',
      target_value: '',
      unit: '词'
    }
  },

  onShow() {
    this.loadGoals()
  },

  async loadGoals() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await requestLib.request('/goal_manager', { method: 'GET' })
      if (res && res.code === 200) {
        const goals = res.data || []
        this.setData({
          activeGoals: goals.filter(g => g.status === 'active'),
          completedGoals: goals.filter(g => g.status === 'completed')
        })
      }
    } catch (err) {
      console.error('加载失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  showCreateDialog() {
    this.setData({
      showDialog: true,
      editingId: null,
      form: { title: '', type: 'daily', target_value: '', unit: '词' }
    })
  },

  hideDialog() {
    this.setData({ showDialog: false })
  },

  editGoal(e) {
    const id = e.currentTarget.dataset.id
    const goal = this.data.activeGoals.find(g => g.id === id)
    if (goal) {
      this.setData({
        showDialog: true,
        editingId: id,
        form: {
          title: goal.title,
          type: goal.type,
          target_value: String(goal.target_value),
          unit: goal.unit
        }
      })
    }
  },

  onTitleInput(e) {
    this.setData({ 'form.title': e.detail.value })
  },
  onTargetInput(e) {
    this.setData({ 'form.target_value': e.detail.value })
  },
  selectType(e) {
    this.setData({ 'form.type': e.currentTarget.dataset.type })
  },
  selectUnit(e) {
    this.setData({ 'form.unit': e.currentTarget.dataset.unit })
  },

  async saveGoal() {
    const { title, type, target_value, unit } = this.data.form
    if (!title.trim()) {
      wx.showToast({ title: '请输入目标名称', icon: 'none' })
      return
    }
    if (!target_value || parseInt(target_value) <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })
    try {
      const action = this.data.editingId ? 'update' : 'create'
      const data = {
        title: title.trim(),
        type,
        target_value: parseInt(target_value),
        unit
      }
      if (this.data.editingId) {
        data.goal_id = parseInt(this.data.editingId)
      }

      const res = await requestLib.request('/goal_manager', {
        method: 'POST',
        data
      })
      if (res && (res.code === 200 || res.code === 201)) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.hideDialog()
        this.loadGoals()
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})