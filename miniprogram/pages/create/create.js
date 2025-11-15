// pages/create/create.js
Page({
  data: {
    maxPlayers: 12,
    loading: false
  },

  // 选择人数
  selectPlayers(e) {
    const value = parseInt(e.currentTarget.dataset.value)
    this.setData({
      maxPlayers: value
    })
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

  // 创建房间
  async createRoom() {
    if (this.data.loading) return

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
        const userInfo = await this.getUserInfo()

        const joinRes = await wx.cloud.callFunction({
          name: 'joinRoom',
          data: {
            room_id: roomId,
            nickname: userInfo.nickName || ''
          }
        })

        if (joinRes.result && joinRes.result.player_number) {
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
