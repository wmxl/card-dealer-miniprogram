// 云函数：加入房间
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { room_id, nickname } = event

  try {
    // 检查房间是否存在
    const roomResult = await db.collection('rooms').doc(room_id).get()

    if (!roomResult.data) {
      return {
        error: '房间不存在'
      }
    }

    const room = roomResult.data

    // 检查房间是否已开始
    if (room.status === 'started') {
      return {
        error: '房间已开始游戏，无法加入'
      }
    }

    // 获取当前玩家数量
    const playersResult = await db.collection('players')
      .where({
        room_id: room_id
      })
      .count()

    const current_count = playersResult.total

    if (current_count >= room.max_players) {
      return {
        error: '房间已满'
      }
    }

    // 分配玩家编号
    const player_number = current_count + 1

    // 插入玩家
    await db.collection('players').add({
      data: {
        room_id: room_id,
        player_number: player_number,
        nickname: nickname || '',
        letter: '',
        joined_at: db.serverDate()
      }
    })

    // 更新房间更新时间
    await db.collection('rooms').doc(room_id).update({
      data: {
        updated_at: db.serverDate()
      }
    })

    return {
      player_number: player_number,
      current_players: current_count + 1,
      max_players: room.max_players,
      message: '加入房间成功'
    }
  } catch (error) {
    return {
      error: '加入房间失败',
      details: error.message
    }
  }
}
