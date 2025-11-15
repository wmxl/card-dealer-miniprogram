// pages/role-reveal/role-reveal.js
Page({
  data: {
    roomId: '',
    playerNumber: 0,
    nickname: '',
    role: null,
    seePlayers: [],
    message: '',
    tip: '',
    loading: true,
    showRulesModal: false,
    confirmed: false
  },

  onLoad(options) {
    const roomId = options.room_id
    const playerNumber = parseInt(options.player_number)

    if (!roomId || !playerNumber) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({
      roomId: roomId,
      playerNumber: playerNumber
    })

    this.loadRoleInfo()
  },

  // 加载角色信息
  async loadRoleInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPlayerRole',
        data: {
          room_id: this.data.roomId,
          player_number: this.data.playerNumber
        }
      })

      if (res.result && res.result.success) {
        this.setData({
          nickname: res.result.nickname,
          role: res.result.role,
          seePlayers: res.result.seePlayers || [],
          message: res.result.message,
          tip: res.result.tip,
          loading: false
        })
      } else {
        wx.showToast({
          title: res.result?.error || '加载失败',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (error) {
      console.error('加载角色信息失败', error)
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  // 确认身份
  confirmRole() {
    this.setData({
      confirmed: true
    })

    wx.showModal({
      title: '确认身份',
      content: '确认后将进入游戏主界面，确定吗？',
      success: (res) => {
        if (res.confirm) {
          // 跳转到游戏主界面
          wx.redirectTo({
            url: `/pages/game/game?room_id=${this.data.roomId}&player_number=${this.data.playerNumber}`
          })
        } else {
          this.setData({
            confirmed: false
          })
        }
      }
    })
  },

  // 显示规则
  showRules() {
    this.setData({
      showRulesModal: true
    })
  },

  // 隐藏规则
  hideRules() {
    this.setData({
      showRulesModal: false
    })
  }
})
