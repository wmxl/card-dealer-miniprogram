// 云函数：加入房间
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 导入游戏规则配置
const { getRolesForPlayerCount, getMissionConfig } = require('./avalon-config')

function createEmptyVoteHistory() {
  return Array.from({ length: 5 }, () => [])
}

// 自动发牌函数
async function autoDealCards(room_id) {
  const playersResult = await db.collection('players')
    .where({ room_id: room_id })
    .orderBy('player_number', 'asc')
    .get()

  const players = playersResult.data
  const playerCount = players.length

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
        vote_history: createEmptyVoteHistory(),
        updated_at: db.serverDate()
      }
    })
  })

  await Promise.all(updatePromises)

  // 获取任务配置
  const missionConfig = getMissionConfig(playerCount)

  // 更新房间状态
  await db.collection('rooms').doc(room_id).update({
    data: {
      status: 'role_reveal',
      game_state: {
        current_mission: 0,
        current_round: 0,
        current_leader: 0,
        mission_results: [],
        vote_history: [],
        consecutive_rejects: 0,
        good_wins: 0,
        evil_wins: 0,
        votes: {},
        votes_round: -1,
        nominated_players: [],
        mission_submissions: {},
        vote_count: 0
      },
      mission_config: missionConfig,
      updated_at: db.serverDate()
    }
  })
}

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
        vote_history: createEmptyVoteHistory(),
        joined_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    })

    // 更新房间更新时间
    await db.collection('rooms').doc(room_id).update({
      data: {
        updated_at: db.serverDate()
      }
    })

    const newPlayerCount = current_count + 1

    // 检查是否人数已满，自动开始游戏
    if (newPlayerCount === room.max_players) {
      // 自动发牌
      try {
        await autoDealCards(room_id)
      } catch (error) {
        console.error('自动发牌失败:', error)
      }
    }

    return {
      player_number: player_number,
      current_players: newPlayerCount,
      max_players: room.max_players,
      auto_started: newPlayerCount === room.max_players,
      message: newPlayerCount === room.max_players ? '房间已满，自动开始游戏' : '加入房间成功'
    }
  } catch (error) {
    return {
      error: '加入房间失败',
      details: error.message
    }
  }
}
