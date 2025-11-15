// pages/game/game.js
Page({
  data: {
    roomId: '',
    playerNumber: 0,
    nickname: '',
    role: null,

    // 游戏状态
    gameState: null,
    missionConfig: [],
    allPlayers: [],
    nominatedPlayersInfo: [], // 提名玩家详细信息

    // 当前状态
    currentMission: 0,  // 0-4
    currentRound: 0,
    currentLeader: 0,
    missionResults: [],
    consecutiveRejects: 0,
    goodWins: 0,
    evilWins: 0,

    // UI状态
    isLeader: false,
    selectedPlayers: [],
    votePhase: false,
    missionPhase: false,

    showRulesModal: false,
    loading: true
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

    this.hasMissionJumped = false // 防止重复跳转到任务页面

    this.setData({
      roomId: roomId,
      playerNumber: playerNumber
    })

    this.loadGameState()

    // 设置定时刷新
    this.timer = setInterval(() => {
      this.loadGameState()
    }, 3000)
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  },

  // 加载游戏状态
  async loadGameState() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getRoomInfo',
        data: {
          room_id: this.data.roomId
        }
      })

      if (res.result && res.result.room_id) {
        const data = res.result
        const gameState = data.game_state || {}
        const currentLeader = gameState.current_leader || 0

        console.log('游戏状态加载成功', {
          mission_config: data.mission_config,
          current_mission: gameState.current_mission
        })

        this.setData({
          gameState: gameState,
          missionConfig: data.mission_config || [],
          allPlayers: data.players || [],
          currentMission: gameState.current_mission || 0,
          currentRound: gameState.current_round || 0,
          currentLeader: currentLeader,
          missionResults: gameState.mission_results || [],
          consecutiveRejects: gameState.consecutive_rejects || 0,
          goodWins: gameState.good_wins || 0,
          evilWins: gameState.evil_wins || 0,
          isLeader: currentLeader === this.data.playerNumber - 1,
          loading: false
        })

        // 检查游戏状态
        this.checkGamePhase(data.status)
      }
    } catch (error) {
      console.error('加载游戏状态失败', error)
      this.setData({ loading: false })
    }
  },

  // 检查游戏阶段
  checkGamePhase(status) {
    console.log('游戏阶段', status, this.data.gameState)

    // 非任务阶段时重置跳转标志
    if (status !== 'mission') {
      this.hasMissionJumped = false
    }

    if (status === 'nominating') {
      this.setData({ votePhase: false, missionPhase: false })
    } else if (status === 'voting') {
      // 处理提名玩家信息
      const nominatedPlayers = this.data.gameState.nominated_players || []
      const nominatedPlayersInfo = nominatedPlayers.map(pNum => {
        const player = this.data.allPlayers.find(p => p.player_number === pNum)
        return {
          number: pNum,
          nickname: player ? (player.nickname || `玩家${pNum}`) : `玩家${pNum}`
        }
      })

      this.setData({
        votePhase: true,
        missionPhase: false,
        nominatedPlayersInfo: nominatedPlayersInfo
      })
      console.log('投票阶段，提名玩家：', nominatedPlayersInfo)
    } else if (status === 'mission') {
      this.setData({ votePhase: false, missionPhase: true })

      // 检查自己是否是被提名玩家
      const nominatedPlayers = this.data.gameState.nominated_players || []
      const isParticipant = nominatedPlayers.includes(this.data.playerNumber)

      console.log('任务阶段，我的编号：', this.data.playerNumber, '被提名玩家：', nominatedPlayers, '是否参与：', isParticipant)

      // 如果是被提名玩家，跳转到任务执行页面
      if (isParticipant && !this.hasMissionJumped) {
        this.hasMissionJumped = true
        wx.redirectTo({
          url: `/pages/mission/mission?room_id=${this.data.roomId}&player_number=${this.data.playerNumber}&is_participant=true`
        })
      }
    } else if (status === 'assassinate') {
      // 跳转到刺杀页面
      wx.redirectTo({
        url: `/pages/assassinate/assassinate?room_id=${this.data.roomId}&player_number=${this.data.playerNumber}`
      })
    } else if (status === 'finished') {
      // 游戏结束
      this.showGameResult()
    }
  },

  // 选择玩家（队长提名）
  togglePlayerSelection(e) {
    if (!this.data.isLeader) return

    const playerNumber = e.currentTarget.dataset.player
    const selectedPlayers = [...this.data.selectedPlayers]
    const index = selectedPlayers.indexOf(playerNumber)

    const currentMissionConfig = this.data.missionConfig[this.data.currentMission]
    if (!currentMissionConfig) {
      console.error('任务配置错误', this.data.missionConfig, this.data.currentMission)
      wx.showToast({
        title: '任务配置加载失败，请刷新',
        icon: 'none'
      })
      return
    }
    const requiredPlayers = currentMissionConfig.players

    if (index > -1) {
      // 取消选择
      selectedPlayers.splice(index, 1)
    } else {
      // 添加选择
      if (selectedPlayers.length < requiredPlayers) {
        selectedPlayers.push(playerNumber)
      } else {
        wx.showToast({
          title: `只能选择${requiredPlayers}人`,
          icon: 'none'
        })
        return
      }
    }

    this.setData({ selectedPlayers })
  },

  // 提交提名
  async submitNomination() {
    const requiredPlayers = this.data.missionConfig[this.data.currentMission]?.players || 0

    if (this.data.selectedPlayers.length !== requiredPlayers) {
      wx.showToast({
        title: `请选择${requiredPlayers}人`,
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认提名',
      content: `确定提名${this.data.selectedPlayers.join('、')}号玩家执行任务吗？`,
      success: async (res) => {
        if (res.confirm) {
          await this.doSubmitNomination()
        }
      }
    })
  },

  // 执行提名
  async doSubmitNomination() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'submitNomination',
        data: {
          room_id: this.data.roomId,
          nominated_players: this.data.selectedPlayers
        }
      })

      if (res.result && res.result.success) {
        wx.showToast({
          title: '提名成功，等待投票',
          icon: 'success'
        })
        this.setData({ selectedPlayers: [] })
        this.loadGameState()
      } else {
        wx.showToast({
          title: res.result?.error || '提名失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('提名失败', error)
      wx.showToast({
        title: '提名失败，请重试',
        icon: 'none'
      })
    }
  },

  // 投票
  async vote(e) {
    const approve = e.currentTarget.dataset.approve === 'true'

    try {
      const res = await wx.cloud.callFunction({
        name: 'submitVote',
        data: {
          room_id: this.data.roomId,
          player_number: this.data.playerNumber,
          approve: approve
        }
      })

      if (res.result && res.result.success) {
        wx.showToast({
          title: '投票成功',
          icon: 'success'
        })
        this.loadGameState()
      } else {
        wx.showToast({
          title: res.result?.error || '投票失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('投票失败', error)
      wx.showToast({
        title: '投票失败，请重试',
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
  },

  // 显示游戏结果
  showGameResult() {
    // TODO: 实现游戏结果页面
  }
})
