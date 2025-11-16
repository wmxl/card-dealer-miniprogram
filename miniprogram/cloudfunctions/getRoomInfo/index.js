// 云函数：获取房间信息
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function normalizeVoteHistory(rawHistory) {
  const length = 5
  const history = Array.isArray(rawHistory) ? rawHistory : []
  return Array.from({ length }, (_, index) => {
    const missionHistory = history[index]
    return Array.isArray(missionHistory) ? missionHistory : []
  })
}

exports.main = async (event, context) => {
  const { room_id } = event

  try {
    // 获取房间信息
    const roomResult = await db.collection('rooms').doc(room_id).get()

    if (!roomResult.data) {
      return {
        error: '房间不存在'
      }
    }

    const room = roomResult.data

    // 获取房间内的玩家
    const playersResult = await db.collection('players')
      .where({
        room_id: room_id
      })
      .orderBy('player_number', 'asc')
      .get()

    const players = playersResult.data.map(p => ({
      player_number: p.player_number,
      nickname: p.nickname || `玩家${p.player_number}`,
      letter: p.letter || '',
      vote_history: normalizeVoteHistory(p.vote_history)
    }))

    return {
      room_id: room._id,
      max_players: room.max_players,
      status: room.status,
      current_players: players.length,
      players: players,
      game_state: room.game_state || {},
      mission_config: room.mission_config || []
    }
  } catch (error) {
    return {
      error: '获取房间信息失败',
      details: error.message
    }
  }
}
