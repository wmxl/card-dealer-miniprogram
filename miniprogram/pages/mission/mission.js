// pages/mission/mission.js
Page({
  data: {
    roomId: '',
    playerNumber: 0,
    isParticipant: false,
    role: null,
    submitted: false,
    showRulesModal: false,
    loading: true
  },

  onLoad(options) {
    const roomId = options.room_id
    const playerNumber = parseInt(options.player_number)
    const isParticipant = options.is_participant === 'true'

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
      playerNumber: playerNumber,
      isParticipant: isParticipant,
      loading: false
    })

    this.loadPlayerRole()
  },

  // 加载玩家角色
  async loadPlayerRole() {
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
          role: res.result.role
        })
      }
    } catch (error) {
      console.error('加载角色失败', error)
    }
  },

  // 提交任务结果
  async submitMission(e) {
    const success = e.currentTarget.dataset.success === 'true'

    // 好人只能提交成功
    if (this.data.role && this.data.role.side === 'good' && !success) {
      wx.showToast({
        title: '好人只能选择成功',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认提交',
      content: `确定提交"${success ? '成功' : '失败'}"吗？提交后无法修改`,
      success: async (res) => {
        if (res.confirm) {
          await this.doSubmitMission(success)
        }
      }
    })
  },

  // 执行提交
  async doSubmitMission(success) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'submitMission',
        data: {
          room_id: this.data.roomId,
          player_number: this.data.playerNumber,
          success: success
        }
      })

      if (res.result && res.result.success) {
        wx.showToast({
          title: '提交成功',
          icon: 'success',
          duration: 1500
        })

        this.setData({ submitted: true })

        // 返回游戏页面
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/game/game?room_id=${this.data.roomId}&player_number=${this.data.playerNumber}`
          })
        }, 1500)
      } else {
        wx.showToast({
          title: res.result?.error || '提交失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('提交任务结果失败', error)
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      })
    }
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
