// pages/role-reveal/role-reveal.js
const ROLE_DISPLAY_DURATION = 3000

function getRoleSeenStorageKey(roomId, playerNumber, gameId) {
  const normalizedPlayer = parseInt(playerNumber, 10)
  if (!roomId || !normalizedPlayer || !gameId) {
    return ''
  }
  return `role_seen_${roomId}_${normalizedPlayer}_${gameId}`
}

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
    confirmed: false,
    gameId: ''
  },

  onLoad(options) {
    const roomId = options.room_id
    const playerNumber = parseInt(options.player_number)
    const gameId = options.game_id || ''

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
      gameId: gameId
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

        this.markRoleAsSeen()

        // 自动确认并进入游戏（延迟3秒，让玩家能看到身份）
        setTimeout(() => {
          this.autoEnterGame()
        }, ROLE_DISPLAY_DURATION)
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

  // 自动进入游戏（不弹出确认对话框）
  autoEnterGame() {
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
  },

  markRoleAsSeen() {
    const key = getRoleSeenStorageKey(this.data.roomId, this.data.playerNumber, this.data.gameId)
    if (!key) return
    wx.setStorageSync(key, {
      seen: true,
      timestamp: Date.now()
    })
  }
})
