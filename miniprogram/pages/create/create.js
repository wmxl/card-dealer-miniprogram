// pages/create/create.js
Page({
  data: {
    maxPlayers: 5,
    loading: false,
    showRulesModal: false
  },

  // 选择人数
  selectPlayers(e) {
    const value = parseInt(e.currentTarget.dataset.value)
    this.setData({
      maxPlayers: value
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

  // 创建房间
  async createRoom() {
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
            await this.doCreateRoom(nickname)
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

  // 执行创建房间
  async doCreateRoom(nickname) {
    this.setData({ loading: true })

    try {
      // 1. 创建房间
      const createRes = await wx.cloud.callFunction({
        name: 'createRoom',
        data: {
          max_players: this.data.maxPlayers
        }
      })

      if (!createRes.result || !createRes.result.room_id) {
        wx.showToast({
          title: createRes.result?.error || '创建失败',
          icon: 'none'
        })
        this.setData({ loading: false })
        return
      }

      const roomId = createRes.result.room_id

      // 2. 自动加入房间
      try {
        const joinRes = await wx.cloud.callFunction({
          name: 'joinRoom',
          data: {
            room_id: roomId,
            nickname: nickname
          }
        })

        if (joinRes.result && joinRes.result.player_number) {
          // 保存房间信息到缓存
          wx.setStorageSync('current_room', {
            room_id: roomId,
            player_number: joinRes.result.player_number,
            nickname: nickname,
            is_creator: true,
            timestamp: Date.now()
          })

          // 3. 跳转到房间页面，并传递玩家编号
          wx.redirectTo({
            url: `/pages/room/room?room_id=${roomId}&is_creator=true&player_number=${joinRes.result.player_number}`
          })
        } else {
          // 加入失败，但仍然跳转到房间页面，用户可以手动加入
          wx.showToast({
            title: '房间创建成功，请手动加入',
            icon: 'none',
            duration: 2000
          })
          setTimeout(() => {
            wx.redirectTo({
              url: `/pages/room/room?room_id=${roomId}&is_creator=true`
            })
          }, 2000)
        }
      } catch (joinError) {
        console.error('自动加入房间失败', joinError)
        // 加入失败，但仍然跳转到房间页面
        wx.showToast({
          title: '房间创建成功，请手动加入',
          icon: 'none',
          duration: 2000
        })
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/room/room?room_id=${roomId}&is_creator=true`
          })
        }, 2000)
      }
    } catch (error) {
      console.error('创建房间失败', error)
      wx.showToast({
        title: '创建失败，请重试',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  }
})
