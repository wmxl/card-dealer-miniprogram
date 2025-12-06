// 阿瓦隆游戏配置（云函数版本）

// 角色定义
const ROLES = {
  // 好人阵营
  MERLIN: { name: '梅林', side: 'good', code: 'merlin' },
  PERCIVAL: { name: '派西维尔', side: 'good', code: 'percival' },
  LOYAL_SERVANT: { name: '忠臣', side: 'good', code: 'loyal' },

  // 坏人阵营
  MORGANA: { name: '莫甘娜', side: 'evil', code: 'morgana' },
  ASSASSIN: { name: '刺客', side: 'evil', code: 'assassin' },
  MORDRED: { name: '莫德雷德', side: 'evil', code: 'mordred' },
  OBERON: { name: '奥伯伦', side: 'evil', code: 'oberon' },
  MINION: { name: '爪牙', side: 'evil', code: 'minion' }
}

// 各人数的角色配置
const PLAYER_CONFIGS = {
  3: {
    good: [ROLES.MERLIN, ROLES.LOYAL_SERVANT],
    evil: [ROLES.ASSASSIN]
  },
  4: {
    good: [ROLES.MERLIN, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT],
    evil: [ROLES.ASSASSIN]
  },
  5: {
    good: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL_SERVANT],
    evil: [ROLES.MORGANA, ROLES.ASSASSIN]
  },
  6: {
    good: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT],
    evil: [ROLES.MORGANA, ROLES.ASSASSIN]
  },
  7: {
    good: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT],
    evil: [ROLES.MORGANA, ROLES.OBERON, ROLES.ASSASSIN]
  },
  8: {
    good: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT],
    evil: [ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MINION]
  },
  9: {
    good: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT],
    evil: [ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MORDRED]
  },
  10: {
    good: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT],
    evil: [ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MORDRED, ROLES.OBERON]
  },
  11: {
    good: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT],
    evil: [ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MORDRED, ROLES.OBERON]
  },
  12: {
    good: [ROLES.MERLIN, ROLES.PERCIVAL, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT, ROLES.LOYAL_SERVANT],
    evil: [ROLES.MORGANA, ROLES.ASSASSIN, ROLES.MORDRED, ROLES.OBERON, ROLES.MINION]
  }
}

// 任务配置
const MISSION_CONFIGS = {
  3: [
    { players: 1, failsRequired: 1 },
    { players: 1, failsRequired: 1 },
    { players: 1, failsRequired: 1 },
    { players: 1, failsRequired: 1 },
    { players: 1, failsRequired: 1 }
  ],
  4: [
    { players: 2, failsRequired: 1 },
    { players: 2, failsRequired: 1 },
    { players: 2, failsRequired: 1 },
    { players: 2, failsRequired: 1 },
    { players: 2, failsRequired: 1 }
  ],
  5: [
    { players: 2, failsRequired: 1 },
    { players: 3, failsRequired: 1 },
    { players: 2, failsRequired: 1 },
    { players: 3, failsRequired: 2 },
    { players: 3, failsRequired: 1 }
  ],
  6: [
    { players: 2, failsRequired: 1 },
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 3, failsRequired: 2 },
    { players: 4, failsRequired: 1 }
  ],
  7: [
    { players: 2, failsRequired: 1 },
    { players: 3, failsRequired: 1 },
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 2 },
    { players: 4, failsRequired: 1 }
  ],
  8: [
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 5, failsRequired: 2 },
    { players: 5, failsRequired: 1 }
  ],
  9: [
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 5, failsRequired: 2 },
    { players: 5, failsRequired: 1 }
  ],
  10: [
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 5, failsRequired: 2 },
    { players: 5, failsRequired: 1 }
  ],
  11: [
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 6, failsRequired: 2 },
    { players: 6, failsRequired: 1 }
  ],
  12: [
    { players: 3, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 4, failsRequired: 1 },
    { players: 6, failsRequired: 2 },
    { players: 6, failsRequired: 1 }
  ]
}

function getRolesForPlayerCount(playerCount) {
  const config = PLAYER_CONFIGS[playerCount]
  if (!config) {
    throw new Error(`不支持${playerCount}人游戏`)
  }

  return {
    good: [...config.good],
    evil: [...config.evil],
    total: config.good.length + config.evil.length
  }
}

function getMissionConfig(playerCount) {
  const config = MISSION_CONFIGS[playerCount]
  if (!config) {
    throw new Error(`不支持${playerCount}人游戏`)
  }
  return config
}

function assignRoles(players) {
  const playerCount = players.length
  const rolesConfig = getRolesForPlayerCount(playerCount)

  // 合并所有角色
  const allRoles = [...rolesConfig.good, ...rolesConfig.evil]

  // 洗牌
  for (let i = allRoles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allRoles[i], allRoles[j]] = [allRoles[j], allRoles[i]]
  }

  // 分配角色
  return players.map((player, index) => ({
    ...player,
    role: allRoles[index]
  }))
}

module.exports = {
  ROLES,
  PLAYER_CONFIGS,
  MISSION_CONFIGS,
  getRolesForPlayerCount,
  getMissionConfig,
  assignRoles
}
