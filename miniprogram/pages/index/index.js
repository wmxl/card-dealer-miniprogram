// pages/index/index.js
const app = getApp()

Page({
  data: {
    roomId: ''
  },

  onLoad(options) {
    // 从分享链接进入时，获取room_id参数
    if (options.room_id) {
      this.setData({
        roomId: options.room_id
      })
      // 自动跳转到房间页面
      wx.redirectTo({
        url: `/pages/room/room?room_id=${options.room_id}`
      })
    }
  },

  // 创建房间
  createRoom() {
    wx.navigateTo({
      url: '/pages/create/create'
    })
  },

  // 加入房间
  joinRoom() {
    const roomId = this.data.roomId.trim().toUpperCase()
    if (!roomId) {
      wx.showToast({
        title: '请输入房间号',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: `/pages/room/room?room_id=${roomId}`
    })
  },

  // 输入房间号
  inputRoomId(e) {
    this.setData({
      roomId: e.detail.value
    })
  }
})
