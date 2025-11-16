// 云函数：调试房间信息
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { room_id } = event

  if (!room_id) {
    return {
      error: '缺少 room_id'
    }
  }

  try {
    const roomResult = await db.collection('rooms').doc(room_id).get()

    if (!roomResult.data) {
      return {
        error: '房间不存在'
      }
    }

    const room = roomResult.data
    const playersResult = await db.collection('players')
      .where({
        room_id: room_id
      })
      .orderBy('player_number', 'asc')
      .get()

    const players = playersResult.data

    return {
      success: true,
      room_id: room._id,
      status: room.status,
      mission_config: room.mission_config,
      game_state: room.game_state,
      player_count: players.length,
      players: players
    }
  } catch (error) {
    return {
      error: '获取房间调试信息失败',
      details: error.message
    }
  }
}
