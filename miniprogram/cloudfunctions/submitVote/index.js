// 云函数：提交投票
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

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
    const votes = gameState.votes || {}

    // 检查是否已投票
    if (votes[player_number] !== undefined) {
      return {
        error: '你已经投过票了'
      }
    }

    // 记录投票
    votes[player_number] = approve

    // 更新投票
    await db.collection('rooms').doc(room_id).update({
      data: {
        'game_state.votes': votes,
        updated_at: db.serverDate()
      }
    })

    // 检查是否所有人都投票了
    const playersResult = await db.collection('players')
      .where({
        room_id: room_id
      })
      .count()

    const totalPlayers = playersResult.total

    if (Object.keys(votes).length === totalPlayers) {
      // 所有人都投票了，统计结果
      await processVoteResult(room_id, room, votes, totalPlayers)
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

  if (voteApproved) {
    // 投票通过，进入任务执行阶段
    await db.collection('rooms').doc(room_id).update({
      data: {
        status: 'mission',
        'game_state.vote_history': voteHistory,
        'game_state.consecutive_rejects': 0,
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

      await db.collection('rooms').doc(room_id).update({
        data: {
          status: 'nominating',
          'game_state.current_leader': newLeader,
          'game_state.current_round': newRound,
          'game_state.consecutive_rejects': consecutiveRejects,
          'game_state.vote_history': voteHistory,
          updated_at: db.serverDate()
        }
      })
    }
  }
}
