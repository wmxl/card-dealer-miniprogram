// pages/create/create.js
Page({
  data: {
    maxPlayers: 10,
    loading: false
  },

  // 选择人数
  selectPlayers(e) {
    const value = parseInt(e.currentTarget.dataset.value)
    this.setData({
      maxPlayers: value
    })
  },

  // 创建房间
  async createRoom() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'createRoom',
        data: {
          max_players: this.data.maxPlayers
        }
      })

      if (res.result && res.result.room_id) {
        const roomId = res.result.room_id

        // 跳转到房间页面
        wx.redirectTo({
          url: `/pages/room/room?room_id=${roomId}&is_creator=true`
        })
      } else {
        wx.showToast({
          title: res.result?.error || '创建失败',
          icon: 'none'
        })
        this.setData({ loading: false })
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
