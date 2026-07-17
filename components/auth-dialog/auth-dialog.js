// components/auth-dialog/auth-dialog.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
      observer: function(newVal) {
        if (newVal && !this.authDialogShowing) {
          this.authDialogShowing = true
        } else if (!newVal) {
          this.authDialogShowing = false
        }
      }
    },
    message: {
      type: String,
      value: '为了保存您的学习进度和复习记录'
    }
  },

  data: {
    authDialogShowing: false
  },

  methods: {
    // 点击遮罩层（可关闭）
    handleMaskTap(e) {
      // 只允许通过按钮关闭，不响应遮罩点击
      e.stopPropagation()
    },

    // 取消授权
    handleCancel() {
      this.setData({ show: false })
      this.triggerEvent('cancel', {})
    },

    // 允许授权
    handleAuthorize() {
      this.setData({ show: false })
      this.triggerEvent('authorize', {})
      // 触发全局授权事件，通知父组件获取 OpenID
      const app = getApp()
      if (app.getOpenId) {
        app.getOpenId().then(openId => {
          wx.setStorageSync('wx_openId', openId)
          app.globalData.openId = openId
        }).catch(err => {
          console.error('重新获取 OpenID 失败:', err)
        })
      }
    }
  }
})
