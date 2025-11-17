// pages/game/game.js

function normalizeVoteHistory(history) {
  if (!Array.isArray(history)) {
    return Array.from({ length: 5 }, () => [])
  }
  return Array.from({ length: 5 }, (_, index) => {
    const missionHistory = history[index]
    return Array.isArray(missionHistory) ? missionHistory : []
  })
}

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
    nominatedPlayersMap: {}, // 被提名玩家的映射对象，用于显示标识
    votePhase: false,
    missionPhase: false,
    myVoteChoice: null, // 我的投票选择：true=赞成，false=反对，null=未投票
    lastVotingRound: -1, // 记录上一次投票的轮次（仅用于调试，可逐步废弃）
    lastGameStatus: null, // 记录上一次的游戏状态，用于判断是否重开
    lastVoteKey: '',

    showRulesModal: false,
    showRoleModal: false, // 显示身份信息弹窗
    loading: true,
    voteHistoryModalVisible: false,
    voteHistoryMission: 0,
    voteHistoryRounds: [],
    voteHistoryEmpty: true,
    reviewMode: false,
    gameResultTitle: '',
    gameResultReason: ''
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
    this.hasShownResult = false // 防止重复展示结果弹窗
    this.voteSnapshot = '' // 兼容旧逻辑的字段，后续可移除

    console.log('游戏页面加载，重置投票状态')
    this.setData({
      roomId: roomId,
      playerNumber: playerNumber,
      myVoteChoice: null, // 重置投票选择
      lastVotingRound: -1, // 重置投票轮次
      lastGameStatus: null, // 重置游戏状态
      lastVoteKey: ''
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
        const isFinished = data.status === 'finished'
        const winnerText = isFinished ? this.formatWinnerText(gameState.winner) : ''
        const winnerReason = isFinished ? (gameState.win_reason || '') : ''

        console.log('游戏状态加载成功', {
          mission_config: data.mission_config,
          current_mission: gameState.current_mission
        })

        // 确保 player_number 是数字类型
        const allPlayers = (data.players || []).map(p => {
          const pn = parseInt(p.player_number)
          return {
            ...p,
            player_number: isNaN(pn) ? p.player_number : pn,
            vote_history: normalizeVoteHistory(p.vote_history)
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

        // 构建被提名玩家的映射对象
        const nominatedPlayers = gameState.nominated_players || []
        const nominatedPlayersMap = {}
        nominatedPlayers.forEach(pNum => {
          nominatedPlayersMap[pNum] = true
        })

        console.log('状态检查:', {
          oldStatus: this.data.gameState?.status,
          newStatus: data.status,
          isStatusChanged,
          shouldResetSelection,
          currentSelected: this.data.selectedPlayers,
          selectedPlayers: selectedPlayers,
          selectedPlayersMap: selectedPlayersMap,
          nominatedPlayersMap: nominatedPlayersMap
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
          nominatedPlayersMap: nominatedPlayersMap, // 被提名玩家映射
          loading: false,
          reviewMode: isFinished,
          gameResultTitle: isFinished ? winnerText : '',
          gameResultReason: isFinished ? winnerReason : ''
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
      // 清空被提名玩家映射
      this.setData({
        votePhase: false,
        missionPhase: false,
        reviewMode: false,
        nominatedPlayersMap: {}
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

      // 构建被提名玩家的映射对象
      const nominatedPlayersMap = {}
      nominatedPlayers.forEach(pNum => {
        nominatedPlayersMap[pNum] = true
      })

      // 检查自己是否已投票：优先使用玩家文档中的 vote_history
      const votes = this.data.gameState.votes || {}
      const playerNum = parseInt(this.data.playerNumber)
      const currentRound = this.data.gameState.current_round
      const missionIndex = this.data.gameState.current_mission || 0
      const roundKey = `${missionIndex}-${currentRound}`
      let previousVoteChoice = this.data.myVoteChoice
      if (roundKey !== this.data.lastVoteKey) {
        previousVoteChoice = null
      }
      const playerInfo = this.data.allPlayers.find(p => p.player_number === playerNum) || {}
      const missionHistory = (playerInfo.vote_history && playerInfo.vote_history[missionIndex]) || []
      const myVoteRecord = missionHistory.find(record => record.round === currentRound)

      let myVoteChoice = null
      if (myVoteRecord && typeof myVoteRecord.approve === 'boolean') {
        myVoteChoice = myVoteRecord.approve
      } else {
        myVoteChoice = previousVoteChoice
      }

      console.log('检查投票状态（玩家历史版）:', {
        playerNum,
        votesKeys: Object.keys(votes),
        votesValues: Object.values(votes),
        votesCount: Object.keys(votes).length,
        myVoteRecord,
        myVoteChoice,
        currentRound,
        missionIndex
      })

      this.setData({
        votePhase: true,
        missionPhase: false,
        nominatedPlayersInfo: nominatedPlayersInfo,
        nominatedPlayersMap: nominatedPlayersMap, // 更新被提名玩家映射
        myVoteChoice: myVoteChoice, // 新一轮投票时为 null，否则根据服务端/本地状态决定
        lastVotingRound: currentRound, // 保持字段更新，便于后续调试或扩展
        lastVoteKey: roundKey
      })

      console.log('投票阶段设置完成:', {
        nominatedPlayers: nominatedPlayersInfo,
        myVoteChoice: this.data.myVoteChoice,
        currentRound: currentRound,
        lastVotingRound: this.data.lastVotingRound
      })
    } else if (status === 'mission') {
      // 保持被提名玩家映射，以便在任务阶段也能看到被提名的玩家
      this.setData({ votePhase: false, missionPhase: true })

      // 检查自己是否是被提名玩家
      const nominatedPlayers = this.data.gameState.nominated_players || []
      const isParticipant = nominatedPlayers.includes(this.data.playerNumber)
      
      // 检查是否已提交任务
      const missionSubmissions = this.data.gameState.mission_submissions || {}
      const hasSubmitted = missionSubmissions[this.data.playerNumber] !== undefined

      console.log('任务阶段，我的编号：', this.data.playerNumber, '被提名玩家：', nominatedPlayers, '是否参与：', isParticipant, '已提交：', hasSubmitted)

      // 如果是被提名玩家且未提交，跳转到任务执行页面
      if (isParticipant && !hasSubmitted && !this.hasMissionJumped) {
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

  // 处理用户卡片点击
  handleUserCardTap(e) {
    // 只有在提名阶段且是队长时才能点击选择
    if (!this.data.isLeader || this.data.votePhase || this.data.missionPhase) {
      return
    }
    this.togglePlayerSelection(e)
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
    if (this.data.myVoteChoice !== null) {
      wx.showToast({
        title: '本轮已投票',
        icon: 'none'
      })
      return
    }

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

  showMissionVotes(e) {
    const missionIndex = Number(e.currentTarget.dataset.mission)

    if (isNaN(missionIndex) || missionIndex < 0) {
      return
    }

    const roundsMap = {}
    const players = this.data.allPlayers || []

    players.forEach(player => {
      const missionHistory = (player.vote_history && player.vote_history[missionIndex]) || []
      missionHistory.forEach(record => {
        const roundKey = typeof record.round === 'number' ? record.round : 0
        if (!roundsMap[roundKey]) {
          roundsMap[roundKey] = []
        }
        roundsMap[roundKey].push({
          player_number: player.player_number,
          nickname: player.nickname || `玩家${player.player_number}`,
          approve: record.approve
        })
      })
    })

    const rounds = Object.keys(roundsMap)
      .map(key => Number(key))
      .sort((a, b) => a - b)
      .map(roundNumber => {
        const mapKey = roundNumber.toString()
        const votesForRound = roundsMap[mapKey] || []
        return {
          round: roundNumber,
          votes: votesForRound.sort((a, b) => a.player_number - b.player_number)
        }
      })

    this.setData({
      voteHistoryModalVisible: true,
      voteHistoryMission: missionIndex,
      voteHistoryRounds: rounds,
      voteHistoryEmpty: rounds.length === 0
    })
  },

  closeVoteHistoryModal() {
    this.setData({
      voteHistoryModalVisible: false,
      voteHistoryRounds: [],
      voteHistoryEmpty: true
    })
  },

  formatWinnerText(winner) {
    if (winner === 'good') {
      return '好人胜利'
    }
    if (winner === 'evil') {
      return '坏人胜利'
    }
    return '游戏结束'
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
          const roleData = {
            ...(res.result.role || {}),
            message: res.result.message,
            tip: res.result.tip,
            seePlayers: res.result.seePlayers
          }
          this.setData({
            role: roleData,
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
    if (this.hasShownResult) {
      return
    }
    this.hasShownResult = true

    const winner = this.data.gameState?.winner
    const winReason = this.data.gameState?.win_reason

    const winnerText = this.formatWinnerText(winner)

    const contentLines = []
    contentLines.push(winnerText)
    if (winReason) {
      contentLines.push(winReason)
    }

    this.setData({
      reviewMode: true,
      gameResultTitle: winnerText,
      gameResultReason: winReason || ''
    })

    wx.showModal({
      title: '游戏结束',
      content: contentLines.join('\n'),
      showCancel: false
    })
  }
})
