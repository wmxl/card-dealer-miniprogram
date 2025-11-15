// 云函数：分配角色
const cloud = require('wx-server-sdk')
const { assignRoles, getMissionConfig } = require('./avalon-config')

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

    if (players.length < 3) {
      return {
        error: '至少需要3人才能开始游戏'
      }
    }

    if (players.length > 12) {
      return {
        error: '最多支持12人游戏'
      }
    }

    if (players.length > room.max_players) {
      return {
        error: '玩家数量超过房间上限'
      }
    }

    // 检查是否已经分配过角色
    const hasDealt = players.some(p => p.role && p.role.code)
    if (hasDealt) {
      return {
        error: '已经分配过角色了'
      }
    }

    // 分配角色
    const playersWithRoles = assignRoles(players)

    // 更新玩家角色信息
    const updatePromises = playersWithRoles.map((player) => {
      return db.collection('players').doc(player._id).update({
        data: {
          role: player.role
        }
      })
    })

    await Promise.all(updatePromises)

    // 获取任务配置
    const missionConfig = getMissionConfig(players.length)

    // 更新房间状态和任务配置
    await db.collection('rooms').doc(room_id).update({
      data: {
        status: 'role_reveal',  // 角色查看阶段
        game_state: {
          current_mission: 0,  // 当前任务索引（0-4）
          current_round: 0,    // 当前轮次（从0开始）
          current_leader: 0,   // 当前队长（玩家编号-1）
          mission_results: [], // 任务结果
          vote_history: [],    // 投票历史
          consecutive_rejects: 0, // 连续否决次数
          good_wins: 0,        // 好人胜利次数
          evil_wins: 0,         // 坏人胜利次数
          vote_count: 0
        },
        mission_config: missionConfig,
        updated_at: db.serverDate()
      }
    })

    return {
      room_id: room_id,
      success: true,
      message: '角色分配成功，请查看身份'
    }
  } catch (error) {
    return {
      error: '角色分配失败',
      details: error.message
    }
  }
}
