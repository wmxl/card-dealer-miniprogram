// 云函数：提交任务结果
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { room_id, player_number, success } = event

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
    if (room.status !== 'mission') {
      return {
        error: '当前不是任务执行阶段'
      }
    }

    const gameState = room.game_state || {}
    const nominatedPlayers = gameState.nominated_players || []

    // 检查是否是被提名玩家
    if (!nominatedPlayers.includes(player_number)) {
      return {
        error: '你不在本次任务执行队伍中'
      }
    }

    const missionSubmissions = gameState.mission_submissions || {}

    // 检查是否已提交
    if (missionSubmissions[player_number] !== undefined) {
      return {
        error: '你已经提交过了'
      }
    }

    // 记录提交
    missionSubmissions[player_number] = success

    // 更新提交
    await db.collection('rooms').doc(room_id).update({
      data: {
        'game_state.mission_submissions': missionSubmissions,
        updated_at: db.serverDate()
      }
    })

    // 检查是否所有人都提交了
    let missionResult = null
    if (Object.keys(missionSubmissions).length === nominatedPlayers.length) {
      // 所有人都提交了，处理任务结果
      missionResult = await processMissionResult(room_id, room, missionSubmissions)
    }

    return {
      success: true,
      message: '提交成功',
      all_submitted: Object.keys(missionSubmissions).length === nominatedPlayers.length,
      mission_result: missionResult
    }
  } catch (error) {
    return {
      error: '提交失败',
      details: error.message
    }
  }
}

async function processMissionResult(room_id, room, missionSubmissions) {
  const gameState = room.game_state || {}
  const currentMission = gameState.current_mission || 0
  const missionConfig = room.mission_config[currentMission]

  // 统计失败票数
  const failCount = Object.values(missionSubmissions).filter(v => v === false).length
  const successCount = Object.values(missionSubmissions).length - failCount

  // 判断任务是否成功（需要达到失败票要求数量才算失败）
  const missionSuccess = failCount < missionConfig.failsRequired

  // 记录任务结果
  const missionResults = gameState.mission_results || []
  const resultData = {
    mission: currentMission + 1,
    success: missionSuccess,
    fail_count: failCount,
    success_count: successCount,
    participants: gameState.nominated_players
  }
  missionResults.push(resultData)

  // 更新胜利次数
  let goodWins = gameState.good_wins || 0
  let evilWins = gameState.evil_wins || 0

  if (missionSuccess) {
    goodWins++
  } else {
    evilWins++
  }

  // 检查游戏是否结束
  if (goodWins >= 3) {
    // 好人完成3次任务，进入刺杀阶段
    await db.collection('rooms').doc(room_id).update({
      data: {
        status: 'assassinate',
        'game_state.mission_results': missionResults,
        'game_state.good_wins': goodWins,
        'game_state.evil_wins': evilWins,
        'game_state.votes': _.set({}),
        'game_state.votes_round': -1,
        'game_state.mission_submissions': _.set({}),
        'game_state.nominated_players': [],
        updated_at: db.serverDate()
      }
    })
  } else if (evilWins >= 3) {
    // 坏人使3次任务失败，坏人获胜
    await db.collection('rooms').doc(room_id).update({
      data: {
        status: 'finished',
        'game_state.winner': 'evil',
        'game_state.win_reason': '完成3次任务失败',
        'game_state.mission_results': missionResults,
        'game_state.good_wins': goodWins,
        'game_state.evil_wins': evilWins,
        'game_state.votes': _.set({}),
        'game_state.votes_round': -1,
        'game_state.mission_submissions': _.set({}),
        'game_state.nominated_players': [],
        updated_at: db.serverDate()
      }
    })
  } else {
    // 游戏继续，进入下一个任务
    const playersResult = await db.collection('players')
      .where({
        room_id: room_id
      })
      .count()

    const totalPlayers = playersResult.total
    const newLeader = (gameState.current_leader + 1) % totalPlayers
    const newMission = currentMission + 1
    const newRound = gameState.current_round + 1

    await db.collection('rooms').doc(room_id).update({
      data: {
        status: 'nominating',
        'game_state.current_mission': newMission,
        'game_state.current_round': newRound,
        'game_state.current_leader': newLeader,
        'game_state.mission_results': missionResults,
        'game_state.good_wins': goodWins,
        'game_state.evil_wins': evilWins,
        'game_state.votes': _.set({}), // 清空投票记录
        'game_state.mission_submissions': _.set({}), // 清空任务提交记录
        'game_state.nominated_players': [], // 清空提名玩家
        'game_state.vote_count': 0,
        'game_state.votes_round': -1,
        updated_at: db.serverDate()
      }
    })
  }

  return resultData
}
