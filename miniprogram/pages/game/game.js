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
    selectedPlayers: [], // 确保初始化为空数组
    selectedPlayersMap: {}, // 使用对象映射，更可靠
    votePhase: false,
    missionPhase: false,
    myVoteChoice: null, // 我的投票选择：true=赞成，false=反对，null=未投票
    lastVotingRound: -1, // 记录上一次投票的轮次，用于判断是否是新一轮投票
    lastGameStatus: null, // 记录上一次的游戏状态，用于判断是否重开

    showRulesModal: false,
    showRoleModal: false, // 显示身份信息弹窗
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
    this.hasResetJumped = false // 防止重复跳转到首页
    this.voteSnapshot = '' // 记录上一次的投票数据快照，避免复用旧投票

    console.log('游戏页面加载，重置投票状态')
    this.setData({
      roomId: roomId,
      playerNumber: playerNumber,
      myVoteChoice: null, // 重置投票选择
      lastVotingRound: -1, // 重置投票轮次
      lastGameStatus: null // 重置游戏状态
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

        // 确保 player_number 是数字类型
        const allPlayers = (data.players || []).map(p => {
          const pn = parseInt(p.player_number)
          return {
            ...p,
            player_number: isNaN(pn) ? p.player_number : pn
          }
        })

        console.log('加载玩家数据:', allPlayers.map(p => ({ number: p.player_number, type: typeof p.player_number })))

        // 只有在状态切换到提名阶段时才重置选中状态，避免定时刷新覆盖用户的选择
        const isStatusChanged = this.data.lastGameStatus !== data.status
        const isNominatingPhase = data.status === 'nominating'
        const shouldResetSelection = isStatusChanged && isNominatingPhase
        const selectedPlayers = shouldResetSelection ? [] : (this.data.selectedPlayers || [])

        // 构建选中玩家的映射对象
        const selectedPlayersMap = {}
        selectedPlayers.forEach(pn => {
          selectedPlayersMap[pn] = true
        })

        console.log('状态检查:', {
          oldStatus: this.data.gameState?.status,
          newStatus: data.status,
          isStatusChanged,
          shouldResetSelection,
          currentSelected: this.data.selectedPlayers,
          selectedPlayers: selectedPlayers,
          selectedPlayersMap: selectedPlayersMap
        })

        this.setData({
          gameState: gameState,
          missionConfig: data.mission_config || [],
          allPlayers: allPlayers,
          currentMission: gameState.current_mission || 0,
          currentRound: gameState.current_round || 0,
          currentLeader: currentLeader,
          missionResults: gameState.mission_results || [],
          consecutiveRejects: gameState.consecutive_rejects || 0,
          goodWins: gameState.good_wins || 0,
          evilWins: gameState.evil_wins || 0,
          isLeader: currentLeader === this.data.playerNumber - 1,
          selectedPlayers: selectedPlayers, // 避免定时刷新覆盖用户选择
          selectedPlayersMap: selectedPlayersMap, // 使用映射对象
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

    const lastStatus = this.data.lastGameStatus
    const isGameInProgress = ['nominating', 'voting', 'mission'].includes(lastStatus)

    // 非任务阶段时重置跳转标志
    if (status !== 'mission') {
      this.hasMissionJumped = false
    }

    if (status === 'waiting') {
      // 房间被重置，返回房间页面（带上玩家编号）
      if (!this.hasResetJumped) {
        this.hasResetJumped = true
        wx.showToast({
          title: '房间已重置，请重新发牌',
          icon: 'none',
          duration: 1500
        })
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/room/room?room_id=${this.data.roomId}&player_number=${this.data.playerNumber}`
          })
        }, 1500)
      }
    } else if (status === 'role_reveal') {
      // 检查是否是从游戏中重开（之前的状态是游戏进行中的状态）
      if (isGameInProgress && !this.hasResetJumped) {
        // 游戏重新开始，跳转到角色查看页面
        this.hasResetJumped = true
        wx.showToast({
          title: '游戏重新开始',
          icon: 'success',
          duration: 1500
        })
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/role-reveal/role-reveal?room_id=${this.data.roomId}&player_number=${this.data.playerNumber}`
          })
        }, 1500)
      }
    } else if (status === 'nominating') {
      // 不在这里重置 selectedPlayers，因为在 loadGameState 中已经处理
      this.setData({
        votePhase: false,
        missionPhase: false
      })
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

      // 检查自己是否已投票（确保键类型一致）
      const votes = this.data.gameState.votes || {}
      const playerNum = parseInt(this.data.playerNumber)
      const myVote = votes[playerNum]
      const currentRound = this.data.gameState.current_round
      const currentMission = this.data.gameState.current_mission
      const voteHistory = this.data.gameState.vote_history || []

      // 判断是否是新一轮投票（通过多个条件综合判断）
      // 1. round 变化
      const isRoundChanged = currentRound !== this.data.lastVotingRound
      // 2. 游戏刚重开（mission=0, round=0, lastVotingRound=-1）
      const isGameReset = currentMission === 0 && currentRound === 0 && this.data.lastVotingRound === -1
      // 3. 游戏重开的另一个标志：没有投票历史记录（vote_history为空）
      const hasNoHistory = voteHistory.length === 0
      // 4. votes为空对象
      const votesIsEmpty = Object.keys(votes).length === 0

      const normalizedVotes = Object.keys(votes)
        .sort((a, b) => Number(a) - Number(b))
        .reduce((acc, key) => {
          acc[key] = votes[key]
          return acc
        }, {})
      const votesSnapshot = JSON.stringify(normalizedVotes)
      const votesChanged = votesSnapshot !== (this.voteSnapshot || '')

      if (votesChanged) {
        this.voteSnapshot = votesSnapshot
      }

      // 如果游戏刚重开（没有历史记录），强制重置投票选择
      const isNewVotingRound = isRoundChanged || isGameReset || hasNoHistory
      const shouldUseServerVote = votesChanged && myVote !== undefined
      const myVoteChoice = (isNewVotingRound || votesIsEmpty)
        ? null
        : (shouldUseServerVote ? myVote : this.data.myVoteChoice)

      console.log('检查投票状态:', {
        playerNum,
        votesKeys: Object.keys(votes),
        votesValues: Object.values(votes),
        votesCount: Object.keys(votes).length,
        voteHistoryLength: voteHistory.length,
        myVote,
        myVoteChoice,
        isRoundChanged,
        isGameReset,
        hasNoHistory,
        votesIsEmpty,
        isNewVotingRound,
        currentRound: currentRound,
        lastVotingRound: this.data.lastVotingRound,
        currentMission: currentMission
      })

      this.setData({
        votePhase: true,
        missionPhase: false,
        nominatedPlayersInfo: nominatedPlayersInfo,
        myVoteChoice: myVoteChoice, // 新一轮投票时重置，否则保持状态
        lastVotingRound: currentRound // 更新最后一次投票的轮次
      })

      console.log('投票阶段设置完成:', {
        nominatedPlayers: nominatedPlayersInfo,
        myVoteChoice: this.data.myVoteChoice,
        currentRound: currentRound,
        lastVotingRound: this.data.lastVotingRound,
        isNewVotingRound: isNewVotingRound
      })
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

    // 更新最后一次的游戏状态，用于判断状态变化
    this.setData({
      lastGameStatus: status
    })
  },

  // 判断玩家是否被选中
  isPlayerSelected(playerNumber) {
    const selectedPlayers = this.data.selectedPlayers || []
    return selectedPlayers.indexOf(parseInt(playerNumber)) !== -1
  },

  // 选择玩家（队长提名）
  togglePlayerSelection(e) {
    if (!this.data.isLeader) return

    const playerNumber = parseInt(e.currentTarget.dataset.player) // 确保转换为数字
    const selectedPlayers = [...(this.data.selectedPlayers || [])]
    const index = selectedPlayers.indexOf(playerNumber)

    console.log('点击玩家:', playerNumber, '当前选中:', selectedPlayers, '索引:', index)

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

    // 更新映射对象
    const selectedPlayersMap = {}
    selectedPlayers.forEach(pn => {
      selectedPlayersMap[pn] = true
    })

    console.log('更新后选中:', selectedPlayers, 'Map:', selectedPlayersMap)
    this.setData({
      selectedPlayers: selectedPlayers,
      selectedPlayersMap: selectedPlayersMap
    })
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

    // 记录投票选择，显示选中效果
    this.setData({ myVoteChoice: approve })

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

  // 显示身份
  async showRole() {
    if (this.data.role) {
      // 已经有身份信息，直接显示
      this.setData({ showRoleModal: true })
    } else {
      // 获取身份信息
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
            role: res.result,
            showRoleModal: true
          })
        } else {
          wx.showToast({
            title: '获取身份失败',
            icon: 'none'
          })
        }
      } catch (error) {
        console.error('获取身份失败', error)
        wx.showToast({
          title: '获取身份失败',
          icon: 'none'
        })
      }
    }
  },

  // 隐藏身份
  hideRole() {
    this.setData({ showRoleModal: false })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，阻止冒泡
  },

  // 重置游戏
  async resetGame() {
    wx.showModal({
      title: '确认重开',
      content: '确定要重开游戏吗？所有玩家需要重新加入并发牌',
      confirmText: '确定重开',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            const resetRes = await wx.cloud.callFunction({
              name: 'resetRoom',
              data: {
                room_id: this.data.roomId
              }
            })

            if (resetRes.result && resetRes.result.success) {
              // 重开成功，直接跳转到角色查看页面
              wx.showToast({
                title: '游戏重新开始',
                icon: 'success',
                duration: 1500
              })
              setTimeout(() => {
                wx.redirectTo({
                  url: `/pages/role-reveal/role-reveal?room_id=${this.data.roomId}&player_number=${this.data.playerNumber}`
                })
              }, 1500)
            } else {
              wx.showToast({
                title: resetRes.result?.error || '重置失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('重置游戏失败', error)
            wx.showToast({
              title: '重置失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 显示游戏结果
  showGameResult() {
    // TODO: 实现游戏结果页面
  }
})
