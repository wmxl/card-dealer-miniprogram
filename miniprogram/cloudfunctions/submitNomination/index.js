// 云函数：提交提名
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { room_id, nominated_players } = event
  const wxContext = cloud.getWXContext()

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
    if (room.status !== 'role_reveal' && room.status !== 'nominating') {
      return {
        error: '当前不是提名阶段'
      }
    }

    // 验证提名人数
    const gameState = room.game_state || {}
    const currentMission = gameState.current_mission || 0
    const missionConfig = room.mission_config[currentMission]

    if (nominated_players.length !== missionConfig.players) {
      return {
        error: `请提名${missionConfig.players}名玩家`
      }
    }

    // 更新房间状态为投票阶段
    console.log('提名成功，清空投票记录，进入投票阶段')
    await db.collection('rooms').doc(room_id).update({
      data: {
        status: 'voting',
        'game_state.nominated_players': nominated_players,
        'game_state.votes': {}, // 清空投票记录
        'game_state.vote_count': 0,
        updated_at: db.serverDate()
      }
    })

    return {
      success: true,
      message: '提名成功，进入投票阶段'
    }
  } catch (error) {
    return {
      error: '提名失败',
      details: error.message
    }
  }
}
