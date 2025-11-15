// 云函数：发牌
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { room_id } = event

  try {
    // 检查房间是否存在
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

    const players = playersResult.data

    if (players.length < 2) {
      return {
        error: '至少需要2人才能发牌'
      }
    }

    if (players.length > room.max_players) {
      return {
        error: '玩家数量超过房间上限'
      }
    }

    // 检查是否已经发过牌
    const hasDealt = players.some(p => p.letter && p.letter !== '')
    if (hasDealt) {
      return {
        error: '已经发过牌了'
      }
    }

    // 生成字母列表（从A开始，根据人数递增）
    const letters = []
    for (let i = 0; i < players.length; i++) {
      letters.push(String.fromCharCode(65 + i)) // 65是'A'的ASCII码
    }

    // 随机打乱字母
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]]
    }

    // 分配字母给玩家
    const updatePromises = players.map((player, index) => {
      return db.collection('players').doc(player._id).update({
        data: {
          letter: letters[index]
        }
      })
    })

    await Promise.all(updatePromises)

    // 更新房间状态
    await db.collection('rooms').doc(room_id).update({
      data: {
        status: 'started',
        updated_at: db.serverDate()
      }
    })

    // 获取分配结果
    const resultPlayers = await db.collection('players')
      .where({
        room_id: room_id
      })
      .orderBy('player_number', 'asc')
      .get()

    const player_list = resultPlayers.data.map(p => ({
      player_number: p.player_number,
      nickname: p.nickname || `玩家${p.player_number}`,
      letter: p.letter
    }))

    return {
      room_id: room_id,
      players: player_list,
      message: '发牌成功'
    }
  } catch (error) {
    return {
      error: '发牌失败',
      details: error.message
    }
  }
}
