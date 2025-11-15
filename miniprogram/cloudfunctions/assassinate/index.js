// 云函数：刺杀
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { room_id, target_player } = event

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
    if (room.status !== 'assassinate') {
      return {
        error: '当前不是刺杀阶段'
      }
    }

    // 获取目标玩家信息
    const targetResult = await db.collection('players')
      .where({
        room_id: room_id,
        player_number: target_player
      })
      .get()

    if (targetResult.data.length === 0) {
      return {
        error: '目标玩家不存在'
      }
    }

    const targetPlayerData = targetResult.data[0]

    // 检查目标是否是梅林
    const isMerlin = targetPlayerData.role && targetPlayerData.role.code === 'merlin'

    // 根据刺杀结果决定胜负
    const winner = isMerlin ? 'evil' : 'good'
    const winReason = isMerlin
      ? '刺客成功刺杀梅林'
      : '刺客未能刺杀梅林'

    // 更新游戏状态
    await db.collection('rooms').doc(room_id).update({
      data: {
        status: 'finished',
        'game_state.winner': winner,
        'game_state.win_reason': winReason,
        'game_state.assassinated_player': target_player,
        'game_state.is_merlin': isMerlin,
        updated_at: db.serverDate()
      }
    })

    return {
      success: true,
      is_merlin: isMerlin,
      winner: winner,
      message: isMerlin ? '刺杀成功，坏人获胜' : '刺杀失败，好人获胜'
    }
  } catch (error) {
    return {
      error: '刺杀失败',
      details: error.message
    }
  }
}
