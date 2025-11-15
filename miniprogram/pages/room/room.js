// pages/room/room.js
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
    gameStarted: false
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
        this.setData({
          maxPlayers: data.max_players,
          currentPlayers: data.current_players,
          players: data.players,
          gameStarted: data.status === 'started'
        })

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

    this.setData({ loading: true })

    try {
      // 获取用户信息
      const userInfo = await this.getUserInfo()

      const res = await wx.cloud.callFunction({
        name: 'joinRoom',
        data: {
          room_id: this.data.roomId,
          nickname: userInfo.nickName || ''
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

  // 获取用户信息
  getUserInfo() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于显示昵称',
        success: (res) => {
          resolve(res.userInfo)
        },
        fail: () => {
          resolve({ nickName: '' })
        }
      })
    })
  },

  // 发牌
  async dealCards() {
    if (this.data.loading || this.data.gameStarted) return

    if (this.data.currentPlayers < 2) {
      wx.showToast({
        title: '至少需要2人',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认发牌',
      content: '确定要发牌吗？发牌后所有人将看到分配的字母',
      success: async (res) => {
        if (res.confirm) {
          await this.doDealCards()
        }
      }
    })
  },

  // 执行发牌
  async doDealCards() {
    this.setData({ loading: true })

    try {
      const dealRes = await wx.cloud.callFunction({
        name: 'dealCards',
        data: {
          room_id: this.data.roomId
        }
      })

      if (dealRes.result && dealRes.result.players) {
        this.setData({
          players: dealRes.result.players,
          gameStarted: true,
          loading: false
        })

        // 找到自己的字母
        const myPlayer = dealRes.result.players.find(
          p => p.player_number === this.data.myPlayerNumber
        )
        if (myPlayer) {
          this.setData({
            myLetter: myPlayer.letter
          })
        }

        wx.showToast({
          title: '发牌成功',
          icon: 'success'
        })
      } else {
        wx.showToast({
          title: dealRes.result?.error || '发牌失败',
          icon: 'none'
        })
        this.setData({ loading: false })
      }
    } catch (error) {
      console.error('发牌失败', error)
      wx.showToast({
        title: '发牌失败，请重试',
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
  }
})
