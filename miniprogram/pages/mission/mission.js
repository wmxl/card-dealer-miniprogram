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

    this.hasShownResult = false // 防止重复显示任务结果弹窗

    this.setData({
      roomId: roomId,
      playerNumber: playerNumber,
      isParticipant: isParticipant,
      loading: false
    })

    this.loadPlayerRole()
    this.checkMissionStatus()

    // 更新玩家在线状态为在线
    this.updatePlayerStatusSync('online')

    // 设置定时检查任务状态
    this.missionTimer = setInterval(() => {
      this.checkMissionStatus()
    }, 2000)
  },

  onUnload() {
    if (this.missionTimer) {
      clearInterval(this.missionTimer)
    }
    // 更新玩家在线状态为离开
    this.updatePlayerStatusSync('away')
  },

  onShow() {
    // 页面显示时更新为在线
    this.updatePlayerStatusSync('online')
  },

  onHide() {
    // 页面隐藏时更新为离开
    this.updatePlayerStatusSync('away')
  },

  // 更新玩家在线状态（同步调用，不等待结果）
  updatePlayerStatusSync(status) {
    wx.cloud.callFunction({
      name: 'updatePlayerStatus',
      data: {
        room_id: this.data.roomId,
        player_number: this.data.playerNumber,
        status: status
      }
    }).catch(error => {
      console.error('更新玩家状态失败', error)
    })
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

  // 检查任务状态
  async checkMissionStatus() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getRoomInfo',
        data: {
          room_id: this.data.roomId
        }
      })

      if (res.result && res.result.room_id) {
        const room = res.result
        const gameState = room.game_state || {}
        const missionSubmissions = gameState.mission_submissions || {}
        const nominatedPlayers = gameState.nominated_players || []
        const status = room.status

        // 检查玩家是否已提交
        const hasSubmitted = missionSubmissions[this.data.playerNumber] !== undefined

        // 如果玩家已提交，更新状态
        if (hasSubmitted && !this.data.submitted) {
          this.setData({ submitted: true })
        }

        // 如果房间状态不再是任务阶段，跳转回游戏页面
        // 游戏页面会自动检测任务结果并显示弹窗
        if (status !== 'mission') {
          if (this.missionTimer) {
            clearInterval(this.missionTimer)
          }
          wx.redirectTo({
            url: `/pages/game/game?room_id=${this.data.roomId}&player_number=${this.data.playerNumber}`
          })
        }
      }
    } catch (error) {
      console.error('检查任务状态失败', error)
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
        this.setData({ submitted: true })

        wx.showToast({
          title: '提交成功',
          icon: 'success',
          duration: 1500
        })

        // 等待一下，让其他玩家也提交，然后跳转回游戏页面
        // 游戏页面会自动检测任务结果并显示弹窗
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
