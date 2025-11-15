// 云函数：重置房间并自动重新开始游戏
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const { getRolesForPlayerCount, getMissionConfig } = require('./avalon-config')

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

    // 获取所有玩家
    const playersResult = await db.collection('players')
      .where({
        room_id: room_id
      })
      .orderBy('player_number', 'asc')
      .get()

    const players = playersResult.data
    const playerCount = players.length

    console.log('重置房间，玩家数量:', playerCount)

    // 获取角色配置
    const rolesConfig = getRolesForPlayerCount(playerCount)

    // 合并好人和坏人角色数组
    const allRoles = [...rolesConfig.good, ...rolesConfig.evil]

    // 随机分配角色
    const shuffledRoles = allRoles.sort(() => Math.random() - 0.5)

    // 更新玩家角色
    const updatePromises = players.map((player, index) => {
      return db.collection('players').doc(player._id).update({
        data: {
          role: shuffledRoles[index],
          updated_at: db.serverDate()
        }
      })
    })

    await Promise.all(updatePromises)

    console.log('角色分配完成')

    // 获取任务配置
    const missionConfig = getMissionConfig(playerCount)

    // 构建全新的游戏状态对象（确保没有任何旧数据）
    const newGameState = {
      current_mission: 0,
      current_round: 0,
      current_leader: 0,
      mission_results: [],
      vote_history: [],
      consecutive_rejects: 0,
      good_wins: 0,
      evil_wins: 0,
      votes: {},  // 空对象，没有任何投票记录
      nominated_players: [],
      mission_submissions: {},
      vote_count: 0
    }

    console.log('==== 准备重置房间 ====')
    console.log('新游戏状态:', JSON.stringify(newGameState))
    console.log('votes是否为空对象:', Object.keys(newGameState.votes).length === 0)

    // 获取房间的基本信息（不变的部分）
    const room = roomResult.data

    // 完全重建房间数据，不使用 update，而是用 set 来确保旧数据被清除
    // 注意：_id 不能在 set 的 data 中，它是文档标识符
    await db.collection('rooms').doc(room_id).set({
      data: {
        room_number: room.room_number,
        max_players: room.max_players,
        creator_openid: room.creator_openid,
        status: 'role_reveal',
        game_state: newGameState,  // 全新的游戏状态
        mission_config: missionConfig,
        created_at: room.created_at,
        updated_at: db.serverDate()
      }
    })

    console.log('==== 房间重置完成 ====')
    console.log('状态已更新为: role_reveal')
    console.log('game_state 已完全替换，所有旧数据已清除')

    return {
      success: true,
      message: '房间已重置并重新开始游戏'
    }
  } catch (error) {
    console.error('重置房间失败:', error)
    return {
      error: '重置房间失败',
      details: error.message
    }
  }
}
