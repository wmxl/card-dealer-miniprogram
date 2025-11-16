// pages/assassinate/assassinate.js
Page({
  data: {
    roomId: '',
    playerNumber: 0,
    role: null,
    isAssassin: false,
    allPlayers: [],
    selectedPlayer: 0,
    showRulesModal: false,
    loading: true,
    resultShown: false
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

    this.loadGameInfo()
    this.startStatusWatcher()
  },

  onUnload() {
    if (this.statusTimer) {
      clearInterval(this.statusTimer)
    }
  },

  // 加载游戏信息
  async loadGameInfo() {
    try {
      // 加载玩家角色
      const roleRes = await wx.cloud.callFunction({
        name: 'getPlayerRole',
        data: {
          room_id: this.data.roomId,
          player_number: this.data.playerNumber
        }
      })

      // 加载所有玩家
      const roomRes = await wx.cloud.callFunction({
        name: 'getRoomInfo',
        data: {
          room_id: this.data.roomId
        }
      })

      if (roleRes.result && roleRes.result.success && roomRes.result) {
        const role = roleRes.result.role
        const isAssassin = role.code === 'assassin'

        this.setData({
          role: role,
          isAssassin: isAssassin,
          allPlayers: roomRes.result.players || [],
          loading: false
        })
      }
    } catch (error) {
      console.error('加载游戏信息失败', error)
      this.setData({ loading: false })
    }
  },

  startStatusWatcher() {
    if (this.statusTimer) {
      clearInterval(this.statusTimer)
    }
    this.statusTimer = setInterval(() => {
      this.checkRoomStatus()
    }, 3000)
  },

  async checkRoomStatus() {
    if (this.data.resultShown) {
      return
    }
    try {
      const roomRes = await wx.cloud.callFunction({
        name: 'getRoomInfo',
        data: {
          room_id: this.data.roomId
        }
      })

      if (roomRes.result && roomRes.result.status === 'finished') {
        this.handleGameFinished(roomRes.result.game_state)
      }
    } catch (error) {
      console.error('检查房间状态失败', error)
    }
  },

  // 选择玩家
  selectPlayer(e) {
    if (!this.data.isAssassin) return

    const playerNumber = e.currentTarget.dataset.player
    this.setData({
      selectedPlayer: playerNumber
    })
  },

  // 确认刺杀
  async confirmAssassinate() {
    if (!this.data.selectedPlayer) {
      wx.showToast({
        title: '请选择要刺杀的玩家',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认刺杀',
      content: `确定刺杀${this.data.selectedPlayer}号玩家吗？这将决定游戏的最终胜负！`,
      success: async (res) => {
        if (res.confirm) {
          await this.doAssassinate()
        }
      }
    })
  },

  // 执行刺杀
  async doAssassinate() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'assassinate',
        data: {
          room_id: this.data.roomId,
          target_player: this.data.selectedPlayer
        }
      })

      if (res.result && res.result.success) {
        this.setData({ resultShown: true })
        this.redirectToGame()
      } else {
        wx.showToast({
          title: res.result?.error || '刺杀失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('刺杀失败', error)
      wx.showToast({
        title: '刺杀失败，请重试',
        icon: 'none'
      })
    }
  },

  handleGameFinished(gameState = {}) {
    if (this.data.resultShown) {
      return
    }
    this.setData({ resultShown: true })
    this.redirectToGame()
  },

  redirectToGame() {
    wx.redirectTo({
      url: `/pages/game/game?room_id=${this.data.roomId}&player_number=${this.data.playerNumber}`
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
