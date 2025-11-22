// pages/room/room.js

function getRoleSeenKey(roomId, playerNumber, gameId) {
  const normalizedPlayerNumber = parseInt(playerNumber, 10)
  if (!roomId || !normalizedPlayerNumber || !gameId) {
    return ''
  }
  return `role_seen_${roomId}_${normalizedPlayerNumber}_${gameId}`
}

function hasRoleBeenSeen(roomId, playerNumber, gameId) {
  const key = getRoleSeenKey(roomId, playerNumber, gameId)
  if (!key) return false
  const stored = wx.getStorageSync(key)
  if (stored && typeof stored === 'object') {
    return !!stored.seen
  }
  return !!stored
}

Page({
  data: {
    roomId: '',
    isCreator: false,
    maxPlayers: 10,
    currentPlayers: 0,
    players: [],
    myPlayerNumber: 0,
    myLetter: '',
    loading: false,
    gameStarted: false,
    showRulesModal: false,
    currentGameId: ''
  },

  onLoad(options) {
    const roomId = options.room_id
    const isCreator = options.is_creator === 'true'
    const playerNumber = options.player_number ? parseInt(options.player_number) : 0

    if (!roomId) {
      wx.showToast({
        title: '房间号错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.hasJumped = false // 防止重复跳转

    this.setData({
      roomId: roomId,
      isCreator: isCreator,
      myPlayerNumber: playerNumber // 如果是创建者，自动设置玩家编号
    })

    // 加载房间信息
    this.loadRoomInfo()

    // 设置定时刷新
    this.timer = setInterval(() => {
      this.loadRoomInfo()
    }, 2000) // 每2秒刷新一次
  },

  onUnload() {
    // 清除定时器
    if (this.timer) {
      clearInterval(this.timer)
    }
  },

  // 加载房间信息
  async loadRoomInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getRoomInfo',
        data: {
          room_id: this.data.roomId
        }
      })

      if (res.result && res.result.room_id) {
        const data = res.result
        const gameStarted = data.status !== 'waiting'
        const gameId = (data.game_state && data.game_state.game_id) || ''

        // 检查当前玩家是否是房主（1号玩家）
        const isCreator = this.data.myPlayerNumber === 1

        this.setData({
          maxPlayers: data.max_players,
          currentPlayers: data.current_players,
          players: data.players,
          gameStarted: gameStarted,
          isCreator: isCreator || this.data.isCreator, // 保留原有的isCreator，或者根据玩家编号判断
          currentGameId: gameId
        })

        // 如果游戏已开始，直接跳转到游戏页面（无需检查角色）
        if (gameStarted && this.data.myPlayerNumber > 0 && !this.hasJumped) {
          this.hasJumped = true
          wx.redirectTo({
            url: this.buildGameUrl()
          })
        }

        // 检查自己的字母
        const myPlayer = data.players.find(p => p.player_number === this.data.myPlayerNumber)
        if (myPlayer && myPlayer.letter) {
          this.setData({
            myLetter: myPlayer.letter
          })
        }
      } else if (res.result?.error) {
        console.error('加载房间信息失败', res.result.error)
      }
    } catch (error) {
      console.error('加载房间信息失败', error)
    }
  },

  // 加入房间
  async joinRoom() {
    if (this.data.loading) return

    // 获取缓存的昵称
    const cachedNickname = wx.getStorageSync('user_nickname') || ''

    // 弹窗输入昵称
    wx.showModal({
      title: '输入昵称',
      editable: true,
      placeholderText: '请输入昵称',
      content: cachedNickname,
      success: async (res) => {
        if (res.confirm) {
          const nickname = (res.content || '').trim()
          if (nickname) {
            // 保存昵称到缓存
            wx.setStorageSync('user_nickname', nickname)
            await this.doJoinRoom(nickname)
          } else {
            wx.showToast({
              title: '请输入昵称',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 执行加入房间
  async doJoinRoom(nickname) {
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'joinRoom',
        data: {
          room_id: this.data.roomId,
          nickname: nickname
        }
      })

      if (res.result && res.result.player_number) {
        this.setData({
          myPlayerNumber: res.result.player_number,
          loading: false
        })

        wx.showToast({
          title: '加入成功',
          icon: 'success'
        })

        // 刷新房间信息
        this.loadRoomInfo()
      } else {
        wx.showToast({
          title: res.result?.error || '加入失败',
          icon: 'none'
        })
        this.setData({ loading: false })
      }
    } catch (error) {
      console.error('加入房间失败', error)
      wx.showToast({
        title: '加入失败，请重试',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  // 分配角色
  async dealCards() {
    if (this.data.loading || this.data.gameStarted) return

    if (this.data.currentPlayers < 3) {
      wx.showToast({
        title: '至少需要3人',
        icon: 'none'
      })
      return
    }

    if (this.data.currentPlayers > 12) {
      wx.showToast({
        title: '最多支持12人',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认分配角色',
      content: `确定要开始游戏吗？将为${this.data.currentPlayers}名玩家分配角色`,
      success: async (res) => {
        if (res.confirm) {
          await this.doDealCards()
        }
      }
    })
  },

  // 执行角色分配
  async doDealCards() {
    this.setData({ loading: true })

    try {
      const dealRes = await wx.cloud.callFunction({
        name: 'dealCards',
        data: {
          room_id: this.data.roomId
        }
      })

      if (dealRes.result && dealRes.result.success) {
        const newGameId = dealRes.result.game_id || ''
        if (newGameId) {
          this.setData({ currentGameId: newGameId })
        }
        wx.showToast({
          title: '角色分配成功',
          icon: 'success',
          duration: 1500
        })

        // 跳转到角色查看页面
        setTimeout(() => {
          this.hasJumped = true
          wx.redirectTo({
            url: this.buildRoleRevealUrl(newGameId)
          })
        }, 1500)
      } else {
        wx.showToast({
          title: dealRes.result?.error || '角色分配失败',
          icon: 'none'
        })
        this.setData({ loading: false })
      }
    } catch (error) {
      console.error('角色分配失败', error)
      wx.showToast({
        title: '角色分配失败，请重试',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  // 分享房间
  onShareAppMessage() {
    return {
      title: `桌游发牌助手 - 房间号：${this.data.roomId}`,
      path: `/pages/index/index?room_id=${this.data.roomId}`
    }
  },

  // 跳转到角色查看页面
  goToRoleReveal() {
    wx.redirectTo({
      url: this.buildRoleRevealUrl()
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

  // 重置房间（仅创建者）
  async resetRoom() {
    if (!this.data.isCreator) return

    wx.showModal({
      title: '确认重置',
      content: '确定要重置房间吗？这将清空所有玩家和字母',
      success: async (res) => {
        if (res.confirm) {
          try {
            const resetRes = await wx.cloud.callFunction({
              name: 'resetRoom',
              data: {
                room_id: this.data.roomId
              }
            })

            if (resetRes.result && !resetRes.result.error) {
              this.setData({
                players: [],
                currentPlayers: 0,
                myPlayerNumber: 0,
                myLetter: '',
                gameStarted: false
              })

              wx.showToast({
                title: '房间已重置',
                icon: 'success'
              })

              // 刷新房间信息
              this.loadRoomInfo()
            } else {
              wx.showToast({
                title: resetRes.result?.error || '重置失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('重置失败', error)
            wx.showToast({
              title: '重置失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  buildRoleRevealUrl(gameId = '') {
    const effectiveGameId = gameId || this.data.currentGameId
    const extra = effectiveGameId ? `&game_id=${effectiveGameId}` : ''
    return `/pages/role-reveal/role-reveal?room_id=${this.data.roomId}&player_number=${this.data.myPlayerNumber}${extra}`
  },

  buildGameUrl() {
    return `/pages/game/game?room_id=${this.data.roomId}&player_number=${this.data.myPlayerNumber}`
  },

  shouldSkipRoleReveal(gameId) {
    return hasRoleBeenSeen(this.data.roomId, this.data.myPlayerNumber, gameId)
  }
})
