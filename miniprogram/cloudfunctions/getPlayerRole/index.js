// 云函数：获取玩家角色信息
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 获取玩家看到的信息（根据角色）
 */
function getPlayerVision(player, allPlayers) {
  const vision = {
    role: player.role,
    seePlayers: []
  }

  switch (player.role.code) {
    case 'merlin':
      // 梅林看到所有坏人（除了莫德雷德）
      vision.seePlayers = allPlayers
        .filter(p => p.role.side === 'evil' && p.role.code !== 'mordred')
        .map(p => ({
          playerNumber: p.player_number,
          nickname: p.nickname || `玩家${p.player_number}`
        }))
      vision.message = '你看到了以下坏人（不包括莫德雷德）'
      vision.tip = '保护好自己的身份，不要被刺客发现'
      break

    case 'percival':
      // 派西维尔看到梅林和莫甘娜，但不知道谁是谁
      vision.seePlayers = allPlayers
        .filter(p => p.role.code === 'merlin' || p.role.code === 'morgana')
        .map(p => ({
          playerNumber: p.player_number,
          nickname: p.nickname || `玩家${p.player_number}`
        }))
      vision.message = '以下两人中，一人是梅林，一人是莫甘娜'
      vision.tip = '找出真正的梅林并保护他'
      break

    case 'assassin':
    case 'morgana':
    case 'mordred':
    case 'minion':
      // 坏人互相认识（奥伯伦除外）
      vision.seePlayers = allPlayers
        .filter(p => p.role.side === 'evil' && p.role.code !== 'oberon' && p.player_number !== player.player_number)
        .map(p => ({
          playerNumber: p.player_number,
          nickname: p.nickname || `玩家${p.player_number}`,
          role: p.role.name
        }))
      vision.message = '你的队友'
      vision.tip = player.role.code === 'assassin'
        ? '如果好人完成三次任务，你需要刺杀梅林'
        : '配合队友让任务失败'
      break

    case 'oberon':
      // 奥伯伦不认识任何人
      vision.message = '你是孤独的坏人，不认识其他人'
      vision.tip = '隐藏身份，暗中破坏任务'
      break

    case 'loyal':
      // 忠臣什么都看不到
      vision.message = '你是忠诚的好人'
      vision.tip = '协助完成任务，保护梅林'
      break
  }

  return vision
}

exports.main = async (event, context) => {
  const { room_id, player_number } = event
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

    // 获取玩家信息
    const playerResult = await db.collection('players')
      .where({
        room_id: room_id,
        player_number: player_number
      })
      .get()

    if (playerResult.data.length === 0) {
      return {
        error: '玩家不存在'
      }
    }

    const player = playerResult.data[0]

    // 检查是否已分配角色
    if (!player.role || !player.role.code) {
      return {
        error: '还未分配角色'
      }
    }

    // 获取所有玩家信息（用于计算视野）
    const allPlayersResult = await db.collection('players')
      .where({
        room_id: room_id
      })
      .orderBy('player_number', 'asc')
      .get()

    const allPlayers = allPlayersResult.data

    // 计算该玩家的视野
    const vision = getPlayerVision(player, allPlayers)

    return {
      success: true,
      player_number: player.player_number,
      nickname: player.nickname,
      role: vision.role,
      seePlayers: vision.seePlayers,
      message: vision.message,
      tip: vision.tip
    }
  } catch (error) {
    return {
      error: '获取角色信息失败',
      details: error.message
    }
  }
}
