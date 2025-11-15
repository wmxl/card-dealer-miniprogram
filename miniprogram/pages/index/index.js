// pages/index/index.js
const app = getApp()

Page({
  data: {
    roomId: '',
    showRulesModal: false,
    hasCurrentRoom: false,
    currentRoom: null
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
      return
    }

    // 检查是否有当前房间
    this.checkCurrentRoom()
  },

  // 检查当前房间
  checkCurrentRoom() {
    const currentRoom = wx.getStorageSync('current_room')
    if (currentRoom && currentRoom.room_id) {
      // 检查是否过期（24小时）
      const isExpired = (Date.now() - currentRoom.timestamp) > 24 * 60 * 60 * 1000
      if (!isExpired) {
        this.setData({
          hasCurrentRoom: true,
          currentRoom: currentRoom
        })
      } else {
        // 清除过期数据
        wx.removeStorageSync('current_room')
      }
    }
  },

  // 继续游戏
  continueGame() {
    const room = this.data.currentRoom
    wx.redirectTo({
      url: `/pages/room/room?room_id=${room.room_id}&player_number=${room.player_number}${room.is_creator ? '&is_creator=true' : ''}`
    })
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
            await this.doJoinRoom(roomId, nickname)
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
  async doJoinRoom(roomId, nickname) {
    wx.showLoading({ title: '加入中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'joinRoom',
        data: {
          room_id: roomId,
          nickname: nickname
        }
      })

      wx.hideLoading()

      if (res.result && res.result.player_number) {
        // 保存房间信息到缓存
        wx.setStorageSync('current_room', {
          room_id: roomId,
          player_number: res.result.player_number,
          nickname: nickname,
          timestamp: Date.now()
        })

        wx.showToast({
          title: '加入成功',
          icon: 'success',
          duration: 1000
        })

        // 直接跳转到房间页面
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/room/room?room_id=${roomId}&player_number=${res.result.player_number}`
          })
        }, 1000)
      } else {
        wx.showToast({
          title: res.result?.error || '加入失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('加入房间失败', error)
      wx.showToast({
        title: '加入失败，请重试',
        icon: 'none'
      })
    }
  },

  // 输入房间号
  inputRoomId(e) {
    this.setData({
      roomId: e.detail.value
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
