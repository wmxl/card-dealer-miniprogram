// 云函数：提交投票
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

function createEmptyVoteHistory() {
  return Array.from({ length: 5 }, () => [])
}

function normalizeVoteHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) {
    return createEmptyVoteHistory()
  }
  return Array.from({ length: 5 }, (_, index) => {
    const missionHistory = rawHistory[index]
    return Array.isArray(missionHistory) ? missionHistory : []
  })
}

exports.main = async (event, context) => {
  const { room_id, player_number, approve } = event

  try {
    // 获取房间信息
    const roomResult = await db.collection('rooms').doc(room_id).get()

    if (!roomResult.data) {
      return {
        error: '房间不存在'
      }
    }

    const room = roomResult.data

    // 验证房间状态
    if (room.status !== 'voting') {
      return {
        error: '当前不是投票阶段'
      }
    }

    const gameState = room.game_state || {}
    let votes = gameState.votes || {}
    const currentRound = gameState.current_round || 0
    const votesRound = typeof gameState.votes_round === 'number' ? gameState.votes_round : -1
    const hasStaleVotes = Object.keys(votes).length > 0 && votesRound !== currentRound

    // 如果当前投票轮次与 game_state.votes_round 不一致，或者 vote_history 已经推进到新轮次，说明 votes 是旧数据，需要清理
    const staleVotesRemoved = hasStaleVotes
    if (hasStaleVotes) {
      console.log('检测到过期投票记录，强制清空 votes', {
        currentRound,
        votesRound,
        votesBefore: votes
      })

      await db.collection('rooms').doc(room_id).update({
        data: {
          'game_state.votes': _.set({}),
          'game_state.vote_count': 0,
          'game_state.votes_round': currentRound,
          updated_at: db.serverDate()
        }
      })

      votes = {}
    }

    // 检查是否已投票（确保类型一致）
    const playerNum = parseInt(player_number)
    if (votes[playerNum] !== undefined) {
      return {
        error: '你已经投过票了'
      }
    }

    // 获取玩家信息，用于记录个人投票历史
    const playerResult = await db.collection('players')
      .where({
        room_id: room_id,
        player_number: playerNum
      })
      .limit(1)
      .get()

    if (!playerResult.data.length) {
      return {
        error: '玩家不存在'
      }
    }

    const playerDoc = playerResult.data[0]
    const missionIndex = gameState.current_mission || 0
    const playerVoteHistory = normalizeVoteHistory(playerDoc.vote_history)

    // 记录投票

    // 更新当前玩家的投票，避免覆盖其他玩家的投票
    const updateData = staleVotesRemoved
      ? {
          'game_state.votes': _.set({
            [playerNum]: approve
          }),
          'game_state.vote_count': 1,
          'game_state.votes_round': currentRound,
          updated_at: db.serverDate()
        }
      : {
          [`game_state.votes.${playerNum}`]: approve,
          'game_state.vote_count': _.inc(1),
          updated_at: db.serverDate()
        }

    await db.collection('rooms').doc(room_id).update({
      data: updateData
    })

    // 记录玩家个人的投票历史
    const missionHistory = playerVoteHistory[missionIndex] || []
    const voteRecordIndex = missionHistory.findIndex(record => record.round === currentRound)
    const voteRecord = {
      mission: missionIndex,
      round: currentRound,
      approve: approve,
      leader: gameState.current_leader || 0,
      nominated_players: gameState.nominated_players || [],
      timestamp: new Date()
    }

    if (voteRecordIndex > -1) {
      missionHistory[voteRecordIndex] = voteRecord
    } else {
      missionHistory.push(voteRecord)
    }

    playerVoteHistory[missionIndex] = missionHistory

    await db.collection('players').doc(playerDoc._id).update({
      data: {
        vote_history: playerVoteHistory,
        updated_at: db.serverDate()
      }
    })

    // 重新获取房间信息，确保数据是最新的
    const updatedRoomResult = await db.collection('rooms').doc(room_id).get()
    const updatedVotes = updatedRoomResult.data.game_state?.votes || {}
    const voteCountField = updatedRoomResult.data.game_state?.vote_count
    const voteCount = Object.keys(updatedVotes).length

    const playersResultAfter = await db.collection('players')
      .where({
        room_id: room_id
      })
      .count()

    const totalPlayers = playersResultAfter.total

    console.log('投票统计:', {
      mission: updatedRoomResult.data.game_state?.current_mission,
      round: updatedRoomResult.data.game_state?.current_round,
      votesRound: updatedRoomResult.data.game_state?.votes_round,
      status: updatedRoomResult.data.status,
      totalPlayers,
      voteCount,
      votes: updatedVotes,
      playerNum,
      approve
    })

    if (voteCount === totalPlayers) {
      // 所有人都投票了，统计结果
      await processVoteResult(room_id, updatedRoomResult.data, updatedVotes, totalPlayers)
    }

    return {
      success: true,
      message: '投票成功'
    }
  } catch (error) {
    return {
      error: '投票失败',
      details: error.message
    }
  }
}

async function processVoteResult(room_id, room, votes, totalPlayers) {
  const gameState = room.game_state || {}

  // 统计赞成票数
  const approveCount = Object.values(votes).filter(v => v === true).length
  const voteApproved = approveCount > totalPlayers / 2

  // 记录投票历史
  const voteHistory = gameState.vote_history || []
  voteHistory.push({
    round: gameState.current_round,
    nominated_players: gameState.nominated_players,
    votes: votes,
    approved: voteApproved,
    approve_count: approveCount,
    reject_count: totalPlayers - approveCount
  })

  console.log('投票结果统计:', { approveCount, totalPlayers, voteApproved })

    if (voteApproved) {
    // 投票通过，进入任务执行阶段
    console.log('投票通过，清空投票记录，进入任务阶段')
    await db.collection('rooms').doc(room_id).update({
      data: {
        status: 'mission',
        'game_state.vote_history': voteHistory,
        'game_state.consecutive_rejects': 0,
        'game_state.votes': _.set({}), // 清空投票记录
        'game_state.vote_count': 0,
        'game_state.votes_round': -1,
        'game_state.mission_submissions': {},
        updated_at: db.serverDate()
      }
    })
  } else {
    // 投票否决
    const consecutiveRejects = (gameState.consecutive_rejects || 0) + 1

    if (consecutiveRejects >= 5) {
      // 连续5次否决，坏人直接获胜
      await db.collection('rooms').doc(room_id).update({
        data: {
          status: 'finished',
          'game_state.winner': 'evil',
          'game_state.win_reason': '连续5次否决',
          'game_state.vote_history': voteHistory,
          updated_at: db.serverDate()
        }
      })
    } else {
      // 轮换队长，重新提名
      const newLeader = (gameState.current_leader + 1) % totalPlayers
      const newRound = gameState.current_round + 1

      console.log('投票否决，清空投票记录，轮换队长，进入下一轮提名')
      await db.collection('rooms').doc(room_id).update({
        data: {
          status: 'nominating',
          'game_state.current_leader': newLeader,
          'game_state.current_round': newRound,
          'game_state.consecutive_rejects': consecutiveRejects,
          'game_state.vote_history': voteHistory,
          'game_state.votes': _.set({}), // 清空投票记录，为下一轮投票做准备
          'game_state.vote_count': 0,
          'game_state.votes_round': -1,
          updated_at: db.serverDate()
        }
      })
    }
  }
}
